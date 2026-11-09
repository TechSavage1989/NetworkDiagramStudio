import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConfig} from '../src/web/imports/config.mjs';
import {inventoryForDevice,technicianSummary} from '../src/web/reports/model.mjs';

const parse=text=>parseConfig(text,'fictional.cfg').devices[0];
const port=(d,name)=>d.ports.find(p=>p.name===name);

test('browser management, mirror, SVI and configured speed evidence reaches reports without raw configuration',()=>{
 const d=parse(`! ArubaOS-CX
hostname LAB-CX
interface mgmt
 ip static 192.0.2.5/24
 ipv6 address 2001:db8::5/64
exit
ip default-gateway 192.0.2.1
monitor session 1 source interface 1/1/1 both
interface vlan 27
 ip address 192.0.2.27 255.255.255.0
exit
interface 1/1/1
 speed 1000
exit
snmp-server community do-not-retain
`);
 assert.ok(!d.ports.some(p=>p.name==='mgmt'));
 assert.deepEqual(d.management,['192.0.2.5/24','2001:db8::5/64','Default gateway: 192.0.2.1']);
 const inv=inventoryForDevice(d),summary=technicianSummary(inv);
 assert.deepEqual(inv.management,d.management);
 assert.deepEqual(inv.mirrors,['monitor session 1 source interface 1/1/1 both']);
 assert.deepEqual(inv.svis,[{interface:'vlan 27',address:'192.0.2.27/24'}]);
 assert.equal(inv.logicalInterfaces.find(p=>p.id==='1/1/1').speed,'1000');
 assert.match(summary,/MANAGEMENT/);assert.match(summary,/MIRRORS/);
 assert.ok(!JSON.stringify(d).includes('do-not-retain'));
});

test('IOS all-except add/remove and replacement policies preserve set semantics',()=>{
 const d=parse(`version 17
hostname LAB-IOS
vlan 10,20,30,40
!
interface Gi1/0/1
 switchport mode trunk
 switchport trunk allowed vlan except 10,20
 switchport trunk allowed vlan remove 30
 switchport trunk allowed vlan add 20
!
interface Gi1/0/2
 switchport mode trunk
 switchport trunk allowed vlan remove 10
 switchport trunk allowed vlan remove 20
 switchport trunk allowed vlan add 10
!
interface Gi1/0/3
 switchport mode trunk
 switchport trunk allowed vlan except 10
 switchport trunk allowed vlan 20,30
 switchport trunk allowed vlan remove 30
 switchport trunk allowed vlan add 40
!
interface Gi1/0/4
 switchport mode trunk
 switchport trunk allowed vlan add 10
!
`);
 assert.match(port(d,'Gi1/0/1').taggedVlanPolicy,/All except 10,30/);
 assert.match(port(d,'Gi1/0/2').taggedVlanPolicy,/All except 20/);
 assert.deepEqual(port(d,'Gi1/0/3').tagged,[20,40]);
 assert.equal(port(d,'Gi1/0/3').allowedExcept,undefined);
 assert.deepEqual(port(d,'Gi1/0/4').tagged,[10,20,30,40]);
 const inv=inventoryForDevice(d);
 assert.match(inv.logicalInterfaces.find(p=>p.id==='Gi1/0/1').taggedVlanPolicy,/All except 10,30/);
 assert.deepEqual(inv.logicalInterfaces.find(p=>p.id==='Gi1/0/1').taggedVlans,[20,40]);
});

test('tagged native VLAN is an explicit no-untagged state in report inventory',()=>{
 const d=parse(`! ArubaOS-CX
hostname LAB-TAGGED
interface 1/1/1
 vlan trunk native 27 tag
 vlan trunk allowed 27,57
exit
`);
 const inv=inventoryForDevice(d),p=inv.logicalInterfaces.find(p=>p.id==='1/1/1');
 assert.equal(p.untaggedVlan,null);assert.equal(p.untaggedState,'None');
 assert.deepEqual(p.taggedVlans,[27,57]);
});

test('report annotations preserve retained native evidence unless explicitly replaced',()=>{
 const device={name:'LAB-RETAINED',switchportInventory:{management:['Default gateway: 192.0.2.1'],mirrors:['mirror 1 port 24'],svis:[{interface:'vlan 27',address:'2001:db8::27/64'}]},vlans:[],ports:[]};
 let inv=inventoryForDevice(device);
 assert.deepEqual(inv.management,['Default gateway: 192.0.2.1']);assert.equal(inv.svis.length,1);
 device.vlans=[{id:27,ip:'192.0.2.27/24'}];
 device.management=[];device.mirrors=[];inv=inventoryForDevice(device);
 assert.deepEqual(inv.svis.map(row=>row.address),['2001:db8::27/64','192.0.2.27/24']);
 assert.deepEqual(inv.management,[]);assert.deepEqual(inv.mirrors,[]);
});

test('tagged-native annotation never overrides an explicit allowed VLAN exclusion',()=>{
 const d=parse(`! ArubaOS-CX
hostname LAB-EXCLUDED
interface 1/1/1
 vlan trunk native 27 tag
 vlan trunk allowed 57
exit
`);
 const p=inventoryForDevice(d).logicalInterfaces.find(p=>p.id==='1/1/1');
 assert.equal(p.untaggedVlan,null);assert.equal(p.untaggedState,'None');
 assert.deepEqual(p.taggedVlans,[57]);
});

test('differing browser SVI addresses retain native evidence with an explicit review notice',()=>{
 const device={name:'LAB-ADDRESS-REVIEW',switchportInventory:{svis:[{interface:'vlan 27',address:'192.0.2.1/24'},{interface:'vlan 27',address:'2001:db8::1/64'}]},vlans:[{id:27,ip:'192.0.2.2/24'}],ports:[]};
 const inv=inventoryForDevice(device);
 assert.deepEqual(inv.svis.map(row=>row.address),['192.0.2.1/24','2001:db8::1/64','192.0.2.2/24']);
 assert.equal(inv.assumptions.filter(note=>note.startsWith('SVI vlan 27:')).length,1);
 assert.match(technicianSummary(inv),/Both are retained; review primary, secondary and IPv6 addresses before use/);
 device.switchportInventory=inv;
 device.vlans[0].ip='192.0.2.1/24';
 const same=inventoryForDevice(device);
 assert.equal(same.svis.length,3);
 assert.ok(!same.assumptions.some(note=>note.startsWith('SVI vlan 27:')));
});

test('native source hydration preserves effective channel settings, aliases, topology and later manual edits',async()=>{
 const {enrichSwitchportSources}=await import('../src/web/switchport-import.mjs');
 const {readSources,ensureEvidence,composeEvidence,captureEdits}=await import('../src/web/evidence.mjs');
 const file=new File([`version 17
hostname LAB-AUTHORITY
interface GigabitEthernet1/0/1
 switchport mode access
 switchport access vlan 10
 channel-group 1 mode active
!
interface Port-channel1
 switchport mode access
 switchport access vlan 30
!
`],'fictional-channel.cfg');
 const sources=await readSources([file]),d=sources[0].model.devices[0],original=d.ports[0];
 original.name='GigabitEthernet1/0/1';original.ip='192.0.2.10/24';original.state='down';original.speed='Observed: 1 Gbps';original.media='Copper';original.allowedExcept=[30];original.nativeTagged=true;
 sources[0].model.links=[{a:d.id,ap:original.name,b:'lab-peer',bp:'1'}];
 const nativePort={name:'Gi1/0/1',description:'',role:'access',native:30,nativeState:'known',tagged:[],taggedVlanPolicy:null,voice:null,lag:'Po1',disabled:null,stackLink:false,notes:['Port-channel configuration applied from Po1.'],speed:'1000',relatedInterfaces:[]};
 const inventory={hostname:d.name,groups:[],ports:[{id:'Gi1/0/1',mode:'Access',untaggedVlan:30,untaggedState:'Known',taggedVlans:[],aggregate:'Po1',notes:nativePort.notes}],vlans:[{id:30,name:'Native data'}]};
 const priorReader=globalThis.FileReader,priorDesktop=globalThis.NDSDesktop;
 try{
  globalThis.FileReader=class{async readAsDataURL(input){this.result='data:text/plain;base64,'+Buffer.from(await input.arrayBuffer()).toString('base64');this.onload();}};
  globalThis.NDSDesktop={report:async()=>({items:[{id:'native',inventory,device:{name:d.name,ports:[nativePort],vlans:[{id:30,name:'Native data',voice:false},{id:40,name:'Voice',voice:true}]}}]})};
  await enrichSwitchportSources([file],sources);
 }finally{if(priorReader===undefined)delete globalThis.FileReader;else globalThis.FileReader=priorReader;if(priorDesktop===undefined)delete globalThis.NDSDesktop;else globalThis.NDSDesktop=priorDesktop;}
 assert.equal(original.native,30);assert.equal(original.name,'GigabitEthernet1/0/1');assert.equal(original.ip,'192.0.2.10/24');assert.equal(original.state,'down');assert.equal(original.speed,'Observed: 1 Gbps');assert.equal(original.media,'Copper');assert.equal(original.configuredSpeed,'1000');
 assert.equal(original.allowedExcept,undefined);assert.equal(original.nativeTagged,undefined);
 assert.equal(d.ports.length,2);assert.equal(sources[0].model.links[0].ap,original.name);
 assert.ok(d.vlans.some(v=>v.id===40&&v.voice));
 assert.equal(inventoryForDevice(d).ports[0].untaggedVlan,30);
 const project={devices:[],links:[],warnings:[]};ensureEvidence(project).sources=sources;
 const snapshot=composeEvidence(project);project.devices[0].ports[0].native=50;captureEdits(project,snapshot);
 composeEvidence(project);assert.equal(project.devices[0].ports[0].native,50);
 sources[0].enabled=false;composeEvidence(project);assert.equal(project.devices.length,0);
 sources[0].enabled=true;composeEvidence(project);assert.equal(project.devices[0].ports[0].native,50);
 assert.equal(sources[0].model.devices[0].ports[0].native,30);
});

test('native routes normalize while distinct explicit interfaces remain separate',async()=>{
 const {enrichSwitchportSources}=await import('../src/web/switchport-import.mjs');
 const priorReader=globalThis.FileReader,priorDesktop=globalThis.NDSDesktop;
 try{
  globalThis.FileReader=class{async readAsDataURL(input){this.result='data:text/plain;base64,'+Buffer.from(await input.arrayBuffer()).toString('base64');this.onload();}};
  const nativeText='0.0.0.0/0 192.0.2.254',nativeRoutes=[{destination:nativeText}];
  globalThis.NDSDesktop={report:async()=>({items:[{id:'native',inventory:{routes:[nativeText]},device:{name:'LAB-ROUTES',ports:[],routes:nativeRoutes}}]})};
  for(const populated of [false,true]){
   const d=parse('hostname LAB-ROUTES\n'),structured={destination:'0.0.0.0/0',nextHop:'192.0.2.254',interface:'Vlan27',type:'static'};
   if(populated)d.routes=[structured];
   const source={kind:'Configuration',model:{devices:[d],links:[],warnings:[]}};
   await enrichSwitchportSources([new File(['hostname LAB-ROUTES'],'fictional-route.cfg')],[source]);
   const normalized={type:'static',nextHop:'192.0.2.254',interface:'',destination:'0.0.0.0/0'};
   assert.deepEqual(d.routes,populated?[structured,normalized]:[normalized]);
   assert.deepEqual(source.model.warnings,[]);
  }
 }finally{if(priorReader===undefined)delete globalThis.FileReader;else globalThis.FileReader=priorReader;if(priorDesktop===undefined)delete globalThis.NDSDesktop;else globalThis.NDSDesktop=priorDesktop;}
});
