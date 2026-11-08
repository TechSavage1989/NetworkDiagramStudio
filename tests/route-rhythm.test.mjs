import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {addDevice,getAnchor} from '../src/web/diagram/scene.mjs';
import {ROUTE_STYLE} from '../src/web/diagram/routing.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {modularChassis,modularRoutingFixture} from './fixtures/modular-routing.mjs';

// Fictional campus: two firewalls, a chassis with empty slots and the empty
// second management bay, two stacks and a single access switch.
function campus(){
 const port=(name,o={})=>({name,state:'up',native:10,tagged:[20],...o});
 const firewall=(id,name)=>({id,name,kind:'firewall',vendor:'Fortinet',model:'FortiGate 120G',ports:[{name:'port1',role:'wan',state:'up',gateway:'198.51.100.1'},{name:'x1',state:'up'},{name:'x2',state:'up'}]});
 const stack=(id,name,count)=>({id,name,kind:'switch',vendor:'Aruba',model:'JL558A',stackMembers:Array.from({length:count},(_,i)=>({id:String(i+1),model:'JL558A'})),ports:Array.from({length:count},(_,i)=>[port((i+1)+'/49'),port((i+1)+'/50')]).flat()});
 const core={id:'core',name:'LAB-CORE',kind:'switch',vendor:'Aruba',model:'J9850A',modules:[{slot:'A',model:'J9993A'},{slot:'B',model:'J9993A'},{slot:'C',model:'J9987A'},{slot:'D',model:'J9993A'}],
  ports:[...['A','B','D'].flatMap(slot=>Array.from({length:8},(_,i)=>port(slot+(i+1)))),...Array.from({length:24},(_,i)=>port('C'+(i+1)))]};
 const access={id:'access',name:'LAB-ACCESS',kind:'switch',vendor:'Aruba',model:'JL724A',ports:Array.from({length:28},(_,i)=>port('1/1/'+(i+1)))};
 const link=(a,ap,b,bp,media='SR')=>({a,ap,b,bp,media,speed:'10 Gbps',status:'confirmed'});
 return {name:'Route rhythm lab',devices:[firewall('fw-a','LAB-FW-A'),firewall('fw-b','LAB-FW-B'),core,stack('idf1','LAB-IDF1',3),access,stack('idf3','LAB-IDF3',2)],links:[
  link('fw-a','x1','core','A1'),link('fw-b','x1','core','A2'),link('fw-a','x2','core','B1'),link('fw-b','x2','core','B2'),
  link('core','A3','idf1','1/49'),link('core','A4','idf1','3/49'),link('core','A5','access','1/1/25'),link('core','D1','access','1/1/26'),
  link('core','C1','idf3','1/49','copper'),link('core','C2','idf3','2/49','copper'),link('idf1','1/50','access','1/1/27','DAC')]};
}
const core=site=>buildPages(site).find(page=>page.name==='Core Network');
const arranged=(site,coreArrangement)=>({...site,layout:{...site.layout,coreArrangement}});
// Every check covers the default compact packing and the vertical stack.
const sites=()=>[sampleSite(),modularRoutingFixture(),campus()].flatMap(site=>[site,arranged(site,'vertical')]);
const overlap=(a,b,c,d)=>Math.min(Math.max(a,b),Math.max(c,d))-Math.max(Math.min(a,b),Math.min(c,d));
// Runs outside the equipment: not a socket lead and not inside any body.
function exteriorRuns(page){
 const bodies=page.items.filter(item=>item.type==='device'&&item.kind!=='plug'),runs=[];
 for(const path of page.items.filter(item=>item.type==='path'&&item.sourceLink))for(let i=2;i<path.points.length-1;i++){
  const a=path.points[i-1],b=path.points[i],h=a[1]===b[1],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  if(bodies.some(n=>mid[0]>=n.x&&mid[0]<=n.x+n.w&&mid[1]>=n.y&&mid[1]<=n.y+n.h))continue;
  runs.push({path,a,b,h,c:h?a[1]:a[0],lo:Math.min(h?a[0]:a[1],h?b[0]:b[1]),hi:Math.max(h?a[0]:a[1],h?b[0]:b[1]),weight:path.weight||4});
 }
 return {bodies,runs};
}

test('cables keep the standard clearance from every side of every device',()=>{
 for(const site of sites()){
  const page=core(site),{bodies,runs}=exteriorRuns(page);assert.ok(runs.length);
  for(const run of runs.filter(run=>!run.h))for(const body of bodies){
   if(overlap(run.lo,run.hi,body.y,body.y+body.h)<=1)continue;
   const gap=run.c<body.x?body.x-run.c:run.c>body.x+body.w?run.c-body.x-body.w:-1;
   if(gap>=0)assert.ok(gap>=ROUTE_STYLE.clearance-run.weight/2-1e-6,site.name+': a rail runs '+gap.toFixed(1)+' units beside '+body.name);
  }
 }
});

test('parallel cables keep a visible gap and exterior rails share one even pitch',()=>{
 for(const site of sites()){
  const {runs}=exteriorRuns(core(site));
  for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){
   const s=runs[i],t=runs[j];if(s.path===t.path||s.h!==t.h||overlap(s.lo,s.hi,t.lo,t.hi)<=.5)continue;
   assert.ok(Math.abs(s.c-t.c)>=(s.weight+t.weight)/2+ROUTE_STYLE.gap-1e-6,site.name+': parallel cables are '+Math.abs(s.c-t.c).toFixed(1)+' apart');
  }
 }
 // The fictional chassis bus uses evenly pitched rails, not caption-sized gaps.
 const {bodies,runs}=exteriorRuns(core(arranged(modularRoutingFixture(),'vertical'))),left=Math.min(...bodies.map(b=>b.x)),rails=[...new Set(runs.filter(r=>!r.h&&r.hi-r.lo>200&&r.c<left).map(r=>Math.round(r.c*100)/100))].sort((a,b)=>a-b);
 assert.ok(rails.length>=4);
 for(let i=1;i<rails.length;i++){const step=rails[i]-rails[i-1],tracks=Math.round(step/ROUTE_STYLE.pitch);assert.ok(tracks>=1&&tracks<=2&&Math.abs(step-tracks*ROUTE_STYLE.pitch)<1e-6,'Left rails share the standard pitch instead of caption-sized gaps');}
});

test('captions that cannot sit beside a dense bundle use inline connector text without spreading the rails',()=>{
 const page=core(campus()),paths=page.items.filter(i=>i.type==='path'&&i.sourceLink),inline=page.items.filter(i=>i.type==='text'&&i.background);
 for(const label of inline){const own=paths.find(p=>p.linkId===label.linkId);assert.ok(own);assert.equal(label.background,'#FFFFFF');assert.equal(label.labelRole,'media');}
 assert.ok(page.svg.includes('fill="#FFFFFF" pointer-events="none"')||!inline.length);
});

test('empty chassis bays open the way toward the peer but never turn a lead away',()=>{
 const d=modularChassis();d.modules=d.modules.filter(m=>['A','B','C','D'].includes(m.slot));d.ports=d.ports.filter(p=>/^[A-D]/.test(p.name));
 const g=addDevice({items:[]},{},d,[0,0,700,1],'chassis',{fitWidth:true});
 assert.deepEqual(g.panelRegions.filter(r=>r.empty).map(r=>r.id),['management-bay','E','F']);
 const up=getAnchor(g,'B5','top',0);assert.equal(up.side,'top');assert.equal(up.moduleEscape,undefined,'A port under the empty second management bay leaves straight up');
 const down=getAnchor(g,'C3','bottom',1);assert.equal(down.side,'bottom');assert.equal(down.moduleEscape,undefined,'A port above an empty slot leaves straight down');
 assert.ok(getAnchor(g,'C3','top',2).moduleEscape,'A peer above still uses the module corridor instead of turning through the empty slot');
 assert.ok(getAnchor(g,'A3','top',3).moduleEscape,'An installed management module is never crossed');
});

test('a socket under an empty bay caption rises into the bay and turns beside the caption instead of crossing module rows',()=>{
 const d=modularChassis(),g=addDevice({items:[]},{},d,[0,0,700,1],'chassis',{fitWidth:true});
 const bay=g.panelRegions.find(r=>r.id==='management-bay');assert.ok(bay.empty);
 const under=getAnchor(g,'B23','top',0,{weight:4,peer:{x:-300,y:-300}}),open=getAnchor(g,'B11','top',1,{weight:4});
 assert.equal(under.side,'top');assert.equal(under.moduleEscape,undefined,'no turn between the module rows');assert.ok(under.departure,'a dogleg inside the empty bay');
 const [[x1,turn],[lane,turn2]]=under.departure;assert.equal(turn,turn2);assert.ok(turn>bay.y*g.h&&turn<(bay.y+bay.h)*g.h,'the turn stays inside the bay');
 const columns=g.children.filter(c=>c.anchorOrigin).map(c=>c.anchorOrigin[0]*g.w);assert.ok(columns.every(c=>Math.abs(c-lane)>=10-1e-6),'the lane keeps clear of every socket column');
 assert.equal(open.departure,undefined);assert.equal(open.moduleEscape,undefined);
 // A socket in the inner row is never routed up through the row above it.
 assert.ok(getAnchor(g,'B24','top',2,{weight:4}).moduleEscape);
});
