#!/usr/bin/env python3
"""Gemini TTS using only the standard library (runs on the PC / any machine with network to Google).

  python3 tts_pc.py content.json out_raw.wav [model] [voice]

Key: env GEMINI_API_KEY, or file GEMINI_KEY_FILE, or ../.repe/gemini_key next to the repo folder.
Exit code 3 = quota exhausted (429), so the caller can fall back to the lite model.
"""
import json, os, sys, base64, wave, re, urllib.request, urllib.error

STYLE_LITE = "Castilian Spanish accent from Spain, casual, witty and confident, fast upbeat social-media pace"
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
    if "lite" in model:
        # receta de la voz secundaria aprobada (vídeo 1, 3-nov): guion seguido + estilo como speech_metadata
        text = " ".join(s["say"] for s in content["scenes"])
        part = {"text": text, "speech_metadata": {"style": STYLE_LITE}}
    else:
        # receta de la voz buena elegida por Javier (prueba de voces): instrucciones en español + guion
        part = {"text": DIRECTION + content.get("direction_extra", "") + "\n".join(s["say"] for s in content["scenes"])}
    body = {"contents": [{"parts": [part]}],
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
    inl = r["candidates"][0]["content"]["parts"][0]["inlineData"]
    data = base64.b64decode(inl["data"]); mime = inl.get("mimeType", "") or ""
    if data[:4] == b"RIFF":
        open(out, "wb").write(data); secs = (len(data) - 44) / 48000
    else:
        m = re.search(r"rate=(\d+)", mime); rate = int(m.group(1)) if m else 24000
        with wave.open(out, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(data)
        secs = len(data) / 2 / rate
    json.dump({"model": model, "voice": voice, "mime": mime}, open(out + ".json", "w"))
    print(f"OK {model}/{voice} {secs:.2f}s mime={mime!r} -> {out}")


if __name__ == "__main__":
    main()
