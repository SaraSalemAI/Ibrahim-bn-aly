import re, json, wave, io, os, sys
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from piper import PiperVoice
from piper.config import SynthesisConfig
import sherpa_onnx as so
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_en import SCENES

SR = 44100
V = PiperVoice.load('tts/vits-piper-en_GB-cori-high/en_GB-cori-high.onnx')
CFG = SynthesisConfig(length_scale=float(os.environ.get('LS', '0.94')), noise_scale=0.45, noise_w_scale=0.6)
WH = 'tts/sherpa-onnx-whisper-small/small-'
ASR = so.OfflineRecognizer.from_whisper(encoder=WH+'encoder.int8.onnx', decoder=WH+'decoder.int8.onnx', tokens=WH+'tokens.txt', language='en', task='transcribe', num_threads=4)
K = int(os.environ.get('TAKES', '2'))
LOG = open('takes_en.log', 'w')

MAP = [(r'\bFP&A\b', 'F. P. and A.'), (r'\bLLMs\b', 'L. L. M.s'), (r'\bLLM\b', 'L. L. M.'), (r'\bKPIs\b', 'K. P. I.s'),
       (r'\bFMVA\b', 'F. M. V. A.'), (r'\bAI\b', 'A. I.'), ('’', "'")]
def tts_text(s):
    for a, b in MAP: s = re.sub(a, b, s)
    return s

def synth1(text):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w: V.synthesize_wav(text, w, syn_config=CFG)
    buf.seek(0); x, sr = sf.read(buf, dtype='float32')
    x = resample_poly(x, SR, sr).astype(np.float32)
    env = np.convolve(np.abs(x), np.ones(441)/441, 'same'); idx = np.nonzero(env > 0.01)[0]
    if len(idx): x = x[max(0, idx[0]-600): idx[-1]+int(0.18*SR)]
    return x * (0.085 / (np.sqrt(np.mean(x**2)) + 1e-9))

def norm(t):
    t = t.lower()
    return re.sub('[^a-z]', '', t)
def cer(a, b):
    if not a: return 0.0
    d = list(range(len(b)+1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j]+1, d[j-1]+1, p+(ca != cb))
    return d[len(b)]/len(a)

def line_audio(cap):
    t = tts_text(cap); tgt = norm(cap)
    best = None
    for k in range(K):
        x = synth1(t)
        st = ASR.create_stream(); st.accept_waveform(SR, np.concatenate([np.zeros(int(.3*SR), np.float32), x, np.zeros(int(.8*SR), np.float32)])); ASR.decode_stream(st)
        c = cer(tgt, norm(st.result.text))
        if best is None or c < best[0]: best = (c, x, st.result.text)
        if c <= 0.06: break
    LOG.write(f"{best[0]:.2f} | {cap} | {best[2]}\n"); LOG.flush()
    return best[1]

LEAD, LINE_GAP, SCENE_TAIL = 0.8, 0.38, 0.7
timeline = []; chunks = []; t = 0.0
for sid, lines in SCENES:
    sc = {'id': sid, 'start': round(t, 3), 'lines': []}
    t += LEAD; chunks.append(np.zeros(int(SR*LEAD), np.float32))
    for cap in lines:
        a = line_audio(cap)
        sc['lines'].append({'text': cap, 'start': round(t, 3), 'end': round(t+len(a)/SR, 3)})
        chunks.append(a); t += len(a)/SR
        chunks.append(np.zeros(int(SR*LINE_GAP), np.float32)); t += LINE_GAP
    chunks.append(np.zeros(int(SR*SCENE_TAIL), np.float32)); t += SCENE_TAIL
    if sid == 's13': chunks.append(np.zeros(int(SR*3.5), np.float32)); t += 3.5
    sc['end'] = round(t, 3); timeline.append(sc)
    print(sid, round(t, 1), flush=True)
v = np.concatenate(chunks); v = v/(np.abs(v).max()+1e-9)*0.9
sf.write('voice_en.wav', v, SR)
json.dump({'duration': round(t, 3), 'scenes': timeline}, open('timing_en.json', 'w'), ensure_ascii=False, indent=1)
print('TOTAL', round(t, 1))
