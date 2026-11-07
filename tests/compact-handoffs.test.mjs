import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {unzip} from '../src/web/zip.mjs';

const fixture=count=>({name:'Circuit lab',devices:[{id:'edge',name:'LAB-EDGE',kind:'firewall',model:'FortiGate 120G',ports:Array.from({length:count},(_,i)=>({name:'port'+(i*2+1),role:'wan',state:'up',handoff:'ISP '+(i+1),gateway:'192.0.2.'+(i+1),media:'copper',speed:'1 Gbps'}))}],links:[]});
const core=project=>buildPages(project).filter(p=>p.name.startsWith('Core Network'));
function legible(page){
 const texts=page.items.filter(i=>i.type==='text'),labels=texts.filter(i=>i.labelRole),bodies=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),paths=page.items.filter(i=>i.type==='path'),segments=[];
 for(const label of labels){for(const other of texts)if(other!==label)assert.ok(!intersects(label,other),'label overlaps text');for(const body of bodies)assert.ok(!intersects(label,body),'label overlaps a device');for(const path of paths)assert.ok(!pathCrossesText(path,label,1),'label overlaps a cable or jump');}
 for(const path of paths)for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],horizontal=a[1]===b[1],axis=a[horizontal?1:0],lo=Math.min(a[horizontal?0:1],b[horizontal?0:1]),hi=Math.max(a[horizontal?0:1],b[horizontal?0:1]);assert.ok(horizontal||a[0]===b[0],'diagonal cable');
  for(const s of segments)if(s.path!==path&&s.horizontal===horizontal&&Math.abs(s.axis-axis)<2.2)assert.ok(Math.min(s.hi,hi)<=Math.max(s.lo,lo)+.01,'shared parallel cable '+JSON.stringify({count:paths.length,a,b,other:[s.lo,s.hi,s.axis],length:Math.min(s.hi,hi)-Math.max(s.lo,lo)}));
  for(const body of bodies)if(![path.from.device,path.to.device].includes(body.key))assert.ok(!(horizontal?axis>body.y&&axis<body.y+body.h&&Math.min(hi,body.x+body.w)>Math.max(lo,body.x):axis>body.x&&axis<body.x+body.w&&Math.min(hi,body.y+body.h)>Math.max(lo,body.y)),'cable crosses another card');
  segments.push({path,horizontal,axis,lo,hi});
 }
}

test('one to seven circuit cards fit the stack width with complete, separated labels',()=>{
 for(let count=1;count<=7;count++){
  const pages=core(fixture(count));assert.equal(pages.length,1);const page=pages[0],host=page.items.find(i=>i.sourceId==='edge'),cards=page.items.filter(i=>i.kind==='handoff');assert.equal(cards.length,count);
  for(const card of cards){assert.ok(card.x>=host.x-.01&&card.x+card.w<=host.x+host.w+.01,'card extends past the stack');assert.ok(card.w<=300,'short card is unnecessarily wide');for(const text of page.items.filter(i=>i.deviceTextOwner===card.sourceId)){assert.ok(text.x>=card.x&&text.x+text.w<=card.x+card.w+.01);assert.ok(text.y>=card.y&&text.y+text.h<=card.y+card.h+.01);const layout=textLayout(text);assert.equal(layout.lines.join('').replace(/\s/g,''),String(text.value).replace(/\s/g,''));assert.equal(layout.size,text.size);}}
  for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++)assert.ok(!intersects(cards[i],cards[j]));
  if(count===2)assert.ok(Math.max(...cards.map(c=>c.x+c.w))-Math.min(...cards.map(c=>c.x))<host.w*.75,'simple pair should remain compact');
  legible(page);
 }
});

test('single facing circuit aligns to its real port and multirow circuits use internal corridors',()=>{
 const single=core(fixture(1))[0],direct=single.items.find(i=>i.type==='path');assert.equal(direct.points.length,2);assert.equal(direct.points[0][0],direct.points[1][0]);
 const page=core(fixture(3))[0],host=page.items.find(i=>i.sourceId==='edge'),paths=page.items.filter(i=>i.type==='path');assert.equal(paths.length,3);for(const path of paths)assert.ok(path.points.every(([x])=>x>=host.x&&x<=host.x+host.w),'unnecessary outer circuit rail');legible(page);
});

test('narrow device bodies use another card row instead of extending sideways',()=>{
 const project=fixture(2);project.devices[0].scale=.3;const page=core(project)[0],host=page.items.find(i=>i.sourceId==='edge'),cards=page.items.filter(i=>i.kind==='handoff');assert.ok(cards[0].y+cards[0].h<cards[1].y);for(const card of cards)assert.ok(card.x>=host.x-.01&&card.x+card.w<=host.x+host.w+.01);legible(page);
});

test('long circuit names and gateway details wrap fully in SVG and Visio',async()=>{
 const project=fixture(2);project.devices[0].ports[0].handoff='Example regional provider primary enterprise circuit and managed handoff';project.devices[0].ports[0].gateway='192.0.2.1, 198.51.100.1';project.devices[0].ports[1].handoff='Independent backup carrier circuit for the laboratory';
 const pages=buildPages(project),page=pages[0];legible(page);const captions=page.items.filter(i=>i.deviceTextOwner);assert.ok(captions.some(i=>textLayout(i).lines.length>1));
 const parts=await unzip(await exportVisio(project,pages).arrayBuffer()),xml=new TextDecoder().decode(parts.get('visio/pages/page1.xml'));
 for(const caption of captions){const full=String(caption.value).replace(/\s/g,'');assert.equal(textLayout(caption).lines.join('').replace(/\s/g,''),full);assert.ok(xml.replace(/\s/g,'').includes(full));}
 assert.ok(!page.svg.includes('…'));
});

test('explicit circuit placement and size remain editable',()=>{
 const project=fixture(1),before=core(project)[0],card=before.items.find(i=>i.kind==='handoff');project.layout={drawingEdits:{[card.editKey]:{x:350,w:340}}};const after=core(project)[0].items.find(i=>i.editKey===card.editKey);assert.equal(after.x,350);assert.equal(after.w,340);
});
