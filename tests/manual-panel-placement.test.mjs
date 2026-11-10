import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCoreMoveOffsets,moveDrawingItems,placeDrawingDevices,drawingBounds} from '../src/web/drawing-edits.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {ProjectHistory} from '../src/web/history.mjs';
const body=(key,x,y,w=100,h=40)=>({type:'device',kind:'switch',key,sourceId:key,editKey:key,x,y,w,h,children:[],ports:{}});
const panel={type:'rect',panelGroup:true,editKey:'panel',x:20,y:100,w:150,h:90};
const page={legendLayout:'sidebar',sidebar:{divider:190},items:[body('a',250,250),body('b',450,350),panel]};
test('empty space below panel accepts exact grouped movement even across divider or page edge',()=>{
 for(const [dx,dy] of [[-220,0],[-500,50],[100,20]]){
  const requested=new Map([['a',[dx,dy]],['b',[dx,dy]],['label',[dx,dy]]]);assert.deepEqual(safeCoreMoveOffsets(page,requested),requested);
  const edits=moveDrawingItems(page,{},requested,{preventSidebarOverlap:true});assert.equal(edits.a.x,250+dx);assert.equal(edits.b.x-edits.a.x,200);
 }
});
test('actual occupied panel remains protected and all selected items translate together',()=>{
 const requested=new Map([['a',[-220,-130]],['b',[-220,-130]],['label',[-220,-130]]]),next=safeCoreMoveOffsets(page,requested);
 assert.notDeepEqual(next.get('a'),requested.get('a'));for(const value of next.values())assert.deepEqual(value,next.get('a'));
 const [dx,dy]=next.get('a');assert.ok(250+dx>=panel.x+panel.w+6||250+dx+100<=panel.x-6);assert.equal(dy,-130);
});
test('hidden/empty panels and decorative dividers never reserve an infinite column',()=>{
 const empty={...page,items:[page.items[0],{type:'rect',pageFrame:'sidebar',x:190,y:0,w:1,h:1000}]},requested=new Map([['a',[-240,-100]]]);
 assert.deepEqual(safeCoreMoveOffsets(empty,requested),requested);
});
test('selected panel moves with its group rather than blocking itself; rotated device footprints count',()=>{
 const selected=new Map([['a',[-220,-130]],['panel',[-220,-130]]]);assert.deepEqual(safeCoreMoveOffsets(page,selected),selected);
 const rotated={...page,items:[{...body('a',250,250),angle:Math.PI/2},panel]},requested=new Map([['a',[-220,-70]]]);
 assert.notDeepEqual(safeCoreMoveOffsets(rotated,requested),requested);
});
test('Place beside can use empty sidebar column without reserving it to page bottom',()=>{
 const p={...page,width:800,height:700,items:[body('a',550,250),body('b',250,250),panel]},edits=placeDrawingDevices(p,{},['a'],'b','left',20);
 assert.equal(edits.a.x,130);assert.equal(edits.a.y,250);
});
test('real sample move below key persists after rebuild, reopen and atomic undo/redo with cable glue',()=>{
 const project=sampleSite(),before=buildPages(project)[0],item=before.items.find(i=>i.sourceId==='sw-1'&&i.kind!=='plug'),key=item.editKey;
 const history=new ProjectHistory();history.reset(project);
 const next=structuredClone(project);next.layout={...next.layout,drawingEdits:moveDrawingItems(before,next.layout?.drawingEdits,new Map([[key,[38-item.x,30]]]),{preventSidebarOverlap:true})};
 history.record(next,'drawing');
 const verify=p=>{const rebuilt=buildPages(p)[0],moved=rebuilt.items.find(i=>i.editKey===key);assert.equal(moved.x,38);assert.equal(moved.y,item.y+30);
  for(const cable of rebuilt.items.filter(i=>i.type==='path'&&i.from&&i.to)){assert.deepEqual(cable.points[0],[cable.from.x,cable.from.y]);assert.deepEqual(cable.points.at(-1),[cable.to.x,cable.to.y]);}
 };
 verify(JSON.parse(JSON.stringify(next)));const undone=history.travel(next);assert.deepEqual(undone,project);verify(history.travel(undone,{redo:true}));
});
