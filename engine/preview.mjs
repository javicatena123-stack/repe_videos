// node preview.mjs spec.json out.jpg [t=1.6]  -> contact sheet-ish: one screenshot per scene at time t
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright'); import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dir=path.dirname(fileURLToPath(import.meta.url));
const [specPath,outDir,tArg]=process.argv.slice(2); const spec=JSON.parse(fs.readFileSync(specPath,'utf8')); const T=parseFloat(tArg||'1.6');
fs.mkdirSync(outDir,{recursive:true});
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1080,height:1920}});
await pg.goto('file://'+path.join(__dir,'scenes.html')); await pg.evaluate(()=>document.fonts.ready);
await pg.evaluate(([s])=>window.loadSpec(s,40),[spec]);
for(let i=0;i<spec.scenes.length;i++){await pg.evaluate(([i])=>window.buildScene(i,i*2.6),[i]); await pg.evaluate(([t])=>window.frame(t,2.6),[T]);
 await pg.screenshot({path:path.join(outDir,`p_${String(i).padStart(2,'0')}.jpg`),type:'jpeg',quality:85});}
await b.close();
