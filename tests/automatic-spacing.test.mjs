import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticDeviceGap} from '../src/web/compact-layout.mjs';

const device=(key,x=100,y=100)=>({type:'device',kind:'switch',key,sourceId:key,x,y,w:200,h:60});
function fixture(count,weight=4){
 const reference=device('reference'),moving=device('moving',500,500),paths=Array.from({length:count},(_,i)=>{
  const x=reference.x+10+i*4;return {type:'path',weight,from:{device:reference.key,port:'p'+i,x,y:120},to:{device:'ap'+i,port:'eth0',x,y:0},points:[[x,120],[x,50],[x,0]]};
 });return {page:{items:[reference,moving,...paths]},reference,moving};
}
test('automatic beside spacing ignores cables on an unrelated device side',()=>{
 const {page,reference,moving}=fixture(28);
 assert.ok(automaticDeviceGap(page,[moving,reference],'below')<=60);
 assert.equal(automaticDeviceGap(page,[moving,reference],'right'),32);
 assert.ok(automaticDeviceGap(page,[moving,reference],'above')>190,'A genuinely occupied bank retains room for its painted cables');
});
test('automatic occupied-side clearance grows with actual cable thickness',()=>{
 const thin=fixture(8,4),thick=fixture(8,12);
 assert.ok(automaticDeviceGap(thick.page,[thick.moving,thick.reference],'above')>automaticDeviceGap(thin.page,[thin.moving,thin.reference],'above'));
 assert.equal(automaticDeviceGap(thick.page,[thick.moving,thick.reference],'right'),automaticDeviceGap(thin.page,[thin.moving,thin.reference],'right'));
});
