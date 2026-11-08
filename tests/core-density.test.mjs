import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages as buildPaperPages,exportVisio} from '../src/web/diagram/index.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';
import {unzip} from '../src/web/zip.mjs';
import {textLayout,cableWeight} from '../src/web/diagram/scene.mjs';

const core=project=>buildPages(project).filter(page=>page.coreDeviceIds);
const fixture=()=>({name:'Harbor Workshop',devices:[
 {id:'edge',name:'Harbor-FortiGate-120G',kind:'firewall',vendor:'Fortinet',model:'FortiGate 120G',ports:[{name:'port1',role:'wan',handoff:'Metro Internet',gateway:'192.0.2.1',speed:'1 Gbps',media:'copper'},{name:'port2',role:'wan',handoff:'Backup Internet',gateway:'198.51.100.1',speed:'1 Gbps',media:'copper'},{name:'x3'}]},
 {id:'sw1',name:'LAB-Harbor-MDF-6100-1',vendor:'HPE Aruba',model:'JL675A',kind:'switch',ip:'10.10.11.1',ports:[{name:'1/1/49'},{name:'1/1/51'}]},
 {id:'sw2',name:'LAB-Harbor-MDF-6100-2',vendor:'HPE Aruba',model:'JL675A',kind:'switch',ip:'10.10.11.2',ports:[{name:'1/1/51'}]}
],links:[{a:'edge',ap:'x3',b:'sw1',bp:'1/1/49',media:'SR fiber',speed:'10 Gbps'},{a:'sw1',ap:'1/1/51',b:'sw2',bp:'1/1/51',media:'unknown',speed:'10 Gbps'}]});
const chain=count=>({name:'Capacity lab',devices:Array.from({length:count},(_,i)=>({id:'sw'+i,name:'LAB-SWITCH-'+(i+1),model:'JL675A',kind:'switch',ports:[{name:'1/1/49'},{name:'1/1/51'}]})),links:Array.from({length:count-1},(_,i)=>({a:'sw'+i,ap:'1/1/51',b:'sw'+(i+1),bp:'1/1/49',media:'fiber',speed:'10 Gbps'}))});
test('full-scale continuation retains readable legends, full module assignments and cable weights',()=>{
 const p={name:'Harbor Workshop',devices:Array.from({length:8},(_,i)=>({id:'d'+i,name:'LAB-DEVICE-'+(i+1),kind:'switch',model:i?'JL675A':'JL635A',ports:i?[]:[{name:'1/1/1',role:'wan',handoff:'Metro Internet',gateway:'192.0.2.1',media:'copper',speed:'1 Gbps'}]})),links:Array.from({length:7},(_,i)=>({a:'d0',ap:'1/1/'+(41+i),b:'d'+(i+1),bp:'1/1/49',media:'fiber',speed:'10 Gbps'}))};
 const pages=core(p),page=pages[0];assert.deepEqual(pages.flatMap(page=>page.coreDeviceIds),p.devices.map(d=>d.id));assert.ok(pages.length<=3);for(const sheet of pages){clear(sheet);for(const body of sheet.items.filter(i=>i.type==='device'&&i.kind==='switch'))assert.equal(body.w,700);}
 for(const text of page.items.filter(i=>i.type==='text'&&(i.legendEntry||i.moduleLegend))){assert.ok(text.size>=11);assert.equal(textLayout(text).size,text.size);assert.ok(text.x+text.w<page.sidebar.divider);}
 for(const line of page.items.filter(i=>i.type==='path'||i.legendEntry&&i.type==='rect'))assert.equal(line.sampleWeight||line.weight,cableWeight);
 const target=page.items.find(i=>i.moduleLegend&&i.editKey.endsWith('|ports'));if(target){p.layout={drawingEdits:{[target.editKey]:{color:'#2255AA'}}};assert.equal(core(JSON.parse(JSON.stringify(p)))[0].items.find(i=>i.editKey===target.editKey).color,'#2255AA');}
});
function clear(page){
 const texts=page.items.filter(i=>i.type==='text'),bodies=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),paths=page.items.filter(i=>i.type==='path'),segments=[];
 for(const text of texts.filter(i=>i.labelRole||i.titleOwner)){
  assert.ok(text.size>=12,'readable text size');
  for(const other of texts)if(other!==text)assert.ok(!intersects(text,other),'overlapping text');
  for(const body of bodies)assert.ok(!intersects(text,body),'text overlaps equipment');
  for(const path of paths)assert.ok(!pathCrossesText(path,text,1),'text overlaps a cable or hop');
 }
 for(const path of paths)for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],horizontal=a[1]===b[1],axis=a[horizontal?1:0],lo=Math.min(a[horizontal?0:1],b[horizontal?0:1]),hi=Math.max(a[horizontal?0:1],b[horizontal?0:1]);assert.ok(horizontal||a[0]===b[0]);
  for(const segment of segments)if(segment.path!==path&&segment.horizontal===horizontal&&Math.abs(segment.axis-axis)<2.2)assert.ok(Math.min(segment.hi,hi)<=Math.max(segment.lo,lo)+.01,'shared parallel cable');
  for(const body of bodies)if(![path.from.device,path.to.device].includes(body.key)&&![path.sourceLink?.a,path.sourceLink?.b].includes(body.sourceId))assert.ok(!(horizontal?axis>body.y&&axis<body.y+body.h&&Math.min(hi,body.x+body.w)>Math.max(lo,body.x):axis>body.x&&axis<body.x+body.w&&Math.min(hi,body.y+body.h)>Math.max(lo,body.y)),'cable crosses unrelated equipment '+JSON.stringify({page:page.name,a,b,body:body.key,from:path.from,to:path.to,link:path.sourceLink}));
  segments.push({path,horizontal,axis,lo,hi});
 }
}

test('all device orders retain two handoffs, a firewall and both switches on one clear core page',()=>{
 for(const order of [['edge','sw1','sw2'],['edge','sw2','sw1'],['sw1','edge','sw2'],['sw2','edge','sw1'],['sw1','sw2','edge'],['sw2','sw1','edge']]){
  const project=fixture();project.layout={order};const accepted=JSON.stringify(project),pages=core(project);assert.equal(pages.length,1,order.join(', '));assert.deepEqual(pages[0].coreDeviceIds,order);assert.equal(pages[0].items.filter(i=>i.type==='path').length,4);assert.equal(pages[0].items.filter(i=>i.kind==='handoff').length,2);clear(pages[0]);assert.equal(JSON.stringify(project),accepted);
 }
});

test('connected switches continue before any device is reduced from the shared width',()=>{
 const project=chain(5);project.devices.forEach(d=>{d.ports=[];});const pages=core(project);assert.equal(pages.length,2);assert.deepEqual(pages.flatMap(p=>p.coreDeviceIds),project.devices.map(d=>d.id));for(const page of pages){clear(page);for(const body of page.items.filter(i=>i.type==='device'&&i.kind==='switch'))assert.equal(body.w,700);}assert.deepEqual(core(project).map(p=>p.svg),pages.map(p=>p.svg));
});

test('overflow fills later automatic sheets instead of stranding individual devices',()=>{
 const project=chain(8),pages=core(project);assert.ok(pages.length>1&&pages.length<=3);assert.ok(pages[0].coreDeviceIds.length>=4);assert.ok(pages.slice(1).every(p=>p.coreDeviceIds.length>1));assert.deepEqual(pages.flatMap(p=>p.coreDeviceIds),project.devices.map(d=>d.id));for(const page of pages)clear(page);
 const links=new Set(pages.flatMap(p=>p.items.filter(i=>i.sourceLink).map(i=>JSON.stringify(i.sourceLink))));assert.equal(links.size,7);assert.ok(pages.every(p=>p.items.some(i=>i.labelRole==='reference')));
});

test('named pages use fit retries without changing assignments or saved edits and export native connections',async()=>{
 const project=fixture();project.layout={cableCaptions:true,order:['edge','sw2','sw1'],corePages:[{id:'primary',name:'Primary core',devices:['edge','sw1','sw2']}]};const initial=core(project),title=initial[0].items.find(i=>i.titleOwner==='edge'&&!i.titleSlot);project.layout.drawingEdits={[title.editKey]:{color:'#2255AA'}};const saved=JSON.stringify(project),pages=core(JSON.parse(saved));assert.equal(pages.length,1);assert.equal(pages[0].name,'Primary core');assert.equal(pages[0].items.find(i=>i.editKey===title.editKey).color,'#2255AA');assert.equal(JSON.stringify(project),saved);clear(pages[0]);
 const parts=await unzip(await exportVisio(project,pages).arrayBuffer()),xml=new TextDecoder().decode(parts.get('visio/pages/page1.xml'));assert.equal((xml.match(/<Connect /g)||[]).length,8);assert.ok(xml.includes('10 Gbps'));assert.ok(xml.includes('Primary core'));
});

// Fixed-paper regression coverage; new projects use a dynamic canvas.
function buildPages(project){return buildPaperPages({...project,layout:{...project.layout,pageSetup:project.layout?.pageSetup||{default:{preset:'original'}}}});}
