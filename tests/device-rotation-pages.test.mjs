import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {devicePoint,deviceBounds,deviceRegionBounds} from '../src/web/diagram/device-geometry.mjs';
import {intersects,embeddedTextBoxes,textFootprint,crossesText} from '../src/web/diagram/labels.mjs';
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=';
const sw=id=>({id,name:'LAB-'+id.toUpperCase(),kind:'switch',model:'JL558A',ports:[{name:'1',state:'up'}]});
const ap={id:'ap',name:'LAB-AP',kind:'ap',ports:[{name:'eth0',state:'up'}],stencil:{id:'mapped-ap',width:100,height:100,dataUrl:pixel,anchors:{eth0:[.2,.7]}}};
const fixture=(wireless=false)=>({name:'Rotation lab',devices:[sw('a'),wireless?structuredClone(ap):sw('b')],links:[{a:'a',ap:'1',b:wireless?'ap':'b',bp:wireless?'eth0':'1',media:'copper',speed:'1 Gbps'}]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function check(page){
 const bodies=page.items.filter(i=>i.type==='device');
 for(const g of bodies){const b=deviceBounds(g);assert.ok(b.x>=(page.originX||0)&&b.y>=(page.originY||0));assert.ok(b.x+b.w<=(page.originX||0)+page.width+.01&&b.y+b.h<=(page.originY||0)+page.height+.01);}
 for(const p of page.items.filter(i=>i.type==='path'&&i.from&&i.to)){
  for(const [a,end] of [[p.from,p.points[0]],[p.to,p.points.at(-1)]]){const g=bodies.find(i=>i.key===a.device);assert.ok(g?.ports[a.port]);const point=devicePoint(g,...g.ports[a.port]);near(end[0],point[0]);near(end[1],point[1]);
   for(const socket of (g.children||[]).filter(c=>c.socketPart===0)){const b=deviceRegionBounds(g,socket);if(point[0]>=b.x&&point[0]<=b.x+b.w&&point[1]>=b.y&&point[1]<=b.y+b.h)continue;assert.ok(!crossesText(p.points,b,1.9),'Cable crosses unrelated rotated socket');}
  }
  p.points.slice(1).forEach((b,i)=>assert.ok(b[0]===p.points[i][0]||b[1]===p.points[i][1]));
 }
 for(const t of page.items.filter(i=>i.titleOwner||i.wirelessCaption||i.labelRole))for(const g of bodies)assert.ok(!intersects(t,{...deviceBounds(g),angle:0}),`${t.value} overlaps ${g.sourceId}`);
}
test('complete core pages retain rotated physical glue, readable titles and dynamic extents after reopen',()=>{
 const p=fixture(),base=buildPages(p).find(p=>p.coreDeviceIds),bodies=base.items.filter(i=>i.type==='device');
 for(const angle of [.4,Math.PI/2,Math.PI,-.6]){
  p.layout={drawingEdits:Object.fromEntries(bodies.map((g,n)=>[g.editKey,{x:500+n*1000,y:500+n*900,w:g.w,h:g.h,angle:angle*(n?-1:1)}]))};
  const page=buildPages(JSON.parse(JSON.stringify(p))).find(p=>p.coreDeviceIds);check(page);assert.equal(page.items.filter(i=>i.type==='path'&&i.sourceLink).length,1);
 }
});
test('wireless retains mapped AP socket, rotated number alignment and safe departures',()=>{
 const p=fixture(true),base=buildPages(p).find(p=>p.wirelessLayout),bodies=base.items.filter(i=>i.type==='device');
 p.layout={drawingEdits:Object.fromEntries(bodies.map((g,n)=>[g.editKey,{x:600+n*1000,y:800-n*500,w:g.w,h:g.h,angle:.4*(n?-1:1)}]))};
 const page=buildPages(JSON.parse(JSON.stringify(p))).find(p=>p.wirelessLayout);check(page);
 const path=page.items.find(i=>i.type==='path'&&i.to),end=page.items.find(i=>i.sourceId==='ap'&&i.type==='device');assert.equal(path.to.port,'eth0');assert.deepEqual(end.ports.eth0,[.2,.7]);
 const numbers=page.items.filter(i=>i.portNumberRole==='text');assert.ok(numbers.length);assert.ok(numbers.every(i=>Math.abs(i.angle)>.1));for(const text of numbers)assert.ok(!crossesText(path.points,textFootprint(text),1.9));
});
test('embedded hardware text obstacles use device and child angles',()=>{
 const g={type:'device',x:100,y:100,w:200,h:100,angle:.4,children:[{type:'text',x:.1,y:.2,w:.4,h:.2,value:'X',size:10,angle:.2}]};
 const box=embeddedTextBoxes({items:[g]})[0],[cx,cy]=devicePoint(g,.3,.3),expected=textFootprint({x:cx-40,y:cy-10,w:80,h:20,angle:.6});for(const k of ['x','y','w','h'])near(box[k],expected[k]);assert.equal(box.owner,g);
});
test('core AP instances preserve explicitly mapped physical uplinks rather than substituting boundaries',()=>{
 const p=fixture(true);p.layout={includeAPs:true};const base=buildPages(p).find(p=>p.coreDeviceIds),bodies=base.items.filter(i=>i.type==='device');
 p.layout.drawingEdits=Object.fromEntries(bodies.map((g,n)=>[g.editKey,{x:500+n*1000,y:500+n*800,w:g.w,h:g.h,angle:.4}]));
 const page=buildPages(p).find(p=>p.coreDeviceIds),path=page.items.find(i=>i.type==='path'&&i.to);assert.equal(path.to.port,'eth0');check(page);
});
