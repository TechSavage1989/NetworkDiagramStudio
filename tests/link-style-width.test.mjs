import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSite} from '../src/web/sample.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {changeLinkStyle,cleanLinkStyles,legendEntryId,hasLineCaption} from '../src/web/link-styles.mjs';
import {changeLegendConnections} from '../src/web/legend-connections.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {sameConnection} from '../src/web/connection-edit.mjs';
import {ProjectHistory} from '../src/web/history.mjs';
import {unzip} from '../src/web/zip.mjs';

const paths=(pages,type)=>pages.flatMap(page=>page.items).filter(item=>item.type==='path'&&(!type||item.linkType===type));
const withStyle=(project,pages,type,style)=>({...project,layout:{...project.layout,...changeLinkStyle(project,pages,type,style)}});

test('shared line widths survive validation and affect routed cables and their key samples',()=>{
 const project=sampleSite();project.layout=cleanLayout({linkStyles:{'SR fiber':{weight:7},'AP copper':{weight:8}}},project.devices.map(d=>d.id));
 assert.equal(project.layout.linkStyles['SR fiber'].weight,7);
 for(const weight of [0,-1,NaN,Infinity,12001,'5'])assert.equal(cleanLinkStyles({Copper:{weight}}).Copper,undefined);
 const pages=buildPages(project);
 for(const [type,weight] of [['SR fiber',7],['AP copper',8]]){
  const lines=paths(pages,type);assert.ok(lines.length);
  for(const line of lines){assert.equal(line.weight,weight);assert.equal(line.from.weight,weight);assert.equal(line.to.weight,weight);}
  const samples=pages.flatMap(p=>p.items).filter(i=>i.legendEntry&&i.type==='rect'&&i.linkType===type);assert.ok(samples.length);assert.ok(samples.every(s=>s.h===weight&&s.sampleWeight===weight));
 }
 assert.ok(paths(pages,'DAC').every(line=>line.weight===4));
 assert.throws(()=>changeLinkStyle(project,pages,'SR fiber',{weight:0}),/Line width/);
});

test('color-only edits retain individual widths; an explicit shared width replaces them atomically',async()=>{
 let project=sampleSite();project.layout={linkStyles:{'AP copper':{weight:6}}};let pages=buildPages(project);
 const narrow=paths(pages,'AP copper')[0];project.layout.drawingEdits={[narrow.editKey]:{weight:2,name:'Narrow access link'}};pages=buildPages(project);
 const before=structuredClone(project),history=new ProjectHistory(project),colorOnly=withStyle(project,pages,'AP copper',{color:'#2468AC'});
 assert.deepEqual(project,before);assert.equal(colorOnly.layout.drawingEdits[narrow.editKey].weight,2);pages=buildPages(colorOnly);
 assert.equal(paths(pages,'AP copper').find(line=>sameConnection(line.sourceLink,narrow.sourceLink)).weight,2);assert.ok(paths(pages,'AP copper').filter(line=>!sameConnection(line.sourceLink,narrow.sourceLink)).every(line=>line.weight===6));
 const next=withStyle(colorOnly,pages,'AP copper',{weight:8});assert.equal(next.layout.drawingEdits[narrow.editKey].weight,undefined);assert.equal(next.layout.drawingEdits[narrow.editKey].name,'Narrow access link');
 history.record(next,'link-style');assert.deepEqual(history.travel(next),before);assert.deepEqual(history.travel(before,{redo:true}),JSON.parse(JSON.stringify(next)));
 const reopened={...next,layout:cleanLayout(JSON.parse(JSON.stringify(next.layout)),next.devices.map(d=>d.id))},rebuilt=buildPages(reopened);
 assert.ok(paths(rebuilt,'AP copper').every(line=>line.weight===8&&line.from.weight===8));assert.equal(paths(rebuilt,'AP copper').find(line=>sameConnection(line.sourceLink,narrow.sourceLink)).name,'Narrow access link');
 const files=await unzip(await exportVisio(reopened,rebuilt).arrayBuffer()),xml=[...files].filter(([key])=>key.endsWith('.xml')).map(([,data])=>new TextDecoder().decode(data)).join('');
 assert.match(xml,/<Cell N="LineWeight" V="0.08333" U="PT" F="6 pt"\/>/);
});

test('moved, renamed, hidden and wrapped legend edits retain raw identity when width or cable type changes',()=>{
 let project=sampleSite();project.layout={linkStyles:{'SR fiber':{weight:6,title:'Building backbone connecting the northern and southern workshops',description:'Fictional optical infrastructure'}},presentation:{defaults:{drawingScale:1.5}}};
 let pages=buildPages(project),page=pages[0],sample=page.items.find(i=>i.legendEntry&&i.type==='rect'&&i.linkType==='SR fiber'),wrapped=page.items.find(i=>i.legendEntry&&i.linkType==='SR fiber'&&i.editKey.endsWith('|text|wrap1'));assert.ok(wrapped);
 project.layout.drawingEdits={[sample.editKey]:{x:41,y:240,w:55,h:6,name:'Backbone sample',hidden:true},[wrapped.editKey]:{x:120,y:257,color:'#2468AC',value:'Edited wrapped legend'}};pages=buildPages(project);assert.ok(!pages[0].items.some(i=>i.editKey===sample.editKey));
 project=withStyle(project,pages,'SR fiber',{color:'#815AC0',weight:8});
 const prefix=(page.editScope||page.name)+'|legend|'+legendEntryId('SR fiber','#815AC0',1,true,8),sampleKey=prefix+'|swatch',textKey=prefix+'|text|wrap1';
 assert.equal(project.layout.drawingEdits[sampleKey].hidden,true);assert.equal(project.layout.drawingEdits[sampleKey].name,'Backbone sample');assert.equal(project.layout.drawingEdits[sampleKey].x,41);assert.equal(project.layout.drawingEdits[sampleKey].h,undefined);assert.equal(project.layout.drawingEdits[textKey].value,'Edited wrapped legend');
 pages=buildPages(JSON.parse(JSON.stringify(project)));assert.ok(!pages[0].items.some(i=>i.editKey===sampleKey));assert.equal(pages[0].items.find(i=>i.editKey===textKey).x,180);assert.equal(paths(pages,'SR fiber')[0].weight,12);
 const changed=changeLegendConnections(project,pages,'SR fiber',{media:'LR',speed:'25 Gbps'},{weight:10}),newPrefix=(page.editScope||page.name)+'|legend|'+legendEntryId('LR fiber','#815AC0',1,true,10);
 assert.equal(changed.layout.drawingEdits[newPrefix+'|swatch'].hidden,true);assert.equal(changed.layout.drawingEdits[newPrefix+'|swatch'].name,'Backbone sample');assert.equal(changed.layout.drawingEdits[newPrefix+'|text|wrap1'].value,'Edited wrapped legend');
 const final=buildPages(changed);assert.equal(paths(final,'LR fiber')[0].weight,15);assert.ok(!final[0].items.some(i=>i.editKey===newPrefix+'|swatch'));
});

test('metadata-only changes retain individual width groups and apply a chosen speed only to source connections',()=>{
 let project=sampleSite();project.layout={linkStyles:{'AP copper':{weight:6},DAC:{weight:7}}};let pages=buildPages(project);const selected=paths(pages,'AP copper')[0];
 project.layout.drawingEdits={[selected.editKey]:{weight:2,name:'Narrow AP link'}};pages=buildPages(project);const owner=pages.find(page=>page.items.some(i=>i.editKey===selected.editKey)),key=owner.items.find(i=>i.legendEntry&&i.type==='rect'&&i.linkType==='AP copper'&&i.sampleWeight===2);
 project.layout.drawingEdits[key.editKey]={x:48,y:226,name:'Narrow sample',hidden:true};pages=buildPages(project);
 const existingDAC=project.links.find(link=>link.media==='DAC'),next=changeLegendConnections(project,pages,'AP copper',{media:'DAC',speed:'25 Gbps'},{}),rebuilt=buildPages(next),line=paths(rebuilt).find(line=>sameConnection(line.sourceLink,selected.sourceLink));
 assert.equal(line.weight,2);assert.equal(line.name,'Narrow AP link');assert.equal(next.links.find(link=>sameConnection(link,existingDAC)).speed,existingDAC.speed);
 const targetScope=owner.editScope||owner.name,targetKey=targetScope+'|legend|'+legendEntryId('DAC','#000000',1,true,2)+'|swatch';assert.equal(next.layout.drawingEdits[targetKey].hidden,true);assert.equal(next.layout.drawingEdits[targetKey].name,'Narrow sample');
 const explicit=changeLegendConnections(project,pages,'AP copper',{media:'DAC',speed:'25 Gbps'},{weight:9});assert.equal(explicit.layout.drawingEdits[line.editKey]?.weight,undefined);assert.ok(paths(buildPages(explicit),'DAC').every(line=>line.weight===9));
});

test('returning to an earlier width retains the latest active legend position, name and hidden state',()=>{
 let project=sampleSite(),pages=buildPages(project);const swatch=pages[0].items.find(i=>i.legendEntry&&i.type==='rect'&&i.linkType==='SR fiber');project.layout={drawingEdits:{[swatch.editKey]:{x:44,y:215,name:'Earlier sample'}}};
 project=withStyle(project,pages,'SR fiber',{weight:7});pages=buildPages(project);const wider=pages[0].items.find(i=>i.legendEntry&&i.type==='rect'&&i.linkType==='SR fiber');
 project.layout.drawingEdits[wider.editKey]={x:62,y:239,name:'Latest moved sample',hidden:true};pages=buildPages(project);
 project=withStyle(project,pages,'SR fiber',{weight:4});assert.deepEqual(project.layout.drawingEdits[swatch.editKey],{x:62,y:239,name:'Latest moved sample',hidden:true});assert.ok(!buildPages(project)[0].items.some(i=>i.editKey===swatch.editKey));
 project.layout.drawingEdits[swatch.editKey]={x:73,y:250,name:'Moved again',hidden:false};pages=buildPages(project);project=withStyle(project,pages,'SR fiber',{weight:7});
 assert.deepEqual(project.layout.drawingEdits[wider.editKey],{x:73,y:250,name:'Moved again',hidden:false});const restored=buildPages(project)[0].items.find(i=>i.editKey===wider.editKey);assert.equal(restored.x,73);assert.equal(restored.name,'Moved again');
});

test('a selected line width draft migrates its moved legend before the style save is committed',()=>{
 const project=sampleSite();let pages=buildPages(project);const line=paths(pages,'SR fiber')[0],sample=pages[0].items.find(i=>i.legendEntry&&i.type==='rect'&&i.linkType==='SR fiber');
 project.layout={drawingEdits:{[sample.editKey]:{x:48,y:263,name:'Moved backbone sample'}}};pages=buildPages(project);
 const draft={...project,layout:{...project.layout,drawingEdits:{...project.layout.drawingEdits,[line.editKey]:{weight:5,name:'Selected backbone'}}}},next=withStyle(draft,pages,'SR fiber',{color:'#2468AC',opacity:1}),rebuilt=buildPages(next),changed=rebuilt[0].items.find(i=>i.legendEntry&&i.type==='rect'&&i.linkType==='SR fiber');
 assert.equal(changed.sampleWeight,5);assert.equal(changed.x,48);assert.equal(changed.y,263);assert.equal(changed.name,'Moved backbone sample');assert.equal(paths(rebuilt,'SR fiber')[0].weight,5);assert.equal(project.layout.drawingEdits[line.editKey],undefined);
});

test('fractional presentation scaling keeps hidden legend width keys exact',()=>{
 let project=sampleSite();project.layout={linkStyles:{'SR fiber':{weight:6}},presentation:{defaults:{drawingScale:.8,panel:{scale:.75}}}};let pages=buildPages(project);
 const sample=pages[0].items.find(i=>i.legendEntry&&i.type==='rect'&&i.linkType==='SR fiber');project.layout.drawingEdits={[sample.editKey]:{name:'Hidden scaled key',hidden:true}};pages=buildPages(project);
 project=withStyle(project,pages,'SR fiber',{weight:7});const key=(pages[0].editScope||pages[0].name)+'|legend|'+legendEntryId('SR fiber','#FF0000',1,true,7)+'|swatch';assert.equal(project.layout.drawingEdits[key].name,'Hidden scaled key');assert.equal(project.layout.drawingEdits[key].hidden,true);assert.ok(!buildPages(project)[0].items.some(i=>i.editKey===key));
});

test('explicit line captions appear with automatic cable captions off and clearing them restores the default',()=>{
 let project=sampleSite(),pages=buildPages(project);assert.ok(!pages[0].items.some(i=>i.labelRole==='media'));
 project=withStyle(project,pages,'SR fiber',{color:'#2468AC',title:'Backbone legend',lineTitle:'SR fiber',lineDescription:''});assert.equal(hasLineCaption(project,'SR fiber'),false);pages=buildPages(project);assert.ok(!pages[0].items.some(i=>i.labelRole==='media'));
 project=withStyle(project,pages,'SR fiber',{lineTitle:'Backbone connection',lineDescription:'North workshop'});assert.equal(hasLineCaption(project,'SR fiber'),true);pages=buildPages(project);assert.ok(pages[0].items.some(i=>i.labelRole==='media'&&i.value.includes('Backbone connection')));assert.ok(pages[0].items.some(i=>i.labelRole==='media'&&i.value.includes('North workshop')));
 project=withStyle(project,pages,'SR fiber',{lineTitle:'',lineDescription:''});assert.equal(hasLineCaption(project,'SR fiber'),false);assert.ok(!buildPages(project)[0].items.some(i=>i.labelRole==='media'));
});
