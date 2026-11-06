import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {placeCableLabels,textWidth} from '../src/web/diagram/labels.mjs';

test('on-page cable labels retain their original side preference and collision clearance',()=>{
 for(const side of ['left','right']){
  const page={items:[]},text='Port 49',width=textWidth(text,12,true),result=placeCableLabels(page,[{editKey:'label',value:text,role:'port',side,y:300,outer:1100,segment:[[400,300],[1000,300]]}]);
  assert.equal(result.ok,true);assert.equal(result.placed[0].x,side==='right'?411:989-width);assert.equal(result.placed[0].y,280);
  const first=page.items[0];const again=placeCableLabels(page,[{editKey:'second',value:text,role:'port',side,y:300,outer:1100,segment:[[400,300],[1000,300]]}]);
  assert.equal(again.ok,true);assert.ok(again.placed[0].x+width<=first.x-3||again.placed[0].x>=first.x+first.w+3||again.placed[0].y+16<=first.y-3||again.placed[0].y>=first.y+first.h+3);
 }
});

test('far-off edited anchors and title bounds cannot allocate an unbounded label search',()=>{
 const scene=new URL('../src/web/diagram/index.mjs',import.meta.url).href,sample=new URL('../src/web/sample.mjs',import.meta.url).href,labels=new URL('../src/web/diagram/labels.mjs',import.meta.url).href,edits=new URL('../src/web/drawing-edits.mjs',import.meta.url).href;
 const script=`
  import assert from 'node:assert/strict';
  import {buildPages} from ${JSON.stringify(scene)};
  import {sampleSite} from ${JSON.stringify(sample)};
  import {placeCableLabels,placeDeviceTitles} from ${JSON.stringify(labels)};
  import {cleanDrawingEdits} from ${JSON.stringify(edits)};
  const project=sampleSite(),page=buildPages(project)[0],device=page.items.find(i=>i.type==='device'&&i.sourceId==='edge'&&i.kind!=='plug'),socket=device.children.find(i=>i.anchorName==='x1');
  project.layout={drawingEdits:cleanDrawingEdits({[device.editKey]:{w:12000},[socket.editKey]:{x:12000}})};
  assert.equal(project.layout.drawingEdits[socket.editKey].x,12000);
  assert.ok(buildPages(project).length>0);
  const missing=placeCableLabels({legendLayout:'sidebar',items:[]},[{editKey:'off-page',value:'Port',role:'port',side:'left',outer:1e12,y:300,segment:[[1e12,300],[2e12,300]]}]);
  assert.equal(missing.ok,false);
  const title={type:'text',x:50,y:230,w:200,h:22,value:'LAB-TITLE',size:14,titleOwner:'lab'},titles={items:[title]};
  placeDeviceTitles(titles,{},new Map([['lab',{sourceId:'lab',x:40,y:280,w:1e12,h:50}]]));
  assert.equal(title.x,40);assert.equal(title.y,253);
  console.log('bounded-layout-completed');
 `;
 const result=spawnSync(process.execPath,['--max-old-space-size=96','--input-type=module','-e',script],{encoding:'utf8',timeout:5000,maxBuffer:65536,windowsHide:true});
 assert.equal(result.error,undefined,'Layout subprocess exceeded its time or output limit.');
 assert.equal(result.status,0,result.stderr.slice(-1500));assert.match(result.stdout,/bounded-layout-completed/);
});
