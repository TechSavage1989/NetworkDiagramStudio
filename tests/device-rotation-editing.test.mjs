import test from 'node:test';import assert from 'node:assert/strict';
import {rotationProject} from './fixtures/device-rotation.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {drawingBounds,drawingObjects,moveDrawingItems} from '../src/web/drawing-edits.mjs';
import {transformEdits} from '../src/web/transform-controls.mjs';
import {devicePoint} from '../src/web/diagram/device-geometry.mjs';
import {ProjectHistory} from '../src/web/history.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('device rotation reopens with exact port glue and transformed editable SVG bounds',()=>{
 for(const degrees of [30,90,180,-45]){
  const p=rotationProject(),page=buildPages(p)[0],body=page.items.find(i=>i.type==='device'&&i.sourceId==='a');
  p.layout.drawingEdits=transformEdits(page,p.layout.drawingEdits,body,{angle:degrees*Math.PI/180});
  const rebuilt=buildPages(JSON.parse(JSON.stringify(p)))[0],device=rebuilt.items.find(i=>i.editKey===body.editKey),path=rebuilt.items.find(i=>i.type==='path'&&i.from?.device===device.key),pt=devicePoint(device,...device.ports.p1);assert.ok(path);
  close(path.points[0][0],pt[0]);close(path.points[0][1],pt[1]);assert.match(rebuilt.svg,new RegExp('rotate\\('+(-degrees)+' '));
  const b=drawingBounds(device);assert.ok(b.x>=rebuilt.originX&&b.y>=rebuilt.originY);assert.ok(b.x+b.w<=rebuilt.originX+rebuilt.width&&b.y+b.h<=rebuilt.originY+rebuilt.height);
 }
});
test('moving native text inside rotated hardware follows the pointer in world coordinates',()=>{
 const p=rotationProject();let page=buildPages(p)[0],body=page.items.find(i=>i.type==='device'&&i.sourceId==='a');p.layout.drawingEdits=transformEdits(page,p.layout.drawingEdits,body,{angle:Math.PI/2});page=buildPages(p)[0];
 const text=drawingObjects(page).find(i=>i.type==='arttext'&&i.parent.sourceId==='a'),before=drawingBounds(text);
 p.layout.drawingEdits=moveDrawingItems(page,p.layout.drawingEdits,new Map([[text.editKey,[25,-10]]]));const after=drawingBounds(drawingObjects(buildPages(p)[0]).find(i=>i.editKey===text.editKey));close(after.x-before.x,25);close(after.y-before.y,-10);
});
test('a device rotation is one reversible project edit',()=>{
 const p=rotationProject(),history=new ProjectHistory(p),page=buildPages(p)[0],body=page.items.find(i=>i.type==='device'&&i.sourceId==='a'),next=structuredClone(p);next.layout.drawingEdits=transformEdits(page,p.layout.drawingEdits,body,{angle:.5});history.record(next,'drawing');const undo=history.travel(next);assert.deepEqual(undo,p);const redo=history.travel(undo,{redo:true});assert.deepEqual(redo,next);
});
