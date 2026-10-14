# Claude Automations — The Complete Visual Guide (Build It Step by Step)

**Prepared by Sara Salem**

A 8-minute 42-second professional motion-graphics video (1920×1080, 30 fps) on automating work with Claude —
scheduled tasks, routines, hooks, GitHub Actions, headless mode and the API — with 8 build steps, 3D animation,
animated graphs, an **American English voice-over**, background music, and Sara Salem's photo in the closing scene.

▶ **Video:** [`claude-automations-by-sara-salem.mp4`](claude-automations-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction |
| 01 | 0:19 | Manual vs. Automated |
| 02 | 0:51 | What is a Claude Automation? |
| 03 | 1:20 | How an Automation Runs |
| 04 | 1:49 | Where Automations Run |
| 05 | 2:42 | Step 1 · Pick the Right Task |
| 06 | 3:11 | Step 2 · Choose the Trigger |
| 07 | 3:41 | Step 3 · Write the Instructions |
| 08 | 4:10 | Step 4 · Connect Your Tools |
| 09 | 4:40 | Step 5 · Choose Where It Runs |
| 10 | 5:09 | Step 6 · Build: GitHub Actions |
| 11 | 5:38 | Step 6 · Build: Hooks |
| 12 | 6:08 | Step 6 · Build: Headless Mode |
| 13 | 6:38 | Step 7 · Guardrails |
| 14 | 7:13 | Step 8 · Test & Monitor |
| 15 | 7:42 | Best Practices |
| 16 | 8:17 | Recap |
| 17 | 8:31 | Thank You |

The full narration script is in [`narration.json`](narration.json). Chart values are illustrative, not measured results;
code samples are simplified examples.

## How it is made
Same pipeline as the other videos: `narration.json` → `tts.py` (Kokoro TTS, voice `af_heart`) → `timing.json`;
`src.html` + `base.css` + `extra.css` → `build.py` → `index.html`; `render.mjs` (Playwright → ffmpeg); `music.py`.
