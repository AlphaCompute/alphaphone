// node render.mjs [--stills t1,t2,...] [--fps 30] [--out file.mp4]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const D = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const fps = +arg('--fps', 30), stills = arg('--stills'), out = arg('--out', join(D, 'out', 'video-only.mp4'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERROR', e.message));
await page.goto('file://' + join(D, 'index.html'));
await page.evaluate(() => window.__ready);
const total = await page.evaluate(() => window.__total);
if (stills) {
  for (const t of stills.split(',').map(Number)) { await page.evaluate(t => window.__seek(t), t); await page.screenshot({ path: join(D, 'out', `still-${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 80 }); }
} else {
  const n = Math.ceil(total * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    await page.evaluate(t => window.__seek(t), f / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${n} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close();
