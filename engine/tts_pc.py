#!/usr/bin/env python3
"""Gemini TTS using only the standard library (runs on the PC / any machine with network to Google).

  python3 tts_pc.py content.json out_raw.wav [model] [voice]

Key: env GEMINI_API_KEY, or file GEMINI_KEY_FILE, or ../.repe/gemini_key next to the repo folder.
Exit code 3 = quota exhausted (429), so the caller can fall back to the lite model.
"""
import json, os, sys, base64, wave, re, urllib.request, urllib.error

DIRECTION = ("Lee este guion como un creador de contenido de gimnasio español de unos treinta años, con acento de España "
             "(castellano peninsular, pronunciando la z y la c), ritmo rápido de Reel, tono cercano, seguro y con un punto de humor. "
             "Cada línea es una frase: haz una pausa corta y clara al final de cada línea. No leas estas instrucciones.\n\n")


def key():
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"].strip()
    for f in [os.environ.get("GEMINI_KEY_FILE"),
              os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".repe", "gemini_key"),
              os.path.expanduser("~/.secrets/gemini_key")]:
        if f and os.path.exists(f):
            return open(f).read().strip()
    sys.exit("no Gemini key found")


def main():
    cpath, out = sys.argv[1], sys.argv[2]
    model = sys.argv[3] if len(sys.argv) > 3 else "gemini-3.8-flash-tts"
    voice = sys.argv[4] if len(sys.argv) > 4 else "Achird"
    content = json.load(open(cpath, encoding="utf-8"))
    lines = "\n".join(s["say"] for s in content["scenes"])
    # the lite model reads any direction aloud, so it only gets the script
    text = lines if "lite" in model else DIRECTION + content.get("direction_extra", "") + lines
    body = {"contents": [{"parts": [{"text": text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key()})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=170))
    except urllib.error.HTTPError as e:
        msg = e.read()[:500].decode(errors="ignore")
        print(f"TTS HTTP {e.code} ({model}): {msg}")
        sys.exit(3 if e.code == 429 else 2)
    part = r["candidates"][0]["content"]["parts"][0]["inlineData"]
    pcm = base64.b64decode(part["data"])
    m = re.search(r"rate=(\d+)", part.get("mimeType", "") or ""); rate = int(m.group(1)) if m else 24000
    with wave.open(out, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    json.dump({"model": model, "voice": voice}, open(out + ".json", "w"))
    print(f"OK {model}/{voice} {len(pcm) / 2 / rate:.2f}s -> {out}")


if __name__ == "__main__":
    main()
