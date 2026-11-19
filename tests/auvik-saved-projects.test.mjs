import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureEvidence,composeEvidence,categories} from '../src/web/evidence.mjs';
import {physicalInventory} from '../src/web/physical-links.mjs';
import {parseTable} from '../src/web/imports/tables.mjs';
import {mergeModels} from '../src/web/imports/model.mjs';

// Fictional projects saved before preview.69, reopened with its rules.
const key=(a,ap,b,bp)=>JSON.stringify([a+'|'+ap.toLowerCase(),b+'|'+bp.toLowerCase()].sort());
const JETDIRECT='HP ETHERNET MULTI-ENVIRONMENT,ROM none,JETDIRECT,JD143,EEPROM V.36.41';
const project=(models,edits={},extra={})=>{const p={name:'Fictional site',devices:[],links:[],layout:{},...extra};ensureEvidence(p).sources.push(...models.map((model,i)=>({id:'input-'+i,name:'source '+i,kind:'Auvik',enabled:true,categories:[...categories],...(model.categories?{categories:model.categories}:{}),model:model.model||model})));p.evidence.edits=edits;composeEvidence(p);return p;};
const dev=(id,name,kind,ports,extra={})=>({id,name,kind,vendor:'',model:'',ports:ports.map(name=>({name,type:'Ethernet',state:'up'})),vlans:[],routes:[],...extra});

test('a deleted duplicate printer cable does not take the kept one with it',()=>{
 // The old import gave two cables on port 1; the user removed one and confirmed the other.
 const saved={devices:[dev('lab-core-01','LAB-CORE-01','switch',['1']),{...dev('lab-printer','LAB-PRINTER','printer',[JETDIRECT]),ports:[{name:JETDIRECT,type:'Ethernet',state:'up'},{name:'EEPROM V.36.41'}]}],links:[
  {a:'lab-core-01',ap:'1',b:'lab-printer',bp:'EEPROM V.36.41',media:'unknown',speed:'1 Gbps',status:'observed'},
  {a:'lab-printer',ap:JETDIRECT,b:'lab-core-01',bp:'1',media:'unknown',speed:'1 Gbps',status:'observed'}],warnings:[]};
 const edits={fields:{links:{rows:{[key('lab-printer',JETDIRECT,'lab-core-01','1')]:{remove:true},[key('lab-core-01','1','lab-printer','EEPROM V.36.41')]:{fields:{status:{set:'confirmed'}}}}}}};
 const p=project([saved],edits),cables=physicalInventory(p).links.filter(l=>[l.a,l.b].includes('lab-printer'));
 assert.equal(cables.length,1,'one printer cable');assert.equal(cables[0].status,'confirmed');
});

test('edits on an unidentified device follow it when the site export names it by address',()=>{
 const H=['Admin Status','Oper Status','Interface Name','MAC Address','Type','Parent Device','Negotiated Speed','Connected To','Configuration Details'];
 const switchExport=parseTable([['INTERFACES'],H,['Up','Up','20','02:00:00:00:01:6c','Ethernet','LAB-CORE-01','100 Mbit/s','Some Interface  on Unknown Name','VLAN 1 (DEFAULT_VLAN)']],'core.xlsx / Interfaces');
 const siteExport=parseTable([['DEVICES'],['Status','Device Name','Type','Make & Model','MAC Address(es)','IP Address(es)','Network(s)','Connected To'],['Up','Unknown Name','Generic Device','Fictional reader','02:00:00:00:09:65','192.0.2.65','192.0.2.0/24','LAB-CORE-01 through 20']],'site.xlsx / Devices');
 const edits={fields:{devices:{rows:{'unknown name':{fields:{name:{set:'Lobby badge reader'},notes:{set:'By the front door'}}}}}}};
 const p=project([mergeModels([switchExport]),mergeModels([siteExport])],edits),d=p.devices.find(d=>d.id==='unknown name (192.0.2.65)');
 assert.ok(d,'the device is named by its address');assert.equal(d.name,'Lobby badge reader');assert.equal(d.notes,'By the front door');
 assert.ok(!p.devices.some(d=>d.id==='unknown name'),'no bare placeholder');
 // With Identity off on the site export the placeholder still resolves.
 const q=project([mergeModels([switchExport]),{model:mergeModels([siteExport]),categories:categories.filter(c=>c!=='identity')}]);
 const ends=new Map();for(const l of physicalInventory(q).links)for(const e of [l.a+' '+l.ap,l.b+' '+l.bp])ends.set(e,(ends.get(e)||0)+1);
 assert.equal(ends.get('lab-core-01 20'),1,'one cable on port 20');
});

test('a joined cable gives way to the user\'s corrected cable on the same port',()=>{
 const saved={devices:[dev('lab-core','LAB-CORE','switch',['45','46']),dev('lab-remote','LAB-REMOTE','switch',['g9']),{...dev('lab-core','LAB-CORE','switch',[]),ports:[{name:'DEFAULT_VLAN',type:'Virtual NIC'}]},{...dev('lab-remote','LAB-REMOTE','switch',[]),ports:[{name:'VLAN1',type:'Virtual NIC'}]}],links:[
  {a:'lab-core',ap:'45',b:'lab-remote',bp:'VLAN1',media:'unknown',speed:'1 Gbps',status:'observed'},
  {a:'lab-core',ap:'DEFAULT_VLAN',b:'lab-remote',bp:'g9',media:'unknown',speed:'1 Gbps',status:'observed'}],warnings:[]};
 const corrected={a:'lab-core',ap:'46',b:'lab-remote',bp:'g9',media:'copper',speed:'1 Gbps',status:'confirmed'};
 const edits={fields:{links:{rows:{[key('lab-core','DEFAULT_VLAN','lab-remote','g9')]:{remove:true},[key('lab-core','46','lab-remote','g9')]:{set:corrected}}}}};
 const p=project([saved],edits),g9=physicalInventory(p).links.filter(l=>[l.a+' '+l.ap,l.b+' '+l.bp].includes('lab-remote g9'));
 assert.deepEqual(g9.map(l=>[l.a+' '+l.ap,l.b+' '+l.bp].sort().join(' <-> ')),['lab-core 46 <-> lab-remote g9']);
});

test('reopening keeps saved cable edits of a port whose description had brackets of its own',()=>{
 const old='42 (To firewall port 2(Management))';
 const saved={devices:[dev('lab-sw-a','LAB-SW-A','switch',[old]),dev('lab-srv-1','LAB-SRV-1','server',['Some Interface'])],links:[{a:'lab-sw-a',ap:old,b:'lab-srv-1',bp:'Some Interface',media:'copper',speed:'1 Gbps',status:'observed'}],warnings:[]};
 const oldKey='Core Network|path|lab-srv-1/Some Interface|lab-sw-a/'+old;
 const p=project([saved],{},{devices:structuredClone(saved.devices),links:structuredClone(saved.links),layout:{drawingEdits:{[oldKey]:{points:[[0,0],[0,10]]}}}});
 assert.ok(p.links.some(l=>l.ap==='42'||l.bp==='42'),'the port reads 42 now');
 assert.deepEqual(p.layout.drawingEdits['Core Network|path|lab-srv-1/Some Interface|lab-sw-a/42'],{points:[[0,0],[0,10]]});
});
