import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRouterosText,routerosTextModel} from '../src/web/imports/routeros-text.mjs';
import {routerosSnapshotModel} from '../src/web/imports/routeros-backup.mjs';
const model=text=>routerosTextModel(text,'fictional.rsc').devices[0];
const port=(d,name)=>d.ports.find(p=>p.name===name);
const header='/system identity set name=SYNTHETIC\n';
test('RouterOS filtering defaults off, PVID is not an inferred egress VLAN',()=>{
 const d=model(header+'/interface bridge add name=br\n/interface bridge port add bridge=br interface=ether1 pvid=20\n/interface bridge vlan add bridge=br vlan-ids=20 tagged=ether1');
 assert.equal(port(d,'ether1').native,undefined);assert.equal(port(d,'ether1').tagged,undefined);assert.equal(port(d,'ether1').ingressPvid,20);assert.match(d.reportAssumptions.join(' '),/filtering is disabled/);
});
test('RouterOS filtering enabled derives PVID except tagged-only or disabled memberships',()=>{
 const d=model(header+'/interface bridge add name=br vlan-filtering=yes\n/interface bridge port\nadd bridge=br interface=ether1 pvid=20\nadd bridge=br interface=ether2 pvid=30 frame-types=admit-only-vlan-tagged\nadd bridge=br interface=ether3 pvid=40 disabled=yes\nadd bridge=br interface=ether4 pvid=50 dynamic=yes');
 assert.equal(port(d,'ether1').native,20);assert.equal(port(d,'ether2').nativeState,'none');assert.equal(port(d,'ether2').native,undefined);assert.equal(port(d,'ether3').native,undefined);assert.equal(port(d,'ether4').native,undefined);assert.match(port(d,'ether3').notes.join(' '),/membership disabled/);
});
test('RouterOS native VLAN and bonds use shared text and snapshot effective semantics',()=>{
 const text=header+'/interface ethernet\nset [ find default-name=ether1 ] name=UPLINK comment="Synthetic\\20uplink"\n/interface bonding add name=bondA slaves=UPLINK,ether2 mode=802.3ad disabled=yes\n/interface bridge add name=br vlan-filtering=yes\n/interface bridge port add bridge=br interface=bondA pvid=10\n/interface bridge vlan\nadd bridge=br vlan-ids=20-21 tagged=bondA\nadd bridge=br vlan-ids=30 tagged=bondA disabled=yes\nadd bridge=br vlan-ids=40 tagged=bondA dynamic=yes';
 const snapshot=parseRouterosText(text,'fictional.rsc'),d=model(text);assert.deepEqual(d,routerosSnapshotModel(snapshot,'fictional.rsc').devices[0]);
 for(const name of ['UPLINK','ether2']){assert.equal(port(d,name).lag,'bondA');assert.equal(port(d,name).native,10);assert.deepEqual(port(d,name).tagged,[20,21]);assert.match(port(d,name).notes.join(' '),/Aggregation mode: 802.3ad/);}
 assert.equal(port(d,'UPLINK').description,'Synthetic uplink');assert.deepEqual(port(d,'UPLINK').relatedInterfaces,['ether1']);assert.equal(port(d,'ether1'),undefined);assert.deepEqual(d.reportBlockers,[]);
});
test('RouterOS binary unknown filtering never derives dynamic PVID membership',()=>{
 const d=routerosSnapshotModel({Binary:true,Interfaces:[{Key:'1',Name:'ether1',DefaultName:'ether1'}],Bridges:[{Key:'2',Name:'br',Filtering:null}],BridgePorts:[{Bridge:'2',Interface:'1',Pvid:99,Frames:'admit-all'}],Vlans:[]}).devices[0];
 assert.equal(port(d,'ether1').native,undefined);assert.equal(port(d,'ether1').ingressPvid,99);assert.match(d.reportAssumptions.join(' '),/not inferred/);
});
test('RouterOS keeps secondary IPv4, IPv6, disabled routes and logical VLANs without physical invention',()=>{
 const d=model(header+'/interface vlan add name=users interface=ether7 vlan-id=20\n/ip address\nadd interface=users address=192.0.2.1/24\nadd interface=users address=198.51.100.1/24\nadd interface=users address=203.0.113.1/24 disabled=yes\n/ipv6 address add interface=users address=2001:db8::1/64\n/ip route add gateway=192.0.2.254 distance=2 disabled=yes routing-table=lab\n/ipv6 route add dst-address=::/0 gateway=2001:db8::ff\n/system script add name=NO script="NEVER-PERSIST-SECRET"');
 assert.deepEqual(port(d,'users').addresses,['192.0.2.1/24','198.51.100.1/24','2001:db8::1/64']);assert.equal(port(d,'users').logical,true);assert.equal(d.ports.length,2);assert.equal(d.routes[0].status,'disabled');assert.equal(d.routes[0].metric,2);assert.equal(d.routes[0].context,'lab');assert.equal(d.routes[1].destination,'::/0');assert.ok(!JSON.stringify(d).includes('NEVER-PERSIST-SECRET'));
});
test('RouterOS verified models fill omitted defaults and retain renamed QSFP lane blockers',()=>{
 const d=model('# model = CRS326-24S+2Q+RM\n'+header+'/interface ethernet set [ find default-name=qsfpplus1-1 ] name=laneA\n/interface bridge add name=br vlan-filtering=yes\n/interface bridge port add bridge=br interface=laneA pvid=20');
 assert.equal(d.ports.length,33);assert.equal(port(d,'laneA').media,'QSFP+');assert.ok(d.reportBlockers.some(note=>note.includes('different lane assignments')));assert.equal(port(d,'qsfpplus1-1'),undefined);
});
test('RouterOS unsupported switching commands and conflicting assignments block reports',()=>{
 const d=model(header+'/interface bridge add name=br vlan-filtering=yes\n/interface bridge port\nadd interface=ether1 bridge=br pvid=10 tag-stacking=yes\n/interface bridge vlan add bridge=br vlan-ids=20 untagged=ether1 tagged=ether1\n/interface ethernet switch vlan add vlan-id=8 ports=ether1\n/interface bridge filter add action=drop\n/interface ethernet disable ether1');
 assert.match(d.reportBlockers.join(' '),/Multiple untagged/);assert.match(d.reportBlockers.join(' '),/PVID and untagged egress/);assert.match(d.reportBlockers.join(' '),/tag-stacking/);assert.match(d.reportBlockers.join(' '),/switch-chip/);assert.match(d.reportBlockers.join(' '),/filter\/NAT\/MLAG/);assert.match(d.reportBlockers.join(' '),/Unsupported RouterOS switching command/);
});
test('RouterOS rejects malformed ranges and duplicates rather than adding fictional ports',()=>{
 assert.throws(()=>model(header+'/interface bridge vlan add bridge=br vlan-ids=4094-4096'),/Invalid RouterOS VLAN range/);
 assert.throws(()=>model(header+'/interface ethernet\nset [ find default-name=ether1 ] name=A\nset [ find default-name=ether1 ] name=B'),/Duplicate/);
 assert.equal(parseRouterosText('unrelated text'),null);
});
test('RouterOS inventory JSON retains only normalized allowlisted snapshot fields',()=>{
 const d=routerosSnapshotModel({Binary:true,raw:'NEVER-PERSIST-SECRET',Interfaces:[{Key:'1',Name:'ether1',DefaultName:'ether1',password:'NEVER-PERSIST-SECRET'}]}).devices[0];
 assert.ok(!JSON.stringify(d).includes('NEVER-PERSIST-SECRET'));assert.equal(d.routerosSnapshot.Interfaces[0].Name,'ether1');
});
