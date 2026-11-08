import test from 'node:test';
import assert from 'node:assert/strict';
import {placeBeside} from '../src/web/arrange.mjs';
import {scaleDrawingItems} from '../src/web/drawing-edits.mjs';
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
 const [x,y]=placeBeside(boxes,target,'right',[{x:580,y:295,w:100,h:110}],80).get('a');assert.equal(x,580);assert.ok(y+110+80<=295||y>=485);
});
test('quick scaling respects page transforms and native child selection, preserving cable glue after reopen',()=>{
 const project=sampleSite();project.layout={presentation:{defaults:{drawingScale:1.5}}};const page=buildPages(project)[0],device=page.items.find(i=>i.sourceId==='sw-1'&&i.type==='device');
 project.layout.drawingEdits=scaleDrawingItems(page,{},[device.editKey,device.children[0].editKey],.75);
 assert.equal(Object.keys(project.layout.drawingEdits).length,1);
 const rebuilt=buildPages(JSON.parse(JSON.stringify(project)))[0],actual=rebuilt.items.find(i=>i.editKey===device.editKey);assert.equal(actual.w,device.w*.75);assert.equal(actual.h,device.h*.75);
 for(const cable of rebuilt.items.filter(i=>i.type==='path')){assert.deepEqual(cable.points[0],[cable.from.x,cable.from.y]);assert.deepEqual(cable.points.at(-1),[cable.to.x,cable.to.y]);}
 assert.match(rebuilt.svg,/class="cable-hit-target"/);assert.match(rebuilt.svg,/stroke-width="16" vector-effect="non-scaling-stroke"/);
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
