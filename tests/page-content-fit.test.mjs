import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSite} from '../src/web/sample.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {fitVisiblePage,cleanPageSetup,printGeometry} from '../src/web/page-options.mjs';
import {contentBounds} from '../src/web/page-content-fit.mjs';
import {unpresentPatch} from '../src/web/presentation.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const project=(locked=false)=>({...sampleSite(),layout:{pageSetup:{visible:{default:{preset:'letter',orientation:'landscape',locked}}}}});
const core=p=>buildPages(p).find(p=>p.name==='Core Network');
test('paper-fit keeps headings at readable physical size while maximizing measured content',()=>{
 for(const locked of [false,true]){
  const p=project(locked),page=core(p),unit=page.width/printGeometry(page).width;
  for(const [role,size] of [['project',15],['title',33],['subtitle',16]])close(page.items.find(i=>i.pageHeading===role).size/unit,size);
  close(page.items.find(i=>i.pageFrame==='brand').size/unit,13);
  const b=contentBounds(page),x=page.originX||0,y=page.originY||0;
  assert.ok(b.x>=x&&b.y>=y&&b.x+b.w<=x+page.width+1e-6&&b.y+b.h<=y+page.height+1e-6);
  assert.equal(page.pageOverflow,false);
 }
});
test('blank source margins and negative coordinates do not shrink the actual diagram',()=>{
 const item={type:'rect',x:-300,y:-100,w:600,h:300},heading={type:'text',pageHeading:'title',x:36,y:43,w:1100,h:48,size:33,value:'Synthetic diagram'};
 const fit=(w,h)=>fitVisiblePage({name:'Synthetic',width:w,height:h,originX:-400,originY:-200,items:[structuredClone(item),structuredClone(heading)]},project(true));
 const a=fit(1200,975),b=fit(5000,4000);close(a.items[0].w,b.items[0].w);close(a.items[0].w/a.items[0].h,2);
 close(a.items[0].x,b.items[0].x);close(a.items[0].y,b.items[0].y);
 assert.ok(a.items[0].w>900,'painted rectangle fills the available landscape width');
});
test('edited headers keep exact source offsets, size and title through rebuild and reopen',()=>{
 const p=project(),first=core(p),heading=first.items.find(i=>i.pageHeading==='project');
 const patch=unpresentPatch(heading,{x:heading.x+8,y:heading.y+3,size:heading.size*1.1,value:'Fictional Workshop'});
 p.layout.drawingEdits={[heading.editKey]:patch};const saved=JSON.stringify(p),a=core(p),b=core(JSON.parse(saved)),edited=a.items.find(i=>i.editKey===heading.editKey);
 assert.equal(JSON.stringify(p),saved);assert.equal(a.svg,b.svg);assert.equal(edited.value,patch.value);
 const recovered=unpresentPatch(edited,{x:edited.x,y:edited.y,size:edited.size});
 close(recovered.x,patch.x);close(recovered.y,patch.y);close(recovered.size,patch.size);
 const unit=a.width/1056;close((edited.x-(a.originX||0))/unit-(heading.x-(first.originX||0))/(first.width/1056),8/(first.width/1056));close((edited.y-(a.originY||0))/unit-(heading.y-(first.originY||0))/(first.width/1056),3/(first.width/1056));close(edited.size/unit,16.5);
});
test('new locked content frames remain stable, old frames keep the old transform',()=>{
 const p=project(true),first=core(p);assert.equal(first.pageLockFrame.contentFit,1);
 p.layout.pageSetup.visible.lockFrames={[first.name]:first.pageLockFrame};p.layout.pageSetup=cleanPageSetup(p.layout.pageSetup);
 const rebuilt=core(p);assert.equal(rebuilt.svg,first.svg);
 const device=first.items.find(i=>i.type==='device');p.layout.drawingEdits={[device.editKey]:{x:100000}};
 const overflow=core(p);assert.equal(overflow.pageOverflow,true);assert.deepEqual(overflow.pageLockFrame,first.pageLockFrame);
 for(const item of first.items.filter(i=>i.pageHeading||i.pageFrame==='brand')){
  const again=overflow.items.find(i=>i.editKey===item.editKey);close(again.x,item.x);close(again.y,item.y);close(again.size,item.size);
 }
 const frame={scale:.5,x:10,y:20,originX:0,originY:0,width:1056,height:816};
 const source={name:'Old',width:1200,height:975,items:[{type:'text',pageHeading:'project',x:40,y:20,w:200,h:30,size:15,value:'Legacy'}]};
 const legacy=project(true);legacy.layout.pageSetup.visible.lockFrames={Old:frame};const fitted=fitVisiblePage(source,legacy);close(fitted.items[0].size,7.5);close(fitted.items[0].x,30);assert.equal(fitted.pageLockFrame.contentFit,undefined);
});
test('locked report sheets warn about painted off-page objects without expanding the sheet',()=>{
 const p=project(true),source=()=>({name:'Report',width:1056,height:816,items:[{type:'rect',x:20,y:20,w:500,h:300}]});
 const initial=fitVisiblePage(source(),p);p.layout.pageSetup.visible.lockFrames={Report:initial.pageLockFrame};
 const moved=source();moved.items[0].x=2000;const fitted=fitVisiblePage(moved,p);
 assert.equal(fitted.pageOverflow,true);close(fitted.width,1056);close(fitted.height,816);assert.deepEqual(fitted.pageLockFrame,initial.pageLockFrame);
});
test('empty and heading-only paper remain finite without inventing content bounds',()=>{
 for(const items of [[],[{type:'text',pageHeading:'title',x:36,y:43,w:1000,h:48,size:33,value:'Empty diagram'}]]){
  const page=fitVisiblePage({name:'Empty',width:1200,height:975,items},project(true));
  assert.ok(Number.isFinite(page.width)&&Number.isFinite(page.height));assert.equal(page.pageOverflow,false);
  for(const item of items)for(const key of ['x','y','w','h','size'])assert.ok(Number.isFinite(item[key]));
 }
});
test('accepted unlocked edit frames preserve deliberate physical scale and exact undo',()=>{
 const p=project(),first=core(p),device=first.items.find(i=>i.type==='device'),frame=first.presentationFrame;
 assert.equal(frame.contentFit,1);const original=JSON.stringify(p);
 for(const factor of [.9,1.1,4]){
  const edited=JSON.parse(original);edited.layout.pageSetup.visible.editFrames={[first.name]:frame};
  edited.layout.drawingEdits={[device.editKey]:unpresentPatch(device,{w:device.w*factor,h:device.h*factor})};
  edited.layout.pageSetup=cleanPageSetup(edited.layout.pageSetup);
  const after=core(edited),item=after.items.find(i=>i.editKey===device.editKey);
  close(after.width,first.width);close(after.height,first.height);close(item.w/after.width,device.w/first.width*factor);
  if(factor===4)assert.equal(after.pageOverflow,true);
  assert.deepEqual(after.presentationFrame,frame);assert.equal(core(JSON.parse(JSON.stringify(edited))).svg,after.svg);
 }
 assert.equal(core(JSON.parse(original)).svg,first.svg);
});
test('explicit page title and brand geometry stay editable in their paper frame',()=>{
 const p=project(true),first=core(p);
 for(const item of first.items.filter(i=>i.pageHeading==='title'||i.pageFrame==='brand')){
  const edited=structuredClone(p),patch=unpresentPatch(item,{x:item.x+2,y:item.y+1,w:item.w,h:item.h+5,size:item.size,value:'Fictional caption'});
  edited.layout.drawingEdits={[item.editKey]:patch};const page=core(edited),changed=page.items.find(i=>i.editKey===item.editKey);
  assert.equal(changed.value,'Fictional caption');const recovered=unpresentPatch(changed,changed);
  for(const key of ['x','y','w','h','size'])close(recovered[key],patch[key]);
  assert.equal(page.svg,core(JSON.parse(JSON.stringify(edited))).svg);
 }
});
