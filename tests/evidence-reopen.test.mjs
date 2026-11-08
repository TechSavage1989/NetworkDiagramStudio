import test from 'node:test';
import assert from 'node:assert/strict';
import {composeEvidence,reopenEvidence,captureEdits,categories} from '../src/web/evidence.mjs';
import {physicalInventory} from '../src/web/physical-links.mjs';

const device=(id,fields={})=>({id,name:id.toUpperCase(),kind:'firewall',ports:[],vlans:[],routes:[],...fields});
const model=(devices,links=[])=>({devices,links,warnings:[]});
const source=(id,data,enabled=true)=>({id,kind:id==='config'?'Configuration':'Auvik',enabled,categories:[...categories],model:JSON.parse(JSON.stringify(data))});
const hash=name=>{let value=0;for(const c of JSON.stringify([name]))value=Math.imul(value,31)+c.charCodeAt(0)|0;return value;};
function savedProject(){
 const configured=device('lab-fw',{fromConfig:true,ports:[{name:'port2',type:'physical'}]}),reported=device('lab-fw.example.test',{ports:[{name:'port2',state:'up',speed:'1 Gbps'}]}),sw=device('lab-core',{kind:'switch',fromConfig:true,ports:[{name:'B11'}]}),link={a:reported.id,ap:'port2',b:sw.id,bp:'B11',media:'copper'};
 const shape={id:'mapped-front',anchors:{port2:[.23,.42]},native:{paths:[],texts:[]}},key='Core Network|device|lab-fw.example.test|body',cable='Core Network|path|'+hash('LAB-FW.EXAMPLE.TEST port2 / LAB-CORE B11')+'|0';
 const project={name:'Saved imported project',...model([configured,reported,sw],[link]),stencils:{[shape.id]:shape},layout:{order:[reported.id,sw.id,'disabled-switch'],coreExclude:['disabled-switch'],corePages:[{id:'kept-page-id',name:'Core Network',devices:[reported.id,sw.id,'disabled-switch'],hiddenReferences:[reported.id+'/port2|'+sw.id+'/B11'].map(k=>k.split('|').sort().join('|'))}],reportPages:[{id:'kept-report-id',name:'Ports',family:'ports',devices:[reported.id,'disabled-switch']}],switchport:{deviceIds:[reported.id,'disabled-switch']},suppressedHandoffs:['handoff:'+reported.id+'/port1'],drawingEdits:{[key]:{x:620,y:240,w:700},[key+'|child|2']:{x:.2,y:.3,w:.06,h:.02},[cable]:{weight:7,color:'#506070',points:[[10,20],[10,40],[50,40],[50,60]]}},presentation:{pages:{['MDF Port Map|'+reported.id+'|sheet:0']:{textScale:1.3}}}},evidence:{base:model([]),sources:[source('config',model([configured,sw])),source('report',model([reported,sw],[link])),source('disabled',model([device('disabled-switch',{kind:'switch'})]),false)],edits:{}}};
 const before=JSON.parse(JSON.stringify({devices:project.devices,links:project.links,warnings:project.warnings}));
 reported.stencilId=shape.id;reported.ports[0].description='Reviewed uplink';reported.ports[0].mapping='keep-manual-port-field';captureEdits(project,before);
 return {project,key,cable,shape};
}

test('saved duplicate imported identities recover on reopen without losing edits, port mappings or disabled-source layout IDs',()=>{
 const {project,key,cable,shape}=savedProject(),originalSources=JSON.stringify(project.evidence.sources);
 assert.equal(reopenEvidence(project),project);assert.deepEqual(project.devices.map(d=>d.id),['lab-fw','lab-core']);
 const fw=project.devices.find(d=>d.id==='lab-fw');assert.equal(fw.stencilId,shape.id);assert.equal(fw.ports[0].description,'Reviewed uplink');assert.equal(fw.ports[0].mapping,'keep-manual-port-field');assert.deepEqual(project.stencils[shape.id],shape);
 assert.equal(physicalInventory(project).links[0].a,'lab-fw');assert.equal(JSON.stringify(project.evidence.sources),originalSources);
 assert.deepEqual(project.layout.order,['lab-fw','lab-core','disabled-switch']);assert.deepEqual(project.layout.corePages[0].devices,['lab-fw','lab-core','disabled-switch']);assert.equal(project.layout.corePages[0].id,'kept-page-id');assert.equal(project.layout.reportPages[0].id,'kept-report-id');
 assert.deepEqual(project.layout.switchport.deviceIds,['lab-fw','disabled-switch']);assert.deepEqual(project.layout.suppressedHandoffs,['handoff:lab-fw/port1']);
 assert.deepEqual(project.layout.drawingEdits['Core Network|device|lab-fw|body'],project.layout.drawingEdits[key]);assert.deepEqual(project.layout.drawingEdits['Core Network|device|lab-fw|body|child|2'],project.layout.drawingEdits[key+'|child|2']);
 const nextCable='Core Network|path|'+hash('LAB-FW port2 / LAB-CORE B11')+'|0';assert.deepEqual(project.layout.drawingEdits[nextCable],project.layout.drawingEdits[cable]);
 assert.deepEqual(project.layout.presentation.pages['MDF Port Map|lab-fw|sheet:0'],{textScale:1.3});
 assert.ok(Object.hasOwn(project.layout.drawingEdits,key),'Original layout keys remain available');
 const saved=JSON.stringify(project);reopenEvidence(project);assert.equal(JSON.stringify(project),saved,'Reopening twice is stable');
});

test('source toggles carry the current layout through accepted aliases while disabled devices remain absent',()=>{
 const {project,key}=savedProject();reopenEvidence(project);
 project.layout.drawingEdits['Core Network|device|lab-fw|body'].x=875;
 project.evidence.sources[0].enabled=false;composeEvidence(project);
 assert.ok(!project.devices.some(d=>d.id==='lab-fw'));assert.equal(project.layout.drawingEdits[key].x,875);assert.equal(project.layout.order[0],'lab-fw.example.test');
 assert.equal(project.devices.find(d=>d.id==='lab-fw.example.test').ports[0].description,'Reviewed uplink');
 const reopened=JSON.parse(JSON.stringify(project));reopenEvidence(reopened);assert.equal(reopened.layout.drawingEdits[key].x,875);
 reopened.evidence.sources[0].enabled=true;composeEvidence(reopened);assert.equal(reopened.layout.drawingEdits['Core Network|device|lab-fw|body'].x,875);
 for(const s of reopened.evidence.sources)s.enabled=false;composeEvidence(reopened);assert.deepEqual(reopened.devices,[]);assert.deepEqual(reopened.links,[]);assert.ok(reopened.layout.order.includes('disabled-switch'));
});

test('explicit canonical edits win during the initial merge and manual projects without provenance remain unchanged',()=>{
 const {project,key}=savedProject();project.layout.drawingEdits['Core Network|device|lab-fw|body']={x:400,y:500};reopenEvidence(project);
 assert.deepEqual(project.layout.drawingEdits['Core Network|device|lab-fw|body'],{x:400,y:500});assert.equal(project.layout.drawingEdits[key].x,620);
 const manual={...model([device('fw'),device('fw.example.test')]),layout:{order:['fw.example.test','fw'],drawingEdits:{['Core Network|device|fw.example.test|body']:{x:40}}}},before=JSON.stringify(manual);
 reopenEvidence(manual);assert.equal(JSON.stringify(manual),before);
});

test('reopening does not collapse scoped drawing references when a short hostname has two domains',()=>{
 const devices=[device('lab-fw',{fromConfig:true}),device('lab-fw.east.example'),device('lab-fw.west.example')],key='Core Network|device|lab-fw.east.example|body';
 const project={...model(devices),layout:{order:devices.map(d=>d.id),corePages:[{id:'page',devices:devices.map(d=>d.id)}],drawingEdits:{[key]:{x:310,y:240}}},evidence:{base:model([]),sources:[source('config',model([devices[0]])),source('report',model(devices.slice(1)))],edits:{}}};
 const layout=JSON.stringify(project.layout);reopenEvidence(project);
 assert.equal(project.devices.length,3);assert.equal(JSON.stringify(project.layout),layout);
});
