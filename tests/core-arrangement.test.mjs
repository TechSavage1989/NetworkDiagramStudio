import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {columnLayouts} from '../src/web/compact-layout.mjs';
import {cleanLayout,coreArrangement} from '../src/web/layout.mjs';
import {arrangeCoreLayout} from '../src/web/core-arrangement.mjs';
import {moveDrawingItems} from '../src/web/drawing-edits.mjs';
import {intersects} from '../src/web/diagram/labels.mjs';
import {ROUTE_STYLE} from '../src/web/diagram/routing.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {modularRoutingFixture} from './fixtures/modular-routing.mjs';

// Fictional campus: two firewalls, a chassis core and three access switches.
function campus(){
 const port=(name,o={})=>({name,state:'up',native:10,tagged:[20],...o});
 const firewall=(id,name)=>({id,name,kind:'firewall',vendor:'Fortinet',model:'FortiGate 120G',ports:[{name:'port1',role:'wan',state:'up',gateway:'198.51.100.1'},{name:'x1',state:'up'},{name:'x2',state:'up'}]});
 const stack=(id,name,count)=>({id,name,kind:'switch',vendor:'Aruba',model:'JL558A',stackMembers:Array.from({length:count},(_,i)=>({id:String(i+1),model:'JL558A'})),ports:Array.from({length:count},(_,i)=>[port((i+1)+'/49'),port((i+1)+'/50')]).flat()});
 const core={id:'core',name:'LAB-CORE',kind:'switch',vendor:'Aruba',model:'J9850A',modules:[{slot:'A',model:'J9993A'},{slot:'B',model:'J9993A'},{slot:'C',model:'J9987A'},{slot:'D',model:'J9993A'}],
  ports:[...['A','B','D'].flatMap(slot=>Array.from({length:8},(_,i)=>port(slot+(i+1)))),...Array.from({length:24},(_,i)=>port('C'+(i+1)))]};
 const access={id:'access',name:'LAB-ACCESS',kind:'switch',vendor:'Aruba',model:'JL724A',ports:Array.from({length:28},(_,i)=>port('1/1/'+(i+1)))};
 const link=(a,ap,b,bp,media='SR')=>({a,ap,b,bp,media,speed:'10 Gbps',status:'confirmed'});
 return {name:'Arrangement lab',devices:[firewall('fw-a','LAB-FW-A'),firewall('fw-b','LAB-FW-B'),core,stack('idf1','LAB-IDF1',3),access,stack('idf3','LAB-IDF3',2)],links:[
  link('fw-a','x1','core','A1'),link('fw-b','x1','core','A2'),link('fw-a','x2','core','B1'),link('fw-b','x2','core','B2'),
  link('core','A3','idf1','1/49'),link('core','A4','idf1','3/49'),link('core','A5','access','1/1/25'),link('core','D1','access','1/1/26'),
  link('core','C1','idf3','1/49','copper'),link('core','C2','idf3','2/49','copper'),link('idf1','1/50','access','1/1/27','DAC')]};
}
// Fictional equipment of every generic kind, including ones without artwork.
function mixed(){
 const ports=n=>Array.from({length:n},(_,i)=>({name:'eth'+i,state:'up'}));
 const devices=[
  {id:'rtr',name:'LAB-ROUTER',kind:'router',vendor:'Example',model:'Edge router',ports:ports(4)},
  {id:'fw',name:'LAB-FIREWALL',kind:'firewall',vendor:'Example',model:'Unknown firewall',ports:ports(6)},
  {id:'sw',name:'LAB-SWITCH',kind:'switch',vendor:'Example',model:'Unknown switch',ports:ports(24)},
  {id:'srv',name:'LAB-SERVER',kind:'server',vendor:'Example',model:'Rack server',ports:ports(2)},
  {id:'nas',name:'LAB-STORAGE',kind:'storage',vendor:'Example',model:'Storage array',ports:ports(2)},
  {id:'gen',name:'LAB-APPLIANCE',kind:'unknown',vendor:'Example',model:'Appliance',ports:ports(2)},
  {id:'ap',name:'LAB-AP',kind:'ap',vendor:'Example',model:'Access point',ports:ports(1)}];
 const link=(a,ap,b,bp)=>({a,ap,b,bp,media:'copper',speed:'1 Gbps',status:'confirmed'});
 return {name:'Generic lab',devices,layout:{includeAPs:true},links:[link('rtr','eth0','fw','eth0'),link('fw','eth1','sw','eth0'),link('sw','eth1','srv','eth0'),link('sw','eth2','nas','eth0'),link('sw','eth3','gen','eth0'),link('sw','eth4','ap','eth0'),link('srv','eth1','nas','eth1')]};
}
const arranged=(site,coreArrangement)=>({...site,layout:{...site.layout,coreArrangement}});
const core=site=>buildPages(site).find(page=>page.name==='Core Network');
const bodies=page=>page.items.filter(i=>i.type==='device'&&i.kind!=='plug'&&i.kind!=='handoff'&&page.coreDeviceIds.includes(i.sourceId));
// Reading order: down each column (left edges), then across.
const reading=page=>{const list=bodies(page),columns=[...new Set(list.map(b=>Math.round(b.x)))].sort((a,b)=>a-b);return columns.flatMap(x=>list.filter(b=>Math.round(b.x)===x).sort((a,b)=>a.y-b.y).map(b=>b.sourceId));};
const area=page=>page.width*page.height;

test('ordered columns keep the sequence, balance heights and align left edges',()=>{
 const boxes=[{id:'a',w:700,h:150},{id:'b',w:700,h:450},{id:'c',w:700,h:500},{id:'d',w:700,h:760},{id:'e',w:300,h:200}];
 const layouts=columnLayouts(boxes,{gapX:100,gapY:12,maxColumns:4});
 assert.deepEqual(layouts.map(l=>l.columns),[1,2,3,4]);
 assert.deepEqual(layouts[1].ids,[['a','b','c'],['d','e']],'The first column is filled in order and the columns are balanced');
 for(const layout of layouts){assert.deepEqual(layout.ids.flat(),['a','b','c','d','e']);for(const column of layout.ids)assert.equal(new Set(column.map(id=>layout.positions.get(id).x)).size,1);}
 assert.equal(layouts[1].h,Math.max(150+450+500+24,760+200+12));
});

test('compact is the default and packs the saved order into less area than one column',()=>{
 for(const site of [campus(),modularRoutingFixture()]){
  const compact=core(site),vertical=core(arranged(site,'vertical'));
  assert.equal(coreArrangement(site),'compact');assert.equal(compact.coreArrangement,'compact');assert.ok(compact.connectionLayout.columns>1,site.name+' uses several columns');
  assert.equal(vertical.connectionLayout.columns,1);assert.equal(new Set(bodies(vertical).map(b=>Math.round(b.x))).size,1,'Vertical stack keeps one column');
  assert.ok(area(compact)<area(vertical),site.name+' uses less area');
  const order=site.devices.map(d=>d.id);assert.deepEqual(reading(compact),order);assert.deepEqual(reading(vertical),order);
 }
 // A small drawing of wide 1U equipment is already most compact in one column.
 assert.equal(core(sampleSite()).connectionLayout.columns,1);
});

test('the saved device order drives the arrangement',()=>{
 const site=campus(),order=['core','idf1','access','idf3','fw-a','fw-b'];site.layout={order};
 const page=core(site);assert.deepEqual(reading(page),order);
 const columns=core(arranged(site,'columns-2'));assert.equal(columns.connectionLayout.columns,2);assert.deepEqual(reading(columns),order);
});

test('every arrangement keeps clearance, visible gaps and unobstructed labels for any device mix',()=>{
 const overlap=(a,b,c,d)=>Math.min(Math.max(a,b),Math.max(c,d))-Math.max(Math.min(a,b),Math.min(c,d));
 for(const base of [campus(),modularRoutingFixture(),mixed()])for(const mode of ['compact','vertical','columns-2','columns-3']){
  const page=core(arranged(base,mode)),equipment=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),runs=[];
  for(let i=0;i<equipment.length;i++)for(const other of equipment.slice(i+1))assert.ok(!intersects(equipment[i],other),base.name+' '+mode+': '+equipment[i].name+' overlaps '+other.name);
  for(const path of page.items.filter(i=>i.type==='path'&&i.sourceLink))for(let i=2;i<path.points.length-1;i++){
   const a=path.points[i-1],b=path.points[i],h=a[1]===b[1],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];assert.ok(h||a[0]===b[0],'orthogonal');
   if(equipment.some(n=>mid[0]>=n.x&&mid[0]<=n.x+n.w&&mid[1]>=n.y&&mid[1]<=n.y+n.h))continue;
   runs.push({path,h,c:h?a[1]:a[0],lo:Math.min(h?a[0]:a[1],h?b[0]:b[1]),hi:Math.max(h?a[0]:a[1],h?b[0]:b[1]),weight:path.weight||4});
  }
  for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){const s=runs[i],t=runs[j];if(s.path===t.path||s.h!==t.h||overlap(s.lo,s.hi,t.lo,t.hi)<=.5)continue;assert.ok(Math.abs(s.c-t.c)>=(s.weight+t.weight)/2+ROUTE_STYLE.gap-1e-6,base.name+' '+mode+': parallel cables '+Math.abs(s.c-t.c).toFixed(1)+' apart');}
  for(const run of runs.filter(r=>!r.h))for(const body of equipment){if(overlap(run.lo,run.hi,body.y,body.y+body.h)<=1)continue;const gap=run.c<body.x?body.x-run.c:run.c>body.x+body.w?run.c-body.x-body.w:-1;if(gap>=0)assert.ok(gap>=ROUTE_STYLE.clearance-run.weight/2-1e-6,base.name+' '+mode+': rail '+gap.toFixed(1)+' from '+body.name);}
  const labels=page.items.filter(i=>i.type==='text'&&i.labelRole);for(const label of labels)for(const body of equipment)assert.ok(!intersects(label,body),base.name+' '+mode+': '+label.value+' covers '+body.name);
 }
});

test('a dynamic page ends at its content instead of the planned rail reserve',()=>{
 const page=core(campus()),content=page.items.filter(i=>i.type==='device'||i.type==='path'||i.titleOwner||i.labelRole);
 const right=Math.max(...content.map(i=>i.type==='path'?Math.max(...i.points.map(p=>p[0])):i.x+i.w));assert.ok(page.width-right<=48,'No unused band on the right');
});

test('choosing an arrangement replaces moved positions, keeps styles and survives save and reopen',async()=>{
 const site=campus();let pages=buildPages(site),page=pages.find(p=>p.name==='Core Network');
 const body=page.items.find(i=>i.sourceId==='core'&&i.type==='device'),cable=page.items.find(i=>i.type==='path'&&i.sourceLink);
 site.layout={drawingEdits:{...moveDrawingItems(page,{},new Map([[body.editKey,[60,40]]])),[cable.editKey]:{color:'#815AC0',points:cable.points}}};
 pages=buildPages(site);page=pages.find(p=>p.name==='Core Network');
 assert.ok(Object.keys(site.layout.drawingEdits).filter(k=>k.includes('|device|')).length>=site.devices.length,'The first move pins every body');
 const layout=arrangeCoreLayout(site,pages,{mode:'vertical'});assert.equal(site.layout.coreArrangement,undefined,'The project is not mutated');
 assert.equal(layout.coreArrangement,'vertical');assert.ok(!Object.entries(layout.drawingEdits).some(([key,patch])=>key.startsWith('Core Network|')&&(Number.isFinite(patch.x)||Number.isFinite(patch.y)||patch.points)));
 assert.equal(layout.drawingEdits[cable.editKey].color,'#815AC0','Cable styles stay');
 const reopened={...site,layout:cleanLayout(JSON.parse(JSON.stringify(layout)),site.devices.map(d=>d.id))};assert.equal(reopened.layout.coreArrangement,'vertical');
 page=core(reopened);assert.equal(page.connectionLayout.columns,1);assert.equal(page.items.find(i=>i.editKey===cable.editKey).color,'#815AC0');
 assert.ok((await exportVisio(reopened,buildPages(reopened)).arrayBuffer()).byteLength>0);
 // A named page keeps its own choice, can return to the default, and other pages are untouched.
 const named={...site,layout:{corePages:[{id:'a',name:'Rack A',devices:['fw-a','fw-b','core']}]}},namedPages=buildPages(named);
 const own=arrangeCoreLayout(named,namedPages,{mode:'columns-2',corePageId:'a'});assert.equal(own.corePages[0].arrangement,'columns-2');assert.equal(own.coreArrangement,undefined);
 assert.equal(cleanLayout(own,site.devices.map(d=>d.id)).corePages[0].arrangement,'columns-2');
 assert.equal(arrangeCoreLayout({...named,layout:own},namedPages,{mode:null,corePageId:'a'}).corePages[0].arrangement,undefined);
 assert.throws(()=>arrangeCoreLayout(site,pages,{mode:'diagonal'}),/supported/);
});

test('an arrangement that cannot be routed falls back instead of failing the drawing',()=>{
 const page=core(arranged(modularRoutingFixture(),'columns-4'));assert.ok(page);assert.ok(page.connectionLayout.columns<4);assert.equal(page.arrangementFallback,true);
});

// Parallel runs anywhere outside equipment keep the visible gap, including
// socket leads, and turns inside a module stay clear of other sockets.
test('an MDF-shaped site keeps every cable apart and off the socket edges in each arrangement',async()=>{
 const {mdfLookalike}=await import('./fixtures/mdf-lookalike.mjs');
 for(const mode of ['compact','vertical','columns-2']){
  const page=core(arranged(mdfLookalike(),mode)),equipment=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),paths=page.items.filter(i=>i.type==='path'&&i.sourceLink),segments=[];
  for(const path of paths)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],h=a[1]===b[1];segments.push({path,h,c:h?a[1]:a[0],lo:Math.min(h?a[0]:a[1],h?b[0]:b[1]),hi:Math.max(h?a[0]:a[1],h?b[0]:b[1]),weight:path.weight||4});}
  const inside=([x,y])=>equipment.some(n=>x>n.x&&x<n.x+n.w&&y>n.y&&y<n.y+n.h);
  for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
   const s=segments[i],t=segments[j];if(s.path===t.path||s.h!==t.h)continue;const lo=Math.max(s.lo,t.lo),hi=Math.min(s.hi,t.hi);
   const mid=(lo+hi)/2;if(inside(s.h?[mid,s.c]:[s.c,mid]))continue;
   // Collinear cables that almost meet end to end would read as one line.
   if(hi-lo<=.5){if(Math.abs(s.c-t.c)<1)assert.ok(lo-hi>=ROUTE_STYLE.clearance-1e-6,mode+': '+s.path.name+' and '+t.path.name+' nearly meet ('+(lo-hi).toFixed(1)+')');continue;}
   assert.ok(Math.abs(s.c-t.c)>=(s.weight+t.weight)/2+ROUTE_STYLE.gap-1e-6,mode+': '+s.path.name+' and '+t.path.name+' run '+Math.abs(s.c-t.c).toFixed(1)+' apart');
  }
  // Module turns keep a visible gap from the sockets they pass (a socket is about 14 units tall).
  for(const s of segments.filter(s=>s.h))for(const n of equipment)for(const [name,[px,py]] of Object.entries(n.ports||{})){
   const x=n.x+px*n.w,y=n.y+py*n.h;if(x<s.lo-2||x>s.hi+2||[s.path.from,s.path.to].some(e=>e?.device===n.key&&e.port===name))continue;
   assert.ok(Math.abs(s.c-y)>=9,mode+': '+s.path.name+' runs '+Math.abs(s.c-y).toFixed(1)+' from socket '+name);
  }
 }
});

test('generic symbols give each unmatched port its own attachment point',()=>{
 for(const mode of ['compact','columns-2','columns-3']){
  const page=core(arranged(mixed(),mode)),ends=page.items.filter(i=>i.type==='path'&&i.sourceLink).flatMap(p=>[p.from,p.to]).filter(e=>/^uplink\./.test(e.port));
  const points=ends.map(e=>e.device+'@'+e.x.toFixed(2)+','+e.y.toFixed(2));assert.equal(new Set(points).size,points.length,mode+': two cables share an attachment point');
 }
});

test('reusing planned routes after a bend or color edit matches a fresh rebuild',async()=>{
 const {mdfLookalike}=await import('./fixtures/mdf-lookalike.mjs');
 const site=mdfLookalike(),cache=new Map(),first=buildPages(site,{cache}).find(p=>p.name==='Core Network'),cable=first.items.find(i=>i.type==='path'&&i.sourceLink);
 const bent=cable.points.map(p=>[...p]);if(bent.length>3)bent[1]=[bent[1][0],bent[1][1]];
 site.layout={drawingEdits:{[cable.editKey]:{color:'#815AC0',points:bent}}};
 const warm=buildPages(site,{cache}),cold=buildPages(JSON.parse(JSON.stringify(site)));
 assert.deepEqual(warm.map(p=>p.svg),cold.map(p=>p.svg));
});

test('cable type and speed text on lines is optional and off by default',()=>{
 const site=campus(),plain=core(site),labelled=core({...site,layout:{cableCaptions:true}});
 assert.equal(plain.items.filter(i=>i.labelRole==='media').length,0,'off by default; the connection key names each cable type');
 assert.ok(plain.items.some(i=>i.labelRole==='port'),'port names stay');
 assert.ok(labelled.items.filter(i=>i.labelRole==='media').length>0);
 assert.equal(cleanLayout({cableCaptions:true},[]).cableCaptions,true);assert.equal(cleanLayout({},[]).cableCaptions,false);
 // A caption the user edited stays visible with captions off.
 const media=labelled.items.find(i=>i.labelRole==='media'),edited=core({...site,layout:{drawingEdits:{[media.editKey]:{value:'Patch panel run'}}}});
 assert.ok(edited.items.some(i=>i.labelRole==='media'&&i.value==='Patch panel run'));
});
