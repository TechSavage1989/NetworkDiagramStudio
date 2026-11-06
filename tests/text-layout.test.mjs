import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {displayPortCaption,svgPage,textLayout} from '../src/web/diagram/scene.mjs';
import {intersects,textWidth} from '../src/web/diagram/labels.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {unzip} from '../src/web/zip.mjs';

const decode=new TextDecoder(),compact=value=>String(value).replace(/\s/g,'');
const moduleFixture=()=>{const site=sampleSite();for(const d of site.devices.filter(d=>d.kind!=='ap'))d.name='LAB-CAMPUS-EXAMPLE-NETWORK-ROOM-'+d.id+'-LONG-DEVICE-NAME';return site;};

test('SVG and native Visio render the same full measured caption without ellipsis',async()=>{
 const value='A complete interface description that wraps onto several readable lines',item={type:'text',x:40,y:180,w:170,h:100,value,size:12,bold:false,color:'#16364A',align:'left',editKey:'caption'},page={name:'Caption',title:'Caption',width:1200,height:975,items:[item]},layout=textLayout(item);
 assert.ok(layout.lines.length>1);assert.equal(layout.size,12);assert.equal(compact(layout.lines.join('')),compact(value));assert.ok(layout.lines.every(line=>textWidth(line,layout.size)-6<=item.w));
 const svg=svgPage(page);assert.match(svg,/<tspan /);assert.ok(!svg.includes('…'));for(const line of layout.lines)assert.ok(svg.includes('>'+line+'</tspan>'));
 const parts=await unzip(await exportVisio({},[page]).arrayBuffer()),xml=decode.decode(parts.get('visio/pages/page1.xml'));assert.ok(xml.includes(layout.lines.join('\n')));assert.ok(!xml.includes('…'));assert.match(xml,/<Cell N="Size" V="0.125"\/>/);
 assert.equal(item.value,value);assert.equal(item.editKey,'caption');
});

test('port module legends show complete assignments in measured rows without overlap',()=>{
 const site=moduleFixture(),pages=buildPages(site),modulePages=pages.filter(page=>page.items.some(item=>item.moduleLegend));assert.ok(modulePages.length);
 for(const page of modulePages){const captions=page.items.filter(item=>item.moduleLegend);for(const item of captions){const layout=textLayout(item);assert.equal(compact(layout.lines.join('')),compact(item.value));assert.equal(layout.size,item.size);assert.ok(item.x+item.w<=1164);assert.ok(item.y+item.h<=900);assert.ok(!page.svg.includes('…'));}
  for(let i=0;i<captions.length;i++)for(let j=i+1;j<captions.length;j++)assert.ok(!intersects(captions[i],captions[j]),'module captions overlap');
 }
 const descriptions=modulePages.flatMap(page=>page.items.filter(item=>item.editKey?.endsWith('|ports'))).map(item=>item.value).join(' / ');for(const d of site.devices.filter(d=>['edge','sw-1','sw-2'].includes(d.id)))assert.ok(descriptions.includes(d.name),d.name);
});

test('edited module descriptions retain one full-value edit key and continue when the sidebar is full',async()=>{
 const site=moduleFixture(),original=buildPages(site).flatMap(page=>page.items).find(item=>item.moduleLegend&&item.editKey.endsWith('|ports')),value=Array.from({length:180},(_,i)=>'Interface'+i).join(' ');site.layout={drawingEdits:{[original.editKey]:{value,color:'#224466'}}};
 const pages=buildPages(site),matches=pages.flatMap(page=>page.items).filter(item=>item.editKey===original.editKey);assert.equal(matches.length,1);assert.equal(matches[0].value,value);assert.equal(matches[0].color,'#224466');assert.equal(textLayout(matches[0]).size,11);assert.ok(pages.some(page=>page.title==='Port modules'));
 const parts=await unzip(await exportVisio(site,pages).arrayBuffer()),xml=[...parts].filter(([key])=>/^visio\/pages\/page\d+\.xml$/.test(key)).map(([,bytes])=>decode.decode(bytes)).join('');for(const word of value.split(' '))assert.ok(xml.includes(word));assert.ok(!xml.includes('…'));
});

test('port captions avoid duplicate port wording without changing interface identifiers',()=>{
 for(const [port,caption] of [['port1','port1'],['Port2','Port2'],['x3','Port x3'],['1/1/49','Port 1/1/49']]){
  assert.equal(displayPortCaption(port),caption);const site={name:'Handoff lab',devices:[{id:'edge',name:'LAB-EDGE',kind:'firewall',ports:[{name:port,role:'wan',state:'up',gateway:'192.0.2.1',speed:'1 Gbps'}]}],links:[]},pages=buildPages(site),text=pages.flatMap(page=>page.items.filter(item=>item.deviceTextOwner&&item.value)).map(item=>item.value).join(' ');assert.ok(text.includes(caption+' | Gateway 192.0.2.1'));assert.ok(!text.includes('Port port'));assert.equal(site.devices[0].ports[0].name,port);
 }
});

test('generated and imported core and wireless cables retain their editable connection metadata',()=>{
 const site=sampleSite(),pages=buildPages(site),paths=pages.flatMap(page=>page.items.filter(item=>item.type==='path'));assert.ok(paths.some(path=>path.generatedDevice));assert.ok(paths.some(path=>path.name.startsWith('AP link')));
 for(const path of paths){assert.ok(Object.hasOwn(path.sourceLink,'media'));assert.ok(Object.hasOwn(path.sourceLink,'speed'));assert.ok(Object.hasOwn(path.sourceLink,'status'));if(path.generatedDevice){assert.equal(path.sourceLink.status,'configured');assert.ok(path.sourceLink.speed);}else{const source=site.links.find(link=>link.a===path.sourceLink.a&&link.ap===path.sourceLink.ap&&link.b===path.sourceLink.b&&link.bp===path.sourceLink.bp);assert.ok(source);for(const key of ['media','speed','status'])assert.equal(path.sourceLink[key],source[key]);}}
});

test('long project names, access point names and table values are fully visible',()=>{
 const site=sampleSite();site.name=Array.from({length:16},(_,i)=>'Campus'+i).join(' ');const ap=site.devices.find(d=>d.kind==='ap');ap.name='LAB-WIRELESS-ACCESS-POINT-WITH-A-LONG-BUT-USEFUL-LOCATION-NAME';site.devices[0].routes=[{destination:'W'.repeat(110),gateway:'192.0.2.254'}];const pages=buildPages(site);
 assert.ok(pages.every(page=>!page.svg.includes('…')));assert.ok(pages.every(page=>page.items.find(item=>item.value===site.name)));const title=pages.filter(page=>page.title==='Wireless Connections').flatMap(page=>page.items).find(item=>item.value===ap.name);assert.ok(title);assert.ok(textLayout(title).lines.length>1);assert.equal(textLayout(title).size,18);
 const table=pages.filter(page=>page.title==='VLANs and Routing').flatMap(page=>page.items.filter(item=>item.type==='text'));assert.ok(table.filter(item=>/^W+$/.test(item.value)).map(item=>item.value).join('').includes('W'.repeat(110)));
});

test('impossible manual text boxes fail clearly at readable minimum size instead of clipping',()=>{
 assert.throws(()=>textLayout({value:'W'.repeat(600),size:12,w:20,h:18,bold:true}),/text needs more space/);assert.throws(()=>textLayout({value:'A'.repeat(10000),size:12000,w:20,h:18}),/text needs more space/);
});

test('core device details include a distinct platform without duplicating its model',()=>{
 const site={name:'Compute lab',devices:[{id:'compute',name:'LAB-HOST',kind:'hypervisor',vendor:'Dell',model:'PowerEdge R760',technology:'Proxmox VE',ip:'192.0.2.20',ports:[]}],links:[]};let detail=buildPages(site).flatMap(page=>page.items).find(item=>item.titleOwner==='compute'&&item.titleSlot==='detail');assert.ok(detail.value.includes('PowerEdge R760  |  Proxmox VE'));assert.equal(textLayout(detail).size,12);
 site.devices[0].technology='PowerEdge R760';detail=buildPages(site).flatMap(page=>page.items).find(item=>item.titleOwner==='compute'&&item.titleSlot==='detail');assert.equal(detail.value.match(/PowerEdge R760/g).length,1);
});
