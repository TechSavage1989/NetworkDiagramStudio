import test from 'node:test';
import assert from 'node:assert/strict';
import {importReportSupplementary,supplementaryFromText,supplementaryFromTables,supplementaryCsv,normalizeSupplementarySources,supplementaryInterfaceKey} from '../src/web/reports/supplementary.mjs';
import {workbookTables} from '../src/web/imports/tables.mjs';
import {enrichSwitchportSources} from '../src/web/switchport-import.mjs';
import {readSources,ensureEvidence,composeEvidence} from '../src/web/evidence.mjs';
import {arubaConfig,auvikWorkbook,auvikTables,zipFixture} from './fixtures/switchport-inputs.mjs';
const devices=[{id:'lab-access',name:'LAB-ACCESS'}],file=(name,data)=>new File([data],name);
const command='LAB-ACCESS# show interfaces\n1 is down, line protocol is down\nInternet address is 192.0.2.1/24\nip helper-address 192.0.2.254\npassword NEVER-IMPORT-SECRET\n\nLAB-ACCESS# show lldp neighbors detail\nLocal Intf: 1\nSystem Name: LAB-PEER\nPort id: Gi1/0/1\n\nLAB-ACCESS# show ip route\nS* 0.0.0.0/0 [1/0] via 192.0.2.254\nC 192.0.2.0/24 is directly connected, VLAN10\n';
test('supplementary text retains operational evidence, routes, relay and neighbor provenance while redacting secrets',()=>{
 const source=supplementaryFromText(command,'fictional.log','LAB-ACCESS'),rows=source.observations;normalizeSupplementarySources([source]);
 for(const category of ['Interface','Neighbor','IP interface','DHCP relay','Route','Reference'])assert.ok(rows.some(row=>row.category===category),category);
 assert.ok(rows.some(row=>row.value==='LAB-PEER / Gi1/0/1'));assert.ok(rows.some(row=>row.value==='[REDACTED]'));assert.ok(!JSON.stringify(source).includes('NEVER-IMPORT-SECRET'));assert.ok(!('ports' in source));assert.equal(supplementaryInterfaceKey('GigabitEthernet1/0/1'),'gi1/0/1');
 assert.throws(()=>supplementaryFromText('binary\0data','bad.log','LAB'),/binary/);assert.throws(()=>supplementaryFromText('hostname LAB\nvlan 10','config.txt','LAB'),/No supported/);
 const large=supplementaryFromText('LAB# show interfaces '+ 'x'.repeat(100)+'\n1 is up, line protocol is up','long.log','LAB');assert.doesNotThrow(()=>normalizeSupplementarySources([large]));
});
test('all six Auvik sheets use explicit workbook relationships and preserve independent device records',async()=>{
 const book=file('fictional.xlsx',auvikWorkbook(auvikTables())),original=await workbookTables(book),result=await importReportSupplementary(book,devices);assert.deepEqual(original.map(table=>table.name),['Devices','Interfaces','Routes']);
 assert.equal(result.length,1);assert.equal(result[0].deviceId,'lab-access');const source=result[0].source;assert.ok(source.observations.some(row=>row.field==='Software version'));for(const category of ['Device','Interface','Neighbor','Reference','Route','ARP','MAC table'])assert.ok(source.observations.some(row=>row.category===category),category);assert.ok(!JSON.stringify(result).includes('UNRELATED'));assert.ok(!JSON.stringify(result).includes('NEVER-IMPORT-SECRET'));assert.equal(source.observations.find(row=>row.field==='Admin status').value,'Up');
 const csv=await importReportSupplementary(file('interfaces.csv','Parent Device,Interface Name,Admin Status,Oper Status,Connected To\nLAB-ACCESS,1,Up,Down,LAB-PEER / 1'),devices);assert.equal(csv[0].source.observations.find(row=>row.field==='Operational status').value,'Down');
});
test('supplementary ownership accepts unique short/FQDN identities and rejects ambiguous workspaces and captures',async()=>{
 const tables=auvikTables();tables[0].rows[2][0]='LAB-ACCESS.example.test';assert.equal(supplementaryFromTables(tables,'site.xlsx',devices)[0].deviceId,'lab-access');
 const ambiguous=[{name:'Devices',rows:[[],['Device Name','Make & Model'],['EDGE.east.example','JL256A'],['EDGE.west.example','JL256A']]}];assert.throws(()=>supplementaryFromTables(ambiguous,'site.xlsx',[{id:'edge',name:'EDGE'}]),/multiple fully qualified/);
 const exact=supplementaryFromTables(ambiguous,'site.xlsx',[{id:'east',name:'EDGE.east.example'},{id:'west',name:'EDGE.west.example'}]);assert.deepEqual(exact.map(row=>row.deviceId),['east','west']);assert.ok(exact.every(row=>row.source.observations.length===1));
 await assert.rejects(importReportSupplementary(file('unknown.log','show interfaces\n1 is down, line protocol is down'),[...devices,{id:'other',name:'OTHER'}]),/Select one device/);
 await assert.rejects(importReportSupplementary(file('mixed.log',command+'\nOTHER# show interfaces\n1 is up, line protocol is up'),[...devices,{id:'other',name:'OTHER'}]),/Select one device/);
 assert.equal((await importReportSupplementary(file('known.log',command),[...devices,{id:'other',name:'OTHER'}]))[0].deviceId,'lab-access');
});
test('supplementary limits, XML restrictions and CSV formula protection apply before persistence or export',async()=>{
 await assert.rejects(importReportSupplementary({name:'too-big.xlsx',size:25_000_001},devices),/25 MB/);
 const dtd=file('bad.xlsx',zipFixture({'xl/workbook.xml':'<!DOCTYPE x [<!ENTITY leaked SYSTEM "file:///etc/passwd">]><workbook/>','xl/_rels/workbook.xml.rels':'<Relationships/>'}));await assert.rejects(importReportSupplementary(dtd,devices),/DTD/);
 const source=supplementaryFromText(command,'fictional.log','LAB-ACCESS');source.observations.push({category:'Reference',interface:'1',field:'Formula',value:'=2+2'});const csv=supplementaryCsv([source]);assert.ok(csv.startsWith('\uFEFFSource,Type,Device,Category,Interface,Field,Observed value'));assert.ok(csv.includes('"\'=2+2"'));assert.ok(!csv.includes('NEVER-IMPORT-SECRET'));assert.equal(supplementaryCsv([{...source,enabled:false}]).split('\r\n').length,2);
 assert.throws(()=>normalizeSupplementarySources(Array.from({length:21},()=>source)),/20/);assert.throws(()=>normalizeSupplementarySources([{...source,observations:Array.from({length:5001},()=>source.observations[0])}]),/metadata/);
});
test('native supplementary bridge is preferred and preserves the same selected-device contract',async t=>{
 const previous=globalThis.NDSDesktop,source=supplementaryFromText(command,'fictional.log','LAB-ACCESS');let request;
 globalThis.NDSDesktop={report:async(action,input)=>{request={action,...input};return {sources:{'LAB-ACCESS':source}};}};t.after(()=>{globalThis.NDSDesktop=previous;});
 const result=await importReportSupplementary(file('fictional.log',command),devices);assert.equal(request.action,'supplementary');assert.deepEqual(request.deviceNames,['LAB-ACCESS']);assert.equal(Buffer.from(request.data,'base64').toString(),command);assert.deepEqual(result,[{deviceId:'lab-access',source}]);
});
test('mixed drops attach report observations in either order and source toggles remove only their own evidence',async()=>{
 for(const reversed of [false,true]){
  const inputs=[file('fictional.cfg',arubaConfig),file('observations.xlsx',auvikWorkbook(auvikTables())),file('commands.log',command)];if(reversed)inputs.reverse();
  const project={devices:[],links:[],warnings:[]},sources=await readSources(inputs);await enrichSwitchportSources(inputs,sources);ensureEvidence(project).sources=sources;composeEvidence(project);
  let target=project.devices.find(device=>device.id==='lab-access');assert.equal(target.reportSupplementary.length,2);assert.equal(target.ports.find(port=>port.name==='1').native,10);
  const workbook=sources.find(source=>source.name==='observations.xlsx'),commands=sources.find(source=>source.name==='commands.log');workbook.enabled=false;composeEvidence(project);target=project.devices.find(device=>device.id==='lab-access');assert.equal(target.reportSupplementary.length,1);assert.equal(target.reportSupplementary[0].kind,'Command output');
  commands.enabled=false;composeEvidence(project);target=project.devices.find(device=>device.id==='lab-access');assert.equal(target.reportSupplementary?.length||0,0);assert.equal(target.ports.find(port=>port.name==='1').native,10);
  workbook.enabled=true;commands.enabled=true;composeEvidence(project);assert.equal(project.devices.find(device=>device.id==='lab-access').reportSupplementary.length,2);
 }
});
