import test from 'node:test';
import assert from 'node:assert/strict';
import {placeCableLabels,intersects,textFootprint} from '../src/web/diagram/labels.mjs';
import {svgPage} from '../src/web/diagram/scene.mjs';
import {exportVisio} from '../src/web/diagram/visio.mjs';
import {exportPdf} from '../src/web/report-export.mjs';
import {unzip} from '../src/web/zip.mjs';

function bank(axis,dir,edits={}){
 const page={name:'Centered labels lab',width:1200,height:975,items:[{type:'device',sourceId:'lab',key:'lab',x:450,y:400,w:100,h:100,children:[],ports:{}}]},requests=[];
 for(let n=0;n<2;n++){
  const at=425+n*50,from=dir<0?450:550;
  const points=axis===0?[[from,at],[from+dir*220,at]]:[[at+50,dir<0?400:500],[at+50,(dir<0?400:500)+dir*220]];
  page.items.push({type:'path',linkId:n,points,color:'#123456',weight:2,editKey:'cable'+n});
  requests.push({role:'port',bank:'lab',endpoint:'a',linkId:n,value:n?'1/1/48':'1',editKey:'port'+n,side:dir<0?'left':'right',outer:400,y:at});
 }
 assert.equal(placeCableLabels(page,requests,edits).ok,true);
 return page;
}

test('banked port labels center on every departure direction without changing measured clearance',()=>{
 for(const axis of [0,1])for(const dir of [-1,1]){
  const page=bank(axis,dir),labels=page.items.filter(i=>i.labelRole);
  assert.equal(labels.length,2);
  assert.ok(labels.every(i=>i.align==='center'&&i.background==='#FFFFFF'));
  for(const label of labels){const path=page.items.find(i=>i.type==='path'&&i.linkId===label.linkId);assert.equal(axis===0?label.y+label.h/2:label.x+label.w/2,path.points[0][axis===0?1:0],'automatic port text sits directly over its own line');}
  assert.equal(intersects(labels[0],labels[1],3),false);
  for(const label of labels){const box=textFootprint(label);assert.ok(box.x>=0&&box.y>=0&&box.x+box.w<=page.width&&box.y+box.h<=page.height);assert.equal(intersects(label,page.items[0],3),false);}
 }
});

function caption({inline=false,stacked=false,align}={}){
 const page={name:'Cable captions',width:1200,height:975,items:[{type:'path',linkId:1,points:[[200,400],[1000,400]],commands:[['M',200,400],['L',1000,400]],color:'#123456',weight:2,editKey:'cable'}]};
 const patch=inline?{cableFraction:.5,cableSide:'on'}:{x:400,y:300,w:160};
 if(align)patch.align=align;
 const edits={'media|0':patch,...(stacked?{'media|1':{...patch}}:{})};
 assert.equal(placeCableLabels(page,[{role:'media',linkId:1,value:stacked?['Copper','10 Gbps']:'Copper',editKey:'media',side:'left',outer:400,y:300}],edits).ok,true);
 return page;
}

test('beside, inline and multiline cable captions default to center and retain explicit alignment edits',()=>{
 for(const options of [{},{inline:true},{inline:true,stacked:true}]){
  const base=caption(options),edited=caption({...options,align:'right'});
  assert.ok(base.items.filter(i=>i.labelRole).every(i=>i.align==='center'));
  assert.ok(edited.items.filter(i=>i.labelRole).every(i=>i.align==='right'));
  assert.deepEqual(base.items.map(({align,...item})=>item),edited.items.map(({align,...item})=>item));
 }
 const edited=bank(0,-1,{'port0|0':{align:'left'}});
 assert.equal(edited.items.find(i=>i.editKey==='port0|0').align,'left');
});

test('centered cable captions use matching SVG, PDF and native Visio text alignment',async()=>{
 const page=caption({inline:true,stacked:true});
 const svg=svgPage(page);
 assert.equal((svg.match(/text-anchor="middle"/g)||[]).length,2);
 const parts=await unzip(await exportVisio({name:'Alignment lab',devices:[]},[page]).arrayBuffer());
 const xml=new TextDecoder().decode(parts.get('visio/pages/page1.xml'));
 assert.equal((xml.match(/N="HorzAlign" V="1"/g)||[]).length,2);
 const calls=[],previous=globalThis.jspdf;
 // Capture the coordinates and options actually sent to the PDF renderer.
 globalThis.jspdf={jsPDF:class {constructor(){return new Proxy(this,{get:(target,key)=>key==='text'?((...args)=>calls.push(args)):key==='output'?(()=>new ArrayBuffer(0)):(()=>{})});}}};
 try{await exportPdf([page]);}finally{if(previous===undefined)delete globalThis.jspdf;else globalThis.jspdf=previous;}
 assert.equal(calls.length,2);
 for(const [value,x,,options] of calls){const item=page.items.find(i=>i.value===value);assert.equal(options.align,'center');assert.equal(x,(item.x+item.w/2)*.75);}
});

import {buildPages} from '../src/web/diagram/index.mjs';
import {adaptiveProject} from './fixtures/adaptive-port-maps.mjs';

test('normal and stacked port maps retain centered port numbers in dynamic and paper builder layouts',()=>{
 for(const members of [1,3])for(const preset of ['dynamic','letter']){
  const project=adaptiveProject(preset,'landscape',members);
  const pages=buildPages(project),numbers=pages.flatMap(p=>p.items.filter(i=>i.portNumberRole==='text'||i.reportPortRole==='number'));
  assert.equal(numbers.length,members*52);
  assert.ok(numbers.every(i=>i.align==='center'));
  const first=numbers[0];project.layout.drawingEdits={[first.editKey]:{align:'right'}};
  const edited=buildPages(project).flatMap(p=>p.items).find(i=>i.editKey===first.editKey);
  assert.equal(edited.align,'right');
 }
});


test('automatic unbanked port text prefers its own line while saved pinned and cable-side placements win',()=>{
 const make=edits=>{const page={name:'Inline port defaults',width:1200,height:975,items:[{type:'path',linkId:0,editKey:'own',points:[[400,400],[800,400]],commands:[['M',400,400],['L',800,400]],color:'#164878',weight:4}]};assert.equal(placeCableLabels(page,[{role:'port',endpoint:'a',linkId:0,value:'1/1/48',editKey:'port',side:'right',outer:400,y:400}],edits).ok,true);return page.items.find(i=>i.labelRole);};
 const auto=make({});assert.equal(auto.background,'#FFFFFF');assert.equal(auto.y+auto.h/2,400);assert.equal(auto.align,'center');
 const pinned=make({'port|0':{x:430,y:330}});assert.equal(pinned.x,430);assert.equal(pinned.y,330);
 const snapped=make({'port|0':{cableFraction:.3,cableSide:'above'}});assert.ok(snapped.y+snapped.h<400);
 const banked=bank(0,1,{'port0|0':{cableFraction:.3,cableSide:'above'}}),saved=banked.items.find(i=>i.editKey==='port0|0');assert.ok(saved.y+saved.h<425,'banking does not override a saved cable-side attachment');
});
