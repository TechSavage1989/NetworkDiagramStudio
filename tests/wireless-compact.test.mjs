import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {addDevice,textLayout} from '../src/web/diagram/scene.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {equipmentGapPlan,equipmentPadding} from '../src/web/diagram/equipment-layout.mjs';
import {crossesText,intersects,pathCrossesText,textFootprint} from '../src/web/diagram/labels.mjs';
import {sampleSite} from '../src/web/sample.mjs';

function wirelessLab(members,count=28,center=false,preset='dynamic'){
 const ports=Array.from({length:count},(_,i)=>({name:(center?3:i%members+1)+'/'+(center?i+1:Math.floor(i/members)*2+1)})),sw={id:'sw',name:'LAB-STACK-'+members,kind:'switch',model:'JL558A',stackMembers:Array.from({length:members},(_,i)=>({id:String(i+1),model:'JL558A'})),ports};
 const aps=ports.map((_,i)=>({id:'ap'+i,name:'LAB-AP-'+String(i+1).padStart(2,'0'),kind:'ap',model:'AP-515',ip:'192.0.2.'+(i+1),ports:[{name:'eth0'}]}));
 return {name:'Compact wireless lab',devices:[sw,...aps],links:ports.map((p,i)=>({a:'sw',ap:p.name,b:'ap'+i,bp:'eth0',media:'copper',speed:'1 Gbps'})),layout:{pageSetup:{overrides:{wireless:{preset}}}}};
}
const wireless=project=>buildPages(project).filter(p=>p.wirelessLayout);
const overlap=(a,b,c,d)=>Math.min(Math.max(a,b),Math.max(c,d))-Math.max(Math.min(a,b),Math.min(c,d));
function assertClear(page){
 const bodies=page.items.filter(i=>i.type==='device'),paths=page.items.filter(i=>i.type==='path'),captions=page.items.filter(i=>i.wirelessCaption),lines=[];
 assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);
 for(const [i,body] of bodies.entries())for(const other of bodies.slice(i+1))assert.ok(!intersects(body,other,1),'hardware overlaps');
 for(const [i,text] of captions.entries()){
  assert.equal(textLayout(text).size,text.size);assert.ok(text.size>=8);
  assert.ok(!bodies.some(body=>intersects(text,body)),'caption overlaps hardware');
  assert.ok(!captions.slice(i+1).some(other=>intersects(text,other)),'captions overlap');
  assert.ok(!paths.some(path=>pathCrossesText(path,text,1)),'caption intersects cable');
 }
 for(const path of paths){
  for(const number of page.items.filter(i=>i.portNumberRole==='text'))assert.ok(!pathCrossesText(path,number,1),'cable crosses a port number');
  for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]]){const body=bodies.find(b=>b.key===anchor.device),port=body?.ports[anchor.port];assert.ok(port);assert.ok(Math.abs(point[0]-body.x-port[0]*body.w)<1e-6);assert.ok(Math.abs(point[1]-body.y-port[1]*body.h)<1e-6);}
  for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i];assert.ok(a[0]===b[0]||a[1]===b[1]);lines.push({path,a,b,h:a[1]===b[1]});}
  for(const body of bodies)for(const region of body.panelRegions||[]){const box={x:body.x+(region.x||0)*body.w,y:body.y+region.y*body.h,w:(region.w||1)*body.w,h:region.h*body.h};const inside=([x,y])=>x>=box.x&&x<=box.x+box.w&&y>=box.y&&y<=box.y+box.h;let first=0,last=path.points.length-1;if(body.key===path.from.device)while(first<last&&inside(path.points[first]))first++;if(body.key===path.to.device)while(last>first&&inside(path.points[last]))last--;assert.ok(!crossesText(path.points.slice(first,last+1),box,(path.weight||4)/2-.01),'cable crosses another member');}
 }
 for(const [i,a] of lines.entries())for(const b of lines.slice(i+1))if(a.path!==b.path&&a.h===b.h&&overlap(a.a[a.h?0:1],a.b[a.h?0:1],b.a[a.h?0:1],b.b[a.h?0:1])>.01)assert.ok(Math.abs(a.a[a.h?1:0]-b.a[a.h?1:0])>=(a.path.weight+b.path.weight)/2+.249,'painted parallel strokes touch');
}

test('five and eight member stacks retain every AP on one dynamic page with clear physical leads',()=>{
 for(const members of [5,8]){const site=wirelessLab(members),saved=JSON.stringify(site),pages=wireless(site);assert.equal(pages.length,1);const page=pages[0];assert.equal(page.items.filter(i=>i.type==='path').length,28);assert.equal(page.items.filter(i=>i.kind==='ap').length,28);assert.equal(page.wirelessLayout.memberIds.length,members);assert.equal(new Set(page.wirelessDeviceIds).size,29);assertClear(page);assert.equal(JSON.stringify(site),saved);assert.equal(wireless(JSON.parse(saved))[0].svg,page.svg);}
});
test('a busy middle member grows only its real adjacent gaps while every chassis keeps its scale',()=>{
 const site=wirelessLab(5,28,true),page=wireless(site)[0],body=page.items.find(i=>i.kind==='switch'),base=addDevice({items:[]},site,site.devices[0],[0,0,998,1],'probe',{fitWidth:true,padding:equipmentPadding});
 assert.equal(body.w,base.w);assert.deepEqual(Object.keys(body.memberGaps).sort(),['2/3','3/4']);assert.ok(body.memberGaps['2/3']>.035);assert.ok(body.memberGaps['3/4']>.035);
 for(const member of site.devices[0].stackMembers){const region=body.panelRegions.find(r=>r.memberId===member.id),single=deviceFaceplate({...site.devices[0],stackMembers:[member],stackContinuation:true},{padding:equipmentPadding});assert.ok(Math.abs(region.h*body.h-body.w/single.ratio)<1e-6);}
 assertClear(page);
});
test('fixed paper continues only measured wireless content and preserves every member and link',()=>{
 const site=wirelessLab(8,28,false,'original'),pages=wireless(site);assert.ok(pages.length>1&&pages.length<28);assert.equal(pages.flatMap(p=>p.items.filter(i=>i.type==='path')).length,28);assert.equal(new Set(pages.flatMap(p=>p.wirelessLayout.memberIds)).size,8);assert.equal(new Set(pages.map(p=>p.items.find(i=>i.kind==='switch').w)).size,1);
 for(const page of pages){assertClear(page);assert.equal(page.width,1200);assert.equal(page.height,975);for(const item of page.items.filter(i=>i.type!=='path'))assert.ok(item.x>=0&&item.y>=0&&item.x+item.w<=page.width+.01&&item.y+item.h<=page.height+.01,'fixed-paper content exceeds page');}
});
test('busy-gap geometry accounts for cable thickness and distinguishes native masters without changing defaults',()=>{
 const site=wirelessLab(5,28,true),device=site.devices[0],normal=equipmentGapPlan(site,device,site.links,998),thick=equipmentGapPlan(site,device,site.links,998,{weight:8}),a=addDevice({items:[]},site,device,[0,0,998,1],'a',{fitWidth:true,...normal}),b=addDevice({items:[]},site,device,[0,0,998,1],'b',{fitWidth:true,...thick});assert.ok(thick.memberGaps['2/3']>normal.memberGaps['2/3']);assert.equal(a.w,b.w);assert.notEqual(a.masterKey,b.masterKey);
 const empty=equipmentGapPlan(site,device,[],998),plain=addDevice({items:[]},site,device,[0,0,998,1],'a',{fitWidth:true,padding:equipmentPadding}),planned=addDevice({items:[]},site,device,[0,0,998,1],'a',{fitWidth:true,...empty});assert.equal(plain.h,planned.h);assert.deepEqual(plain.ports,planned.ports);assert.equal(plain.masterKey,planned.masterKey);
});
test('automatic AP captions follow edited equipment and retain explicit caption placement',()=>{
 const site=wirelessLab(5,4),before=wireless(site)[0],body=before.items.find(i=>i.kind==='ap'),captions=before.items.filter(i=>i.wirelessCaption&&i.sourceId===body.sourceId),model=captions.find(i=>i.deviceInfo==='model');site.layout.drawingEdits={[body.editKey]:{x:body.x+20},[model.editKey]:{x:model.x-7}};
 const page=wireless(JSON.parse(JSON.stringify(site)))[0],moved=page.items.find(i=>i.editKey===body.editKey);assert.equal(moved.x,body.x+20);for(const caption of captions){const after=page.items.find(i=>i.editKey===caption.editKey);assert.equal(after.x,caption.x+(caption===model?-7:20));assert.equal(after.ownerInstanceKey,body.instanceKey);assert.equal(after.deviceTextOwner,body.sourceId);}
});
test('legacy numbered wireless cable edits retain their key, stroke and bends after consolidation',()=>{
 const site=wirelessLab(5,4),before=wireless(site)[0],path=before.items.find(i=>i.type==='path'),legacy=path.editKey.replace('Wireless Connections|','Wireless Connections 5|'),points=path.points.map(p=>[...p]);
 site.layout.drawingEdits={[legacy]:{weight:5,color:'#815AC0',points}};const page=wireless(JSON.parse(JSON.stringify(site)))[0],after=page.items.find(i=>i.type==='path'&&i.sourceLink.b===path.sourceLink.b);assert.equal(after.editKey,legacy);assert.equal(after.weight,5);assert.equal(after.color,'#815AC0');assert.deepEqual(after.points.slice(2,-2),points.slice(2,-2));
 for(const [anchor,point] of [[after.from,after.points[0]],[after.to,after.points.at(-1)]]){assert.equal(point[0],anchor.x);assert.equal(point[1],anchor.y);}
});
test('legacy AP title edits remain readable when wireless sheets consolidate',()=>{
 const site=wirelessLab(5,4),ap=site.devices[1];let hash=0;for(const c of JSON.stringify([ap.name,undefined]))hash=Math.imul(hash,31)+c.charCodeAt(0)|0;const key='Wireless Connections 4|text|'+hash+'|0',value='LAB-AP-01 - '+Array.from({length:20},(_,i)=>'Area '+i).join(' ');site.layout.drawingEdits={[key]:{value,size:19,color:'#224466'}};
 const pages=wireless(JSON.parse(JSON.stringify(site)));assert.equal(pages.length,1);const title=pages[0].items.find(i=>i.editKey===key);assert.equal(title.value,value);assert.equal(title.size,19);assert.equal(title.color,'#224466');assert.equal(textLayout(title).size,19);assertClear(pages[0]);
});
test('mapped AP artwork retains the actual Ethernet anchor and its aspect ratio',()=>{
 const site=wirelessLab(5,1),ap=site.devices[1];ap.scale=1.5;ap.stencil={id:'lab-ap-front',name:'Synthetic AP front',width:100,height:120,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5F8AAAAASUVORK5CYII=',anchors:{eth0:[.3,1]}};
 const page=wireless(site)[0],body=page.items.find(i=>i.kind==='ap'),path=page.items.find(i=>i.type==='path');assert.equal(path.to.port,'eth0');assert.ok(Math.abs(body.w/body.h-100/120)<1e-8);assert.equal(path.to.x,body.x+body.w*.3);assert.equal(path.to.y,body.y+body.h);assertClear(page);
});
test('concise documentation omits an empty wireless sheet while explicit report choices retain it',()=>{
 const site={name:'Empty wireless lab',devices:[{id:'sw',name:'LAB-SWITCH',kind:'switch',model:'JL558A',ports:[]}],links:[]};assert.ok(!buildPages(site).some(p=>p.title==='Wireless Connections'));
 for(const layout of [{documentation:'full'},{pageSetup:{overrides:{wireless:{preset:'dynamic'}}}},{presentation:{pages:{'Wireless Connections':{name:'Wireless overview'}}}},{drawingEdits:{'Wireless Connections|text|saved|0':{value:'Saved note'}}}])assert.ok(buildPages({...site,layout}).some(p=>p.title==='Wireless Connections'));
});
test('small hardware and thick wireless leads retain clear, aligned numbers at the requested text scale',()=>{
 for(const [preset,scale,textScale] of [['dynamic',.35,1],['letter',1,1],['dynamic',1,1],['dynamic',.35,2.5]]){
  const site=sampleSite();site.layout={pageSetup:{overrides:{wireless:{preset,orientation:'portrait'}}},presentation:{defaults:{deviceScale:scale,textScale}}};
  const before=wireless(site),paths=before.flatMap(p=>p.items.filter(i=>i.type==='path'));site.layout.drawingEdits=Object.fromEntries(paths.map(path=>[path.editKey,{weight:8}]));
  const pages=wireless(site);assert.equal(pages.length,before.length);assert.equal(pages.flatMap(p=>p.items.filter(i=>i.type==='path')).length,paths.length);
  for(const page of pages){
   const body=page.items.find(i=>i.kind==='switch'),numbers=page.items.filter(i=>i.portNumberRole==='text');assert.equal(numbers.length,before.find(p=>p.wirelessLayout.deviceId===body.sourceId).items.filter(i=>i.portNumberRole==='text').length);
   for(const [index,number] of numbers.entries()){
    const box=textFootprint(number),anchor=body.ports[number.portName];assert.ok(Math.abs(box.x+box.w/2-body.x-anchor[0]*body.w)<1e-6);assert.ok(number.size>=8*textScale);assert.equal(textLayout(number).size,number.size);
    assert.ok(!numbers.slice(index+1).some(other=>intersects(box,textFootprint(other))),'scaled port numbers overlap');
    assert.ok(!page.items.some(path=>path.type==='path'&&pathCrossesText(path,number,1)),'thick cable crosses a scaled number');
   }
   if(textScale===1)assertClear(page);
  }
  if(textScale>1){const number=pages[0].items.find(i=>i.portNumberRole==='text');site.layout.drawingEdits[number.editKey]={size:17};const reopened=wireless(JSON.parse(JSON.stringify(site))).flatMap(p=>p.items).find(i=>i.editKey===number.editKey);assert.equal(reopened.size,17);}
 }
});
