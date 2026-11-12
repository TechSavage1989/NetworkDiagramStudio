import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {quickPagePaperLayout} from '../src/web/quick-page-paper.mjs';
import {cleanPageSetup,newPageSetup,paperDimensions,visiblePagePaper} from '../src/web/page-options.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {fictionalCampus} from './fixtures/site-map-campus.mjs';
import {sampleSite} from '../src/web/sample.mjs';

// Every text item's anchor and size on the printed sheet, in paper pixels:
// an unlocked sheet is drawn in its own units, a locked one in paper units.
function printed(page,project){
 const paper=paperDimensions(visiblePagePaper(project,page)),k=paper.widthMm*96/25.4/page.width,ox=page.originX||0,oy=page.originY||0;
 return new Map(page.items.filter(i=>i.type==='text'&&i.editKey&&!i.hidden).map(i=>{const x=i.align==='right'?i.x+i.w:i.align==='center'?i.x+i.w/2:i.x;return [i.editKey,{x:(x-ox)*k,y:(i.y-oy)*k,size:textLayout(i).size*k,value:i.value}];}));
}

test('locking a page keeps every text item at the size and place it had',()=>{
 for(const [make,paper] of [[fictionalCampus,{preset:'letter',orientation:'landscape'}],[sampleSite,{preset:'a4',orientation:'portrait'}]]){
  const project=make(),setup=newPageSetup();project.layout={...(project.layout||{}),pageSetup:{...setup,visible:{...setup.visible,default:paper,groups:{}}}};
  const before=buildPages(project);
  // The page bar's lock with All pages: lock, rebuild, record each page's frame.
  const lockedLayout=quickPagePaperLayout(project.layout,before[0],{locked:true},{all:true}),lockedProject={...project,layout:lockedLayout},first=buildPages(lockedProject);
  const frames=cleanPageSetup(lockedLayout.pageSetup);for(const page of first)if(page.pageLockFrame)frames.visible.lockFrames[page.name]=page.pageLockFrame;
  const framedProject={...project,layout:{...lockedLayout,pageSetup:frames}},again=buildPages(framedProject);
  assert.ok(first.some(page=>page.pageLockFrame),'pages were locked');
  for(const page of before){
   const was=printed(page,project);
   for(const [label,pages,source] of [['as locked',first,lockedProject],['after reopening locked',again,framedProject]]){
    const locked=pages.find(p=>p.name===page.name);assert.ok(locked,page.name);const now=printed(locked,source);
    for(const [key,a] of was){const b=now.get(key);assert.ok(b,label+': '+key+' kept');
     assert.ok(Math.abs(a.x-b.x)<.3&&Math.abs(a.y-b.y)<.3,label+': '+key+' ('+a.value+') moved '+JSON.stringify([a.x,a.y])+' -> '+JSON.stringify([b.x,b.y]));
     assert.ok(Math.abs(a.size-b.size)<.05,label+': '+key+' ('+a.value+') size '+a.size.toFixed(3)+' -> '+b.size.toFixed(3));}
   }
  }
 }
});
