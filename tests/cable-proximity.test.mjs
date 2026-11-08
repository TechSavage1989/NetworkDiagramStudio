import test from 'node:test';
import assert from 'node:assert/strict';
import {cableGeometry,closestCable,cablePickRadius} from '../src/web/cable-proximity.mjs';
import {bridge,svgPage} from '../src/web/diagram/scene.mjs';

const cable=(key,path,weight=2)=>({key,weight,geometry:cableGeometry(path)});
const matrix=scale=>({a:scale,b:0,c:0,d:scale,e:37,f:91});
const at=(x,y,m)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});

test('cable selection keeps a 12 screen-pixel allowance outside the painted edge at all zooms',()=>{
 assert.equal(cablePickRadius,12);
 for(const scale of [.15,.49,1,1.77,6])for(const weight of [.5,4,10]){
  const m=matrix(scale),line=cable('a','M 0 100 L 1000 100',weight),middle=at(500,100,m),edge=weight*scale/2;
  assert.equal(closestCable([line],{x:middle.x,y:middle.y+edge+11.9},m)?.key,'a');
  assert.equal(closestCable([line],{x:middle.x,y:middle.y+edge+12.1},m),null);
 }
});

test('adjacent parallel cables choose the nearest painted route, with stable paint-order ties',()=>{
 const lines=[cable('lower','M 0 100 L 400 100'),cable('upper','M 0 110 L 400 110')];
 for(const scale of [.25,1,2]){
  const m=matrix(scale);
  assert.equal(closestCable(lines,at(200,101,m),m)?.key,'lower');
  assert.equal(closestCable(lines,at(200,109,m),m)?.key,'upper');
  assert.equal(closestCable(lines,at(200,105,m),m)?.key,'upper');
  for(let n=0;n<10;n++)assert.equal(closestCable(lines,at(200,105,m),m)?.key,'upper');
 }
});

test('crossing hops are picked at their actual arc instead of an invisible straight chord',()=>{
 const m=matrix(1),lines=[cable('horizontal','M 0 50 L 100 50'),cable('hop','M 50 0 L 50 40 A 10 10 0 0 0 50 60 L 50 100')];
 assert.equal(closestCable(lines,at(50,50,m),m)?.key,'horizontal');
 assert.equal(closestCable(lines,at(40,50,m),m)?.key,'hop');
 assert.equal(closestCable(lines,at(42,44,m),m)?.key,'hop');
 assert.equal(closestCable([lines[1]],at(65,50,m),m),null);
});

test('screen-space picking respects translated, rotated and non-uniform matrices',()=>{
 const line=cable('line','M 0 0 L 300 0'),rotated={a:0,b:2,c:-2,d:0,e:400,f:100},stretched={a:2,b:0,c:0,d:.5,e:20,f:30};
 assert.equal(closestCable([line],{x:rotated.e+13.9,y:300},rotated)?.key,'line');
 assert.equal(closestCable([line],{x:rotated.e+14.1,y:300},rotated),null);
 assert.equal(closestCable([line],{x:220,y:43},stretched)?.key,'line');
 assert.equal(closestCable([line],{x:220,y:45},stretched),null);
 assert.equal(closestCable([line],{x:0,y:0},{a:0,b:0,c:0,d:0,e:0,f:0}),null);
});

test('invalid cable geometry does not create a broad or misleading target',()=>{
 for(const input of ['', 'M 0 0', 'M 0 0 L NaN 4', 'M 0 0 C 3 5 7 8 9 10', 'M 0 0 A 20 10 0 0 0 0 20'])assert.equal(cableGeometry(input),null,input);
 assert.equal(closestCable([cable('invalid','M 0 0 C 3 5 7 8 9 10')],{x:0,y:0},matrix(1)),null);
});

test('serialized SVG retains physical cable weights and hops without editor interaction geometry',()=>{
 const page={title:'Synthetic cable selection',items:[{type:'path',editKey:'first',name:'First',points:[[0,40],[100,40]],color:'#146374',weight:4},{type:'path',editKey:'second',name:'Second',points:[[50,0],[50,100]],color:'#354C83',weight:8}]};
 bridge(page);const before=JSON.stringify(page),svg=svgPage(page);
 assert.equal(JSON.stringify(page),before);
 assert.match(svg,/class="diagram-cable" data-drawing-key="first"[^>]+stroke-width="4"/);
 assert.match(svg,/class="diagram-cable" data-drawing-key="second"[^>]+stroke-width="8"/);
 assert.match(svg,/class="link-hop-clearance"/);
 assert.doesNotMatch(svg,/cable-hit-target|cable-proximity-halo|data-editor-only|vector-effect|stroke="transparent"/);
 const rendered=[...svg.matchAll(/class="diagram-cable"[^>]+d="([^"]+)"/g)];
 assert.equal(rendered.length,2);for(const match of rendered)assert.ok(cableGeometry(match[1]));
});
