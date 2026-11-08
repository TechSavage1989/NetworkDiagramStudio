import test from 'node:test';
import assert from 'node:assert/strict';
import {coreRoutes,planModuleEscapes,endpointLead,simplifyRoute} from '../src/web/diagram/routing.mjs';
import {addDevice,getAnchor,bridge} from '../src/web/diagram/scene.mjs';
import {corePages} from '../src/web/diagram/core.mjs';
import {crossesText} from '../src/web/diagram/labels.mjs';
import {physicalInventory} from '../src/web/physical-links.mjs';
import {modularChassis,modularRoutingFixture} from './fixtures/modular-routing.mjs';

const length=points=>points.slice(1).reduce((sum,b,i)=>sum+Math.abs(b[0]-points[i][0])+Math.abs(b[1]-points[i][1]),0);
function fixture(nodes,connections,options={}){
 const map=new Map(nodes.map(node=>[node.key,node])),endData=new Map(),banks=new Map(),links=[];
 for(const [idx,[a,b,ap,bp,as='top',bs='top',weight=4]] of connections.entries()){
  const e={idx,a,b,ap:'p'+idx,bp:'p'+idx};links.push(e);
  for(const [id,point,side,which] of [[a,ap,as,'a'],[b,bp,bs,'b']]){
   const node=map.get(id),anchor={device:node.key,port:'p'+idx,x:point[0],y:point[1],edge:node.y+(side==='bottom'?node.h:0),side,weight},v={e,id,which,node,anchor,info:{}};
   endData.set(idx+'/'+which,v);const key=id+'/'+side;if(!banks.has(key))banks.set(key,[]);banks.get(key).push(v);
  }
 }
 return {links,endData,banks,nodes:map,options:{left:Math.min(...nodes.map(n=>n.x)),right:Math.max(...nodes.map(n=>n.x+n.w)),minX:-2000,maxX:4000,...options}};
}
const run=f=>coreRoutes(f.links,[],f.endData,f.banks,f.nodes,f.options);
const body=(key,x,y,w=200,h=80)=>({key,sourceId:key,kind:'switch',x,y,w,h});
function clearPaths(result){
 const seen=[];
 for(const route of result.routes){
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],h=a[1]===b[1];assert.ok(h||a[0]===b[0]);
   const axis=a[h?1:0],lo=Math.min(a[h?0:1],b[h?0:1]),hi=Math.max(a[h?0:1],b[h?0:1]);
   for(const prior of seen)if(prior.route!==route&&prior.h===h&&Math.min(hi,prior.hi)-Math.max(lo,prior.lo)>.001)
    assert.ok(Math.abs(axis-prior.axis)>=(route.weight+prior.route.weight)/2+.25-.001,'Painted parallel segments have a visible gap');
   seen.push({route,h,axis,lo,hi});
  }
 }
}

test('unrelated distant devices never force a clear nearby pair around the whole page',()=>{
 const f=fixture([body('a',400,100),body('b',450,400),body('west',-1500,200),body('east',2500,200)],
  [['a','b',[430,100],[480,400]]]),r=run(f);
 assert.equal(r.cost[0],0);assert.ok(length(r.routes[0].points)<650);
 assert.ok(r.routes[0].points.every(([x])=>x>=380&&x<=700),'The nearby pair uses its own clear corridor');
 assert.deepEqual(r.routes[0].points[0],[430,100]);assert.deepEqual(r.routes[0].points.at(-1),[480,400]);
});

test('a small cable crossing with a hop wins over a page-wide detour',()=>{
 const f=fixture([body('north',500,0),body('south',500,700),body('west',100,300),body('east',900,300)],
  [['north','south',[600,80],[600,700],'bottom','top'],['west','east',[200,380],[1000,380],'bottom','bottom']]),r=run(f);
 assert.equal(r.cost[0],0);clearPaths(r);
 assert.equal(r.routes.find(route=>route.e.a==='north').points.length,2);
 assert.ok(r.routes.reduce((sum,route)=>sum+length(route.points),0)<1500,'A clear crossing does not send either connection around the equipment bank');
 const scene={items:r.routes.map(route=>({type:'path',points:route.points,weight:route.weight}))};bridge(scene);
 assert.ok(scene.items.some(path=>path.commands.some(command=>command[0]==='A')),'The visible crossing retains a bridge');
});

test('occupied exterior samples still discover the shorter clear gap between nearby rails',()=>{
 const count=5,connections=Array.from({length:count},(_,i)=>['a','b',[430+i*12,172],[430+i*12,872],'bottom',i?'top':'bottom']);
 const f=fixture([body('a',400,100,700),body('b',400,800,700)],connections,{left:400,right:1100,minX:-500,maxX:1500,railPitch:60});
 // Four already allocated side departures occupy the fixed left samples.
 // Their actual clearance envelopes leave the intermediate 240-250 corridor.
 const exits=[0,384,310,180,80];
 for(let i=0;i<count;i++)for(const which of ['a','b']){
  const anchor=f.endData.get(i+'/'+which).anchor;
  if(i){const y=anchor.y-6-i*8;anchor.departure=[[anchor.x,y],[exits[i],y]];}
  else anchor.escapeY=which==='a'?198:1020;
 }
 const r=run(f),target=r.routes.find(route=>route.e.idx===0);
 assert.equal(r.cost[0],0);assert.equal(r.cost[1],0);clearPaths(r);
 assert.ok(target.rail>=240&&target.rail<=250,'Use the free interval instead of detouring around the far right side');
 assert.ok(length(target.points)<1400);assert.ok(target.points.every(([x])=>x<=430));
 assert.deepEqual(target.points[0],[430,172]);assert.deepEqual(target.points.at(-1),[430,872]);
 assert.equal(r.stats.builds,1);assert.ok(r.stats.candidates<count*140,'Additional gap candidates remain bounded');
});

test('route search remains bounded for dense banks without repeated global rebuilds',()=>{
 const count=24,a=body('a',400,100,1000),b=body('b',400,1480,1000),connections=Array.from({length:count},(_,i)=>['a','b',[440+i*24,180],[520+i*24,1480],'bottom','top']);
 const f=fixture([a,b],connections),r=run(f);
 assert.equal(r.routes.length,count);assert.equal(r.cost[0],0);clearPaths(r);
 assert.equal(r.stats.builds,1);assert.ok(r.stats.candidates<count*140,'Candidate work is bounded per connection');
 assert.ok(r.routes.every(route=>length(route.points)<1800),'Dense facing banks retain nearby routes');
 assert.deepEqual(run(f).routes.map(r=>r.points),r.routes.map(r=>r.points),'Regeneration is deterministic');
});

test('parallel departure clearance follows painted stroke width and available space',()=>{
 const make=(gap,weight)=>fixture([body('a',-100,-200,700),body('b',-100,-120+gap,700)],Array.from({length:4},(_,i)=>['a','b',[-60+i*20,-120],[100+i*20,-120+gap],'bottom','top',weight]));
 const thin=run(make(56,4));assert.equal(thin.cost[0],0);clearPaths(thin);
 assert.throws(()=>run(make(56,12)),error=>error.code==='CORE_LAYOUT_CAPACITY');
 const thick=run(make(140,12));assert.equal(thick.cost[0],0);clearPaths(thick);
});

test('outer module ports use the nearest clear exterior toward their peer while inside ports retain the center',()=>{
 const g=addDevice({items:[]},{},modularChassis(),[500,1000,1000,1],'chassis',{fitWidth:true});
 const outside=getAnchor(g,'A1','bottom',0,{weight:8,peer:{x:0,y:1800}}),inside=getAnchor(g,'A8','bottom',1,{weight:8,peer:{x:1800,y:1800}}),plans=planModuleEscapes([outside,inside]);
 assert.equal(plans.get(outside).via,'outer');assert.equal(plans.get(inside).via,'center');
 for(const anchor of [outside,inside]){
  const escape=plans.get(anchor),points=simplifyRoute(endpointLead({anchor,ay:anchor.edge+30,exitX:escape.x,moduleEscape:escape}));
  for(const region of g.panelRegions.filter(region=>region.id!=='A'))assert.ok(!crossesText(points,{x:g.x+region.x*g.w,y:g.y+region.y*g.h,w:region.w*g.w,h:region.h*g.h},3.99),'Thick lead clears every unrelated module');
 }
 const constrained=planModuleEscapes([outside],{minX:g.x,maxX:g.x+g.w});assert.equal(constrained.get(outside).via,'center','A narrow exterior falls back to the available center');
});

function core(project){const devices=new Map(project.devices.map(d=>[d.id,d])),links=project.links.map((link,idx)=>({...link,idx}));return corePages(project,physicalInventory({devices,links}))[0];}
test('moving a peer above the chassis selects the facing exit without changing fixed anchors',()=>{
 const p=modularRoutingFixture();p.links=[{a:'chassis',ap:'C6',b:'stack5',bp:'1/49',media:'DAC'}];p.devices=p.devices.filter(d=>['chassis','stack5'].includes(d.id));
 let page=core(p),chassis=page.items.find(i=>i.sourceId==='chassis'&&i.kind==='switch'),peer=page.items.find(i=>i.sourceId==='stack5'&&i.kind==='switch');
 p.layout={drawingEdits:{[chassis.editKey]:{x:800,y:1200},[peer.editKey]:{x:800,y:200}}};page=core(p);
 const path=page.items.find(i=>i.type==='path');assert.equal(path.from.side,'top');assert.deepEqual(path.points[0],[path.from.x,path.from.y]);assert.deepEqual(path.points.at(-1),[path.to.x,path.to.y]);
 assert.ok(path.points.slice(1,-1).every(([,y])=>y<path.from.y),'The lead follows the moved peer above');
});

test('manual cable widths reach module clearance before geometry is planned',()=>{
 const p=modularRoutingFixture(),page=core(p),path=page.items.find(i=>i.type==='path'&&i.sourceLink.ap==='C6');
 p.layout={drawingEdits:{[path.editKey]:{weight:8}}};const next=core(p),line=next.items.find(i=>i.editKey===path.editKey);
 assert.equal(line.weight,8);assert.equal(line.from.weight,8);assert.equal(line.to.weight,8);
 const device=next.items.find(i=>i.sourceId==='chassis'&&i.kind==='switch');
 for(const region of device.panelRegions.filter(r=>r.id!=='C'))assert.ok(!crossesText(line.points,{x:device.x+region.x*device.w,y:device.y+region.y*device.h,w:region.w*device.w,h:region.h*device.h},3.99));
});
