import test from 'node:test';
import assert from 'node:assert/strict';
import {diagramContentKeys,textEditingTarget} from '../src/web/drawing-selection.mjs';
import {groupDrawingSelection} from '../src/web/drawing-groups.mjs';

test('select all includes whole devices, cables, captions and titles but excludes panel and frame',()=>{
 const device={type:'device',editKey:'core|device|switch',children:[{editKey:'core|device|switch|text'}]};
 const items=[device,{editKey:'core|path|link'},{editKey:'core|text|caption'},{editKey:'core|title',pageTitle:true},
  {editKey:'core|legend|line',panelGroup:true},{editKey:'core|info-panel|notes',panelGroup:true},
  {editKey:'core|device|module-legend-sfp',panelGroup:true,children:[{editKey:'core|module|text'}]},
  {editKey:'core|frame',pageFrame:'sidebar'},{type:'rect'}];
 const page={items},before=structuredClone(page);
 assert.deepEqual([...diagramContentKeys(page)],['core|device|switch','core|path|link','core|text|caption','core|title']);
 assert.deepEqual(page,before);assert.deepEqual([...diagramContentKeys(null)],[]);
});

test('selection does not expand mixed groups, change saved groups or include another page',()=>{
 const groups=groupDrawingSelection([],new Set(['core|device|a','core|info-panel|notes']),'mixed'),before=structuredClone(groups);
 const page={items:[{editKey:'core|device|a'},{editKey:'core|info-panel|notes',panelGroup:true}],drawingGroups:groups};
 assert.deepEqual([...diagramContentKeys(page)],['core|device|a']);assert.deepEqual(groups,before);
 assert.deepEqual([...diagramContentKeys({items:[{editKey:'other|device|b'}]})],['other|device|b']);
});

test('keyboard guard preserves native editable and inline-editor selection',()=>{
 assert.equal(textEditingTarget({isContentEditable:true}),true);
 for(const kind of ['input','textarea','select','contenteditable','inline']){
  assert.equal(textEditingTarget({closest(selector){assert.match(selector,/input,textarea,select/);assert.match(selector,/contenteditable/);assert.match(selector,/data-inline-editor/);return {kind};}}),true);
 }
 assert.equal(textEditingTarget({closest:()=>null}),false);assert.equal(textEditingTarget(null),false);
});

test('whole unlocked diagram scales both ways with undo/redo, saved groups, manual style and endpoint glue',async()=>{
 const {sampleSite}=await import('../src/web/sample.mjs'),{buildPages}=await import('../src/web/diagram/index.mjs');
 const {transformDrawingGroup}=await import('../src/web/drawing-groups.mjs'),{scaleDrawingItems}=await import('../src/web/drawing-edits.mjs'),{ProjectHistory}=await import('../src/web/history.mjs');
 for(const preset of ['dynamic','letter'])for(const factor of [.9,1.1])for(const control of ['handle','button']){
  let project=sampleSite();project.layout={pageSetup:{visible:{default:{preset,locked:false}}}};
  let page=buildPages(project)[0];const cable=page.items.find(i=>i.type==='path'&&i.from&&i.to);project.layout.drawingEdits={[cable.editKey]:{color:'#123456'}};
  page=buildPages(project)[0];const keys=diagramContentKeys(page);project.layout.drawingGroups=groupDrawingSelection([],keys,'whole');
  const before=structuredClone(project),history=new ProjectHistory(project),body=page.items.find(i=>i.type==='device'&&i.kind!=='plug'&&!i.panelGroup);
  const edits=control==='handle'?transformDrawingGroup(page,project.layout.drawingEdits,keys,{factor}):scaleDrawingItems(page,project.layout.drawingEdits,keys,factor);
  project={...project,layout:{...project.layout,drawingEdits:edits}};const after=structuredClone(project);history.record(project,'drawing');
  const rebuilt=buildPages(project)[0],changed=rebuilt.items.find(i=>i.editKey===body.editKey);
  assert.ok(factor<1?changed.w<body.w:changed.w>body.w);assert.ok(Math.abs(changed.w/changed.h-body.w/body.h)<1e-8);
  assert.equal(project.layout.pageSetup.visible.default.locked,false);assert.deepEqual(project.layout.drawingGroups,before.layout.drawingGroups);
  assert.equal(project.layout.drawingEdits[cable.editKey].color,'#123456');
  for(const line of rebuilt.items.filter(i=>i.type==='path'&&i.from&&i.to)){assert.deepEqual(line.points[0],[line.from.x,line.from.y]);assert.deepEqual(line.points.at(-1),[line.to.x,line.to.y]);}
  project=history.travel(project);assert.deepEqual(project,before);project=history.travel(project,{redo:true});assert.deepEqual(project,after);
  assert.deepEqual(buildPages(JSON.parse(JSON.stringify(project)))[0],rebuilt);
 }
});
