import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanDeviceStacks,deviceStack,stackCaption,saveDeviceStack,dissolveDeviceStack} from '../src/web/device-stacks.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {ProjectHistory} from '../src/web/history.mjs';
import {withoutDevices} from '../src/web/device-actions.mjs';
import {ensureEvidence,composeEvidence,reopenEvidence} from '../src/web/evidence.mjs';
import {migrateIdentityReferences} from '../src/web/evidence-identities.mjs';
import {unzip} from '../src/web/zip.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {rotationProject} from './fixtures/device-rotation.mjs';
const draft={id:'stack-lab',name:'LAB stack',members:[{deviceId:'a',number:2},{deviceId:'b',number:1}]};
test('existing devices become ordered stack members without altering source or port identities',async()=>{
 const project=rotationProject(),source=structuredClone(project);project.layout=saveDeviceStack(project,draft);
 assert.deepEqual(project.devices,source.devices);assert.deepEqual(project.links,source.links);assert.deepEqual(project.stencils,source.stencils);
 assert.deepEqual(project.layout.drawingEdits,source.layout.drawingEdits);
 assert.deepEqual(project.layout.deviceStacks[0].members,[{deviceId:'b',number:1},{deviceId:'a',number:2}]);
 assert.equal(stackCaption(project,'a'),'LAB stack · member 2');assert.equal(deviceStack(project,'missing'),null);
 const clean=cleanLayout(JSON.parse(JSON.stringify(project.layout)),project.devices.map(d=>d.id));assert.deepEqual(clean.deviceStacks,project.layout.deviceStacks);
 const snapshot=JSON.stringify(project),pages=buildPages(project);assert.equal(JSON.stringify(project),snapshot);
 assert.ok(pages[0].items.some(item=>item.type==='text'&&item.value.includes('LAB stack · member 2')));
 assert.ok(pages[0].svg.includes('LAB stack · member 1'));
 const files=await unzip(await exportVisio(project,pages).arrayBuffer()),xml=new TextDecoder().decode(files.get('visio/pages/page1.xml'));assert.ok(xml.includes('LAB stack · member 2'));assert.ok(xml.includes('LAB stack · member 1'));
 const devices=pages[0].items.filter(item=>item.type==='device');assert.ok(devices.some(d=>d.sourceId==='a'&&d.ports.p1));assert.ok(devices.some(d=>d.sourceId==='b'&&d.ports.p1));
});
test('validation rejects repeated devices/numbers, cross-stack assignment, unknown devices and empty/new singleton stacks',()=>{
 const project=rotationProject();
 for(const members of [[],[{deviceId:'a',number:1}],[{deviceId:'a',number:1},{deviceId:'a',number:2}],[{deviceId:'a',number:1},{deviceId:'b',number:1}],[{deviceId:'a',number:1},{deviceId:'b',number:257}],[{deviceId:'a',number:1},{deviceId:'missing',number:2}]])assert.throws(()=>saveDeviceStack(project,{...draft,members}));
 assert.throws(()=>saveDeviceStack(project,{...draft,name:' '}));project.layout=saveDeviceStack(project,draft);assert.throws(()=>saveDeviceStack(project,{...draft,id:'other'}),/other stack/);
 const data=[{...draft,members:[...draft.members,{deviceId:'a',number:3},{deviceId:'missing',number:9}]},{...draft,id:'other'}];assert.deepEqual(cleanDeviceStacks(data,['a','b']),[project.layout.deviceStacks[0]]);
});
test('member removal, dissolve, deletion, history and serialized reload preserve reversible associations',()=>{
 let project=rotationProject();const original=structuredClone(project),history=new ProjectHistory(project);project.layout=saveDeviceStack(project,draft);history.record(project,'devices');
 const saved=structuredClone(project);project=history.travel(project);assert.deepEqual(project,original);project=history.travel(project,{redo:true});assert.deepEqual(project,saved);
 project.layout=saveDeviceStack(project,{...draft,members:[draft.members[0]]});assert.equal(project.layout.deviceStacks[0].members.length,1);assert.deepEqual(project.devices,original.devices);
 project.layout=dissolveDeviceStack(project,draft.id);assert.deepEqual(project.layout.deviceStacks,[]);assert.deepEqual(project.links,original.links);
 const removed=withoutDevices(saved,['b']);assert.deepEqual(removed.layout.deviceStacks[0].members,[{deviceId:'a',number:2}]);
 assert.deepEqual(withoutDevices(saved,['a','b']).layout.deviceStacks,[]);
});
test('source toggles retain association without resurrecting records and accepted aliases migrate references',()=>{
 const project=rotationProject();ensureEvidence(project);const original=structuredClone(project.evidence.base);project.evidence.base={devices:[],links:[],warnings:[]};project.evidence.sources=[{id:'source',enabled:true,categories:['identity','ports','links'],model:original}];composeEvidence(project);const composed=structuredClone(project.devices);project.layout=saveDeviceStack(project,draft);
 project.evidence.sources[0].enabled=false;composeEvidence(project);assert.equal(project.devices.length,0);assert.equal(project.layout.deviceStacks[0].members.length,2);
 project.evidence.sources[0].enabled=true;composeEvidence(project);const reopened=JSON.parse(JSON.stringify(project));reopenEvidence(reopened);assert.equal(stackCaption(reopened,'a'),'LAB stack · member 2');assert.deepEqual(reopened.devices,composed);
 const before=structuredClone(project);project.devices=project.devices.map(d=>d.id==='a'?{...d,id:'canonical',identityAliases:['a']}:d);migrateIdentityReferences(project,before,project.devices);assert.equal(stackCaption(project,'canonical'),'LAB stack · member 2');
});
