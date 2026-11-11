import {unpresentPatch} from '../src/web/presentation.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {parseConfig,mergeModels} from '../src/web/imports/index.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {addDevice} from '../src/web/diagram/scene.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {cleanNativeArt} from '../src/web/native-art.mjs';
import {openZip,unzip} from '../src/web/zip.mjs';
import {zip} from '../src/web/diagram/zip.mjs';
import {droppedFiles,visioExtensions,visioFile} from '../src/web/stencil-files.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5F8AAAAASUVORK5CYII=';
test('native artwork edits retain text weight/alignment and independently named shapes in Visio',async()=>{
 const site={devices:[{id:'a',name:'LAB',kind:'switch',stencilId:'front',ports:[]}],links:[],stencils:{front:{id:'front',name:'Lab panel',width:10,height:1,dataUrl:png,native:cleanNativeArt({paths:[{commands:[['M',0,0],['L',1,0],['L',1,1],['Z']],fill:'#CCCCCC',stroke:'#111111',weight:.001}],texts:[{text:'Panel label',x:.4,y:.5,w:.3,size:.02,color:'#123456',angle:0}]})}}};
 const before=buildPages(site)[0],g=before.items.find(i=>i.type==='device');site.layout={drawingEdits:{[g.editKey+'|arttext|0']:{value:'Edited label',bold:true,align:'right',color:'#815AC0'},[g.editKey+'|vector|0']:{name:'Panel outline'}}};const pages=buildPages(JSON.parse(JSON.stringify(site)));assert.match(pages[0].svg,/text-anchor="end"[^>]*font-weight="700" fill="#815AC0"/);assert.match(pages[0].svg,/Edited label/);
 const data=await unzip(await exportVisio(site,pages).arrayBuffer());assert.ok([...data].some(([key,value])=>key.startsWith('visio/masters/master')&&new TextDecoder().decode(value).includes('Panel outline')));
 assert.ok([...data].some(([key,value])=>key.startsWith('visio/masters/master')&&/<Cell N="Color" V="#815AC0"/.test(new TextDecoder().decode(value))));
});
test('a repeated switch on continued wireless pages has independent editable positions',()=>{
 const site=sampleSite();site.devices=site.devices.filter(d=>d.id==='sw-1'||d.kind==='ap');site.links=site.devices.filter(d=>d.kind==='ap').map((d,i)=>({a:'sw-1',ap:'1/1/'+(i*2+1),b:d.id,bp:'eth0',media:'copper'}));
 // Force another sheet by reusing a jack column in a synthetic mapped front.
 // Dynamic pages keep a routable switch whole; explicit continuation on
 // Letter still splits it, which is what this identity check needs.
 const sw=site.devices[0];sw.stencil={id:'many',name:'Lab',dataUrl:png,width:10,height:1,anchors:Object.fromEntries(site.links.map((e,i)=>[e.ap,[i%2?.3:.2,.3]]))};
 const pageSetup={visible:{wirelessFit:'readable',wirelessFitExplicit:true,default:{preset:'letter'}}};site.layout={pageSetup};
 const pages=buildPages(site).filter(p=>p.title==='Wireless Connections');assert.ok(pages.length>1);const groups=pages.map(p=>p.items.find(i=>i.sourceId==='sw-1'&&i.kind==='switch'));assert.equal(new Set(groups.map(g=>g.editKey)).size,groups.length);
 site.layout={pageSetup,drawingEdits:{[groups[0].editKey]:unpresentPatch(groups[0],{x:groups[0].x+20})}};const after=buildPages(site).filter(p=>p.title==='Wireless Connections').map(p=>p.items.find(i=>i.sourceId==='sw-1'&&i.kind==='switch'));const source=item=>(item.x-(item.presentation?.x||0))/(item.presentation?.scale||1);assert.ok(Math.abs(source(after[0])-(source(groups[0])+20/(groups[0].presentation?.scale||1)))<1e-6,'the moved copy keeps its saved position');assert.ok(Math.abs(source(after[1])-source(groups[1]))<1e-6,'the other copy is untouched');
});
test('far-end configuration evidence corrects a reported HA endpoint without discarding the report',()=>{
 const sw={id:'sw',name:'LAB-SW',kind:'switch',fromConfig:true,ports:[{name:'49',description:'Uplink-to-LAB-FortiGate-x3'}]},fw={id:'lab-fortigate-120g',name:'LAB-FortiGate-120G',kind:'firewall',fromConfig:true,ports:[{name:'ha'},{name:'x3'}]},reported={a:'sw',ap:'49',b:fw.id,bp:'ha'},m=mergeModels({devices:[sw,fw],links:[reported]});assert.equal(m.links[0].bp,'x3');assert.equal(m.links[0].reportedEndpoints[0].bp,'ha');assert.ok(m.warnings.some(w=>/verify the connection/.test(w)));
});
test('stack socket edits follow the correct member and preserve interface aliases',()=>{
 const d=parseConfig('; hpStack_WB Configuration Editor\nhostname LAB-STACK\nstacking\n member 1 type "J9729A"\n member 2 type "J9726A"\n exit\ninterface 1/1\n name User\n exit\ninterface 2/1\n name User\n exit').devices[0];assert.equal(d.stackMembers.length,2);const original=addDevice({name:'Lab',items:[]},{},d,[0,0,600,300],'test'),jack=original.children.find(c=>c.anchorOrigin&&c.name.startsWith('Member 2:')),old=original.ports['2/1'];const updated=addDevice({name:'Lab',items:[]},{layout:{drawingEdits:{[jack.editKey]:{x:jack.x+.01,y:jack.y+.01}}}},d,[0,0,600,300],'test');assert.ok(Math.abs(updated.ports['2/1'][0]-old[0]-.01)<1e-8);assert.ok(Math.abs(updated.ports['2/1'][1]-old[1]-.01)<1e-8);assert.deepEqual(updated.ports['1/1'],original.ports['1/1']);
});
test('recursive folder import exhausts directory batches and recognizes all twelve Visio formats',async()=>{
 const files=visioExtensions.map(ext=>({name:'Lab.'+ext})),entries=files.map(file=>({isFile:true,file:yes=>yes(file)}));let batch=0;const folder={isDirectory:true,name:'Vendor',createReader:()=>({readEntries:yes=>yes(batch++===0?entries.slice(0,6):batch===2?entries.slice(6):[])})};const found=await droppedFiles([{kind:'file',webkitGetAsEntry:()=>folder}]);assert.equal(found.length,12);assert.ok(found.every(f=>visioFile(f.name)&&f.relativePath.startsWith('Vendor/')));
});
test('lazy archives read selected parts without inflating a whole collection and bound selected sizes',async()=>{
 const bytes=new Uint8Array(await zip({'index.xml':'<Masters/>','unused.dat':new Uint8Array(400000)}).arrayBuffer());await assert.rejects(()=>unzip(bytes,{maxBytes:100000}),/limit/);const opened=await openZip(bytes,{maxEntryBytes:1000,maxCacheBytes:1000});assert.equal(new TextDecoder().decode(await opened.get('index.xml')),'<Masters/>');assert.equal(opened.cachedBytes,10);await assert.rejects(()=>opened.get('unused.dat'),/Selected stencil part/);
});
test('lazy archive indexing keeps traversal and integrity checks',async()=>{
 await assert.rejects(()=>openZip(zip({'../escape.xml':'bad'})),/Unsafe/);const corrupt=new Uint8Array(await zip({'index.xml':'safe'}).arrayBuffer());const offset=30+new TextEncoder().encode('index.xml').length;corrupt[offset]^=1;const opened=await openZip(corrupt);await assert.rejects(()=>opened.get('index.xml'),/integrity/);
});
