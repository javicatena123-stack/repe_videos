#!/usr/bin/env python3
"""repe. video pipeline.

  python3 build.py all  content.json workdir out.mp4 [--model M] [--voice Achird]
  python3 build.py tts  content.json workdir [--model M]
  python3 build.py align content.json workdir
  python3 build.py render content.json workdir [--only 0,3]
  python3 build.py mix  content.json workdir out.mp4
  python3 build.py stills content.json workdir  (contact sheet of the busiest moments)

Gemini key: env GEMINI_API_KEY or file in env GEMINI_KEY_FILE (default ~/.secrets/gemini_key).
Models: gemini-3.8-flash-tts (voz buena, Achird) | gemini-3.8-flash-lite-tts (secundaria gratuita).
"""
import json, os, re, sys, base64, wave, subprocess, urllib.request, urllib.error, shutil, time, math
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
HINTS = None
SR = 48000
LEAD = 0.12   # s of silence before the voice starts
TAIL = 1.4    # s the last scene holds after the voice ends

DIRECTION = ("Lee este guion como un creador de contenido de gimnasio español de unos treinta años, con acento de España "
             "(castellano peninsular, pronunciando la z y la c), ritmo rápido de Reel, tono cercano, seguro y con un punto de humor. "
             "Cada línea es una frase: haz una pausa corta y clara al final de cada línea. No leas estas instrucciones.\n\n")


def sh(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {r.stderr[-800:]}")
    return r


def load(p):
    return json.load(open(p, encoding="utf-8"))


def clean(s):
    return re.sub(r"<[^>]+>", "", s).strip()


def key():
    k = os.environ.get("GEMINI_API_KEY")
    if k:
        return k.strip()
    f = os.environ.get("GEMINI_KEY_FILE", os.path.expanduser("~/.secrets/gemini_key"))
    return open(f).read().strip()


# ------------------------------------------------------------------ TTS
def tts(content, wd, model="gemini-3.8-flash-tts", voice="Achird"):
    os.makedirs(wd, exist_ok=True)
    lines = [s["say"] for s in content["scenes"]]
    text = DIRECTION + content.get("direction_extra", "") + "\n".join(lines)
    body = {"contents": [{"parts": [{"text": text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key()})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        msg = e.read()[:600].decode(errors="ignore")
        raise SystemExit(f"TTS HTTP {e.code} ({model}): {msg}")
    part = r["candidates"][0]["content"]["parts"][0]["inlineData"]
    pcm = base64.b64decode(part["data"])
    m = re.search(r"rate=(\d+)", part.get("mimeType", "") or ""); rate = int(m.group(1)) if m else 24000
    raw = os.path.join(wd, "voz_raw.wav")
    with wave.open(raw, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    # light clean-up: high-pass, gentle compression, resample to 48k
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af",
        "aresample=48000", "-ar", str(SR), "-ac", "1",
        os.path.join(wd, "voz.wav")])
    json.dump({"model": model, "voice": voice, "ts": time.strftime("%Y-%m-%d %H:%M")}, open(os.path.join(wd, "voz_meta.json"), "w"))
    print(f"TTS ok: {model}/{voice}, {dur(os.path.join(wd, 'voz.wav')):.2f}s")


def dur(p):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).stdout)


# ------------------------------------------------------------------ alignment (silence DP)
def silences(p, noise="-38dB", d=0.09):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", p, "-af", f"silencedetect=noise={noise}:d={d}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    return list(zip(st, en))


def align(content, wd):
    voz = os.path.join(wd, "voz.wav")
    D = dur(voz)
    sil = silences(voz)
    s0 = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
    s1 = sil[-1][0] if sil and sil[-1][1] > D - 0.05 else D
    inner = [(a, b) for a, b in sil if a > s0 + 0.05 and b < s1 - 0.05]
    lines = [s["say"] for s in content["scenes"]]
    N = len(lines)
    w = np.array([len(clean(l)) + 6 for l in lines], float)
    cum = np.cumsum(w) / w.sum()
    # expected boundaries measured in *speaking* time (pauses excluded), mapped back to clock time
    allsil = [(max(a, s0), min(b, s1)) for a, b in silences(voz, "-38dB", 0.12) if b > s0 and a < s1]
    speech = []; cur = s0
    for a, b in allsil:
        if a > cur: speech.append((cur, a))
        cur = max(cur, b)
    if cur < s1: speech.append((cur, s1))
    tot = sum(b - a for a, b in speech) or (s1 - s0)
    def at_frac(f):
        need = f * tot
        for a, b in speech:
            if need <= b - a: return a + need
            need -= b - a
        return s1
    exp = [at_frac(c) for c in cum[:-1]]
    hints_used = False
    if HINTS and os.path.exists(HINTS):
        st = load(HINTS)["starts"]
        if len(st) == N:
            exp = [float(x) for x in st[1:]]; hints_used = True
    mids = [((a + b) / 2, b - a) for a, b in inner]
    M = len(mids)
    K = N - 1
    if M >= K and K > 0:
        INF = 1e18
        # dp[k][j] = best cost placing boundary k at candidate j
        dp = np.full((K, M), INF); bk = np.zeros((K, M), int)
        span = (s1 - s0)
        def cost(k, j):
            m, ln = mids[j]
            return (((m - exp[k]) / span) ** 2 * (2500 if hints_used else 250)) - 0.35 * min(ln, 0.5)
        for j in range(M):
            dp[0][j] = cost(0, j)
        for k in range(1, K):
            best = INF; bi = -1
            for j in range(M):
                if j - 1 >= 0 and dp[k - 1][j - 1] < best:
                    best = dp[k - 1][j - 1]; bi = j - 1
                if bi >= 0 and mids[j][0] - mids[bi][0] > 0.45:
                    dp[k][j] = best + cost(k, j); bk[k][j] = bi
        j = int(np.argmin(dp[K - 1])); picks = [j]
        for k in range(K - 1, 0, -1):
            j = int(bk[k][j]); picks.append(j)
        picks.reverse()
        bounds = [mids[j][0] for j in picks]
        method = "silence-dp" + ("+gemini-hints" if hints_used else "")
    else:
        bounds = exp
        method = "proportional"
    edges = [s0] + bounds + [s1]
    scenes = []
    for i in range(N):
        a = 0.0 if i == 0 else LEAD + edges[i]
        scenes.append({"start": round(a, 3)})
    total = round(LEAD + s1 + TAIL, 3)
    for i in range(N):
        scenes[i]["end"] = scenes[i + 1]["start"] if i + 1 < N else total
    # QA: speaking rate per line
    rates = []
    for i in range(N):
        seg = edges[i + 1] - edges[i]
        rates.append(len(clean(lines[i])) / max(seg, 0.2))
    med = float(np.median(rates))
    flags = [i for i, r in enumerate(rates) if r < med * 0.55 or r > med * 1.7]
    json.dump({"scenes": scenes, "total": total, "voice_dur": D, "method": method, "rates": [round(r, 1) for r in rates],
               "flags": flags}, open(os.path.join(wd, "tiempos.json"), "w"), indent=1)
    for i, s in enumerate(scenes):
        print(f"{i:2d} {s['start']:6.2f}-{s['end']:6.2f}  {rates[i]:5.1f} c/s  {'!!' if i in flags else '  '} {clean(lines[i])[:60]}")
    print(f"method={method} total={total}s flags={flags}")


# ------------------------------------------------------------------ render
def render(content_path, wd, only=None):
    wd = os.path.abspath(wd)
    cmd = ["node", os.path.join(HERE, "render.mjs"), content_path, os.path.join(wd, "tiempos.json"), os.path.join(wd, "scenes")]
    if only:
        cmd.append(only)
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=HERE)
    if r.returncode != 0:
        raise SystemExit(r.stderr[-1500:])
    print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else "render ok")


# ------------------------------------------------------------------ sfx + mix
def _env(n, a=0.005, r=0.25):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / r)


def sfx_whoosh(n=int(0.32 * SR), seed=0):
    rng = np.random.default_rng(seed)
    x = rng.standard_normal(n)
    # sweep a simple one-pole low-pass cutoff up then down
    t = np.linspace(0, 1, n)
    fc = 300 + 5000 * np.sin(np.pi * t) ** 2
    y = np.zeros(n); s = 0.0
    for i in range(n):
        a = math.exp(-2 * math.pi * fc[i] / SR); s = (1 - a) * x[i] + a * s; y[i] = s
    y *= np.sin(np.pi * t) ** 1.5
    return y / (np.abs(y).max() + 1e-9)


def sfx_thump():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 95 * np.exp(-t * 6) + 45
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    y[:400] += np.random.default_rng(1).standard_normal(400) * np.linspace(1, 0, 400) * .6
    return y / np.abs(y).max()


def sfx_pop():
    n = int(0.12 * SR); t = np.arange(n) / SR
    f = 900 - 500 * t / t[-1]
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 40)
    return y / np.abs(y).max()


def sfx_ding():
    n = int(1.1 * SR); t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * 1318.5 * t) + .6 * np.sin(2 * np.pi * 1975.5 * t)) * np.exp(-t * 4) * np.minimum(1, t / .004)
    return y / np.abs(y).max()


def write_wav(p, y):
    y = np.clip(y, -1, 1)
    with wave.open(p, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype(np.int16).tobytes())


def mix(content, wd, out):
    tm = load(os.path.join(wd, "tiempos.json"))
    total = tm["total"]
    n = int(total * SR) + SR
    fx = np.zeros(n)
    def put(sig, at, gain):
        i = max(0, int(at * SR)); j = min(n, i + len(sig)); fx[i:j] += sig[: j - i] * gain
    for i, sc in enumerate(content["scenes"]):
        st = tm["scenes"][i]["start"]
        if i > 0:
            put(sfx_whoosh(seed=i), st - 0.12, 0.10)
        k = sc["kind"]
        if k == "stamp":
            put(sfx_thump(), st + 0.2, 0.55)
        elif k in ("num", "clock", "bars"):
            put(sfx_pop(), st + 0.12, 0.16)
        elif k == "cta":
            put(sfx_ding(), st + 0.15, 0.16)
    write_wav(os.path.join(wd, "sfx.wav"), fx)
    # voice + sfx -> loudness-normalised master
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(wd, "voz.wav"), "-i", os.path.join(wd, "sfx.wav"),
        "-filter_complex", f"[0:a]adelay={int(LEAD*1000)}|{int(LEAD*1000)},apad[v];[v][1:a]amix=inputs=2:normalize=0:duration=longest,"
        f"atrim=0:{total},loudnorm=I=-14:TP=-1.5:LRA=9,aresample={SR}[a]", "-map", "[a]", "-ar", str(SR), "-ac", "2",
        os.path.join(wd, "mix.wav")])
    sdir = os.path.join(wd, "scenes")
    sh(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(sdir, "list.txt"), "-c", "copy",
        os.path.join(wd, "video_noaudio.mp4")])
    tmp = out[:-4] + ".tmp.mp4"
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(wd, "video_noaudio.mp4"), "-i", os.path.join(wd, "mix.wav"),
        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(total), "-movflags", "+faststart", tmp])
    os.replace(tmp, out)
    print("final:", out, f"{dur(out):.2f}s")


def stills(content_path, wd):
    """Contact sheet: one frame per scene at ~70% of its duration (all elements in)."""
    content = load(content_path); tm = load(os.path.join(wd, "tiempos.json"))
    v = os.path.join(wd, "video_noaudio.mp4")
    from PIL import Image
    ims = []
    for i, s in enumerate(tm["scenes"]):
        t = s["start"] + 0.72 * (s["end"] - s["start"])
        p = os.path.join(wd, f"chk_{i:02d}.jpg")
        sh(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", v, "-frames:v", "1", "-q:v", "3", p])
        ims.append(Image.open(p).convert("RGB").resize((270, 480)))
    cols = 7; rows = math.ceil(len(ims) / cols)
    S = Image.new("RGB", (cols * 270, rows * 480), (40, 40, 40))
    for i, im in enumerate(ims):
        S.paste(im, ((i % cols) * 270, (i // cols) * 480))
    S.save(os.path.join(wd, "sheet.jpg"), quality=88)
    print("sheet:", os.path.join(wd, "sheet.jpg"))


if __name__ == "__main__":
    a = sys.argv[1:]
    cmd, cpath, wd = a[0], a[1], a[2]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    content = load(cpath)
    model = opt("--model", "gemini-3.8-flash-tts"); voice = opt("--voice", "Achird")
    HINTS = opt("--hints")
    if cmd == "tts":
        tts(content, wd, model, voice)
    elif cmd == "ingest":   # voz_raw.wav already in wd (generated with tts_pc.py)
        raw = os.path.join(wd, "voz_raw.wav")
        body = sum(len(clean(s["say"])) for s in content["scenes"])
        D = dur(raw); dl = len(DIRECTION.strip())
        if D > (body / 15.0) * 1.35:   # much longer than the script -> direction was probably read aloud
            exp = D * dl / (dl + body)
            c = sorted([x for x in silences(raw, "-38dB", 0.2) if exp * 0.6 < x[0] < exp * 1.4],
                       key=lambda x: abs((x[0] + x[1]) / 2 - exp))
            if c:
                cut = c[0][1] - 0.08
                sh(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{cut:.2f}", "-i", raw, "-c:a", "pcm_s16le", raw + ".trim.wav"])
                os.replace(raw + ".trim.wav", raw)
                print(f"AVISO: la voz leyó las instrucciones; recortado en {cut:.2f}s (verifica el inicio)")
        sh(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af",
            "aresample=48000", "-ar", str(SR), "-ac", "1",
            os.path.join(wd, "voz.wav")])
        print("ingest ok", dur(os.path.join(wd, "voz.wav")))
    elif cmd == "align":
        align(content, wd)
    elif cmd == "render":
        render(os.path.abspath(cpath), wd, opt("--only"))
    elif cmd == "mix":
        mix(content, wd, a[3])
    elif cmd == "stills":
        stills(cpath, wd)
    elif cmd == "all":
        out = a[3]
        if "--skip-tts" not in a:
            tts(content, wd, model, voice)
        align(content, wd); render(os.path.abspath(cpath), wd); mix(content, wd, out); stills(cpath, wd)
