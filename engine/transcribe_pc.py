#!/usr/bin/env python3
"""QA: transcribe a voice-over with Gemini (stdlib only). python3 transcribe_pc.py audio.wav [model]"""
import json, sys, os, base64, urllib.request, urllib.error
K=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..",".repe","gemini_key")).read().strip()
audio=sys.argv[1]; models=[sys.argv[2]] if len(sys.argv)>2 else ["gemini-3.5-transcribe","gemini-3.8-flash"]
data=base64.b64encode(open(audio,"rb").read()).decode()
prompt=("Transcribe this Spanish (Spain) voice-over verbatim, sentence by sentence. Return ONLY JSON: "
        "[{\"start\": seconds_float, \"end\": seconds_float, \"text\": \"...\"}]. Include any words that sound like instructions or meta text.")
for m in models:
    body={"contents":[{"parts":[{"text":prompt},{"inlineData":{"mimeType":"audio/wav","data":data}}]}],
          "generationConfig":({"temperature":0} if "transcribe" in m else {"responseMimeType":"application/json","temperature":0})}
    try:
        r=json.load(urllib.request.urlopen(urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
            data=json.dumps(body).encode(),headers={"Content-Type":"application/json","x-goog-api-key":K}),timeout=170))
        parts=r["candidates"][0]["content"]["parts"]; txt="".join(pp.get("text","") for pp in parts) or json.dumps(parts)[:3000]
        out=audio+".transcript.json"; open(out,"w").write(txt); print("model",m); print(txt[:4000]); break
    except urllib.error.HTTPError as e:
        print(m,"HTTP",e.code,e.read()[:300].decode(errors="ignore"))
