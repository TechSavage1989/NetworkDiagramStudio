import test from 'node:test';
import assert from 'node:assert/strict';
import {coreRoutes} from '../src/web/diagram/routing.mjs';

// Fictional APs alternate left/right of a switch. Port levels should never
// be reordered merely because the preferred cable rail changes direction.
function fixture(){
 const sw={key:'switch',sourceId:'switch',kind:'switch',x:300,y:400,w:400,h:50};
 const nodes=new Map([['switch',sw]]),edges=[],endData=new Map(),switchBank=[];
 const apXs=[20,820,100,740,180,660];
 for(let i=0;i<apXs.length;i++){
  const ap={key:'ap-'+i,sourceId:'ap-'+i,kind:'ap',x:apXs[i],y:90,w:48,h:48};
  nodes.set(ap.key,ap);
  const e={idx:i,a:'switch',b:ap.key,ap:'1/'+(i+1),bp:'eth0'},a={e,id:'switch',which:'a',node:sw,anchor:{x:355+i*55,y:400,edge:400,side:'top',weight:4,port:e.ap}},
   b={e,id:ap.key,which:'b',node:ap,anchor:{x:ap.x+24,y:138,edge:138,side:'bottom',weight:4,port:'eth0'}};
  edges.push(e);switchBank.push(a);
  endData.set(i+'/a',a);endData.set(i+'/b',b);
 }
 const banks=new Map([['switch/edge/top',switchBank]]);
 for(let i=0;i<edges.length;i++)banks.set('ap/'+i,[endData.get(i+'/b')]);
 return {edges,endData,banks,nodes,sw};
}
test('wireless switch departure levels follow physical port order, not cable direction',()=>{
 const {edges,endData,banks,nodes,sw}=fixture();
 const planned=coreRoutes(edges,[],endData,banks,nodes,{
  left:sw.x,right:sw.x+sw.w,minX:0,maxX:1000,
  topClearance:20,bottomClearance:20,pitch:12,railPitch:12,
  directionNeutralLevels:true,neat:false
 });
 const ordered=edges.map(e=>planned.ends.get(e.idx+'/a'));
 assert.deepEqual(ordered.map(v=>v.rank),[0,1,2,3,4,5],'port departure ranks are independent of left/right path choice');
 assert.equal(planned.routes.length,edges.length);
 for(const route of planned.routes){
  assert.deepEqual(route.points[0],[route.a.anchor.x,route.a.anchor.y]);
  assert.deepEqual(route.points.at(-1),[route.b.anchor.x,route.b.anchor.y]);
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i];
   assert.ok(a[0]===b[0]||a[1]===b[1],'all leads stay orthogonal');
  }
 }
});
