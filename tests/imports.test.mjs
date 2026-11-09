import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {importFiles, parseConfig, parseTable, readCSV, mergeModels, identify} from '../src/web/imports/index.mjs';

const file=(name,text)=>new File([text],name);
const cx='!Version AOS-CX\nhostname DEMO-SW\nvsf member 1\n    type jl675a\nvlan 20\n    name Users\ninterface lag 2\n    vlan trunk native 20\n    vlan trunk allowed 20,25-27\ninterface 1/1/2\n    description AP uplink\n    vlan trunk native 20\n    vlan trunk allowed 20,25-27\n    no shutdown\ninterface 1/1/51\n    lag 2\ninterface vlan 20\n    ip address 192.0.2.2/24\nip route 0.0.0.0/0 192.0.2.1';
const inventory='Device Name,Type,Make & Model,IP Address(es)\nDEMO-AP,Access Point,Aruba AP-515,192.0.2.9\nDEMO-SW,Switch,HPE JL675A,192.0.2.2';
const interfaces='INTERFACES\nAdmin Status,Oper Status,Interface Name,Type,Parent Device,Negotiated Speed,Connected To,Configuration Details\nUp,Up,1/1/2 (AP uplink),Ethernet,DEMO-SW,100 Mbit/s,eth0 on DEMO-AP,"VLAN 20 (Users), VLAN 25 (Guest)"\nUp,Up,eth0,Ethernet,DEMO-AP,100 Mbit/s,1/1/2 on DEMO-SW,';
test('site evidence merges case-insensitively and retains operational observations independently of config',async()=>{
  const result=await importFiles([file('ports.csv',interfaces),file('devices.csv',inventory),file('switch.cfg',cx)]);
  assert.equal(result.devices.length,2);assert.equal(result.links.length,1);
  const sw=result.devices.find(d=>d.id==='demo-sw'),ap=result.devices.find(d=>d.id==='demo-ap');
  assert.equal(sw.fromConfig,true);assert.equal(ap.fromConfig,undefined);assert.equal(sw.model,'JL675A');
  assert.equal(ap.kind,'ap');assert.equal(ap.ip,'192.0.2.9');assert.equal(sw.ports.find(p=>p.name==='1/1/51').lag,'2');
  const p=sw.ports.find(p=>p.name==='1/1/2');assert.equal(p.state,'up');assert.equal(p.speed,'100 Mbps');assert.deepEqual(p.tagged,[25,26,27]);assert.equal(p.native,20);
  assert.equal(sw.vlans.find(v=>v.id===20).ip,'192.0.2.2/24');
  assert.equal(sw.routes[0].nextHop,'192.0.2.1');assert.equal(result.links[0].media,'copper');
  assert.equal(result.links[0].bp,'eth0');
});
test('conflicting peers and down links retain evidence without silently overwriting a port mapping',()=>{
  const a=parseTable(readCSV(interfaces));const b=parseTable(readCSV(interfaces.replaceAll('DEMO-AP','DEMO-OTHER').replaceAll('Up,Up','Up,Down')));
  const result=mergeModels(a,b);assert.equal(result.links.length,2);assert.ok(result.links.every(e=>e.status==='conflict'));
  assert.ok(result.warnings.some(w=>w.includes('multiple reported peers')));
});
test('CSV quoting, blank rows, escapes, and multiline descriptions',()=>{
  assert.deepEqual(readCSV('a,b\r\n"one, two","multi\nline ""quote"""'),[['a','b'],['one, two','multi\nline "quote"']]);
  assert.throws(()=>readCSV('"broken'));
});
const forti='#config-version=FG120G-7.2\nconfig system global\n set hostname "DEMO-FW"\nend\nconfig system interface\n edit "x3"\n  set mediatype sr\n  set speed 10000full\n next\n edit "east-25"\n  set interface "x3"\n  set vlanid 25\n  set ip 192.0.2.1 255.255.255.0\n next\n edit "west-25"\n  set interface "port3"\n  set vlanid 25\n next\nend\nconfig system virtual-wire-pair\n edit "pass-25"\n  set member "east-25" "west-25"\n next\nend\nconfig router static\n edit 1\n  set gateway 192.0.2.254\n  set device "wan1"\n next\nend';
test('FortiOS VLAN parent, routed interface, named virtual-wire pairs, static routes and explicit media',()=>{
  const [d]=parseConfig(forti).devices;assert.equal(d.kind,'firewall');assert.equal(d.model,'FortiGate 120G');
  assert.equal(d.ports.find(p=>p.name==='x3').media,'SR');assert.equal(d.vlans.length,1);
  assert.deepEqual(d.vlans[0].interfaces.map(i=>i.parent),['x3','port3']);assert.equal(d.vlans[0].ip,'192.0.2.1/24');
  assert.deepEqual(d.bridges[0].members,['east-25','west-25']);assert.deepEqual(d.routes[0],{destination:'0.0.0.0/0',nextHop:'192.0.2.254',interface:'wan1',type:'static'});
  assert.ok(!JSON.stringify(parseConfig(forti+'\nconfig system admin\n edit demo\n set password omitted-value\nnext\nend')).includes('omitted-value'));
});
test('Cisco IOS and ArubaOS-S distinguish trunk, access and LAG membership',()=>{
  const [c]=parseConfig('version 17\nhostname TEST-C\ninterface GigabitEthernet1/0/1\n switchport mode trunk\n switchport trunk native vlan 2\n switchport trunk allowed vlan 2,4-6\n channel-group 3 mode active\n!\ninterface Vlan2\n ip address 192.0.2.4 255.255.255.0\n!').devices;
  assert.equal(c.ports[0].name,'Gi1/0/1');assert.equal(c.ports[0].lag,'Po3');assert.deepEqual(c.ports[0].tagged,[4,5,6]);
  const [a]=parseConfig('hostname TEST-A\nvlan 7\n name Users\n untagged 1-3\n tagged 4\n exit').devices;
  assert.equal(a.ports[2].native,7);assert.deepEqual(a.ports[3].tagged,[7]);
});
test('Junos set and RouterOS text exports retain L3 and bridge membership',()=>{
  const [j]=parseConfig('set system host-name TEST-J\nset interfaces irb unit 9 family inet address 192.0.2.8/24\nset interfaces ge-0/0/0 unit 0 family ethernet-switching interface-mode access\nset interfaces ge-0/0/0 unit 0 family ethernet-switching vlan members users\nset vlans users vlan-id 9\nset vlans users l3-interface irb.9').devices;
  assert.equal(j.vlans[0].ip,'192.0.2.8/24');assert.equal(j.ports.find(p=>p.name==='ge-0/0/0').native,9);
  const [m]=parseConfig('/system identity\nset name=TEST-M\n/interface bridge\nadd name=br1 vlan-filtering=yes\n/interface bridge port\nadd bridge=br1 interface=ether2 pvid=9\n/interface bridge vlan\nadd bridge=br1 tagged=ether3 untagged=ether2 vlan-ids=9').devices;
  assert.deepEqual(m.bridges[0].members,['ether2']);assert.deepEqual(m.ports.find(p=>p.name==='ether3').tagged,[9]);assert.equal(m.fromConfig,true);
});
test('unsupported and damaged files produce actionable warnings, other files still import',async()=>{
  const r=await importFiles([file('unknown.log','random unrecognized text'),file('old.xls','unrecognized'),file('bad.xlsx','broken'),file('switch.cfg',cx)]);
  assert.equal(r.devices.length,1);assert.equal(r.warnings.length,3);assert.equal(identify('HP 6100').kind,'unknown');
});
// Tiny in-memory ZIP containing only fictional sheet rows. Exercise workbook relationships,
// compressed data, shared/rich strings, blank cells and XML entity handling without shipping binaries.
function zip(entries){
  const local=[],central=[];let offset=0,total=0;
  for(const [name,data] of Object.entries(entries)){
    const raw=Buffer.from(data), packed=deflateRawSync(raw), fname=Buffer.from(name);let crc=-1;
    for(const byte of raw){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    crc=(crc^-1)>>>0;const l=Buffer.alloc(30),c=Buffer.alloc(46);
    l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(8,8);l.writeUInt32LE(crc,14);l.writeUInt32LE(packed.length,18);l.writeUInt32LE(raw.length,22);l.writeUInt16LE(fname.length,26);
    c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(fname.length,28);c.writeUInt32LE(offset,42);
    local.push(l,fname,packed);central.push(c,fname);offset+=30+fname.length+packed.length;total+=46+fname.length;
  }
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(total,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,...central,end]);
}
test('XLSX workbook consumes the sheet relationship rather than relying on sheet order',async()=>{
  const headers=['Device Name','Type','Make &amp; Model','IP Address(es)'];const cells=(row,vs)=>vs.map((v,i)=>'<c r="'+String.fromCharCode(65+i)+row+'" t="inlineStr"><is><t>'+v+'</t></is></c>').join('');
  const content=zip({'xl/workbook.xml':'<workbook><sheets><sheet name="Devices" sheetId="42" r:id="rId8"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId8" Target="worksheets/inventory.xml"/></Relationships>',
    'xl/sharedStrings.xml':'<sst><si><r><t>TEST-</t></r><r><t>AP</t></r></si></sst>',
    'xl/worksheets/inventory.xml':'<worksheet><sheetData><row>'+cells(1,headers)+'</row><row><c r="A2" t="s"><v>0</v></c>'+cells(2,['','Access Point','Aruba AP-515','192.0.2.6']).replace(/<c r="A2".*?<\/c>/,'')+'</row></sheetData></worksheet>'});
  const r=await importFiles([file('inventory.xlsx',content)]);assert.deepEqual(r.warnings,[]);assert.equal(r.devices[0].id,'test-ap');assert.equal(r.devices[0].ip,'192.0.2.6');assert.equal(r.devices[0].model,'AP-515');
});
