# Claude & MCP — The Complete Visual Guide (Focus on Finance)

**Prepared by Sara Salem**

A 9-minute 56-second professional motion-graphics video (1920×1080, 30 fps) explaining the Model Context Protocol (MCP)
and how Claude uses it in finance — with 3D animation, an **American English voice-over**, background music,
and Sara Salem's photo in the closing scene.

▶ **Video:** [`claude-mcp-finance-by-sara-salem.mp4`](claude-mcp-finance-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction |
| 01 | 0:23 | The Integration Problem |
| 02 | 1:06 | What is MCP? |
| 03 | 1:50 | Architecture |
| 04 | 2:38 | Core Primitives |
| 05 | 3:19 | A Tool Call, Step by Step |
| 06 | 3:56 | Connecting MCP to Claude |
| 07 | 4:34 | Why Finance Needs MCP |
| 08 | 5:09 | Financial Data Connectors |
| 09 | 6:03 | Example: Comps Analysis |
| 10 | 6:45 | Finance Use Cases |
| 11 | 7:27 | Security & Governance |
| 12 | 8:09 | Build Your Own Server |
| 13 | 8:46 | Best Practices |
| 14 | 9:28 | Recap |
| 15 | 9:44 | Thank You |

The full narration script is in [`narration.json`](narration.json).

> Provider names (S&P Global, FactSet, LSEG, PitchBook, Morningstar, Moody's, Daloopa, Snowflake, Databricks, Box) are shown as examples of
> connector categories; availability depends on the Claude plan and on each provider subscription. Ticker `ACME` and its figures are fictional.

## How it is made
Same pipeline as `claude-skills-video/`: `narration.json` → `tts.py` (Kokoro TTS, voice `af_heart`) → `timing.json`;
`src.html` + `base.css` + `extra.css` → `build.py` → `index.html`; `render.mjs` (Playwright → ffmpeg); `music.py`.
