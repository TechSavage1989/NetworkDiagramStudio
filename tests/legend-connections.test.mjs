import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSite} from '../src/web/sample.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {legendConnections,commonConnectionDetails,changeLegendConnections} from '../src/web/legend-connections.mjs';
import {ProjectHistory} from '../src/web/history.mjs';
import {sameConnection} from '../src/web/connection-edit.mjs';
import {unzip} from '../src/web/zip.mjs';

test('legend metadata changes all associated connections atomically and preserves other types',async()=>{
 const before=sampleSite(),pages=buildPages(before),matches=legendConnections(before,pages,'AP copper');assert.ok(matches.length>1);
 const history=new ProjectHistory(before),next=changeLegendConnections(before,pages,'AP copper',{media:'DAC',speed:'25 Gbps'},{color:'#815AC0',title:'AP copper',lineTitle:'AP copper'});
 assert.ok(matches.every(({link})=>next.links.some(l=>sameConnection(l,link)&&l.media==='DAC'&&l.speed==='25 Gbps')));
 for(const link of before.links.filter(l=>!matches.some(r=>sameConnection(l,r.link))))assert.deepEqual(next.links.find(l=>sameConnection(l,link)),link);
 assert.ok(matches.every(({link})=>link.media==='copper'));history.record(next,'link-style');assert.deepEqual(history.travel(next),before);assert.deepEqual(history.travel(before,{redo:true}),JSON.parse(JSON.stringify(next)));
 const reopened=JSON.parse(JSON.stringify(next)),rebuilt=buildPages(reopened),wireless=rebuilt.filter(p=>p.title==='Wireless Connections');assert.ok(wireless.length);
 assert.ok(wireless.every(p=>p.items.filter(i=>i.type==='path').every(i=>i.linkType==='DAC'&&i.color==='#815AC0'&&i.sourceLink.speed==='25 Gbps')));
 assert.ok(wireless.every(p=>p.svg.includes('25 Gbps')));assert.equal(next.layout.linkStyles.DAC.title,'DAC');
 const files=await unzip(await exportVisio(reopened,rebuilt).arrayBuffer()),xml=[...files].filter(([key])=>/pages\/page\d+\.xml$/.test(key)).map(([,data])=>new TextDecoder().decode(data)).join('');assert.match(xml,/25 Gbps/);assert.match(xml,/#815AC0/);
});

test('mixed legend metadata is retained unless selected and custom values stay editable',()=>{
 const before=sampleSite(),matches=legendConnections(before,buildPages(before),'AP copper');before.links.find(l=>sameConnection(l,matches[0].link)).speed='100 Mbps';
 let pages=buildPages(before),records=legendConnections(before,pages,'AP copper');assert.deepEqual(commonConnectionDetails(records),{media:'copper',speed:null});
 const colorOnly=changeLegendConnections(before,pages,'AP copper',{}, {color:'#123456'});assert.deepEqual(colorOnly.links,before.links);
 const custom=changeLegendConnections(before,pages,'AP copper',{media:'Lab cable',speed:'12.5 Gbps'},{});pages=buildPages(custom);records=legendConnections(custom,pages,'Lab cable');assert.deepEqual(commonConnectionDetails(records),{media:'Lab cable',speed:'12.5 Gbps'});
 const again=changeLegendConnections(custom,pages,'Lab cable',{media:'SR',speed:'10 Gbps'},{});assert.ok(buildPages(again).some(p=>p.items.some(i=>i.legendEntry&&i.value?.includes('10 Gbps'))));
 assert.throws(()=>changeLegendConnections(before,buildPages(before),'AP copper',{speed:'bad\nvalue'},{}),/one line/);assert.equal(commonConnectionDetails(legendConnections(before,buildPages(before),'AP copper')).speed,null);
});

test('legend changes materialize inferred handoffs once and retain bends, names and widths',()=>{
 const before=sampleSite(),pages=buildPages(before),path=pages[0].items.find(i=>i.type==='path'&&i.generatedDevice),type=path.linkType;
 before.layout={drawingEdits:{[path.editKey]:{points:path.points,name:'WAN route',weight:6}}};const count=before.links.length;
 const next=changeLegendConnections(before,buildPages(before),type,{media:'LR',speed:'10 Gbps'},{}),rebuilt=buildPages(next),line=rebuilt.flatMap(p=>p.items).find(i=>i.type==='path'&&sameConnection(i.sourceLink,path.sourceLink));
 assert.ok(next.links.length>count);assert.equal(next.devices.find(d=>d.id===path.generatedDevice.id).scopeOverride,true);assert.equal(line.name,'WAN route');assert.equal(line.weight,6);assert.deepEqual(line.points,path.points);
 const second=changeLegendConnections(next,rebuilt,'LR fiber',{speed:'25 Gbps'},{});assert.equal(second.links.length,next.links.length);assert.equal(second.devices.length,next.devices.length);
});

test('legend edits refresh overridden cable details and unchanged speed selections still appear in the key',()=>{
 const project=sampleSite();project.layout={cableCaptions:true};const pages=buildPages(project),path=pages[0].items.find(i=>i.type==='path'&&i.linkType==='SR fiber'),label=pages[0].items.find(i=>i.labelRole==='media'&&i.linkId===path.linkId);
 project.layout={cableCaptions:true,drawingEdits:{[label.editKey]:{value:'Outdated cable detail',color:'#334455'}}};
 const next=changeLegendConnections(project,buildPages(project),'SR fiber',{media:'LR',speed:'25 Gbps'},{}),texts=buildPages(next).flatMap(p=>p.items).filter(i=>i.type==='text');
 assert.ok(!texts.some(t=>t.value==='Outdated cable detail'));assert.equal(next.layout.drawingEdits[label.editKey].color,'#334455');assert.ok(texts.some(t=>t.value.includes('25 Gbps')));
 const same=changeLegendConnections(project,buildPages(project),'SR fiber',{media:'SR',speed:'10 Gbps'},{});assert.ok(buildPages(same).flatMap(p=>p.items).some(i=>i.legendEntry&&i.value?.includes('10 Gbps')));
});
