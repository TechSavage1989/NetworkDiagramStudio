import test from 'node:test';
import assert from 'node:assert/strict';
import {arrangeBoxesAtGap} from '../src/web/arrange.mjs';

const boxes=[
 {key:'existing-a',x:100,y:20,w:40,h:25},
 {key:'existing-b',x:175,y:40,w:25,h:30},
 {key:'existing-c',x:260,y:80,w:50,h:20}
];
test('an exact horizontal gap applies to already positioned selected objects',()=>{
 const shifts=arrangeBoxesAtGap(boxes,'x',20);
 assert.deepEqual(shifts.get('existing-a'),[0,0]);
 assert.deepEqual(shifts.get('existing-b'),[-15,0]);
 assert.deepEqual(shifts.get('existing-c'),[-55,0]);
 const next=boxes.map(box=>({...box,x:box.x+shifts.get(box.key)[0],y:box.y+shifts.get(box.key)[1]}));
 assert.equal(next[1].x-next[0].x-next[0].w,20);
 assert.equal(next[2].x-next[1].x-next[1].w,20);
 assert.deepEqual(next.map(b=>b.y),boxes.map(b=>b.y));
});
test('an exact vertical gap anchors first existing item and leaves other positions on x',()=>{
 const shifts=arrangeBoxesAtGap(boxes,'y',12);
 assert.deepEqual(shifts.get('existing-a'),[0,0]);
 const next=boxes.map(b=>({...b,y:b.y+shifts.get(b.key)[1]}));
 assert.equal(next[1].y-(next[0].y+next[0].h),12);
 assert.equal(next[2].y-(next[1].y+next[1].h),12);
 assert.deepEqual(next.map(b=>b.x),boxes.map(b=>b.x));
});
test('spacing requires a valid selection, direction and nonnegative gap',()=>{
 assert.throws(()=>arrangeBoxesAtGap(boxes.slice(0,1),'x',24),/two/);
 assert.throws(()=>arrangeBoxesAtGap(boxes,'z',24),/horizontal/);
 assert.throws(()=>arrangeBoxesAtGap(boxes,'x',-1),/0 to 2000/);
});
