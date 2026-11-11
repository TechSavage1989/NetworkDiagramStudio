import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {printGeometry,cleanPageSetup} from '../src/web/page-options.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';
import {unpresentPatch} from '../src/web/presentation.mjs';
import {quickPagePaperLayout} from '../src/web/quick-page-paper.mjs';
import {wirelessTwoStackSite} from './fixtures/wireless-two-stack.mjs';

const wireless=p=>buildPages(p).filter(page=>page.wirelessLayout);
const points=page=>.75*printGeometry(page).width/page.width;
const stackLinks={s2:Array.from({length:32},(_,i)=>i+3),s1:Array.from({length:28},(_,i)=>i+35)};
// Complete and clean sheets, measured on the printed paper.
function readable(pages,{links=60,minimum=4,ports=3.5,paper=null}={}){
 assert.deepEqual(pages.flatMap(p=>p.wirelessLayout.links).sort((a,b)=>a-b),Array.from({length:links},(_,i)=>i+3),'every AP link appears exactly once');
 for(const page of pages){
  const k=points(page),captions=page.items.filter(i=>i.wirelessCaption),devices=page.items.filter(i=>i.type==='device'),paths=page.items.filter(i=>i.type==='path'),numbers=page.items.filter(i=>i.portNumberRole==='text');
  assert.equal(page.pageOverflow,false,page.name);assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);
  assert.ok(Math.min(...captions.map(i=>textLayout(i).size))*k>=minimum,page.name+' AP names and details print at '+(Math.min(...captions.map(i=>textLayout(i).size))*k).toFixed(2)+' pt');
  assert.ok(Math.min(...numbers.map(i=>i.size))*k>=ports,page.name+' switch port numbers print at '+(Math.min(...numbers.map(i=>i.size))*k).toFixed(2)+' pt');
  assert.ok(numbers.every(i=>!i.angle),page.name+' port numbers stay upright');
  for(const [index,text] of captions.entries()){assert.ok(!devices.some(d=>intersects(text,d,-1e-6)));assert.ok(!captions.slice(index+1).some(c=>intersects(text,c,-1e-6)));assert.ok(!paths.some(path=>pathCrossesText(path,text,0)));}
  for(const path of paths)for(const [point,anchor] of [[path.points[0],path.from],[path.points.at(-1),path.to]])for(const [i,key] of ['x','y'].entries())assert.ok(Math.abs(point[i]-anchor[key])<1e-6,'cables stay glued to their ports');
  // The stack view shows every member whose ports carry this sheet's links.
  const members=new Set(page.items.filter(i=>i.type==='path').map(p=>String(p.sourceLink?.ap||'').split('/')[0]));for(const id of members)assert.ok(page.wirelessLayout.memberIds.includes(id));
  // Connection-type samples match the painted thickness of their cables.
  for(const sample of page.items.filter(i=>i.legendEntry&&i.type==='rect')){const cable=paths.find(p=>p.linkType===sample.linkType);if(cable)assert.ok(Math.abs(sample.h-cable.weight)<1e-6,'legend sample thickness equals its cable');}
  if(paper){const g=printGeometry(page);assert.ok(Math.abs(g.width-paper[0])<1e-6&&Math.abs(g.height-paper[1])<1e-6,'every sheet keeps the selected paper');}
 }
}
// One sheet per switch, holding every AP that switch connects to.
function wholeSwitches(pages){
 assert.equal(pages.length,2,'one sheet per switch, not '+pages.length);
 assert.deepEqual(pages.map(page=>page.wirelessLayout.links.slice().sort((a,b)=>a-b)),[stackLinks.s2,stackLinks.s1],'each switch keeps all of its APs on its own sheet');
 for(const page of pages){assert.ok(page.wirelessLayout.paperPlan&&page.wirelessLayout.wholeSwitch);assert.ok(!page.wirelessLayout.routingCompromise);}
}
const smallest=pages=>Math.min(...pages.map(page=>Math.min(...page.items.filter(i=>i.wirelessCaption).map(i=>textLayout(i).size))*points(page)));

// AP cards above, below and beside the stack (presented page coordinates).
function sides(page){
 const box=i=>{const {scale=1,x=0,y=0}=i.presentation||{};return {x:i.x*scale+x,y:i.y*scale+y,r:(i.x+i.w)*scale+x,b:(i.y+i.h)*scale+y};};
 const stack=page.items.filter(i=>i.type==='device'&&i.kind!=='ap').map(box),top=Math.min(...stack.map(b=>b.y)),bottom=Math.max(...stack.map(b=>b.b)),left=Math.min(...stack.map(b=>b.x)),right=Math.max(...stack.map(b=>b.r));
 const aps=page.items.filter(i=>i.kind==='ap').map(box);
 return {above:aps.filter(b=>b.b<=top).length,below:aps.filter(b=>b.y>=bottom).length,beside:aps.filter(b=>b.r<=left||b.x>=right).length};
}

test('regression: Letter keeps every AP on its switch\'s sheet with the whole stack, filling the paper instead of 60 one-AP pages',()=>{
 const p=wirelessTwoStackSite(),dynamic=wireless(p);assert.equal(dynamic.length,2,'dynamic paper keeps one page per stack');
 p.layout=quickPagePaperLayout(p.layout,dynamic[0],{preset:'letter'});assert.equal(p.layout.pageSetup.visible.wirelessFit,'adaptive');
 const t=Date.now(),pages=wireless(p);assert.ok(Date.now()-t<60000,'planning stays bounded');
 wholeSwitches(pages);readable(pages,{paper:[1056,816]});
 assert.deepEqual(pages.map(page=>page.wirelessLayout.memberIds.length),[8,5],'the whole stack is visible');
 for(const page of pages){
  // The APs fill the sheet below its heading (presented coordinates).
  const boxes=page.items.filter(i=>i.kind==='ap'||i.wirelessCaption||i.type==='device').map(i=>{const {scale=1,x=0,y=0}=i.presentation||{};return [i.x*scale+x,i.y*scale+y,(i.x+i.w)*scale+x,(i.y+i.h)*scale+y];});
  const top=Math.min(...boxes.map(b=>b[1])),wide=(Math.max(...boxes.map(b=>b[2]))-Math.min(...boxes.map(b=>b[0])))/page.width,tall=(Math.max(...boxes.map(b=>b[3]))-top)/(page.height-top);
  assert.ok(Math.max(wide,tall)>=.85,'the APs fill the sheet ('+wide.toFixed(2)+' wide, '+tall.toFixed(2)+' tall)');
  // APs use the space above, below and beside the stack, and cables stay untangled.
  const where=sides(page);assert.ok(where.above>0&&where.below>0&&where.beside>0,page.name+' places APs around the stack '+JSON.stringify(where));
  assert.ok(page.wirelessLayout.routingCost[3]<=page.wirelessLayout.links.length,'no more crossings than APs');
  // Names stay on one line (a rare long outdoor name may break at a hyphen).
  const titles=page.items.filter(i=>i.wirelessCaption&&/\|title\|/.test(i.editKey||''));
  assert.ok(titles.filter(i=>textLayout(i).lines.length>1).length<=Math.floor(titles.length/10),'AP names are not broken');
 }
 // A rebuild reuses the chosen plan and matches a cold build exactly.
 const again=wireless(JSON.parse(JSON.stringify(p)));assert.deepEqual(again.map(page=>page.svg),pages.map(page=>page.svg));
});

test('Only stack members with AP links trades the whole stack for larger text; Use side space keeps rows above and below',()=>{
 const whole=wireless(wirelessTwoStackSite({preset:'letter',fit:'adaptive'}));
 const members=wirelessTwoStackSite({preset:'letter',fit:'adaptive'});members.layout.pageSetup.visible.wirelessStack='members';members.layout.pageSetup=cleanPageSetup(members.layout.pageSetup);
 assert.equal(members.layout.pageSetup.visible.wirelessStack,'members','the choice survives normalization');
 const sheets=wireless(members);wholeSwitches(sheets);readable(sheets,{minimum:4.5,ports:4});
 assert.deepEqual(sheets.map(page=>page.wirelessLayout.memberIds),[['7'],['3']]);assert.ok(smallest(sheets)>smallest(whole),'members-only prints larger');
 const side=wirelessTwoStackSite({preset:'letter',fit:'adaptive'});side.layout.presentation={defaults:{wirelessApPlacement:'sides'}};
 for(const page of wireless(side)){const where=sides(page);assert.ok(where.beside>0&&where.above+where.below>0,'side space also uses the rows above and below '+JSON.stringify(where));}
});

test('every paper size keeps each switch whole; larger paper prints larger',()=>{
 const sizes={};
 for(const [preset,orientation,minimum,ports] of [['letter','portrait',4.3,3.6],['a4','landscape',3.9,3.4],['legal','landscape',4,3.5],['tabloid','landscape',5.5,4],['a3','landscape',6,4],['a5','landscape',2.4,2.1]]){
  const pages=wireless(wirelessTwoStackSite({preset,orientation,fit:'adaptive'}));wholeSwitches(pages);readable(pages,{minimum,ports});sizes[preset+orientation]=smallest(pages);
 }
 assert.ok(sizes.tabloidlandscape>sizes.legallandscape&&sizes.legallandscape>sizes.a5landscape,'larger paper prints the APs larger');
});

test('a page margin setting sets the blank border on drawing pages and port maps',()=>{
 const build=mm=>{const p=wirelessTwoStackSite({preset:'letter',fit:'adaptive'});if(mm!=null)p.layout.pageSetup.visible.marginMm=mm;return buildPages(p);};
 const auto=build(null),wide=build(25),scale=(pages,name)=>pages.find(page=>page.name===name).presentationFrame.scale;
 assert.equal(cleanPageSetup({visible:{marginMm:25}}).visible.marginMm,25);assert.equal(cleanPageSetup({visible:{marginMm:80}}).visible.marginMm,undefined,'out-of-range margins are dropped');
 for(const name of ['Core Network','Wireless Connections 1','Wireless Connections 2'])assert.ok(scale(wide,name)<scale(auto,name),name+' leaves room for the wider margin');
 const maps=wide.filter(page=>page.switchportReport&&page.family==='ports');assert.ok(maps.length);for(const page of maps)assert.ok(Math.abs(page.reportMargin-25*96/25.4)<1e-6,'port maps use the margin');
 assert.ok(auto.filter(page=>page.switchportReport&&page.family==='ports').every(page=>[4,24].includes(page.reportMargin)),'automatic keeps the established port-map margins');
});

test('saved automatic frames from preview.49-51 re-plan as one sheet per switch; authored preview.51 splits stay',()=>{
 const p=wirelessTwoStackSite({preset:'letter',fit:'adaptive'}),stale={scale:.2,x:0,y:0,originX:0,originY:0,width:1056,height:816,contentFit:1,wirelessFit:'adaptive',wirelessApFactor:1,wirelessBatchLimit:1};
 p.layout.pageSetup.visible.editFrames=Object.fromEntries(Array.from({length:60},(_,i)=>['Wireless Connections '+(i+1),stale]));p.layout.pageSetup=cleanPageSetup(p.layout.pageSetup);
 const source=JSON.stringify(p),pages=wireless(p);wholeSwitches(pages);readable(pages);assert.equal(JSON.stringify(p),source,'rendering never mutates the saved project');
 // Authored geometry depends on preview.49/50 frames: no silent re-plan, and no runaway.
 const ap=pages[0].items.find(i=>i.kind==='ap');p.layout.drawingEdits={[ap.editKey]:{x:ap.x}};const authored=wireless(p);
 assert.ok(authored.every(page=>!page.wirelessLayout.paperPlan));assert.ok(authored.length<=60);assert.deepEqual(authored.flatMap(page=>page.wirelessLayout.links).sort((a,b)=>a-b),Array.from({length:60},(_,i)=>i+3));
 // Preview.51 split frames (plan 1) without authored edits re-plan whole.
 const split=wirelessTwoStackSite({preset:'letter',fit:'adaptive'}),v1={scale:1,x:0,y:0,originX:0,originY:0,width:1056,height:816,contentFit:1,wirelessFit:'adaptive',wirelessPaperPlan:1,wirelessBatchLimit:16,wirelessPlan:'paper-rows:1:104:n'};
 split.layout.pageSetup.visible.editFrames=Object.fromEntries([1,2,3,4].map(n=>['Wireless Connections '+n,v1]));split.layout.pageSetup=cleanPageSetup(split.layout.pageSetup);
 assert.equal(cleanPageSetup(split.layout.pageSetup).visible.editFrames['Wireless Connections 1'].wirelessPaperPlan,1,'plan versions survive normalization');
 wholeSwitches(wireless(split));
 // With authored edits on those sheets, the saved split reopens as it was.
 split.layout.drawingEdits={['Wireless Connections 3|device|'+ap.sourceId+'|body']:{x:40}};const kept=wireless(split);
 assert.ok(kept.length>2&&kept.every(page=>page.wirelessLayout.paperPlan&&!page.wirelessLayout.wholeSwitch),'authored preview.51 sheets keep their split');
});

test('a larger minimum text size still keeps each switch on one sheet and says why the text is smaller',async()=>{
 const {pageLayoutNotice}=await import('../src/web/page-layout-notice.mjs');
 const p=wirelessTwoStackSite({preset:'letter',fit:'adaptive'});p.layout.presentation={defaults:{minimumTextPt:18}};
 const pages=buildPages(p).filter(page=>page.wirelessLayout);wholeSwitches(pages);
 for(const page of pages)assert.match(pageLayoutNotice(page),/AP links stay on this sheet with their switch/);
});

test('locked paper plans reopen exactly, keep a manual AP move and allow a deliberate off-page placement',()=>{
 const p=wirelessTwoStackSite({preset:'letter',fit:'adaptive',locked:true}),pages=wireless(p);wholeSwitches(pages);readable(pages);
 p.layout.pageSetup.visible.lockFrames=Object.fromEntries(pages.map(page=>[page.name,page.pageLockFrame]));p.layout.pageSetup=cleanPageSetup(p.layout.pageSetup);
 assert.ok(pages.every(page=>page.pageLockFrame.wirelessPaperPlan===2),'frames record the one-sheet plan');
 assert.deepEqual(wireless(JSON.parse(JSON.stringify(p))).map(page=>page.svg),pages.map(page=>page.svg));
 const ap=pages[0].items.find(i=>i.kind==='ap');p.layout.drawingEdits={[ap.editKey]:unpresentPatch(ap,{x:ap.x+30})};
 const moved=wireless(p),again=wireless(JSON.parse(JSON.stringify(p)));assert.equal(moved.length,pages.length);assert.ok(Math.abs(moved[0].items.find(i=>i.editKey===ap.editKey).x-(ap.x+30))<1e-6,'manual placement is kept');assert.deepEqual(again.map(page=>page.svg),moved.map(page=>page.svg));
 p.layout.drawingEdits={[ap.editKey]:unpresentPatch(ap,{x:moved[0].width+400})};const off=wireless(p)[0];assert.ok(off.items.find(i=>i.editKey===ap.editKey).x>off.width,'a locked page still allows a deliberate off-page move');assert.equal(off.pageOverflow,true,'and reports the print clipping');
});

test('explicit keep-layout and explicit continuation keep their own wireless planners; dynamic paper draws the whole-switch plan',()=>{
 const kept=wirelessTwoStackSite({preset:'letter'});Object.assign(kept.layout.pageSetup.visible,{wirelessFit:'layout',wirelessFitExplicit:true});
 assert.ok(wireless(kept).every(page=>!page.wirelessLayout.paperPlan));
 const continued=wirelessTwoStackSite({preset:'letter'});Object.assign(continued.layout.pageSetup.visible,{wirelessFit:'readable',wirelessFitExplicit:true});
 const sheets=wireless(continued);assert.ok(sheets.length>2,'Continue on sheets still splits for larger text');assert.ok(smallest(sheets)>=7.95);
 // Dynamic pages use the same one-sheet-per-switch arrangement as paper, with the whole stack.
 const dynamic=wireless(wirelessTwoStackSite());assert.equal(dynamic.length,2);assert.ok(dynamic.every(page=>page.wirelessLayout.paperPlan&&page.wirelessLayout.wholeSwitch&&!page.wirelessLayout.routingCompromise));assert.deepEqual(dynamic.map(page=>page.wirelessLayout.memberIds.length),[8,5]);
});

test('editing another device reuses drafted wireless sheets and matches a cold build',()=>{
 const p=wirelessTwoStackSite({preset:'letter',fit:'adaptive'}),first=wireless(p);
 const renamed={...p,devices:p.devices.map(d=>d.id==='mdf'?{...d,name:'LAB-SW01-MDF-RENAMED'}:d)};
 const t=Date.now(),warm=wireless(renamed),elapsed=Date.now()-t;
 assert.deepEqual(warm.map(page=>page.svg),first.map(page=>page.svg),'an unrelated rename leaves wireless sheets unchanged');
 // A renamed AP re-plans only its own switch and shows the new name.
 const ap={...renamed,devices:renamed.devices.map(d=>d.id==='ap1-5'?{...d,name:'LAB-AP-1-5-RENAMED'}:d)},changed=wireless(ap);
 assert.equal(changed[0].svg,warm[0].svg,'the other switch is reused');assert.match(changed[1].svg,/LAB-AP-1-5-RENAMED/);
 assert.ok(elapsed<20000,'reuse is bounded ('+elapsed+' ms)');
});
