import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceKinds,deviceKindOptions,deviceKindLabel,classifyDeviceKind} from '../src/web/device-types.mjs';
import {parseTable,readCSV} from '../src/web/imports/tables.mjs';
import {device,mergeModels} from '../src/web/imports/model.mjs';
import {ensureEvidence,captureEdits,composeEvidence} from '../src/web/evidence.mjs';
import {connectionPorts} from '../src/web/connection-edit.mjs';
import {unzip} from '../src/web/zip.mjs';
import {genericDeviceSymbol} from '../src/web/device-symbols.mjs';

test('inventory options retain infrastructure roles and add common endpoint and compute roles',()=>{
 const required=['switch','firewall','ap','handoff','unknown','router','server','hypervisor','virtual-machine','hci','storage','phone','workstation','printer','camera','controller','ups','patch-panel','iot','cloud','other'];
 assert.deepEqual(new Set(deviceKinds),new Set(required));assert.equal(deviceKinds.length,new Set(deviceKinds).size);
 for(const [kind,label] of deviceKindOptions){assert.ok(label.length>2);assert.equal(deviceKindLabel(kind),label);assert.equal(classifyDeviceKind(kind),kind);}
 assert.ok(Object.isFrozen(deviceKinds)&&Object.isFrozen(deviceKindOptions));
});

test('Auvik declared device types recognize endpoints without guessing an arbitrary model',()=>{
 const rows=readCSV('Device Name,Type,Make & Model,IP Address(es)\nLAB-VM,Virtual Machine,Fictional virtual guest,192.0.2.11\nLAB-HOST,Hypervisor Host,Fictional compute platform,192.0.2.12\nLAB-HCI,Hyperconverged Node,Fictional HCI,192.0.2.13\nLAB-PHONE,IP Phone,Fictional handset,192.0.2.14\nLAB-STORE,NAS,Fictional storage array,192.0.2.15\nLAB-ROUTER,Router,Fictional router,192.0.2.16\nLAB-WLC,Wireless Controller,Fictional controller,192.0.2.17\nLAB-SW,Switch,Fictional switch,192.0.2.18\nLAB-UNKNOWN,,Fictional Server 123,192.0.2.19');
 const imported=parseTable(rows),types=new Map(imported.devices.map(d=>[d.name,d.kind]));
 for(const [name,kind] of [['LAB-VM','virtual-machine'],['LAB-HOST','hypervisor'],['LAB-HCI','hci'],['LAB-PHONE','phone'],['LAB-STORE','storage'],['LAB-ROUTER','router'],['LAB-WLC','controller'],['LAB-SW','switch'],['LAB-UNKNOWN','unknown']])assert.equal(types.get(name),kind);
 assert.equal(classifyDeviceKind('Network Switches'),'switch');assert.equal(classifyDeviceKind('SAN Switch'),'switch');assert.equal(classifyDeviceKind('Wireless access point'),'ap');assert.equal(classifyDeviceKind('Dell PowerEdge 999'),'unknown');assert.equal(classifyDeviceKind('phoney telemetry'),'unknown');
});

test('manual inventory roles persist through project data and evidence recomposition',()=>{
 const project={devices:[device('LAB-HOST',{kind:'unknown',model:'Fictional node',ports:[{name:'eth0'}]})],links:[],warnings:[]};
 ensureEvidence(project);const snapshot=JSON.parse(JSON.stringify({devices:project.devices,links:project.links,warnings:project.warnings}));project.devices[0].kind='hci';captureEdits(project,snapshot);
 const reopened=JSON.parse(JSON.stringify(project));composeEvidence(reopened);assert.equal(reopened.devices[0].kind,'hci');
 const merged=mergeModels({devices:[device('LAB-PHONE',{kind:'phone',ports:[{name:'lan'}]})],links:[],warnings:[]});assert.equal(merged.devices[0].kind,'phone');assert.deepEqual(merged.devices[0].ports,[{name:'lan'}]);
});

test('generic endpoint symbols are editable geometry and never assert physical socket locations',()=>{
 for(const kind of deviceKinds){const symbol=genericDeviceSymbol(kind);if(['switch','firewall','ap','handoff','unknown'].includes(kind)){assert.equal(symbol,null);continue;}
  assert.ok(symbol&&symbol.ratio>0);assert.ok(symbol.children.length>2);assert.ok(!symbol.ports&&!symbol.anchors&&!symbol.verified);
  assert.ok(symbol.children.every(child=>['rect','text'].includes(child.type)&&child.name&&['x','y','w','h'].every(key=>Number.isFinite(child[key]))&&child.x>=0&&child.y>=0&&child.x+child.w<=1.001&&child.y+child.h<=1.001));
  const again=genericDeviceSymbol(kind);symbol.children[0].x=99;assert.notEqual(again.children[0].x,99);
 }
});

test('server and phone inventory retain declared interfaces and editable SVG and native Visio groups',async()=>{
 const {buildPages,exportVisio}=await import('../src/web/diagram/index.mjs');
 const project={name:'Endpoint Lab',devices:[device('LAB-SERVER',{kind:'server',ports:[{name:'eth0'}]}),device('LAB-PHONE',{kind:'phone',ports:[{name:'lan'}]})],links:[{a:'lab-server',ap:'eth0',b:'lab-phone',bp:'lan',media:'copper',speed:'1 Gbps'}]},pages=buildPages(project),core=pages.filter(page=>page.title.startsWith('Core Network'));
 assert.deepEqual(connectionPorts(project,project.devices[0]).map(p=>p.name),['eth0']);
 for(const [id,kind,part] of [['lab-server','server','Server chassis'],['lab-phone','phone','Phone base']]){const group=core.flatMap(page=>page.items).find(item=>item.type==='device'&&item.sourceId===id);assert.ok(group);assert.equal(group.kind,kind);assert.equal(group.physicalLayout,undefined);assert.ok(group.children.some(child=>child.name===part));assert.ok(Object.keys(group.ports).every(name=>name.startsWith('uplink.')));assert.ok(group.children.every(child=>child.editKey));}
 const files=await unzip(await exportVisio(project,pages).arrayBuffer()),xml=[...files].filter(([name])=>/^visio\/pages\/page\d+\.xml$/.test(name)).map(([,bytes])=>new TextDecoder().decode(bytes)).join('');
 assert.ok(core.some(page=>page.svg.includes('LAB-SERVER')));assert.match(xml,/Type="Group"[^>]*Name="LAB-SERVER"/);assert.match(xml,/Type="Group"[^>]*Name="LAB-PHONE"/);assert.match(xml,/FromCell="BeginX"/);assert.match(xml,/FromCell="EndX"/);
});
