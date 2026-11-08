import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sampleSite} from '../src/web/sample.mjs';
import {cleanSwitchportSettings} from '../src/web/reports/settings.mjs';
import {reportPaperChoices,reportPageGeometry,reportFileStem} from '../src/web/reports/paper.mjs';
import {reportRequest} from '../src/web/reports/model.mjs';
import {buildReportPackage} from '../src/web/reports/index.mjs';
import {browserReportPackage} from '../src/web/report-package.mjs';
import {exportPdf} from '../src/web/report-export.mjs';

const project=paper=>{
 const site=sampleSite();site.devices=site.devices.filter(device=>device.kind==='switch').slice(0,1);
 site.layout={switchport:{enabled:true,combined:true,deviceIds:site.devices.map(d=>d.id),paper}};
 return site;
};
const fake=async()=>new TextEncoder().encode('fictional report');
test('report paper is a separate, validated project setting with a backwards-compatible A4 default',()=>{
 assert.deepEqual(cleanSwitchportSettings().paper,{preset:'a4',orientation:'landscape'});
 assert.ok(reportPaperChoices.some(([id])=>id==='letter')&&reportPaperChoices.some(([id])=>id==='a4'));
 assert.deepEqual(cleanSwitchportSettings({paper:{preset:'unknown',orientation:'sideways'}}).paper,{preset:'a4',orientation:'landscape'});
 assert.deepEqual(cleanSwitchportSettings({paper:{preset:'letter',orientation:'portrait'}}).paper,{preset:'letter',orientation:'portrait'});
 assert.equal(reportFileStem({preset:'a4',orientation:'landscape'}),'a4');
 assert.equal(reportFileStem({preset:'letter',orientation:'portrait'}),'letter-portrait');
 const saved=JSON.parse(JSON.stringify(project({preset:'letter',orientation:'portrait'})));
 assert.deepEqual(reportRequest(saved).paper,{preset:'letter',orientation:'portrait'});
});
test('report paper geometry matches actual millimeters for both orientations',()=>{
 const check=(preset,orientation,w,h)=>{
  const paper=reportPageGeometry({preset,orientation});
  assert.ok(Math.abs(paper.widthMm-w)<.01&&Math.abs(paper.heightMm-h)<.01);
  assert.ok(Math.abs(paper.width*25.4/96-w)<.01&&Math.abs(paper.height*25.4/96-h)<.01);
 };
 check('a4','landscape',297,210);
 check('letter','landscape',279.4,215.9);
 check('letter','portrait',215.9,279.4);
 check('legal','landscape',355.6,215.9);
 check('tabloid','landscape',431.8,279.4);
 check('a3','landscape',420,297);
 check('a5','portrait',148,210);
 check('a2','landscape',594,420);
});
test('fixed report layouts use the selected paper and preserve source port inventory',()=>{
 for(const paper of [{preset:'a4',orientation:'landscape'},{preset:'letter',orientation:'landscape'},{preset:'a3',orientation:'landscape'}]){
  const p=project(paper),output=buildReportPackage(p),geometry=reportPageGeometry(paper),item=output.items[0];
  assert.ok(item.inventory.ports.length>0);
  assert.ok(item.pages.booklet.length,'A saved report booklet exists');
  for(const page of item.pages.booklet){
   assert.ok(Math.abs(page.width-geometry.width)<.01&&Math.abs(page.height-geometry.height)<.01);
   assert.equal(page.paper.preset,paper.preset);
   assert.equal(page.paper.orientation,paper.orientation);
  }
  for(const page of output.combined.pages){
   assert.ok(Math.abs(page.width-geometry.width)<.01&&Math.abs(page.height-geometry.height)<.01);
  }
  assert.ok(item.filenames.some(name=>name===reportFileStem(paper)+'-booklet.pdf'));
 }
});
test('browser reports name, validate and package the selected paper consistently',async()=>{
 const p=project({preset:'letter',orientation:'landscape'}),out=await browserReportPackage(p,{png:fake,pdf:fake}),stem='letter-landscape';
 assert.ok(out.items.length);
 const folder=out.items[0].directory+'/';
 assert.ok(out.parts[folder+stem+'-booklet.pdf']);
 assert.ok(out.parts[folder+'validation-report.txt'].includes('Paper: Letter landscape'));
 assert.ok(!out.parts[folder+'a4-booklet.pdf']);
 const manifest=JSON.parse(out.parts['workspace-export.json']);
 assert.equal(manifest.paper.preset,'letter');assert.equal(manifest.paperDescription,'Letter landscape');
 if(out.combinedErrors.length===0&&out.parts['workspace-'+stem+'-diagrams.pdf'])assert.ok(!out.parts['workspace-a4-diagrams.pdf']);
});
test('browser vector PDF uses exact Letter and A3 media boxes, not merely a print dialog setting',async()=>{
 const require=createRequire(import.meta.url);globalThis.jspdf=require('../src/web/vendor/jspdf.umd.min.js');
 try{
  for(const [paper,w,h] of [[{preset:'letter',orientation:'landscape'},792,612],[{preset:'a3',orientation:'landscape'},1190.551,841.89]]){
   const p=project(paper),page=buildReportPackage(p).items[0].pages.booklet[0],bytes=await exportPdf([page]),value=new TextDecoder('latin1').decode(bytes),box=/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(value);
   assert.ok(box,'PDF media box present');
   assert.ok(Math.abs(Number(box[1])-w)<.05, 'actual PDF width');
   assert.ok(Math.abs(Number(box[2])-h)<.05, 'actual PDF height');
  }
 }finally{delete globalThis.jspdf;}
});
