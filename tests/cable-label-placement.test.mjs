import test from 'node:test';
import assert from 'node:assert/strict';
import {labelPositionRelativeToCable,positionOnCable} from '../src/web/connection-selection.mjs';
import {cleanDrawingEdits} from '../src/web/drawing-edits.mjs';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.001,actual+' should be '+expected);

test('horizontal links support above, on and below with enough rotated-label clearance',()=>{
 const point=positionOnCable([[0,100],[200,100]],.5);
 const above=labelPositionRelativeToCable(point,{placement:'above',width:80,height:20,rotation:0,gap:6});
 const on=labelPositionRelativeToCable(point,{placement:'on',width:80,height:20,rotation:0,gap:6});
 const below=labelPositionRelativeToCable(point,{placement:'below',width:80,height:20,rotation:0,gap:6});
 near(above.x,100);near(above.y,84);near(on.y,100);near(below.y,116);
 // A manually rotated wide label requires the full perpendicular footprint.
 const turned=labelPositionRelativeToCable(point,{placement:'above',width:80,height:20,rotation:Math.PI/2,gap:6});
 near(turned.y,54);
});

test('vertical links use the left and right side while retaining the line direction',()=>{
 const point=positionOnCable([[80,0],[80,200]],.5);
 const above=labelPositionRelativeToCable(point,{placement:'above',width:70,height:18,rotation:Math.PI/2,gap:6});
 const on=labelPositionRelativeToCable(point,{placement:'on',width:70,height:18,rotation:Math.PI/2});
 const below=labelPositionRelativeToCable(point,{placement:'below',width:70,height:18,rotation:Math.PI/2,gap:6});
 near(above.x,65);near(above.y,100);near(on.x,80);near(below.x,95);
});

test('saved label side persists and recalculates against a rerouted connection',()=>{
 const saved=cleanDrawingEdits({'Core Network|media|test|0':{cableFraction:.5,cableSide:'below',rotationMode:'auto'}});
 assert.equal(saved['Core Network|media|test|0'].cableSide,'below');
 const first=labelPositionRelativeToCable(positionOnCable([[0,10],[100,10]],.5),{placement:saved['Core Network|media|test|0'].cableSide,width:80,height:20});
 const rerouted=labelPositionRelativeToCable(positionOnCable([[0,10],[0,110]],.5),{placement:saved['Core Network|media|test|0'].cableSide,width:80,height:20,rotation:Math.PI/2});
 near(first.y,26);near(rerouted.x,16);
 assert.equal(cleanDrawingEdits({'invalid':{cableFraction:.5,cableSide:'outside'}}).invalid.cableSide,undefined);
});
