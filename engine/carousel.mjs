// node carousel.mjs spec.json outDir   -> outDir/slide_01.jpg ... (1080x1350, Instagram 4:5)
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dir = path.dirname(fileURLToPath(import.meta.url));
const [specPath, outDir] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await pg.goto('file://' + path.join(__dir, 'carousel.html'));
await pg.evaluate(() => document.fonts.ready);
for (let i = 0; i < spec.slides.length; i++) {
  await pg.evaluate(([s, i]) => window.renderSlide(s, i), [spec, i]);
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: path.join(outDir, `slide_${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 93,
    clip: { x: 0, y: 0, width: 1080, height: 1350 } });
}
await b.close();
console.log('slides:', spec.slides.length);
