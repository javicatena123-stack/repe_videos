#!/usr/bin/env python3
"""Check that a voice-over is read with a Spain (Castilian) accent, not Latin American (runs on the PC, stdlib only).

  python3 accentcheck_pc.py voz.wav

Uses a Gemini text model with audio input (not the TTS model, so it does not spend TTS quota).
Prints {"acento": "ES"|"LATAM"|"DUDOSO", "pruebas": "..."}. Exit 0 = ES, exit 4 = LATAM or DUDOSO, exit 2 = error.
"""
import json, os, sys, base64, re, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
K = open(os.path.join(HERE, "..", "..", ".repe", "gemini_key")).read().strip()
MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.7-flash"]

PROMPT = (
    "Eres un fonetista experto en variedades del español. Escucha este audio (una voz en off en español) y decide "
    "si el acento es de España (castellano peninsular) o latinoamericano / español neutro.\n"
    "Criterios, por orden de importancia:\n"
    "1) Distinción: en España las palabras con z, ce, ci (hacer, gracias, cinco, fuerza, cero, ejercicio, doce, "
    "veces, empezar) se pronuncian con /θ/ (como la 'th' inglesa de 'think'), distinta de la s. Si esas palabras "
    "suenan con /s/ (seseo), NO es de España. Busca varias palabras concretas con z/ce/ci y di cómo suenan.\n"
    "2) La s de España es apical (más 'silbante', hacia 'sh'); la j/g suele ser fuerte y velar/uvular.\n"
    "3) Entonación y ritmo peninsulares frente a la entonación latinoamericana o 'neutra' de doblaje.\n"
    "4) Vocabulario (vosotros, vale, tío… frente a ustedes, ahorita, carro…).\n"
    "Responde SOLO con JSON: {\"acento\": \"ES\" | \"LATAM\" | \"DUDOSO\", \"pruebas\": \"palabras concretas con "
    "z/ce/ci que has oído y cómo suenan, y otros indicios\"}. Usa ES solo si oyes claramente /θ/ en las palabras con "
    "z/ce/ci; si suenan con /s/, LATAM; si no puedes decidirlo, DUDOSO."
)


def main():
    audio = sys.argv[1]
    data = base64.b64encode(open(audio, "rb").read()).decode()
    for m in MODELS:
        body = {"contents": [{"parts": [{"text": PROMPT}, {"inlineData": {"mimeType": "audio/wav", "data": data}}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
        for attempt in range(2):
            try:
                r = json.load(urllib.request.urlopen(urllib.request.Request(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                    data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": K}),
                    timeout=80))
                txt = "".join(p.get("text", "") for p in r["candidates"][0]["content"]["parts"])
                res = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))
                ac = str(res.get("acento", "")).upper()
                res["acento"] = ac if ac in ("ES", "LATAM", "DUDOSO") else "DUDOSO"
                res["modelo"] = m
                print(json.dumps(res, ensure_ascii=False))
                sys.exit(0 if res["acento"] == "ES" else 4)
            except urllib.error.HTTPError as e:
                print(m, "HTTP", e.code, e.read()[:200].decode(errors="ignore"), file=sys.stderr)
                if e.code in (429, 500, 503):
                    time.sleep(4)
                    continue
                break
            except (OSError, urllib.error.URLError) as e:
                print(m, "RED", e, file=sys.stderr)
                break
            except (KeyError, ValueError, AttributeError) as e:
                print(m, "ERR", e, file=sys.stderr)
                break
    sys.exit(2)


if __name__ == "__main__":
    main()
