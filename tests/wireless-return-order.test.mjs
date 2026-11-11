import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {pathCrossesText} from '../src/web/diagram/labels.mjs';

// Fictional eight-member stack, with 32 APs on member seven. The original
// planner left 34 crossings: 23 on the left, 11 in the right return bundle.
export function wirelessReturnLab(){
 const ports=Array.from({length:32},(_,i)=>({name:'7/'+(i+1)}));
 const sw={id:'sw',name:'LAB-STACK',kind:'switch',model:'JL558A',stackMembers:Array.from({length:8},(_,i)=>({id:String(i+1),model:'JL558A'})),ports};
 const aps=ports.map((_,i)=>({id:'ap'+i,name:'LAB-AP-'+(i+1),kind:'ap',model:'AP-515',ip:'192.0.2.'+(i+1),ports:[{name:'eth0'}]}));
 return {name:'Right-side order lab',devices:[sw,...aps],links:ports.map((p,i)=>({a:'sw',ap:p.name,b:'ap'+i,bp:'eth0',media:'copper',speed:'1 Gbps'})),layout:{pageSetup:{overrides:{wireless:{preset:'dynamic'}}}}};
}
function countCrossings(page){
 const lines=page.items.filter(i=>i.type==='path').flatMap((path,owner)=>path.points.slice(1).map((b,i)=>({owner,a:path.points[i],b}))),crossings=[];
 for(const h of lines.filter(s=>s.a[1]===s.b[1]))for(const v of lines.filter(s=>s.a[0]===s.b[0])){
  if(h.owner===v.owner)continue;const x=v.a[0],y=h.a[1];
  if(x>Math.min(h.a[0],h.b[0])+.5&&x<Math.max(h.a[0],h.b[0])-.5&&y>Math.min(v.a[1],v.b[1])+.5&&y<Math.max(v.a[1],v.b[1])-.5)crossings.push(x);
 }
 return {left:crossings.filter(x=>x<page.width/2).length,right:crossings.filter(x=>x>page.width/2).length};
}
test('right AP return lanes untangle without disturbing paired switch departure rows',()=>{
 const site=wirelessReturnLab(),saved=JSON.stringify(site),pages=buildPages(site).filter(p=>p.wirelessLayout);assert.equal(pages.length,1);const page=pages[0],paths=page.items.filter(i=>i.type==='path');
 assert.equal(paths.length,32);assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);
 // The whole-switch plan keeps the sheet tidy: fewer crossings than the
 // original planner's 34 and never more than one per AP.
 const crossings=countCrossings(page);assert.ok(crossings.left+crossings.right<=Math.min(32,page.wirelessLayout.links.length),'no more crossings than APs');
 // Leads leaving one stack gap toward opposite sides share rows: some row
 // carries both a left-going and a right-going departure.
 const sw=page.items.find(i=>i.kind==='switch'),middle=sw.x+sw.w/2,rows=new Map();
 for(const path of paths){const run=path.points.slice(1).map((b,i)=>[path.points[i],b]).find(([a,b])=>a[1]===b[1]&&Math.abs(b[0]-a[0])>40);if(!run||run[0][1]<sw.y||run[0][1]>sw.y+sw.h)continue;const key=run[0][1].toFixed(3);if(!rows.has(key))rows.set(key,new Set());rows.get(key).add(Math.sign(run[1][0]-run[0][0]));}
 assert.ok([...rows.values()].some(set=>set.size===2),'a gap row carries leads in both directions');
 for(const path of paths){
  for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]]){assert.equal(point[0],anchor.x);assert.equal(point[1],anchor.y);}
  for(let i=1;i<path.points.length;i++)assert.ok(path.points[i][0]===path.points[i-1][0]||path.points[i][1]===path.points[i-1][1]);
  for(const text of page.items.filter(i=>i.wirelessCaption||i.portNumberRole==='text'))assert.ok(!pathCrossesText(path,text,1));
 }
 assert.equal(JSON.stringify(site),saved);assert.equal(buildPages(JSON.parse(saved)).find(p=>p.wirelessLayout).svg,page.svg);
});

test('upper middle-member AP fan nests in its gap instead of crossing the return bundle',()=>{
 const site=wirelessReturnLab();
 site.devices[0].stackMembers=site.devices[0].stackMembers.slice(0,5);
 site.devices[0].ports=site.devices[0].ports.slice(0,28).map((p,i)=>({...p,name:'3/'+(i+1)}));
 site.devices=site.devices.slice(0,29);
 site.links=site.links.slice(0,28).map((link,i)=>({...link,ap:'3/'+(i+1)}));
 const saved=JSON.stringify(site),page=buildPages(site).find(p=>p.wirelessLayout),paths=page.items.filter(i=>i.type==='path');
 assert.equal(paths.length,28);assert.equal(page.items.filter(i=>i.kind==='ap').length,28);
 assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);
 // The released planner scored 42 crossings and 34625.0464 units of wire;
 // the whole-switch plan stays tidy (no more crossings than APs) on less wire.
 assert.ok(page.wirelessLayout.routingCost[3]<=28);
 assert.ok(page.wirelessLayout.routingCost[5]<=34625.047);
 const regions={upper:0,lower:0},segments=paths.flatMap((path,owner)=>path.points.slice(1).map((b,i)=>({owner,a:path.points[i],b})));
 for(const h of segments.filter(s=>s.a[1]===s.b[1]))for(const v of segments.filter(s=>s.a[0]===s.b[0])){
  if(h.owner===v.owner)continue;
  const x=v.a[0],y=h.a[1];
  if(x>Math.min(h.a[0],h.b[0])+.5&&x<Math.max(h.a[0],h.b[0])-.5&&y>Math.min(v.a[1],v.b[1])+.5&&y<Math.max(v.a[1],v.b[1])-.5)regions[y<page.height/2?'upper':'lower']++;
 }
 assert.ok(regions.upper<=10,'upper fan improves from 32 crossings');
 assert.ok(regions.upper+regions.lower<=28,'no more crossings than APs');
 for(const path of paths){
  for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]])assert.deepEqual(point,[anchor.x,anchor.y]);
  for(let i=1;i<path.points.length;i++)assert.ok(path.points[i][0]===path.points[i-1][0]||path.points[i][1]===path.points[i-1][1]);
  for(const text of page.items.filter(i=>i.wirelessCaption||i.portNumberRole==='text'))assert.ok(!pathCrossesText(path,text,1));
 }
 assert.equal(JSON.stringify(site),saved);
 assert.equal(buildPages(JSON.parse(saved)).find(p=>p.wirelessLayout).svg,page.svg);
});
