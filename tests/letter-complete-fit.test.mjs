import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSite} from '../src/web/sample.mjs';
import {wirelessApLab} from './fixtures/wireless-ap-layout.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {contentBounds} from '../src/web/page-content-fit.mjs';
import {fitVisiblePage,cleanPageSetup,printGeometry} from '../src/web/page-options.mjs';

function contained(page){
 const b=contentBounds(page),x=page.originX||0,y=page.originY||0;
 assert.ok(b.x>=x-1e-5&&b.y>=y-1e-5&&b.x+b.w<=x+page.width+1e-5&&b.y+b.h<=y+page.height+1e-5,JSON.stringify({name:page.name,b,width:page.width,height:page.height}));
 assert.equal(page.pageOverflow,false);
 for(const item of page.items.filter(i=>i.type==='path'&&i.from&&i.to)){
  for(const [anchor,point] of [[item.from,item.points[0]],[item.to,item.points.at(-1)]]){
   assert.ok(Math.abs(anchor.x-point[0])<1e-7&&Math.abs(anchor.y-point[1])<1e-7,'uniform fit retains endpoint glue');
  }
 }
}
test('Letter and A4 paper contain dense core and wireless diagrams, locked or unlocked, with no lost data',()=>{
 for(const make of [sampleSite,()=>wirelessApLab(28,5)])for(const locked of [false,true])for(const orientation of ['landscape','portrait']){
  const p=make();p.layout={...p.layout,presentation:{defaults:{minimumTextPt:8}},pageSetup:{visible:{default:{preset:'letter',locked,orientation}}}};
  const pages=buildPages(p).filter(page=>page.coreDeviceIds||page.wirelessLayout);
  assert.ok(pages.length);for(const page of pages){contained(page);const physical=printGeometry(page);assert.ok(Math.abs(Math.min(physical.width,physical.height)-816)<.001);assert.ok(Math.abs(Math.max(physical.width,physical.height)-1056)<.001);}
  const wireless=pages.filter(page=>page.wirelessLayout);if(p.devices.length===29)assert.equal(wireless.reduce((n,page)=>n+page.items.filter(i=>i.kind==='ap').length,0),28);
  if(locked)p.layout.pageSetup.visible.lockFrames=Object.fromEntries(pages.map(page=>[page.name,page.pageLockFrame]));
  const reopened=buildPages(JSON.parse(JSON.stringify(p))).filter(page=>page.coreDeviceIds||page.wirelessLayout);assert.deepEqual(reopened.map(p=>p.svg),pages.map(p=>p.svg));
  p.layout.pageSetup.visible.default.preset='a4';delete p.layout.pageSetup.visible.lockFrames;for(const page of buildPages(p).filter(page=>page.coreDeviceIds||page.wirelessLayout))contained(page);
 }
});

test('unlocked adaptive sheets retain an identity frame for later manual off-page edits',()=>{
 const page={name:'Lab port map',adaptivePortMap:{},width:1056,height:816,items:[{type:'rect',x:10,y:10,w:100,h:100}]},project={layout:{pageSetup:{visible:{default:{preset:'letter'}}}}};
 fitVisiblePage(page,project);assert.equal(page.presentationFrame.portMapFit,1);assert.equal(page.presentationFrame.scale,1);
 project.layout.pageSetup.visible.editFrames={[page.name]:page.presentationFrame};project.layout.pageSetup=cleanPageSetup(JSON.parse(JSON.stringify(project.layout.pageSetup)));
 const moved={...page,items:[{type:'rect',x:1200,y:10,w:100,h:100}]};fitVisiblePage(moved,project);assert.equal(moved.items[0].x,1200);assert.equal(moved.pageOverflow,true);assert.equal(moved.presentationFrame.portMapFit,1);
});

test('wide multi-stack core fits Letter without dropping devices or changing cable glue',()=>{
 const stack=(id,members)=>({id,name:'LAB-'+id,kind:'switch',model:'JL558A',stackMembers:Array.from({length:members},(_,i)=>({id:String(i+1),model:'JL558A'})),ports:[{name:'1/49'},{name:'1/50'}]});
 for(const locked of [false,true]){
  const p={name:'Fictional dense core',devices:[stack('STACK-A',5),stack('STACK-B',8),{id:'edge',name:'LAB-FIREWALL',kind:'firewall',model:'FortiGate 120G',ports:[{name:'x1'},{name:'x2'}]}],links:[{a:'edge',ap:'x1',b:'STACK-A',bp:'1/49'},{a:'edge',ap:'x2',b:'STACK-B',bp:'1/49'},{a:'STACK-A',ap:'1/50',b:'STACK-B',bp:'1/50'}],layout:{pageSetup:{visible:{default:{preset:'letter',locked}}}}};
  const page=buildPages(p).find(page=>page.coreDeviceIds);contained(page);assert.equal(page.items.filter(i=>i.type==='device'&&['edge','STACK-A','STACK-B'].includes(i.sourceId)).length,3);
  assert.ok(page.paperReadability.actualPt<page.paperReadability.minimumPt,'dense Letter reports honest smaller print text');
 }
});
