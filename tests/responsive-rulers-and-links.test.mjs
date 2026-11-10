import test from 'node:test';
import assert from 'node:assert/strict';
import {pageRulerTicks} from '../src/web/rulers.mjs';
import {relatedConnectionItems,nearestOnCable,positionOnCable} from '../src/web/connection-selection.mjs';
import {safeCoreMoveOffsets,cleanDrawingEdits,moveDrawingItems} from '../src/web/drawing-edits.mjs';
import {placeCableLabels} from '../src/web/diagram/labels.mjs';

const cable={
 type:'path',editKey:'Core Network|path|fictional',linkId:7,
 points:[[100,300],[600,300],[600,450]],
 sourceLink:{a:'lab-switch',ap:'1/50',b:'lab-peer',bp:'1/51'},
 from:{device:'switch',port:'1/50',x:100,y:300},
 to:{device:'peer',port:'1/51',x:600,y:450},
};
test('ruler marks use the physical page units at the current zoom',()=>{
 const ticks=pageRulerTicks(500,0,96,{minor:.25,major:1});
 assert.ok(ticks.length>15);
 assert.ok(ticks.some(t=>t.major&&Math.abs(t.at-96)<1e-7&&t.value===1));
 assert.ok(ticks.some(t=>!t.major&&Math.abs(t.at-24)<1e-7));
 const zoomed=pageRulerTicks(500,22,48,{minor:.25,major:1});
 assert.ok(zoomed.some(t=>t.major&&Math.abs(t.at-70)<1e-7));
 assert.deepEqual(pageRulerTicks(500,0,0),[]);
});
test('connection selection finds its cable, both ports and every associated label',()=>{
 const port={type:'text',editKey:'Core Network|port|fictional|0',labelRole:'port',linkId:7,relatedCableKey:cable.editKey,relatedPort:'1/50',value:'1/50'},
  media={type:'text',editKey:'Core Network|media|fictional|0',labelRole:'media',linkId:7,relatedCableKey:cable.editKey,value:'DAC'};
 const page={items:[cable,port,media]};
 for(const request of [{key:port.editKey},{key:media.editKey},{key:cable.editKey},{sourceId:'lab-switch',portName:'1/50'}]){
  const result=relatedConnectionItems(page,request);
  assert.deepEqual(result.paths,[cable]);
  assert.equal(result.labels.length,2);
  assert.equal(result.endpoints.length,2);
 }
 assert.equal(relatedConnectionItems(page,{sourceId:'lab-switch',portName:'1/49'}).paths.length,0);
});
test('snap positions follow actual orthogonal cable segments',()=>{
 const nearest=nearestOnCable(cable.points,{x:360,y:323});
 assert.deepEqual([nearest.x,nearest.y,nearest.angle],[360,300,0]);
 const second=nearestOnCable(cable.points,{x:616,y:400});
 assert.deepEqual([second.x,second.y,second.angle],[600,400,Math.PI/2]);
 const middle=positionOnCable(cable.points,.5);
 assert.ok(Math.abs(middle.x-425)<1e-7&&middle.y===300);
});
test('manual cable label remains pinned and keeps actual related cable identity',()=>{
 const key='Core Network|port|fictional',page={name:'Core Network',dynamic:true,width:1200,height:975,items:[{...cable}]},edits={[key+'|0']:{x:205,y:278}};
 const result=placeCableLabels(page,[{role:'port',editKey:key,endpoint:'a',value:'1/50',linkId:7,side:'right',outer:600,y:300}],edits);
 assert.equal(result.ok,true);
 const label=page.items.find(item=>item.editKey===key+'|0');
 assert.equal(label.x,205);assert.equal(label.y,278);
 assert.equal(label.relatedCableKey,cable.editKey);
 assert.equal(label.background,'#FFFFFF');
});
test('core device drag protects actual panel content, not its entire column',()=>{
 const page={legendLayout:'sidebar',sidebar:{divider:300},items:[{type:'device',kind:'switch',editKey:'switch',x:430,y:200,w:200,h:60},{type:'rect',panelGroup:true,x:38,y:147,w:276,h:130}]};
 const offsets=safeCoreMoveOffsets(page,new Map([['switch',[-300,20]]]));
 assert.deepEqual(offsets.get('switch'),[-110,20]);
 assert.deepEqual(safeCoreMoveOffsets(page,new Map([['switch',[50,20]]])).get('switch'),[50,20]);
});

test('snap position follows a changed cable path but manual dragging detaches the label from it',()=>{
 const key='Core Network|port|fraction',initial={name:'Core Network',dynamic:true,width:1200,height:975,items:[{...cable}]};
 const saved=cleanDrawingEdits({[key+'|0']:{cableFraction:.4,x:205,y:278}});
 const req={role:'port',editKey:key,endpoint:'a',value:'1/50',linkId:7,side:'right',outer:600,y:300};
 assert.equal(placeCableLabels(initial,[req],saved).ok,true);
 const label=initial.items.find(i=>i.editKey===key+'|0'),first=[label.x,label.y];
 const rerouted={name:'Core Network',dynamic:true,width:1200,height:975,items:[{...cable,points:[[100,400],[600,400],[600,550]]}]};
 assert.equal(placeCableLabels(rerouted,[req],saved).ok,true);
 const moved=rerouted.items.find(i=>i.editKey===key+'|0');
 assert.notDeepEqual([moved.x,moved.y],first,'snapped caption stays on its cable when the cable reroutes');
 const edits=moveDrawingItems(rerouted,saved,new Map([[moved.editKey,[15,0]]]));
 assert.equal(edits[moved.editKey].cableFraction,undefined,'explicit dragging takes over from automatic cable alignment');
});
