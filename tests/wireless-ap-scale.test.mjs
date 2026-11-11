import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {cleanPresentation} from '../src/web/presentation.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';

import {wirelessApLab as lab} from './fixtures/wireless-ap-layout.mjs';

const wireless=p=>buildPages(p).filter(page=>page.wirelessLayout);
const sourceSize=item=>item.size/(item.presentation?.fontScale||1);
function clear(page){
 assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);
 const bodies=page.items.filter(i=>i.type==='device'),captions=page.items.filter(i=>i.wirelessCaption),paths=page.items.filter(i=>i.type==='path');
 for(const [index,text] of captions.entries()){
  assert.ok(!bodies.some(body=>intersects(text,body)),'caption clears hardware');
  assert.ok(!captions.slice(index+1).some(other=>intersects(text,other)),'caption clears captions');
  assert.ok(!paths.some(path=>pathCrossesText(path,text,1)),'cables clear captions');
 }
 for(const path of paths){
  for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]])assert.deepEqual(point,[anchor.x,anchor.y]);
  for(let i=1;i<path.points.length;i++)assert.ok(path.points[i][0]===path.points[i-1][0]||path.points[i][1]===path.points[i-1][1]);
 }
}
// An explicit AP size is kept exactly (the automatic card factor is off), so
// 150% draws AP bodies and captions three times the 50% size relative to the
// switch, while each switch keeps its own planned width.
test('wireless AP and automatic details scale together at 50 and 150 percent without scaling switches',()=>{
 const pages=[.5,1.5].map(scale=>{const project=lab(8,3,scale),saved=JSON.stringify(project),page=wireless(project)[0];clear(page);assert.equal(JSON.stringify(project),saved);assert.equal(wireless(JSON.parse(saved))[0].svg,page.svg);return page;});
 const ratio=page=>page.items.find(i=>i.kind==='ap').w/page.items.find(i=>i.kind==='switch').w,title=page=>page.items.find(i=>i.wirelessCaption&&/\|title\|/.test(i.editKey));
 assert.ok(Math.abs(ratio(pages[1])/ratio(pages[0])-3)<1e-6,'AP bodies scale with the setting, switches do not');
 assert.ok(Math.abs(sourceSize(title(pages[1]))/sourceSize(title(pages[0]))-3)<1e-6,'AP captions scale with their bodies');
 assert.equal(sourceSize(title(pages[0])),9,'50% of the 18 px AP name');
});
test('side space is explicit, improves realistic small and dense fans, and retains safe fallback',()=>{
 assert.equal(cleanPresentation({}).defaults.wirelessApPlacement,'rows');
 for(const [count,members] of [[8,3],[28,5]]){
  const rows=wireless(lab(count,members,1.5))[0],side=wireless(lab(count,members,1.5,'sides'))[0];clear(side);
  assert.ok(['sides','surround'].includes(side.wirelessLayout.kind));assert.equal(side.items.filter(i=>i.kind==='ap').length,count);
  // Both are planned whole-switch sheets; side space keeps its cables untangled.
  assert.ok(side.wirelessLayout.routingCost[3]<=count,'no more crossings than APs');assert.ok(rows.wirelessLayout.routingCost[3]<=count);
  const sw=side.items.find(i=>i.kind==='switch');assert.ok(side.items.filter(i=>i.kind==='ap').some(i=>i.x+i.w<sw.x||i.x>sw.x+sw.w));
 }
});
test('AP scale and placement normalize and inherit per page without mutating source data',()=>{
 const project=lab(4,3,.5),second=structuredClone(project.devices[0]);second.id='sw2';second.name='SECOND-STACK';project.devices.push(second);
 for(let i=0;i<4;i++){project.devices.push({...structuredClone(project.devices[i+1]),id:'other'+i});project.links.push({...project.links[i],a:'sw2',b:'other'+i});}
 project.layout.presentation.pages={'Wireless Connections 2':{wirelessApScale:1.5,wirelessApPlacement:'sides'}};
 const pages=wireless(project);assert.equal(pages.length,2);
 for(const [i,page] of pages.entries()){const sw=page.items.find(i=>i.kind==='switch'),ap=page.items.find(i=>i.kind==='ap');assert.ok(Math.abs(ap.w/sw.w-(72/998)*(i?1.5:.5))<1e-6);}
 const cleaned=cleanPresentation({defaults:{wirelessApScale:99,wirelessApPlacement:'invalid'}});assert.equal(cleaned.defaults.wirelessApScale,1);assert.equal(cleaned.defaults.wirelessApPlacement,'rows');
});
// A dynamic sheet may rearrange its automatic APs when the AP size or
// placement changes; authored positions, sizes and caption edits stay exact.
test('authored geometry and caption sizes remain authoritative when AP size and placement change',()=>{
 const p=lab(),page=wireless(p)[0],ap=page.items.find(i=>i.kind==='ap'),title=page.items.find(i=>i.wirelessCaption);
 p.layout.drawingEdits={[ap.editKey]:{x:ap.x,w:ap.w,h:ap.h},[title.editKey]:{value:'Authored title',size:24}};p.layout.presentation.defaults={wirelessApScale:1.5,wirelessApPlacement:'sides'};
 const result=wireless(p)[0];assert.equal(result.items.find(i=>i.editKey===ap.editKey).x,ap.x);
 assert.equal(result.items.find(i=>i.editKey===ap.editKey).w,ap.w);
 assert.equal(sourceSize(result.items.find(i=>i.editKey===title.editKey)),24);
 assert.equal(result.items.find(i=>i.editKey===title.editKey).value,'Authored title');
});
test('frozen paper keeps its frame when AP scale changes and does not silently adopt side columns',()=>{
 const p=lab();Object.assign(p.layout.pageSetup.visible,{wirelessFit:'layout',wirelessFitExplicit:true});p.layout.presentation.defaults.minimumTextPt=0;p.layout.pageSetup.visible.default={preset:'letter',orientation:'landscape',locked:true};
 const before=wireless(p)[0];p.layout.pageSetup.visible.lockFrames={[before.name]:before.pageLockFrame};
 p.layout.presentation.defaults.wirelessApScale=1.5;p.layout.presentation.defaults.wirelessApPlacement='sides';
 const after=wireless(p)[0];assert.equal(after.wirelessLayout.kind,'banks');assert.deepEqual(after.pageLockFrame,before.pageLockFrame);assert.equal(after.width,before.width);assert.equal(after.height,before.height);clear(after);
});
test('new Letter wireless planning gives numbers 8pt room without forcing the sample switch off paper',async()=>{
 const {sampleSite}=await import('../src/web/sample.mjs'),{printGeometry}=await import('../src/web/page-options.mjs');
 const p=sampleSite();p.layout={pageSetup:{visible:{default:{preset:'letter',orientation:'landscape',locked:true}}}};
 const pages=wireless(p);assert.ok(pages.length);
 for(const page of pages){assert.equal(page.pageOverflow,false);assert.ok(page.paperReadability.actualPt>=8-1e-6);const sw=page.items.find(i=>i.kind==='switch');assert.ok(sw.w/page.width*printGeometry(page).width<1056);assert.ok(page.pageLockFrame.wirelessNumberScale>1);}
 p.layout.pageSetup.visible.lockFrames=Object.fromEntries(pages.map(page=>[page.name,page.pageLockFrame]));
 assert.deepEqual(wireless(JSON.parse(JSON.stringify(p))).map(page=>page.svg),pages.map(page=>page.svg));
});
