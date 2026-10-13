# The Perfect Prompt — How to Write Great Prompts for Claude, Step by Step

**Prepared by Sara Salem**

A 8-minute 43-second professional motion-graphics video (1920×1080, 30 fps) on prompt engineering for Claude —
8 build steps with 3D animation, animated graphs, an **American English voice-over**, background music, and
Sara Salem's photo in the closing scene.

▶ **Video:** [`claude-perfect-prompt-by-sara-salem.mp4`](claude-perfect-prompt-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction |
| 01 | 0:20 | Weak vs. Great Prompts |
| 02 | 0:57 | Ingredients of a Great Prompt |
| 03 | 1:36 | The Prompting Cycle |
| 04 | 2:00 | Step 1 · Define Success |
| 05 | 2:31 | Step 2 · Be Clear & Specific |
| 06 | 3:02 | Step 3 · Give Claude a Role |
| 07 | 3:33 | Step 4 · Structure with XML Tags |
| 08 | 4:10 | Step 5 · Show Examples |
| 09 | 4:43 | Step 6 · Let Claude Think |
| 10 | 5:25 | Step 7 · Chain Complex Tasks |
| 11 | 5:53 | Step 8 · Test & Iterate |
| 12 | 6:23 | Putting It All Together |
| 13 | 6:52 | Claude Console Prompt Tools |
| 14 | 7:23 | Common Mistakes |
| 15 | 7:55 | Prompt Templates to Build |
| 16 | 8:15 | Recap |
| 17 | 8:31 | Thank You |

The full narration script is in [`narration.json`](narration.json). Chart values are illustrative, not benchmark results.

## How it is made
Same pipeline as the other videos: `narration.json` → `tts.py` (Kokoro TTS, voice `af_heart`) → `timing.json`;
`src.html` + `base.css` + `extra.css` → `build.py` → `index.html`; `render.mjs` (Playwright → ffmpeg); `music.py`.
