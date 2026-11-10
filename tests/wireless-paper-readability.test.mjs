import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {printGeometry} from '../src/web/page-options.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';

function lab(preset='letter',orientation='landscape',fitMode='optimize'){
 const members=8,count=32,ports=Array.from({length:count},(_,i)=>({name:(i%members+1)+'/'+(Math.floor(i/members)*2+1)})),sw={id:'sw',name:'LAB-STACK',kind:'switch',model:'JL558A',stackMembers:Array.from({length:members},(_,i)=>({id:String(i+1),model:'JL558A'})),ports};
 const aps=ports.map((_,i)=>({id:'ap'+i,name:'LAB-AP-'+(i+1),kind:'ap',model:'AP-515',ip:'192.0.2.'+(i+1),ports:[{name:'eth0'}]}));
 return {name:'Readability lab',devices:[sw,...aps],links:ports.map((p,i)=>({a:'sw',ap:p.name,b:'ap'+i,bp:'eth0',media:'copper',speed:'1 Gbps'})),layout:{pageSetup:{visible:{wirelessFit:'readable',default:{preset,orientation},fitMode}}}};
}
const pages=site=>buildPages(site).filter(p=>p.wirelessLayout);
const minimumPoints=page=>{const paper=printGeometry(page),scale=.75*Math.min(paper.width/page.width,paper.height/page.height);return Math.min(...page.items.filter(i=>i.wirelessCaption).map(i=>textLayout(i).size*scale));};

test('automatic wireless paper planning preserves every link and prints readable complete captions',()=>{
 let letterCount;
 for(const [preset,orientation] of [['letter','landscape'],['a4','landscape'],['a3','landscape'],['letter','portrait'],['a5','landscape']]){
  const site=lab(preset,orientation),saved=JSON.stringify(site),result=pages(site);
  assert.equal(JSON.stringify(site),saved,'planning must not change saved settings or data');
  assert.equal(result.flatMap(p=>p.items.filter(i=>i.type==='path')).length,32);
  assert.deepEqual(result.flatMap(p=>p.wirelessLayout.links).sort((a,b)=>a-b),Array.from({length:32},(_,i)=>i));
  assert.equal(new Set(result.flatMap(p=>p.wirelessLayout.memberIds)).size,8);
  assert.equal(new Set(result.flatMap(p=>p.items.filter(i=>i.kind==='ap').map(i=>i.sourceId))).size,32);
  for(const page of result){
   assert.ok(minimumPoints(page)>=8,`${preset} ${orientation} details fall below 8pt`);
   assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);
   for(const item of page.items.filter(i=>i.wirelessCaption))assert.equal(textLayout(item).size,item.size,'full measured text must not shrink');
   for(const path of page.items.filter(i=>i.type==='path'))for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]]){assert.ok(Math.abs(point[0]-anchor.x)<1e-6);assert.ok(Math.abs(point[1]-anchor.y)<1e-6);}
  }
  if(preset==='letter'&&orientation==='landscape')letterCount=result.length;
  if(preset==='a3')assert.ok(result.length<letterCount,'larger paper should need fewer continuations');
 }
});
test('dynamic and preserve-layout keep the complete original wireless stack',()=>{
 for(const [preset,mode] of [['dynamic','optimize'],['letter','preserve']]){
  const site=lab(preset,'landscape',mode);
  const saved=JSON.stringify(site),result=pages(site);assert.equal(result.length,1);assert.equal(result[0].wirelessLayout.memberIds.length,8);assert.equal(JSON.stringify(site),saved);
 }
});
test('continued wireless captions retain explicit text edits and stable native attachment identities',()=>{
 const site=lab(),before=pages(site),caption=before.flatMap(p=>p.items).find(i=>i.deviceInfo==='model');
 site.layout.drawingEdits={[caption.editKey]:{value:'LAB custom model',size:13,color:'#224466'}};
 const saved=JSON.stringify(site),result=pages(JSON.parse(saved)),edited=result.flatMap(p=>p.items).filter(i=>i.editKey===caption.editKey);
 assert.equal(edited.length,1);assert.equal(edited[0].value,'LAB custom model');assert.equal(edited[0].color,'#224466');
 // Fitting is invertible and does not overwrite the requested source font.
 assert.ok(Math.abs(edited[0].size/edited[0].presentation.fontScale-13)<1e-6);
 const keys=result.flatMap(p=>p.items.filter(i=>i.type==='device').map(i=>i.editKey));assert.equal(new Set(keys).size,keys.length);
 assert.equal(JSON.stringify(site),saved);
});

test('the first drag on an automatic continuation retains the same page plan after reopen',()=>{
 const site=lab(),before=pages(site),body=before[0].items.find(i=>i.kind==='ap'),scale=body.presentation.scale,sourceX=(body.x-body.presentation.x)/scale;
 site.layout.drawingEdits={[body.editKey]:{x:sourceX+4}};
 const result=pages(JSON.parse(JSON.stringify(site))),moved=result.flatMap(p=>p.items).find(i=>i.editKey===body.editKey);
 assert.equal(result.length,before.length);assert.deepEqual(result.map(p=>p.wirelessLayout.links),before.map(p=>p.wirelessLayout.links));
 assert.deepEqual(result.map(p=>p.editScope),before.map(p=>p.editScope));
 assert.ok(Math.abs((moved.x-moved.presentation.x)/moved.presentation.scale-sourceX-4)<1e-6);
});
test('numbered-page paper overrides constrain readable planning and Dynamic retains its final scope',()=>{
 const site=lab('a3'),baseline=pages(site),name=baseline[0].name;
 site.layout.pageSetup.visible.pages={[name]:{preset:'letter',orientation:'landscape'}};
 const mixed=pages(site);assert.ok(mixed.length>=baseline.length);
 assert.equal(mixed[0].printPaper.preset,'letter');assert.equal(mixed[1].printPaper.preset,'a3');
 for(const page of mixed)assert.ok(minimumPoints(page)>=8,'individual paper override must not shrink details');
 assert.equal(mixed.flatMap(p=>p.wirelessLayout.links).length,32);
 site.layout.pageSetup.visible.pages[name]={preset:'dynamic'};
 const dynamic=pages(site);assert.equal(dynamic[0].visiblePaper,undefined);assert.equal(dynamic.length,baseline.length);
 assert.equal(dynamic[1].printPaper.preset,'a3');
});

test('visible Auto-fit paper takes precedence over an older fixed wireless drawing preset',()=>{
 const site=lab();site.layout.pageSetup.overrides={wireless:{preset:'a3',orientation:'landscape'}};
 const saved=JSON.stringify(site),result=pages(site);for(const page of result)assert.ok(minimumPoints(page)>=8);
 assert.equal(JSON.stringify(site),saved);assert.equal(result.flatMap(p=>p.wirelessLayout.links).length,32);
});
