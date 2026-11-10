import test from 'node:test';
import assert from 'node:assert/strict';
import {readableDeviceLabels} from '../src/web/device-paper-labels.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';
const fixture=()=>({name:'Core Network',width:1056,height:816,items:[{type:'device',sourceId:'a',x:320,y:320,w:300,h:120,children:[]},{type:'text',titleOwner:'a',editKey:'Core Network|title|a',value:'SAMPLE-MDF-SWITCH',x:320,y:310,w:90,h:9,size:5,bold:true},{type:'text',titleOwner:'a',titleSlot:'detail',editKey:'Core Network|detail|a',value:'Example model | 192.0.2.12',x:320,y:445,w:120,h:8,size:4},{type:'path',points:[[620,380],[750,380],[750,700]],weight:3}]});
test('automatic device names and details meet physical target without changing hardware or paths',()=>{
 for(const unit of [1,2,.8]){const p=fixture();for(const i of p.items){for(const k of ['x','y','w','h','size','weight'])if(Number.isFinite(i[k]))i[k]*=unit;if(i.points)i.points=i.points.map(p=>p.map(n=>n*unit));}p.width*=unit;p.height*=unit;
 const geometry=JSON.stringify(p.items.filter(i=>i.type!=='text'));readableDeviceLabels(p,{layout:{}},unit);
 assert.equal(JSON.stringify(p.items.filter(i=>i.type!=='text')),geometry);
 const labels=p.items.filter(i=>i.titleOwner);assert.equal(labels.length,2);
 for(const i of labels){assert.ok(textLayout(i).size/unit*.75>=8-1e-6);assert.ok(!intersects(i,p.items[0],1));assert.ok(!pathCrossesText(p.items.at(-1),i));}assert.ok(!intersects(...labels));}
});
test('explicit caption geometry and size remain authoritative',()=>{const p=fixture(),before=structuredClone(p.items);readableDeviceLabels(p,{layout:{drawingEdits:{'Core Network|title|a':{x:320},'Core Network|detail|a':{size:4}}}});assert.deepEqual(p.items,before);});
test('crowded page reports unmet label target without hiding it or overlapping',()=>{const p=fixture();p.items.push({type:'device',sourceId:'block',x:0,y:0,w:p.width,h:p.height,children:[]});const before=structuredClone(p.items);readableDeviceLabels(p,{layout:{}});assert.deepEqual(p.items,before);assert.ok(p.deviceLabelReadability.every(r=>!r.improved&&r.actualPt<r.targetPt));});
test('zero configured minimum and explicit preserve fitting retain old label geometry',async()=>{const p=fixture(),before=structuredClone(p);readableDeviceLabels(p,{layout:{presentation:{defaults:{minimumTextPt:0}}}});assert.deepEqual(p,before);});
test('Letter and A4 dense hardware pages keep automatic name/model captions readable across reopen',async()=>{
 const {sampleSite}=await import('../src/web/sample.mjs'),{buildPages}=await import('../src/web/diagram/index.mjs'),{printGeometry}=await import('../src/web/page-options.mjs');
 for(const preset of ['letter','a4'])for(const locked of [true,false]){
  const p=sampleSite();for(const [id,count] of [['sw-1',5],['sw-2',8]]){const d=p.devices.find(d=>d.id===id);d.model='JL558A';d.stackMembers=Array.from({length:count},(_,i)=>({id:String(i+1),model:'JL558A'}));}
  p.layout={pageSetup:{visible:{default:{preset,locked}}}};
  const first=buildPages(p)[0],labels=first.items.filter(i=>i.titleOwner);assert.equal(labels.length,6);
  for(const i of labels){assert.ok(textLayout(i).size*.75*printGeometry(first).width/first.width>=7.999);assert.ok(!first.items.some(d=>d.type==='device'&&intersects(d,i,-1e-5)));assert.ok(!first.items.some(d=>d.type==='path'&&pathCrossesText(d,i,0)));}
  p.layout.pageSetup.visible[locked?'lockFrames':'editFrames']={[first.name]:first.presentationFrame};
  const after=buildPages(JSON.parse(JSON.stringify(p)))[0];assert.deepEqual(after.items.filter(i=>i.titleOwner),labels);
 }
});
test('an authored device transform retains its attached caption geometry',()=>{const p=fixture();p.items[0].editKey='Core Network|device|a';const before=structuredClone(p.items);readableDeviceLabels(p,{layout:{drawingEdits:{'Core Network|device|a':{x:320,w:300}}}});assert.deepEqual(p.items,before);});
test('grown captions reserve later labels even when those already meet the minimum',()=>{
 const p=fixture();const detail=p.items.find(i=>i.titleSlot==='detail');Object.assign(detail,{x:320,y:300,w:200,h:13,size:10.6666667});
 readableDeviceLabels(p,{layout:{}});const labels=p.items.filter(i=>i.titleOwner);assert.ok(!intersects(labels[0],labels[1]));assert.equal(detail.x,320);assert.equal(detail.y,300);
});
test('automatic captions honor a full top dock but can use empty space beneath a side panel',()=>{
 const p=fixture();p.items[0].y=220;p.items[1].y=210;p.items[2].y=345;p.items.push({type:'text',panelGroup:true,x:20,y:100,w:100,h:120,size:12,value:'Panel'});
 readableDeviceLabels(p,{layout:{presentation:{defaults:{panel:{position:'top'}}}}});
 assert.ok(p.items.filter(i=>i.titleOwner).every(i=>i.y>220));
 const side=fixture();side.items.push({type:'text',panelGroup:true,x:0,y:0,w:500,h:100,size:12,value:'Short side panel'});readableDeviceLabels(side,{layout:{presentation:{defaults:{panel:{position:'left'}}}}});
 assert.ok(side.items.filter(i=>i.titleOwner).every(i=>textLayout(i).size*.75>=7.99));
});
