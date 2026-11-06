import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {changeLinkStyle,cleanLinkStyles,legendStyleId} from '../src/web/link-styles.mjs';
import {pageNumber,cleanPageNumbers} from '../src/web/page-options.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {unzip} from '../src/web/zip.mjs';
import {ProjectHistory} from '../src/web/history.mjs';

test('shared styles recolor matching cables and legends across sheets, retain captions and export native colors',async()=>{
 const site=sampleSite(),before=buildPages(site);site.layout={...changeLinkStyle(site,before,'AP copper',{color:'#815AC0',opacity:.7,title:'Access point uplinks',description:'Copper access links',lineTitle:'AP uplink',lineDescription:'Wireless network'})};
 site.layout=cleanLayout(JSON.parse(JSON.stringify(site.layout)),site.devices.map(d=>d.id));const pages=buildPages(site),wires=pages.filter(p=>p.title==='Wireless Connections');
 for(const page of wires){const cables=page.items.filter(i=>i.type==='path'),swatches=page.items.filter(i=>i.legendEntry&&i.type==='rect');assert.ok(cables.length);assert.ok(cables.every(i=>i.color==='#815AC0'&&i.opacity===.7));assert.ok(swatches.every(i=>i.fill==='#815AC0'&&i.opacity===.7));assert.ok(page.items.some(i=>i.legendFullText==='Access point uplinks'));assert.ok(page.items.some(i=>i.value?.includes('Wireless network')));}
 assert.ok(pages[0].items.some(i=>i.type==='path'&&i.linkType==='SR fiber'&&i.color==='#FF0000'));
 const files=await unzip(await exportVisio(site,pages).arrayBuffer());assert.ok([...files].some(([name,data])=>name.startsWith('visio/pages/page')&&new TextDecoder().decode(data).includes('<Cell N="LineColor" V="#815AC0"')));
});
test('link and legend edits share one undoable style and preserve moved or renamed legend entries',()=>{
 const site=sampleSite(),first=buildPages(site),sr=first[0].items.find(i=>i.type==='path'&&i.linkType==='SR fiber');site.layout={drawingEdits:{[sr.editKey]:{color:'#815AC0'}}};let pages=buildPages(site),legend=pages[0].items.find(i=>i.legendEntry&&i.type==='text'&&i.linkType==='SR fiber');
 site.layout.drawingEdits[legend.editKey]={x:108,y:250,color:'#C32B65'};const history=new ProjectHistory(site);
 Object.assign(site.layout,changeLinkStyle(site,pages,'SR fiber',{color:'#006775',title:'Building backbone',lineDescription:'Optical uplink'}));history.record(site,'link-style');pages=buildPages(site);
 assert.ok(pages[0].items.filter(i=>i.type==='path'&&i.linkType==='SR fiber').every(i=>i.color==='#006775'));legend=pages[0].items.find(i=>i.legendEntry&&i.type==='text'&&i.linkType==='SR fiber');assert.equal(legend.value,'Building backbone');assert.equal(legend.x,108);assert.equal(legend.color,'#C32B65');assert.ok(pages[0].items.some(i=>i.labelRole==='media'&&i.value.includes('Optical')));
 assert.ok(pages[0].items.filter(i=>i.labelRole==='media'&&i.value.includes('Optical')).every(i=>i.color==='#006775'));
 const restored=history.travel(site);assert.equal(restored.layout.linkStyles,undefined);const redone=history.travel(restored,{redo:true});assert.equal(redone.layout.linkStyles['SR fiber'].color,'#006775');
 assert.equal(cleanLinkStyles(JSON.parse('{"__proto__":{"color":"#ff0000"}}')).__proto__,undefined);
});
test('different unspecified media types retain independent legend bindings even when their colors match',()=>{
 const site=sampleSite();site.links[0].media='SFP';site.links[1].media='fiber';site.devices[0].ports[0].media='unknown';const pages=buildPages(site),entries=pages[0].items.filter(i=>i.legendEntry&&i.type==='rect');assert.equal(new Set(entries.map(i=>i.editKey)).size,entries.length);
 const original=pages[0].items.find(i=>i.type==='path'&&i.linkType==='Fiber, reach unspecified').color;site.layout=changeLinkStyle(site,pages,'SFP, media unspecified',{color:'#815AC0'});const next=buildPages(site)[0];assert.equal(next.items.find(i=>i.type==='path'&&i.linkType==='SFP, media unspecified').color,'#815AC0');assert.equal(next.items.find(i=>i.type==='path'&&i.linkType==='Fiber, reach unspecified').color,original);
 assert.equal(legendStyleId('Fiber, reach unspecified','#707A83',1,true),legendStyleId('Fiber, reach unspecified','#006775',.5,true));
});
test('page numbering supports visibility, a starting number, padding and custom templates in both exports',async()=>{
 const site=sampleSite(),count=buildPages(site).length;site.layout={pageNumbers:{show:true,start:17,pad:3,format:'Sheet {page} of {last} ({total} sheets)'}};site.layout=cleanLayout(site.layout,site.devices.map(d=>d.id));
 const pages=buildPages(site);assert.equal(pages[0].items.find(i=>i.editKey?.endsWith('|page-number')).value,'Sheet 017 of '+String(count+16).padStart(3,'0')+' ('+String(count).padStart(3,'0')+' sheets)');assert.ok(pages.at(-1).svg.includes('Sheet '+String(count+16).padStart(3,'0')));
 const files=await unzip(await exportVisio(site,pages).arrayBuffer());assert.ok(new TextDecoder().decode(files.get('visio/pages/page1.xml')).includes('Sheet 017 of'));
 site.layout.pageNumbers.show=false;assert.ok(buildPages(site).every(p=>!p.items.some(i=>i.editKey?.endsWith('|page-number'))));assert.equal(pageNumber({show:false},0,4),null);assert.equal(cleanPageNumbers({start:-3,pad:100}).start,1);
});
test('connection captions omit evidence status while preserving the connection record',()=>{
 const site=sampleSite();for(const link of site.links)link.status='observed';const wire=buildPages(site).filter(p=>p.title==='Wireless Connections');assert.ok(wire.length);assert.ok(wire.every(p=>!p.svg.includes('observed')));assert.ok(site.links.every(l=>l.status==='observed'));assert.ok(wire.some(p=>p.items.some(i=>i.value?.includes('1/1/21')&&i.value.includes('1 Gbps'))));
});
test('reference presentation uses Calibri, a left key, nearby labels and side-by-side handoff cards',()=>{
 const site=sampleSite();site.devices[0].ports.push({name:'port2',role:'wan',state:'up',speed:'1 Gbps'});const page=buildPages(site)[0],handoffs=page.items.filter(i=>i.type==='device'&&i.kind==='handoff'),devices=page.items.filter(i=>i.type==='device'&&['switch','firewall'].includes(i.kind));
 assert.equal(page.width,1200);assert.equal(page.height,975);assert.match(page.svg,/font-family:Calibri/);assert.equal(page.legendLayout,'sidebar');assert.ok(page.items.some(i=>i.value==='CONNECTION TYPES'&&i.x===38));assert.equal(handoffs.length,2);assert.equal(handoffs[0].y,handoffs[1].y);assert.ok(handoffs[0].x+handoffs[0].w<handoffs[1].x);
 for(const d of devices){const title=page.items.find(i=>i.titleOwner===d.sourceId&&!i.titleSlot),detail=page.items.find(i=>i.titleOwner===d.sourceId&&i.titleSlot==='detail');assert.ok(title);assert.ok(Math.abs(title.y+title.h-d.y)<45);assert.ok(detail);assert.ok(Math.min(Math.abs(detail.y-d.y-d.h),Math.abs(detail.y+detail.h-d.y))<60);}
});
