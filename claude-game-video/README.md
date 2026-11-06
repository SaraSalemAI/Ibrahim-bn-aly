# Build a Game with Claude — The Complete Visual Guide (All Game Types & Build It Step by Step)

**Prepared by Sara Salem**

A 7-minute 53-second professional motion-graphics video (1920×1080, 30 fps) on building games with Claude — what
Claude does for your game, how the build loop works, all the types of games (puzzle, arcade, platformer, quiz,
strategy & board, 3D), four ways to build (Artifacts, Claude Code, game libraries, the Claude API), and 9 build steps
from the first prompt to sharing a finished game — with 3D animation, animated graphs, an **American English
voice-over**, background music, and Sara Salem's photo in the closing scene.

▶ **Video:** [`claude-game-by-sara-salem.mp4`](claude-game-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction |
| 01 | 0:20 | Alone vs. with Claude |
| 02 | 0:51 | What Claude Does for Your Game |
| 03 | 1:15 | How It Works |
| 04 | 1:39 | All Types of Games |
| 05 | 2:24 | 4 Ways to Build |
| 06 | 2:57 | Step 1 · Start Your Game |
| 07 | 3:21 | Step 2 · Write the Game Design Brief |
| 08 | 3:46 | Step 3 · The Game Loop |
| 09 | 4:13 | Step 4 · Add the Mechanics |
| 10 | 4:40 | Step 5 · Balance the Difficulty |
| 11 | 5:07 | Step 6 · Add Art & Sound |
| 12 | 5:38 | Step 7 · Test & Fix |
| 13 | 6:03 | Step 8 · Polish Your Game |
| 14 | 6:28 | Step 9 · Share Your Game |
| 15 | 6:54 | Best Practices |
| 16 | 7:26 | Recap |
| 17 | 7:42 | Thank You |

The full narration script is in [`narration.json`](narration.json). Chart values are illustrative, not measured results;
the prompt, design brief and chat screens are simplified examples.

## How it is made
Same pipeline as the other videos: `narration.json` → `tts.py` (Kokoro TTS, voice `af_heart`) → `timing.json`;
`src.html` + `base.css` + `extra.css` → `build.py` → `index.html`; `render.mjs` (Playwright → ffmpeg); `music.py`.
