# Claude Skills — The Complete Visual Guide

**Prepared by Sara Salem**

A 7-minute 13-second professional motion-graphics video (1920×1080, 30 fps) explaining Claude Skills in detail,
with 3D animation, an **American English voice-over**, an original soundtrack, and Sara Salem's photo in the closing scene.

▶ **Video:** [`claude-skills-by-sara-salem.mp4`](claude-skills-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction |
| 01 | 0:15 | What are Skills? |
| 02 | 0:50 | Anatomy of SKILL.md |
| 03 | 1:30 | Progressive Disclosure |
| 04 | 2:10 | How Claude Uses a Skill |
| 05 | 2:42 | Why Skills Matter |
| 06 | 3:15 | Ready-made Skills |
| 07 | 3:57 | Where Skills Work |
| 08 | 4:28 | Skills vs. Other Tools |
| 09 | 5:04 | Create Your Own Skill |
| 10 | 5:37 | Use Cases |
| 11 | 6:12 | Best Practices |
| 12 | 6:48 | Recap |
| 13 | 7:01 | Thank You |

The full narration script is in [`narration.json`](narration.json).

## How it is made
- `narration.json` — the voice-over script, split into cues (one per on-screen beat).
- `tts.py` — generates the American English narration with Kokoro TTS (voice `af_heart`) and writes `timing.json`, so each scene lasts exactly as long as its narration.
- `src.html` + `base.css` → `build.py` → `index.html` — every scene, driven by a single deterministic `render(t)`; animations are triggered by the narration cues.
- `render.mjs` — Playwright steps through time frame by frame and pipes frames into ffmpeg (can render frame ranges in parallel).
- `music.py` — synthesises the background music, timed to the scene changes.

```bash
python3 tts.py kokoro-v1.0.onnx voices-v1.0.bin   # voice.wav + timing.json
python3 build.py && python3 music.py
node render.mjs silent.mp4 30
ffmpeg -i silent.mp4 -i voice.wav -i soundtrack.wav -filter_complex "[2:a]volume=0.18[m];[1:a][m]amix=inputs=2:duration=first:normalize=0[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k claude-skills-by-sara-salem.mp4
```
