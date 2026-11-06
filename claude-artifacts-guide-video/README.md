# Claude Artifacts — The Complete Visual Guide (All Types · Build It Step by Step)

**Prepared by Sara Salem**

A 8-minute 50-second professional motion-graphics video (1920×1080, 30 fps) covering all six Claude artifact types
and how to build one in 9 steps — with 3D animation, graphs, code walkthroughs, an **American English voice-over**,
background music, and Sara Salem's photo in the closing scene. (A longer, narrated follow-up to `claude-artifacts-video/`.)

▶ **Video:** [`claude-artifacts-guide-by-sara-salem.mp4`](claude-artifacts-guide-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction |
| 01 | 0:19 | Chat Answer vs. Artifact |
| 02 | 0:54 | What is an Artifact? |
| 03 | 1:21 | How an Artifact Comes to Life |
| 04 | 1:42 | All Artifact Types |
| 05 | 2:36 | Type Deep Dive: Mermaid Diagram |
| 06 | 3:08 | Step 1 · Plan Before You Prompt |
| 07 | 3:41 | Step 2 · Write a Clear Prompt |
| 08 | 4:13 | Step 3 · Claude Generates It |
| 09 | 4:44 | Step 4 · Preview & Test |
| 10 | 5:10 | Step 5 · Iterate |
| 11 | 5:38 | Step 6 · Editing & Versions |
| 12 | 6:10 | Step 7 · Fix Errors Fast |
| 13 | 6:37 | Step 8 · Advanced Features |
| 14 | 7:12 | Step 9 · Publish & Share |
| 15 | 7:37 | What You Can Build |
| 16 | 7:57 | Best Practices |
| 17 | 8:25 | Recap |
| 18 | 8:38 | Thank You |

The full narration script is in [`narration.json`](narration.json). The budget chart shows the example app's sample data.

## How it is made
Same pipeline as the other videos: `narration.json` → `tts.py` (Kokoro TTS, voice `af_heart`) → `timing.json`;
`src.html` + `base.css` + `extra.css` → `build.py` → `index.html`; `render.mjs` (Playwright → ffmpeg); `music.py`.
