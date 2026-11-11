import test from 'node:test';
import assert from 'node:assert/strict';
import {unpresentPatch} from '../src/web/presentation.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {wirelessApLab} from './fixtures/wireless-ap-layout.mjs';
import {refitWirelessPresentation} from '../src/web/wireless-presentation.mjs';
import {printGeometry,cleanPageSetup} from '../src/web/page-options.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';
const wireless=p=>buildPages(p).filter(page=>page.wirelessLayout);
function dense(scale,placement,preset='letter'){
 const p=wirelessApLab(32,8,scale,placement);
 p.devices[0].ports.forEach((v,i)=>v.name='7/'+(i+1));p.links.forEach((v,i)=>v.ap='7/'+(i+1));
 p.layout.pageSetup.visible.default={preset,orientation:'landscape',locked:true};Object.assign(p.layout.pageSetup.visible,{wirelessFit:'layout',wirelessFitExplicit:true});return p;
}
const captionPt=page=>Math.min(...page.items.filter(i=>i.wirelessCaption).map(i=>textLayout(i).size))*.75*printGeometry(page).width/page.width;
function clear(page){
 assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);assert.equal(page.pageOverflow,false);
 const aps=page.items.filter(i=>i.kind==='ap'),captions=page.items.filter(i=>i.wirelessCaption),devices=page.items.filter(i=>i.type==='device'),paths=page.items.filter(i=>i.type==='path');
 assert.equal(aps.length,32);assert.equal(paths.length,32);
 for(const [index,caption] of captions.entries()){
  assert.ok(!devices.some(d=>intersects(caption,d)));assert.ok(!captions.slice(index+1).some(c=>intersects(caption,c,-1e-6)));
  assert.ok(!paths.some(path=>pathCrossesText(path,caption,1)));
 }
 for(const path of paths)for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]])for(const [axis,key] of ['x','y'].entries())assert.ok(Math.abs(point[axis]-anchor[key])<1e-6);
}
test('side-space fills around a dense stack and improves real printed AP text on Letter and A4',()=>{
 for(const preset of ['letter','a4']){
  const row=wireless(dense(1.5,'rows',preset))[0],p=dense(1.5,'sides',preset),saved=JSON.stringify(p),page=wireless(p)[0];clear(page);
  assert.equal(page.wirelessLayout.kind,'surround');const sw=page.items.find(i=>i.kind==='switch'),aps=page.items.filter(i=>i.kind==='ap');
  assert.ok(aps.some(i=>i.x+i.w<sw.x)&&aps.some(i=>i.x>sw.x+sw.w));assert.ok(aps.some(i=>i.y+i.h<sw.y)&&aps.some(i=>i.y>sw.y+sw.h));
  assert.ok(captionPt(page)>captionPt(row)*(preset==='letter'?1.1:1.03));assert.ok(page.wirelessLayout.routingCost[3]<=page.wirelessLayout.links.length,'no more crossings than APs');
  assert.equal(JSON.stringify(p),saved);assert.ok(page.paperReadability.actualPt<8,'dense one-sheet output honestly warns rather than claiming readable 8pt');
 }
});
test('explicit AP changes refit automatic saved frames without unlocking paper; side plans reopen exactly',()=>{
 const p=wirelessApLab(8,3,1),visible=p.layout.pageSetup.visible;visible.default={preset:'letter',orientation:'landscape',locked:true};
 const old=wireless(p),previous=structuredClone(p.layout.presentation);visible.lockFrames={[old[0].name]:old[0].pageLockFrame};
 p.layout.presentation.defaults.wirelessApPlacement='sides';p.layout.presentation.defaults.wirelessApScale=1.5;
 refitWirelessPresentation(p.layout,previous,old);assert.equal(visible.default.locked,true);assert.deepEqual(visible.lockFrames,{});
 const page=wireless(p)[0];assert.ok(['sides','surround'].includes(page.wirelessLayout.kind));assert.ok(page.pageLockFrame.wirelessPlan);
 visible.lockFrames={[page.name]:page.pageLockFrame};p.layout.pageSetup=cleanPageSetup(p.layout.pageSetup);
 assert.equal(wireless(JSON.parse(JSON.stringify(p)))[0].svg,page.svg);
 const ap=page.items.find(i=>i.kind==='ap');p.layout.drawingEdits={[ap.editKey]:unpresentPatch(ap,{x:ap.x-1})};
 const moved=wireless(p)[0];assert.equal(moved.wirelessLayout.planKey,page.wirelessLayout.planKey);assert.equal(wireless(JSON.parse(JSON.stringify(p)))[0].svg,moved.svg);delete p.layout.drawingEdits;
 // Re-applying an already selected side-space setting is also an explicit
 // automatic refit, repairing old saved row frames from preview.47.
 refitWirelessPresentation(p.layout,structuredClone(p.layout.presentation),[page]);assert.deepEqual(p.layout.pageSetup.visible.lockFrames,{});
});
test('AP setting refit retains authored geometry and unrelated page frames',()=>{
 const p=wirelessApLab(),page=wireless(p)[0],ap=page.items.find(i=>i.kind==='ap'),previous=structuredClone(p.layout.presentation),frame={scale:1,x:0,y:0,originX:0,originY:0,width:1056,height:816};
 p.layout.pageSetup.visible.lockFrames={[page.name]:frame,Other:frame};p.layout.drawingEdits={[ap.editKey]:{x:ap.x+1}};p.layout.presentation.defaults.wirelessApPlacement='sides';
 refitWirelessPresentation(p.layout,previous,[page]);assert.deepEqual(p.layout.pageSetup.visible.lockFrames,{[page.name]:frame,Other:frame});assert.equal(p.layout.drawingEdits[ap.editKey].x,ap.x+1);
 delete p.layout.drawingEdits[ap.editKey];refitWirelessPresentation(p.layout,previous,[page]);assert.deepEqual(p.layout.pageSetup.visible.lockFrames,{Other:frame});
});
