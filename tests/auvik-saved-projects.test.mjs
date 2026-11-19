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

// Second review round.
const drawn=p=>physicalInventory(p).links.map(l=>[l.a+' '+l.ap,l.b+' '+l.bp].sort().join(' <-> ')).sort();
const H=['Admin Status','Oper Status','Interface Name','MAC Address','Type','Parent Device','Negotiated Speed','Connected To','Configuration Details'];
const iface=(name,type,parent,connected)=>['Up','Up',name,'',type,parent,'1.0 Gbit/s',connected,''];

test('one switch export alone keeps the joined uplink beside an endpoint seen on the same port',()=>{
 const rows=[['INTERFACES'],H,iface('45','Ethernet','LAB-CORE-01','VLAN1  on LAB-REMOTE-SW, Some Interface  on LAB-PHONE'),iface('DEFAULT_VLAN','Virtual NIC','LAB-CORE-01','g9  on LAB-REMOTE-SW')];
 const p=project([mergeModels([parseTable(rows,'core.xlsx / Interfaces')])]);
 assert.ok(drawn(p).includes('lab-core-01 45 <-> lab-remote-sw g9'),drawn(p).join(' | '));
});

test('an endpoint whose drawn target is a joined cable keeps a cable after composition',()=>{
 const dev2=(id,kind,ports)=>({id,name:id.toUpperCase(),kind,vendor:'',model:'',ports:ports.map(p=>typeof p==='string'?{name:p,type:'Ethernet',state:'up'}:p),vlans:[],routes:[]});
 const l=(a,ap,b,bp)=>({a,ap,b,bp,media:'unknown',speed:'1 Gbps',status:'observed'});
 const saved={devices:[dev2('lab-x','switch',['1']),dev2('lab-s','switch',['24','5',{name:'DEFAULT_VLAN',type:'Virtual NIC'}]),dev2('lab-e','server',['eth0',{name:'vEthernet',type:'Virtual NIC'}]),dev2('lab-phone','phone',['lan'])],links:[l('lab-x','1','lab-s','24'),l('lab-x','1','lab-e','eth0'),l('lab-e','eth0','lab-s','DEFAULT_VLAN'),l('lab-s','5','lab-e','vEthernet'),l('lab-s','5','lab-phone','lan')],warnings:[]};
 const p=project([saved]);
 assert.ok(drawn(p).some(c=>c.includes('lab-e ')),'the server keeps a drawn cable: '+drawn(p).join(' | '));
 for(const w of p.warnings.filter(w=>/drawing uses/.test(w))){const m=/drawing uses (\S+) (\S+)\.$/.exec(w);if(m&&/^LAB-/.test(m[1]))assert.ok(drawn(p).some(c=>c.includes(m[1].toLowerCase()+' '+m[2])),w);}
});

test('a deliberate deletion of a merged printer cable sticks, and removing only the cut duplicate keeps it',async()=>{
 const {captureEdits}=await import('../src/web/evidence.mjs');
 const saved=()=>({devices:[dev('lab-core-01','LAB-CORE-01','switch',['1']),{...dev('lab-printer','LAB-PRINTER','printer',[JETDIRECT]),ports:[{name:JETDIRECT,type:'Ethernet',state:'up'},{name:'EEPROM V.36.41'}]}],links:[
  {a:'lab-core-01',ap:'1',b:'lab-printer',bp:'EEPROM V.36.41',media:'unknown',speed:'1 Gbps',status:'observed'},
  {a:'lab-printer',ap:JETDIRECT,b:'lab-core-01',bp:'1',media:'unknown',speed:'1 Gbps',status:'observed'}],warnings:[]});
 const printer=p=>physicalInventory(p).links.filter(l=>[l.a,l.b].includes('lab-printer'));
 // Only the cut-name duplicate was removed in the old release.
 assert.equal(printer(project([saved()],{fields:{links:{rows:{[key('lab-core-01','1','lab-printer','EEPROM V.36.41')]:{remove:true}}}}})).length,1);
 // The old confirmation follows the merged cable; deleting it now removes it for good.
 const p=project([saved()],{fields:{links:{rows:{[key('lab-core-01','1','lab-printer','EEPROM V.36.41')]:{fields:{status:{set:'confirmed'}}}}}}});
 assert.equal(printer(p)[0].status,'confirmed');
 const before=structuredClone({devices:p.devices,links:p.links,warnings:p.warnings});
 p.links=p.links.filter(l=>![l.a,l.b].includes('lab-printer'));captureEdits(p,before);composeEvidence(p);
 assert.equal(printer(p).length,0,'the deleted cable stays deleted');
});

test('a shared placeholder name is not saved as a lasting identity',()=>{
 const switchExport=parseTable([['INTERFACES'],H,iface('20','Ethernet','LAB-CORE-01','Some Interface  on Unknown Name')],'core.xlsx / Interfaces');
 const siteExport=parseTable([['DEVICES'],['Status','Device Name','Type','Make & Model','MAC Address(es)','IP Address(es)','Network(s)','Connected To'],['Up','Unknown Name','Generic Device','Fictional reader','02:00:00:00:09:65','192.0.2.65','192.0.2.0/24','LAB-CORE-01 through 20']],'site.xlsx / Devices');
 const p=project([mergeModels([switchExport]),mergeModels([siteExport])]);
 assert.ok(!(p.evidence.identityGroups||[]).some(group=>group.includes('unknown name')),JSON.stringify(p.evidence.identityGroups));
});

test('saved edits of a port renamed on reopen apply to the renamed cable',()=>{
 const old='42 (To firewall port 2(Management))';
 const saved=()=>({devices:[dev('lab-sw-a','LAB-SW-A','switch',[old]),dev('lab-srv-1','LAB-SRV-1','server',['nic1'])],links:[{a:'lab-sw-a',ap:old,b:'lab-srv-1',bp:'nic1',media:'unknown',speed:'1 Gbps',status:'observed'}],warnings:[]});
 const confirmed=project([saved()],{fields:{links:{rows:{[key('lab-sw-a',old,'lab-srv-1','nic1')]:{fields:{status:{set:'confirmed'},media:{set:'fiber'}}}}}}});
 const cable=confirmed.links.find(l=>[l.a,l.b].includes('lab-srv-1'));
 assert.equal(cable.status,'confirmed');assert.equal(cable.media,'fiber');
 const removed=project([saved()],{fields:{links:{rows:{[key('lab-sw-a',old,'lab-srv-1','nic1')]:{remove:true}}}}});
 assert.ok(!removed.links.some(l=>[l.a,l.b].includes('lab-srv-1')),'a deleted cable stays deleted');
});

test('a corrected cable saved under the old full hostname still replaces the joined cable',()=>{
 // Auvik knows the remote switch by its FQDN; a later configuration names it by the short name.
 const auvik={devices:[dev('lab-core','LAB-CORE','switch',['45','46']),{...dev('lab-core','LAB-CORE','switch',[]),ports:[{name:'DEFAULT_VLAN',type:'Virtual NIC'}]},dev('lab-remote.example.net','lab-remote.example.net','switch',['g9']),{...dev('lab-remote.example.net','lab-remote.example.net','switch',[]),ports:[{name:'VLAN1',type:'Virtual NIC'}]}],links:[
  {a:'lab-core',ap:'45',b:'lab-remote.example.net',bp:'VLAN1',media:'unknown',speed:'1 Gbps',status:'observed'},
  {a:'lab-core',ap:'DEFAULT_VLAN',b:'lab-remote.example.net',bp:'g9',media:'unknown',speed:'1 Gbps',status:'observed'}],warnings:[]};
 const config={devices:[dev('lab-remote','lab-remote','switch',['g9'],{fromConfig:true})],links:[],warnings:[]};
 const corrected={a:'lab-core',ap:'46',b:'lab-remote.example.net',bp:'g9',media:'copper',speed:'1 Gbps',status:'confirmed'};
 const edits={fields:{links:{rows:{[key('lab-core','46','lab-remote.example.net','g9')]:{set:corrected}}}}};
 const p=project([auvik,{...config,kind:'Configuration'}],edits),ids=new Set(p.devices.map(d=>d.id));
 const g9=physicalInventory(p).links.filter(l=>[l.a+' '+l.ap,l.b+' '+l.bp].some(end=>/^lab-remote(\.example\.net)? g9$/.test(end)));
 assert.equal(g9.length,1,'one cable on g9: '+drawn(p).join(' | ')+' devices '+[...ids].join(','));
 assert.ok([g9[0].a+' '+g9[0].ap,g9[0].b+' '+g9[0].bp].includes('lab-core 46'));
});
