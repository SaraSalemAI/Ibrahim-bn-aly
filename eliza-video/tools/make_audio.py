"""Procedural soundtrack: ambient score + SFX (whooshes, impacts, typing, UI blips), ducked under the voice.

usage: python3 make_audio.py <build_dir>   (reads timeline.json + voice.wav, writes mix.wav)
"""
import json, sys
import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt, resample_poly

B = sys.argv[1]
SR = 48000
tl = json.load(open(B + "/timeline.json"))
D = tl["duration"]
N = int((D + 1) * SR)
rng = np.random.default_rng(7)
T = np.arange(N) / SR


def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], "band", fs=SR, output="sos"), x)
def note(m): return 440 * 2 ** ((m - 69) / 12)


# ---------------- score ----------------
# A minor family progression, 8 s per chord: Am - Fmaj7 - C - G(add6) / Dm9 colour in the future section
CH = [[57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]]
CHORD_LEN = 8.0
music = np.zeros(N)
scene_at = lambda t: next((s for s in tl["scenes"] if s["start"] <= t < s["end"]), tl["scenes"][-1])

# intensity curve per scene (pads / arp / pulse)
INT = {"cold_open": (.55, 0, 0), "title": (1, .6, .8), "man": (.8, .3, 0), "birth": (.8, .5, .3), "doctor": (.75, .35, 0),
       "how": (.8, .7, .5), "secretary": (.65, 0, 0), "effect": (.85, .4, .3), "psych": (.8, .55, .3), "rebellion": (.75, .2, .2),
       "children": (.85, .7, .6), "today": (.8, .6, .5), "rediscovery": (.75, .5, .2), "future": (1, .9, .8),
       "closing": (.9, .3, 0), "outro": (1, .5, 0)}
env_pad, env_arp, env_pulse = np.zeros(N), np.zeros(N), np.zeros(N)
for s in tl["scenes"]:
    a, b = int(s["start"] * SR), int(s["end"] * SR)
    p, ar, pu = INT.get(s["id"], (.8, .4, .2))
    env_pad[a:b], env_arp[a:b], env_pulse[a:b] = p, ar, pu
k = int(1.5 * SR)
sm = np.ones(k) / k
env_pad, env_arp, env_pulse = (np.convolve(e, sm, "same") for e in (env_pad, env_arp, env_pulse))

pad = np.zeros(N)
nch = int(np.ceil(D / CHORD_LEN)) + 1
for ci in range(nch):
    t0 = ci * CHORD_LEN
    a = int(t0 * SR); b = min(N, int((t0 + CHORD_LEN + 2.5) * SR))
    if a >= N: break
    tt = np.arange(b - a) / SR
    env = np.minimum(1, tt / 2.0) * np.minimum(1, np.maximum(0, (CHORD_LEN + 2.5 - tt) / 2.5))
    chord = CH[ci % 4]
    seg = np.zeros(b - a)
    for m in chord:
        for det in (-.07, .0, .07):
            f = note(m + det)
            ph = rng.uniform(0, 6.28)
            seg += (np.sin(2 * np.pi * f * tt + ph) + .25 * np.sin(4 * np.pi * f * tt + ph) + .1 * np.sin(6 * np.pi * f * tt)) / 9
    bass = .5 * np.sin(2 * np.pi * note(chord[0] - 12) * tt) + .2 * np.sin(2 * np.pi * note(chord[0] - 24) * tt)
    pad[a:b] += (seg + bass) * env
pad = lp(pad, 2200) * (1 + .15 * np.sin(2 * np.pi * .07 * T))

# arpeggio plucks (16th notes at 100 bpm)
arp = np.zeros(N)
step = 60 / 100 / 4
pl = int(.45 * SR); pt = np.arange(pl) / SR
for i in range(int(D / step)):
    t0 = i * step
    a = int(t0 * SR)
    if a + pl >= N: break
    if env_arp[a] < .05: continue
    chord = CH[int(t0 // CHORD_LEN) % 4]
    m = chord[[0, 1, 2, 3, 2, 1, 3, 2][i % 8]] + 12
    f = note(m)
    v = (np.sin(2 * np.pi * f * pt) + .3 * np.sin(4 * np.pi * f * pt)) * np.exp(-pt * 9) * (1 if i % 4 == 0 else .6)
    arp[a:a + pl] += v * env_arp[a]
arp = lp(arp, 4000)

# soft pulse / heartbeat kick on beats
pulse = np.zeros(N)
kl = int(.35 * SR); kt = np.arange(kl) / SR
kick = np.sin(2 * np.pi * (45 + 60 * np.exp(-kt * 25)) * kt) * np.exp(-kt * 9)
for i in range(int(D / (step * 4))):
    a = int(i * step * 4 * SR)
    if a + kl >= N: break
    if env_pulse[a] > .05: pulse[a:a + kl] += kick * env_pulse[a]

# shimmer noise bed
air = hp(lp(rng.standard_normal(N), 9000), 3000) * .02

music = pad * .55 * env_pad + arp * .16 + pulse * .35 + air * env_pad

# reverb (synthetic impulse response)
irl = int(3.2 * SR)
it = np.arange(irl) / SR
ir = rng.standard_normal(irl) * np.exp(-it * 2.2)
ir = lp(ir, 6000); ir /= np.abs(ir).sum() ** .5 * 3
wet = fftconvolve(music, ir)[:N]
music = music * .65 + wet * .5

# ---------------- SFX ----------------
sfx = np.zeros(N)


def add(x, t, g=1.0):
    a = int(t * SR)
    if a < 0 or a >= N: return
    b = min(N, a + len(x)); sfx[a:b] += x[:b - a] * g


def whoosh(d=1.1):
    n = int(d * SR); tt = np.arange(n) / SR
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    # sweep a bandpass upwards by processing chunks
    ch = 1024
    for i in range(0, n, ch):
        fc = 300 + 4000 * (i / n) ** 1.5
        out[i:i + ch] = bp(noise[i:i + ch + 0], fc * .7, min(fc * 1.4, 20000))
    env = np.sin(np.pi * tt / d) ** 2
    return lp(out, 7000) * env * .9


def impact():
    n = int(2.6 * SR); tt = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (38 + 70 * np.exp(-tt * 6)) * tt) * np.exp(-tt * 2.2)
    crack = lp(rng.standard_normal(n), 3000) * np.exp(-tt * 14) * .6
    return boom + crack


def click():
    n = int(.03 * SR); tt = np.arange(n) / SR
    return bp(rng.standard_normal(n), 1800, 6000) * np.exp(-tt * 260)


def blip(f=1320):
    n = int(.18 * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + .4 * np.sin(2 * np.pi * f * 1.5 * tt)) * np.exp(-tt * 28)


def riser(d=2.0):
    n = int(d * SR); tt = np.arange(n) / SR
    return hp(rng.standard_normal(n), 2000) * (tt / d) ** 3 * .5


for s in tl["scenes"]:
    if s["start"] > 0:
        add(whoosh(), s["start"] - .55, .22)
    if s["id"] == "title":
        add(riser(1.6), s["start"] - .7, .25)
        add(impact(), s["start"] + .95, .6)
    if s["id"] not in ("cold_open", "title", "outro", "closing"):
        for ln in s["lines"]:
            if ln["s"] == "N":
                add(blip(1500 if s["id"] in ("how", "future") else 1180), ln["start"] - .25, .05)
    for e in s.get("screen", []):
        n = len(e["text"])
        for i in range(n):
            if e["text"][i] == " " and e["k"] == "U": continue
            t = s["start"] + e["t0"] + (e["t1"] - e["t0"]) * i / max(1, n)
            add(click(), t + rng.uniform(-.008, .008), (.16 if e["k"] == "U" else .07) * rng.uniform(.7, 1.1))
outro = tl["scenes"][-1]
add(impact() * .5, outro["start"] + .4, .35)

# ---------------- voice + ducking ----------------
v, vsr = sf.read(B + "/voice.wav")
v = resample_poly(v, SR, vsr)[:N]
voice = np.zeros(N); voice[:len(v)] = v
lvl = np.sqrt(np.convolve(voice ** 2, np.ones(int(.05 * SR)) / int(.05 * SR), "same"))
act = (lvl > .01).astype(float)
att = int(.4 * SR)
act = np.convolve(act, np.ones(att) / att, "same")
duck = 1 - .55 * np.clip(act * 1.5, 0, 1)
music *= .5 * duck / max(1e-9, np.abs(music).max())

voice = hp(voice, 70)
mix = voice * .95 + music + sfx * .8
fade = np.clip((D - T) / 1.5, 0, 1); fade[:int(.3 * SR)] *= np.linspace(0, 1, int(.3 * SR))
mix *= fade
mix /= max(1.0, np.abs(mix).max() / .95)
sf.write(B + "/mix.wav", np.stack([mix, mix], 1).astype(np.float32), SR)
print("mix ok", round(len(mix) / SR, 1), "s")
