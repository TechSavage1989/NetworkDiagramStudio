import test from 'node:test';import assert from 'node:assert/strict';
import {ProjectHistory,changesBetween,applyChanges} from '../src/web/history.mjs';
import {cleanSnap,snapPoint,snapBoxes,boxSelected} from '../src/web/snapping.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {moveCablePoint,validCable} from '../src/web/cable-edit.mjs';
test('project undo/redo includes endpoint and text edits, and Undo all retains redo order',()=>{
 const initial=sampleSite(),history=new ProjectHistory(initial),state=structuredClone(initial);state.layout={drawingEdits:{title:{value:'New title'}}};history.record(state,'drawing');
 state.links[0].bp='1/1/26';history.record(state,'connection');state.devices[0].name='EDGE-RENAMED';history.record(state,'device');
 const one=history.travel(state);assert.equal(one.devices[0].name,'EDGE-01');assert.equal(one.links[0].bp,'1/1/26');assert.equal(state.devices[0].name,'EDGE-RENAMED');
 const original=history.travel(one,{all:true});assert.deepEqual(original,initial);assert.equal(history.future.length,3);
 let restored=history.travel(original,{redo:true});assert.equal(restored.layout.drawingEdits.title.value,'New title');assert.equal(restored.links[0].bp,'1/1/25');restored=history.travel(restored,{redo:true});assert.equal(restored.links[0].bp,'1/1/26');restored=history.travel(restored,{redo:true});assert.equal(restored.devices[0].name,'EDGE-RENAMED');
 const p=buildPages(restored);assert.ok(p[0].items.some(i=>i.type==='path'&&i.sourceLink.bp==='1/1/26'));
});
test('history handles added/deleted objects and array lengths without retaining repeated image snapshots',()=>{
 const image='data:image/png;base64,'+'a'.repeat(200000),before={stencils:{a:{dataUrl:image,anchors:{p:[.1,.2]}}},links:[]},after=structuredClone(before);after.stencils.a.anchors.p=[.2,.3];after.links.push({a:'a',b:'b'});const changes=changesBetween(before,after);
 assert.ok(!JSON.stringify(changes).includes(image));assert.deepEqual(applyChanges(before,changes,true),after);assert.deepEqual(applyChanges(after,changes,false),before);
 const deleted={stencils:{},links:[]},delta=changesBetween(before,deleted);assert.deepEqual(applyChanges(before,delta,true),deleted);assert.deepEqual(applyChanges(deleted,delta),before);
 assert.throws(()=>applyChanges({},[{path:['__proto__','x'],after:1,hasAfter:true}],true),/Invalid/);
});
test('history validation is atomic, a new edit clears redo, and scoped port Undo all stops at its boundary',()=>{
 let state={x:0},history=new ProjectHistory(state);state={x:1};history.record(state,'diagram');state={x:2};history.record(state,'ports:a');state={x:3};history.record(state,'ports:a');
 assert.throws(()=>history.travel(state,{validate(){throw Error('collision');}}),/collision/);assert.equal(history.past.length,3);assert.equal(history.future.length,0);
 const boundary=history.travel(state,{all:true,scope:'ports:a'});assert.equal(boundary.x,1);assert.ok(!history.canUndo('ports:a'));assert.ok(history.canRedo('ports:a'));
 history.record({x:9});assert.equal(history.future.length,0);history.reset({x:9});assert.ok(!history.canUndo());
});
test('snapping can be disabled, configured or bypassed and aligns bend coordinates to nearby guides',()=>{
 const settings={enabled:true,grid:true,gridSize:10,guides:true,distance:5},targets=[{axis:0,value:24},{axis:1,value:100}];
 assert.deepEqual(snapPoint([23,48],settings,targets).point,[24,50]);assert.deepEqual(snapPoint([23,48],{...settings,enabled:false},targets).point,[23,48]);assert.deepEqual(snapPoint([23,48],settings,targets,true).point,[23,48]);
 const boxes=[{x:21,y:31,w:20,h:10},{x:80,y:70,w:15,h:30}],next=snapBoxes(boxes,[2,3],settings,[{axis:0,value:120}]);assert.deepEqual(next.delta,[-1,-1]);
 const aligned=snapBoxes([{x:10,y:20,w:40,h:20}],[16,2],{enabled:true,guides:true,distance:5},[{axis:0,value:66}]);assert.equal(aligned.delta[0],16);assert.equal(aligned.guides.length,1);
 const layout=cleanLayout({snapping:settings},[]);assert.equal(layout.snapping.gridSize,10);assert.equal(layout.snapping.enabled,true);assert.equal(cleanSnap().enabled,false);
 assert.equal(cleanSnap(null).enabled,false);const cable=[[0,0],[0,41],[84,41],[84,100]],point=snapPoint([17,44],settings).point,moved=moveCablePoint(cable,1,...point);assert.ok(validCable(moved));assert.deepEqual(moved[0],cable[0]);assert.deepEqual(moved.at(-1),cable.at(-1));
});
test('diagram box selection is independent of drag direction and includes only enclosed item bounds',()=>{
 const objects=[{key:'device',x:10,y:10,w:100,h:30},{key:'title',x:10,y:1,w:80,h:9},{key:'cable',x:50,y:40,w:0,h:40},{key:'outside',x:120,y:20,w:30,h:40}];
 assert.deepEqual(boxSelected(objects,[115,85],[0,0]),['device','title','cable']);assert.deepEqual(boxSelected(objects,[9,9],[111,41]),['device']);
});
test('undo and redo correctly identify the last saved project revision',()=>{
 const history=new ProjectHistory({x:0});history.record({x:1});assert.ok(history.dirty);history.markSaved();assert.ok(!history.dirty);const old=history.travel({x:1});assert.ok(history.dirty);history.travel(old,{redo:true});assert.ok(!history.dirty);history.record({x:2});history.travel({x:2},{all:true});assert.ok(history.dirty);history.reset({x:0});assert.ok(!history.dirty);
});
