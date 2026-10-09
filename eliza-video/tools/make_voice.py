"""Generate narration with Kokoro TTS and build the master timeline.

usage: python3 make_voice.py <script.json> <kokoro_dir> <out_dir>
"""
import json, sys, subprocess, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

script_path, kdir, out = sys.argv[1:4]
os.makedirs(out + "/lines", exist_ok=True)
SR = 24000
VOICES = {"N": ("af_heart", 0.96), "U": ("af_bella", 0.95), "E": ("am_michael", 0.88)}
LEAD = {"cold_open": 2.2, "title": 2.6, "outro": 1.6}
TAIL = {"title": 2.6, "outro": 6.5, "closing": 2.0}
GAP = {"N": 0.42, "U": 0.75, "E": 0.85}

k = Kokoro(kdir + "/kokoro-v1.0.onnx", kdir + "/voices-v1.0.bin")
script = json.load(open(script_path))


def robot(path):
    """Give ELIZA a subtle vintage-terminal timbre."""
    tmp = path.replace(".wav", "_fx.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-af",
                    "highpass=f=180,lowpass=f=5200,flanger=delay=2:depth=1.5:speed=0.4,"
                    "aecho=0.8:0.6:38:0.25,volume=1.1", "-ar", str(SR), tmp], check=True)
    os.replace(tmp, path)


timeline, track, t = [], [], 0.0
for sc in script["scenes"]:
    start = t
    t += LEAD.get(sc["id"], 0.9)
    lines = []
    for i, ln in enumerate(sc["lines"]):
        voice, speed = VOICES[ln["s"]]
        p = f"{out}/lines/{sc['id']}_{i:02d}.wav"
        if not os.path.exists(p):
            audio, sr = k.create(ln.get("say", ln["t"]), voice=voice, speed=speed, lang="en-us")
            sf.write(p, audio, sr)
            if ln["s"] == "E":
                robot(p)
        a, _ = sf.read(p)
        # trim leading/trailing silence
        nz = np.where(np.abs(a) > 0.01)[0]
        a = a[max(nz[0] - 600, 0): nz[-1] + 1200]
        d = len(a) / SR
        lines.append({"s": ln["s"], "t": ln["t"], "start": round(t, 3), "end": round(t + d, 3)})
        track.append((t, a))
        t += d + GAP[ln["s"]]
    t += TAIL.get(sc["id"], 0.9) - GAP[sc["lines"][-1]["s"]]
    timeline.append({k2: sc[k2] for k2 in ("id", "visual", "chapter")} |
                    {"start": round(start, 3), "end": round(t, 3), "lines": lines})

total = t
buf = np.zeros(int(total * SR) + SR)
for st, a in track:
    i = int(st * SR)
    buf[i:i + len(a)] += a
sf.write(out + "/voice.wav", buf, SR)
json.dump({"title": script["title"], "subtitle": script["subtitle"], "author": script["author"],
           "duration": round(total, 3), "scenes": timeline}, open(out + "/timeline.json", "w"), indent=1)
print("total", round(total, 1), "s")
for s in timeline:
    print(f"{s['id']:12s} {s['start']:7.1f} {s['end']:7.1f}")
