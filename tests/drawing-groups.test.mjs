import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanLayout} from '../src/web/layout.mjs';
import {groupDrawingSelection,ungroupDrawingSelection,expandDrawingGroups,transformDrawingGroup} from '../src/web/drawing-groups.mjs';
import {ProjectHistory} from '../src/web/history.mjs';
const device=(id,x)=>({type:'device',editKey:'core|device|'+id,key:id,sourceId:id,x,y:100,w:100,h:40,children:[],ports:{a:[.5,.5]}});
const a=device('a',100),b=device('b',300),other=device('other',600),page={items:[a,b,other],coreDeviceIds:['a','b','other']},keys=new Set([a.editKey,b.editKey]);
test('groups persist stable membership without copying or repositioning objects',()=>{
 const groups=groupDrawingSelection([],keys,'g');const layout=cleanLayout(JSON.parse(JSON.stringify({drawingGroups:groups})),['a','b']);
 assert.deepEqual(layout.drawingGroups,groups);assert.deepEqual(expandDrawingGroups(groups,[a.editKey]),keys);assert.deepEqual(ungroupDrawingSelection(groups,new Set([a.editKey])),[]);
 assert.equal(page.items[0].x,100);
});
test('group scale uses shared center and pins untouched neighbors',()=>{
 const edits=transformDrawingGroup(page,{},keys,{factor:2});
 assert.equal(edits[a.editKey].x,-50);assert.equal(edits[b.editKey].x,350);assert.equal(edits[a.editKey].w,200);assert.equal(edits[a.editKey].y,80);assert.equal(edits[other.editKey].x,600);
});
test('group quarter-turn retains native dimensions and rotates centers together',()=>{
 const edits=transformDrawingGroup(page,{},keys,{angle:Math.PI/2});
 assert.ok(Math.abs(edits[a.editKey].x-200)<1e-8);assert.ok(Math.abs(edits[a.editKey].y-200)<1e-8);
 assert.ok(Math.abs(edits[b.editKey].x-200)<1e-8);assert.ok(Math.abs(edits[b.editKey].y)<1e-8);assert.equal(edits[a.editKey].w,100);assert.equal(edits[a.editKey].angle,Math.PI/2);
 assert.deepEqual(a.ports,{a:[.5,.5]});
});
test('group transforms reroute saved attached bends instead of detaching sockets',()=>{
 const cable={type:'path',editKey:'core|path|link',points:[[150,120],[350,120]],from:{device:'a'},to:{device:'b'}};
 const edits=transformDrawingGroup({...page,items:[...page.items,cable]},{[cable.editKey]:{points:cable.points,color:'#112233'}},keys,{angle:Math.PI/2});
 assert.equal(edits[cable.editKey].points,undefined);assert.equal(edits[cable.editKey].color,'#112233');
});
test('group membership and one shared transform survive atomic undo and redo',()=>{
 let state={layout:{drawingGroups:[],drawingEdits:{}}};const history=new ProjectHistory(state);
 state={layout:{drawingGroups:groupDrawingSelection([],keys,'g'),drawingEdits:{}}};history.record(state,'group');
 state={layout:{...state.layout,drawingEdits:transformDrawingGroup(page,{},keys,{factor:1.2,angle:Math.PI/6})}};history.record(state,'transform');
 state=history.travel(state);assert.deepEqual(state.layout.drawingEdits,{});assert.equal(state.layout.drawingGroups.length,1);
 state=history.travel(state);assert.equal(state.layout.drawingGroups.length,0);
 state=history.travel(state,{redo:true});state=history.travel(state,{redo:true});assert.equal(state.layout.drawingEdits[a.editKey].w,120);assert.equal(state.layout.drawingGroups.length,1);
});
test('reopened grouped devices retain socket glue and native local artwork',async()=>{
 const {buildPages}=await import('../src/web/diagram/index.mjs');const {devicePoint}=await import('../src/web/diagram/device-geometry.mjs');
 const project={name:'Group lab',devices:['a','b'].map(id=>({id,name:'LAB-'+id,kind:'switch',model:'JL558A',ports:[{name:'1',state:'up'}]})),links:[{a:'a',ap:'1',b:'b',bp:'1',media:'copper'}]};
 const base=buildPages(project).find(p=>p.coreDeviceIds),bodies=base.items.filter(i=>i.type==='device');
 project.layout={drawingEdits:Object.fromEntries(bodies.map((g,n)=>[g.editKey,{x:700+n*1200,y:500+n*900}]))};
 const before=buildPages(project).find(p=>p.coreDeviceIds),selected=new Set(before.items.filter(i=>i.type==='device').map(i=>i.editKey));
 project.layout.drawingGroups=groupDrawingSelection([],selected,'physical-pair');project.layout.drawingEdits=transformDrawingGroup(before,project.layout.drawingEdits,selected,{angle:.2,factor:1.1});
 const after=buildPages(JSON.parse(JSON.stringify(project))).find(p=>p.coreDeviceIds);
 for(const cable of after.items.filter(i=>i.type==='path'&&i.from&&i.to))for(const [end,point] of [[cable.from,cable.points[0]],[cable.to,cable.points.at(-1)]]){const body=after.items.find(i=>i.type==='device'&&i.key===end.device),socket=devicePoint(body,...body.ports[end.port]);assert.ok(Math.hypot(point[0]-socket[0],point[1]-socket[1])<1e-7);assert.ok(body.children.length);}
 assert.equal(project.layout.drawingGroups.length,1);
});
test('occupied panel clamps a grouped translation together, never rearranging members',async()=>{
 const {moveDrawingItems}=await import('../src/web/drawing-edits.mjs');
 const edits=moveDrawingItems({...page,items:[...page.items,{type:'rect',panelGroup:true,x:0,y:80,w:64,h:80}],legendLayout:'sidebar',sidebar:{divider:50}},{},new Map([...keys].map(k=>[k,[-100,0]])),{preventSidebarOverlap:true});
 assert.equal(edits[a.editKey].x,70);assert.equal(edits[b.editKey].x,270);
});
test('grouped chassis and attached optics transform once inside a locked top-panel page',async()=>{
 const {buildPages}=await import('../src/web/diagram/index.mjs'),{sampleSite}=await import('../src/web/sample.mjs');
 const project=sampleSite();project.layout={pageSetup:{visible:{default:{preset:'a3',locked:true}}},presentation:{defaults:{panel:{position:'top'}}}};
 const pages=buildPages(project),before=pages[0];project.layout.pageSetup.visible.lockFrames=Object.fromEntries(pages.filter(p=>p.pageLockFrame).map(p=>[p.name,p.pageLockFrame]));
 const selected=before.items.filter(i=>i.type==='device'&&['sw-1','sw-2'].includes(i.sourceId)),bodies=selected.filter(i=>i.kind!=='plug');
 const edits=transformDrawingGroup(before,{},new Set(selected.map(i=>i.editKey)),{factor:.9}),bodyEdits=transformDrawingGroup(before,{},new Set(bodies.map(i=>i.editKey)),{factor:.9});
 assert.deepEqual(edits,bodyEdits,'box-selecting attached plugs must not resize or pin them separately');
 project.layout.drawingEdits=edits;const next=buildPages(JSON.parse(JSON.stringify(project)))[0];assert.deepEqual([next.width,next.height],[before.width,before.height]);
 assert.equal(next.items.filter(i=>i.kind==='plug'&&!i.host).length,before.items.filter(i=>i.kind==='plug'&&!i.host).length);
 for(const cable of next.items.filter(i=>i.type==='path'&&i.from&&i.to)){assert.deepEqual(cable.points[0],[cable.from.x,cable.from.y]);assert.deepEqual(cable.points.at(-1),[cable.to.x,cable.to.y]);}
});

test('one chassis grouped with its optic remains resizable without separate optic edits',()=>{
 const optic={...device('optic',110),kind:'plug',host:{device:a.key,port:'a'}};
 const edits=transformDrawingGroup({...page,items:[...page.items,optic]}, {},new Set([a.editKey,optic.editKey]),{factor:.9});
 assert.equal(edits[a.editKey].w,90);assert.equal(edits[optic.editKey],undefined);
});
