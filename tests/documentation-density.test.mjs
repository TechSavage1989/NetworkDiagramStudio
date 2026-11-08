import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {documentationSections} from '../src/web/diagram/documentation.mjs';
import {logicalPages} from '../src/web/diagram/logical.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {unzip} from '../src/web/zip.mjs';

const copy=value=>structuredClone(value);
const switchDevice=id=>({id,name:'LAB-SW-'+id,kind:'switch',model:'JL675A',ports:Array.from({length:52},(_,i)=>({name:'1/1/'+(i+1),role:i<48?'access':'uplink',native:10,tagged:i<48?[]:[20,30],state:'up',speed:i<48?'1 Gbps':'10 Gbps'})),vlans:[{id:10,name:'Office'},{id:20,name:'Voice'},{id:30,name:'Wireless'}]});
const site=devices=>({name:'Fictional documentation lab',devices,links:[]});
const logical=pages=>pages.filter(page=>page.title==='VLANs and Routing');
const words=pages=>pages.flatMap(page=>page.items.filter(item=>item.type==='text').map(item=>item.value)).join(' ');
const rows=sections=>sections.flatMap(section=>section.rows.map((values,index)=>({scope:section.sourceDeviceIds,values,key:section.recordKeys[index]})));
const clear=pages=>{for(const page of pages)for(const item of page.items.filter(item=>item.logicalColumn!==undefined)){assert.equal(textLayout(item).size,item.size);assert.ok(item.x>=36&&item.x+item.w<=page.width-36+.01);assert.ok(item.y>=160&&item.y+item.h<=page.height-69+.01);}};

test('concise documentation shares exact definitions with an explicit scope and fewer complete pages',()=>{
 const devices=Array.from({length:8},(_,i)=>({...switchDevice(String(i+1)),vlans:Array.from({length:16},(_,n)=>({id:n+1,name:'Department '+(n+1)})),routes:[{destination:'0.0.0.0/0',nextHop:'192.0.2.254',type:'static'}]})),project=site(devices),before=copy(project);
 const concise=buildPages(project),full=buildPages({...project,layout:{documentation:'full'}});
 assert.ok(concise.length<full.length);assert.equal(logical(concise).length,1);assert.ok(logical(full).length>=8);assert.ok(!concise.some(page=>page.title==='Trunk VLANs'));assert.ok(full.some(page=>page.title==='Trunk VLANs'));
 const sections=documentationSections(project,devices);assert.equal(sections.length,1);assert.equal(sections[0].rows.length,17);assert.deepEqual(sections[0].sourceDeviceIds,devices.map(device=>device.id));for(const device of devices)assert.ok(sections[0].name.includes(device.name));
 assert.equal(new Set(concise.filter(page=>page.portMap).flatMap(page=>page.portMap.portRecords||[]).map(port=>port.device+'/'+port.name)).size,8*52);assert.deepEqual(project,before);clear(logical(concise));
});

test('conflicts, provenance, secondary addresses, aggregate metadata and complete route fields remain distinct',()=>{
 const common={id:10,name:'Office',ip:'192.0.2.1/24',source:'configuration-A'},a=switchDevice('A'),b=switchDevice('B'),c=switchDevice('C');a.vlans=[copy(common)];b.vlans=[copy(common)];c.vlans=[{...common,name:'Guest',source:'configuration-C'}];
 const route={destination:'203.0.113.0/24',nextHop:'192.0.2.254',interface:'lag 1',type:'static',metric:15,context:'main',evidence:['configuration','observed'],source:'capture-A'};a.routes=[route];b.routes=[{...route,type:'observed',metric:20,source:'capture-B'}];
 a.bridges=[{name:'Transit bridge',type:'virtual-wire-pair',members:['1/1/1','1/1/2'],context:'tenant-A'}];a.ports[0].ip='198.51.100.1/24';a.ports[0].ips=['198.51.100.1/24','198.51.100.129/25'];a.ports.push({name:'lag 1',type:'aggregate',native:10,tagged:[20,21,22,30],allowedExcept:[99],members:['1/1/49','1/1/50'],description:'Distribution uplink'});
 const firewall={id:'FW',name:'LAB-FW',kind:'firewall',ports:[{name:'port2',ip:'198.51.100.254/24',ips:['198.51.100.254/24','203.0.113.1/28']},{name:'Office.10',parent:'port2',vlan:10,role:'VLAN subinterface',ip:'192.0.2.1/24',ips:['192.0.2.1/24','192.0.2.129/25']}],vlans:[{id:10,name:'Office',ip:'192.0.2.1/24',address:'192.0.2.200/24',interfaces:[{name:'Office.10',parent:'port2',ip:'192.0.2.1/24'}]}]};
 firewall.ports.push({name:'port3',role:'trunk',native:40,tagged:[41,42],description:'Isolated firewall trunk'});
 const project=site([a,b,c,firewall]),sections=documentationSections(project,project.devices),records=rows(sections),shared=records.find(row=>row.values[1]==='Office'&&row.scope.length===2);assert.deepEqual(shared.scope,['A','B']);assert.ok(records.some(row=>row.values[1]==='Guest'&&row.scope.join()==='C'));assert.equal(records.filter(row=>row.values[0]==='Route').length,2);assert.ok(records.some(row=>row.values[0]==='port3'&&row.values[6].includes('Isolated firewall trunk')));
 const pages=buildPages(project),text=words(pages);for(const expected of ['configuration-A','configuration-C','Metric: 15','Metric: 20','Type: observed','Context: main','Evidence: configuration, observed','capture-A','capture-B','virtual-wire-pair','tenant-A','198.51.100.129/25','203.0.113.1/28','192.0.2.129/25','192.0.2.200/24','Tagged 20-22, 30','Except 99','Distribution uplink'])assert.ok(text.includes(expected),expected);
 assert.ok(!pages.some(page=>page.title==='Trunk VLANs'));clear(logical(pages));
});

test('shared and device-specific caption edits survive reopen, ordering and document-detail changes',async()=>{
 const project=site([switchDevice('A'),switchDevice('B')]),shared=logical(buildPages(project))[0].items.find(item=>item.logicalColumn===1&&item.value==='Office');assert.ok(shared.editKey.includes('|shared|'));
 project.layout={documentation:'concise',order:['B','A'],drawingEdits:{[shared.editKey]:{value:'Office users',color:'#2255AA'}}};project.layout=cleanLayout(copy(project.layout),project.devices.map(device=>device.id));
 let pages=buildPages(copy(project));assert.equal(pages.flatMap(page=>page.items).find(item=>item.editKey===shared.editKey).value,'Office users');
 project.layout.documentation='full';pages=buildPages(copy(project));assert.equal(pages.flatMap(page=>page.items).find(item=>item.editKey===shared.editKey).color,'#2255AA');
 const legacy=site([switchDevice('A'),switchDevice('B')]);legacy.layout={documentation:'full'};const cell=logical(buildPages(legacy))[0].items.find(item=>item.logicalDeviceId==='A'&&item.logicalColumn===1&&item.value==='Office');legacy.layout={documentation:'concise',drawingEdits:{[cell.editKey]:{value:'Custom A users'}}};pages=buildPages(copy(legacy));assert.equal(pages.flatMap(page=>page.items).find(item=>item.editKey===cell.editKey).value,'Custom A users');assert.ok(pages.flatMap(page=>page.items).some(item=>item.logicalDeviceId==='B'&&item.value==='Office'));
 const parts=await unzip(await exportVisio(legacy,pages).arrayBuffer()),xml=[...parts].filter(([key])=>/^visio\/pages\/page\d+\.xml$/.test(key)).map(([,value])=>new TextDecoder().decode(value)).join('');assert.ok(xml.includes('Custom A users'));assert.ok(xml.includes('LAB-SW-B'));
});

test('full reference mode, custom trunk selections and saved trunk presentation remain available',()=>{
 const project=site([switchDevice('A'),switchDevice('B')]);project.layout={reportPages:[{id:'a-trunks',name:'A membership reference',family:'trunk',devices:['A']}]};let pages=buildPages(project),trunks=pages.filter(page=>page.title==='Trunk VLANs');assert.equal(trunks.length,1);assert.equal(trunks[0].reportId,'a-trunks');assert.deepEqual(trunks[0].sourceDeviceIds,['A']);assert.equal(trunks[0].displayName,'A membership reference');
 project.layout={presentation:{pages:{'Trunk VLANs':{name:'Saved matrix'}}}};pages=buildPages(project);assert.equal(pages.find(page=>page.title==='Trunk VLANs').displayName,'Saved matrix');
 const source=pages.find(page=>page.title==='Trunk VLANs').items.find(item=>item.type==='text'&&item.value==='VLAN / Name');project.layout={drawingEdits:{[source.editKey]:{value:'Saved VLAN key'}}};assert.ok(buildPages(project).some(page=>page.title==='Trunk VLANs'&&page.svg.includes('Saved VLAN key')));
 const empty=site([]);assert.equal(logical(buildPages(empty)).length,0);assert.ok(!buildPages(empty).some(page=>page.title==='Trunk VLANs'));assert.equal(logical(buildPages({...empty,layout:{documentation:'full'}})).length,1);
 empty.layout={reportPages:[{id:'empty',name:'Chosen logical report',family:'logical',devices:[]}]};assert.ok(buildPages(empty).some(page=>page.reportId==='empty'));
});

test('automatic port sheets combine only when they save space and retain all physical records',()=>{
 const project=site([switchDevice('A')]),automatic=buildPages(project).filter(page=>page.portMap),separate=buildPages({...project,layout:{portMap:{presentation:'separate'}}}).filter(page=>page.portMap);
 assert.equal(automatic.length,1);assert.equal(separate.length,2);assert.equal(automatic[0].portMap.presentation,'combined');assert.ok(automatic[0].items.some(item=>item.type==='device'));assert.ok(automatic[0].items.some(item=>item.portTableRole));assert.equal(new Set(automatic.flatMap(page=>page.portMap.portRecords.map(port=>port.name))).size,52);
 for(const paper of ['original','letter']){const pages=buildPages({...project,layout:{pageSetup:{default:{preset:paper}}}}).filter(page=>page.portMap);assert.equal(pages.length,1);for(const item of pages[0].items.filter(item=>item.portTableRole))assert.ok(item.y+item.h<=pages[0].height-124+.01);}
 const body=separate[0].items.find(item=>item.type==='device');project.layout={drawingEdits:{[body.editKey]:{x:body.x+11}}};const preserved=buildPages(project).filter(page=>page.portMap);assert.equal(preserved.length,2);assert.equal(preserved[0].portMap.presentation,'separate');assert.equal(preserved[0].items.find(item=>item.editKey===body.editKey).x,body.x+11);
});

test('measured logical rows preserve complete long records on dynamic and fixed paper',()=>{
 const description=Array.from({length:750},(_,i)=>'Detail'+i).join(' '),project=site([{id:'route',name:'LAB-ROUTER',kind:'router',routes:[{destination:'203.0.113.0/24',nextHop:'192.0.2.1',interface:'uplink',description}]}]);
 for(const paper of ['dynamic','original','letter']){const input={...project,layout:{pageSetup:{default:{preset:paper,orientation:'landscape'}}}},pages=logicalPages(input,documentationSections(input,input.devices));assert.ok(pages.length>1);clear(pages);const text=words(pages);for(let i=0;i<750;i++)assert.ok(text.includes('Detail'+i));assert.ok(pages.every(page=>page.logicalSections[0].sourceDeviceIds.includes('route')));}
});

test('observed interfaces use compact inventory profiles without repeating VLAN-owned addresses',()=>{
 const devices=['A','B'].map((id,deviceIndex)=>{const device=switchDevice(id);for(let i=1;i<=24;i++)device.ports.push({name:'lag '+i,type:'aggregate',role:'trunk',state:'up',admin:'up',speed:1e10,mac:'02:00:'+String(deviceIndex).padStart(2,'0')+':00:00:'+i.toString(16).padStart(2,'0'),native:10,tagged:Array.from({length:11},(_,n)=>20+n),reportedVlans:[10,...Array.from({length:11},(_,n)=>20+n)],members:['1/1/49','1/1/50']});return device;});
 const firewall={id:'F',name:'LAB-FIREWALL',kind:'firewall',vlans:[{id:10,name:'Office',interfaces:[{name:'Office.10',parent:'port2',ip:'192.0.2.1/24'}]}],ports:[{name:'Office.10',parent:'port2',vlan:10,ip:'192.0.2.1/24',ips:['192.0.2.1/24','192.0.2.129/25'],mac:'02:00:FF:00:00:01',state:'up'}]};devices.push(firewall);
 const project=site(devices),before=copy(project),pages=buildPages(project),inventory=pages.filter(page=>page.interfaceInventory),text=words(inventory);assert.ok(inventory.length<=3);assert.ok(inventory.some(page=>page.items.some(item=>item.logicalProfile)));assert.ok(text.includes('Tagged 20-30'));assert.ok(text.includes('Observed 10, 20-30'));assert.ok(text.includes('192.0.2.129/25'));assert.ok(!text.includes('192.0.2.1/24'));assert.ok(words(logical(pages)).includes('192.0.2.1/24'));
 const identities=new Set(inventory.flatMap(page=>page.items.filter(item=>item.logicalColumn===0).flatMap(item=>item.logicalSourceDeviceIds.map(id=>id+'/'+item.value))));for(const device of devices)for(const port of device.ports.filter(port=>port.type==='aggregate'||port.parent)){assert.ok(identities.has(device.id+'/'+port.name));assert.ok(text.includes(port.mac));}assert.equal(identities.size,49);assert.deepEqual(project,before);clear(inventory);
});
