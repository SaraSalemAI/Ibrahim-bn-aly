# Claude Code — The Complete Visual Guide (All Types & Build It Step by Step)

**Prepared by Sara Salem**

A 8-minute 20-second professional motion-graphics video (1920×1080, 30 fps) on Claude Code — what it is, how the
agent loop works, all the ways to use it (terminal, IDE, desktop, web & mobile, Slack, GitHub Actions), its core
concepts, and 9 build steps from installation to a finished pull request — with 3D animation, animated graphs, an
**American English voice-over**, background music, and Sara Salem's photo in the closing scene.

▶ **Video:** [`claude-code-by-sara-salem.mp4`](claude-code-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction |
| 01 | 0:19 | Chat Assistant vs. Coding Agent |
| 02 | 0:51 | What is Claude Code? |
| 03 | 1:18 | How Claude Code Works |
| 04 | 1:41 | All the Ways to Use It |
| 05 | 2:27 | 4 Core Concepts |
| 06 | 2:58 | Step 1 · Install & Start |
| 07 | 3:22 | Step 2 · Project Memory (CLAUDE.md) |
| 08 | 3:52 | Step 3 · Plan First |
| 09 | 4:23 | Step 4 · Build the Feature |
| 10 | 4:53 | Step 5 · Test & Fix |
| 11 | 5:22 | Step 6 · Review the Changes |
| 12 | 5:48 | Step 7 · Commit & Pull Request |
| 13 | 6:12 | Step 8 · Extend Claude Code |
| 14 | 6:47 | Step 9 · Master Slash Commands |
| 15 | 7:23 | Best Practices |
| 16 | 7:54 | Recap |
| 17 | 8:08 | Thank You |

The full narration script is in [`narration.json`](narration.json). Chart values are illustrative, not measured results;
code samples are simplified examples.

## How it is made
Same pipeline as the other videos: `narration.json` → `tts.py` (Kokoro TTS, voice `af_heart`) → `timing.json`;
`src.html` + `base.css` + `extra.css` → `build.py` → `index.html`; `render.mjs` (Playwright → ffmpeg); `music.py`.
