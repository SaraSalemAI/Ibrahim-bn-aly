# Claude Artifacts — The Complete Visual Guide

**Prepared by Sara Salem**

A 2½-minute professional motion-graphics video (1920×1080, 30 fps) explaining Claude Artifacts in detail,
with 3D animation, an original soundtrack, and Sara Salem's photo in the closing scene.

▶ **Video:** [`claude-artifacts-by-sara-salem.mp4`](claude-artifacts-by-sara-salem.mp4)

## Chapters
| # | Time | Chapter |
|---|------|---------|
| 00 | 0:00 | Introduction — rotating 3D cube & title |
| 01 | 0:09 | What are Artifacts? — live mock of the artifact panel (code → preview → version 2) |
| 02 | 0:22 | 6 Core Artifact Types — 3D carousel (Code, Documents, Web Pages, SVG, Diagrams, React) |
| 03 | 0:36 | How Artifacts Work — Prompt → Generate → Render → Iterate → Share |
| 04 | 0:49 | When Does Claude Create an Artifact? |
| 05 | 1:01 | Built-in Features — preview/code, versions, targeted edits, download, publish, remix |
| 06 | 1:14 | Artifacts that Think — AI-powered apps, storage, MCP connectors |
| 07 | 1:27 | What Can You Build? — 3D tilted grid of use cases |
| 08 | 1:39 | Publish & Share |
| 09 | 1:51 | 6 Pro Tips |
| 10 | 2:03 | Recap — Create · Iterate · Share |
| 11 | 2:12 | Thank You — Prepared by Sara Salem (with photo) |

## How it is made
- `index.html` — every scene, driven by a single deterministic `render(t)` function (CSS 3D transforms + a canvas 3D starfield/wireframe background). Open it with `?t=30` to view any moment.
- `render.mjs` — Playwright steps through time frame-by-frame and pipes frames into ffmpeg.
- `music.py` — synthesises the original soundtrack (`soundtrack.wav`) timed to the scene changes.

```bash
python3 music.py
node render.mjs silent.mp4 30
ffmpeg -i silent.mp4 -i soundtrack.wav -c:v copy -c:a aac -b:a 192k -shortest claude-artifacts-by-sara-salem.mp4
```
