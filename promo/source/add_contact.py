import json, numpy as np, soundfile as sf, sherpa_onnx as so
from scipy.signal import resample_poly
SR=44100
KD='tts/kokoro-multi-lang-v1_0/'
KT=so.OfflineTts(so.OfflineTtsConfig(model=so.OfflineTtsModelConfig(kokoro=so.OfflineTtsKokoroModelConfig(model=KD+'model.onnx',voices=KD+'voices.bin',tokens=KD+'tokens.txt',data_dir=KD+'espeak-ng-data',dict_dir=KD+'dict',lexicon=KD+'lexicon-us-en.txt'),num_threads=4)))
WH='tts/sherpa-onnx-whisper-small/small-'
ASR=so.OfflineRecognizer.from_whisper(encoder=WH+'encoder.int8.onnx',decoder=WH+'decoder.int8.onnx',tokens=WH+'tokens.txt',language='en',task='transcribe',num_threads=4)
TXT="For more details, call or WhatsApp us on: zero one two zero, one eight three, four four four two."
a=KT.generate(TXT,sid=3,speed=1.0); x=resample_poly(np.array(a.samples,np.float32),SR,a.sample_rate).astype(np.float32)
env=np.convolve(np.abs(x),np.ones(441)/441,'same'); idx=np.nonzero(env>0.01)[0]; x=x[max(0,idx[0]-600):idx[-1]+int(.18*SR)]
x=x*(0.085/(np.sqrt(np.mean(x**2))+1e-9))
st=ASR.create_stream(); st.accept_waveform(SR,np.concatenate([np.zeros(int(.3*SR),np.float32),x,np.zeros(int(.8*SR),np.float32)])); ASR.decode_stream(st); print('ASR:',st.result.text)
v,_=sf.read('voice_en.wav',dtype='float32'); tm=json.load(open('timing_en.json'))
s13=tm['scenes'][-1]; L=s13['lines'][-1]['end']; st0=L+0.55
pk=np.abs(v).max()
x=x/ (0.085) * (np.sqrt(np.mean(v[int(s13['lines'][-1]['start']*SR):int(L*SR)]**2)))  # match level of previous line
new=np.concatenate([v[:int(st0*SR)],x,np.zeros(int(SR*4.4),np.float32)])
s13['lines'].append({'text':'For more details, call or WhatsApp: 01201834442','start':round(st0,3),'end':round(st0+len(x)/SR,3)})
tm['duration']=round(len(new)/SR,3); s13['end']=tm['duration']
sf.write('voice_en_c.wav',new,SR); json.dump(tm,open('timing_en_c.json','w'),ensure_ascii=False,indent=1)
print('dur',tm['duration'],'s13 start',s13['start'])
