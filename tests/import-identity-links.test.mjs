import test from 'node:test';
import assert from 'node:assert/strict';
import {importFiles,mergeModels,parseConfig,parseTable,readCSV,findDeviceIdentity} from '../src/web/imports/index.mjs';
import {physicalLink,physicalInventory} from '../src/web/physical-links.mjs';
import {readSources,ensureEvidence,composeEvidence,captureEdits,categories} from '../src/web/evidence.mjs';

const firewall='#config-version=FG200G-7.4\nconfig system global\n set hostname "LAB-FW"\nend\nconfig system interface\n edit "port2"\n  set type physical\n  set alias "Trusted"\n next\n edit "port4"\n  set type physical\n  set alias "Guest"\n next\n edit "ha"\n  set type physical\n next\nend';
const switchConfig='hostname "LAB-CORE"\ninterface B11\n name "Firewall trusted"\n exit\ninterface B23\n name "Firewall guest"\n exit';
const inventory='Device Name,Type,Make & Model\nLAB-FW.example.test,Firewall,Fortinet FortiGate 200G\nLAB-CORE,Switch,HPE J9850A';
const report='Interface Name,Type,Parent Device,Oper Status,Negotiated Speed,Connected To\nha,Ethernet,LAB-FW.example.test,Up,1 Gbit/s,"B11 on LAB-CORE; B23 on LAB-CORE"\nport2 (Trusted),Ethernet,LAB-FW.example.test,Up,1 Gbit/s,B11 on LAB-CORE\nport4 (Guest),Ethernet,LAB-FW.example.test,Up,1 Gbit/s,B23 on LAB-CORE';
const file=(name,text)=>new File([text],name);
const files=()=>[file('fw.cfg',firewall),file('switch.cfg',switchConfig),file('inventory.csv',inventory),file('interfaces.csv',report)];
const device=(name,fields={})=>({id:name.toLowerCase(),name,kind:'firewall',ports:[],...fields});
const model=(devices,links=[],warnings=[])=>({devices,links,warnings});

test('a configured short hostname joins its single observed FQDN and recovers the actual data-port links',async()=>{
 const inputs=files(),direct=await importFiles(inputs),p=model([]);
 ensureEvidence(p).sources=await readSources(inputs);composeEvidence(p);
 for(const result of [direct,p]){
  assert.equal(result.devices.length,2);assert.equal(result.links.length,4);
  const fw=result.devices.find(d=>d.id==='lab-fw');assert.equal(fw.fromConfig,true);
  assert.deepEqual(fw.identityAliases,['LAB-FW.example.test']);
  assert.equal(findDeviceIdentity(result.devices,'lab-fw.example.test'),fw);
  assert.equal(fw.ports.find(p=>p.name==='port2').description,'Trusted');
  assert.equal(fw.ports.find(p=>p.name==='port2').state,'up');
  assert.deepEqual(physicalInventory(result).links.map(l=>[l.a,l.ap,l.b,l.bp]),[['lab-fw','port2','lab-core','B11'],['lab-fw','port4','lab-core','B23']]);
  assert.ok(result.links.every(l=>l.status==='observed'));
  assert.ok(result.links.every(l=>l.reportedEndpoints.some(e=>e.a==='lab-fw.example.test')));
  assert.equal(result.links.filter(l=>l.physicalEvidence?.kind==='alternate-interface').length,2);
  assert.ok(!result.warnings.some(w=>w.includes('multiple reported peers')));
  assert.deepEqual(mergeModels(result),{devices:result.devices,links:result.links,warnings:result.warnings});
 }
 assert.equal(p.evidence.sources.find(s=>s.name==='interfaces.csv').model.devices[0].id,'lab-fw.example.test');
 const before={devices:p.devices,links:p.links.map(l=>({...l})),warnings:p.warnings};
 p.links.find(l=>l.ap==='ha').status='confirmed';captureEdits(p,before);composeEvidence(p);
 assert.equal(physicalInventory(p).links.length,3);
});

test('hostname matching preserves domains, explicit identities, incompatible roles and numeric addresses',()=>{
 const collision=mergeModels(model([device('EDGE',{fromConfig:true}),device('edge.east.example'),device('edge.west.example')]));
 assert.equal(collision.devices.length,3);assert.ok(collision.warnings.some(w=>w.includes('multiple fully qualified names')));
 for(const devices of [
  [device('EDGE',{fromConfig:true}),device('edge.example',{fromConfig:true})],
  [device('EDGE',{id:'manual-id'}),device('edge.example')],
  [device('EDGE',{identityLocked:true}),device('edge.example')],
  [device('EDGE',{kind:'switch'}),device('edge.example')],
  [device('192'),device('192.0.2.1')]
 ])assert.equal(mergeModels(model(devices)).devices.length,2);
 const exact=mergeModels(model([device('EDGE.EAST.EXAMPLE',{fromConfig:true}),device('edge')]));
 assert.equal(exact.devices.length,1);assert.equal(exact.devices[0].id,'edge.east.example');
 const accepted=mergeModels(model([device('EDGE',{fromConfig:true}),device('edge.east.example')]));
 const later=mergeModels(accepted,model([device('edge.east.example'),device('edge.west.example')]));
 assert.equal(later.devices.length,2);assert.ok(later.devices.find(d=>d.id==='edge.west.example'));
});

test('alternate HA and management observations never erase standalone, confirmed or ambiguous connections',()=>{
 const devices=[device('fw',{ports:[{name:'ha'},{name:'mgmt'},{name:'port1'},{name:'port2'},{name:'VLAN20',type:'logical'}]}),device('sw',{kind:'switch',ports:[{name:'1'},{name:'2'}]})];
 const link=(ap,bp='1',extra={})=>({a:'fw',ap,b:'sw',bp,status:'observed',...extra});
 const single=mergeModels(model(devices,[link('ha')]));assert.equal(physicalInventory(single).links.length,1);
 const separate=mergeModels(model(devices,[link('ha','1'),link('port1','2')]));assert.equal(physicalInventory(separate).links.length,2);
 const mgmt=mergeModels(model(devices,[link('mgmt'),link('port1')]));assert.deepEqual(physicalInventory(mgmt).links.map(l=>l.ap),['port1']);
 const ambiguous=mergeModels(model(devices,[link('ha'),link('port1'),link('port2')]));assert.equal(physicalInventory(ambiguous).links.length,3);assert.ok(ambiguous.links.every(l=>l.status==='conflict'));
 const confirmed=mergeModels(model(devices,[link('ha','1',{status:'confirmed'}),link('port1')]));assert.equal(physicalInventory(confirmed).links.length,2);
 const unknown=mergeModels(model(devices,[link('ha'),link('Some Interface')]));assert.equal(physicalInventory(unknown).links.length,2);
 const logical=mergeModels(model(devices,[link('ha'),link('VLAN20')]));assert.deepEqual(physicalInventory(logical).links.map(l=>l.ap),['ha']);
 const other=mergeModels(model([...devices,device('other')],[link('ha'),{a:'other',ap:'port1',b:'sw',bp:'1'}]));assert.equal(physicalInventory(other).links.length,2);
});

test('old worksheet conflict annotations are recomputed without clearing unrelated explicit conflict statuses',()=>{
 const devices=[device('fw',{ports:[{name:'ha'},{name:'port1'}]}),device('sw',{kind:'switch',ports:[{name:'1'}]})];
 const rows=[{a:'fw',ap:'ha',b:'sw',bp:'1',status:'conflict'},{a:'fw',ap:'port1',b:'sw',bp:'1',status:'conflict'}];
 const recovered=mergeModels(model(devices,rows,['sw 1 has multiple reported peers. Verify physical adjacency.']));
 assert.equal(physicalInventory(recovered).links[0].status,'observed');
 const explicit=mergeModels(model(devices,[{...rows[1],status:'conflict'}]));assert.equal(explicit.links[0].status,'conflict');
});

test('source aliases preserve current observations and manual edits through configuration toggles and reopening',async()=>{
 const p=model([]),e=ensureEvidence(p);e.sources=await readSources(files().slice(2));
 let before=composeEvidence(p),fw=p.devices.find(d=>d.id==='lab-fw.example.test');
 fw.ports.find(p=>p.name==='port2').description='Reviewed uplink';
 p.links.find(l=>l.ap==='port2').description='Reviewed cable';captureEdits(p,before);
 const config=(await readSources(files().slice(0,2)));e.sources.push(...config);
 e.sources.push({id:'current',enabled:true,kind:'Show commands',categories:[...categories],model:model([device('LAB-FW.example.test',{ports:[{name:'port2',state:'up',speed:'100 Mbps',media:'100BASE-TX'}]})])});
 before=composeEvidence(p);fw=p.devices.find(d=>d.id==='lab-fw');
 assert.equal(fw.ports.find(p=>p.name==='port2').description,'Reviewed uplink');
 assert.equal(fw.ports.find(p=>p.name==='port2').speed,'100 Mbps');
 assert.equal(p.links.find(l=>l.ap==='port2').description,'Reviewed cable');
 fw.ports.find(p=>p.name==='port4').description='Reviewed guest';captureEdits(p,before);
 config[0].enabled=false;composeEvidence(p);
 assert.ok(!p.devices.some(d=>d.id==='lab-fw'));fw=p.devices.find(d=>d.id==='lab-fw.example.test');
 assert.equal(fw.ports.find(p=>p.name==='port4').description,'Reviewed guest');
 assert.equal(fw.ports.find(p=>p.name==='port2').description,'Reviewed uplink');
 const reopened=JSON.parse(JSON.stringify(p));composeEvidence(reopened);
 assert.equal(reopened.devices.find(d=>d.id==='lab-fw.example.test').ports.find(p=>p.name==='port4').description,'Reviewed guest');
 config[0].enabled=true;composeEvidence(p);assert.equal(p.devices.find(d=>d.id==='lab-fw').ports.find(p=>p.name==='port4').description,'Reviewed guest');
 for(const source of e.sources)source.enabled=false;composeEvidence(p);assert.deepEqual(p.devices,[]);assert.deepEqual(p.links,[]);
});

test('reversing a source category removes HA alternatives and regenerates only active adjacency warnings',()=>{
 const p=model([]),e=ensureEvidence(p);
 const source=(id,data)=>({id,kind:'Auvik',enabled:true,categories:[...categories],model:data});
 e.sources=[source('identity',parseTable(readCSV(inventory))),source('ports',parseTable(readCSV(report))),source('config',parseConfig(firewall))];
 composeEvidence(p);assert.equal(physicalInventory(p).links.length,2);
 e.sources[1].categories=['ports'];composeEvidence(p);assert.equal(p.links.length,0);assert.ok(!p.warnings.some(w=>w.includes('alternate HA/management')||w.includes('reported peers')));
 e.sources[1].categories=[...categories];composeEvidence(p);assert.equal(physicalInventory(p).links.length,2);
 e.sources[0].enabled=false;e.sources[2].enabled=false;composeEvidence(p);
 assert.equal(p.links.length,4);assert.ok(p.links.every(l=>physicalLink(l,p.devices)));assert.ok(p.warnings.some(w=>w.includes('multiple reported peers')));
});
