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
test('all enabled empty sections explain missing records, can be hidden, and custom content takes precedence',()=>{
 for(const id of ['connections','modules','vlans','lags','apPorts','vsfPorts','uplinks','optics','status','addresses','models','routes','ports','notes','custom-example']){
  assert.equal(panelRows(id,{},cleanPanel()).length,1,id);
  assert.deepEqual(panelRows(id,{},cleanPanel({emptySections:'hide'})),[],id);
 }
 assert.deepEqual(panelRows('vlans',{},cleanPanel({sectionContent:{vlans:'Authored row'}})),['Authored row']);
 const auto={routes:Array.from({length:130},(_,i)=>'Route '+i)};
 assert.equal(panelRows('routes',auto,cleanPanel({rowLimit:120})).length,121);
 assert.match(panelRows('routes',auto,cleanPanel({rowLimit:20})).at(-1),/110 more items/);
});
test('content preferences survive JSON reopen and invalid values normalize safely',()=>{
 const panel={vlanMode:'devices',addressMode:'mac',portMode:'vlans',rowLimit:40,emptySections:'hide'},clean=cleanPresentation({defaults:{panel}});
 assert.deepEqual(cleanPresentation(JSON.parse(JSON.stringify(clean))),clean);
 for(const [k,v] of Object.entries(panel))assert.equal(clean.defaults.panel[k],v);
 assert.equal(cleanPanel({rowLimit:100000,vlanMode:'invalid'}).rowLimit,80);
 assert.equal(cleanPanel({vlanMode:'invalid'}).vlanMode,'summary');
});
test('empty generated legends and ordinary sections render explanations instead of silently disappearing',()=>{
 const page={name:'Empty',items:[],coreDeviceIds:[]},project={devices:[],links:[],layout:{presentation:{defaults:{panel:{sections:['connections','modules','vlans']}}}}};
 informationPanel(page,project);
 for(const id of ['connections','modules','vlans'])assert.ok(page.items.some(i=>i.editKey===`Empty|info-panel|${id}|0`));
 project.layout.presentation.defaults.panel.emptySections='hide';const hidden={name:'Empty',items:[],coreDeviceIds:[]};informationPanel(hidden,project);assert.equal(hidden.items.length,0);
});

test('saved content and edits survive history, scene rebuild, SVG and native Visio export',async()=>{
 const {buildPages,exportVisio}=await import('../src/web/diagram/index.mjs'),{unzip}=await import('../src/web/zip.mjs'),{ProjectHistory}=await import('../src/web/history.mjs'),{cleanLayout}=await import('../src/web/layout.mjs');
 const before={name:'Fictional panel',devices:structuredClone(devices).map(d=>({...d,kind:'switch'})),links:[],layout:{}};
 const history=new ProjectHistory(before),project=structuredClone(before);project.layout=cleanLayout({presentation:{defaults:{panel:{sections:['vlans','routes'],vlanMode:'summary',addressMode:'ip',rowLimit:40}}}},devices.map(d=>d.id));
 history.record(project,'page-layout');const undone=history.travel(project);assert.deepEqual(undone,before);const redone=history.travel(undone,{redo:true});assert.deepEqual(JSON.parse(JSON.stringify(redone)),JSON.parse(JSON.stringify(project)));
 const reopened=JSON.parse(JSON.stringify(redone)),pages=buildPages(reopened),page=pages.find(p=>p.coreDeviceIds);
 assert.ok(page.items.some(i=>i.value==='VLAN 10 · Users / Staff · 10.0.0.1/24, 10.0.0.2/24'));assert.match(page.svg,/No routes recorded/);
 const row=page.items.find(i=>i.editKey?.includes('|info-panel|vlans|0'));reopened.layout.drawingEdits={[row.editKey]:{value:'Reviewed VLAN row'}};
 const updated=buildPages(reopened);assert.ok(updated.some(p=>p.svg.includes('Reviewed VLAN row')));
 const parts=await unzip(await exportVisio(reopened,updated).arrayBuffer()),xml=[...parts].filter(([k])=>/^visio\/pages\/page\d+\.xml$/.test(k)).map(([,v])=>new TextDecoder().decode(v)).join('');
 assert.match(xml,/Reviewed VLAN row/);assert.match(xml,/No routes recorded/);
});
