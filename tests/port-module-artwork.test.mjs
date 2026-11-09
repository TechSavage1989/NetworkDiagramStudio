import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {unzip} from '../src/web/zip.mjs';

const modules=page=>page.items.filter(i=>i.kind==='plug');
const keyModules=page=>modules(page).filter(i=>!i.host);

test('module faces and framed keys remain editable native shapes with attached cable endpoints',async()=>{
 const project=sampleSite(),page=buildPages(project)[0],plugs=modules(page),keys=keyModules(page);
 assert.equal(keys.length,2);
 for(const key of keys){const frame=key.children.find(c=>c.editSlot==='frame');assert.ok(frame?.editKey.endsWith('|child|frame'));assert.equal(frame.fill,'#EEF2F7');const face=key.children.find(c=>c.name==='Module face');const socket=plugs.find(p=>p.host&&p.name===key.name);assert.ok(socket);assert.equal(face.stroke,socket.children[0].stroke);assert.notEqual(key.masterKey,socket.masterKey);assert.ok(key.children.every(c=>c.editKey));}
 for(const path of page.items.filter(i=>i.type==='path'))for(const end of [path.from,path.to]){const plug=plugs.find(i=>i.key===end.device);if(plug){assert.equal(end.x,plug.x+plug.w*plug.ports.cable[0]);assert.equal(end.y,plug.y+plug.h*plug.ports.cable[1]);}}
 const parts=await unzip(await exportVisio(project,[page]).arrayBuffer()),decode=new TextDecoder(),masterXml=[...parts].filter(([k])=>/^visio\/masters\/master\d+\.xml$/.test(k)).map(([,b])=>decode.decode(b)).join('');
 for(const name of ['Module frame','Module face','Optical receptacle 1','Optical receptacle 2','Cable insert'])assert.ok(masterXml.includes('Name="'+name+'"'),name);
 assert.ok(!masterXml.includes('Type="Foreign"'));assert.match(decode.decode(parts.get('visio/pages/page1.xml')),/ToCell="Connections.X\d+"/);
});

test('reach-specific native masters retain independent colors and old SFP legend edits',()=>{
 const project=sampleSite();project.links[0].media='LR';project.layout={linkStyles:{'LR fiber':{color:'#7755AA'}},drawingEdits:{'Core Network|module-legend|plug:SFP|title':{value:'Existing optic name',color:'#112233'},'Core Network|device|module-legend-plug:SFP|plug:undefined|child|1':{fill:'#224466'}}};
 const before=JSON.stringify(project),page=buildPages(project)[0],key=keyModules(page).find(i=>i.masterKey.includes('SFP:lr'));
 assert.ok(key);assert.equal(key.children.find(c=>c.name==='Module face').stroke,'#7755AA');assert.equal(key.children.find(c=>c.editSlot===1).fill,'#224466');const title=page.items.find(i=>i.moduleLegend&&i.value==='Existing optic name');assert.ok(title);assert.equal(title.color,'#112233');assert.equal(JSON.stringify(project),before);
 project.links[1].media='SR';const both=keyModules(buildPages(project)[0]);assert.equal(both.length,2);assert.equal(new Set(both.map(i=>i.masterKey)).size,2);assert.equal(new Set(both.map(i=>i.children.find(c=>c.name==='Module face').stroke)).size,2);
});

test('existing module detail edits and selected artwork take precedence',()=>{
 const project=sampleSite(),page=buildPages(project)[0],socket=modules(page).find(i=>i.host&&i.name.includes('SR'));
 project.layout={drawingEdits:{[socket.editKey+'|child|1']:{fill:'#123456'}}};assert.equal(modules(buildPages(project)[0]).find(i=>i.editKey===socket.editKey).children[1].fill,'#123456');
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=';
 project.stencils={custom:{id:'custom',name:'Chosen module',width:72,height:45,dataUrl:image,anchors:{cable:[.3,.6]}}};project.optics={sr:'custom',fg_sr:'custom'};
 const selected=modules(buildPages(project)[0]).filter(i=>i.asset?.id==='custom');assert.ok(selected.length>=3);for(const module of selected){assert.equal(module.asset.dataUrl,image);assert.deepEqual(module.ports.cable,[.3,.6]);assert.equal(module.children.length,0);}
});
test('placement-only optic edits do not duplicate physical module categories',()=>{
 const project=sampleSite();project.links[0].media='LR';const before=buildPages(project)[0],plugs=modules(before).filter(i=>i.host);
 project.layout={drawingEdits:Object.fromEntries(plugs.map((p,n)=>[p.editKey,{x:p.x+n,y:p.y,w:p.w*.9,h:p.h*.9}]))};
 const next=buildPages(JSON.parse(JSON.stringify(project)))[0];assert.equal(keyModules(next).length,keyModules(before).length);
 assert.deepEqual(keyModules(next).map(i=>i.sourceId).sort(),keyModules(before).map(i=>i.sourceId).sort());
 assert.ok(keyModules(next).some(i=>i.sourceId.includes('SFP:lr')));assert.ok(keyModules(next).some(i=>i.sourceId.includes('DAC')));
});
