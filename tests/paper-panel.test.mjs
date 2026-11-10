import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSite} from '../src/web/sample.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {printGeometry} from '../src/web/page-options.mjs';
import {contentBounds} from '../src/web/page-content-fit.mjs';
import {unpresentPatch} from '../src/web/presentation.mjs';
const make=(preset='letter',locked=false,position='left')=>({...sampleSite(),layout:{presentation:{defaults:{panel:{position,sections:['connections','modules','vlans']}}},pageSetup:{visible:{default:{preset,locked}}}}});
const core=p=>buildPages(p).find(p=>p.name==='Core Network');
test('information panel uses physical readable text on Letter, A4 and A3, locked or unlocked',()=>{
 for(const preset of ['letter','a4','a3'])for(const locked of [false,true])for(const position of ['left','right']){
  const p=make(preset,locked,position),page=core(p),unit=page.width/printGeometry(page).width;
  const text=page.items.filter(i=>i.panelGroup&&i.type==='text');assert.ok(text.length);
  assert.ok(Math.min(...text.map(i=>i.size/unit))>=10.66);
  const panel=contentBounds({items:page.items.filter(i=>i.panelGroup)}),body=contentBounds({items:page.items.filter(i=>!i.panelGroup&&!i.pageFrame&&!i.pageHeading)});
  assert.ok(position==='left'?panel.x+panel.w<body.x:body.x+body.w<panel.x);
  assert.equal(core(JSON.parse(JSON.stringify(p))).svg,page.svg);
  if(locked){p.layout.pageSetup.visible.lockFrames={[page.name]:page.pageLockFrame};assert.equal(core(p).svg,page.svg);}
 }
});
test('dense panel preserves readable letters and warns instead of silently compressing',()=>{
 const p=make('letter',true);p.layout.presentation.defaults.panel={sections:['notes'],notes:Array.from({length:80},(_,i)=>`Fictional note ${i}: complete reference data`).join('\n')};
 const page=core(p);assert.equal(page.pageOverflow,true);
 assert.ok(Math.min(...page.items.filter(i=>i.panelGroup&&i.type==='text').map(i=>i.size))>=10.66);
});
test('explicit panel geometry round-trips without rewriting saved edits',()=>{
 const p=make(),page=core(p),item=page.items.find(i=>i.panelGroup&&i.type==='text');
 const patch=unpresentPatch(item,{x:item.x+20,size:item.size*1.2});p.layout.drawingEdits={[item.editKey]:patch};
 const saved=JSON.stringify(p),after=core(p),changed=after.items.find(i=>i.editKey===item.editKey),unpresented=unpresentPatch(changed,changed);
 for(const key of ['x','size'])assert.ok(Math.abs(unpresented[key]-patch[key])<1e-6);
 assert.equal(JSON.stringify(p),saved);
});
test('wireless link colors retain physical readability without shrinking with AP layout',()=>{
 for(const locked of [false,true])for(const preset of ['letter','a4']){
  const p=make(preset,locked);delete p.layout.presentation;
  const pages=buildPages(p).filter(p=>p.title==='Wireless Connections');assert.ok(pages.length);
  for(const page of pages){
   const unit=page.width/printGeometry(page).width,key=page.items.filter(i=>i.editKey?.includes('|legend|'));
   assert.ok(key.length);for(const text of key.filter(i=>i.type==='text'))assert.ok(text.size/unit>=10.99);
   const legend=contentBounds({items:key}),models=contentBounds({items:page.items.filter(i=>!key.includes(i)&&!i.pageFrame&&!i.pageHeading)});
   assert.ok(legend.y+legend.h<models.y);
   assert.equal(page.pageOverflow,false);
  }
 }
});
test('old saved frames require explicit refit rather than moving the user diagram',()=>{
 const p=make('letter',true),first=core(p),frame={...first.pageLockFrame};delete frame.panelFit;
 p.layout.pageSetup.visible.lockFrames={[first.name]:frame};const old=core(p);
 assert.equal(old.panelFitLegacy,true);assert.equal(old.pageLockFrame.panelFit,undefined);
 for(const item of first.items.filter(i=>i.type==='device'&&!i.panelGroup)){
  const same=old.items.find(i=>i.editKey===item.editKey);for(const key of ['x','y','w','h'])assert.ok(Math.abs(item[key]-same[key])<1e-6);
 }
 delete p.layout.pageSetup.visible.lockFrames;const refit=core(p);assert.equal(refit.panelFitLegacy,false);assert.equal(refit.pageLockFrame.panelFit,1);
});

test('panel separator follows left, right and top docks without crossing content',()=>{
 for(const position of ['left','right','top']){
  const page=core(make('letter',true,position)),divider=page.items.find(i=>i.pageFrame==='sidebar');
  const panel=contentBounds({items:page.items.filter(i=>i.panelGroup)}),body=contentBounds({items:page.items.filter(i=>!i.panelGroup&&!i.pageFrame&&!i.pageHeading)});
  if(position==='left'){assert.ok(divider);assert.ok(panel.x+panel.w<divider.x&&divider.x+divider.w<body.x);}
  if(position==='right')assert.ok(body.x+body.w<panel.x);
  if(position==='top')assert.ok(panel.y+panel.h<body.y);
 }
});
