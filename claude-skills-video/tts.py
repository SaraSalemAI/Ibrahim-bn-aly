# Generates the American-English voice-over with Kokoro TTS and computes the scene timeline.
# Usage: python3 tts.py <kokoro.onnx> <voices.bin>   ->  voice.wav + timing.json
import json, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
N=json.load(open('narration.json')); k=Kokoro(sys.argv[1], sys.argv[2])
SR=24000; LEAD=0.9; GAP=0.45; TAIL=1.6
out=[]; timing=[]; t=0.0
for sc in N['scenes']:
    lead = 1.6 if sc['id']=='s1' else LEAD
    tail = 4.5 if sc['id']=='s14' else (2.2 if sc['id'] in ('s1','s13') else TAIL)
    start=t; cues=[]; pos=lead; chunks=[np.zeros(int(lead*SR))]
    for line in sc['cues']:
        a,sr=k.create(line, voice=N['voice'], speed=0.97, lang='en-us'); assert sr==SR
        cues.append(round(pos,3)); chunks += [a, np.zeros(int(GAP*SR))]; pos += len(a)/SR + GAP
    dur=pos-GAP+tail; total=np.concatenate(chunks)
    total=np.concatenate([total, np.zeros(max(0,int(dur*SR)-len(total)))])[:int(dur*SR)]
    out.append(total); timing.append({'id':sc['id'],'start':round(start,3),'dur':round(len(total)/SR,3),'cues':cues})
    t += len(total)/SR; print(sc['id'], round(len(total)/SR,1))
v=np.concatenate(out); v=v/np.abs(v).max()*0.9
sf.write('voice.wav', v, SR)
json.dump({'scenes':timing,'total':round(t,3)}, open('timing.json','w'), indent=1)
print('total', round(t,1))
