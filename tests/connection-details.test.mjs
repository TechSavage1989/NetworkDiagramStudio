import test from 'node:test';
import assert from 'node:assert/strict';
import {checkConnection,prepareConnection} from '../src/web/connection-edit.mjs';
import {ensureEvidence,captureEdits,composeEvidence,categories} from '../src/web/evidence.mjs';

const fixture=()=>({
 devices:[
  {id:'edge',name:'LAB-EDGE',kind:'firewall',ports:[{name:'x1',description:'Original uplink',speed:'10 Gbps',tagged:[20]}],notes:'Keep device fields'},
  {id:'switch',name:'LAB-SWITCH',kind:'switch',ports:[{name:'uplink',description:'Original peer'}]},
  {id:'other',name:'LAB-OTHER',kind:'switch',ports:[{name:'spare'}]}
 ],
 links:[{a:'edge',ap:'x1',b:'switch',bp:'uplink',media:'SR',speed:'10 Gbps',status:'confirmed',description:'Keep link fields',reportedEndpoints:[{ap:'old'}]}],
 stencils:{}
});
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}

test('connection preparation is immutable and preserves unchanged endpoint and link metadata',()=>{
 const project=freeze(fixture()),before=structuredClone(project),result=prepareConnection(project,{media:'DAC',speed:'25 Gbps'},0);
 assert.deepEqual(project,before);assert.notEqual(result.devices,project.devices);assert.notEqual(result.links,project.links);
 for(const index of [0,1]){assert.notEqual(result.devices[index],project.devices[index]);assert.notEqual(result.devices[index].ports,project.devices[index].ports);assert.deepEqual(result.devices[index],project.devices[index]);}
 assert.equal(result.devices[2],project.devices[2]);assert.notEqual(result.links[0],project.links[0]);
 assert.deepEqual(result.links[0],{...project.links[0],media:'DAC',speed:'25 Gbps'});assert.equal(result.devices[0].ports[0].speed,'10 Gbps');
});

test('new connections preserve other records and add missing endpoint ports once',()=>{
 const project=fixture();project.links.push({a:'other',ap:'spare',b:'switch',bp:'secondary',description:'Other cable'});project.devices[1].ports.push({name:'secondary'});
 const before=structuredClone(project),result=prepareConnection(freeze(project),{a:'edge',ap:' x2 ',b:'switch',bp:'new-port',media:'copper',speed:'1 Gbps',extra:'Kept'});
 assert.deepEqual(project,before);assert.equal(result.links.length,3);assert.equal(result.links[0],project.links[0]);assert.equal(result.links[1],project.links[1]);
 assert.deepEqual(result.links[2],{a:'edge',ap:'x2',b:'switch',bp:'new-port',media:'copper',speed:'1 Gbps',extra:'Kept'});
 assert.deepEqual(result.devices[0].ports.at(-1),{name:'x2'});assert.deepEqual(result.devices[1].ports.at(-1),{name:'new-port'});
 const again=prepareConnection({...project,...result},{speed:'2.5 Gbps'},2);assert.equal(again.devices[0].ports.filter(p=>p.name==='x2').length,1);assert.equal(again.devices[1].ports.filter(p=>p.name==='new-port').length,1);
});

test('connection preparation rejects unavailable devices, invalid endpoints and occupied physical aliases atomically',()=>{
 const project=fixture();project.devices[0].stencilId='edge-panel';project.stencils['edge-panel']={anchors:{x1:[.1,.2],alias:[.1,.2],x2:[.3,.2]}};freeze(project);const before=structuredClone(project);
 assert.throws(()=>prepareConnection(project,{a:'missing',ap:'p1',b:'switch',bp:'free'}),/endpoint device is unavailable/);
 assert.throws(()=>checkConnection(project,{a:'missing',ap:'p1',b:'switch',bp:'free'}),/endpoint device is unavailable/);
 assert.throws(()=>prepareConnection(project,{a:'edge',ap:'x2',b:'edge',bp:'x3'}),/distinct devices/);
 assert.throws(()=>prepareConnection(project,{a:'edge',ap:' ',b:'switch',bp:'free'}),/choose a port/);
 assert.throws(()=>prepareConnection(project,{a:'edge',ap:'ALIAS',b:'switch',bp:'free'}),/already connected/);
 assert.doesNotThrow(()=>prepareConnection(project,{ap:'alias',media:'Custom cable'},0));
 assert.throws(()=>prepareConnection(project,{media:'DAC'},3),/connection is unavailable/);assert.throws(()=>prepareConnection(project,{},-2),/connection is unavailable/);
 assert.deepEqual(project,before);
});

test('generated handoffs materialize only when selected and never replace an existing device',()=>{
 const project=freeze(fixture()),handoff=freeze({id:'generated-wan',name:'LAB-HANDOFF',kind:'handoff',gateway:'192.0.2.1',ports:[{name:'handoff',description:'Provider demarcation'}],extra:'Retain generated fields'});
 const result=prepareConnection(project,{a:'generated-wan',ap:'handoff',b:'edge',bp:'port1',media:'copper',speed:'1 Gbps'},-1,handoff);
 assert.equal(result.devices.length,4);assert.equal(project.devices.length,3);assert.notEqual(result.devices[3],handoff);assert.notEqual(result.devices[3].ports,handoff.ports);assert.deepEqual(result.devices[3],{...handoff,scopeOverride:true});
 const again=prepareConnection({...project,...result},{speed:'100 Mbps'},1,{...handoff,name:'Do not overwrite',ports:[]});
 assert.equal(again.devices.filter(d=>d.id==='generated-wan').length,1);assert.equal(again.devices[3].name,'LAB-HANDOFF');assert.equal(again.devices[3].ports[0].description,'Provider demarcation');
 const unrelated=prepareConnection(project,{media:'DAC'},0,handoff);assert.equal(unrelated.devices.length,3);
 const withoutPorts=prepareConnection(project,{a:'empty-wan',ap:'demarc',b:'edge',bp:'port1'},-1,{id:'empty-wan',name:'LAB-EMPTY',kind:'handoff'});assert.deepEqual(withoutPorts.devices.at(-1).ports,[{name:'demarc'}]);
 const intentionallyHidden={...project,...result,devices:result.devices.map(d=>d.id===handoff.id?{...d,scopeOverride:false}:d)};assert.equal(prepareConnection(intentionallyHidden,{speed:'100 Mbps'},1,handoff).devices.find(d=>d.id===handoff.id).scopeOverride,false);
});

test('new handoff inclusion and edited cable metadata survive a configuration evidence save and reopen',()=>{
 const source=fixture();source.devices[0].fromConfig=true;source.devices[1].fromConfig=true;
 const project={devices:[],links:[],warnings:[],stencils:{}},evidence=ensureEvidence(project);
 evidence.sources.push({id:'lab-config',name:'LAB configuration',kind:'Configuration',enabled:true,categories:[...categories],model:source});
 const baseline=composeEvidence(project),handoff=freeze({id:'generated-wan',name:'LAB-HANDOFF',kind:'handoff',gateway:'192.0.2.1',ports:[{name:'demarc',description:'Provider handoff'}]});
 Object.assign(project,prepareConnection(project,{a:handoff.id,ap:'demarc',b:'edge',bp:'port1',media:'copper',speed:'1 Gbps',status:'confirmed'},-1,handoff));
 captureEdits(project,baseline);const materialized=composeEvidence(project),index=project.links.findIndex(l=>l.a===handoff.id);
 Object.assign(project,prepareConnection(project,{media:'Custom carrier service',speed:'2.5 Gbps',description:'Edited WAN service'},index));captureEdits(project,materialized);
 const reopened=JSON.parse(JSON.stringify(project));composeEvidence(reopened);
 const wan=reopened.devices.find(d=>d.id===handoff.id),link=reopened.links.find(l=>l.a===handoff.id);
 assert.ok(reopened.devices.some(d=>d.fromConfig));assert.equal(wan.fromConfig,undefined);assert.equal(wan.scopeOverride,true);assert.equal(wan.gateway,'192.0.2.1');assert.deepEqual(wan.ports,[{name:'demarc',description:'Provider handoff'}]);
 assert.deepEqual(link,{a:handoff.id,ap:'demarc',b:'edge',bp:'port1',media:'Custom carrier service',speed:'2.5 Gbps',status:'confirmed',description:'Edited WAN service'});
 assert.equal(reopened.devices.filter(d=>d.id===handoff.id).length,1);assert.ok(reopened.devices.find(d=>d.id==='edge').ports.some(p=>p.name==='port1'));assert.equal(handoff.scopeOverride,undefined);
});

test('custom media and speed remain user metadata without rewriting physical port records',()=>{
 const project=freeze(fixture()),result=prepareConnection(project,{media:'Custom optical transport',speed:'Provider-defined 12.75 Gbps',title:'Backhaul',description:'Custom circuit details'},0);
 assert.equal(result.links[0].media,'Custom optical transport');assert.equal(result.links[0].speed,'Provider-defined 12.75 Gbps');assert.equal(result.links[0].title,'Backhaul');assert.equal(result.links[0].description,'Custom circuit details');
 assert.deepEqual(result.devices[0].ports,project.devices[0].ports);assert.deepEqual(result.devices[1].ports,project.devices[1].ports);
 const caseOnly=prepareConnection(project,{ap:'X1'},0);assert.equal(caseOnly.devices[0].ports.length,1);assert.equal(caseOnly.devices[0].ports[0].name,'x1');assert.equal(caseOnly.links[0].ap,'X1');
});
