import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSite} from '../src/web/sample.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {scaleDrawingItems} from '../src/web/drawing-edits.mjs';
import {transformDrawingGroup} from '../src/web/drawing-groups.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';
import {svgPage} from '../src/web/diagram/scene.mjs';
import {ProjectHistory} from '../src/web/history.mjs';

const core=project=>buildPages(project).find(page=>page.coreDeviceIds);
function fixture(){
 const project=sampleSite();
 project.layout={pageSetup:{visible:{default:{preset:'letter',orientation:'landscape'}}}};
 const page=core(project);
 project.layout.pageSetup.visible.editFrames={[page.name]:page.presentationFrame};
 const keys=new Set(page.items.filter(i=>!i.panelGroup&&!i.pageFrame&&!i.pageHeading).map(i=>i.editKey));
 return {project,page,keys};
}
function collisions(page){
 const texts=page.items.filter(i=>i.type==='text'),paths=page.items.filter(i=>i.type==='path');
 const same=(a,b)=>a.background&&b.background&&a.linkId!=null&&a.linkId===b.linkId&&a.labelRole===b.labelRole;
 return texts.filter(a=>a.labelRole&&(texts.some(b=>a!==b&&!same(a,b)&&intersects(a,b,0))||paths.some(path=>a.background&&path.linkId!=null&&path.linkId===a.linkId?(path.hops||[]).some(hop=>intersects(hop,a,1)):pathCrossesText(path,a,1)))).map(i=>i.editKey);
}
const methods={models:(page,edits,keys,factor)=>scaleDrawingItems(page,edits,keys,factor),group:(page,edits,keys,factor)=>transformDrawingGroup(page,edits,keys,{factor})};
for(const [name,transform] of Object.entries(methods))test(`${name} multi-selection scaling keeps generated link labels automatic, styled and undoable`,()=>{
 for(const factor of [.9,1.1]){
  const {project,page,keys}=fixture(),label=page.items.find(i=>i.labelRole);
  const old={[label.editKey]:{color:'#123456',bold:false,value:'Uplink'}};
  project.layout.drawingEdits=old;
  const before=structuredClone(project),history=new ProjectHistory(before),next=transform(page,old,keys,factor);
  for(const item of page.items.filter(i=>i.labelRole)){
   assert.equal(next[item.editKey]?.x,undefined,'aggregate resize must not pin generated label x');
   assert.equal(next[item.editKey]?.y,undefined,'aggregate resize must not pin generated label y');
   assert.equal(next[item.editKey]?.cableFraction,undefined);
  }
  assert.equal(next[label.editKey].color,'#123456');assert.equal(next[label.editKey].bold,false);assert.equal(next[label.editKey].value,'Uplink');
  project.layout.drawingEdits=next;history.record(project,'drawing');
  const undone=history.travel(project);assert.deepEqual(undone.layout.drawingEdits,old);
  const redone=history.travel(undone,{redo:true});assert.deepEqual(redone.layout.drawingEdits,JSON.parse(JSON.stringify(next)));
  const rebuilt=core(redone),reopened=core(JSON.parse(JSON.stringify(redone)));
  assert.equal(svgPage(reopened),svgPage(rebuilt));assert.deepEqual(collisions(rebuilt),[]);
  for(const path of rebuilt.items.filter(i=>i.type==='path'&&i.from&&i.to)){
   assert.deepEqual(path.points[0],[path.from.x,path.from.y]);assert.deepEqual(path.points.at(-1),[path.to.x,path.to.y]);
  }
 }
});
for(const [name,factor] of [['group',.5],['group',1.4],['models',2]])test(`${name} resize ${factor} reroutes labels without the former overlap rejection`,()=>{
 const {project,page,keys}=fixture();assert.deepEqual(collisions(page),[]);
 project.layout.drawingEdits=methods[name](page,{},keys,factor);
 const rebuilt=core(project);assert.deepEqual(collisions(rebuilt),[]);
 assert.equal(rebuilt.items.filter(i=>i.labelRole).length,page.items.filter(i=>i.labelRole).length,'all original link labels remain');
});
for(const [name,transform] of Object.entries(methods))test(`${name} aggregate transforms retain explicit caption positioning and style`,()=>{
 const {page,keys}=fixture(),label=page.items.find(i=>i.labelRole),old={[label.editKey]:{x:label.x,y:label.y,color:'#123456',angle:.2,rotationMode:'fixed'}};
 const next=transform(page,old,keys,1.1);
 assert.ok(Number.isFinite(next[label.editKey].x));assert.ok(Number.isFinite(next[label.editKey].y));
 assert.equal(next[label.editKey].color,'#123456');assert.equal(next[label.editKey].rotationMode,'fixed');
});
for(const [name,transform] of Object.entries(methods))test(`${name} aggregate transforms retain explicit cable-relative caption attachment`,()=>{
 const {page,keys}=fixture(),label=page.items.find(i=>i.labelRole),old={[label.editKey]:{cableFraction:.35,cableSide:'above',color:'#123456',angle:.2,rotationMode:'fixed'}};
 const next=transform(page,old,keys,1.1)[label.editKey];
 assert.equal(next.cableFraction,.35);assert.equal(next.cableSide,'above');assert.equal(next.x,undefined);assert.equal(next.y,undefined);
 assert.equal(next.color,'#123456');assert.equal(next.rotationMode,'fixed');assert.equal(next.angle,.2);
});
