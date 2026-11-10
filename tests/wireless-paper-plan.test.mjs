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
// Readable, complete and clean sheets, measured on the printed paper.
function readable(pages,{links=60,minimum=7.95,paper=null}={}){
 assert.deepEqual(pages.flatMap(p=>p.wirelessLayout.links).sort((a,b)=>a-b),Array.from({length:links},(_,i)=>i+3),'every AP link appears exactly once');
 for(const page of pages){
  const k=points(page),captions=page.items.filter(i=>i.wirelessCaption),devices=page.items.filter(i=>i.type==='device'),paths=page.items.filter(i=>i.type==='path'),numbers=page.items.filter(i=>i.portNumberRole==='text');
  assert.equal(page.pageOverflow,false,page.name);assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);
  assert.ok(Math.min(...captions.map(i=>textLayout(i).size))*k>=minimum,page.name+' AP names and details print at a readable size');
  assert.ok(Math.min(...numbers.map(i=>i.size))*k>=6.5,page.name+' switch port numbers stay readable');
  for(const [index,text] of captions.entries()){assert.ok(!devices.some(d=>intersects(text,d,-1e-6)));assert.ok(!captions.slice(index+1).some(c=>intersects(text,c,-1e-6)));assert.ok(!paths.some(path=>pathCrossesText(path,text,0)));}
  for(const path of paths)for(const [point,anchor] of [[path.points[0],path.from],[path.points.at(-1),path.to]])for(const [i,key] of ['x','y'].entries())assert.ok(Math.abs(point[i]-anchor[key])<1e-6,'cables stay glued to their ports');
  // The stack view shows every member whose ports carry this sheet's links.
  const members=new Set(page.items.filter(i=>i.type==='path').map(p=>String(p.sourceLink?.ap||'').split('/')[0]));for(const id of members)assert.ok(page.wirelessLayout.memberIds.includes(id));
  // Connection-type samples match the painted thickness of their cables.
  for(const sample of page.items.filter(i=>i.legendEntry&&i.type==='rect')){const cable=paths.find(p=>p.linkType===sample.linkType);if(cable)assert.ok(Math.abs(sample.h-cable.weight)<1e-6,'legend sample thickness equals its cable');}
  if(paper){const g=printGeometry(page);assert.ok(Math.abs(g.width-paper[0])<1e-6&&Math.abs(g.height-paper[1])<1e-6,'every sheet keeps the selected paper');}
 }
}

test('regression: selecting Letter for a dense two-stack wireless site plans readable sheets instead of 60 one-AP pages',()=>{
 const p=wirelessTwoStackSite(),dynamic=wireless(p);assert.equal(dynamic.length,2,'dynamic paper keeps one page per stack');
 p.layout=quickPagePaperLayout(p.layout,dynamic[0],{preset:'letter'});assert.equal(p.layout.pageSetup.visible.wirelessFit,'adaptive');
 const t=Date.now(),pages=wireless(p);assert.ok(Date.now()-t<60000,'planning stays bounded');
 assert.ok(pages.length<=4,'four Letter sheets, not '+pages.length);readable(pages,{paper:[1056,816]});
 for(const page of pages){assert.ok(page.wirelessLayout.paperPlan);assert.ok(page.wirelessLayout.links.length>=12,'no nearly empty continuation sheets');assert.ok(page.wirelessLayout.memberIds.length===1,'only the AP member, not the whole stack');}
});

test('other papers and orientations stay complete, readable and efficient',()=>{
 for(const [preset,orientation,most] of [['a4','landscape',4],['legal','landscape',4],['tabloid','landscape',4],['a3','landscape',4],['letter','portrait',8]]){
  const pages=wireless(wirelessTwoStackSite({preset,orientation,fit:'adaptive'}));assert.ok(pages.length<=most,preset+' '+orientation+' used '+pages.length+' sheets');readable(pages);
 }
});

test('preview.49/50 automatic adaptive frames migrate; authored geometry keeps its frames and stays bounded',()=>{
 const p=wirelessTwoStackSite({preset:'letter',fit:'adaptive'}),stale={scale:.2,x:0,y:0,originX:0,originY:0,width:1056,height:816,contentFit:1,wirelessFit:'adaptive',wirelessApFactor:1,wirelessBatchLimit:1};
 p.layout.pageSetup.visible.editFrames=Object.fromEntries(Array.from({length:60},(_,i)=>['Wireless Connections '+(i+1),stale]));p.layout.pageSetup=cleanPageSetup(p.layout.pageSetup);
 const source=JSON.stringify(p),pages=wireless(p);assert.ok(pages.length<=4);readable(pages);assert.equal(JSON.stringify(p),source,'rendering never mutates the saved project');
 // Authored geometry depends on its frames: no silent re-plan, and no runaway.
 const ap=pages[0].items.find(i=>i.kind==='ap');p.layout.drawingEdits={[ap.editKey]:{x:ap.x}};const authored=wireless(p);
 assert.ok(authored.every(page=>!page.wirelessLayout.paperPlan));assert.ok(authored.length<=60);assert.deepEqual(authored.flatMap(page=>page.wirelessLayout.links).sort((a,b)=>a-b),Array.from({length:60},(_,i)=>i+3));
});

test('an unreachable text target never splits a site into one AP per sheet',()=>{
 const p=wirelessTwoStackSite({preset:'letter',fit:'adaptive'});p.layout.presentation={defaults:{minimumTextPt:18}};
 const pages=wireless(p);assert.ok(pages.length<=12,'bounded continuation: '+pages.length);assert.ok(pages.every(page=>page.wirelessLayout.links.length>=4));
});

test('locked paper plans reopen exactly, keep a manual AP move and allow a deliberate off-page placement',()=>{
 const p=wirelessTwoStackSite({preset:'letter',fit:'adaptive',locked:true}),pages=wireless(p);readable(pages);
 p.layout.pageSetup.visible.lockFrames=Object.fromEntries(pages.map(page=>[page.name,page.pageLockFrame]));p.layout.pageSetup=cleanPageSetup(p.layout.pageSetup);
 assert.deepEqual(wireless(JSON.parse(JSON.stringify(p))).map(page=>page.svg),pages.map(page=>page.svg));
 const ap=pages[0].items.find(i=>i.kind==='ap');p.layout.drawingEdits={[ap.editKey]:unpresentPatch(ap,{x:ap.x+30})};
 const moved=wireless(p),again=wireless(JSON.parse(JSON.stringify(p)));assert.equal(moved.length,pages.length);assert.ok(Math.abs(moved[0].items.find(i=>i.editKey===ap.editKey).x-(ap.x+30))<1e-6,'manual placement is kept');assert.deepEqual(again.map(page=>page.svg),moved.map(page=>page.svg));
 p.layout.drawingEdits={[ap.editKey]:unpresentPatch(ap,{x:moved[0].width+400})};const off=wireless(p)[0];assert.ok(off.items.find(i=>i.editKey===ap.editKey).x>off.width,'a locked page still allows a deliberate off-page move');assert.equal(off.pageOverflow,true,'and reports the print clipping');
});

test('explicit keep-layout and dynamic paper keep their existing wireless planners',()=>{
 const kept=wirelessTwoStackSite({preset:'letter'});Object.assign(kept.layout.pageSetup.visible,{wirelessFit:'layout',wirelessFitExplicit:true});
 assert.ok(wireless(kept).every(page=>!page.wirelessLayout.paperPlan));
 assert.ok(wireless(wirelessTwoStackSite()).every(page=>!page.wirelessLayout.paperPlan&&page.wirelessLayout.memberIds.length>=5));
});
