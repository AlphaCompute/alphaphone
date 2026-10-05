import json, sys, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
S=sys.argv[1]; voice=sys.argv[2] if len(sys.argv)>2 else "af_heart"; speed=float(sys.argv[3]) if len(sys.argv)>3 else 1.12
k=Kokoro(f"{S}/tts/kokoro-v1.0.onnx", f"{S}/tts/voices-v1.0.bin")
out=[]
for sc in json.load(open(f"{S}/script.json")):
    a,sr=k.create(sc["text"], voice=voice, speed=speed, lang="en-us")
    # trim silence
    idx=np.where(np.abs(a)>0.01)[0]; a=a[max(0,idx[0]-600):idx[-1]+1200]
    sf.write(f"{S}/vo/{sc['id']}.wav", a, sr); out.append((sc["id"], round(len(a)/sr,2)))
    print(sc["id"], round(len(a)/sr,2), flush=True)
print("total", round(sum(d for _,d in out),2))
