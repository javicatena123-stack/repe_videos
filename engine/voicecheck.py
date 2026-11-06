"""Comprueba que la voz de un audio es la Achird aprobada (huella de voz con resemblyzer).
Uso (nube): python3 engine/voicecheck.py work/X/voz.wav [otro.wav ...]
Compara con engine/ref_voz.npy (media de las voces de vídeos aprobados: creatina 5 nov, excusas 6 nov, tren superior 5 nov).
Aprobadas: 0,95-0,96. Si sale < 0,94, la voz se ha ido: repite el TTS (otra toma) y quédate con la que más puntúe.
Requisito: pip install --break-system-packages resemblyzer
"""
import sys, os, warnings
warnings.filterwarnings("ignore")
import numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav
REF = os.path.join(os.path.dirname(__file__), "ref_voz.npy")
enc = VoiceEncoder(verbose=False)
if sys.argv[1:2] == ["--build"]:
    E = np.mean([enc.embed_utterance(preprocess_wav(f)) for f in sys.argv[2:]], 0)
    np.save(REF, E / np.linalg.norm(E)); print("ref guardada", REF); sys.exit()
R = np.load(REF)
bad = 0
for f in sys.argv[1:]:
    s = float(np.dot(enc.embed_utterance(preprocess_wav(f)), R))
    ok = s >= 0.94; bad += not ok
    print(f"{'OK     ' if ok else 'REPETIR'} {s:.3f}  {f}")
sys.exit(1 if bad else 0)
