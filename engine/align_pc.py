#!/usr/bin/env python3
"""Ask Gemini where each script line starts in the voice-over (runs on the PC, stdlib only).

  python3 align_pc.py content.json voz.wav out_hints.json

Writes {"starts": [s0, s1, ...]} (seconds, one per line). build.py align --hints out_hints.json snaps them to real pauses.
"""
import json, os, sys, base64, re, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
K = open(os.path.join(HERE, "..", "..", ".repe", "gemini_key")).read().strip()
MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.7-flash"]


def main():
    cpath, audio, out = sys.argv[1:4]
    lines = [s["say"] for s in json.load(open(cpath, encoding="utf-8"))["scenes"]]
    numbered = "\n".join(f"{i}: {l}" for i, l in enumerate(lines))
    prompt = ("This is a Spanish voice-over that reads the following numbered lines in order:\n" + numbered +
              "\n\nListen carefully and return ONLY a JSON object {\"starts\": [..]} with the time in seconds (2 decimals) "
              "at which the first word of each line begins in the audio, one value per line, in order.")
    data = base64.b64encode(open(audio, "rb").read()).decode()
    for m in MODELS:
        body = {"contents": [{"parts": [{"text": prompt}, {"inlineData": {"mimeType": "audio/wav", "data": data}}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
        for attempt in range(2):
            try:
                r = json.load(urllib.request.urlopen(urllib.request.Request(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                    data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": K}), timeout=75))
                txt = "".join(p.get("text", "") for p in r["candidates"][0]["content"]["parts"])
                st = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))["starts"]
                if len(st) != len(lines):
                    raise ValueError(f"{len(st)} starts for {len(lines)} lines")
                json.dump({"starts": st, "model": m}, open(out, "w"))
                print("OK", m, st)
                return
            except urllib.error.HTTPError as e:
                print(m, "HTTP", e.code, e.read()[:200].decode(errors="ignore"))
                if e.code in (429, 503):
                    time.sleep(8)
                    continue
                break
            except Exception as e:
                print(m, "ERR", e)
                break
    sys.exit(2)


if __name__ == "__main__":
    main()
