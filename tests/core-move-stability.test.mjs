import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {arrangeBoxes} from '../src/web/arrange.mjs';
import {drawingBounds,drawingObjects,moveDrawingItems} from '../src/web/drawing-edits.mjs';
import {ProjectHistory} from '../src/web/history.mjs';
import {cleanLayout} from '../src/web/layout.mjs';

function fixture(scale=1){
 const stacks=Array.from({length:4},(_,index)=>({id:'stack-'+index,name:'LAB-STACK-'+(index+1),kind:'switch',model:'JL558A',stackMembers:Array.from({length:5},(_,member)=>({id:String(member+1),model:'JL558A'})),ports:[{name:'1/49'},{name:'5/50'}]}));
 const firewall={id:'firewall',name:'LAB-FIREWALL',kind:'firewall',vendor:'Fortinet',model:'FortiGate 120G',ports:[{name:'port1',role:'wan',handoff:'Fictional ISP',gateway:'192.0.2.1',speed:'1 Gbps',media:'copper'},{name:'x1'}]};
 return {name:'Fictional compact move lab',devices:[firewall,...stacks],links:[{a:'firewall',ap:'x1',b:'stack-0',bp:'1/49',media:'DAC',speed:'10 Gbps'}],layout:{presentation:{defaults:{drawingScale:scale}}}};
}
const core=project=>buildPages(project).find(page=>page.coreDeviceIds);
const bodies=page=>page.items.filter(item=>item.type==='device'&&item.kind!=='plug'&&!item.sourceId?.startsWith('module-legend-')&&!item.sourceId?.startsWith('continuation-'));
const body=(page,id)=>bodies(page).find(item=>item.sourceId===id);
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-7,message+': '+actual+' / '+expected);
function moved(project,page,offsets){return {...project,layout:{...project.layout,drawingEdits:moveDrawingItems(page,project.layout?.drawingEdits,offsets)}};}
function unchangedOthers(before,after,offsets){
 assert.deepEqual(bodies(after).map(item=>item.editKey),bodies(before).map(item=>item.editKey));
 for(const old of bodies(before)){
  const next=after.items.find(item=>item.editKey===old.editKey),[dx,dy]=offsets.get(old.editKey)||[0,0];
  close(next.x,old.x+dx,old.sourceId+' x');close(next.y,old.y+dy,old.sourceId+' y');close(next.w,old.w,old.sourceId+' width');close(next.h,old.h,old.sourceId+' height');assert.deepEqual(next.ports,old.ports);
 }
 const hosts=new Map(after.items.filter(item=>item.type==='device').map(item=>[item.key,item]));
 for(const path of after.items.filter(item=>item.type==='path'))for(const [end,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]]){
  const host=hosts.get(end.device),port=host?.ports?.[end.port];assert.ok(port);close(point[0],host.x+port[0]*host.w,'Cable port x');close(point[1],host.y+port[1]*host.h,'Cable port y');
 }
}
function assertPins(page,edits,selected=new Set()){
 for(const item of bodies(page))assert.ok(Number.isFinite(edits[item.editKey]?.x)&&Number.isFinite(edits[item.editKey]?.y),'Visible core body is pinned: '+item.sourceId);
 for(const item of page.items.filter(item=>item.type==='device'&&(item.kind==='plug'||item.sourceId?.startsWith('module-legend-')||item.sourceId?.startsWith('continuation-'))))if(!selected.has(item.editKey))assert.equal(edits[item.editKey],undefined,'Unselected optic or legend must follow its normal owner.');
}

test('the first drag preserves an automatic core grid through scaled reopen and one-step undo',async t=>{
 for(const scale of [1,1.6])await t.test('drawing scale '+scale,()=>{
  const project=fixture(scale),page=core(project),selected=body(page,'stack-0'),offsets=new Map([[selected.editKey,[12,0]]]),history=new ProjectHistory(project),before=JSON.stringify(project),gesture=JSON.stringify([...offsets]);
  assert.ok(new Set(bodies(page).filter(item=>item.kind==='switch').map(item=>item.x)).size>1,'The fixture must start in multiple automatic columns.');
  const next=moved(project,page,offsets),after=core(next);unchangedOthers(page,after,offsets);assertPins(page,next.layout.drawingEdits);assert.equal(JSON.stringify(project),before);assert.equal(JSON.stringify([...offsets]),gesture);
  for(const item of bodies(page))close(next.layout.drawingEdits[item.editKey].x,(item.x+(offsets.get(item.editKey)?.[0]||0))/scale,'Saved positions use inverse presentation');
  const reopened=JSON.parse(JSON.stringify(next));reopened.layout=cleanLayout(reopened.layout,reopened.devices.map(device=>device.id));unchangedOthers(page,core(reopened),offsets);
  assert.equal(history.record(next,'drawing'),true);const undone=history.travel(next,{scope:'drawing'});assert.equal(core(undone).svg,page.svg);assert.equal(history.canUndo(),false);
  const redone=history.travel(undone,{scope:'drawing',redo:true});assert.equal(core(redone).svg,after.svg);
 });
});

test('nudging, grouping and alignment move only the explicitly selected core bodies',()=>{
 const project=fixture(),page=core(project),stack0=body(page,'stack-0'),stack2=body(page,'stack-2'),stack3=body(page,'stack-3');
 for(const offsets of [new Map([[stack3.editKey,[0,1]]]),new Map([[stack0.editKey,[12,0]],[stack2.editKey,[12,0]]]),arrangeBoxes([stack2,stack3].map(drawingBounds),'right')]){
  const next=moved(project,page,offsets);unchangedOthers(page,core(next),offsets);assertPins(page,next.layout.drawingEdits);
 }
});

test('generated WAN handoffs follow their firewall unless moved on their own',()=>{
 const project=fixture(),page=core(project),firewall=body(page,'firewall'),handoff=bodies(page).find(item=>item.kind==='handoff');assert.ok(handoff);
 // Moving the firewall carries its WAN card, so the card stays above it.
 for(const offsets of [new Map([[firewall.editKey,[12,0]]]),new Map([[firewall.editKey,[12,0]],[handoff.editKey,[12,0]]])]){
  const next=moved(project,page,offsets);unchangedOthers(page,core(next),new Map([[firewall.editKey,[12,0]],[handoff.editKey,[12,0]]]));assertPins(page,next.layout.drawingEdits);
 }
 // The card can still be moved by itself; the firewall and the rest stay put.
 const alone=new Map([[handoff.editKey,[-40,0]]]),next=moved(project,page,alone);unchangedOthers(page,core(next),alone);assertPins(page,next.layout.drawingEdits);
});

test('independent panel-detail movement does not reflow or suppress the selected detail',()=>{
 const project=fixture(),page=core(project),host=body(page,'stack-0'),detail=drawingObjects(page).find(item=>item.parent?.editKey===host.editKey&&item.type==='rect'&&!item.anchorName),offsets=new Map([[detail.editKey,[2,0]]]);
 const next=moved(project,page,offsets),after=core(next);unchangedOthers(page,after,new Map());assertPins(page,next.layout.drawingEdits);
 const changed=drawingObjects(after).find(item=>item.editKey===detail.editKey);close(changed.x,detail.x+2/host.w,'Selected child keeps its independent movement');
});

test('text, cable and non-core body edits do not gain incidental core position patches',()=>{
 const project=fixture(),pages=buildPages(project),page=pages.find(page=>page.coreDeviceIds),text=page.items.find(item=>item.titleOwner),cable=page.items.find(item=>item.type==='path');
 for(const item of [text,cable])assert.deepEqual(Object.keys(moveDrawingItems(page,{},new Map([[item.editKey,[2,0]]]))),[item.editKey]);
 const inventory=pages.find(page=>page.portMap),item=inventory.items.find(item=>item.type==='device');assert.deepEqual(Object.keys(moveDrawingItems(inventory,{},new Map([[item.editKey,[2,0]]]))),[item.editKey]);
});
