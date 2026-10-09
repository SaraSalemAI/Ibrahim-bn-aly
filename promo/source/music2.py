import numpy as np, wave
import json
TM=json.load(open('timing.json')); SC={x['id']:x for x in TM['scenes']}
SR=44100; DUR=TM['duration']; N=int(SR*DUR); t=np.arange(N)/SR
L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(7)
BPM=100; B=60/BPM
def hz(m): return 440*2**((m-69)/12)
def add(sig,start,pan=0.0,gain=1.0):
    i=int(start*SR); 
    if i>=N: return
    s=sig[:N-i]*gain; L[i:i+len(s)]+=s*(1-pan)/1; R[i:i+len(s)]+=s*(1+pan)/1
def lp(x,a):  # one-pole lowpass
    y=np.empty_like(x); acc=0.0
    for i in range(len(x)): acc+=a*(x[i]-acc); y[i]=acc
    return y
# chords (A minor feel): Am F C G
chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]
bar=4*B; seg=2*bar
def section_gain(x):
    # arrangement curve for drums
    if x<SC['s2']['start']: return 0
    if SC['s6']['start']<=x<SC['s7']['start']: return .4
    if x>=DUR-4: return max(0,(DUR-x)/4)
    return 1
# pad
pad=np.zeros(N)
for k in range(int(DUR/seg)+1):
    st=k*seg; ch=chords[k%4]; n=int(seg*SR)+SR
    tt=np.arange(n)/SR; env=np.minimum(1,tt/1.2)*np.minimum(1,np.maximum(0,(seg+1-tt))/1.0)
    s=np.zeros(n)
    for m in ch+[ch[0]+12]:
        f=hz(m)
        for d in (-0.12,0.12): s+=np.sin(2*np.pi*f*(1+d/100)*tt+rng.random()*6)+.3*np.sin(4*np.pi*f*tt)
    i=int(st*SR); s=s*env; e=min(N,i+n); pad[i:e]+=s[:e-i]
pad*=0.035*(1+0.15*np.sin(2*np.pi*0.1*t))
L+=pad;R+=pad
# bass (8ths) from 6.5s
for k in range(int(DUR/(B/2))):
    st=k*B/2; g=section_gain(st)
    if g==0: continue
    ch=chords[int(st//seg)%4]; f=hz(ch[0]-12); n=int(B/2*SR)
    tt=np.arange(n)/SR; s=(np.sin(2*np.pi*f*tt)+.35*np.sin(4*np.pi*f*tt))*np.exp(-tt*5)
    add(s,st,0,0.16*g)
# kick, clap, hats
def kick():
    n=int(.45*SR); tt=np.arange(n)/SR; f=50+90*np.exp(-tt*30)
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*7)
def clap():
    n=int(.25*SR); tt=np.arange(n)/SR; x=rng.standard_normal(n); x=x-lp(x,.15)
    return x*np.exp(-tt*18)
def hat():
    n=int(.06*SR); tt=np.arange(n)/SR; x=rng.standard_normal(n); x=x-lp(x,.6); return x*np.exp(-tt*70)
K=kick();C=clap();H=hat()
for k in range(int(DUR/B)):
    st=k*B; g=section_gain(st)
    if g==0: continue
    if k%4 in (0,2) or (g==1 and k%8==7): add(K,st,0,.55*g)
    if k%4 in (1,3): add(C,st,0,.10*g)
    for h in (0,.5): add(H,st+h*B,.3 if h else -.3,(.035 if h else .02)*g)
# pluck arp 16ths in main sections
for k in range(int(DUR/(B/4))):
    st=k*B/4
    if not (SC['s3']['start']<=st<SC['s6']['start'] or SC['s8i']['start']<=st<DUR-4): continue
    ch=chords[int(st//seg)%4]; m=(ch+[ch[0]+12])[k%4]+12; f=hz(m)
    n=int(.35*SR); tt=np.arange(n)/SR; s=(np.sin(2*np.pi*f*tt)+.4*np.sin(6*np.pi*f*tt))*np.exp(-tt*14)
    add(s,st,.4*np.sin(k*.7),.03)
# whooshes at transitions
def whoosh(len_s=1.0):
    n=int(len_s*SR); x=rng.standard_normal(n); tt=np.arange(n)/SR
    a=0.02+0.5*np.sin(np.pi*tt/len_s)**2
    y=np.empty(n); acc=0
    for i in range(n): acc+=a[i]*(x[i]-acc); y[i]=acc
    return y*np.sin(np.pi*tt/len_s)**2
W=whoosh(1.1)
for tr in [x['start'] for x in TM['scenes'][1:]]:
    add(W,tr-0.75,0,.35)
# impacts
def impact():
    n=int(2.5*SR); tt=np.arange(n)/SR
    s=np.sin(2*np.pi*(40+60*np.exp(-tt*10))*tt)*np.exp(-tt*2.2)
    x=rng.standard_normal(n); s+=lp(x,.05)*np.exp(-tt*3)*.8
    return s
I=impact()
for tm in [SC['s1']['lines'][0]['start']-.1,SC['s3']['start']+.2,SC['s7']['start']+.4,SC['s13']['start']+.1]: add(I,tm,0,.4)
# riser before CTA
n=int(4*SR); tt=np.arange(n)/SR; x=rng.standard_normal(n)
add(lp(x,.08)*(tt/4)**2+0.15*np.sin(2*np.pi*(200+600*(tt/4)**2)*tt)*(tt/4)**2,SC['s13']['start']-4,0,.25)
# master fades + normalize + soft clip
fade=np.minimum(1,t/1.5)*np.minimum(1,np.maximum(0,DUR-t)/3.0)
L*=fade;R*=fade
pk=max(abs(L).max(),abs(R).max()); L/=pk;R/=pk
L=np.tanh(L*1.4)/np.tanh(1.4)*.89; R=np.tanh(R*1.4)/np.tanh(1.4)*.89
import soundfile as sf
from scipy.ndimage import maximum_filter1d, uniform_filter1d
v,vsr=sf.read('voice.wav',dtype='float32'); v=np.pad(v,(0,max(0,N-len(v))))[:N]
env=maximum_filter1d((np.abs(v)>0.01).astype(np.float32),int(.35*SR)); env=uniform_filter1d(env,int(.25*SR))
g=0.62-0.46*env
st=np.stack([L*g+v*1.0,R*g+v*1.0],1); st=st/np.abs(st).max()*0.95
data=(st*32767).astype('<i2')
with wave.open('final_audio.wav','wb') as w: w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(data.tobytes())
print('ok')
