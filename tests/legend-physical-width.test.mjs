import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSite} from '../src/web/sample.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {unpresentPatch} from '../src/web/presentation.mjs';
import {printGeometry} from '../src/web/page-options.mjs';
import {unzip} from '../src/web/zip.mjs';
function verify(page){
 const paths=page.items.filter(i=>i.type==='path'&&i.linkType);
 const samples=page.items.filter(i=>i.legendEntry&&i.type==='rect');
 for(const sample of samples){
  const path=paths.find(p=>p.linkType===sample.linkType&&p.color.toUpperCase()===sample.legendSourceColor&&Math.abs(unpresentPatch(p,{weight:p.weight}).weight-sample.legendSourceWeight)<1e-6);
  assert.ok(path,'sample has represented cable');assert.equal(sample.h,path.weight,'same painted thickness after independent paper/panel scaling');
  const unit=page.width/printGeometry(page).width;assert.equal(sample.h/unit,path.weight/unit);
 }
 return samples.length;
}
test('legend strokes equal actual links on dynamic and physical sheets with independent panel sizing',()=>{
 for(const preset of ['dynamic','letter','a4'])for(const scale of [.7,1.8]){
  const project=sampleSite();project.layout={linkStyles:{'SR fiber':{weight:9,color:'#aabbcc'}},presentation:{defaults:{drawingScale:1.3,panel:{scale,textScale:1.4}}},pageSetup:{visible:{default:{preset,locked:true}}}};
  const pages=buildPages(project);assert.ok(pages.reduce((n,p)=>n+verify(p),0)>0);
  assert.equal(JSON.stringify(buildPages(JSON.parse(JSON.stringify(project))).map(p=>p.svg)),JSON.stringify(pages.map(p=>p.svg)));
 }
});
test('multiple individual widths keep separate accurate legend samples and survive saved frame',()=>{
 const project=sampleSite(),first=buildPages(project).find(p=>p.title==='Wireless Connections'),path=first.items.find(i=>i.type==='path');
 project.layout={drawingEdits:{[path.editKey]:{weight:11}},pageSetup:{visible:{default:{preset:'letter',locked:true}}}};
 const pages=buildPages(project);for(const p of pages)verify(p);
 const wireless=pages.find(p=>p.title==='Wireless Connections');assert.ok(wireless.items.some(i=>i.legendSourceWeight===11));
 project.layout.pageSetup.visible.lockFrames=Object.fromEntries(pages.filter(p=>p.pageLockFrame).map(p=>[p.name,p.pageLockFrame]));for(const p of buildPages(project))verify(p);
});
test('Visio receives matching scene thickness, not the readable panel transform',async()=>{
 const project=sampleSite();project.layout={pageSetup:{visible:{default:{preset:'letter'}}}};const pages=buildPages(project);for(const page of pages)verify(page);
 const files=await unzip(await exportVisio(project,pages).arrayBuffer());const xml=[...files].filter(([k])=>/pages\/page\d+\.xml$/.test(k)).map(([,v])=>new TextDecoder().decode(v)).join('');
 assert.match(xml,/N="LineWeight"[^>]*F="Sheet\.\d+!LineWeight"/,'connectors inherit the matching legend sample style in Visio');
});
