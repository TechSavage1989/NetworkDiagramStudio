import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConfig,importFiles,mergeModels} from '../src/web/imports/index.mjs';
import {hardwareProfile,portCapability} from '../src/web/imports/hardware.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {physicalPorts,addDevice} from '../src/web/diagram/scene.mjs';
import {connectionPorts} from '../src/web/connection-edit.mjs';
import {hardwareComposition} from '../src/web/hardware-composition.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {crossesText,intersects} from '../src/web/diagram/labels.mjs';

test('prefixed CX, classic stack and chassis ranges retain every physical port and VLAN',()=>{
 const d=parseConfig('! ArubaOS-CX\nhostname LAB-CX\ninterface 1/1/1-1/1/24\n vlan access 27\n exit\ninterface 1/1/25-28\n vlan trunk allowed 27,57\n exit').devices[0];
 assert.equal(d.ports.length,28);assert.equal(d.ports.find(p=>p.name==='1/1/24').native,27);assert.deepEqual(d.ports.find(p=>p.name==='1/1/28').tagged,[27,57]);
 const s=parseConfig('; hpStack_WB Configuration Editor\nhostname LAB-STACK\nstacking\n member 1 type J9729A\n member 2 type J9729A\n exit\ntrunk 1/B1-1/B2 Trk1 lacp\nvlan 27\n untagged 1/1-1/48,2/1-2/48\n tagged 1/B1-1/B2,Trk1\n exit').devices[0];
 assert.equal(physicalPorts(s).length,98);assert.equal(s.ports.find(p=>p.name==='2/48').native,27);assert.equal(s.ports.find(p=>p.name==='1/B2').lag,'Trk1');assert.deepEqual(s.ports.find(p=>p.name==='Trk1').members,['1/B1','1/B2']);
 const chassis=parseConfig('; J9851A Configuration Editor\nhostname LAB-CHASSIS\nmodule C type j9986a\nvlan 27\n untagged C1-C24\n exit').devices[0];
 assert.equal(chassis.ports.length,24);assert.ok(chassis.ports.every(p=>deviceFaceplate(chassis).ports[p.name]));
});

test('unsupported cross-member, descending and oversized ranges produce no fictional interface',()=>{
 const r=parseConfig('version 17\nhostname LAB\ninterface range Gi1/0/1-Gi2/0/48\n switchport access vlan 27\n!\ninterface Gi1/0/9-2\n!\ninterface 1-10000\n!');
 assert.equal(r.devices[0].ports.length,0);assert.equal(r.warnings.length,3);
 const valid=parseConfig('version 17\nhostname LAB\ninterface range GigabitEthernet1/0/1 - Gi1/0/4\n switchport access vlan 27\n!').devices[0];assert.equal(valid.ports.length,4);
});

test('SonicWall EXP decode is bounded, recognizes declared models and omits non-topology secrets',async()=>{
 for(const model of ['TZ 600','TZ 670','NSA 3600']){
  const settings='checksumVersion=6&shortProdName='+encodeURIComponent(model)+'&firewallName=LAB-SONIC&iface_ifnum_0=0&iface_name_0=X0&iface_static_ip_0=0.0.0.0&iface_static_mask_0=0.0.0.0&iface_lan_ip_0=192.0.2.1&iface_lan_mask_0=255.255.255.0&iface_name_1=X0%3AV57&iface_vlan_tag_1=57&iface_vlan_parent_1=0&iface_port_disabled_1=on&adminPassword=do-not-retain&certificate=do-not-retain';
  const encoded=Buffer.from(settings).toString('base64').replace(/.{72}/g,'$&\n')+'&&';
  const r=await importFiles([new File([encoded],'lab.exp')]),d=r.devices[0];assert.equal(d.model,model);assert.equal(d.ports[0].ip,'192.0.2.1/24');assert.equal(d.ports[1].parent,'X0');assert.equal(d.ports[1].admin,'down');assert.ok(deviceFaceplate(d));assert.ok(!JSON.stringify(r).includes('do-not-retain'));
 }
 assert.equal(parseConfig(Buffer.from('secret=not-a-settings-file').toString('base64'),'lab.exp').devices.length,0);
 assert.equal(parseConfig('Y2hlY2tzdW1WZXJzaW9uP!corrupt&&','lab.exp').devices.length,0);
});

test('FortiGate 91G hardware revisions and explicit shared media choose the actual connector',()=>{
 const config=names=>'#config-version=FGT91G-7.4\nconfig system interface\n'+names.map(n=>' edit "'+n+'"\n set type physical\n next').join('\n')+'\nend';
 const gen1=parseConfig(config(['wan1','wan2','port1','port2','a','b'])).devices[0],gen2=parseConfig(config(['x1','x2','port1','port2','a','b'])).devices[0];
 const old=deviceFaceplate(gen1),fresh=deviceFaceplate(gen2);assert.deepEqual(old.ports.wan1,fresh.ports.x1);assert.ok(!fresh.ports.wan1);assert.ok(fresh.ports.x1[0]<fresh.ports.port1[0]);assert.equal(fresh.ratio,5.15);assert.ok(portCapability(hardwareProfile(gen2),'x1'));
 gen2.ports[0].configuredMedia='copper';const copper=deviceFaceplate(gen2);assert.ok(copper.ports.x1[0]>fresh.ports.x1[0]);assert.ok(copper.ports.x1[0]<copper.ports.port1[0]);assert.ok(copper.children.some(c=>c.anchorName==='x1'&&c.anchorOrigin[0]===copper.ports.x1[0]));
 const merged=mergeModels({devices:[gen1,{id:'peer',name:'PEER',ports:[{name:'1'}]}],links:[{a:gen1.id,ap:'wan1',b:'peer',bp:'1'}]});assert.equal(merged.links[0].media,'unknown');
});

test('switch combo jacks remain attached and paired RJ45 sockets face opposite directions',()=>{
 const d={id:'sw',name:'LAB',kind:'switch',model:'J9729A',ports:[{name:'45'},{name:'46'}]},front=deviceFaceplate(d);
 assert.ok(front.ports['45']);assert.equal(front.sockets.find(s=>s.name==='45'&&s.form==='RJ-45').orientation,'up');assert.equal(front.sockets.find(s=>s.name==='46'&&s.form==='RJ-45').orientation,'down');
 d.ports[0].configuredMedia='fiber';const fiber=deviceFaceplate(d);assert.ok(fiber.ports['45'][0]>front.ports['45'][0]);
 const group=addDevice({items:[]},{},d,[0,0,700,200],'test');assert.deepEqual(group.ports['45'],fiber.ports['45']);
});

test('declared 2920 rear modules and unconfigured stack sockets keep side, member and glue aliases',()=>{
 const d={id:'sw',name:'LAB-STACK',kind:'switch',model:'J9729A',stackMembers:[{id:'1',model:'J9729A'},{id:'2',model:'J9729A'}],modules:[{member:'1',slot:'B',model:'J9731A'}],ports:[{name:'1/B1'},{name:'2/48'}]};
 const p=deviceFaceplate(d);assert.ok(p.ports['1/B1']);assert.ok(p.ports['1/B2']);assert.ok(p.ports['2/45']);assert.ok(p.ports['1/B1'][1]>p.ports['1/1'][1]);assert.ok(p.ports['1/B1'][1]<p.ports['2/1'][1]);assert.equal(p.sockets.find(s=>s.name==='1/B1').view,'rear');assert.ok(connectionPorts({stencils:{}},d).some(p=>p.name==='1/B2'));
 const unknown=deviceFaceplate({...d,modules:[]});assert.ok(!unknown.ports['1/B1']);
});

test('hardware confirmation validates member/slot identities without relying on filenames',()=>{
 assert.deepEqual(hardwareComposition([{id:'02',model:' J9729A '}],[{member:'2',slot:'b',model:'J9731A'}]),{stackMembers:[{id:'2',model:'J9729A'}],modules:[{member:'2',slot:'B',model:'J9731A'}]});
 for(const [members,cards] of [[[{id:'1',model:'J9729A'},{id:'1',model:'JL256A'}],[]],[[{id:'1',model:'J9729A'}],[{member:'2',slot:'B',model:'J9731A'}]],[[],[{slot:'A',model:'J9986A'},{slot:'A',model:'J9987A'}]]])assert.throws(()=>hardwareComposition(members,cards));
 const unknown=parseConfig('version 17\nhostname LAB\ninterface Gi0/1\n switchport access vlan 27\n!','Cisco-C9500-24Y4C.txt').devices[0];assert.equal(unknown.model,'');assert.equal(deviceFaceplate(unknown),null);
});

test('Cisco 3560-E uplinks cannot attach to access port 1; installed X2 and TwinGig use distinct sockets',()=>{
 const d={model:'WS-C3560E-48PD-S',ports:[{name:'Gi0/1'},{name:'Te0/1'},{name:'Gi0/49'},{name:'Gi0/50'}]};
 const pending=deviceFaceplate(d);assert.ok(pending.ports['Gi0/1']);assert.ok(!pending.ports['Te0/1']);assert.ok(!pending.ports['Gi0/49']);
 const x2=deviceFaceplate({...d,modules:[{slot:'X2-1',member:'',model:'X2-10GB-SR'}]});assert.ok(x2.ports['Te0/1'][0]>x2.ports['Gi0/1'][0]);assert.ok(!x2.ports['Gi0/49']);
 const twin=deviceFaceplate({...d,modules:[{slot:'X2-1',member:'',model:'CVR-X2-SFP'}]});assert.ok(twin.ports['Gi0/49']);assert.ok(twin.ports['Gi0/50']);assert.ok(!twin.ports['Te0/1']);assert.ok(twin.ports['Gi0/49'][0]<twin.ports['Gi0/50'][0]);
});

test('core and wireless stack leads use separate inter-panel lanes instead of crossing another member',()=>{
 const sw={id:'stack',name:'LAB-STACK',kind:'switch',model:'J9729A',stackMembers:[{id:'1',model:'J9729A'},{id:'2',model:'J9729A'}],modules:[{member:'1',slot:'B',model:'J9731A'}],ports:[{name:'1/B1'},{name:'1/B2'},{name:'2/1'}]},fw={id:'fw',name:'LAB-FW',kind:'firewall',model:'FortiGate 91G',ports:[{name:'x1'},{name:'x2'}]},ap={id:'ap',name:'LAB-AP',kind:'ap',ports:[{name:'eth0'}]};
 const site={devices:[fw,sw,ap],links:[{a:'fw',ap:'x1',b:'stack',bp:'1/B1',media:'SR',speed:'10 Gbps'},{a:'fw',ap:'x2',b:'stack',bp:'1/B2',media:'SR',speed:'10 Gbps'},{a:'stack',ap:'2/1',b:'ap',bp:'eth0',media:'copper'}]};
 for(const page of buildPages(site).filter(p=>p.title.startsWith('Core Network')||p.title==='Wireless Connections')){
  const g=page.items.find(i=>i.type==='device'&&i.sourceId==='stack');if(!g)continue;
  const paths=page.items.filter(i=>i.type==='path'),boxes=g.panelRegions.map(r=>({x:g.x,y:g.y+r.y*g.h,w:g.w,h:r.h*g.h}));
  for(const p of paths)for(const box of boxes){
   const ends=[p.points[0],p.points.at(-1)],own=ends.some(([x,y])=>x>=box.x&&x<=box.x+box.w&&y>=box.y&&y<=box.y+box.h);
   if(!own)assert.ok(!crossesText(p.points,box,0),'Cable crossed another member panel.');
  }
  const labels=page.items.filter(i=>i.type==='text');for(const a of labels.filter(i=>i.labelRole||i.titleOwner)){for(const b of labels)if(a!==b)assert.ok(!intersects(a,b,0));for(const p of paths)if(!(a.background&&p.linkId===a.linkId))assert.ok(!crossesText(p.points,a,0));}
 }
});


test('classic Aruba VLAN voice intent remains explicit through report imports',()=>{
 const parsed=parseConfig('; J9776A Configuration Editor\nhostname LAB-VOICE\nvlan 20\n name Voice\n tagged 1-24\n voice\n exit\nvlan 30\n no voice\n exit\nvlan 40\n name Data\n exit');
 const device=parsed.devices[0];assert.equal(device.vlans.find(v=>v.id===20).voice,true);assert.equal(device.vlans.find(v=>v.id===30).voice,false);assert.ok(!Object.hasOwn(device.vlans.find(v=>v.id===40),'voice'));
});

test('AOS-Switch VLAN membership follows the switchport builder: wrapped lists, trunks, removals and voice',async()=>{
 const {parseConfig}=await import('../src/web/imports/config.mjs');
 // Fictional backup with port lists wrapped inside a token, as exported.
 const text=['; J9851A Configuration Editor; Created on release #KB.16.10.0009','hostname "LAB-WRAP"','module A type j9993a','module C type j9986a','module D type j9986a','trunk A1,C19 trk1 lacp',
  'vlan 1','   name "DEFAULT_VLAN"','   no untagged A2-A8,C1-C18,C20-C24,D1-D24','   untagged Trk1','   exit',
  'vlan 4','   name "LAB_PHONES"','   untagged C6-C17','   tagged Trk1','   voice','   exit',
  'vlan 200','   name "LAB_WRAPPED"','   untagged D1-D3,D5,D7,D9,D11,D13,D15,D17,D19,D2','2,D23-D','24','   tagged A2-A4,','A7-A8,Trk1','   exit'].join('\n');
 const device=parseConfig(text,'lab-wrap.cfg').devices[0],port=name=>device.ports.find(p=>p.name===name);
 for(const name of ['D22','D23','D24'])assert.equal(port(name).native,200,name+' keeps its wrapped membership');
 assert.deepEqual(port('A8').tagged,[200]);assert.equal(port('A8').nativeState,'None','removed from VLAN 1 with no other native VLAN');
 assert.equal(port('A1').native,1,'trunk members carry the trunk native VLAN');assert.deepEqual(port('C19').tagged,[4,200]);assert.equal(port('C19').voice,4);
 assert.equal(port('C6').native,4);assert.equal(port('C6').voice,4,'a voice VLAN marks its member ports');assert.equal(port('C1').nativeState,'None');
});
