import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages as buildAllPages} from '../src/web/diagram/index.mjs';
import {withFaceplateMaps} from './fixtures/faceplate-maps.mjs';
const buildPages=withFaceplateMaps(buildAllPages);
import {moveDrawingItems} from '../src/web/drawing-edits.mjs';
import {analyzeConnections,connectionDevices,organizeConnections} from '../src/web/connection-layout.mjs';

const copy=value=>structuredClone(value);
const immediate=async()=>{};
function fixture(){
 const project={name:'Fictional connection organization lab',devices:['a','b'].map((id,index)=>({id,name:'LAB-SW-'+(index+1),kind:'switch',vendor:'Aruba',model:'JL724A',ports:[{name:'1/1/25',role:'uplink',speed:'10 Gbps'}]})),links:[{a:'a',ap:'1/1/25',b:'b',bp:'1/1/25',media:'DAC',speed:'10 Gbps'}],stencils:{},optics:{},warnings:[],layout:{}};
 const initial=buildPages(project)[0],device=connectionDevices(initial).find(device=>device.sourceId==='b');
 project.layout.drawingEdits=moveDrawingItems(initial,{},new Map([[device.editKey,[1400,800]]]));
 const pages=buildPages(project);return {project,pages,page:pages[0]};
}
const organize=(input,options={})=>organizeConnections(input.project,input.page,{buildPages,currentPages:input.pages,yieldWork:immediate,...options});
const bodyIdentity=page=>connectionDevices(page).map(device=>({id:device.sourceId,instance:device.instanceKey,w:device.w,h:device.h,ports:device.ports}));
const bodyPositions=page=>connectionDevices(page).map(device=>({id:device.sourceId,instance:device.instanceKey,x:device.x,y:device.y}));
function assertAttached(page){
 const hosts=new Map(page.items.filter(item=>item.type==='device').map(device=>[device.key,device]));
 for(const path of page.items.filter(item=>item.type==='path'&&item.from&&item.to)){
  for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]]){
   const host=hosts.get(anchor.device),port=host?.ports?.[anchor.port];assert.ok(port,'The actual host must retain the named port.');
   assert.ok(Math.hypot(point[0]-anchor.x,point[1]-anchor.y)<.01,'The painted endpoint must meet its attachment.');
   assert.ok(Math.hypot(anchor.x-host.x-port[0]*host.w,anchor.y-host.y-port[1]*host.h)<.01,'The attachment must meet the actual rendered port.');
  }
 }
}

test('organization previews reduce a displaced drawing without mutating the project, equipment or other pages',async()=>{
 const input=fixture(),beforeProject=copy(input.project),beforePages=copy(input.pages),progress=[];
 const result=await organize(input,{onProgress:value=>progress.push(value)});
 assert.equal(result.changed,true);assert.equal(result.metrics.valid,true);
 assert.ok(result.metrics.length<result.before.length);assert.ok(result.metrics.area<result.before.area);assert.ok(result.metrics.squareArea<result.before.squareArea);
 assert.equal(result.metrics.parallelOverlaps,0);assert.equal(result.metrics.obstructions,0);assert.equal(result.metrics.orthogonalErrors,0);assert.equal(result.metrics.attachmentErrors,0);
 assert.deepEqual(copy(input.project),beforeProject);assert.deepEqual(copy(input.pages),beforePages);assert.deepEqual(bodyIdentity(result.page),bodyIdentity(input.page));assertAttached(result.page);
 assert.deepEqual(result.pages.map(page=>page.name),input.pages.map(page=>page.name));
 for(const page of input.pages.filter(page=>page!==input.page))assert.deepEqual(result.pages.find(next=>next.name===page.name),page);
 assert.ok(result.tested<=10);assert.equal(progress.at(-1).completed,result.tested);assert.equal(progress.at(-1).total,result.tested);
 // Applying the returned edit set through the ordinary planner must reproduce
 // the preview, without retaining a private candidate-planning flag.
 const applied=buildPages({...input.project,layout:{...input.project.layout,drawingEdits:result.edits}});
 assert.equal(applied.find(page=>page.name===result.page.name).svg,result.page.svg);
});

test('analysis cancellation before and between candidates leaves accepted state unchanged',async()=>{
 const input=fixture(),project=copy(input.project),pages=copy(input.pages);
 for(const stopAfter of [0,1]){
  const controller=new AbortController();let calls=0,yields=0;
  await assert.rejects(organize(input,{signal:controller.signal,buildPages:source=>{calls++;return buildPages(source);},yieldWork:async()=>{if(yields++===stopAfter)controller.abort();}}),{name:'AbortError'});
  assert.equal(calls,stopAfter);assert.deepEqual(copy(input.project),project);assert.deepEqual(copy(input.pages),pages);
 }
 const aborted=new AbortController();aborted.abort();let called=false;
 await assert.rejects(organize(input,{signal:aborted.signal,buildPages:()=>{called=true;throw Error('A cancelled analysis must not invoke the planner.');}}),{name:'AbortError'});
 assert.equal(called,false);
});

test('manual bend retention and rerouting preserve cable style and unrelated saved edits',async()=>{
 const input=fixture(),cable=input.page.items.find(item=>item.type==='path'),points=copy(cable.points),other=input.pages.find(page=>page!==input.page),caption=other.items.find(item=>item.type==='text'&&item.editKey);
 points[1][1]-=80;points[2][1]-=80;
 const style={color:'#2266AA',weight:5,opacity:.7};
 input.project.layout.drawingEdits[cable.editKey]={...style,points};input.project.layout.drawingEdits[caption.editKey]={color:'#7A3456'};
 input.pages=buildPages(input.project);input.page=input.pages[0];const original=copy(input.project);
 const retained=await organize(input,{keepManualBends:true});assert.equal(retained.changed,true);assert.equal(retained.manualBends,1);assert.equal(retained.keepManualBends,true);assert.equal(retained.metrics.valid,true);
 assert.deepEqual(retained.edits[cable.editKey],{...style,points});assertAttached(retained.page);
 const rerouted=await organize(input,{keepManualBends:false});assert.equal(rerouted.changed,true);assert.equal(rerouted.manualBends,1);assert.equal(rerouted.keepManualBends,false);assert.equal(rerouted.metrics.valid,true);
 assert.deepEqual(rerouted.edits[cable.editKey],style);assertAttached(rerouted.page);
 for(const result of [retained,rerouted]){
  const rendered=result.page.items.find(item=>item.editKey===cable.editKey);for(const [name,value] of Object.entries(style))assert.equal(rendered[name],value);
  assert.deepEqual(result.edits[caption.editKey],{color:'#7A3456'});assert.deepEqual(result.pages.find(page=>page.name===other.name),input.pages.find(page=>page.name===other.name));
 }
 assert.deepEqual(copy(input.project),original);
});

test('routing without compaction preserves device positions while shortening a manual detour',async()=>{
 const input=fixture(),cable=input.page.items.find(item=>item.type==='path'),points=copy(cable.points);points[1][1]-=80;points[2][1]-=80;
 input.project.layout.drawingEdits[cable.editKey]={points,color:'#2266AA'};input.pages=buildPages(input.project);input.page=input.pages[0];
 const result=await organize(input,{compact:false,keepManualBends:false});
 assert.equal(result.changed,true);assert.equal(result.tested,2);assert.ok(result.metrics.length<result.before.length);assert.equal(result.metrics.valid,true);
 assert.deepEqual(bodyPositions(result.page),bodyPositions(input.page));assert.deepEqual(bodyIdentity(result.page),bodyIdentity(input.page));assertAttached(result.page);
});

test('organization is deterministic, bounded and stable when run again on its accepted result',async()=>{
 const input=fixture(),first=await organize(input),repeat=await organize(input);
 assert.deepEqual(repeat.edits,first.edits);assert.deepEqual(repeat.metrics,first.metrics);assert.equal(repeat.page.svg,first.page.svg);
 const applied={project:{...input.project,layout:{...input.project.layout,drawingEdits:first.edits}},pages:first.pages,page:first.page},again=await organize(applied);
 assert.equal(again.changed,false);assert.deepEqual(again.edits,first.edits);assert.deepEqual(again.metrics,first.metrics);
 let calls=0;const bounded=await organize(input,{maxCandidates:3,buildPages:source=>{calls++;return buildPages(source);}});assert.equal(bounded.tested,3);assert.equal(calls,3);
});

test('attachment validation rejects an endpoint that agrees with its path but misses the actual port',()=>{
 const input=fixture(),page=copy(input.page),path=page.items.find(item=>item.type==='path');
 path.from.x+=11;path.points[0][0]+=11;path.points[1][0]+=11;
 const result=analyzeConnections(page);assert.equal(result.valid,false);assert.ok(result.attachmentErrors>0);
 assert.equal(result.orthogonalErrors,0,'This fixture isolates physical attachment from orthogonal path validity.');
});

test('the accepted preview is rebuilt normally when candidate-only planning hints change its positions',async()=>{
 const input=fixture(),calls=[];
 const planner=source=>{
  const temporary=Boolean(source._organizeCandidate);calls.push(temporary);
  if(!temporary)return buildPages(source);
  const shifted=copy(source);
  for(const device of connectionDevices(input.page))shifted.layout.drawingEdits[device.editKey].x+=40;
  return buildPages(shifted);
 };
 const result=await organize(input,{buildPages:planner,maxCandidates:4});
 assert.equal(result.changed,true);assert.equal(result.metrics.valid,true);assert.equal(calls.at(-1),false);assert.equal(calls.filter(flag=>!flag).length,1);assert.ok(calls.length<=4);assert.equal(result.tested,calls.length);
 const ordinary=buildPages({...input.project,layout:{...input.project.layout,drawingEdits:result.edits}}).find(page=>page.name===input.page.name);
 assert.equal(result.page.svg,ordinary.svg);assert.deepEqual(result.metrics,analyzeConnections(ordinary));assertAttached(result.page);
});

test('a failed ordinary-planner replay discards the candidate without partial saved edits',async()=>{
 const input=fixture(),before=copy(input.project),calls=[];
 const result=await organize(input,{maxCandidates:3,buildPages:source=>{
  calls.push(Boolean(source._organizeCandidate));const pages=buildPages(source);
  if(!source._organizeCandidate)connectionDevices(pages[0])[0].w+=1;
  return pages;
 }});
 assert.equal(calls.at(-1),false);assert.ok(calls.length<=3);assert.equal(result.tested,calls.length);assert.equal(result.changed,false);
 assert.equal(result.page,input.page);assert.equal(result.pages,input.pages);assert.deepEqual(result.edits,input.project.layout.drawingEdits);assert.deepEqual(copy(input.project),before);
 assert.equal(result.rejections.at(-1).name,'Verify saved layout');
});

test('a one-build budget uses the normal planner so it never returns an unverified preview',async()=>{
 const input=fixture(),cable=input.page.items.find(item=>item.type==='path'),points=copy(cable.points);points[1][1]-=80;points[2][1]-=80;
 input.project.layout.drawingEdits[cable.editKey]={points};input.pages=buildPages(input.project);input.page=input.pages[0];let calls=0;
 const result=await organize(input,{compact:false,keepManualBends:false,maxCandidates:1,buildPages:source=>{calls++;assert.equal(source._organizeCandidate,undefined);return buildPages(source);}});
 assert.equal(calls,1);assert.equal(result.tested,1);assert.equal(result.changed,true);assert.equal(result.metrics.valid,true);
 assert.equal(buildPages({...input.project,layout:{...input.project.layout,drawingEdits:result.edits}})[0].svg,result.page.svg);
});

test('candidate rejection protects device dimensions, normalized anchors and other pages',async t=>{
 for(const [name,alter] of [
  ['device dimensions',pages=>{connectionDevices(pages[0])[0].w+=1;}],
  ['normalized port anchors',pages=>{const body=connectionDevices(pages[0])[0],port=Object.keys(body.ports)[0];body.ports[port][0]+=.001;}],
  ['unrelated page content',pages=>{pages[1].items.find(item=>item.type==='text').value='Unexpected change to another page';}],
  ['unrelated page color',pages=>{pages[1].items.find(item=>item.type==='text').color='#AA1122';}],
  ['unrelated child geometry',pages=>{pages[1].items.find(item=>item.type==='device').children[0].x+=.001;}],
  ['unrelated page removal',pages=>{pages.splice(1,1);}],
 ])await t.test(name,async()=>{
  const input=fixture(),source=copy(input.project),original=copy(input.pages);
  const result=await organize(input,{maxCandidates:2,buildPages:project=>{const pages=buildPages(project);alter(pages);return pages;}});
  assert.equal(result.changed,false);assert.equal(result.rejected,result.tested);assert.ok(result.rejections.every(item=>item.reason.includes('another page or a port attachment')));
  assert.deepEqual(result.page,input.page);assert.deepEqual(result.edits,input.project.layout.drawingEdits);assert.deepEqual(copy(input.project),source);assert.deepEqual(copy(input.pages),original);
 });
});

test('even line spacing puts every parallel cable of a channel on one lattice and is saved with the layout',async()=>{
 const {mdfLookalike}=await import('./fixtures/mdf-lookalike.mjs'),{cleanLayout}=await import('../src/web/layout.mjs');
 const project=mdfLookalike();project.layout={coreArrangement:'vertical'};const pages=buildPages(project),page=pages.find(p=>p.name==='Core Network'),beforeProject=copy(project);
 const result=await organizeConnections(project,page,{buildPages,currentPages:pages,yieldWork:immediate,compact:false,spacing:24});
 assert.deepEqual(project,beforeProject,'analysis does not mutate the project');
 assert.equal(result.changed,true);assert.equal(result.spacing,24);assert.deepEqual(result.lineSpacing,{'Core Network':24});assert.ok(result.metrics.valid);assertAttached(result.page);
 // Long rails left of the stack column sit on the shared 24-unit lattice (a
 // short rail may hold a lattice position between them).
 const left=Math.min(...connectionDevices(result.page).filter(d=>d.kind!=='handoff').map(d=>d.x)),rails=[...new Set(result.page.items.filter(i=>i.type==='path'&&i.sourceLink).flatMap(p=>p.points.slice(1).map((b,i)=>[p.points[i],b]).filter(([a,b])=>a[0]===b[0]&&Math.abs(a[1]-b[1])>200&&a[0]<left).map(([a])=>Math.round(a[0]*100)/100)))].sort((a,b)=>a-b);
 assert.ok(rails.length>=4);for(let i=1;i<rails.length;i++){const steps=(rails[i]-rails[i-1])/24;assert.ok(steps>=1-1e-6&&Math.abs(steps-Math.round(steps))<1e-6,'rails '+rails.join(', '));}
 // The saved setting reproduces the reviewed page after reopen.
 const saved={...project,layout:cleanLayout({...project.layout,lineSpacing:result.lineSpacing,drawingEdits:result.edits},project.devices.map(d=>d.id))};
 assert.equal(buildPages(JSON.parse(JSON.stringify(saved))).find(p=>p.name==='Core Network').svg,result.page.svg);
 // Turning it off again is also a change to review.
 const off=await organizeConnections(saved,buildPages(saved).find(p=>p.name==='Core Network'),{buildPages,currentPages:buildPages(saved),yieldWork:immediate,compact:false,spacing:0});assert.deepEqual(off.lineSpacing,{});
});
