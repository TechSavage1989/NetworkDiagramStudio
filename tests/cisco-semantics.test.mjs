import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConfig} from '../src/web/imports/config.mjs';
import {inventoryForDevice} from '../src/web/reports/model.mjs';
const parse=text=>parseConfig('version 17\nhostname LAB\n'+text,'lab.cfg').devices[0];
const p=(d,name='Gi1/0/1')=>d.ports.find(p=>p.name===name);
test('DTP and inactive allowed lists never invent static trunk membership',()=>{
 const d=parse('vlan 10,20\n!\ninterface Gi1/0/1\n switchport mode dynamic auto\n switchport trunk allowed vlan 10,20\n!');
 assert.deepEqual(p(d).tagged,[]);assert.equal(p(d).native,undefined);assert.match(p(d).role,/dynamic/);assert.ok(p(d).notes.some(n=>/inactive/.test(n)));
});
test('global native tagging and trunk voice policy follow configured allowed list',()=>{
 const d=parse('vlan dot1q tag native\nvlan 10,20,30\n!\ninterface Gi1/0/1\n switchport mode trunk\n switchport trunk native vlan 10\n switchport trunk allowed vlan 10,20\n switchport voice vlan 30\n!');
 assert.deepEqual(p(d).tagged,[10,20]);assert.equal(p(d).nativeState,'None');assert.equal(p(d).voice,undefined);
});
test('channel settings override member settings and routed members never inherit VLAN fills',()=>{
 const d=parse('vlan 10,20\n!\ninterface Port-channel1\n switchport mode trunk\n switchport trunk native vlan 20\n switchport trunk allowed vlan 10,20\n!\ninterface Gi1/0/1\n switchport mode access\n switchport access vlan 10\n channel-group 1 mode active\n!\ninterface Gi1/0/2\n no switchport\n channel-group 1 mode active\n!');
 assert.equal(p(d).native,20);assert.deepEqual(p(d).tagged,[10]);assert.equal(p(d,'Gi1/0/2').nativeState,'None');assert.deepEqual(p(d,'Gi1/0/2').tagged,[]);
 const inv=inventoryForDevice(d);const routed=inv.logicalInterfaces.find(p=>p.id==='Gi1/0/2');assert.equal(routed.untaggedState,'None');assert.deepEqual(routed.taggedVlans,[]);
});
test('missing aggregate and unsupported switching syntax remain report blockers',()=>{
 const d=parse('interface Gi1/0/1\n channel-group 7 mode active\n switchport private-vlan host-association 10 20\n!');
 assert.equal(d.reportBlockers.length,2);assert.ok(inventoryForDevice(d).blockers.some(b=>/port channel/.test(b)));
});
test('banner and certificate payload cannot fabricate interfaces or hardware',()=>{
 const d=parse('banner motd ^C\ninterface Gi1/0/99\n switchport access vlan 999\n^C\ncrypto pki certificate chain LAB\ninterface Gi1/0/98\n quit\ninterface Gi1/0/1\n switchport mode access\n!');
 assert.deepEqual(d.ports.map(p=>p.name),['Gi1/0/1']);assert.equal(p(d).native,1);
});
test('SVI address arrays and qualified routes survive report projection and edits',()=>{
 const d=parse('interface Vlan10\n ip address 192.0.2.1 255.255.255.0\n ip address 192.0.2.2 255.255.255.0 secondary\n ipv6 address 2001:db8::1/64\n!\nip route vrf LAB 0.0.0.0 0.0.0.0 192.0.2.254 200 tag 42\n');
 let inv=inventoryForDevice(d);assert.equal(inv.svis.length,3);assert.ok(inv.svis.some(s=>s.address.endsWith('secondary')));assert.match(inv.routes[0],/distance: 200/);assert.match(inv.routes[0],/vrf: LAB/);assert.match(inv.routes[0],/tag: 42/);
 d.switchportInventory=inv;d.vlans[0].addresses=['2001:db8::2/64'];inv=inventoryForDevice(d);assert.deepEqual(inv.svis,[{interface:'vlan 10',address:'2001:db8::2/64'}]);
});
test('source merge preserves otherwise identical routes with distinct selection qualifiers',async()=>{
 const {mergeModels}=await import('../src/web/imports/model.mjs');
 const a=parse('ip route 0.0.0.0 0.0.0.0 192.0.2.254 10 tag 1\n'),b=parse('ip route 0.0.0.0 0.0.0.0 192.0.2.254 20 tag 2\n');
 const merged=mergeModels([{devices:[a],links:[],warnings:[]},{devices:[b],links:[],warnings:[]}]);assert.equal(merged.devices[0].routes.length,2);
});
test('resolved unknown configuration clears stale retained native and voice assignments',()=>{
 const d=parse('interface Gi1/0/1\n switchport mode dynamic auto\n!');
 d.switchportInventory={logicalInterfaces:[{id:'Gi1/0/1',untaggedVlan:90,untaggedState:'Known',voiceVlan:91,taggedVlans:[92]}]};
 const inv=inventoryForDevice(d),port=inv.logicalInterfaces.find(p=>p.id==='Gi1/0/1');assert.equal(port.untaggedVlan,null);assert.equal(port.untaggedState,'Unknown');assert.equal(port.voiceVlan,null);assert.deepEqual(port.taggedVlans,[]);
});
