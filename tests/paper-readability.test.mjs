import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPresentation,presentation,cleanPanel} from '../src/web/presentation.mjs';
import {fitVisiblePage,cleanPageSetup} from '../src/web/page-options.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {readableModelScale} from '../src/web/paper-readability.mjs';
import {contentBounds} from '../src/web/page-content-fit.mjs';
import {paperPanel} from '../src/web/paper-panel.mjs';
const scene=()=>({name:'Core Network',title:'Core Network',width:2400,height:1600,items:[{type:'text',pageHeading:'title',value:'Synthetic readability',x:30,y:30,w:600,h:40,size:24},{type:'text',editKey:'Core Network|port|a',value:'Port 24',x:800,y:700,w:80,h:18,size:12},{type:'path',points:[[0,200],[2200,200],[2200,1400]],weight:2,color:'#000000'},{type:'device',editKey:'Core Network|device|a',x:800,y:800,w:400,h:100,children:[],ports:{a:[.5,0]}}]});
const project=(defaults={})=>({layout:{presentation:{defaults},pageSetup:{visible:{default:{preset:'letter',locked:true}}}}});
test('paper selection fits the whole diagram instead of enforcing a floor outside the sheet',()=>{
 const p=project(),page=scene();fitVisiblePage(page,p);
 assert.equal(page.paperReadability.minimumPt,8);assert.ok(page.paperReadability.actualPt<8);assert.equal(page.pageOverflow,false);
 const bounds=contentBounds(page);assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.w<=page.width+1e-6&&bounds.y+bounds.h<=page.height+1e-6);
 const path=page.items.find(i=>i.type==='path'),device=page.items.find(i=>i.type==='device'),scale=device.w/400;
 assert.equal(path.points[1][0]-path.points[0][0],2200*scale);
 const label=page.items.find(i=>i.editKey?.includes('|port|'));assert.equal(textLayout(label).size*.75,page.paperReadability.actualPt);
});
test('explicit disabled minimum retains compact fit and global/per-page preferences normalize and reopen',()=>{
 const p=project({minimumTextPt:0}),page=scene();fitVisiblePage(page,p);assert.ok(page.paperReadability.actualPt<8);assert.equal(page.pageOverflow,false);
 const config=cleanPresentation({defaults:{minimumTextPt:9,wirelessApScale:1.5},pages:{'Core Network':{minimumTextPt:10,textScale:1.2,wirelessApScale:2}}});
 assert.deepEqual(cleanPresentation(JSON.parse(JSON.stringify(config))),config);assert.equal(presentation({layout:{presentation:config}},'Core Network').minimumTextPt,10);
 assert.equal(cleanPresentation({defaults:{minimumTextPt:-1,wirelessApScale:20}}).defaults.minimumTextPt,8);assert.equal(cleanPanel({paperWidth:100}).paperWidth,0);
});
test('larger lettering control increases physical minimum; explicit individual sizes are not overridden',()=>{
 const p=project({minimumTextPt:8,textScale:1.5}),page=scene();fitVisiblePage(page,p);assert.equal(page.paperReadability.minimumPt,12);assert.ok(page.paperReadability.actualPt<12);assert.equal(page.pageOverflow,false);
 const manual=scene(),authored=project();authored.layout.drawingEdits={'Core Network|port|a':{size:4}};manual.items.find(i=>i.editKey?.includes('|port|')).size=4;fitVisiblePage(manual,authored);assert.equal(manual.paperReadability.actualPt,null);assert.equal(manual.pageOverflow,false);
});
test('frozen frames preserve intentional transforms and expose small text instead of breaking the layout',()=>{
 const p=project({minimumTextPt:0}),first=scene();fitVisiblePage(first,p);p.layout.pageSetup.visible.lockFrames={[first.name]:first.pageLockFrame};p.layout.presentation.defaults.minimumTextPt=8;
 const after=scene();fitVisiblePage(after,p);assert.equal(after.presentationFrame.scale,first.presentationFrame.scale);assert.ok(after.paperReadability.actualPt<8);assert.equal(after.paperReadability.preserved,true);
});
test('automatic panel trims empty row width while custom physical width rewraps complete content',()=>{
 const item=(value,y)=>({type:'text',value,x:38,y,w:244,h:18,size:12,panelGroup:true,editKey:'Core Network|info-panel|notes|'+y});
 const body={x:8,y:100,w:1000,h:600},p=project();
 const compact={name:'Core Network',items:[item('Short note',147)]},a=paperPanel(compact,p,body,1);assert.ok(a.body.w>850);assert.ok(compact.items[0].w<150);
 p.layout.presentation.defaults.panel={paperWidth:30};const fixed={name:'Core Network',items:[item('A complete long note that wraps across the selected paper rail width without losing information.',147),item('Second item',180)]};
 const before=fixed.items.map(i=>i.value),b=paperPanel(fixed,p,body,1);assert.ok(Math.abs(b.body.w-(1000-300-12))<1);assert.deepEqual(fixed.items.map(i=>i.value),before);assert.ok(fixed.items[1].y>180);
});

test('physical floor refines against final narrow and wrapped text boxes',()=>{
 for(const [value,w,h] of [['Port 24',60,18],['Port number 24',25,100],['Long wrapped caption text',25,100]]){
  const page=scene(),text=page.items.find(i=>i.editKey?.includes('|port|'));Object.assign(text,{value,w,h,size:18});const p=project(),required=readableModelScale(page,p,.1,1,new Set(page.items.filter(i=>i.pageHeading)));const resized={...text,w:text.w*required.factor,h:text.h*required.factor,size:text.size*required.factor};
  assert.ok(textLayout(resized).size*.75>=8-1e-6,`${value}: ${textLayout(resized).size*.75}pt`);
  fitVisiblePage(page,p);assert.ok(Math.abs(page.paperReadability.actualPt-textLayout(text).size*.75)<1e-6);assert.equal(page.pageOverflow,false);
 }
});
test('large deliberate saved transforms survive locks and reopen without automatic shrinking',()=>{
 for(const locked of [false,true]){
  const p=project({minimumTextPt:18,textScale:4});p.layout.pageSetup.visible.default.locked=locked;
  const first=scene();fitVisiblePage(first,p);assert.equal(first.pageOverflow,false);
  const kind=locked?'lockFrames':'editFrames',frame={...first.presentationFrame,scale:5};p.layout.pageSetup.visible[kind]={[first.name]:frame};
  const deliberate=scene();fitVisiblePage(deliberate,p);assert.equal(deliberate.presentationFrame.scale,5);assert.equal(deliberate.pageOverflow,true);
  p.layout.pageSetup=cleanPageSetup(JSON.parse(JSON.stringify(p.layout.pageSetup)));assert.deepEqual(p.layout.pageSetup.visible[kind][first.name],frame);
  const reopened=scene();fitVisiblePage(reopened,p);assert.equal(reopened.presentationFrame.scale,deliberate.presentationFrame.scale);
  for(const [index,item] of deliberate.items.entries())for(const key of ['x','y','w','h','size'])if(Number.isFinite(item[key]))assert.ok(Math.abs(item[key]-reopened.items[index][key])<1e-7);
 }
});
test('near-fit inventory pages reclaim outside whitespace without lowering readable text',async()=>{
 const {sampleSite}=await import('../src/web/sample.mjs'),{buildPages}=await import('../src/web/diagram/index.mjs');
 const p=sampleSite();p.layout={pageSetup:{visible:{default:{preset:'letter'}}}};
 const pages=buildPages(p).filter(page=>page.title==='Port Inventory');assert.equal(pages.length,1,'both switch tables share one sheet');
 for(const page of pages){assert.equal(page.pageOverflow,false);assert.ok(page.paperReadability.actualPt>=8-1e-6);}
 p.layout.pageSetup.visible.editFrames=Object.fromEntries(pages.map(page=>[page.name,page.presentationFrame]));
 for(const page of buildPages(JSON.parse(JSON.stringify(p))).filter(page=>page.title==='Port Inventory')){assert.equal(page.pageOverflow,false);assert.ok(page.paperReadability.actualPt>=8-1e-6);}
});

test('inventory dark title backing remains paper furniture behind white headings',async()=>{
 const {sampleSite}=await import('../src/web/sample.mjs'),{buildPages}=await import('../src/web/diagram/index.mjs');
 const p=sampleSite();p.layout={pageSetup:{visible:{default:{preset:'letter'}}}};
 const page=buildPages(p).find(page=>page.title==='Port Inventory'),banner=page.items.find(i=>i.pageFrame==='header-background');assert.ok(banner);
 for(const item of page.items.filter(i=>['project','title'].includes(i.pageHeading)||i.pageFrame==='brand')){assert.equal(item.color,'#FFFFFF');assert.ok(item.x>=banner.x&&item.x+item.w<=banner.x+banner.w+.01);assert.ok(item.y>=banner.y&&item.y+item.h<=banner.y+banner.h+.01);}
 assert.ok(banner.y+banner.h<page.items.find(i=>i.pageHeading==='subtitle').y);assert.equal(page.pageOverflow,false);
 p.layout.drawingEdits={[banner.editKey]:{fill:'#223344',x:48,w:800}};const edited=buildPages(p).find(page=>page.title==='Port Inventory'),backing=edited.items.find(i=>i.editKey===banner.editKey);assert.equal(backing.fill,'#223344');assert.equal(backing.x,banner.x+12);assert.equal(backing.w,800);
 assert.deepEqual(p.layout.drawingEdits[banner.editKey],{fill:'#223344',x:48,w:800});
});
