# Generates an original ambient/electronic soundtrack (soundtrack.wav) synced to the scene timeline.
import numpy as np, wave
SR=44100; DUR=145.0; N=int(SR*DUR)
L=np.zeros(N); R=np.zeros(N)
t=np.arange(N)/SR
def hz(m): return 440*2**((m-69)/12)
BEAT=60/96
# Am - F - C - G  (each 8 beats)
CH=[[57,60,64,69],[53,57,60,65],[48,55,60,64],[55,59,62,67]]
ROOT=[45,41,48,43]
SCENES=[0,9,22,36.5,49.5,61,74.5,87.5,99.5,111,123.5,132.5]
def add(sig,start,pan=0.0,gain=1.0):
    i=int(start*SR); j=min(N,i+len(sig))
    if j<=i: return
    s=sig[:j-i]*gain; L[i:j]+=s*(1-pan)*.5*2**.5*0.7071; R[i:j]+=s*(1+pan)*.5*2**.5*0.7071
def env(n,a,r):
    e=np.ones(n); na=int(a*SR); nr=int(r*SR)
    e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr); return e
# pads
chord_len=8*BEAT; k=0; st=0.0
while st<DUR:
    c=CH[k%4]; n=int((chord_len+1.5)*SR); tt=np.arange(n)/SR; sig=np.zeros(n)
    for m in c:
        f=hz(m)
        for d in (-0.12,0,0.12):
            ff=f*2**(d/12*0.1)
            sig+=np.sin(2*np.pi*ff*tt+np.random.rand()*6)+0.25*np.sin(4*np.pi*ff*tt)+0.08*np.sin(6*np.pi*ff*tt)
    sig*=env(n,1.2,1.6)/len(c)/3
    add(sig,st,pan=0.25*(-1)**k,gain=0.22)
    st+=chord_len; k+=1
# drums + bass + arp (from 9s until outro)
DSTART,DEND=9.0,132.5
def kick():
    n=int(.35*SR); tt=np.arange(n)/SR; f=45+80*np.exp(-tt*28)
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*9)
def hat():
    n=int(.06*SR); x=np.random.randn(n); x=np.diff(x,prepend=0); return x*np.exp(-np.arange(n)/SR*70)
def pluck(f,len_=0.5):
    n=int(len_*SR); tt=np.arange(n)/SR
    return (np.sin(2*np.pi*f*tt)+.35*np.sin(4*np.pi*f*tt)+.12*np.sin(6*np.pi*f*tt))*np.exp(-tt*7)*np.minimum(1,tt*400)
K=kick(); b=0
while True:
    bt=DSTART+b*BEAT
    if bt>=DEND: break
    sec=int((bt)/chord_len)%4
    add(K,bt,gain=0.42)
    add(hat(),bt+BEAT/2,pan=0.3,gain=0.10)
    if b%4==3: add(hat(),bt+BEAT*0.75,pan=-0.3,gain=0.06)
    for h in (0,0.5):
        f=hz(ROOT[sec]-12+12*0); add(pluck(f,0.28)*0.9,bt+h*BEAT,gain=0.30)
    if bt>=22:
        c=CH[sec]; seq=[c[0]+12,c[2]+12,c[1]+12,c[3]+12]
        for q in range(2):
            m=seq[(b*2+q)%4]; add(pluck(hz(m),0.6),bt+q*BEAT/2,pan=0.5*np.sin(b*.7+q),gain=0.07)
    b+=1
# transition whooshes + soft impacts
for s in SCENES[1:]:
    n=int(1.2*SR); tt=np.arange(n)/SR; x=np.random.randn(n)
    # simple one-pole low-pass with sweeping coefficient
    y=np.zeros(n); a=np.linspace(0.02,0.35,n); acc=0
    for i in range(n): acc+=a[i]*(x[i]-acc); y[i]=acc
    y*=np.linspace(0,1,n)**2
    add(y,s-1.2,gain=0.35)
    n2=int(1.5*SR); tt=np.arange(n2)/SR
    add(np.sin(2*np.pi*55*tt)*np.exp(-tt*3)+0.3*np.random.randn(n2)*np.exp(-tt*25),s,gain=0.25)
# outro bell chime
for i,m in enumerate([69,72,76,81]):
    add(pluck(hz(m),3.0)*0.8,132.8+i*0.35,pan=(i-1.5)*.3,gain=0.18)
# reverb (multi-tap feedback delays)
def verb(x):
    y=x.copy()
    for d,g in ((0.0297,.35),(0.0371,.33),(0.0411,.31),(0.0437,.3)):
        n=int(d*SR); buf=np.zeros_like(x); buf[n:]=x[:-n]
        for _ in range(5): buf[n:]+=buf[:-n]*g*0.6; 
        y+=buf*0.12
    return y
L=verb(L); R=verb(R)
fade=np.ones(N); fi=int(1.5*SR); fo=int(5*SR); fade[:fi]=np.linspace(0,1,fi); fade[-fo:]=np.linspace(1,0,fo)
L*=fade; R*=fade
m=max(np.abs(L).max(),np.abs(R).max()); L=L/m*0.85; R=R/m*0.85
out=(np.stack([L,R],1)*32767).astype(np.int16)
with wave.open('soundtrack.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('ok')
