# Claude Academy — The Complete Visual Guide (All Course Types & Build Your Path Step by Step)

**Prepared by Sara Salem**

A 7-minute 58-second professional motion-graphics video (1920×1080, 30 fps) on Anthropic Academy
(anthropic.skilljar.com) — what it is, how learning works, all the types of courses (everyday work, AI Fluency,
Claude Code, the Claude API, MCP, cloud platforms), the building blocks of a course, and 9 steps to build your own
learning path — with 3D animation, animated graphs, an **American English voice-over**, background music, and
Sara Salem's photo in the closing scene.

▶ **Video:** [`claude-academy-by-sara-salem.mp4`](claude-academy-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction |
| 01 | 0:20 | Learning Alone vs. the Academy |
| 02 | 0:51 | What is Claude Academy? |
| 03 | 1:23 | How Learning Works |
| 04 | 1:49 | All Types of Courses |
| 05 | 2:48 | 4 Building Blocks of a Course |
| 06 | 3:13 | Step 1 · Sign Up |
| 07 | 3:36 | Step 2 · Write Your Learning Plan |
| 08 | 4:02 | Step 3 · Choose Your Level |
| 09 | 4:35 | Step 4 · Follow the Course |
| 10 | 5:01 | Step 5 · Track Your Progress |
| 11 | 5:28 | Step 6 · Practice with Claude |
| 12 | 5:50 | Step 7 · Earn Your Certificate |
| 13 | 6:13 | Step 8 · Go Deeper |
| 14 | 6:42 | Step 9 · Keep Learning |
| 15 | 7:03 | Best Practices |
| 16 | 7:32 | Recap |
| 17 | 7:48 | Thank You |

The full narration script is in [`narration.json`](narration.json). Chart values are illustrative, not measured results;
the learning plan and course screens are simplified examples. Course names follow the Anthropic Academy catalog at the
time of writing — check anthropic.skilljar.com for the current list.

## How it is made
Same pipeline as the other videos: `narration.json` → `tts.py` (Kokoro TTS, voice `af_heart`) → `timing.json`;
`src.html` + `base.css` + `extra.css` → `build.py` → `index.html`; `render.mjs` (Playwright → ffmpeg); `music.py`.
