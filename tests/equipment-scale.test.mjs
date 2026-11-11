import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages as buildAllPages,exportVisio} from '../src/web/diagram/index.mjs';
import {withFaceplateMaps} from './fixtures/faceplate-maps.mjs';
const buildPages=withFaceplateMaps(buildAllPages);
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {physicalPorts,textLayout} from '../src/web/diagram/scene.mjs';
import {equipmentPadding} from '../src/web/diagram/equipment-layout.mjs';
import {unzip} from '../src/web/zip.mjs';

function fixture(){
 const stack=n=>({id:'stack'+n,name:'LAB-STACK-'+n,kind:'switch',model:'JL558A',stackMembers:Array.from({length:n},(_,i)=>({id:String(i+1),model:'JL558A'})),ports:Array.from({length:n*52},(_,i)=>({name:(Math.floor(i/52)+1)+'/'+(i%52+1),role:i%52<40?'access':'uplink',native:12,tagged:i%52>=40?[24,36]:[],description:i%52<40?'Office data':'Building uplink',state:'up'}))});
 const chassis={id:'chassis',name:'LAB-CHASSIS',kind:'switch',model:'J9850A',modules:[{slot:'A',model:'J9993A'},{slot:'B',model:'J9986A'}],ports:Array.from({length:8},(_,i)=>({name:'A'+(i+1),description:'Distribution uplink',native:12,tagged:[24,36]}))};
 return {name:'Hardware scale lab',devices:[chassis,stack(5),stack(8)],links:[]};
}
const maps=pages=>pages.filter(p=>p.portMap),bodies=pages=>pages.flatMap(p=>p.items.filter(i=>i.type==='device'&&i.kind==='switch'));
function validate(site,pages){
 const panels=bodies(maps(pages));assert.ok(panels.length>=site.devices.length);assert.equal(new Set(panels.map(p=>p.w)).size,1);
 for(const p of maps(pages)){
  const keys=p.items.map(i=>i.editKey);assert.equal(keys.length,new Set(keys).size);
  for(const i of p.items){if(i.type==='path')continue;assert.ok(i.x>=0&&i.x+i.w<=p.width+.01&&i.y>=0&&i.y+i.h<=p.height,'Item outside sheet: '+i.value);if(i.type==='text')assert.ok(textLayout(i).size>=8);}
  for(const panel of p.items.filter(i=>i.type==='device')){
   assert.ok(panel.y+panel.h<=p.height-55);const d=site.devices.find(d=>d.id===panel.sourceId),memberIds=[...panel.masterKey.matchAll(/:members:([^:]+)/g)].at(-1)?.[1].split(',');
   const view=memberIds?{...d,stackMembers:d.stackMembers.filter(m=>memberIds.includes(m.id)),stackContinuation:true}:d,ratio=deviceFaceplate(view,{padding:equipmentPadding}).ratio;
   assert.ok(Math.abs(panel.w/panel.h-ratio)<1e-8);
   for(const text of p.items.filter(i=>i.type==='text'&&!i.portNumberRole))assert.ok(text.x+text.w<=panel.x||text.x>=panel.x+panel.w||text.y+text.h<=panel.y+.01||text.y>=panel.y+panel.h-.01,'Text overlaps hardware: '+text.value);
  }
 }
 const actual=new Set(maps(pages).flatMap(p=>p.portMap.portRecords||p.portMap.rowNames.map(name=>({device:p.portMap.device,name}))).map(p=>p.device+'/'+p.name)),expected=new Set(site.devices.flatMap(d=>physicalPorts(d).map(p=>d.id+'/'+p.name)));assert.deepEqual(actual,expected);
}
test('port maps keep chassis and every stack member at one shared scale with complete local details',()=>{
 for(const portMap of [{},{density:'expanded'},{groupConsecutive:false},{repeatFaceplate:true}]){const site=fixture();site.layout={portMap};validate(site,buildPages(site));}
});
test('paper changes and reordering reorganize hardware without relative scale changes or lost ports',()=>{
 for(const preset of ['letter','a3'])for(const reverse of [false,true]){const site=fixture();if(reverse)site.devices.reverse();site.layout={pageSetup:{default:{preset}}};validate(site,buildPages(site));}
 const site=fixture(),small=buildPages({...site,layout:{pageSetup:{default:{preset:'letter'}}}}),large=buildPages({...site,layout:{pageSetup:{default:{preset:'a3'}}}});assert.ok(maps(large).filter(p=>p.portMap.overview).length<=maps(small).filter(p=>p.portMap.overview).length);
});
test('wireless pages keep whole dynamic stacks at a shared width with real endpoint ownership',async()=>{
 const site=fixture();site.devices=site.devices.filter(d=>d.id!=='chassis');site.devices.push({id:'single',name:'LAB-SINGLE',kind:'switch',model:'JL558A',ports:[{name:'1/41'}]});
 for(const [i,[id,port]] of [['stack5','1/41'],['stack5','5/41'],['stack8','8/41'],['single','1/41']].entries()){const ap={id:'ap'+i,name:'LAB-AP-'+i,kind:'ap',model:'AP-515',ports:[{name:'eth0'}]};site.devices.push(ap);site.links.push({a:id,ap:port,b:ap.id,bp:'eth0',media:'copper',speed:'1 Gbps'});}
 // An LLDP-only interface still belongs to its declared physical member.
 site.devices.find(d=>d.id==='stack5').ports=site.devices.find(d=>d.id==='stack5').ports.filter(p=>p.name!=='5/41');
 // Each switch is planned on its own sheet (its readable width); every panel
 // keeps its native ratio, members and real endpoint ownership.
 const pages=buildPages(site),wireless=pages.filter(p=>p.title==='Wireless Connections'),panels=bodies(wireless);assert.equal(panels.length,3);
 for(const panel of panels){const device=site.devices.find(d=>d.id===panel.sourceId),ratio=deviceFaceplate(device,{padding:equipmentPadding,memberGaps:panel.memberGaps}).ratio;assert.ok(Math.abs(panel.w/panel.h-ratio)<1e-8);assert.equal(new Set(panel.panelRegions?.map(r=>r.memberId).filter(Boolean)).size,device.stackMembers?.length||0);}
 for(const p of wireless)for(const cable of p.items.filter(i=>i.type==='path')){const panel=p.items.find(i=>i.key===cable.from.device);assert.ok(panel.ports[cable.from.port]);assert.ok(Math.abs(cable.points[0][0]-panel.x-panel.ports[cable.from.port][0]*panel.w)<1e-7);}
 const parts=await unzip(await exportVisio(site,pages).arrayBuffer());assert.ok(parts.has('visio/pages/page1.xml'));
});
test('continued panel edits survive serialization without leaking into another member range',()=>{
 const site=fixture(),before=buildPages(site),panel=bodies(maps(before)).find(p=>p.sourceId==='stack8');site.layout={drawingEdits:{[panel.editKey]:{name:'Edited stack section'}}};const pages=buildPages(JSON.parse(JSON.stringify(site))),matches=bodies(maps(pages)).filter(p=>p.name==='Edited stack section');assert.equal(matches.length,1);assert.equal(matches[0].editKey,panel.editKey);validate(site,pages);
});
