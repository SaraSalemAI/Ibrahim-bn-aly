import re, json, wave, io, sys, os
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from piper import PiperVoice
from piper.config import SynthesisConfig
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_egy import SCENES

SR = 44100
T = 'tts/'
AR = PiperVoice.load(T+'vits-piper-ar_JO-SA_dii-high/ar_JO-SA_dii-high.onnx', config_path=T+'vits-piper-ar_JO-SA_dii-high/ar_JO-SA_dii-high.onnx.json')
EN = PiperVoice.load(T+'vits-piper-en_GB-jenny_dioco-medium/en_GB-jenny_dioco-medium.onnx', config_path=T+'vits-piper-en_GB-jenny_dioco-medium/en_GB-jenny_dioco-medium.onnx.json')
CFG_AR = SynthesisConfig(length_scale=float(os.environ.get('AR_LS','0.9')), noise_scale=0.4, noise_w_scale=0.5)
import sherpa_onnx as so, unicodedata
WH='tts/sherpa-onnx-whisper-small/small-'
ASR={l:so.OfflineRecognizer.from_whisper(encoder=WH+'encoder.int8.onnx',decoder=WH+'decoder.int8.onnx',tokens=WH+'tokens.txt',language=l,task='transcribe',num_threads=4) for l in ('ar','en')}
K=int(os.environ.get('TAKES','4'))
LOG=open('takes_egy.log','w')
CFG_EN = SynthesisConfig(length_scale=1.0, noise_scale=0.5, noise_w_scale=0.6)

EN_MAP = [(r'\bExcel \+ AI\b', 'Excel plus A.I.'), (r'\bFP&A\b', 'F.P. and A.'), (r'\bLLMs\b', 'L.L.Ms'), (r'\bLLM\b', 'L.L.M.'),
          (r'\bKPIs\b', 'K.P.I.s'), (r'\bFMVA\b', 'F.M.V.A.'), (r'\bAI\b', 'A.I.'), (r'\bvs\b', 'versus'), ('’', "'"), (r'\+', 'plus')]

from piper.tashkeel import TashkeelDiacritizer
TASH=TashkeelDiacritizer()
HAR='\u064B\u064C\u064D\u064E\u064F\u0650'
def egy_audio(text, cfg):
    d = TASH(text)
    d = re.sub('(['+HAR+'])+(?=[\\s،.؟?!:]|$)', '', d)
    AR.use_tashkeel = False
    out = []
    for sent in AR.phonemize(d):
        ph = ''.join(sent).replace('q', 'ʔ').replace('θ', 't').replace('ð', 'z')
        out.append(AR.phoneme_ids_to_audio(AR.phonemes_to_ids(list(ph)), cfg))
    return np.concatenate(out).astype(np.float32), AR.config.sample_rate
def synth1(voice, text, cfg):
    if voice is AR:
        x, sr = egy_audio(text, cfg)
        x = resample_poly(x, SR, sr).astype(np.float32)
        env = np.convolve(np.abs(x), np.ones(441)/441, 'same'); idx = np.nonzero(env > 0.012)[0]
        if len(idx): x = x[max(0, idx[0]-600): idx[-1]+int(0.15*SR)]
        return x * (0.085 / (np.sqrt(np.mean(x**2)) + 1e-9))
    return synth0(voice, text, cfg)
def synth0(voice, text, cfg):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w: voice.synthesize_wav(text, w, syn_config=cfg)
    buf.seek(0); x, sr = sf.read(buf, dtype='float32')
    x = resample_poly(x, SR, sr).astype(np.float32)
    # trim silence
    env = np.convolve(np.abs(x), np.ones(441)/441, 'same'); idx = np.nonzero(env > 0.012)[0]
    if len(idx): x = x[max(0, idx[0]-600): idx[-1]+int(0.15*SR)]
    rms = np.sqrt(np.mean(x**2)) + 1e-9
    return x * (0.085 / rms)

def norm(t, lang):
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(c for c in t if not unicodedata.combining(c))
    if lang == 'ar':
        t = re.sub('[إأآاقءئؤ]', 'ا', t).replace('ة', 'ه').replace('ى', 'ي').replace('ـ','').replace('ذ','ز').replace('ث','ت')
        t = re.sub('[^\u0621-\u064A]', '', t)
    else:
        t = re.sub('[^a-z]', '', t.lower())
    return t
def cer(a, b):
    if not a: return 0.0
    d = list(range(len(b)+1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j]+1, d[j-1]+1, p+(ca != cb))
    return d[len(b)]/len(a)
def synth(voice, text, cfg, target=None):
    lang = 'ar' if voice is AR else 'en'
    tgt = norm(target or text, lang)
    best = None
    KK = (K*2 if len(text.split())<=3 else K) if lang=='ar' else 1
    if K==1:
        x = synth1(voice, text, cfg); LOG.write(f'- | {text}\n'); return x
    for k in range(KK):
        if lang=='en':
            x = synth1(voice, text, cfg); best=(0.0,x,'-'); break
        x = synth1(voice, text, cfg)
        st = ASR[lang].create_stream(); st.accept_waveform(SR, np.concatenate([np.zeros(int(.3*SR),np.float32), x, np.zeros(int(.8*SR),np.float32)])); ASR[lang].decode_stream(st)
        h = st.result.text; c = cer(tgt, norm(h, lang))
        if best is None or c < best[0]: best = (c, x, h)
        if c <= 0.1: break
    LOG.write(f"{best[0]:.2f} | {text} | {best[2]}\n"); LOG.flush()
    return best[1]

LATIN = re.compile(r"[A-Za-z][A-Za-z0-9&+’'\-\. ]*[A-Za-z0-9\.]|[A-Za-z]")
def runs(line):
    out = []; pos = 0
    for m in LATIN.finditer(line):
        if m.start() > pos: out.append(('ar', line[pos:m.start()]))
        out.append(('en', m.group())); pos = m.end()
    if pos < len(line): out.append(('ar', line[pos:]))
    return out

def clean_ar(s):
    s = s.replace('“', '').replace('”', '').replace('…', '،')
    s = re.sub(r'بالـ\s*$', 'بِ', s.rstrip()) if s.rstrip().endswith('بالـ') else s
    s = re.sub(r'الـ\s*$', '', s.rstrip()) if s.rstrip().endswith('الـ') else s
    s = re.sub(r'(^|\s)وِ?\s*$', r'\1وِ', s)
    return s.strip(' ،:')

def clean_en(s):
    for a, b in EN_MAP: s = re.sub(a, b, s)
    return s.strip()

def line_audio(line):
    pieces = []
    rs = runs(line)
    for i, (kind, txt) in enumerate(rs):
        if kind == 'ar':
            raw = txt
            t = clean_ar(txt)
            if re.sub('[\u064B-\u0652\s.،؟?!:…]','',t) in ('و',''):
                pieces.append(np.zeros(int(SR*(0.22 if re.search('[،:.؟?…]', raw) else 0.06)), np.float32)); continue
            a = synth(AR, t if re.search('[.؟?!]$', t) else t+'.', CFG_AR, target=t)
        else:
            a = synth(EN, clean_en(txt), CFG_EN, target=clean_en(txt).replace('A.I.','AI').replace('L.L.M','LLM').replace('K.P.I.','KPI').replace('F.M.V.A.','FMVA').replace('F.P. and A.','FP and A'))
        gap_after = 0.07
        nxt = rs[i+1][1] if i+1 < len(rs) else ''
        if re.match(r'^\s*[،:.؟?…]', nxt) or re.search(r'[،:.؟?…]\s*$', txt): gap_after = 0.25
        pieces += [a, np.zeros(int(SR*gap_after), np.float32)]
    return np.concatenate(pieces)

LEAD = 0.8        # seconds of visuals before first line of a scene
LINE_GAP = 0.32
SCENE_TAIL = 0.7

timeline = []; chunks = []; t = 0.0
for sid, lines in SCENES:
    sc = {'id': sid, 'start': round(t, 3), 'lines': []}
    t += LEAD; chunks.append(np.zeros(int(SR*LEAD), np.float32))
    for (cap, *rest) in lines:
        a = line_audio(rest[0] if rest else cap)
        sc['lines'].append({'text': cap, 'start': round(t, 3), 'end': round(t+len(a)/SR, 3)})
        chunks.append(a); t += len(a)/SR
        chunks.append(np.zeros(int(SR*LINE_GAP), np.float32)); t += LINE_GAP
        print(sid, round(len(a)/SR, 2), cap[:50], flush=True)
    chunks.append(np.zeros(int(SR*SCENE_TAIL), np.float32)); t += SCENE_TAIL
    if sid == 's13':
        chunks.append(np.zeros(int(SR*3.5), np.float32)); t += 3.5
    sc['end'] = round(t, 3); timeline.append(sc)

v = np.concatenate(chunks)
v = v / (np.abs(v).max() + 1e-9) * 0.9
sf.write('voice_egy.wav', v, SR)
json.dump({'duration': round(t, 3), 'scenes': timeline}, open('timing_egy.json', 'w'), ensure_ascii=False, indent=1)
print('TOTAL', round(t, 1))
