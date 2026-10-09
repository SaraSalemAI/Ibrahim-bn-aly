// Render frames [from, to) at FPS into an mp4 chunk. usage: node render.mjs <from> <to> <out.mp4> [fps]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const [from, to, out, fps = 30] = [+process.argv[2], +process.argv[3], process.argv[4], +(process.argv[5] || 30)];
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForFunction('window.ready', null, { timeout: 120000 });
const t0 = Date.now();
for (let f = from; f < to; f++) {
  await p.evaluate(([t, f]) => renderAt(t, f), [f / fps, f]);
  const buf = await p.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if ((f - from) % 300 === 0) console.log(out, f, 'of', to, ((Date.now() - t0) / 1000 / Math.max(1, f - from)).toFixed(2), 's/frame');
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
console.log('done', out);
