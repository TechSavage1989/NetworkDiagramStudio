import test from 'node:test';
import assert from 'node:assert/strict';
import {scaleDrawingItems,drawingBounds} from '../src/web/drawing-edits.mjs';
import {dockInformationPanel} from '../src/web/diagram/information-panel.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {ProjectHistory} from '../src/web/history.mjs';

test('layout spacing preserves dimensions, persists mode and is undoable',()=>{
 const page={items:[{type:'rect',editKey:'a',x:100,y:100,w:80,h:40},{type:'rect',editKey:'b',x:300,y:200,w:80,h:40}]};
 const project={layout:cleanLayout({sizeMode:'spacing'},[])},history=new ProjectHistory(project);
 project.layout.drawingEdits=scaleDrawingItems(page,{},['a','b'],1.5,{mode:project.layout.sizeMode});history.record(project,'drawing');
 assert.deepEqual(project.layout.drawingEdits.a,{x:100,y:100});assert.deepEqual(project.layout.drawingEdits.b,{x:400,y:250});
 const reopened=cleanLayout(JSON.parse(JSON.stringify(project.layout)),[]);assert.equal(reopened.sizeMode,'spacing');assert.deepEqual(reopened.drawingEdits,project.layout.drawingEdits);
 const undone=history.travel(project),redone=history.travel(undone,{redo:true});assert.deepEqual({...redone.layout.drawingEdits},{...project.layout.drawingEdits});
 assert.throws(()=>scaleDrawingItems(page,{},['a'],1.1,{mode:'spacing'}),/at least two/);
 assert.equal(cleanLayout({sizeMode:'invalid'},[]).sizeMode,'models');
});
test('docked panel clears final rotated models and titles on each chosen side; free panels stay put',()=>{
 for(const position of ['left','right','top','free']){
  const panel={type:'rect',panelGroup:true,x:38,y:147,w:244,h:400,_panelTransform:{x:0,y:0,scale:1}},device={type:'device',x:100,y:200,w:400,h:100,angle:45,children:[]},title={type:'text',x:0,y:150,w:800,h:40,angle:0};
  const page={items:[panel,device,title]},project={layout:{presentation:{defaults:{panel:{position}}}}};
  dockInformationPanel(page,project);const b=drawingBounds(device);
  if(position==='right')assert.ok(panel.x>=Math.max(b.x+b.w,title.x+title.w)+26);
  if(position==='left')assert.ok(panel.x+panel.w<=Math.min(b.x,title.x)-26);
  if(position==='top')assert.ok(panel.y+panel.h<=Math.min(b.y,title.y)-26);
  if(position==='free')assert.deepEqual([panel.x,panel.y],[38,147]);
  const previous=[panel.x,panel.y];dockInformationPanel(page,project);assert.deepEqual([panel.x,panel.y],previous,'docking is idempotent');
 }
});
