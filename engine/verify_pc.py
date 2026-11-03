#!/usr/bin/env python3
"""QA on the PC: transcribe a beep-separated audio (from segcheck.py) and compare each segment with its script line.

  python3 verify_pc.py content.json segcheck.wav
Prints one row per scene: OK / REVISAR, expected line and what was heard.
"""
import json, os, sys, base64, re, time, unicodedata, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
K = open(os.path.join(HERE, "..", "..", ".repe", "gemini_key")).read().strip()
MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.7-flash"]


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", " ", s).split()


def main():
    cpath, audio = sys.argv[1:3]
    lines = [s["say"] for s in json.load(open(cpath, encoding="utf-8"))["scenes"]]
    prompt = (f"This Spanish audio has {len(lines)} short voice segments, each followed by a beep. "
              "Transcribe each segment separately, verbatim, exactly as heard (do not fix or complete words). "
              f"Return ONLY JSON: {{\"segments\": [\"...\", ...]}} with exactly {len(lines)} strings in order.")
    data = base64.b64encode(open(audio, "rb").read()).decode()
    for m in MODELS:
        body = {"contents": [{"parts": [{"text": prompt}, {"inlineData": {"mimeType": "audio/wav", "data": data}}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
        for attempt in range(2):
            try:
                r = json.load(urllib.request.urlopen(urllib.request.Request(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                    data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": K}), timeout=80))
                txt = "".join(p.get("text", "") for p in r["candidates"][0]["content"]["parts"])
                segs = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))["segments"]
                print("modelo", m)
                bad = 0
                for i, (l, h) in enumerate(zip(lines, segs)):
                    a, b = norm(l), norm(h)
                    ok = a[:1] == b[:1] and a[-1:] == b[-1:]
                    bad += not ok
                    print(f"{i:2d} {'OK     ' if ok else 'REVISAR'} | {l}\n            oído: {h}")
                if len(segs) != len(lines):
                    print(f"AVISO: {len(segs)} segmentos para {len(lines)} líneas")
                print("RESULTADO:", "todo bien" if bad == 0 and len(segs) == len(lines) else f"{bad} por revisar")
                return
            except urllib.error.HTTPError as e:
                print(m, "HTTP", e.code)
                if e.code in (429, 503):
                    time.sleep(3); continue
                break
            except Exception as e:
                print(m, "ERR", e); break
    sys.exit(2)


if __name__ == "__main__":
    main()
