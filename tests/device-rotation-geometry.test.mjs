import test from 'node:test';
import assert from 'node:assert/strict';
import {devicePoint,deviceLocalDelta,deviceBounds,deviceRegionBounds,routingDevice} from '../src/web/diagram/device-geometry.mjs';
import {getAnchor} from '../src/web/diagram/scene.mjs';
import {coreRoutes,endpointLead} from '../src/web/diagram/routing.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const body=(key,x,y,angle=0)=>({key,sourceId:key,kind:'switch',x,y,w:200,h:80,angle,ports:{'1':[.25,.4]},children:[]});
const orthogonal=points=>points.slice(1).forEach((b,i)=>assert.ok(b[0]===points[i][0]||b[1]===points[i][1]));
test('rotation retains local geometry, center, known socket identity and inverse deltas',()=>{
 for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI,.37,-1.1]){
  const g=body('a',-50,100,angle),copy=structuredClone(g),point=devicePoint(g,.25,.4),anchor=getAnchor(g,'1','top',0),bounds=deviceBounds(g);
  close(anchor.x,point[0]);close(anchor.y,point[1]);assert.equal(anchor.port,'1');assert.deepEqual(g,copy);
  const [dx,dy]=deviceLocalDelta(g,point[0]-(g.x+g.w/2),point[1]-(g.y+g.h/2));close(dx,-50);close(dy,-8);
  assert.ok(point[0]>=bounds.x&&point[0]<=bounds.x+bounds.w&&point[1]>=bounds.y&&point[1]<=bounds.y+bounds.h);
  assert.deepEqual(deviceRegionBounds(g),bounds);
 }
 const g=body('a',0,0,Math.PI/2);close(deviceBounds(g).w,80);close(deviceBounds(g).h,200);
});
test('arbitrary rotated physical sockets preserve orthogonal full routes and unrelated body clearance',()=>{
 for(const angle of [.37,Math.PI/2,-1.1,Math.PI]){
  const a=body('a',400,100,angle),b=body('b',500,650,-angle),obstacle=body('other',455,350,angle),nodes=new Map([a,b,obstacle].map(n=>[n.key,n])),e={idx:0,a:'a',b:'b'},endData=new Map(),banks=new Map();
  for(const [node,which,side] of [[a,'a','bottom'],[b,'b','top']]){const anchor=getAnchor(node,'1',side,0),v={e,id:node.key,which,node,anchor,info:{}};endData.set('0/'+which,v);banks.set(node.key+'/'+side,[v]);orthogonal(endpointLead({anchor,ay:anchor.edge+(side==='top'?-50:50),exitX:anchor.departure.at(-1)[0]}));}
  const result=coreRoutes([e],[],endData,banks,nodes,{left:350,right:750,minX:-500,maxX:1500});assert.equal(result.cost[0],0);const points=result.routes[0].points;orthogonal(points);assert.deepEqual(points[0],devicePoint(a,...a.ports['1']));assert.deepEqual(points.at(-1),devicePoint(b,...b.ports['1']));assert.equal(a.angle,angle);assert.notEqual(routingDevice(a),a);
 }
});
test('rotated departures avoid other occupied module bounds or explicitly reject capacity',()=>{
 const g=body('module',100,200,.2);g.h=240;g.ports['1']=[.3,.85];g.panelRegions=[{x:0,y:0,w:1,h:.3},{x:0,y:.65,w:1,h:.35}];
 const a=getAnchor(g,'1','top',0);orthogonal(endpointLead({anchor:a,ay:a.edge-50,exitX:a.departure.at(-1)[0]}));
 const blocker=deviceRegionBounds(g,g.panelRegions[0]);for(const p of a.departure)assert.ok(!(p[0]>blocker.x&&p[0]<blocker.x+blocker.w&&p[1]>blocker.y&&p[1]<blocker.y+blocker.h));
});
test('unknown rotated ports remain explicitly named boundary attachments',()=>{
 const g=body('a',0,0,.5),anchor=getAnchor(g,'not-mapped','top',3);assert.equal(anchor.port,'uplink.3');assert.deepEqual([anchor.x,anchor.y],devicePoint(g,...g.ports[anchor.port]));assert.equal(g.ports['not-mapped'],undefined);
});

test('reopened rotated body overlaps reject before route generation',()=>{
 const a=body('a',0,0,Math.PI/2),b=body('b',50,75),nodes=new Map([['a',a],['b',b]]);
 assert.throws(()=>coreRoutes([],[],new Map(),new Map(),nodes,{left:0,right:300}),error=>error.code==='CORE_LAYOUT_CAPACITY'&&/overlaps/.test(error.message));
});
