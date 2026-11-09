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
 switchport trunk allowed vlan except 10,20
 switchport trunk allowed vlan remove 30
 switchport trunk allowed vlan add 20
!
interface Gi1/0/2
 switchport trunk allowed vlan remove 10
 switchport trunk allowed vlan remove 20
 switchport trunk allowed vlan add 10
!
interface Gi1/0/3
 switchport trunk allowed vlan except 10
 switchport trunk allowed vlan 20,30
 switchport trunk allowed vlan remove 30
 switchport trunk allowed vlan add 40
!
interface Gi1/0/4
 switchport trunk allowed vlan add 10
!
`);
 assert.deepEqual(port(d,'Gi1/0/1').allowedExcept,[10,30]);
 assert.deepEqual(port(d,'Gi1/0/2').allowedExcept,[20]);
 assert.deepEqual(port(d,'Gi1/0/3').tagged,[20,40]);
 assert.equal(port(d,'Gi1/0/3').allowedExcept,undefined);
 assert.deepEqual(port(d,'Gi1/0/4').tagged,['all']);
 const inv=inventoryForDevice(d);
 assert.equal(inv.logicalInterfaces.find(p=>p.id==='Gi1/0/1').taggedVlanPolicy,'All except 10, 30');
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
