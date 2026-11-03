// node preview.mjs spec.json outDir [times=0.15,0.4,0.9,1.8] [D=2.6]  -> grid per scene (one column per time)
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dir=path.dirname(fileURLToPath(import.meta.url));
const [specPath,outDir,tArg,dArg]=process.argv.slice(2); const spec=JSON.parse(fs.readFileSync(specPath,'utf8'));
const TS=(tArg||'0.15,0.4,0.9,1.8').split(',').map(Number); const D=parseFloat(dArg||'2.6');
fs.mkdirSync(outDir,{recursive:true});
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1080,height:1920}});
pg.on('pageerror',e=>console.error('PAGE ERROR',e.message)); pg.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text())});
await pg.goto('file://'+path.join(__dir,'scenes.html')); await pg.evaluate(()=>document.fonts.ready);
await pg.evaluate(([s])=>window.loadSpec(s,40),[spec]);
for(let i=0;i<spec.scenes.length;i++){ for(const [j,t] of TS.entries()){
  await pg.evaluate(([i,D])=>window.buildScene(i,i*2.6,D),[i,D]);
  // step through frames up to t so stateful bits behave like the real render
  for(let f=0;f<=Math.round(t*30);f+=3) await pg.evaluate(([t,D])=>window.frame(t,D),[f/30,D]);
  await pg.evaluate(([t,D])=>window.frame(t,D),[t,D]);
  await pg.screenshot({path:path.join(outDir,`p_${String(i).padStart(2,'0')}_${j}.jpg`),type:'jpeg',quality:80});}}
await b.close();
