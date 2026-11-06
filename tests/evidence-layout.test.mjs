import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOperational,isOperational} from '../src/web/imports/operational.mjs';
import {ensureEvidence,composeEvidence,captureEdits,categories} from '../src/web/evidence.mjs';
import {orderedDevices,moveStep,moveDevice,cleanLayout} from '../src/web/layout.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {shapeTransform,transform,multiply,masterBounds,ellipseArc} from '../src/web/visio-art.mjs';
import {sampleSite} from '../src/web/sample.mjs';

test('operational capture keeps actual LLDP ports and interface observations without treating them as configuration',()=>{
 const text='LAB-SW# show interfaces status\nPort Name Status Vlan Duplex Speed Type\nGi1/0/1 Lab connected 10 a-full a-1000 10/100/1000BaseTX\nGi1/0/2 Other notconnect 10 auto auto 10/100/1000BaseTX\nLAB-SW# show lldp neighbors detail\nLocal Intf: Gi1/0/1\nPort id: eth0\nSystem Name: LAB-AP\nSystem Capabilities: WLAN Access Point\nManagement Address: 192.0.2.12\nLAB-SW# show interfaces transceiver Gi1/0/3\nInterface: Gi1/0/3\nType: 10GBASE-SR\n';
 assert.equal(isOperational(text),true);const m=parseOperational(text),d=m.devices[0];
 assert.equal(d.name,'LAB-SW');assert.equal(d.fromConfig,undefined);
 assert.equal(d.ports.find(p=>p.name==='Gi1/0/1').speed,'1000 Mbps');
 assert.equal(d.ports.find(p=>p.name==='Gi1/0/2').state,'down');
 assert.equal(d.ports.find(p=>p.name==='Gi1/0/3').media,'10GBASE-SR');
 assert.deepEqual(m.links.map(l=>[l.ap,l.bp]),[['Gi1/0/1','eth0']]);assert.equal(m.devices[1].kind,'ap');
 const fg=parseOperational('LAB-FW # diagnose hardware deviceinfo nic x3\nName: x3\nLink: up\nSpeed: 10000\nDescription: 10GBASE-SR transceiver');
 assert.equal(fg.devices[0].ports[0].speed,'10000 Mbps');assert.equal(fg.devices[0].ports[0].state,'up');
});
test('per-file categories can be reversed, observations can be retargeted, and manual fields survive',()=>{
 const p={devices:[{id:'s',name:'Switch',kind:'switch',fromConfig:true,ports:[{name:'p1',native:10}]}],links:[],warnings:[]};
 const e=ensureEvidence(p);e.sources.push({id:'one',name:'capture',enabled:true,kind:'Show commands',targetId:'s',targetName:'Switch',categories:[...categories],model:{devices:[{id:'local',name:'Local',kind:'unknown',ports:[{name:'p1',state:'up',speed:'10 Gbps'}]}],links:[],warnings:[]}});
 let baseline=composeEvidence(p);assert.equal(p.devices[0].ports[0].state,'up');
 p.devices[0].ports[0].description='Manual label';captureEdits(p,baseline);
 e.sources[0].enabled=false;baseline=composeEvidence(p);
 assert.deepEqual(p.devices[0].ports,[{name:'p1',native:10,description:'Manual label'}]);
 e.sources[0].enabled=true;e.sources[0].categories=['identity'];composeEvidence(p);assert.equal(p.devices[0].ports[0].speed,undefined);
 e.sources[0].categories=['ports'];composeEvidence(p);assert.equal(p.devices[0].ports[0].speed,'10 Gbps');
 const reopened=JSON.parse(JSON.stringify(p));composeEvidence(reopened);assert.equal(reopened.devices[0].ports[0].description,'Manual label');
});
test('disabling a source removes its peer and link even after scope changes',()=>{
 const p={devices:[],links:[],warnings:[]},e=ensureEvidence(p);
 e.sources.push({enabled:true,kind:'Auvik',categories:[...categories],model:{devices:[{id:'ap',name:'AP',kind:'ap',ports:[]}],links:[],warnings:[]}});
 const before=composeEvidence(p);p.devices[0].hidden=false;p.devices[0].scopeOverride=true;captureEdits(p,before);e.sources[0].enabled=false;composeEvidence(p);assert.deepEqual(p.devices,[]);
});
test('saved order controls all inventory pages and chosen core pages survive a round trip',async()=>{
 const p=sampleSite();moveStep(p,'sw-1',-1);assert.equal(orderedDevices(p)[0].id,'sw-1');moveDevice(p,'ap-0','edge');
 assert.ok(orderedDevices(p).findIndex(d=>d.id==='ap-0')<orderedDevices(p).findIndex(d=>d.id==='edge'));
 p.layout.corePages=[{id:'a',name:'Rack A',devices:['edge','sw-1']},{id:'b',name:'Rack B',devices:['sw-2','ap-0','ap-1','ap-2','ap-3']}];
 const reopened=JSON.parse(JSON.stringify(p));reopened.layout=cleanLayout(reopened.layout,reopened.devices.map(d=>d.id));
 const pages=buildPages(reopened);assert.ok(pages.find(p=>p.name==='Rack A'));assert.ok(pages.find(p=>p.name==='Rack B'));
 const rack=pages.find(p=>p.name==='Rack A'),names=rack.items.filter(i=>i.type==='device'&&i.kind!=='plug'&&i.kind!=='handoff').map(i=>i.name);
 assert.deepEqual(names,['SW-1','EDGE-01']);
 assert.ok(rack.items.some(i=>i.type==='path'&&i.name.includes('Rack B')));assert.ok((await exportVisio(p,pages).arrayBuffer()).byteLength>0);
});
test('core paths are orthogonal, stay outside unrelated chassis, and have no shared parallel segments',()=>{
 const site=sampleSite();site.layout={includeAPs:true};const pages=buildPages(site).filter(p=>p.title.startsWith('Core Network'));
 for(const page of pages){
  const paths=page.items.filter(i=>i.type==='path'),devices=page.items.filter(i=>i.type==='device'&&!['plug','handoff'].includes(i.kind)),segments=[];
  for(const path of paths)for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],horizontal=Math.abs(a[1]-b[1])<1e-6;
   assert.ok(horizontal||Math.abs(a[0]-b[0])<1e-6,'diagonal cable');
   const lo=Math.min(a[horizontal?0:1],b[horizontal?0:1]),hi=Math.max(a[horizontal?0:1],b[horizontal?0:1]),axis=a[horizontal?1:0];
   for(const s of segments)if(s.path!==path&&s.horizontal===horizontal&&Math.abs(s.axis-axis)<2.2)assert.ok(Math.min(s.hi,hi)-Math.max(s.lo,lo)<=0,'shared cable segment');
   segments.push({path,horizontal,axis,lo,hi});
   const hosts=[path.from.device,path.to.device,...page.items.filter(i=>i.host&&[path.from.device,path.to.device].includes(i.key)).map(i=>i.host.device)];
   for(const d of devices){if(hosts.includes(d.key))continue;const inside=horizontal?axis>d.y&&axis<d.y+d.h&&Math.min(hi,d.x+d.w)>Math.max(lo,d.x):axis>d.x&&axis<d.x+d.w&&Math.min(hi,d.y+d.h)>Math.max(lo,d.y);assert.equal(inside,false,'cable crosses another chassis');}
  }
 }
});
test('nested Visio rotation and mirroring transform artwork and jacks together',()=>{
 const parent=shapeTransform({Width:10,Height:2,PinX:8,PinY:4,LocPinX:5,LocPinY:1});
 assert.deepEqual(transform(parent,5,1),[8,4]);
 const child=shapeTransform({Width:2,Height:1,PinX:5,PinY:1,LocPinX:1,LocPinY:.5,Angle:Math.PI,FlipX:1});
 const point=transform(multiply(parent,child),1,.5);assert.ok(Math.abs(point[0]-8)<1e-9&&Math.abs(point[1]-4)<1e-9);
});
test('one-dimensional manufacturer wrappers use the visible child bounds',()=>{
 const node=(localName,attributes={},children=[])=>({localName,children,getAttribute:k=>attributes[k]??null});
 const cells=values=>Object.entries(values).map(([N,V])=>node('Cell',{N,V:String(V)}));
 const picture=node('Shape',{},[...cells({Width:19,Height:1.73,PinX:9.5,PinY:-.865,LocPinX:9.5,LocPinY:.865}),node('ForeignData')]);
 const root=node('Shape',{},[...cells({Width:19,Height:.001}),node('Shapes',{},[picture])]);
 assert.deepEqual(masterBounds(root),{x:0,y:-1.73,w:19,h:1.73});
});
test('elliptical arc uses its real on-curve control point and aspect ratio',()=>{
 const arc=ellipseArc([2,0],[Math.SQRT2,Math.SQRT1_2],[0,1],0,2);
 assert.ok(Math.abs(arc[0])<1e-12&&Math.abs(arc[1])<1e-12);
 assert.ok(Math.abs(arc[2]-2)<1e-12&&Math.abs(arc[3]-1)<1e-12);assert.equal(arc[7],false);
 assert.equal(ellipseArc([2,0],[0,-1],[0,1],0,2)[7],true);
});
