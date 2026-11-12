import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,printDocument} from '../src/web/diagram/index.mjs';
import {paperDimensions} from '../src/web/page-options.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {validateReportScene} from '../src/web/reports/scene.mjs';
import {adaptiveProject,adaptiveStack} from './fixtures/adaptive-port-maps.mjs';
const maps=site=>buildPages(site).filter(p=>p.portMap?.switchportSheet);
const panels=p=>p.items.filter(i=>i.reportPanel);
const numbers=p=>p.items.filter(i=>i.reportPortRole==='number');
const shape=p=>p.items.map(i=>[i.editKey,i.x,i.y,i.w,i.h,i.size,i.value]);

test('five/eight-member stacks use measured A4 and Letter layouts with every port and key',()=>{
 for(const members of [5,8])for(const preset of ['a4','letter'])for(const orientation of ['landscape','portrait']){
  const project=adaptiveProject(preset,orientation,members),pages=maps(project),page=pages[0];
  assert.equal(pages.length,1);assert.ok(page.adaptivePortMap,members+' '+preset+' '+orientation);
  const dimensions=paperDimensions({preset,orientation});
  assert.ok(Math.abs(page.width*25.4/96-dimensions.widthMm)<1e-6);
  assert.ok(Math.abs(page.height*25.4/96-dimensions.heightMm)<1e-6);
  assert.equal(panels(page).length,members);assert.equal(numbers(page).length,members*52);
  assert.ok(numbers(page).every(i=>i.size>=8));assert.deepEqual(validateReportScene(page),[]);
  assert.equal(page.items.filter(i=>i.reportKeyHeading==='vlans').length,1);
  assert.equal(new Set(numbers(page).map(i=>i.reportPort)).size,members*52);
  const rows=panels(page).sort((a,b)=>a.x-b.x||a.y-b.y);
  assert.deepEqual(rows.map(i=>i.reportGroup),Array.from({length:members},(_,i)=>'Member '+(i+1)));
  if(orientation==='landscape')assert.equal(page.adaptivePortMap.columns,1,'do not halve landscape members merely because the sheet is wide');
 }
});

test('adaptive pages substantially enlarge printed hardware over the previous wide canvas fit',()=>{
 const project=adaptiveProject('letter','landscape',8),page=maps(project)[0];
 const prior=structuredClone(project);prior.layout.pageSetup.visible.fitMode='preserve';
 const old=maps(prior)[0],physicalWidth=1056;
 const face=p=>p.items.find(i=>i.reportPortRole==='native');
 assert.ok(face(page).w*physicalWidth/page.width>face(old).w*physicalWidth/old.width*1.3);
 assert.equal(page.adaptivePortMap.keyPosition,'side');
});

test('individual override takes precedence across repeated workspace names and leaves peers alone',()=>{
 const project=adaptiveProject();project.devices.push(adaptiveStack(5));
 const original=maps(project);assert.equal(original.length,2);
 const name=original[1].name;project.layout.pageSetup.visible.pages={[name]:{preset:'letter',orientation:'portrait'}};
 const changed=maps(project);
 assert.equal(changed[1].name,name);assert.ok(Math.abs(changed[1].width/changed[1].height-8.5/11)<1e-8);
 assert.deepEqual(shape(changed[0]),shape(original[0]));
 const reopened=JSON.parse(JSON.stringify(project));reopened.layout=cleanLayout(reopened.layout,reopened.devices.map(d=>d.id));
 assert.deepEqual(shape(maps(reopened)[1]),shape(changed[1]));
});

test('independent print paper does not change geometry and manual edits retain the accepted adaptive base',()=>{
 const project=adaptiveProject(),page=maps(project)[0];
 project.layout.pageSetup.printPaper={preset:'a3',orientation:'portrait'};
 const printed=maps(project)[0];assert.deepEqual(shape(printed),shape(page));
 assert.ok(printDocument([printed]).includes('297.0000mm 420.0000mm'));
 const item=panels(page)[0];project.layout.drawingEdits={[item.editKey]:{x:100,y:140}};
 const edited=maps(project)[0];assert.ok(edited.adaptivePortMap,'first edit must not reset all unedited members');
 assert.equal(edited.items.find(i=>i.editKey===item.editKey).x,100);
 assert.equal(edited.items.find(i=>i.editKey===item.editKey).y,140);
 assert.deepEqual(shape(edited).filter(row=>row[0]!==item.editKey),shape(printed).filter(row=>row[0]!==item.editKey));
 const colored=adaptiveProject();colored.layout.drawingEdits={[item.editKey]:{fill:'#223344'}};
 const styled=maps(colored)[0];assert.ok(styled.adaptivePortMap);assert.equal(styled.items.find(i=>i.editKey===item.editKey).fill,'#223344');
});

test('every small and large paper choice retains all members without clipping',()=>{
 for(const preset of ['a5','a3','a2','legal','tabloid']){
  const page=maps(adaptiveProject(preset,'landscape',8))[0];
  assert.equal(numbers(page).length,416);assert.equal(panels(page).length,8);
  assert.ok(Math.abs(page.width/page.height-paperDimensions({preset,orientation:'landscape'}).ratio)<1e-8);
 }
});

test('semantic legend edits survive reflow without retargeting old incidental shape indexes',()=>{
 const project=adaptiveProject('letter','landscape',8),legacy=structuredClone(project);legacy.layout.pageSetup.visible.fitMode='preserve';
 const old=maps(legacy)[0],title=old.items.find(i=>i.reportKeyTitle===10);
 assert.ok(title);project.layout.drawingEdits={[title.editKey]:{value:'10  Custom lab management'}};
 const changed=maps(project)[0];
 assert.equal(changed.items.find(i=>i.reportKeyTitle===10).value,'10  Custom lab management');
 assert.equal(changed.items.filter(i=>i.editKey===title.editKey).length,1);
});

test('Auto-fit uses spare paper for larger chassis sockets with narrow safe gutters',async()=>{
 const {standardMapDevices}=await import('./fixtures/standard-port-maps.mjs');
 for(const preset of ['a5','letter','a4','a3','a2','legal','tabloid'])for(const orientation of ['landscape','portrait']){
  const project=adaptiveProject(preset,orientation);project.devices=[standardMapDevices()[0]];
  const page=maps(project)[0];
  // A5 portrait cannot hold two physical chassis columns at the readable
  // minimum; retain the complete proportional fallback instead of clipping.
  if(!(preset==='a5'&&orientation==='portrait'))assert.ok(page.adaptivePortMap,preset+' '+orientation);
  if(page.adaptivePortMap)assert.deepEqual(validateReportScene(page),[]);
  else assert.deepEqual(validateReportScene(page),['Text is below the readable report minimum.'],'retain the existing complete small-paper fallback');
  const faces=page.items.filter(i=>i.reportPortRole==='native');
  assert.equal(faces.length,96);assert.equal(panels(page).length,6);
  for(const face of faces){
   const copper=/RJ|copper/i.test(face.socketForm);
   assert.ok(Math.abs(face.h/face.w-(copper?23.2:16.2)/25.2)<1e-9);
   assert.ok(face.x>=12&&face.x+face.w<=page.width-12);
  }
  if(preset==='letter'&&orientation==='landscape')assert.ok(page.adaptivePortMap.socketWidth>30,'do not cap Auto-fit at the reference socket width');
 }
});

test('fresh locked port maps fill their paper without a second border or reference-size ceiling',()=>{
 const project=adaptiveProject('letter','landscape',5);project.layout.pageSetup.visible.groups.ports.locked=true;
 const page=maps(project)[0];assert.ok(page.pageLockFrame);
 assert.ok(page.adaptivePortMap.socketWidth>30);
 // The header band sits inside the 5 mm page margin on every edge.
 const inset=5*96/25.4,header=page.items[0];assert.ok(Math.abs(header.x-inset)<.5&&Math.abs(header.y-inset)<.5&&Math.abs(header.x+header.w-(page.width-inset))<.5,'header band inside the margin');
 assert.deepEqual(validateReportScene(page),[]);
 // The banks reach the 5 mm default page margin on both sides.
 const margin=5*96/25.4,extent=panels(page);assert.ok(Math.min(...extent.map(p=>p.x))<margin+5);assert.ok(Math.min(...extent.map(p=>p.x))>=margin-1e-6);
 assert.ok(Math.max(...extent.map(p=>p.x+p.w))>page.width-margin-5);
 assert.equal(page.pageLockFrame.portMapFit,1);
 project.layout.pageSetup.visible.lockFrames={[page.name]:page.pageLockFrame};
 const reopened=JSON.parse(JSON.stringify(project));reopened.layout=cleanLayout(reopened.layout,reopened.devices.map(d=>d.id));
 assert.deepEqual(shape(maps(reopened)[0]),shape(page));
});

test('saved legacy locked map frames retain their original reference base',()=>{
 const project=adaptiveProject('letter','landscape',5);project.layout.pageSetup.visible.groups.ports.locked=true;
 project.layout.pageSetup.visible.lockFrames={'Switchport reports|workspace|0':{scale:16/17,x:31.058823529411768,y:24,originX:0,originY:0,width:1056,height:816.0000000000001}};
 const page=maps(project)[0];assert.ok(page.adaptivePortMap.socketWidth<=30.001);
 assert.ok(Math.abs(page.items[0].x-31.058823529411768)<1e-8);assert.equal(page.items[0].y,24);
 assert.ok(!page.pageLockFrame.portMapFit,'do not reinterpret historical frozen layouts');
 assert.deepEqual(validateReportScene(page),[]);
});

test('adaptive port-map headers and dense banks keep the 5 mm page margin on every edge',()=>{
 for(const members of [5,8])for(const preset of ['letter','a4']){
  const page=maps(adaptiveProject(preset,'landscape',members))[0],header=page.items[0];
  const inset=5*96/25.4;assert.ok(Math.abs(header.x-inset)<.5&&Math.abs(header.y-inset)<.5&&Math.abs(header.x+header.w-(page.width-inset))<.5,'header band inside the margin');
  assert.ok(Math.abs(page.reportMargin-5*96/25.4)<1e-9);assert.deepEqual(validateReportScene(page),[]);
  assert.equal(numbers(page).length,members*52);
 }
});

test('general diagram text minimum does not refit an already measured native adaptive map',()=>{
 const project=adaptiveProject('letter','landscape',5),original=maps(project)[0];
 project.layout.presentation={defaults:{minimumTextPt:12}};
 const after=maps(project)[0];assert.deepEqual(shape(after),shape(original));
 assert.deepEqual(validateReportScene(after),[]);assert.equal(after.paperReadability.preserved,true);
 assert.equal(after.paperReadability.minimumPt,12);assert.ok(after.paperReadability.actualPt<12);
 assert.equal(numbers(after).length,260);
});
