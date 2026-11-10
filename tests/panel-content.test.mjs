import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticPanelContent,panelRows} from '../src/web/diagram/panel-content.mjs';
import {cleanPanel,cleanPresentation} from '../src/web/presentation.mjs';
import {informationPanel} from '../src/web/diagram/information-panel.mjs';
const devices=[{id:'a',name:'Lab A',vlans:[{id:10,name:'Users',addresses:['10.0.0.1/24']},{id:20,name:'Voice'}],ports:[{name:'1',native:10,state:'up'},{name:'2',description:'Spare'}],ip:'192.0.2.1',mac:'00:11:22:33:44:55'},{id:'b',name:'Lab B',vlans:[{id:10,name:'Staff',ip:'10.0.0.2/24'}],ports:[]}];
test('VLAN summary deduplicates IDs in page scope without discarding differing sourced names or addresses',()=>{
 const project={devices,links:[]},auto=automaticPanelContent(project,devices);
 assert.deepEqual(auto.vlans,['VLAN 10 · Users / Staff · 10.0.0.1/24, 10.0.0.2/24','VLAN 20 · Voice']);
 assert.equal(automaticPanelContent(project,devices,{vlanMode:'devices'}).vlans.length,3);
 assert.ok(!automaticPanelContent(project,[devices[0]]).vlans.join('').includes('Staff'));
});
test('address and port filters are non-mutating and retain only matching recorded facts',()=>{
 const project={devices,links:[]},before=JSON.stringify(project);
 assert.equal(automaticPanelContent(project,devices,{addressMode:'ip'}).addresses[0],'Lab A · 192.0.2.1');
 assert.equal(automaticPanelContent(project,devices,{addressMode:'mac'}).addresses[0],'Lab A · MAC 00:11:22:33:44:55');
 assert.equal(automaticPanelContent(project,devices,{portMode:'vlans'}).ports.length,1);
 assert.equal(automaticPanelContent(project,devices,{portMode:'described'}).ports[0],'Lab A 2 · Spare');
 assert.equal(JSON.stringify(project),before);
});
test('all empty sections hide by default including legacy settings, with explicit diagnostic opt-in',()=>{
 for(const id of ['connections','modules','vlans','lags','apPorts','vsfPorts','uplinks','optics','status','addresses','models','routes','ports','notes','custom-example']){
  assert.deepEqual(panelRows(id,{},cleanPanel()),[],id);
  assert.deepEqual(panelRows(id,{},cleanPanel({emptySections:'explain'})),[],id);
  assert.equal(panelRows(id,{},cleanPanel({emptySections:'explain-opt-in'})).length,1,id);
  assert.deepEqual(panelRows(id,{},cleanPanel({emptySections:'hide'})),[],id);
 }
 assert.deepEqual(panelRows('vlans',{},cleanPanel({sectionContent:{vlans:'Authored row'}})),['Authored row']);
 const auto={routes:Array.from({length:130},(_,i)=>'Route '+i)};
 assert.equal(panelRows('routes',auto,cleanPanel({rowLimit:120})).length,121);
 assert.match(panelRows('routes',auto,cleanPanel({rowLimit:20})).at(-1),/110 more items/);
});
test('content preferences survive JSON reopen and invalid values normalize safely',()=>{
 assert.equal(cleanPanel(JSON.parse(JSON.stringify(cleanPanel({emptySections:'explain-opt-in'})))).emptySections,'explain-opt-in');
 const panel={vlanMode:'devices',addressMode:'mac',portMode:'vlans',rowLimit:40,emptySections:'hide'},clean=cleanPresentation({defaults:{panel}});
 assert.deepEqual(cleanPresentation(JSON.parse(JSON.stringify(clean))),clean);
 for(const [k,v] of Object.entries(panel))assert.equal(clean.defaults.panel[k],v);
 assert.equal(cleanPanel({rowLimit:100000,vlanMode:'invalid'}).rowLimit,80);
 assert.equal(cleanPanel({vlanMode:'invalid'}).vlanMode,'summary');
});
test('empty generated legends and ordinary sections disappear unless explanations are explicitly requested',()=>{
 const page={name:'Empty',items:[],coreDeviceIds:[]},project={devices:[],links:[],layout:{presentation:{defaults:{panel:{sections:['connections','modules','vlans']}}}}};
 informationPanel(page,project);
 assert.equal(page.items.length,0);
 project.layout.presentation.defaults.panel.emptySections='explain-opt-in';const diagnostic={name:'Empty',items:[],coreDeviceIds:[]};informationPanel(diagnostic,project);
 for(const id of ['connections','modules','vlans'])assert.ok(diagnostic.items.some(i=>i.editKey===`Empty|info-panel|${id}|0`));
 project.layout.presentation.defaults.panel.emptySections='hide';const hidden={name:'Empty',items:[],coreDeviceIds:[]};informationPanel(hidden,project);assert.equal(hidden.items.length,0);
});

test('saved content and edits survive history, scene rebuild, SVG and native Visio export',async()=>{
 const {buildPages,exportVisio}=await import('../src/web/diagram/index.mjs'),{unzip}=await import('../src/web/zip.mjs'),{ProjectHistory}=await import('../src/web/history.mjs'),{cleanLayout}=await import('../src/web/layout.mjs');
 const before={name:'Fictional panel',devices:structuredClone(devices).map(d=>({...d,kind:'switch'})),links:[],layout:{}};
 const history=new ProjectHistory(before),project=structuredClone(before);project.layout=cleanLayout({presentation:{defaults:{panel:{sections:['vlans','routes'],vlanMode:'summary',addressMode:'ip',rowLimit:40}}}},devices.map(d=>d.id));
 history.record(project,'page-layout');const undone=history.travel(project);assert.deepEqual(undone,before);const redone=history.travel(undone,{redo:true});assert.deepEqual(JSON.parse(JSON.stringify(redone)),JSON.parse(JSON.stringify(project)));
 const reopened=JSON.parse(JSON.stringify(redone)),pages=buildPages(reopened),page=pages.find(p=>p.coreDeviceIds);
 assert.ok(page.items.some(i=>i.value==='VLAN 10 · Users / Staff · 10.0.0.1/24, 10.0.0.2/24'));assert.doesNotMatch(page.svg,/No routes recorded|>ROUTES</);
 const row=page.items.find(i=>i.editKey?.includes('|info-panel|vlans|0'));reopened.layout.drawingEdits={[row.editKey]:{value:'Reviewed VLAN row'}};
 const updated=buildPages(reopened);assert.ok(updated.some(p=>p.svg.includes('Reviewed VLAN row')));
 const parts=await unzip(await exportVisio(reopened,updated).arrayBuffer()),xml=[...parts].filter(([k])=>/^visio\/pages\/page\d+\.xml$/.test(k)).map(([,v])=>new TextDecoder().decode(v)).join('');
 assert.match(xml,/Reviewed VLAN row/);assert.doesNotMatch(xml,/No routes recorded|>ROUTES</);
});

test('empty automatic inventory preserves custom text and manual body edits, not lone headings',()=>{
 const sections=['connections','modules','vlans','routes','notes','custom-check'];
 const project={devices:[],links:[],layout:{presentation:{defaults:{panel:{sections,emptySections:'explain',sectionTitles:{routes:'My routes'},sectionContent:{modules:'My authored module note',vlans:'  \n '},notes:'My note',customSections:[{id:'custom-check',title:'Checklist'}]}}},drawingEdits:{'Empty|info-panel|routes|3':{value:'Reviewed custom route note'},'Empty|info-panel|vlans|heading':{value:'Authored title only'}}}};
 const before=JSON.stringify(project),page={name:'Empty',items:[],coreDeviceIds:[]};informationPanel(page,project);
 assert.ok(page.items.some(i=>i.value==='My authored module note'));
 assert.ok(page.items.some(i=>i.editKey==='Empty|info-panel|routes|3'&&i.value==='Reviewed custom route note'));
 assert.ok(page.items.some(i=>i.value==='My note'));
 for(const id of ['connections','vlans','custom-check'])assert.ok(!page.items.some(i=>i.editKey?.includes('|info-panel|'+id+'|')));
 assert.equal(JSON.stringify(project),before);
});
test('blank route records do not produce fake nonempty content',()=>{
 assert.deepEqual(automaticPanelContent({},[{id:'a',name:'Lab',routes:[' ',{},null,{destination:'  '}]}]).routes,[]);
});

test('empty selected sections stay absent on physical paper and in PDF while populated sections remain',async()=>{
 const {buildPages}=await import('../src/web/diagram/index.mjs'),{panelFields}=await import('../src/web/presentation.mjs'),{exportPdf}=await import('../src/web/report-export.mjs'),{createRequire}=await import('node:module'),{inflateSync}=await import('node:zlib');
 const require=createRequire(import.meta.url),prior=globalThis.jspdf;globalThis.jspdf=require('../src/web/vendor/jspdf.umd.min.js');
 try{
  for(const preset of ['letter','a4'])for(const locked of [false,true]){
   const project={name:'Fictional empty panel',devices:[{id:'s',name:'Lab',kind:'switch',ports:[],vlans:[{id:10,name:'Users'}]}],links:[],layout:{presentation:{defaults:{panel:{sections:panelFields.map(([id])=>id),emptySections:'explain'}}},pageSetup:{visible:{default:{preset,locked}}}}};
   const page=buildPages(project).find(p=>p.coreDeviceIds);assert.ok(page);
   assert.ok(page.items.some(i=>i.value==='VLAN 10 · Users'));
   for(const id of ['connections','modules','routes','notes','optics','addresses'])assert.ok(!page.items.some(i=>i.editKey?.includes('|info-panel|'+id+'|')),id);
   assert.doesNotMatch(page.svg,/No port module|PORT MODULES|No routes|>ROUTES</);
   const buffer=Buffer.from(await exportPdf([page])),text=buffer.toString('latin1'),out=[];
   for(const match of text.matchAll(/<<[^>]*\/Length\s+(\d+)[^>]*>>\s*stream\r?\n/g)){const start=match.index+match[0].length,data=buffer.subarray(start,start+Number(match[1]));out.push((/\/FlateDecode/.test(match[0])?inflateSync(data):data).toString('latin1'));}
   const glyphs=new Map();for(const part of out)for(const block of part.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))for(const pair of block[1].matchAll(/<([\da-f]+)>\s*<([\da-f]+)>/gi))glyphs.set(pair[1].toLowerCase().padStart(4,'0'),String.fromCharCode(parseInt(pair[2],16)));
   const pdf=out.flatMap(part=>[...part.matchAll(/<([\da-f]+)>\s*Tj/gi)].map(match=>(match[1].match(/.{4}/g)||[]).map(code=>glyphs.get(code.toLowerCase())||'?').join(''))).join('\n');assert.match(pdf,/VLAN 10/);assert.doesNotMatch(pdf,/PORT MODULES|No port module|No routes|\(ROUTES\)/);
  }
 }finally{if(prior===undefined)delete globalThis.jspdf;else globalThis.jspdf=prior;}
});

test('manually blanked body rows do not leave empty section headings',()=>{
 const project={devices:[{id:'a',vlans:[{id:10}]}],links:[],layout:{presentation:{defaults:{panel:{sections:['vlans']}}},drawingEdits:{'Empty|info-panel|vlans|0':{value:'  '}}}};
 const page={name:'Empty',items:[{pageFrame:'sidebar'}],coreDeviceIds:['a']};informationPanel(page,project);assert.equal(page.items.length,0);
});
