// Compare complete orthogonal layouts. A shorter cable never wins at the cost
// of crossing a chassis, sharing a cable segment, or adding a crossing.
const near=(a,b)=>Math.abs(a-b)<2.3;
const overlap=(a,b,c,d)=>Math.min(Math.max(a,b),Math.max(c,d))-Math.max(Math.min(a,b),Math.min(c,d));
const between=(p,a,b)=>p>Math.min(a,b)+.01&&p<Math.max(a,b)-.01;
export function simplifyRoute(points){
 const out=[];for(const point of points){const p=[...point];if(out.length&&p[0]===out.at(-1)[0]&&p[1]===out.at(-1)[1])continue;while(out.length>1){const a=out.at(-2),b=out.at(-1);if((a[0]===b[0]&&b[0]===p[0]&&b[1]>=Math.min(a[1],p[1])&&b[1]<=Math.max(a[1],p[1]))||(a[1]===b[1]&&b[1]===p[1]&&b[0]>=Math.min(a[0],p[0])&&b[0]<=Math.max(a[0],p[0])))out.pop();else break;}out.push(p);}return out;
}
const clean=simplifyRoute;
function segments(points){return points.slice(1).map((b,i)=>({a:points[i],b,h:points[i][1]===b[1]})).filter(s=>s.a[0]!==s.b[0]||s.a[1]!==s.b[1]);}
import {crossesText} from './labels.mjs';
function score(routes,nodes,obstacles,minX=306,maxX=1162){
 const seen=[];let blocked=0,shared=0,crossed=0,length=0,bends=0;
 for(const r of routes){if(r.points.some(([x])=>x<minX||x>maxX))blocked++;bends+=Math.max(0,clean(r.points).length-2);}
 for(const r of routes)for(const s of segments(r.points)){
  const {a,b,h}=s;length+=Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1]);
  for(const n of nodes.values())if(!r.hosts.includes(n.key)){
   if(h?between(a[1],n.y,n.y+n.h)&&overlap(a[0],b[0],n.x,n.x+n.w)>0:between(a[0],n.x,n.x+n.w)&&overlap(a[1],b[1],n.y,n.y+n.h)>0)blocked++;
  }
  for(const box of obstacles)if(crossesText([a,b],box,2))blocked++;
  for(const t of seen){
   if(t.route===r)continue;
   if(h===t.h){if(near(a[h?1:0],t.a[h?1:0])&&overlap(a[h?0:1],b[h?0:1],t.a[h?0:1],t.b[h?0:1])>.01)shared++;}
   else{const x=h?t.a[0]:a[0],y=h?a[1]:t.a[1];if(between(x,h?a[0]:t.a[0],h?b[0]:t.b[0])&&between(y,h?t.a[1]:a[1],h?t.b[1]:b[1]))crossed++;}
  }
  seen.push({...s,route:r});
 }
 return [blocked,shared,crossed,bends,length];
}
function better(a,b){for(let i=0;i<a.length;i++){if(Math.abs(a[i]-b[i])>.001)return a[i]<b[i];}return false;}
function lead(v){const start=[v.anchor.x,v.anchor.y];if(v.anchor.escapeY!=null)return [start,[start[0],v.ay],[v.exitX,v.ay]];return v.exitX===v.anchor.x?[start,[v.exitX,v.ay]]:[start,[start[0],start[1]+(v.anchor.side==='top'?-1:1)*2],[v.exitX,start[1]+(v.anchor.side==='top'?-1:1)*2],[v.exitX,v.ay]];}
function turnsClear(v,y){return (v.anchor.side==='top'?-1:1)*(y-v.anchor.edge)>=8;}
function minimalCandidate(route,nodes,obstacles,others,minX,maxX){
 const {a,b}=route,ax=a.anchor.x,bx=b.anchor.x,candidates=[route];
 if(a.anchor.escapeY!=null||b.anchor.escapeY!=null)return route;
 const ys=[(a.ay+b.ay)/2,a.ay,b.ay];
 for(const y of ys)if(turnsClear(a,y)&&turnsClear(b,y))candidates.push({...route,a:{...a,ay:y},b:{...b,ay:y},points:clean([[ax,a.anchor.y],[ax,y],[bx,y],[bx,b.anchor.y]])});
 if(ax===bx&&((a.anchor.side==='bottom'&&b.anchor.side==='top'&&a.anchor.y<b.anchor.y)||(a.anchor.side==='top'&&b.anchor.side==='bottom'&&a.anchor.y>b.anchor.y)))candidates.push({...route,points:[[ax,a.anchor.y],[bx,b.anchor.y]]});
 // Compact circuit cards can leave an open corridor inside the stack width.
 // Consider those rails before accepting a long trip around the whole rack.
 if(a.node.kind==='handoff'||b.node.kind==='handoff'){
  const stack=[...nodes.values()].filter(n=>n.kind!=='handoff');
  if(stack.length){const left=Math.min(...stack.map(n=>n.x)),right=Math.max(...stack.map(n=>n.x+n.w));
   const rails=new Set([route.rail,left+8,right-8,ax,bx,...[...nodes.values()].flatMap(n=>[n.x-8,n.x+n.w+8])]);
   // Two cards on one row can need the same side. Give their departure
   // segments separate lanes instead of accepting a shared horizontal run.
   const departures=[{a,b}];for(const offset of [-12,12]){const end=a.node.kind==='handoff'?'a':'b',v=end==='a'?a:b,y=v.ay+offset;if(turnsClear(v,y))departures.push({a,b,[end]:{...v,ay:y}});}
   for(const {a,b} of departures)for(const rail of rails)if(rail===route.rail||rail>left&&rail<right)candidates.push({...route,a,b,rail,side:rail<(left+right)/2?'left':'right',points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])});
  }
 }
 let best=route,cost=score([...others,route],nodes,obstacles,minX,maxX);
 for(const r of candidates.slice(1)){
  if((a.anchor.side==='top'?-1:1)*(r.points[1][1]-r.points[0][1])<=0||(b.anchor.side==='top'?-1:1)*(r.points.at(-2)[1]-r.points.at(-1)[1])<=0)continue;
  // A short route may only leave the endpoint chassis through its selected edge.
  const interior=r.points.slice(1,-1);if(interior.some(p=>[a.node,b.node].some(n=>p[0]>n.x&&p[0]<n.x+n.w&&p[1]>n.y&&p[1]<n.y+n.h)))continue;
  let blocked=false;for(const s of segments(r.points))for(const n of nodes.values())if(n===a.node||n===b.node){const endpoint=(n===a.node?r.points[0]:r.points.at(-1)),own=s.a[0]===endpoint[0]&&s.a[1]===endpoint[1]||s.b[0]===endpoint[0]&&s.b[1]===endpoint[1];if(!own&&(s.h?between(s.a[1],n.y,n.y+n.h)&&overlap(s.a[0],s.b[0],n.x,n.x+n.w)>0:between(s.a[0],n.x,n.x+n.w)&&overlap(s.a[1],s.b[1],n.y,n.y+n.h)>0))blocked=true;}
  if(blocked)continue;const value=score([...others,r],nodes,obstacles,minX,maxX);if(better(value,cost)){best=r;cost=value;}
 }
 return best;
}
export function coreRoutes(internal,external,endData,banks,nodes,{left,right,pitch=22,railPitch=12,topClearance=50,bottomClearance=18,scale=1,obstacles=[],minX=306,maxX=1162}){
 const sides=new Map();
 for(const e of internal){const a=endData.get(e.idx+'/a').anchor,b=endData.get(e.idx+'/b').anchor;sides.set(e.idx,a.x+b.x>left+right?'right':'left');}
 function build(){
  const ends=new Map();
  for(const bank of banks.values()){
   const sorted=bank.slice().sort((a,b)=>{
    const as=sides.get(a.e.idx)||'left',bs=sides.get(b.e.idx)||'left';
    return as.localeCompare(bs)||(as==='left'?a.anchor.x-b.anchor.x:b.anchor.x-a.anchor.x)||a.anchor.y-b.anchor.y||a.e.idx-b.e.idx;
   }),exits=[];
   sorted.forEach((v,i)=>{
    const side=sides.get(v.e.idx)||'left',dir=side==='right'?1:-1;
    let escapeX=v.anchor.x;if(sorted.some(o=>o!==v&&Math.abs(o.anchor.x-v.anchor.x)<4))while(exits.some(o=>Math.abs(o-escapeX)<4))escapeX+=dir*6;let x=escapeX,ay=v.anchor.escapeY??v.anchor.edge+(v.anchor.side==='top'?-1:1)*(v.anchor.side==='top'?topClearance+pitch*i:bottomClearance+pitch*i)*scale;
    if(v.anchor.escapeRange){const matching=sorted.filter(o=>o.anchor.escapeRange&&near(o.anchor.escapeRange[0],v.anchor.escapeRange[0])&&near(o.anchor.escapeRange[1],v.anchor.escapeRange[1])),[lo,hi]=v.anchor.escapeRange;ay=lo+(hi-lo)*(matching.indexOf(v)+1)/(matching.length+1);}
    // Text explicitly positioned by the user remains an obstacle. Automatic
    // device titles are fitted after routing instead of forcing cable doglegs.
    let detour=false;for(const box of obstacles)if(crossesText([[x,v.anchor.y],[x,ay]],box,3)){x=dir>0?Math.max(x,box.x+box.w+7):Math.min(x,box.x-7);detour=true;}
    if(detour)escapeX=x;exits.push(escapeX,x);
    ends.set(v.e.idx+'/'+v.which,{...v,rank:i,escapeX,exitX:x,ay});
   });
  }
  const tracks=[],routes=[],references=[];
  const order=internal.slice().sort((a,b)=>Math.abs(ends.get(a.idx+'/a').ay-ends.get(a.idx+'/b').ay)-Math.abs(ends.get(b.idx+'/a').ay-ends.get(b.idx+'/b').ay)||a.idx-b.idx);
  for(const e of order){
   const a=ends.get(e.idx+'/a'),b=ends.get(e.idx+'/b'),side=sides.get(e.idx),lo=Math.min(a.ay,b.ay)-7,hi=Math.max(a.ay,b.ay)+7;
   let lane=0;while(tracks.some(t=>t.side===side&&t.lane===lane&&Math.min(hi,t.hi)>Math.max(lo,t.lo)))lane++;
   let rail=side==='left'?left-18-railPitch*lane:right+18+railPitch*lane;
   const blockers=[...nodes.values()].filter(n=>n!==a.node&&n!==b.node&&n.y<hi&&n.y+n.h>lo);
   const direction=side==='left'?-1:1;
   for(let attempt=0;attempt<=blockers.length+tracks.length;attempt++){
    const block=blockers.find(n=>rail>n.x-5&&rail<n.x+n.w+5);
    if(block){rail=direction<0?block.x-6:block.x+block.w+6;continue;}
    if(tracks.some(t=>Math.abs(t.rail-rail)<6&&Math.min(hi,t.hi)>Math.max(lo,t.lo))){rail+=direction*6;continue;}
    break;
   }
   tracks.push({side,lane,lo,hi,rail});
   routes.push({e,a,b,side,rail,hosts:[a.node.key,b.node.key],points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])});
  }
  // Continuation badges sit outside the cable rails, not across a passing link.
  // Retain the existing boundary behavior for deliberately off-page edits.
  const referenceX=[...nodes.values()].every(n=>n.x>=minX&&n.x+n.w<=maxX)?Math.min(left-10,...tracks.filter(t=>t.side==='left').map(t=>t.rail-12)):left-10;
  for(const e of external){const which=ends.has(e.idx+'/a')?'a':'b',v=ends.get(e.idx+'/'+which),x=referenceX;const r={e,v,which,x,y:v.ay,hosts:[v.node.key],points:clean([...lead(v),[x,v.ay]])};routes.push(r);references.push(r);}
  for(let i=0;i<routes.length;i++)if(!routes[i].v){routes[i]=minimalCandidate(routes[i],nodes,obstacles,routes.filter((_,j)=>j!==i),minX,maxX);for(const v of [routes[i].a,routes[i].b])ends.set(v.e.idx+'/'+v.which,v);}
  return {routes,references,ends};
 }
 let best=build(),cost=score(best.routes,nodes,obstacles,minX,maxX);
 // Start at the nearest side, then account for the other cables and port-bank
 // ordering. The fixed order and strict improvement make regeneration stable.
 for(let pass=0;pass<(internal.length>16?1:4);pass++){
  let improved=false;
  for(const e of (internal.length>16?internal.slice(0,8):internal)){
   const before=sides.get(e.idx);sides.set(e.idx,before==='left'?'right':'left');
   const candidate=build(),value=score(candidate.routes,nodes,obstacles,minX,maxX);
   if(better(value,cost)){best=candidate;cost=value;improved=true;}else sides.set(e.idx,before);
  }
  if(!improved)break;
 }
 return {...best,cost};
}
