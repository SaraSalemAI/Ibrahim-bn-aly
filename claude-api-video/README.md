# The Claude API — The Complete Visual Guide (Build It Step by Step)

**Prepared by Sara Salem**

A 9-minute 5-second professional motion-graphics video (1920×1080, 30 fps) explaining the Claude API and how to
build with it in 9 steps — with 3D animation, an animated pricing chart, real Python code, an **American English voice-over**,
background music, and Sara Salem's photo in the closing scene.

▶ **Video:** [`claude-api-by-sara-salem.mp4`](claude-api-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction |
| 01 | 0:20 | What is the Claude API? |
| 02 | 0:55 | How a Request Works |
| 03 | 1:29 | Choosing a Model |
| 04 | 2:08 | Tokens & Context |
| 05 | 2:42 | Step 1 · Get Your API Key |
| 06 | 3:12 | Step 2 · Install an SDK |
| 07 | 3:38 | Step 3 · Your First Request |
| 08 | 4:09 | Step 4 · Understand the Response |
| 09 | 4:37 | Step 5 · Conversations |
| 10 | 5:14 | Step 6 · Streaming |
| 11 | 5:42 | Step 7 · Tool Use |
| 12 | 6:19 | Step 7 · Tool Use in Code |
| 13 | 6:44 | Step 8 · Power Features |
| 14 | 7:31 | Step 9 · Production Ready |
| 15 | 8:02 | Best Practices |
| 16 | 8:37 | Recap |
| 17 | 8:52 | Thank You |

The full narration script is in [`narration.json`](narration.json). Code samples use the official `anthropic` Python SDK with
`claude-opus-5-5`. Prices in the chart are Anthropic list prices as of October 2026 — always check the current pricing page.

## How it is made
Same pipeline as the other videos: `narration.json` → `tts.py` (Kokoro TTS, voice `af_heart`) → `timing.json`;
`src.html` + `base.css` + `extra.css` → `build.py` → `index.html`; `render.mjs` (Playwright → ffmpeg); `music.py`.
