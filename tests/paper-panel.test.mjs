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
test('a tall panel flows into columns and stays on the sheet',()=>{
 for(const [lines,readable] of [[30,true],[80,false]]){
  const p=make('letter',true);p.layout.presentation.defaults.panel={sections:['connections','vlans','notes'],notes:Array.from({length:lines},(_,i)=>`Fictional note ${i}: complete reference data`).join('\n')};
  const page=core(p),unit=page.width/printGeometry(page).width,text=page.items.filter(i=>i.panelGroup&&i.type==='text'),notes=text.filter(i=>i.editKey.includes('|info-panel|notes|')&&!i.editKey.endsWith('|heading'));
  assert.equal(page.pageOverflow,false,lines+' lines fit');
  assert.equal(notes.length,lines,'one item per note line');for(const [index,item] of notes.entries())assert.equal(item._rowText.index,index);
  assert.ok(new Set(notes.map(i=>Math.round(i.x))).size>=2,'the notes continue in another column');
  const panel=contentBounds({items:page.items.filter(i=>i.panelGroup)});assert.ok(panel.y+panel.h<=page.height+.5&&panel.x>=0,'inside the sheet');
  assert.ok(Math.min(...text.map(i=>i.size/unit))>=5*4/3-.01,'never below 5 pt');
  if(readable)assert.ok(Math.min(...notes.map(i=>i.size/unit))>=10.66,'moderate content keeps 8 pt notes');
  const body=contentBounds({items:page.items.filter(i=>!i.panelGroup&&!i.pageFrame&&!i.pageHeading)});assert.ok(panel.x+panel.w<body.x,'the diagram stays beside the panel');
 }
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
   assert.equal(page.pageOverflow,!!page.paperReadability?.overflow);
   if(page.paperReadability?.overflow)assert.ok(page.paperReadability.actualPt>=page.paperReadability.minimumPt-.01,'dense model retains readable labels and exposes its overflow');
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

test('panel docks retain content spacing without a decorative vertical divider',()=>{
 for(const position of ['left','right','top']){
  const page=core(make('letter',true,position)),divider=page.items.find(i=>i.pageFrame==='sidebar');
  const panel=contentBounds({items:page.items.filter(i=>i.panelGroup)}),body=contentBounds({items:page.items.filter(i=>!i.panelGroup&&!i.pageFrame&&!i.pageHeading)});
  assert.equal(divider,undefined);
  if(position==='left')assert.ok(panel.x+panel.w<body.x);
  if(position==='right')assert.ok(body.x+body.w<panel.x);
  if(position==='top')assert.ok(panel.y+panel.h<body.y);
 }
});

test('dynamic and fixed core scenes omit panel divider across rebuild and exports',()=>{
 for(const preset of ['dynamic','letter'])for(const locked of [false,true]){
  const project=make(preset,locked),page=core(project);
  assert.ok(page.items.some(i=>i.panelGroup));
  assert.ok(!page.items.some(i=>i.pageFrame==='sidebar'));
  assert.equal(core(JSON.parse(JSON.stringify(project))).svg,page.svg);
 }
});
