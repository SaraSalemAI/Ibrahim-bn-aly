import numpy as np, soundfile as sf, json
x,sr=sf.read('voice.wav',dtype='float32'); hop=sr//30
n=len(x)//hop; r=np.sqrt(np.array([np.mean(x[i*hop:(i+1)*hop]**2) for i in range(n)]))
r=r/np.percentile(r[r>0.005],95); r=np.clip(r,0,1)
open('env.js','w').write('window.ENV='+json.dumps([round(float(v),3) for v in r])+';')
print(n)
