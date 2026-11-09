import {crossesText} from '../src/web/diagram/labels.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {placeBeside} from '../src/web/arrange.mjs';
import {scaleDrawingItems,placeDrawingDevices,moveDrawingItems} from '../src/web/drawing-edits.mjs';
import {mdfLookalike} from './fixtures/mdf-lookalike.mjs';
import {physicalLink} from '../src/web/physical-links.mjs';
import {mergeModels} from '../src/web/imports/model.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';

test('placement supports every side, keeps group offsets and clears other equipment',()=>{
 const boxes=[{key:'a',x:0,y:0,w:100,h:40},{key:'b',x:0,y:70,w:100,h:40}],target={x:300,y:300,w:200,h:100};
 for(const side of ['left','right','above','below']){
  const offsets=placeBeside(boxes,target,side,[],80),[dx,dy]=offsets.get('a');assert.deepEqual(offsets.get('b'),[dx,dy]);
  assert.equal(side==='left'?target.x-(dx+100):side==='right'?dx-(target.x+target.w):side==='above'?target.y-(dy+110):dy-(target.y+target.h),80);
 }
 const [x,y]=placeBeside(boxes,target,'right',[{x:580,y:295,w:100,h:110}],80).get('a');assert.equal(x,704);assert.equal(y,295,'a small outward adjustment is closer than a sideways jump');
});
test('placement stays near the reference even with tall obstacles and sparse selections',()=>{
 const boxes=[{key:'a',x:0,y:0,w:100,h:100}],target={x:300,y:300,w:200,h:100};
 const [dx,dy]=placeBeside(boxes,target,'right',[{x:590,y:-10000,w:20,h:20000}],80).get('a');
 assert.equal(dx,634);assert.equal(dy,300,'a tall obstacle must not send the device thousands of units vertically');
 const group=[{key:'a',x:0,y:0,w:100,h:40},{key:'b',x:0,y:200,w:100,h:40}],gapObstacle={x:580,y:300,w:100,h:40};
 const sparse=placeBeside(group,target,'right',[gapObstacle],80);assert.deepEqual(sparse.get('a'),[580,230]);assert.deepEqual(sparse.get('a'),sparse.get('b'),'empty selection space does not need to move away from equipment');
 assert.throws(()=>placeBeside(boxes,target,'below',[{x:-1000,y:450,w:4000,h:5000}],56),/no nearby clear position/,'blocked placement must not teleport the device');
});
test('placement pins every other device and generated handoff at each drawing scale',()=>{
 for(const drawingScale of [.5,1,1.5])for(const movingId of ['sw-1','edge']){
  const project=sampleSite();project.layout={presentation:{defaults:{drawingScale}}};
  const page=buildPages(project)[0],devices=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),moving=devices.find(i=>i.sourceId===movingId),reference=devices.find(i=>i.sourceId==='sw-2'),cards=devices.filter(i=>i.kind==='handoff'&&i.ownerKey===moving.editKey);
  project.layout.drawingEdits=placeDrawingDevices(page,{},[moving.editKey],reference.editKey,'right','compact');
  const rebuilt=buildPages(JSON.parse(JSON.stringify(project)))[0],next=rebuilt.items.find(i=>i.editKey===moving.editKey),ref=rebuilt.items.find(i=>i.editKey===reference.editKey);
  // The moved device and its own WAN cards form one group; the reference
  // spacing is measured from the group's nearest edge.
  const group=[next,...cards.map(c=>rebuilt.items.find(i=>i.editKey===c.editKey))],left=Math.min(...group.map(i=>i.x));
  assert.ok(Math.abs(left-ref.x-ref.w-56*drawingScale)<.001);
  if(movingId==='edge')assert.ok(cards.length,'the sample firewall has WAN cards');
  for(const card of cards){const actual=rebuilt.items.find(i=>i.editKey===card.editKey);assert.ok(Math.abs(actual.x-card.x-(next.x-moving.x))<.001&&Math.abs(actual.y-card.y-(next.y-moving.y))<.001,card.name+' follows its firewall');assert.ok(actual.y+actual.h<=next.y,card.name+' stays above its firewall');}
  for(const other of devices.filter(i=>i!==moving&&!cards.includes(i))){
   const actual=rebuilt.items.find(i=>i.editKey===other.editKey);assert.ok(actual,other.editKey);
   for(const key of ['x','y','w','h'])assert.ok(Math.abs(actual[key]-other[key])<.001,other.name+' '+key+' must stay fixed');
  }
  for(const cable of rebuilt.items.filter(i=>i.type==='path')){assert.deepEqual(cable.points[0],[cable.from.x,cable.from.y]);assert.deepEqual(cable.points.at(-1),[cable.to.x,cable.to.y]);}
 }
});
test('quick scaling respects page transforms and native child selection, preserving cable glue after reopen',()=>{
 const project=sampleSite();project.layout={presentation:{defaults:{drawingScale:1.5}}};const page=buildPages(project)[0],device=page.items.find(i=>i.sourceId==='sw-1'&&i.type==='device');
 project.layout.drawingEdits=scaleDrawingItems(page,{},[device.editKey,device.children[0].editKey],.75);
 assert.ok(Object.keys(project.layout.drawingEdits).length>1,'model sizing pins visible core positions');
 assert.equal(project.layout.drawingEdits[device.children[0].editKey],undefined,'selected child is not resized twice');
 const rebuilt=buildPages(JSON.parse(JSON.stringify(project)))[0],actual=rebuilt.items.find(i=>i.editKey===device.editKey);assert.equal(actual.w,device.w*.75);assert.equal(actual.h,device.h*.75);
 for(const before of page.items.filter(i=>i.type==='device'&&i.kind!=='plug'&&!i.panelGroup)){const after=rebuilt.items.find(i=>i.editKey===before.editKey);assert.equal(after.x,before.x);assert.equal(after.y,before.y);}
 const cables=rebuilt.items.filter(i=>i.type==='path');
 for(const cable of cables)for(const [end,point] of [[cable.from,cable.points[0]],[cable.to,cable.points.at(-1)]]){
  assert.deepEqual(point,[end.x,end.y]);const owner=rebuilt.items.find(item=>item.key===end.device),port=owner.ports[end.port];
  assert.ok(Math.abs(point[0]-owner.x-port[0]*owner.w)<.001);assert.ok(Math.abs(point[1]-owner.y-port[1]*owner.h)<.001);
 }
 const widths=[...rebuilt.svg.matchAll(/class="diagram-cable"[^>]*stroke-width="([\d.]+)"/g)].map(match=>Number(match[1]));assert.deepEqual(widths,cables.map(cable=>cable.weight));
 assert.doesNotMatch(rebuilt.svg,/cable-hit-target|cable-proximity-halo|cable-hover|data-editor-only|vector-effect="non-scaling-stroke"/);
});
test('logical adjacency stays available without conflicting with or duplicating physical cables',()=>{
 const devices=['a','b'].map(id=>({id,name:'LAB-'+id,kind:'switch',model:'JL558A',ports:[{name:'1/50'},{name:'VLAN20',type:'logical'},{name:'uplink-vlan',parent:'1/50'},{name:'Trk1',type:'aggregate'}]}));
 const links=[{a:'a',ap:'1/50',b:'b',bp:'1/50',media:'fiber'},...['VLAN20','uplink-vlan','Trk1'].map(ap=>({a:'a',ap,b:'b',bp:'1/50'}))];
 const merged=mergeModels([{devices,links}]);assert.equal(merged.links.length,4);assert.notEqual(merged.links[0].status,'conflict');assert.ok(!merged.warnings.some(w=>w.includes('multiple reported peers')));
 const core=buildPages(merged).filter(p=>p.coreDeviceIds);assert.equal(core.length,1);assert.equal(core[0].items.filter(i=>i.type==='path').length,1);
 assert.equal(physicalLink({a:'a',ap:'unmapped',b:'b',bp:'1/50'},devices),true,'unknown physical names retain boundary anchors');
 const conflict=mergeModels([{devices,links:[links[0],{a:'a',ap:'1/49',b:'b',bp:'1/50'}]}]);assert.ok(conflict.links.every(l=>l.status==='conflict'),'genuine conflicting physical peers remain visible');
});
test('stack uplinks with logical observations have separate orthogonal routes and real port anchors',()=>{
 const chassis={id:'c',name:'LAB-CHASSIS',kind:'switch',model:'J9850A',modules:['A','C','E','F'].map(slot=>({slot,model:'J9993A'})),ports:[]};
 const stacks=[5,8].map((count,i)=>({id:'s'+i,name:'LAB-STACK-'+i,kind:'switch',model:'JL558A',stackMembers:Array.from({length:count},(_,j)=>({id:String(j+1),model:'JL558A'})),ports:[]}));
 const links=[];for(const [i,stack] of stacks.entries())for(let j=1;j<=4;j++){const ap=j+'/50',bp=['A','C','E','F'][j-1]+(i+3);links.push({a:stack.id,ap,b:'c',bp,media:'fiber',speed:'10 Gbps'},{a:stack.id,ap:'VLAN20',b:'c',bp});stack.ports.push({name:ap});chassis.ports.push({name:bp});}
 const project={devices:[chassis,...stacks],links},page=buildPages(project)[0],paths=page.items.filter(i=>i.type==='path'),segments=[];assert.equal(paths.length,8);
 for(const path of paths){assert.doesNotMatch(path.from.port,/uplink\./);assert.doesNotMatch(path.to.port,/uplink\./);for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],h=a[1]===b[1];assert.ok(h||a[0]===b[0]);const axis=a[h?1:0],lo=Math.min(a[h?0:1],b[h?0:1]),hi=Math.max(a[h?0:1],b[h?0:1]);
  for(const s of segments)if(s.path!==path&&s.h===h&&Math.abs(s.axis-axis)<4)assert.ok(Math.min(s.hi,hi)<=Math.max(s.lo,lo)+.001,'parallel cables must stay apart');segments.push({path,h,axis,lo,hi});
 }}
});
test('generated handoffs cannot reuse a retained physical observation index after logical filtering',()=>{
 const project={devices:[{id:'f',name:'LAB-EDGE',kind:'firewall',model:'FortiGate 120G',ports:[{name:'port1',role:'wan',gateway:'192.0.2.1'},{name:'port2'}]},{id:'s',name:'LAB-SW',kind:'switch',model:'JL558A',ports:[{name:'1/50'}]}],links:[{a:'f',ap:'VLAN20',b:'s',bp:'1/50'},{a:'f',ap:'port2',b:'s',bp:'1/50'}]};
 const page=buildPages(project)[0],paths=page.items.filter(i=>i.type==='path');assert.equal(paths.length,2);assert.equal(new Set(paths.map(p=>[p.from.device,p.from.port,p.to.device,p.to.port].join('|'))).size,2);
 const physical=paths.find(p=>p.sourceLink.a==='f');assert.equal(physical.from.port,'port2');assert.equal(physical.to.port,'1/50');assert.deepEqual(physical.points[0],[physical.from.x,physical.from.y]);assert.deepEqual(physical.points.at(-1),[physical.to.x,physical.to.y]);
});

test('a middle chassis jack exits through the gap between lower jacks',()=>{
 const chassis={id:'c',name:'LAB-CHASSIS',kind:'switch',model:'J9850A',
  modules:['C','E'].map(slot=>({slot,model:'J9993A'})),ports:[{name:'C6'}]};
 const peer={id:'s',name:'LAB-SWITCH',kind:'switch',model:'JL558A',ports:[{name:'1/50'}]};
 const page=buildPages({devices:[chassis,peer],links:[{a:'c',ap:'C6',b:'s',bp:'1/50',media:'fiber'}]})[0];
 const device=page.items.find(item=>item.kind==='switch'&&item.sourceId==='c');
 const cable=page.items.find(item=>item.type==='path');
 const socket=device.children.find(child=>child.anchorName==='E6');
 assert.ok(socket);
 assert.ok(!crossesText(cable.points,{x:device.x+socket.x*device.w,y:device.y+socket.y*device.h,w:socket.w*device.w,h:socket.h*device.h},2));
});

// Fictional firewall with several WAN/ISP handoffs, a switch and a server room.
function wanSite(){
 const project=mdfLookalike();project.layout||={};const page=buildPages(project).find(p=>p.coreDeviceIds),devices=page.items.filter(i=>i.type==='device'&&i.kind!=='plug');
 const cards=devices.filter(i=>i.kind==='handoff'&&i.ownerKey),owner=devices.find(i=>i.editKey===cards[0]?.ownerKey);
 return {project,page,devices,cards:cards.filter(c=>c.ownerKey===owner.editKey),owner};
}
const rebuild=project=>buildPages(JSON.parse(JSON.stringify(project))).find(p=>p.coreDeviceIds);
const at=(page,key)=>page.items.find(i=>i.editKey===key);
test('WAN cards sit above their firewall and follow it when it is moved, nudged or moved again',()=>{
 const {project,page,cards,owner}=wanSite();assert.ok(cards.length>=2,'the fixture firewall has several WAN cards');
 for(const card of cards)assert.ok(card.y+card.h<=owner.y,card.name+' starts above its firewall');
 project.layout.drawingEdits=moveDrawingItems(page,project.layout.drawingEdits,new Map([[owner.editKey,[0,-900]]]));
 let next=rebuild(project);const moved=at(next,owner.editKey);assert.ok(Math.abs(moved.y-(owner.y-900))<.001);
 for(const card of cards){const actual=at(next,card.editKey);assert.ok(Math.abs(actual.x-card.x)<.001&&Math.abs(actual.y-(card.y-900))<.001,card.name+' moves with its firewall');}
 // A card moved on its own keeps that offset from its firewall afterwards.
 const lone=cards[0];project.layout.drawingEdits=moveDrawingItems(next,project.layout.drawingEdits,new Map([[lone.editKey,[-400,0]]]));next=rebuild(project);
 const before=at(next,lone.editKey);assert.ok(Math.abs(before.x-(lone.x-400))<.001);
 project.layout.drawingEdits=moveDrawingItems(next,project.layout.drawingEdits,new Map([[owner.editKey,[30,40]]]));next=rebuild(project);
 assert.ok(Math.abs(at(next,lone.editKey).x-before.x-30)<.001&&Math.abs(at(next,lone.editKey).y-before.y-40)<.001,'the separately placed card keeps its relative position');
});
test('WAN cards can be placed beside other objects, alone or with a multi-selection',()=>{
 const {project,page,devices,cards,owner}=wanSite(),reference=devices.find(i=>i.kind!=='handoff'&&i!==owner);
 // One card beside its own firewall.
 let edits=placeDrawingDevices(page,{},[cards[0].editKey],owner.editKey,'left','compact');project.layout.drawingEdits=edits;let next=rebuild(project);
 let card=at(next,cards[0].editKey),fw=at(next,owner.editKey);assert.ok(Math.abs(fw.x-card.x-card.w-56)<.001,'the card sits left of its firewall');
 for(const other of devices.filter(i=>i!==cards[0]))assert.ok(Math.abs(at(next,other.editKey).x-other.x)<.001&&Math.abs(at(next,other.editKey).y-other.y)<.001,other.name+' stays put');
 // Two cards and a switch selected together keep their arrangement as one group.
 const chosen=[cards[0],cards[1],reference],target=devices.find(i=>i.kind!=='handoff'&&!chosen.includes(i)&&i!==owner)||owner;
 project.layout.drawingEdits={};edits=placeDrawingDevices(page,{},chosen.map(i=>i.editKey),target.editKey,'below','compact');project.layout.drawingEdits=edits;next=rebuild(project);
 const shift=[at(next,chosen[0].editKey).x-chosen[0].x,at(next,chosen[0].editKey).y-chosen[0].y];
 for(const item of chosen){const actual=at(next,item.editKey);assert.ok(Math.abs(actual.x-item.x-shift[0])<.001&&Math.abs(actual.y-item.y-shift[1])<.001,item.name+' moves with the selection');}
 const top=Math.min(...chosen.map(i=>at(next,i.editKey).y)),ref=at(next,target.editKey);assert.ok(top>=ref.y+ref.h,'the selection is below the reference');
 // Placing the firewall carries its cards, keeping them above it.
 project.layout.drawingEdits={};edits=placeDrawingDevices(page,{},[owner.editKey],reference.editKey,'right','compact');project.layout.drawingEdits=edits;next=rebuild(project);fw=at(next,owner.editKey);
 for(const c of cards){const actual=at(next,c.editKey);assert.ok(actual.y+actual.h<=fw.y,c.name+' stays above the placed firewall');assert.ok(Math.abs(actual.x-c.x-(fw.x-owner.x))<.001);}
});
test('a cable with saved bends moves whole when both of its devices move together',()=>{
 const {project,page,cards,owner}=wanSite(),cable=page.items.find(i=>i.type==='path'&&[i.from,i.to].some(e=>e.device===cards[0].key));
 const bent=cable.points.map(p=>[...p]);project.layout.drawingEdits={[cable.editKey]:{points:bent}};
 const built=rebuild(project);project.layout.drawingEdits=moveDrawingItems(built,project.layout.drawingEdits,new Map([[owner.editKey,[120,-60]]]));
 assert.deepEqual(project.layout.drawingEdits[cable.editKey].points,bent.map(([x,y])=>[x+120,y-60]));
 const next=rebuild(project),path=at(next,cable.editKey);assert.deepEqual(path.points,bent.map(([x,y])=>[x+120,y-60]));
});
test('right information panel follows resized models and final captions after page scaling and reopen',()=>{
 const project=sampleSite();project.layout={presentation:{defaults:{drawingScale:1.5,panel:{position:'right',sections:['connections','models']}}}};
 const page=buildPages(project)[0],device=page.items.find(i=>i.type==='device'&&i.sourceId==='sw-1');
 project.layout.drawingEdits=scaleDrawingItems(page,{},[device.editKey],.9);
 const rebuilt=buildPages(JSON.parse(JSON.stringify(project)))[0],panel=rebuilt.items.filter(i=>i.panelGroup),content=rebuilt.items.filter(i=>!i.panelGroup&&!i.pageFrame&&!i.pageTitle&&!i.pageHeading&&(i.type==='device'||i.type==='path'||i.y>=145*1.5));
 const left=Math.min(...panel.map(i=>i.x)),right=Math.max(...content.flatMap(i=>i.points?i.points.map(p=>p[0]):[i.x+(i.w||0)]));
 assert.ok(panel.length);assert.ok(left>=right+26*1.5-1e-6,'panel follows final content, including scaled labels');
 assert.match(rebuilt.svg,/CONNECTION TYPES/);
});
