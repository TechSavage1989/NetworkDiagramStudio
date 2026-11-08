import test from 'node:test';
import assert from 'node:assert/strict';
import {inputMacAddresses,deviceMacs,deviceModel,macCaption,deviceDetails} from '../src/web/device-details.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';
import {parseTable,readCSV} from '../src/web/imports/tables.mjs';
import {parseOperational} from '../src/web/imports/operational.mjs';
import {composeEvidence,captureEdits,categories} from '../src/web/evidence.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {unzip} from '../src/web/zip.mjs';

function wirelessSite(){
 const sw={id:'sw',name:'LAB-SWITCH',kind:'switch',vendor:'Aruba',model:'JL675A',ports:Array.from({length:52},(_,i)=>({name:'1/1/'+(i+1)}))};
 const aps=Array.from({length:8},(_,i)=>({id:'ap-'+i,name:'LAB-AP-'+(i+1),kind:'ap',vendor:'Aruba',model:'AP-515',mac:'02:00:00:00:00:0'+i,ip:'192.0.2.'+(i+40),ports:[{name:'eth0'}]}));
 return {name:'Wireless lab',devices:[sw,...aps],links:aps.map((d,i)=>({a:'sw',ap:'1/1/'+(41+i),b:d.id,bp:'eth0',media:'copper',speed:'1 Gbps'}))};
}
function assertClear(page){
 const texts=page.items.filter(i=>i.type==='text'),bodies=page.items.filter(i=>i.type==='device'),paths=page.items.filter(i=>i.type==='path');
 for(const item of texts.filter(i=>i.deviceInfo)){
  assert.ok(item.y>=150&&item.y+item.h<=920);assert.equal(textLayout(item).size,item.size);
  assert.equal(textLayout(item).lines.join('').replace(/\s/g,''),item.value.replace(/\s/g,''));
  assert.ok(!texts.some(other=>other!==item&&intersects(item,other)),'caption overlaps text');
  assert.ok(!bodies.some(body=>intersects(item,body)),'caption overlaps hardware');
  assert.ok(!paths.some(path=>pathCrossesText(path,item)),'caption overlaps cable');
 }
}

test('MAC entry accepts standard forms, deduplicates and rejects malformed values',()=>{
 assert.equal(inputMacAddresses('0200.0000.00ab, 02-00-00-00-00-AB 0200000000cd'),'02:00:00:00:00:AB, 02:00:00:00:00:CD');
 assert.equal(inputMacAddresses(''),'');assert.throws(()=>inputMacAddresses('02:00:00:00:00:ZZ'),/Enter MAC/);
 assert.deepEqual(deviceMacs({macAddress:'0200.0000.00ab',macAddresses:['02:00:00:00:00:AB','N/A']}),['02:00:00:00:00:AB']);
 assert.equal(deviceModel({vendor:'Aruba',model:'Aruba AP-515'}),'Aruba AP-515');assert.equal(deviceModel({}),'');
});

test('eight APs retain one wireless page with full manufacturer, model and MAC captions clear of hardware and links',()=>{
 const site=wirelessSite(),pages=buildPages(site).filter(p=>p.title==='Wireless Connections');assert.equal(pages.length,1);
 assert.equal(pages[0].items.filter(i=>i.deviceInfo==='model').length,8);assert.equal(pages[0].items.filter(i=>i.deviceInfo==='mac').length,8);assertClear(pages[0]);
 for(const d of site.devices.slice(1)){assert.ok(pages[0].svg.includes('Aruba | AP-515'));assert.ok(pages[0].svg.includes(d.mac));}
});

test('unknown MACs stay absent and interface fallback uses only the AP connected interface',()=>{
 const site=wirelessSite(),d=site.devices[1];delete d.mac;d.ports=[{name:'eth0',mac:'0200.0000.00aa'},{name:'radio0',mac:'0200.0000.00bb'}];
 assert.equal(macCaption(d,'eth0'),'MAC 02:00:00:00:00:AA');assert.equal(macCaption(d,'eth1'),'');
 let page=buildPages(site).find(p=>p.title==='Wireless Connections');assert.equal(page.items.find(i=>i.deviceInfo==='mac'&&i.sourceId===d.id).value,'MAC 02:00:00:00:00:AA');
 d.ports=[];page=buildPages(site).find(p=>p.title==='Wireless Connections');assert.ok(!page.items.some(i=>i.deviceInfo==='mac'&&i.sourceId===d.id));
});

test('edited long AP identity captions wrap and preserve stable keys through pagination, reorder and project reopening',()=>{
 const site=wirelessSite(),item=buildPages(site).flatMap(p=>p.items).find(i=>i.deviceInfo==='model'&&i.sourceId==='ap-1'),value='Aruba AP-515 - '+Array.from({length:65},(_,i)=>'Location'+i).join(' ');
 site.layout={drawingEdits:{[item.editKey]:{value,color:'#224466'}}};site.devices.reverse();
 const reopened=JSON.parse(JSON.stringify(site));reopened.layout=cleanLayout(reopened.layout,reopened.devices.map(d=>d.id));
 const pages=buildPages(reopened).filter(p=>p.title==='Wireless Connections'),edited=pages.flatMap(p=>p.items).filter(i=>i.editKey===item.editKey);assert.equal(edited.length,1);assert.equal(edited[0].value,value);assert.equal(edited[0].color,'#224466');pages.forEach(assertClear);
});

test('phones, printers and servers show editable model and MAC details in native diagrams and Visio',async()=>{
 const site={name:'Endpoint lab',devices:['phone','printer','server'].map((kind,i)=>({id:kind,name:'LAB-'+kind.toUpperCase(),kind,vendor:'Example',model:'Lab '+kind,ip:'192.0.2.'+(10+i),mac:'02:00:00:00:01:0'+i,ports:[]})),links:[]};
 const pages=buildPages(site),items=pages.flatMap(p=>p.items);
 for(const d of site.devices){const detail=items.find(i=>i.titleOwner===d.id&&i.titleSlot==='detail');assert.ok(detail.editKey);assert.ok(detail.value.includes(d.model));assert.ok(detail.value.includes('MAC '+d.mac));assert.equal(textLayout(detail).size,12);}
 const parts=await unzip(await exportVisio(site,pages).arrayBuffer()),xml=[...parts].filter(([path])=>/^visio\/pages\/page\d+\.xml$/.test(path)).map(([,b])=>new TextDecoder().decode(b)).join('');
 for(const d of site.devices){assert.ok(xml.includes(d.model));assert.ok(xml.includes(d.mac));}
 const wireless=wirelessSite(),wirelessPages=buildPages(wireless),wirelessParts=await unzip(await exportVisio(wireless,wirelessPages).arrayBuffer()),wirelessXml=[...wirelessParts].filter(([path])=>/^visio\/pages\/page\d+\.xml$/.test(path)).map(([,b])=>new TextDecoder().decode(b)).join('');
 assert.ok(wirelessXml.includes('AP-515'));assert.ok(wirelessXml.includes(wireless.devices[1].mac));
});

test('reported device and interface MACs retain source selection and manual corrections',()=>{
 const devices=parseTable(readCSV('Device Name,Type,Make & Model,MAC Address(es)\nLAB-PHONE,IP Phone,Example handset,0200.0000.00aa'));
 const ports=parseTable(readCSV('Interface Name,Parent Device,MAC Address\neth0,LAB-PHONE,02-00-00-00-00-BB'));
 const site={devices:[],links:[],warnings:[],evidence:{base:{devices:[],links:[],warnings:[]},sources:[{id:'devices',enabled:true,categories:[...categories],model:devices},{id:'ports',enabled:true,categories:[...categories],model:ports}],edits:{}}};
 const snapshot=composeEvidence(site);assert.equal(site.devices[0].mac,'02:00:00:00:00:AA');assert.equal(site.devices[0].ports[0].mac,'02:00:00:00:00:BB');
 site.devices[0].mac='02:00:00:00:00:CC';captureEdits(site,snapshot);site.evidence.sources[0].enabled=false;composeEvidence(site);assert.equal(site.devices[0].mac,'02:00:00:00:00:CC');
});

test('operational chassis and interface MACs are assigned to the right device, never to learned peers on the local switch',()=>{
 const report=parseOperational('LAB-SW# show version\nBase ethernet MAC Address : 0200.0000.0001\nLAB-SW# show interface Gi1/0/1\nGi1/0/1 is up\nHardware is Gigabit Ethernet, address is 0200.0000.0002 (bia 0200.0000.0002)\nLAB-SW# show lldp neighbors detail\nLocal Port: Gi1/0/1\nChassis id: 0200.0000.0003\nSystem Name: LAB-AP\nPort id: eth0\nSystem Capabilities: WLAN\nLAB-SW# show mac address-table\nMAC address: 0200.0000.0099');
 const sw=report.devices.find(d=>d.name==='LAB-SW'),ap=report.devices.find(d=>d.name==='LAB-AP');assert.equal(sw.mac,'02:00:00:00:00:01');assert.equal(sw.ports[0].mac,'02:00:00:00:00:02');assert.equal(ap.mac,'02:00:00:00:00:03');assert.equal(ap.kind,'ap');assert.ok(!JSON.stringify(report).includes('00:99'));
});

const manyMacs=()=>Array.from({length:512},(_,i)=>'02:00:00:'+i.toString(16).padStart(6,'0').match(/../g).join(':').toUpperCase());

test('aggregated inventory MACs stay complete in saved data but use a compact diagram caption',async()=>{
 const addresses=manyMacs(),imported=parseTable(readCSV('Device Name,Type,Make & Model,IP Address(es),MAC Address(es)\nLAB-STACK,Switch,HPE JL558A,192.0.2.10,"'+addresses.join(', ')+'"'));
 const project={name:'Address summary lab',...imported},saved=JSON.stringify(project),d=project.devices[0],pages=buildPages(project),detail=pages[0].items.find(i=>i.titleOwner===d.id&&i.titleSlot==='detail');
 assert.equal(deviceMacs(d).length,512);assert.equal(macCaption(d),'512 MAC addresses');assert.ok(deviceDetails(d).includes('192.0.2.10'));assert.ok(detail.h<50);assert.ok(detail.value.includes('512 MAC addresses'));assert.ok(!detail.value.includes(addresses[0]));assert.equal(textLayout(detail).size,12);
 const reopened=JSON.parse(saved);assert.deepEqual(deviceMacs(reopened.devices[0]),addresses);assert.equal(buildPages(reopened)[0].svg,pages[0].svg);assert.equal(JSON.stringify(project),saved);
 const files=await unzip(await exportVisio(project,pages).arrayBuffer()),xml=new TextDecoder().decode(files.get('visio/pages/page1.xml'));assert.ok(xml.includes('512 MAC addresses'));assert.ok(!xml.includes(addresses.at(-1)));
});

test('interface address summaries retain the named connected-interface fallback and full details',()=>{
 const addresses=manyMacs(),d={ports:addresses.map((mac,i)=>({name:'port'+i,mac}))};
 assert.equal(macCaption(d),'512 interface MAC addresses');assert.equal(macCaption(d,'port17'),'MAC '+addresses[17]);assert.equal(macCaption(d,'missing'),'');
 const full=macCaption(d,undefined,{full:true});assert.ok(full.includes('MAC port0 '+addresses[0]));assert.ok(full.includes('MAC port511 '+addresses[511]));
 d.ports[1].mac=d.ports[0].mac;assert.equal(macCaption(d),'511 interface MAC addresses');assert.equal(macCaption({ports:[{name:'eth0',mac:addresses[0]}]}),'MAC eth0 '+addresses[0]);
});

test('full address lists appear only in the selected address panel and keep manual captions authoritative',()=>{
 const addresses=manyMacs(),project={name:'Address panel lab',devices:[{id:'sw',name:'LAB-SW',kind:'switch',model:'JL558A',macAddresses:addresses,ports:[]}],links:[]},plain=buildPages(project)[0],detail=plain.items.find(i=>i.titleSlot==='detail');
 assert.ok(!plain.svg.includes(addresses.at(-1)));project.layout={presentation:{defaults:{panel:{position:'right',sections:['addresses','models']}}},drawingEdits:{[detail.editKey]:{value:'Approved device caption'}}};
 const page=buildPages(project)[0],addressRow=page.items.find(i=>i.editKey?.includes('|info-panel|addresses|0')),modelRow=page.items.find(i=>i.editKey?.includes('|info-panel|models|0'));
 assert.ok(addressRow);for(const mac of addresses)assert.ok(addressRow.value.includes(mac));assert.ok(modelRow.value.includes('512 MAC addresses'));assert.ok(!modelRow.value.includes(addresses.at(-1)));assert.equal(page.items.find(i=>i.editKey===detail.editKey).value,'Approved device caption');assert.deepEqual(deviceMacs(project.devices[0]),addresses);
});
