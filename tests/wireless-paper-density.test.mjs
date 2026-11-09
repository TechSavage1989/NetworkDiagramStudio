import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {cleanPageSetup,printGeometry} from '../src/web/page-options.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';

// Same geometry as a busy eight-member stack with all 32 AP uplinks on one
// member; fictional names, addresses and evidence only. Each AP has two leads.
export function denseWirelessPaper(preset='letter',fitMode='optimize',locked=false){
 const ports=Array.from({length:32},(_,i)=>({name:'7/'+(i+1)}));
 const sw={id:'sw',name:'LAB-STACK',kind:'switch',model:'JL558A',stackMembers:Array.from({length:8},(_,i)=>({id:String(i+1),model:'JL558A'})),ports};
 const aps=Array.from({length:16},(_,i)=>({id:'ap'+i,name:'LAB-AP-FLOOR-'+(i+1),kind:'ap',vendor:'HPE Aruba',model:'AP-515',ip:'192.0.2.'+(i+1),ports:[{name:'eth0'},{name:'eth1'}]}));
 return {name:'Wireless paper lab',devices:[sw,...aps],links:ports.map((p,i)=>({a:'sw',ap:p.name,b:'ap'+Math.floor(i/2),bp:'eth'+i%2,media:'copper',speed:'1 Gbps'})),layout:{pageSetup:{visible:{wirelessFit:'readable',default:{preset,orientation:'landscape',locked},fitMode}}}};
}
const wireless=site=>buildPages(site).filter(p=>p.wirelessLayout);
function checkPages(pages){
 assert.deepEqual(pages.flatMap(p=>p.wirelessLayout.links).sort((a,b)=>a-b),Array.from({length:32},(_,i)=>i));
 assert.equal(new Set(pages.flatMap(p=>p.items.filter(i=>i.kind==='ap').map(i=>i.sourceId))).size,16);
 for(const page of pages){
  const paper=printGeometry(page),points=.75*Math.min(paper.width/page.width,paper.height/page.height),bodies=page.items.filter(i=>i.type==='device'),paths=page.items.filter(i=>i.type==='path'),captions=page.items.filter(i=>i.wirelessCaption);
  assert.deepEqual(page.wirelessLayout.routingCost.slice(0,2),[0,0]);
  for(const [index,caption] of captions.entries()){
   assert.equal(textLayout(caption).size,caption.size,'complete captions retain their measured font');
   assert.ok(caption.size*points>=8,'printed AP details stay at least 8pt');
   assert.ok(!bodies.some(body=>intersects(caption,body)),'caption does not cover hardware');
   assert.ok(!captions.slice(index+1).some(other=>intersects(caption,other)),'captions do not overlap');
   assert.ok(!paths.some(path=>pathCrossesText(path,caption,1)),'cables do not cross captions');
  }
  for(const path of paths){
   for(const number of page.items.filter(i=>i.portNumberRole==='text'))assert.ok(!pathCrossesText(path,number,1));
   for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]]){assert.ok(Math.abs(point[0]-anchor.x)<1e-6);assert.ok(Math.abs(point[1]-anchor.y)<1e-6);}
   for(let i=1;i<path.points.length;i++)assert.ok(path.points[i][0]===path.points[i-1][0]||path.points[i][1]===path.points[i-1][1]);
  }
 }
}
test('Letter packs busy dual-port AP banks before repeating the switch on another sheet',()=>{
 const site=denseWirelessPaper(),saved=JSON.stringify(site),pages=wireless(site);
 assert.ok(pages.length<=4,'six sparse Letter sheets should compact to at most four readable sheets');
 checkPages(pages);assert.equal(JSON.stringify(site),saved);
 const reopened=wireless(JSON.parse(saved));assert.deepEqual(reopened.map(p=>p.svg),pages.map(p=>p.svg));
});
test('denser paper planning preserves locked Letter dimensions and dynamic/preserve options',()=>{
 const locked=wireless(denseWirelessPaper('letter','optimize',true));checkPages(locked);
 for(const page of locked){assert.ok(Math.abs(page.width-1056)<1e-6);assert.ok(Math.abs(page.height-816)<1e-6);}
 for(const [preset,mode] of [['dynamic','optimize'],['letter','preserve']]){
  const pages=wireless(denseWirelessPaper(preset,mode));assert.equal(pages.length,1);assert.equal(pages[0].wirelessLayout.memberIds.length,8);
 }
});

function sourceGeometry(page){
 return page.items.filter(i=>i.type==='device'||i.type==='path'||i.wirelessCaption).map(item=>{
  const {scale=1,x=0,y=0,fontScale=1}=item.presentation||{},out={key:item.editKey,type:item.type};
  for(const key of ['x','y','w','h'])if(Number.isFinite(item[key]))out[key]=(item[key]-(key==='x'?x:key==='y'?y:0))/scale;
  if(item.points)out.points=item.points.map(([px,py])=>[(px-x)/scale,(py-y)/scale]);
  if(item.size)out.size=item.size/fontScale;
  return out;
 });
}
function assertGeometry(actual,expected){
 assert.equal(actual.length,expected.length);
 for(let i=0;i<expected.length;i++){
  assert.equal(actual[i].key,expected[i].key);assert.equal(actual[i].type,expected[i].type);
  for(const key of ['x','y','w','h','size'])if(key in expected[i])assert.ok(Math.abs(actual[i][key]-expected[i][key])<1e-6,`${actual[i].key} ${key} changed`);
  if(expected[i].points){assert.equal(actual[i].points.length,expected[i].points.length);for(let j=0;j<expected[i].points.length;j++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(actual[i].points[j][axis]-expected[i].points[j][axis])<1e-6,'route changed');}
 }
}
test('default paper selection proportionally fits the whole dynamic wireless layout and saved edits',()=>{
 const site=denseWirelessPaper('dynamic');delete site.layout.pageSetup.visible.wirelessFit;
 const initial=wireless(site);assert.equal(initial.length,1);
 const body=initial[0].items.find(i=>i.kind==='ap');site.layout.drawingEdits={[body.editKey]:{x:body.x+4}};
 const dynamic=wireless(site),expected=sourceGeometry(dynamic[0]);
 for(const locked of [false,true]){
  site.layout.pageSetup.visible.default={preset:'letter',orientation:'landscape',locked};
  const saved=JSON.stringify(site),pages=wireless(site);assert.equal(pages.length,1);assert.equal(pages[0].wirelessLayout.memberIds.length,8);
  assertGeometry(sourceGeometry(pages[0]),expected);assert.equal(JSON.stringify(site),saved);
  assert.equal(printGeometry(pages[0]).width,1056);
  const reopened=wireless(JSON.parse(saved));assert.equal(reopened[0].svg,pages[0].svg);
  if(locked){
   const frozen=JSON.parse(saved);frozen.layout.pageSetup.visible.lockFrames={[pages[0].name]:pages[0].pageLockFrame};
   assert.equal(cleanPageSetup(frozen.layout.pageSetup).visible.wirelessFit,'layout');
   const recaptured=wireless(frozen)[0];assert.equal(recaptured.svg,pages[0].svg);assert.deepEqual(recaptured.pageLockFrame,pages[0].pageLockFrame);
   frozen.layout.drawingEdits[body.editKey].x+=100000;
   const overflow=wireless(frozen)[0];assert.equal(overflow.pageOverflow,true);assert.deepEqual(overflow.pageLockFrame,pages[0].pageLockFrame);assert.equal(overflow.width,pages[0].width);assert.equal(overflow.height,pages[0].height);
  }
 }
});
test('lock frames never change the selected wireless fit mode during normalization',()=>{
 const frame={scale:1,x:0,y:0,originX:0,originY:0,width:1056,height:816};
 assert.equal(cleanPageSetup({}).visible.wirelessFit,'layout');
 assert.equal(cleanPageSetup({visible:{lockFrames:{'Wireless Connections 1':frame}}}).visible.wirelessFit,'readable');
 assert.equal(cleanPageSetup({visible:{wirelessFit:'layout',lockFrames:{'Wireless Connections 1':frame}}}).visible.wirelessFit,'layout');
 assert.equal(cleanPageSetup({visible:{lockFrames:{'Core Network':frame}}}).visible.wirelessFit,'layout');
 assert.equal(cleanPageSetup({visible:{lockFrames:{'Wireless Connections':{...frame,wirelessFit:'layout'}}}}).visible.wirelessFit,'layout');
});

test('explicit continued wireless lock frames retain the frozen sheet geometry',()=>{
 const site=denseWirelessPaper('letter','optimize',true),before=wireless(site);
 site.layout.pageSetup.visible.lockFrames=Object.fromEntries(before.map(page=>[page.name,page.pageLockFrame]));
 const after=wireless(JSON.parse(JSON.stringify(site)));
 assert.deepEqual(after.map(page=>page.wirelessLayout.links),before.map(page=>page.wirelessLayout.links));
 for(let i=0;i<before.length;i++)assertGeometry(sourceGeometry(after[i]),sourceGeometry(before[i]));
});

test('unmarked legacy frozen continuations retain the original six-sheet plan across recapture',()=>{
 const site=denseWirelessPaper('letter','optimize',true);site._wirelessLegacyPaper=true;
 const before=wireless(site);assert.equal(before.length,6);
 site.layout.pageSetup.visible.lockFrames=Object.fromEntries(before.map(page=>{const {wirelessFit,...frame}=page.pageLockFrame;return [page.name,frame];}));
 delete site._wirelessLegacyPaper;delete site.layout.pageSetup.visible.wirelessFit;
 const saved=JSON.stringify(site),after=wireless(JSON.parse(saved));assert.equal(after.length,before.length);
 for(let i=0;i<before.length;i++){assertGeometry(sourceGeometry(after[i]),sourceGeometry(before[i]));assert.equal(after[i].pageLockFrame.wirelessFit,'readable-legacy');}
 site.layout.pageSetup.visible.lockFrames=Object.fromEntries(after.map(page=>[page.name,page.pageLockFrame]));
 const again=wireless(JSON.parse(JSON.stringify(site)));assert.deepEqual(again.map(page=>page.svg),after.map(page=>page.svg));
});
