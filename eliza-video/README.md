# ELIZA — The Machine That Listened

A ~10-minute 3D motion-graphics documentary (American English narration) about ELIZA, the ELIZA effect, and the future of conversational AI. Prepared by Sara Salem.

- `script.json`: full narration script (scenes, speakers, pronunciation hints)
- `subtitles_ar.json`: Arabic translation of every line
- `tools/make_voice.py`: Kokoro neural TTS narration + master timeline
- `tools/typing.py`: terminal typing events (visuals + keyboard SFX)
- `tools/make_audio.py`: procedural score, SFX and ducking mix
- `tools/make_subs.py`: English/Arabic SRT + chapter metadata
- `render/`: Three.js deterministic renderer (`index.html`, `main.js`) and frame capture (`render.mjs`)
