// Usage: node render.mjs spec.json tiempos.json outDir [onlySceneIdx,...]
// Renders one mp4 per scene (1080x1920, 30 fps) by stepping the deterministic scene animation.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const [specPath, timesPath, outDir, only] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const times = JSON.parse(fs.readFileSync(timesPath, 'utf8'));
const FPS = 30;
fs.mkdirSync(outDir, { recursive: true });

// scene boundaries in frames (from cumulative times -> no drift)
const starts = times.scenes.map(s => s.start);
const total = times.total;
const fb = starts.map(s => Math.round(s * FPS));
fb.push(Math.round(total * FPS));
const onlySet = only ? new Set(only.split(',').map(Number)) : null;

async function renderScene(page, i) {
  const n = fb[i + 1] - fb[i];
  const D = n / FPS;
  const out = path.join(outDir, `scene_${String(i).padStart(2, '0')}.mp4`);
  const tmp = out.replace(/\.mp4$/, '.tmp.mp4');
  await page.evaluate(([i, st]) => window.buildScene(i, st), [i, fb[i] / FPS]);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp]);
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  for (let f = 0; f < n; f++) {
    await page.evaluate(([t, D]) => window.frame(t, D), [f / FPS, D]);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  fs.renameSync(tmp, out);
  return out;
}

const browser = await chromium.launch();
const idx = spec.scenes.map((_, i) => i).filter(i => !onlySet || onlySet.has(i));
const CONC = Math.min(4, idx.length);
let next = 0;
async function worker() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dir, 'scenes.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(([s, t]) => window.loadSpec(s, t), [spec, total]);
  while (next < idx.length) {
    const i = idx[next++];
    await renderScene(page, i);
    process.stdout.write(`scene ${i} ok\n`);
  }
  await page.close();
}
await Promise.all(Array.from({ length: CONC }, worker));
await browser.close();
fs.writeFileSync(path.join(outDir, 'list.txt'), spec.scenes.map((_, i) => `file 'scene_${String(i).padStart(2, '0')}.mp4'`).join('\n') + '\n');
