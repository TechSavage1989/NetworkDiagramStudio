import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio,printDocument} from '../src/web/diagram/index.mjs';
import {cleanPageSetup} from '../src/web/page-options.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {drawingObjects,drawingBounds,cleanDrawingEdits} from '../src/web/drawing-edits.mjs';
import {withoutDevices} from '../src/web/device-actions.mjs';
import {ProjectHistory} from '../src/web/history.mjs';
import {ensureEvidence,captureEdits,composeEvidence} from '../src/web/evidence.mjs';
import {unzip} from '../src/web/zip.mjs';
import {sampleSite} from '../src/web/sample.mjs';
const inventory=n=>({name:'Canvas lab',devices:Array.from({length:n},(_,i)=>({id:'s'+i,name:'LAB-SW-'+i,kind:'switch',model:'JL675A',ports:[]})),links:[],stencils:{},warnings:[]});
const core=p=>buildPages(p).filter(p=>p.coreDeviceIds);
test('new drawings default to a dynamic canvas, keeping 100 full-size devices on one named page',()=>{
 const p=inventory(100);p.layout={corePages:[{id:'all',name:'Complete network',devices:p.devices.map(d=>d.id)}]};const before=JSON.stringify(p),pages=core(p);
 assert.equal(cleanPageSetup().default.preset,'dynamic');assert.equal(pages.length,1);assert.equal(pages[0].name,'Complete network');assert.equal(pages[0].coreDeviceIds.length,100);
 assert.ok(Math.max(pages[0].width,pages[0].height)<6000,'Automatic packing keeps the complete site in a compact square footprint');
 const bodies=pages[0].items.filter(i=>i.type==='device'&&i.kind==='switch');assert.ok(new Set(bodies.map(i=>i.x)).size>1,'Use measured columns instead of a single very tall strip');
 for(let i=0;i<bodies.length;i++)for(const other of bodies.slice(i+1))assert.ok(bodies[i].x+bodies[i].w<=other.x||other.x+other.w<=bodies[i].x||bodies[i].y+bodies[i].h<=other.y||other.y+other.h<=bodies[i].y,'Packed hardware does not overlap');
 assert.ok(pages[0].items.filter(i=>i.type==='device'&&i.kind==='switch').every(i=>i.w===700));assert.equal(JSON.stringify(p),before);
 const last=pages[0].items.find(i=>i.type==='device'&&i.sourceId==='s99');p.layout.drawingEdits=cleanDrawingEdits({[last.editKey]:{y:19000}});assert.equal(core(p)[0].items.find(i=>i.editKey===last.editKey).y,19000);delete p.layout.drawingEdits;
 const fixed=core({...p,devices:p.devices.slice(0,10),layout:{...p.layout,pageSetup:{default:{preset:'letter'}}}});assert.ok(fixed.length>1);
});
test('a high-degree core device retains all 24 connections on the same dynamic page',()=>{
 const p=inventory(25);p.devices[0].ports=Array.from({length:24},(_,i)=>({name:'1/1/'+(i+1)}));p.links=p.devices.slice(1).map((d,i)=>({a:'s0',ap:'1/1/'+(i+1),b:d.id,bp:'1/1/1',media:'copper'}));
 const pages=core(p);assert.equal(pages.length,1);assert.equal(pages[0].items.filter(i=>i.type==='path'&&i.sourceLink).length,24);assert.equal(pages[0].coreDeviceIds.length,25);
});
test('dynamic bounds include objects outside every original edge without changing saved coordinates',async()=>{
 const p=sampleSite(),body=core(p)[0].items.find(i=>i.sourceId==='sw-1'&&i.type==='device');
 for(const [x,y] of [[1800,1600],[-850,-350]]){
  p.layout={drawingEdits:{[body.editKey]:{x,y}}};const page=core(p)[0],actual=page.items.find(i=>i.editKey===body.editKey);assert.equal(actual.x,x);assert.equal(actual.y,y);
  for(const b of drawingObjects(page).map(drawingBounds).filter(Boolean)){assert.ok(b.x>=page.originX-.01&&b.y>=page.originY-.01);assert.ok(b.x+b.w<=page.originX+page.width+.01&&b.y+b.h<=page.originY+page.height+.01);}
  assert.match(page.svg,new RegExp('viewBox="'+page.originX+' '+page.originY+' '));
  const parts=await unzip(await exportVisio(p,[page]).arrayBuffer());assert.ok(parts.has('visio/pages/page1.xml'));
 }
});
test('print paper scales output without repaginating or resizing the dynamic drawing',async()=>{
 const p=inventory(30),before=core(p)[0];p.layout=cleanLayout({pageSetup:{printPaper:{preset:'letter',orientation:'portrait'}}},p.devices.map(d=>d.id));
 const page=core(JSON.parse(JSON.stringify(p)))[0];assert.deepEqual([page.width,page.height,page.coreDeviceIds],[before.width,before.height,before.coreDeviceIds]);
 assert.match(printDocument([page]),/@page nds0\{size:215\.9000mm 279\.4000mm/);
 const parts=await unzip(await exportVisio(p,[page]).arrayBuffer()),xml=new TextDecoder().decode(parts.get('visio/pages/pages.xml'));
 assert.match(xml,/<Cell N="PaperKind" V="1"/);assert.match(xml,/<Cell N="OnPage" V="1"/);assert.match(xml,/<Cell N="PagesX" V="1"/);assert.match(xml,/<Cell N="PagesY" V="1"/);
 assert.ok(Math.abs(+xml.match(/N="PageHeight" V="([^"]+)"/)[1]-page.height/96)<.0001);
 const history=new ProjectHistory(p),fixed={...p,layout:{...p.layout,pageSetup:{default:{preset:'letter'}}}};history.record(fixed);assert.equal(core(history.travel(fixed))[0].coreDeviceIds.length,30);
});
test('delete and clear remove connections, page assignments and layout IDs with complete undo/redo',()=>{
 const p=inventory(4);p.devices[2].hidden=true;p.links=[{a:'s0',ap:'1',b:'s1',bp:'1'}];p.layout={order:['s1','s0','s2','s3'],corePages:[{id:'a',name:'Rack A',devices:['s0','s1']}],coreExclude:['s2']};
 const history=new ProjectHistory(p),one=withoutDevices(p,['s0']);history.record(one);assert.equal(one.devices.length,3);assert.equal(one.links.length,0);assert.deepEqual(one.layout.corePages[0].devices,['s1']);assert.ok(!one.layout.order.includes('s0'));assert.equal(p.devices.length,4);
 const empty=withoutDevices(one,one.devices.map(d=>d.id));history.record(empty);assert.equal(empty.devices.length,0);assert.equal(empty.layout.corePages.length,0);assert.equal(history.travel(empty).devices.length,3);assert.equal(history.travel(one).devices.length,4);assert.equal(history.travel(p,{redo:true}).devices.length,3);
});
test('deleted imported devices stay deleted after evidence recomposition and save/reopen',()=>{
 const p=inventory(3);p.links=[{a:'s0',ap:'1',b:'s1',bp:'1'}];ensureEvidence(p);const before=structuredClone({devices:p.devices,links:p.links,warnings:p.warnings}),next=withoutDevices(p,['s0']);captureEdits(next,before);
 const opened=JSON.parse(JSON.stringify(next));composeEvidence(opened);assert.ok(!opened.devices.some(d=>d.id==='s0'));assert.equal(opened.links.length,0);
});
test('deleting an explicit WAN handoff does not regenerate an inferred duplicate',()=>{
 const p={devices:[{id:'fw',kind:'firewall',name:'Firewall',ports:[{name:'wan1',role:'wan',gateway:'192.0.2.1'}]},{id:'isp',kind:'handoff',name:'ISP',ports:[{name:'p'}]}],links:[{a:'fw',ap:'wan1',b:'isp',bp:'p'}]};
 const next=withoutDevices(p,['isp']);assert.ok(!core(next)[0].items.some(i=>i.sourceId==='handoff:fw/wan1'));
 assert.ok(!core(JSON.parse(JSON.stringify(next)))[0].items.some(i=>i.sourceId==='handoff:fw/wan1'));
});
