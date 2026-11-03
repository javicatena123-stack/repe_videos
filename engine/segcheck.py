#!/usr/bin/env python3
"""Build a QA audio: each scene's voice segment separated by a beep + silence, so a single transcription request
can confirm that every subtitle matches what is said.

  python3 segcheck.py content.json workdir out.wav      (cloud)
  then on the PC: python3 verify_pc.py content.json out.wav
"""
import json, os, sys, wave, subprocess
import numpy as np

SR = 16000
LEAD = 0.12


def main():
    cpath, wd, out = sys.argv[1:4]
    content = json.load(open(cpath, encoding="utf-8"))
    tm = json.load(open(os.path.join(wd, "tiempos.json")))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(wd, "voz.wav"), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(float) / 32768
    t = np.arange(int(0.25 * SR)) / SR
    beep = 0.25 * np.sin(2 * np.pi * 1000 * t) * np.minimum(1, np.minimum(t, t[-1] - t) / 0.01)
    gap = np.zeros(int(0.6 * SR))
    parts = []
    n = len(content["scenes"])
    for i, sc in enumerate(tm["scenes"]):
        a = 0 if i == 0 else sc["start"] - LEAD
        b = tm["voice_dur"] if i == n - 1 else tm["scenes"][i + 1]["start"] - LEAD
        parts += [x[int(a * SR):int(b * SR)], gap, beep, gap]
    y = np.concatenate(parts)
    with wave.open(out, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    print("ok", out, f"{len(y)/SR:.1f}s", n, "segmentos")


if __name__ == "__main__":
    main()
