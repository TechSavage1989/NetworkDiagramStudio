import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio,printDocument} from '../src/web/diagram/index.mjs';
import {bridge,mediaInfo} from '../src/web/diagram/scene.mjs';
import {unzip} from '../src/web/zip.mjs';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5F8AAAAASUVORK5CYII=';
const st={id:'panel',name:'Lab equipment',view:'front',dataUrl:image,width:1000,height:100,anchors:{'p1':[.2,.3],'p2':[.2,.7]}};
function fixture(){
  return {name:'Test <Network> & Co.',stencils:[st,{...st,id:'optic',name:'Local optic',width:72,height:45,anchors:{cable:[.5,.5]}}],
    optics:{sr:'optic',fg_sr:'optic'},
    devices:[
      {id:'sw',name:'Edge <A>',kind:'switch',stencilId:'panel',ports:[{name:'p1',role:'access',state:'up'},{name:'p2',state:'up',lag:'1'},{name:'lag 1',role:'trunk',native:17,tagged:[11,12,13,27]}],vlans:[{id:17,name:'Lab'}],bridges:[{name:'pair',type:'virtual-wire-pair',members:['p1','p2']}]},
      {id:'fw',name:'Gateway',kind:'firewall',vendor:'Fortinet',ports:[{name:'wan1'}],routes:[{destination:'0.0.0.0/0',nextHop:'192.0.2.1'}]},
      {id:'ap',name:'Lab AP',kind:'ap',ip:'192.0.2.13',ports:[{name:'eth0'}]}],
    links:[{a:'sw',ap:'p2',b:'fw',bp:'wan1',media:'SR',speed:'10 Gbps'},{a:'sw',ap:'p1',b:'ap',bp:'eth0',media:'copper',speed:'100 Mbps'}]};
}
const text=new TextDecoder();
test('empty inventories have all five pages, and encoded labels are inert',()=>{
  const ps=buildPages({name:'<script>alert(1)</script>',devices:[],links:[]});
  assert.deepEqual(ps.map(p=>p.name),['Core Network','MDF Port Map','Wireless Connections','VLANs and Routing','Trunk VLANs']);
  for(const p of ps){assert.match(p.svg,/&lt;script&gt;/);assert.doesNotMatch(p.svg,/<script>/);}
  assert.doesNotMatch(printDocument(ps),/<script[^>]*>/i);
});
test('media coloring, source field retention, optics and front access point placement',()=>{
  const ps=buildPages(fixture());
  const core=ps.find(p=>p.name==='Core Network'),wire=ps.find(p=>p.name==='Wireless Connections');
  assert.equal(core.items.filter(i=>i.kind==='plug'&&i.asset?.id==='optic').length,2);
  assert.equal(ps.slice(1).flatMap(p=>p.items).filter(i=>i.kind==='plug').length,0);
  assert.equal(core.items.find(x=>x.type==='path').color,'#FF0000');
  const apPath=wire.items.find(x=>x.type==='path'),ap=wire.items.find(x=>x.kind==='ap');
  assert.equal(apPath.color,'#00B050');assert.equal(apPath.to.y,ap.y+ap.h);
  for(const [m,c] of [['DAC','#000000'],['SR','#FF0000'],['LR','#00B0F0'],['Copper','#FFD965'],['unknown','#707A83']])assert.equal(mediaInfo(m).color,c);
  assert.ok(ps.find(p=>p.name==='Trunk VLANs').svg.includes('11-13, 27'));
  assert.ok(ps.find(p=>p.name==='VLANs and Routing').svg.includes('virtual-wire-pair'));
  assert.equal(printDocument(ps).match(/<section /g).length,ps.length);
});
test('native ZIP, true groups, explicit foreign image parts, port glue on switch and AP',async()=>{
  const project=fixture(),pages=buildPages(project),blob=exportVisio(project,pages),parts=await unzip(await blob.arrayBuffer());
  for(const key of ['[Content_Types].xml','_rels/.rels','visio/document.xml','visio/masters/masters.xml','visio/pages/pages.xml'])assert.ok(parts.has(key),key);
  const p=text.decode(parts.get('visio/pages/page1.xml'));
  assert.match(p,/Type="Group"/);assert.match(p,/Type="Foreign" MasterShape="6"/);
  assert.match(p,/<ForeignData ForeignType="Bitmap" CompressionType="PNG"/);
  assert.match(p,/FromCell="BeginX".*ToCell="Connections.X\d+"/);assert.match(p,/FromCell="EndX"/);
  assert.match(text.decode(parts.get('visio/pages/_rels/page1.xml.rels')),/relationships\/image/);
  const nativeMasters=text.decode(parts.get('visio/masters/masters.xml'));assert.match(nativeMasters,/Lab equipment/);assert.match(nativeMasters,/Local optic/);
  // identical bitmap content is stored only once even across different master/anchor definitions
  assert.equal([...parts.keys()].filter(n=>n.startsWith('visio/media/')).length,1);
});
test('pagination and unresolved peer handling keep user interface names',()=>{
  const d={id:'s',name:'Edge',kind:'switch',ports:Array.from({length:96},(_,i)=>({name:'1/1/'+(i+1),state:'up',description:'Test assignment '+i}))};
  const p={name:'Scale',devices:[d],links:Array.from({length:24},(_,i)=>({a:'s',ap:'1/1/'+(i+1),b:'Other '+i,bp:'U',media:'unknown'}))};
  const pages=buildPages(p),core=pages.filter(p=>p.name.startsWith('Core Network'));
  // A cross-page connection has a continuation at both ends.
  assert.equal(new Set(core.flatMap(p=>p.items).filter(i=>i.type==='path').map(i=>i.name.match(/^L\d+/)?.[0])).size,24);
  assert.equal(core.flatMap(p=>p.items).filter(i=>i.kind==='plug').length,0);
  assert.ok(pages.filter(p=>p.name.startsWith('MDF Port Map')).length>=7);
  assert.equal(new Set(pages.map(p=>p.name)).size,pages.length);
  assert.deepEqual(pages.map(p=>p.svg),buildPages(p).map(p=>p.svg));
});
test('orthogonal crossings are encoded as arcs',()=>{
  const line=(pts)=>({type:'path',points:pts});
  const p={items:[line([[0,10],[50,10]]),line([[25,0],[25,30]])]};
  bridge(p);assert.match(JSON.stringify(p.items[1].commands),/"A"/);
});
test('six independent optical links on a multirow front do not share a vertical exit lead',()=>{
  const names=Array.from({length:6},(_,i)=>'port'+(i+1));
  const coordinates=[[.2,.2],[.2,.4],[.4,.31],[.55,.31],[.7,.31],[.85,.31]];
  const stencil={...st,anchors:Object.fromEntries(names.map((n,i)=>[n,coordinates[i]]))};
  const devices=['west','east'].map(id=>({id,name:id,kind:'switch',stencil,ports:names.map(name=>({name}))}));
  const links=names.map((ap,i)=>({a:'west',ap,b:'east',bp:names[5-i],media:i%2?'DAC':'SR'}));
  const pages=buildPages({devices,links}).filter(p=>p.title==='Core Network');
  assert.equal(pages.flatMap(p=>p.items).filter(i=>i.type==='path').length,6);
  for(const page of pages){
    const segments=[];
    for(const path of page.items.filter(s=>s.type==='path')){
      for(const [a,b] of [[path.points[0],path.points[1]],path.points.slice(-2)]){
        assert.equal(a[0],b[0]);
        const lo=Math.min(a[1],b[1]),hi=Math.max(a[1],b[1]);
        for(const s of segments){
          const overlap=Math.min(s.hi,hi)-Math.max(s.lo,lo);
          assert.ok(Math.abs(a[0]-s.x)>=2.2||overlap<=0,'independent jacks shared a painted exit lead');
        }
        segments.push({x:a[0],lo,hi});
      }
    }
  }
});
test('MDF assignments distinguish AP evidence, matching trunk profiles, infrastructure and state',()=>{
  const trunk=(name,extra={})=>({name,role:'trunk',native:12,tagged:[14,90],...extra});
  const ports=[trunk('p1',{state:'up'}),trunk('p2',{state:'up',tagged:[90,14]}),
    trunk('p3',{state:'down'}),trunk('p4',{lag:'2'}),trunk('p5',{handoff:'Carrier'}),
    trunk('p6'),trunk('p7'),trunk('p8',{tagged:[14]}),trunk('p9'),
    trunk('p10',{description:'Backbone to branch'}),trunk('p11')];
  const backbone={id:'sw',name:'Lab switch',kind:'switch',ports};
  const peer=(id,kind)=>({id,name:id,kind,ports:[]});
  const link=(n,id)=>({a:'sw',ap:n,b:id,bp:'eth0',status:'observed'});
  const site={devices:[backbone,peer('ap-a','ap'),peer('ap-b','ap'),peer('fw','firewall'),peer('desk','unknown')],
    links:[link('p1','ap-a'),{a:'ap-b',ap:'eth0',b:'sw',bp:'p2',status:'confirmed'},
      link('p6','desk'),link('p7','fw'),{...link('p9','ap-a'),status:'conflict'}],excludedPeerPorts:[['sw','p11']]};
  const pages=buildPages(site).filter(p=>p.title==='MDF Port Map');
  const rows=[];
  for(const page of pages){
    const cells=page.items.filter(i=>i.type==='text'&&i.y>=389&&i.y<870);
    for(const portCell of cells.filter(c=>c.x===44&&c.value))rows.push(cells.filter(c=>c.y===portCell.y).map(c=>c.value));
  }
  const row=n=>rows.find(r=>r[0]===n);
  assert.deepEqual(row('p1-2').slice(1,6),['AP peer','up','','trunk','12']);
  assert.equal(row('p3')[1],'Matches AP profile');assert.equal(row('p3')[2],'down');
  assert.equal(row('p4')[1],'LAG 2 member');assert.equal(row('p5')[1],'Handoff');
  assert.equal(row('p6')[1],'Other wired peer');assert.equal(row('p7')[1],'Firewall uplink');
  assert.equal(row('p8')[1],'No peer reported');assert.equal(row('p9')[1],'Peer needs review');
  assert.equal(row('p10')[1],'Labeled uplink');assert.equal(row('p11')[1],'Peer outside scope');
  const onlyOne={...site,links:site.links.filter(l=>l.a!=='ap-b')};
  const labels=buildPages(onlyOne).filter(p=>p.title==='MDF Port Map').flatMap(p=>p.items.filter(i=>i.type==='text'&&i.y>=389));
  assert.ok(!labels.some(c=>c.value==='Matches AP profile'));
});
