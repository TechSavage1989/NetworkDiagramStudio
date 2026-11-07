import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionRows} from '../src/web/visio-connections.mjs';
import {connectionLayout,masterBounds} from '../src/web/visio-art.mjs';
const node=(localName,attributes={},children=[])=>({localName,children,getAttribute:k=>attributes[k]??null});
const cells=values=>Object.entries(values).map(([N,V])=>node('Cell',{N,V:String(V)}));
const row=(IX,values,attrs={})=>node('Row',{IX,...attrs},cells(values));
const shape=(values,rows=[],children=[])=>node('Shape',{},[...cells(values),node('Section',{N:'Connection'},rows),node('Shapes',{},children)]);
test('stencils retain unnamed sockets and useful prompts without inventing interface numbers',()=>{
 const s=shape({Width:10,Height:2},[row(0,{X:1,Y:1}),row(1,{X:2,Y:1,Prompt:'ethernet1/2'},{N:'Row_2'}),row(2,{X:3,Y:1},{N:'Management port'}),row(3,{X:9,Y:9},{Del:'1'})]);
 assert.deepEqual(connectionRows(s).map(p=>p.key),['Connection 1','ethernet1/2','Management port']);
 const layout=connectionLayout(s,masterBounds(s));assert.deepEqual({...layout.anchors},{'Connection 1':[.1,.5],'ethernet1/2':[.2,.5],'Management port':[.3,.5]});
});
test('nested rotated and mirrored sockets share the exact artwork transform',()=>{
 const child=shape({Width:2,Height:1,PinX:5,PinY:1,LocPinX:1,LocPinY:.5,Angle:Math.PI/2,FlipX:1},[row(0,{X:2,Y:.5},{N:'uplink'})]);
 const s=shape({Width:10,Height:2},[],[child]),p=connectionLayout(s,masterBounds(s)).anchors.uplink;assert.ok(Math.abs(p[0]-.5)<1e-10);assert.ok(Math.abs(p[1]-1)<1e-10);
});
test('zero-height wrappers and points outside the panel are retained without clipping or moving them',()=>{
 const picture=node('Shape',{},[...cells({Width:10,Height:2,PinX:5,PinY:-1,LocPinX:5,LocPinY:1}),node('ForeignData')]);
 const s=shape({Width:10,Height:0},[row(0,{X:2,Y:-1},{N:'port1'}),row(1,{X:11,Y:-1})],[picture]),result=connectionLayout(s,masterBounds(s));
 assert.deepEqual(result.bounds,{x:0,y:-2,w:11,h:2});assert.deepEqual(result.anchors.port1,[2/11,.5]);assert.deepEqual(result.anchors['Connection 2'],[1,.5]);
});
test('duplicate connection names stay distinct instead of averaging or selecting a wrong port',()=>{
 const s=shape({Width:10,Height:2},[row(0,{X:1,Y:1},{N:'port1'}),row(1,{X:9,Y:1},{N:'port1'})]),points=connectionLayout(s,masterBounds(s)).anchors;
 assert.equal(points.port1,undefined);assert.deepEqual(Object.values(points),[[.1,.5],[.9,.5]]);
});
test('missing cached coordinates fail visibly and manufacturer mappings retain remaining points',()=>{
 assert.throws(()=>connectionRows(shape({},[row(0,{X:1})])),/cached coordinates/);
 const s=shape({Width:20,Height:2},Array.from({length:60},(_,i)=>row(i,{X:i/3,Y:1}))),points=connectionLayout(s,masterBounds(s),'JL675A').anchors;
 assert.equal(Object.keys(points).length,60);assert.deepEqual(points['1/1/49'],[1/60,.5]);assert.deepEqual(points['1/1/1'],[.2,.5]);
});
