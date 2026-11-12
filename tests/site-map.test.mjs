import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSite} from '../src/web/sample.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {cleanSiteMap,siteMapSettings,SITE_MAP_DETAILS} from '../src/web/site-map-settings.mjs';
import {pageFamily} from '../src/web/page-options.mjs';
import {globalTextCategory} from '../src/web/global-text-styles.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {unzip} from '../src/web/zip.mjs';
import {fictionalCampus} from './fixtures/site-map-campus.mjs';

const siteMap=project=>buildPages(project).find(p=>p.name==='Site Map');
const cards=p=>p.items.filter(i=>i.type==='device'&&i.siteMapNode);
const lines=p=>p.items.filter(i=>i.type==='path'&&i.siteMapEdge);
const texts=(p,slot)=>p.items.filter(i=>i.type==='text'&&(!slot||i.siteMapSlot===slot));
const overlap=(a,b)=>a.x<b.x+b.w-.5&&b.x<a.x+a.w-.5&&a.y<b.y+b.h-.5&&b.y<a.y+a.h-.5;
const withLayout=(project,layout)=>({...project,layout:{...project.layout,...layout}});

test('the site map follows the network page and shows the hierarchy with grouped access points',()=>{
 const pages=buildPages(sampleSite()),index=pages.findIndex(p=>p.name==='Site Map'),p=pages[index];
 assert.ok(index>0);assert.equal(pageFamily(pages[index-1].name),'core');assert.equal(pageFamily(p.name),'sitemap');assert.equal(p.title,'Site map');
 const names=p.siteMap.nodes.map(n=>n.name);
 for(const name of ['EDGE-01','SW-1','SW-2'])assert.ok(names.includes(name),name);
 assert.ok(p.siteMap.nodes.some(n=>n.kind==='handoff'),'WAN handoff card');
 const groups=p.siteMap.nodes.filter(n=>n.kind==='ap');assert.ok(groups.length>=1&&groups.every(n=>n.group>=2&&/access points$/.test(n.name)));
 // Levels: the edge first, then the firewall, then switches.
 const level=name=>p.siteMap.nodes.find(n=>n.name===name).level;
 assert.ok(level('EDGE-01')<level('SW-1')&&level('SW-1')<level('SW-2'));
 // Cards never overlap and every connection is orthogonal and glued to its cards.
 const all=cards(p);for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(!overlap(all[i],all[j]),all[i].name+' / '+all[j].name);
 for(const line of lines(p)){
  assert.ok(line.points.length>=2);for(let i=1;i<line.points.length;i++)assert.ok(line.points[i][0]===line.points[i-1][0]||line.points[i][1]===line.points[i-1][1],line.name);
  for(const end of [line.from,line.to]){const card=all.find(c=>c.key===end.device);assert.ok(card);const [nx,ny]=card.ports[end.port];assert.ok(Math.abs(card.x+nx*card.w-end.x)<1e-6&&Math.abs(card.y+ny*card.h-end.y)<1e-6);}
  assert.deepEqual(line.points[0],[line.from.x,line.from.y]);assert.deepEqual(line.points.at(-1),[line.to.x,line.to.y]);
 }
 assert.ok(texts(p).every(t=>textLayout(t).size>=8));
 assert.ok(texts(p,'link').some(t=>/Gbps/.test(t.value)),'speed captions');
});

test('site map options choose card details, grouping, captions and rows',()=>{
 const base=sampleSite();
 const detail=siteMap(withLayout(base,{siteMap:{details:['model','vlans','serial']}}));
 assert.ok(!texts(detail,'detail').some(t=>t.editKey.endsWith('|detail|ip')),'no IP lines');
 assert.ok(texts(detail,'detail').some(t=>t.editKey.endsWith('|detail|model')));
 const each=siteMap(withLayout(base,{siteMap:{accessPoints:'each'}}));
 assert.ok(each.siteMap.nodes.filter(n=>n.kind==='ap').every(n=>!n.group));assert.ok(each.siteMap.nodes.filter(n=>n.kind==='ap').length>=4);
 const hidden=siteMap(withLayout(base,{siteMap:{accessPoints:'hidden',wan:false,linkLabels:'none'}}));
 assert.ok(!hidden.siteMap.nodes.some(n=>n.kind==='ap'||n.kind==='handoff'));assert.equal(texts(hidden,'link').length,0);
 const ports=siteMap(withLayout(base,{siteMap:{linkLabels:'ports',accessPoints:'each'}}));
 assert.ok(texts(ports,'link').some(t=>/ – /.test(t.value)),'port names on a single link');
 // Stored only where different from the defaults, and kept by cleanLayout.
 assert.equal(cleanSiteMap({details:['role','model','ip','ports'],accessPoints:'grouped'}),undefined);
 assert.deepEqual(cleanSiteMap({details:['ip','model','bogus'],direction:'right',wan:false,accessPoints:'nope'}),{details:['model','ip'],direction:'right',wan:false});
 assert.deepEqual(cleanLayout({siteMap:{direction:'down',unconnected:false}},[]).siteMap,{direction:'down',unconnected:false});
 assert.equal(siteMapSettings({}).direction,'auto');assert.equal(SITE_MAP_DETAILS.length,9);
});

test('stacks are one card and leaf devices sit with their parent',()=>{
 const project=fictionalCampus();project.layout={deviceStacks:[{id:'cores',name:'CORE-STACK',members:[{deviceId:'core1',number:1},{deviceId:'core2',number:2}]}]};
 const p=siteMap(project),stack=p.siteMap.nodes.find(n=>n.id==='stack:cores');
 assert.ok(stack);assert.equal(stack.stack,2);assert.deepEqual(stack.devices,['core1','core2']);
 assert.ok(!p.siteMap.nodes.some(n=>n.name==='CORE-1'));
 assert.ok(texts(p,'detail').some(t=>/stack · 2 members/.test(t.value)));
 // Each access switch's access points sit directly beside or below it.
 const plain=siteMap(fictionalCampus()),card=name=>cards(plain).find(c=>c.name===name);
 for(let i=1;i<=8;i++){
  const sw=card('IDF-0'+i+'-ACCESS'),ap=cards(plain).filter(c=>c.kind==='ap').find(c=>lines(plain).some(l=>[l.from.device,l.to.device].includes(c.key)&&[l.from.device,l.to.device].includes(sw.key)));
  assert.ok(ap,'access point card for switch '+i);
  const gap=Math.max(ap.x-(sw.x+sw.w),sw.x-(ap.x+ap.w),ap.y-(sw.y+sw.h),sw.y-(ap.y+ap.h));assert.ok(gap<150,'leaf next to its switch '+i+': '+gap);
 }
 // The unconnected printer has its own heading.
 assert.ok(plain.items.some(i=>i.editKey==='Site Map|unconnected-heading'));
 const without=siteMap(withLayout(fictionalCampus(),{siteMap:{unconnected:false}}));assert.ok(!without.siteMap.nodes.some(n=>n.name==='PRINTER-LOBBY'));
});

test('direction, fixed paper and readable text',()=>{
 const down=siteMap(withLayout(fictionalCampus(),{siteMap:{direction:'down'}})),right=siteMap(withLayout(fictionalCampus(),{siteMap:{direction:'right'}}));
 assert.equal(down.siteMap.direction,'down');assert.equal(right.siteMap.direction,'right');
 // Left to right: every connection between rows runs left to right.
 const level=new Map(right.siteMap.nodes.map(n=>[n.id,n.level]));
 for(const line of lines(right)){const [a,b]=line.siteMapEdge.split('~');if(level.get(a)!=null&&level.get(b)!=null&&level.get(a)!==level.get(b)&&!line.siteMapLeaf)assert.ok(line.points[0][0]!==line.points.at(-1)[0]);}
 for(const preset of ['a5','letter','a3'])for(const orientation of ['portrait','landscape']){
  const site=sampleSite();site.layout={pageSetup:{default:{preset,orientation}}};const p=siteMap(site);
  assert.ok(p.mapFits,preset+' '+orientation);
  for(const item of p.items.filter(i=>i.type!=='path'))assert.ok(item.x>=0&&item.x+item.w<=p.width+1&&item.y+item.h<=p.height+1,preset+' '+orientation+' '+(item.editKey||item.value));
  assert.ok(texts(p).every(t=>textLayout(t).size>=8),preset+' '+orientation);
 }
 // A dense site on a small fixed page still fits the page.
 const campus=fictionalCampus();campus.layout={pageSetup:{default:{preset:'letter',orientation:'landscape'}}};const dense=siteMap(campus);
 assert.ok(dense.mapFits);for(const item of dense.items.filter(i=>i.type!=='path'))assert.ok(item.x+item.w<=dense.width+1&&item.y+item.h<=dense.height+1);
});

test('saved card positions, text, widths and edits persist; a warm build matches a cold one',async()=>{
 const project=sampleSite(),first=siteMap(project),card=cards(first).find(c=>c.name==='SW-2'),name=texts(first,'name').find(t=>t.siteMapOwner===card.siteMapNode),line=lines(first)[0];
 project.layout={...project.layout,drawingEdits:{[card.editKey]:{x:card.x+300,y:card.y+40},[name.editKey]:{value:'SW-2 (lab)'},[line.editKey]:{weight:7}}};
 const second=siteMap(project),moved=cards(second).find(c=>c.editKey===card.editKey);
 assert.equal(moved.x,card.x+300);assert.equal(moved.y,card.y+40);
 assert.equal(texts(second,'name').find(t=>t.siteMapOwner===card.siteMapNode).value,'SW-2 (lab)');
 assert.equal(lines(second).find(l=>l.editKey===line.editKey).weight,7);
 // Connections of the moved card stay glued to it.
 for(const l of lines(second).filter(l=>[l.from.device,l.to.device].includes(moved.key))){const end=l.from.device===moved.key?l.from:l.to;assert.ok(end.x>=moved.x-.01&&end.x<=moved.x+moved.w+.01&&end.y>=moved.y-.01&&end.y<=moved.y+moved.h+.01);}
 // Text categories: names, details and captions follow Global text styles.
 assert.equal(globalTextCategory(texts(second,'name')[0]),'deviceNames');assert.equal(globalTextCategory(texts(second,'detail')[0]),'deviceDetails');assert.equal(globalTextCategory(texts(second,'link')[0]),'linkLabels');
 const cache=new Map(),cold=buildPages(project).map(p=>p.svg),warm1=buildPages(project,{cache}).map(p=>p.svg),warm2=buildPages(project,{cache}).map(p=>p.svg);
 assert.deepEqual(warm1,cold);assert.deepEqual(warm2,cold);
 // Site map options change only the site map's draft.
 const changed=withLayout(project,{siteMap:{accessPoints:'each'}}),after=buildPages(changed,{cache});
 assert.notEqual(after.find(p=>p.name==='Site Map').svg,cold[buildPages(project).findIndex(p=>p.name==='Site Map')]);
 // The native Visio copy keeps every card and glued connection.
 const files=await unzip(await exportVisio(project,[second]).arrayBuffer()),page=new TextDecoder().decode(files.get('visio/pages/page1.xml'));
 assert.equal((page.match(/<Connect /g)||[]).length,lines(second).length*2);
});
