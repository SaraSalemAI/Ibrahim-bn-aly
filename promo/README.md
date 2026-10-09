# AI for Finance — Promo Video

- `AI-for-Finance-Promo.mp4`: the final ad (1920×1080, 30fps, 2:10, with original background music).
- `VOICEOVER_SCRIPT.md`: the timed voiceover script to record over the video.
- `source/`: everything needed to edit and re-render it.

## Re-rendering after an edit
```bash
cd promo/source
npm i playwright            # Chromium has to be available
python3 music.py            # -> music.wav
node snap.js 5 20 60        # preview stills at the given seconds
node render.js              # -> out.mp4
```
Text and timing live in `ad.html` (the timeline is at the bottom of the file).
To preview it live, open `ad.html#play` in a browser.
