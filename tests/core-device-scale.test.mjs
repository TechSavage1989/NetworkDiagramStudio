import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages as buildPaperPages} from '../src/web/diagram/index.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {intersects} from '../src/web/diagram/labels.mjs';

const fixture=()=>({name:'Rack scale lab',devices:[4,5].map((n,i)=>({id:'stack'+i,name:'LAB-STACK-'+n,kind:'switch',model:'JL558A',stackMembers:Array.from({length:n},(_,j)=>({id:String(j+1),model:'JL558A'})),ports:[]})).concat({id:'chassis',name:'LAB-CHASSIS',kind:'switch',model:'J9850A',ports:[]}),links:[]});
test('four and five member stacks and a modular chassis retain the same width and aspect ratios on continuation sheets',()=>{
 const site=fixture(),pages=buildPages(site).filter(page=>page.coreDeviceIds);assert.ok(pages.length>1);assert.deepEqual(pages.flatMap(page=>page.coreDeviceIds),site.devices.map(d=>d.id));
 for(const page of pages){
  const bodies=page.items.filter(i=>i.type==='device'&&i.kind!=='plug');
  for(const body of bodies){const d=site.devices.find(d=>d.id===body.sourceId),panel=deviceFaceplate(d);assert.equal(body.w,700);assert.ok(Math.abs(body.w/body.h-panel.ratio)<1e-8);assert.ok(body.y>=164&&body.y+body.h<=901);
   const alone=buildPages({...site,devices:[d]}).flatMap(p=>p.items).find(i=>i.type==='device'&&i.sourceId===d.id);assert.equal(body.w,alone.w);assert.equal(body.h,alone.h);
   for(const text of page.items.filter(i=>i.titleOwner))assert.ok(!intersects(body,text));
  }
 }
});
test('explicit device sizing remains authoritative while automatic pages do not shrink imported artwork',()=>{
 const site=fixture();site.devices=site.devices.slice(0,2);site.devices[0].stencilId='lab';site.stencils={lab:{id:'lab',view:'front',width:400,height:240,dataUrl:'data:image/png;base64,iVBORw0KGgo=',anchors:{}}};
 const pages=buildPages(site),body=pages.flatMap(p=>p.items).find(i=>i.sourceId==='stack0'&&i.type==='device');assert.equal(body.w,700);assert.equal(body.h,420);
 site.layout={drawingEdits:{[body.editKey]:{w:560,h:336}}};const edited=buildPages(site).flatMap(p=>p.items).find(i=>i.editKey===body.editKey);assert.equal(edited.w,560);assert.equal(edited.h,336);
});

// Fixed-paper regression coverage; new projects use a dynamic canvas.
function buildPages(project){return buildPaperPages({...project,layout:{...project.layout,pageSetup:project.layout?.pageSetup||{default:{preset:'original'}}}});}
