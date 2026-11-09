import test from 'node:test';
import assert from 'node:assert/strict';
import {parseComware,isComwareConfiguration} from '../src/web/imports/comware.mjs';
import {inventoryForDevice,validateInventory} from '../src/web/reports/model.mjs';
const base='version 7.1.070\nsysname Synthetic-Comware\n# member 1 model JG920A\n';
const parse=commands=>parseComware(base+commands,'synthetic.cfg').devices[0];
const port=(d,n)=>d.ports.find(p=>p.name==='Gi1/0/'+n);

test('Comware access, trunk PVID admission, hybrid undo and VLAN to lists match native semantics',()=>{
 const d=parse(`vlan 10 to 13,20\n name Example\n#\ninterface GigabitEthernet1/0/1\n port access vlan 10\n shutdown\n undo shutdown\n speed 1000\n#\ninterface GigabitEthernet1/0/2\n port link-type trunk\n port trunk pvid vlan 10\n port trunk permit vlan 10 to 13 20\n undo port trunk permit vlan 12\n#\ninterface GigabitEthernet1/0/3\n port link-type hybrid\n port hybrid pvid vlan 20\n port hybrid vlan 10 untagged\n port hybrid vlan 11 to 13 tagged\n undo port hybrid vlan 12 tagged\n undo port hybrid vlan 13\n voice-vlan 20 enable\n#\ninterface GigabitEthernet1/0/4\n port link-type trunk\n port trunk pvid vlan 10\n port trunk permit vlan 20\n`);
 assert.equal(port(d,1).native,10);assert.equal(port(d,1).admin,'up');assert.equal(port(d,1).configuredSpeed,'1000');
 assert.equal(port(d,2).native,10);assert.deepEqual(port(d,2).tagged,[11,13,20]);
 assert.equal(port(d,3).native,10);assert.equal(port(d,3).pvid,20);assert.deepEqual(port(d,3).tagged,[11]);assert.equal(port(d,3).voice,20);
 assert.equal(port(d,4).native,null);assert.equal(port(d,4).nativeState,'None');
 assert.equal(d.vlans.find(v=>v.id===13).name,'Example');
 const inv=inventoryForDevice(d);assert.equal(inv.ports.length,10);assert.equal(inv.ports[0].untaggedVlan,10);assert.equal(inv.ports[0].disabled,false);assert.equal(validateInventory(inv).ok,true);
 assert.match(d.hardwareSources[0].source,/hpe/);assert.ok(inv.groups[0].socketLayout.length);
});

test('Comware aggregate membership replaces shadow mode, voice and VLAN settings',()=>{
 const d=parse(`interface Bridge-Aggregation10\n description Synthetic uplink\n port link-type trunk\n port trunk pvid vlan 20\n port trunk permit vlan 20 30\n voice vlan 40 enable\n link-aggregation mode dynamic\n#\ninterface range GigabitEthernet1/0/1 to GigabitEthernet1/0/2\n port access vlan 99\n voice-vlan 90 enable\n port link-aggregation group 10\n`);
 for(const n of [1,2]){const p=port(d,n);assert.equal(p.role,'TRUNK');assert.equal(p.native,20);assert.deepEqual(p.tagged,[30]);assert.equal(p.voice,40);assert.equal(p.lag,'BAGG10');assert.equal(p.aggregationMode,'dynamic');assert.ok(p.notes.some(n=>n.includes('shadow')));assert.ok(p.notes.includes('Aggregate description: Synthetic uplink'));}
 assert.equal(d.reportBlockers.length,0);
 const inv=inventoryForDevice(d);assert.equal(inv.ports[1].aggregate,'BAGG10');assert.equal(inv.ports[1].mode,'TRUNK');
});

test('Comware IRF keeps exact member/socket identity and flags aggregate conflict',()=>{
 const d=parse(`# member 2 model JG920A\nirf member 1 priority 32\nirf member 2 priority 30\ninterface Bridge-Aggregation1\n port access vlan 10\n#\ninterface GigabitEthernet2/0/9\n port link-aggregation group 1\n#\nirf-port 2/1\n port group interface GigabitEthernet2/0/9\n`);
 assert.equal(d.switchportInventory.topology,'IRF');assert.equal(d.switchportInventory.groups[1].device,'2');assert.equal(d.switchportInventory.ports[18].id,'GigabitEthernet2/0/9');assert.ok(d.reportBlockers.some(b=>b.includes('both an IRF')));
 assert.equal(d.ports.find(p=>p.name==='Gi2/0/9').stackLink,true);
});

test('Comware all, exclusions, multiple untagged, unsupported undo and breakout fail closed',()=>{
 const d=parse(`interface GigabitEthernet1/0/1\n port link-type trunk\n port trunk pvid vlan 10\n port trunk permit vlan all\n undo port trunk permit vlan 20\n#\ninterface GigabitEthernet1/0/2\n port link-type hybrid\n port hybrid vlan 10 20 untagged\n#\ninterface GigabitEthernet1/0/3:1\n port access vlan 30\n#\ninterface GigabitEthernet1/0/4\n undo port access vlan\n#\nport-group manual test\n`);
 assert.equal(port(d,1).native,10);assert.equal(port(d,1).taggedVlanPolicy,'All');assert.equal(port(d,2).native,null);assert.equal(port(d,2).nativeState,'Unknown');assert.equal(d.ports.some(p=>p.name.includes(':')),false);
 for(const phrase of ['explicit exclusions','Multiple explicit untagged','breakout','Unrecognized Comware VLAN syntax','port-group'])assert.ok(d.reportBlockers.some(b=>b.includes(phrase)),phrase);
 assert.equal(validateInventory(inventoryForDevice(d)).ok,false);
});

test('Comware routed addresses, all SVI addresses, routes and omitted defaults remain explicit',()=>{
 const d=parse(`interface GigabitEthernet1/0/1\n description Routed test\n port link-mode route\n ip address 192.0.2.1 255.255.255.0\n ipv6 address 2001:db8::1/64\n#\ninterface Vlan-interface10\n ip address 198.51.100.1 255.255.255.0\n ip address 198.51.100.2 255.255.255.0 sub\n ipv6 address 2001:db8:1::1/64\n#\nip route-static 0.0.0.0 0 192.0.2.254 preference 70\n#\ninterface GigabitEthernet1/0/2\n description No defaults\n password cipher DO_NOT_PERSIST\n`);
 assert.equal(port(d,1).role,'Routed');assert.equal(port(d,1).nativeState,'None');assert.equal(port(d,1).ip,'192.0.2.1/24');assert.equal(port(d,1).addresses.length,2);
 assert.equal(d.switchportInventory.svis.length,3);assert.equal(d.routes[0].destination,'0.0.0.0/0');assert.match(d.switchportInventory.routes[0],/preference 70/);assert.equal(d.routes[0].distance,'70');
 assert.equal(port(d,2).nativeState,'Unknown');assert.equal(port(d,2).native,null);assert.equal(JSON.stringify(d).includes('DO_NOT_PERSIST'),false);
});

test('Comware malformed lists, ranges and incomplete hardware cannot create fabricated jacks',()=>{
 const d=parse(`interface GigabitEthernet1/0/1 to GigabitEthernet2/0/2\n port access vlan 10\n#\ninterface GigabitEthernet1/0/15\n port trunk permit vlan 20 to 10\n port hybrid vlan 0 tagged\n port link-aggregation group 3\n#\ninterface Route-Aggregation1\n`);
 for(const phrase of ['physical interface range','outside the selected hardware','Invalid Comware VLAN range','out-of-range','no explicit configuration','no physical members'])assert.ok(d.switchportInventory.blockers.some(b=>b.includes(phrase)),phrase);
 assert.equal(d.switchportInventory.ports.length,10);assert.equal(d.switchportInventory.ports.some(p=>p.id.endsWith('/15')),false);
 const unknown=parseComware('Comware\nsysname Synthetic\ninterface GigabitEthernet1/0/1\n port access vlan 10').devices[0];assert.equal(unknown.switchportInventory.groups.length,0);assert.ok(unknown.switchportInventory.blockers.length);assert.equal(port(unknown,1).native,10);
 assert.equal(isComwareConfiguration('sysname Huawei\ninterface GigabitEthernet0/0/1\n port link-type access'),false);
});

test('Comware model identity excludes peer descriptions and preserves route VRF/options',()=>{
 const d=parseComware('Comware\nsysname Synthetic\ninterface GigabitEthernet1/0/1\n description peer JG920A\n#\nip route-static vpn-instance BLUE 203.0.113.0 24 192.0.2.1 preference 90 tag 5').devices[0];
 assert.equal(d.model,'');assert.equal(d.switchportInventory.ports.length,0);assert.equal(d.routes[0].vrf,'BLUE');assert.equal(d.routes[0].destination,'203.0.113.0/24');assert.equal(d.routes[0].distance,'90');assert.equal(d.routes[0].tag,'5');
});
