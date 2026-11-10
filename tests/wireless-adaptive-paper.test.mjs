import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {wirelessApLab} from './fixtures/wireless-ap-layout.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {printGeometry,cleanPageSetup} from '../src/web/page-options.mjs';
import {unpresentPatch} from '../src/web/presentation.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';
const wireless=p=>buildPages(p).filter(page=>page.wirelessLayout);
function lab({count=32,long=false,preset='letter',orientation='landscape',locked=false}={}){
 const p=wirelessApLab(count,8);p.devices[0].ports.forEach((v,i)=>v.name='7/'+(i+1));p.links.forEach((v,i)=>v.ap='7/'+(i+1));
 if(long)p.devices.filter(d=>d.kind==='ap').forEach((d,i)=>d.name='LAB-AP-FLOOR-'+(i+1));
 p.layout.pageSetup.visible={wirelessFit:'adaptive',default:{preset,orientation,locked}};return p;
}
function check(pages,count){
 assert.deepEqual(pages.flatMap(p=>p.wirelessLayout.links).sort((a,b)=>a-b),Array.from({length:count},(_,i)=>i));
 for(const page of pages){
  assert.equal(page.pageOverflow,false);assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);
  assert.equal(page.wirelessLayout.memberIds.length,8,'keep the complete stack on each continued sheet');
  const captions=page.items.filter(i=>i.wirelessCaption),devices=page.items.filter(i=>i.type==='device'),paths=page.items.filter(i=>i.type==='path'),points=.75*printGeometry(page).width/page.width;
  assert.ok(captions.every(i=>textLayout(i).size*points>=7.95),'measure real rendered caption fonts on the actual paper');
  assert.ok(page.paperReadability.apActualPt>=7.95);assert.ok(page.paperReadability.actualPt<page.paperReadability.apActualPt,'do not claim small socket artwork became8pt');
  for(const [index,text] of captions.entries()){
   assert.ok(!devices.some(d=>intersects(text,d,-1e-6)));assert.ok(!captions.slice(index+1).some(c=>intersects(text,c,-1e-6)));
   assert.ok(!paths.some(path=>pathCrossesText(path,text,0)));
  }
  for(const path of paths){for(const [point,anchor] of [[path.points[0],path.from],[path.points.at(-1),path.to]])for(const [index,key] of ['x','y'].entries())assert.ok(Math.abs(point[index]-anchor[key])<1e-6);}
 }
}
test('adaptive Letter uses multiple side columns for readable32-AP cards on one complete sheet',()=>{
 const p=lab(),saved=JSON.stringify(p),pages=wireless(p);assert.equal(pages.length,1);check(pages,32);assert.equal(pages[0].wirelessLayout.kind,'columns');assert.equal(JSON.stringify(p),saved);
});
test('long AP names continue only when needed and remain legible on Letter and A4',()=>{
 for(const preset of ['letter','a4']){const pages=wireless(lab({long:true,preset}));assert.ok(pages.length>1&&pages.length<=4);check(pages,32);}
});
test('portrait adaptive paper retains every link and readableAP details',()=>{
 const pages=wireless(lab({orientation:'portrait'}));assert.ok(pages.length<=4);check(pages,32);
});
test('saved adaptive side/continuation plans reopen exactly and preserve a subsequent authored move',()=>{
 const p=lab({long:true,locked:true}),pages=wireless(p);check(pages,32);
 p.layout.pageSetup.visible.lockFrames=Object.fromEntries(pages.map(page=>[page.name,page.pageLockFrame]));p.layout.pageSetup=cleanPageSetup(p.layout.pageSetup);
 assert.deepEqual(wireless(JSON.parse(JSON.stringify(p))).map(p=>p.svg),pages.map(p=>p.svg));
 const ap=pages[0].items.find(i=>i.kind==='ap');p.layout.drawingEdits={[ap.editKey]:unpresentPatch(ap,{x:ap.x-1})};const moved=wireless(p);assert.equal(moved.length,pages.length);assert.equal(moved[0].wirelessLayout.planKey,pages[0].wirelessLayout.planKey);assert.deepEqual(wireless(JSON.parse(JSON.stringify(p))).map(p=>p.svg),moved.map(p=>p.svg));
});

test('normal quick Letter selection optimizes APs without finding a separate mode',async()=>{
 const {quickPagePaperLayout}=await import('../src/web/quick-page-paper.mjs');
 const p=lab();p.layout.pageSetup.visible={default:{preset:'dynamic'}};
 const before=wireless(p);p.layout=quickPagePaperLayout(p.layout,before[0],{preset:'letter'});
 assert.equal(p.layout.pageSetup.visible.wirelessFit,'adaptive');const pages=wireless(p);assert.equal(pages.length,1);check(pages,32);
});
test('legacy automatic locked rows migrate, but explicit keep-layout and authored geometry do not',()=>{
 const p=lab({locked:true});Object.assign(p.layout.pageSetup.visible,{wirelessFit:'layout',wirelessFitExplicit:true});
 const old=wireless(p);assert.equal(old.length,1);assert.notEqual(old[0].wirelessLayout.kind,'columns');
 p.layout.pageSetup.visible.lockFrames=Object.fromEntries(old.map(page=>[page.name,page.pageLockFrame]));
 const explicit=JSON.parse(JSON.stringify(p));assert.equal(wireless(explicit)[0].svg,old[0].svg);
 delete p.layout.pageSetup.visible.wirelessFitExplicit;
 const source=JSON.stringify(p),upgraded=wireless(p);check(upgraded,32);assert.equal(upgraded[0].wirelessLayout.kind,'columns');assert.equal(upgraded[0].visiblePaper.locked,true);assert.equal(JSON.stringify(p),source);
 const migrated=structuredClone(p);migrated.layout.pageSetup.visible.lockFrames=Object.fromEntries(upgraded.map(page=>[page.name,page.pageLockFrame]));const migratedAp=upgraded[0].items.find(i=>i.kind==='ap');migrated.layout.drawingEdits={[migratedAp.editKey]:unpresentPatch(migratedAp,{x:migratedAp.x-1})};const edited=wireless(migrated);assert.equal(edited[0].items.find(i=>i.editKey===migratedAp.editKey).w,migratedAp.w,'manual edit after automatic migration keeps adaptive AP size');assert.equal(edited[0].wirelessLayout.adaptiveFactor,upgraded[0].wirelessLayout.adaptiveFactor);
 const ap=old[0].items.find(i=>i.kind==='ap');p.layout.drawingEdits={[ap.editKey]:unpresentPatch(ap,{x:ap.x-1})};
 const authored=wireless(p);assert.equal(authored[0].wirelessLayout.kind,old[0].wirelessLayout.kind);assert.deepEqual(authored[0].pageLockFrame,old[0].pageLockFrame);
});
test('quick paper continuation retains physical Letter dimensions on every added sheet',async()=>{
 const {quickPagePaperLayout}=await import('../src/web/quick-page-paper.mjs');
 const p=lab({long:true});p.layout.pageSetup.visible={default:{preset:'dynamic'}};
 p.layout=quickPagePaperLayout(p.layout,wireless(p)[0],{preset:'letter'});
 const pages=wireless(p);assert.ok(pages.length>1);check(pages,32);
 for(const page of pages){assert.ok(Math.abs(printGeometry(page).width-1056)<1e-6);assert.ok(Math.abs(printGeometry(page).height-816)<1e-6);}
});
