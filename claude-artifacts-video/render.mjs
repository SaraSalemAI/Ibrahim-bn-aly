// Renders index.html frame-by-frame with Playwright and pipes JPEG frames to ffmpeg.
// Usage: node render.mjs [out.mp4] [fps]   |   node render.mjs --stills t1,t2,... outdir
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const dir = path.dirname(new URL(import.meta.url).pathname);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(dir, 'index.html'));
await page.evaluate(() => document.fonts.ready);
if (process.argv[2] === '--stills') {
  const times = process.argv[3].split(',').map(Number), out = process.argv[4];
  fs.mkdirSync(out, { recursive: true });
  for (const t of times) { await page.evaluate(t => render(t), t); await page.screenshot({ path: `${out}/t${t}.jpg`, type: 'jpeg', quality: 85 }); }
} else {
  const outFile = process.argv[2] || 'video-silent.mp4', fps = +(process.argv[3] || 30);
  const total = await page.evaluate(() => window.TOTAL);
  const frames = Math.round(total * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => render(t), f / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close();
