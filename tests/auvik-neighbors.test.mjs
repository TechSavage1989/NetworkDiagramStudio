import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTable} from '../src/web/imports/tables.mjs';
import {mergeModels} from '../src/web/imports/model.mjs';
import {logicalPort,physicalInventory} from '../src/web/physical-links.mjs';

// A fictional Auvik site export with the neighbor patterns monitoring tools
// report: VLAN (Virtual NIC) interfaces as neighbors, a firewall interface
// that is down next to the one that is up, an endpoint seen through a
// downstream switch, a printer interface name with commas, a port name with a
// bracketed description, and two devices Auvik could not name.
const deviceRows=[
 ['DEVICES'],
 ['Status','Device Name','Type','Make & Model','MAC Address(es)','IP Address(es)','Network(s)','Connected To','Software Version','Serial Number','Firmware Version','Description'],
 ['Up','LAB-CORE-01','Switch','HP 2920-48G-PoE+ (J9729A)','02:00:00:00:01:40','192.0.2.226','192.0.2.0/24','0','','','','Switch'],
 ['Up','LAB-EDGE-02','Switch','HP 2920-48G-PoE+ (J9729A)','02:00:00:00:02:40','192.0.2.227','192.0.2.0/24','0','','','','Switch'],
 ['Up','LAB-FW','Firewall','Fortinet FortiGate-101F','02:00:00:00:03:01','192.0.2.1','192.0.2.0/24','0','','','','Firewall'],
 ['Up','LAB-REMOTE-SW','Switch','Cisco SG300-10 10-Port Gigabit Managed Switch','02:00:00:00:04:01','192.0.2.250','192.0.2.0/24','0','','','','Switch'],
 ['Up','LAB-PHONE','Generic Device','Fictional desk phone','02:00:00:00:05:01','192.0.2.73','192.0.2.0/24','LAB-REMOTE-SW through g4','','','','Phone'],
 ['Up','LAB-PRINTER','Printer','HP LaserJet P4014','02:00:00:00:06:01','192.0.2.126','192.0.2.0/24','LAB-CORE-01 through 1','','','','Printer'],
 ['Up','LAB-SERVER','Server','HP ProLiant DL360 Gen10','02:00:00:00:07:01','192.0.2.230','192.0.2.0/24','LAB-CORE-01 through 42','','','','Server'],
 ['Down','Unidentified Device','Workstation','HP EliteBook 650 15.6 G9','02:00:00:00:08:19','192.0.2.19','192.0.2.0/24','LAB-EDGE-02 through 23','','','','Workstation'],
 ['Unreachable','Unidentified Device','Workstation','HP EliteBook 650 15.6 G9','02:00:00:00:08:27','192.0.2.27','192.0.2.0/24','0','','','','Workstation']
];
const JETDIRECT='HP ETHERNET MULTI-ENVIRONMENT,ROM none,JETDIRECT,JD143,EEPROM V.36.41';
const row=(admin,oper,name,mac,type,parent,speed,connected,details='VLAN 1 (DEFAULT_VLAN)')=>[admin,oper,name,mac,type,parent,speed,connected,details];
const interfaceRows=[
 ['INTERFACES'],
 ['Admin Status','Oper Status','Interface Name','MAC Address','Type','Parent Device','Negotiated Speed','Connected To','Configuration Details'],
 row('Up','Up','1','02:00:00:00:01:7f','Ethernet','LAB-CORE-01','1.0 Gbit/s',JETDIRECT+'  on LAB-PRINTER'),
 row('Up','Up','6','02:00:00:00:01:7a','Ethernet','LAB-CORE-01','1.0 Gbit/s','port1  on LAB-FW, dmz  on LAB-FW'),
 row('Up','Up','41','02:00:00:00:01:57','Ethernet','LAB-CORE-01','1.0 Gbit/s','port2  on LAB-FW, dmz  on LAB-FW'),
 row('Up','Up','42 (To firewall port 2(Management))','02:00:00:00:01:56','Ethernet','LAB-CORE-01','1.0 Gbit/s','Some Interface  on LAB-SERVER'),
 row('Up','Up','43','02:00:00:00:01:55','Ethernet','LAB-CORE-01','1.0 Gbit/s','43  on LAB-EDGE-02, DEFAULT_VLAN  on LAB-EDGE-02'),
 row('Up','Up','45','02:00:00:00:01:53','Ethernet','LAB-CORE-01','1.0 Gbit/s','VLAN1  on LAB-REMOTE-SW, Some Interface  on LAB-PHONE'),
 row('Up','Up','DEFAULT_VLAN','02:00:00:00:01:40','Virtual NIC','LAB-CORE-01','0 bps','43  on LAB-EDGE-02, g9  on LAB-REMOTE-SW','192.0.2.226 (/24), VLAN 1 (DEFAULT_VLAN)'),
 row('Up','Up','23','02:00:00:00:02:69','Ethernet','LAB-EDGE-02','1.0 Gbit/s','Some Interface  on Unidentified Device'),
 row('Up','Up','43','02:00:00:00:02:55','Ethernet','LAB-EDGE-02','1.0 Gbit/s','DEFAULT_VLAN  on LAB-CORE-01, 43  on LAB-CORE-01'),
 row('Up','Up','DEFAULT_VLAN','02:00:00:00:02:40','Virtual NIC','LAB-EDGE-02','0 bps','43  on LAB-CORE-01','192.0.2.227 (/24), VLAN 1 (DEFAULT_VLAN)'),
 row('Up','Up','port1','02:00:00:00:03:74','Ethernet','LAB-FW','1.0 Gbit/s','0','192.0.2.1 (/24)'),
 row('Up','Up','port2','02:00:00:00:03:75','Ethernet','LAB-FW','1.0 Gbit/s','0','198.51.100.1 (/24)'),
 row('Up','Down','dmz','02:00:00:00:03:6e','Ethernet','LAB-FW','0 bps','6  on LAB-CORE-01, 41  on LAB-CORE-01','203.0.113.1 (/24)'),
 row('Up','Up','VLAN1','02:00:00:00:04:01','Virtual NIC','LAB-REMOTE-SW','0 bps','45  on LAB-CORE-01','192.0.2.250 (/24), VLAN 1 (DEFAULT_VLAN)'),
 row('Up','Up','g9','02:00:00:00:04:e3','Ethernet','LAB-REMOTE-SW','1.0 Gbit/s','DEFAULT_VLAN  on LAB-CORE-01'),
 row('Up','Up','g4','02:00:00:00:04:de','Ethernet','LAB-REMOTE-SW','1.0 Gbit/s','Some Interface  on LAB-PHONE'),
 row('Up','Up',JETDIRECT,'02:00:00:00:06:01','Ethernet','LAB-PRINTER','1.0 Gbit/s','1  on LAB-CORE-01',''),
 row('Up','Up','Some Interface','02:00:00:00:07:01','Ethernet','LAB-SERVER','1.0 Gbit/s','42  on LAB-CORE-01',''),
 row('Up','Unreachable','Some Interface','02:00:00:00:08:19','','Unidentified Device','0 bps','23  on LAB-EDGE-02','192.0.2.19 (/24)'),
 row('Up','Unreachable','Some Interface','02:00:00:00:08:27','','Unidentified Device','0 bps','0','192.0.2.27 (/24)')
];
const site=()=>mergeModels([parseTable(deviceRows,'Fictional site.xlsx / Devices'),parseTable(interfaceRows,'Fictional site.xlsx / Interfaces')]);
const cables=model=>physicalInventory({devices:model.devices,links:model.links}).links.map(l=>[l.a+' '+l.ap,l.b+' '+l.bp].sort().join(' <-> ')).sort();

test('Auvik Virtual NIC interfaces are logical, not cables',()=>{
 assert.equal(logicalPort({name:'DEFAULT_VLAN',type:'Virtual NIC'}),true);
 assert.equal(logicalPort({name:'VLAN1',type:'Virtual NIC'}),true);
 assert.equal(logicalPort({name:'43',type:'Ethernet'}),false);
});

test('each port draws one cable: the one the observations support',()=>{
 const model=site();
 assert.deepEqual(cables(model),[
  'lab-core-01 1 <-> lab-printer '+JETDIRECT,
  'lab-core-01 42 <-> lab-server Some Interface',
  'lab-core-01 43 <-> lab-edge-02 43',
  'lab-core-01 45 <-> lab-remote-sw g9',
  'lab-core-01 6 <-> lab-fw port1',
  'lab-core-01 41 <-> lab-fw port2',
  'lab-edge-02 23 <-> unidentified device (192.0.2.19) Some Interface',
  'lab-phone Some Interface <-> lab-remote-sw g4'
 ].map(s=>s.split(' <-> ').sort().join(' <-> ')).sort());
 const ends=new Map();
 for(const link of physicalInventory(model).links)for(const end of [link.a+' '+link.ap,link.b+' '+link.bp])ends.set(end,(ends.get(end)||0)+1);
 assert.deepEqual([...ends].filter(([,n])=>n>1),[],'no port has more than one drawn cable');
 assert.ok(!model.warnings.some(w=>/multiple reported peers/.test(w)),model.warnings.join('\n'));
});

test('the observations that are not cables stay for review with a reason',()=>{
 const model=site(),find=(a,ap,b,bp)=>model.links.find(l=>l.a===a&&l.ap===ap&&l.b===b&&l.bp===bp||l.a===b&&l.ap===bp&&l.b===a&&l.bp===ap);
 assert.ok(find('lab-core-01','43','lab-edge-02','DEFAULT_VLAN'),'VLAN interface neighbors remain in the inventory');
 assert.equal(find('lab-core-01','6','lab-fw','dmz').physicalEvidence.kind,'alternate-interface');
 assert.equal(find('lab-core-01','45','lab-phone','Some Interface').physicalEvidence.preferred.device,'lab-remote-sw');
 const joined=find('lab-core-01','45','lab-remote-sw','g9');
 assert.equal(joined.status,'inferred');assert.equal(joined.endpointSource,'logical neighbor observations');assert.equal(joined.reportedEndpoints.length,2);
 for(const pattern of [/LAB-CORE-01 6: LAB-FW dmz is reported down; drawing uses port1\./,/LAB-CORE-01 45: LAB-PHONE is reached through LAB-REMOTE-SW; drawing uses LAB-REMOTE-SW g4\./,/LAB-CORE-01 45 and LAB-REMOTE-SW g9 each report the other device's VLAN interface \(VLAN1, DEFAULT_VLAN\); drawing joins them as one inferred cable/])
  assert.ok(model.warnings.some(w=>pattern.test(w)),String(pattern));
});

test('interface names keep their commas and lose a bracketed description',()=>{
 const model=site(),core=model.devices.find(d=>d.id==='lab-core-01'),printer=model.devices.find(d=>d.id==='lab-printer');
 assert.deepEqual(printer.ports.map(p=>p.name),[JETDIRECT]);
 const port=core.ports.find(p=>p.name==='42');
 assert.equal(port.reportedDescription,'To firewall port 2(Management)');
 assert.ok(!core.ports.some(p=>/\(/.test(p.name)),'no separate port named with its description');
});

test('devices Auvik could not name stay apart and keep their own links',()=>{
 const model=site(),unnamed=model.devices.filter(d=>/^unidentified device/.test(d.id));
 assert.deepEqual(unnamed.map(d=>[d.name,d.ip]).sort(),[['Unidentified Device (192.0.2.19)','192.0.2.19'],['Unidentified Device (192.0.2.27)','192.0.2.27']]);
 assert.ok(!model.devices.some(d=>d.id==='unidentified device'),'no empty placeholder device');
});

test('composing the merged evidence again changes nothing',()=>{
 const once=site(),twice=mergeModels([JSON.parse(JSON.stringify(once))]);
 assert.deepEqual(cables(twice),cables(once));
 assert.deepEqual([...twice.warnings].sort(),[...once.warnings].sort());
 assert.equal(twice.links.length,once.links.length);
});

test('a project saved with interface names cut at their commas reopens with one cable',()=>{
 // Before preview.69 the switch row named only the last comma piece.
 const saved={devices:[
  {id:'lab-core-01',name:'LAB-CORE-01',kind:'switch',ports:[{name:'1',type:'Ethernet',state:'up'}],vlans:[],routes:[]},
  {id:'lab-printer',name:'LAB-PRINTER',kind:'printer',ports:[{name:'EEPROM V.36.41'},{name:JETDIRECT,type:'Ethernet',state:'up'}],vlans:[],routes:[]}
 ],links:[
  {a:'lab-core-01',ap:'1',b:'lab-printer',bp:'EEPROM V.36.41',media:'unknown',speed:'1 Gbps',status:'observed'},
  {a:'lab-printer',ap:JETDIRECT,b:'lab-core-01',bp:'1',media:'unknown',speed:'1 Gbps',status:'observed'}
 ],warnings:[]};
 const model=mergeModels([saved]);
 assert.deepEqual(cables(model),['lab-core-01 1 <-> lab-printer '+JETDIRECT]);
 assert.deepEqual(model.devices.find(d=>d.id==='lab-printer').ports.map(p=>p.name),[JETDIRECT],'the cut piece is not kept as a port');
});
