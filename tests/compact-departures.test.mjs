import test from 'node:test';
import assert from 'node:assert/strict';
import {coreRoutes} from '../src/web/diagram/routing.mjs';

const weight=4,epsilon=.00001;

function facingPorts({gap,staggered=false,x=430,y=300}){
 const upper={key:'upper',sourceId:'upper',name:'LAB-UPPER',kind:'switch',x,y,w:700,h:70};
 const lower={key:'lower',sourceId:'lower',name:'LAB-LOWER',kind:'switch',x,y:y+upper.h+gap,w:700,h:70};
 const nodes=new Map([[upper.key,upper],[lower.key,lower]]);
 const links=Array.from({length:4},(_,idx)=>({idx,a:upper.sourceId,ap:'port'+(idx+1),b:lower.sourceId,bp:'port'+(idx+1)}));
 const endData=new Map(),banks=new Map([['upper/bottom',[]],['lower/top',[]]]);
 for(const e of links)for(const [node,which,side] of [[upper,'a','bottom'],[lower,'b','top']]){
  const edge=node.y+(side==='bottom'?node.h:0);
  const offset=staggered?(which==='a'?80:200)+e.idx*12:80+e.idx*60;
  const anchor={device:node.key,port:which==='a'?e.ap:e.bp,x:node.x+offset,y:edge,edge,side};
  const endpoint={e,id:node.sourceId,which,node,anchor,info:{}};
  endData.set(e.idx+'/'+which,endpoint);banks.get(node.sourceId+'/'+side).push(endpoint);
 }
 return {upper,lower,nodes,links,endData,banks,options:{left:x,right:x+700,minX:x-200,maxX:x+900,pitch:24}};
}

function route(fixture,options={}){
 return coreRoutes(fixture.links,[],fixture.endData,fixture.banks,fixture.nodes,{...fixture.options,...options});
}

function assertClearDepartures(fixture,result){
 assert.equal(result.cost[0],0,'no cable may cross either device or a page obstacle');
 assert.equal(result.routes.length,fixture.links.length);
 const segments=[];
 for(const cable of result.routes){
  const start=fixture.endData.get(cable.e.idx+'/a').anchor,end=fixture.endData.get(cable.e.idx+'/b').anchor;
  assert.deepEqual(cable.points[0],[start.x,start.y],'source port stays attached');
  assert.deepEqual(cable.points.at(-1),[end.x,end.y],'destination port stays attached');
  for(const point of cable.points)assert.ok(point[1]>=fixture.upper.y+fixture.upper.h-epsilon&&point[1]<=fixture.lower.y+epsilon,'the departure stays in the open gap between devices');
  for(let i=1;i<cable.points.length;i++){
   const a=cable.points[i-1],b=cable.points[i],horizontal=Math.abs(a[1]-b[1])<epsilon;
   assert.ok(horizontal||Math.abs(a[0]-b[0])<epsilon,'every cable segment is orthogonal');
   if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<epsilon)continue;
   const axis=a[horizontal?1:0],lo=Math.min(a[horizontal?0:1],b[horizontal?0:1]),hi=Math.max(a[horizontal?0:1],b[horizontal?0:1]);
   for(const other of segments)if(other.cable!==cable&&other.horizontal===horizontal){
    const overlap=Math.min(hi,other.hi)-Math.max(lo,other.lo);
    assert.ok(overlap<=epsilon||Math.abs(axis-other.axis)>=weight-epsilon,'parallel painted cable segments must remain separate');
   }
   segments.push({cable,horizontal,axis,lo,hi});
  }
 }
}

test('aligned facing ports remain direct across a gap too narrow for a departure fan',()=>{
 for(const origin of [{x:430,y:300},{x:-100,y:-200}]){
  const fixture=facingPorts({gap:8,...origin}),result=route(fixture);
  assertClearDepartures(fixture,result);
  for(const cable of result.routes)assert.equal(cable.points.length,2,'aligned ports use their clear straight connection');
 }
});

test('staggered facing ports reject a truly insufficient gap at negative page coordinates',()=>{
 const fixture=facingPorts({gap:8,staggered:true,x:-100,y:-200});
 const starts=fixture.links.map(e=>fixture.endData.get(e.idx+'/a').anchor.x),ends=fixture.links.map(e=>fixture.endData.get(e.idx+'/b').anchor.x);
 assert.ok(Math.max(...starts)<Math.min(...ends),'all four horizontal departures must cross a common span');
 assert.ok((fixture.links.length-1)*weight>fixture.lower.y-(fixture.upper.y+fixture.upper.h)-weight,'the available gap cannot separate four painted horizontal tracks');
 assert.throws(()=>route(fixture,{minX:306,maxX:1162}),error=>error.code==='CORE_LAYOUT_CAPACITY','off-page coordinates must not bypass the physical departure capacity check');
});

test('staggered facing ports fit separate departures in a compact 56-unit gap',()=>{
 const fixture=facingPorts({gap:56,staggered:true,x:-100,y:-200}),before=JSON.stringify([...fixture.nodes.values()]);
 assertClearDepartures(fixture,route(fixture));
 assert.equal(JSON.stringify([...fixture.nodes.values()]),before,'routing does not move the devices');
});
