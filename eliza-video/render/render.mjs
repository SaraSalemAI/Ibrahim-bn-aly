// Resumable renderer: worker w of W renders 10-second segments seg % W == w into seg_XXXX.mp4 (skips finished ones).
// usage: node render.mjs <w> <W> <outDir> [fps]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
const [w, W, dir, fps] = [+process.argv[2], +process.argv[3], process.argv[4], +(process.argv[5] || 24)];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForFunction('window.ready', null, { timeout: 120000 });
const total = Math.ceil(await p.evaluate(() => TL.duration) * fps), SEG = fps * 10;
for (let s = w; s * SEG < total; s += W) {
  const out = `${dir}/seg_${String(s).padStart(4, '0')}.mp4`;
  if (existsSync(out)) continue;
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '15', '-pix_fmt', 'yuv420p', '-f', 'mp4', out + '.tmp'], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = s * SEG; f < Math.min(total, (s + 1) * SEG); f++) {
    await p.evaluate(([t, f]) => renderAt(t, f), [f / fps, f]);
    const buf = await p.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  renameSync(out + '.tmp', out);
  console.log('seg', s, 'of', Math.ceil(total / SEG), ((Date.now() - t0) / 1000 / SEG).toFixed(2), 's/frame');
}
await b.close(); console.log('worker done', w);
