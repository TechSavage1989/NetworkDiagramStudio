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
function crossesPanel(route,node){
 const regions=node.moduleChannel&&!route.hosts.includes(node.key)?[{y:0,h:1}]:node.panelRegions?.length?node.panelRegions:[{y:0,h:1}];
 return regions.some(region=>{
  const box={x:node.x+(region.x??0)*node.w,y:node.y+region.y*node.h,w:(region.w??1)*node.w,h:region.h*node.h};
  const inside=([x,y])=>x>=box.x&&x<=box.x+box.w&&y>=box.y&&y<=box.y+box.h;
  let first=0,last=route.points.length-1;
  // Allow the local jack lead until it first exits its own member.
  if(route.hosts.includes(node.key)){
   while(first<last&&inside(route.points[first]))first++;
   while(last>first&&inside(route.points[last]))last--;
  }
  return crossesText(route.points.slice(first,last+1),box,0);
 });
}
function score(routes,nodes,obstacles,minX=306,maxX=1162){
 const seen=[];let blocked=0,shared=0,crossed=0,length=0,bends=0;
 for(const r of routes){if(r.points.some(([x])=>x<minX||x>maxX))blocked++;bends+=Math.max(0,clean(r.points).length-2);}
 for(const r of routes)for(const node of nodes.values())if(crossesPanel(r,node))blocked++;
 for(const r of routes)for(const s of segments(r.points)){
  const {a,b,h}=s;length+=Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1]);
  for(const box of obstacles)if(crossesText([a,b],box,2))blocked++;
  for(const t of seen){
   if(t.route===r)continue;
   if(h===t.h){if(Math.abs(a[h?1:0]-t.a[h?1:0])<6-.001&&overlap(a[h?0:1],b[h?0:1],t.a[h?0:1],t.b[h?0:1])>.01)shared++;}
   else{const x=h?t.a[0]:a[0],y=h?a[1]:t.a[1];if(between(x,h?a[0]:t.a[0],h?b[0]:t.b[0])&&between(y,h?t.a[1]:a[1],h?t.b[1]:b[1]))crossed++;}
  }
  seen.push({...s,route:r});
 }
 return [blocked,shared,crossed,bends,length];
}
function better(a,b){for(let i=0;i<a.length;i++){if(Math.abs(a[i]-b[i])>.001)return a[i]<b[i];}return false;}
// Reserve physical chassis corridors once for the complete bank, including
// links on opposite sides. A full center sends excess leads around their own
// column's exterior; it must not spread rails over the neighboring module.
export function planModuleEscapes(anchors,{weight=4,pitch=6}={}){
 const result=new Map(),owners=new Map(),gap=weight+.25;
 for(const anchor of anchors)if(anchor.moduleEscape){const owner=anchor.moduleEscape.owner;if(!owners.has(owner))owners.set(owner,[]);owners.get(owner).push(anchor);}
 for(const bank of owners.values()){
  const tracks=[],outer={left:0,right:0};
  const order=bank.slice().sort((a,b)=>{
   const x=a.moduleEscape,y=b.moduleEscape;
   return (x.channel[1]-x.channel[0])-(y.channel[1]-y.channel[0])||x.column.localeCompare(y.column)||
    (x.column==='left'?1:-1)*((a.side==='bottom'?-a.y:a.y)-(b.side==='bottom'?-b.y:b.y))||b.x-a.x||a.port.localeCompare(b.port);
  });
  for(const anchor of order){
   const spec=anchor.moduleEscape,[lo,hi]=[spec.channel[0]+weight/2,spec.channel[1]-weight/2];
   const ys=spec.bands.flat(),low=Math.min(anchor.edge,...ys),high=Math.max(anchor.edge,...ys);
   const candidates=[lo,hi,...tracks.flatMap(t=>[t.x,t.x-gap,t.x+gap])].filter(x=>x>=lo-1e-7&&x<=hi+1e-7)
    .sort((a,b)=>spec.column==='left'?a-b:b-a);
   const x=spec.bands.length?candidates.find(x=>!tracks.some(t=>Math.min(high,t.high)>Math.max(low,t.low)&&Math.abs(x-t.x)<gap-1e-7)):undefined;
   if(x!==undefined){tracks.push({x,low,high});result.set(anchor,{x,via:'center'});}
   else{
    if(!spec.outerBands.length)throw Object.assign(Error('This module has no free cable corridor. Enlarge the device or move the edited socket.'),{code:'CORE_LAYOUT_CAPACITY',owner:spec.owner,port:anchor.port});
    result.set(anchor,{x:spec.outer+(spec.column==='left'?-1:1)*(10+pitch*outer[spec.column]++),via:'outer'});
   }
  }
  const groups=new Map();
  for(const anchor of bank){const key=anchor.moduleEscape.region;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(anchor);}
  for(const group of groups.values()){
   const order=group.slice().sort((a,b)=>Math.abs(result.get(a).x-a.x)-Math.abs(result.get(b).x-b.x)||a.y-b.y||a.port.localeCompare(b.port));
   let chosen;
   for(const separation of [pitch,gap]){
    const placed=[];
    for(const anchor of order){
     const target=result.get(anchor),spec=anchor.moduleEscape,bands=target.via==='center'?spec.bands:spec.outerBands;
     let y;
     for(const [lo,hi] of bands){
      const candidates=[lo,hi,...placed.flatMap(p=>[p.y-separation,p.y+separation])].filter(y=>y>=lo-1e-7&&y<=hi+1e-7).sort((a,b)=>Math.abs(a-anchor.y)-Math.abs(b-anchor.y));
      y=candidates.find(y=>!placed.some(p=>overlap(anchor.x,target.x,p.anchor.x,p.x)>.01&&Math.abs(y-p.y)<separation-1e-7));
      if(y!==undefined)break;
     }
     if(y===undefined)break;
     placed.push({anchor,x:target.x,y});
    }
    if(placed.length===order.length){chosen=placed;break;}
   }
   if(!chosen)throw Object.assign(Error('This module needs more room for separate cables. Enlarge the device or move some connections to another page.'),{code:'CORE_LAYOUT_CAPACITY',owner:order[0].moduleEscape.owner,port:order[0].port});
   for(const {anchor,y} of chosen)result.get(anchor).y=y;
  }
 }
 return result;
}
export function endpointLead({anchor,ay,exitX,moduleEscape}){
 const start=[anchor.x,anchor.y];
 if(moduleEscape)return [start,[start[0],moduleEscape.y],[moduleEscape.x,moduleEscape.y],[moduleEscape.x,ay],[exitX,ay]];
 if(!anchor.departure&&anchor.escapeY==null&&exitX!==anchor.x){
  const turn=anchor.y+(anchor.side==='top'?-1:1)*2;
  return [start,[anchor.x,turn],[exitX,turn],[exitX,ay]];
 }
 const points=anchor.departure?[start,[anchor.x,anchor.departure[0][1]],anchor.departure[1]]:[start];
 const x=points.at(-1)[0];
 return [...points,[x,ay],[exitX,ay]];
}
const lead=endpointLead;
function fitNeighborDepartures(ends,nodes,obstacles){
 const gaps=new Map();
 for(const v of ends.values()){
  if(v.anchor.escapeY!=null)continue;
  const peer=ends.get(v.e.idx+'/'+(v.which==='a'?'b':'a'));
  if(peer&&!v.moduleEscape&&!peer.moduleEscape&&!v.anchor.departure&&!peer.anchor.departure&&peer.anchor.escapeY==null&&v.anchor.x===peer.anchor.x&&
    (v.anchor.side==='bottom'&&peer.anchor.side==='top'&&v.anchor.y<peer.anchor.y||v.anchor.side==='top'&&peer.anchor.side==='bottom'&&v.anchor.y>peer.anchor.y)&&
    !score([{points:[[v.anchor.x,v.anchor.y],[peer.anchor.x,peer.anchor.y]],hosts:[v.node.key,peer.node.key]}],nodes,obstacles,-Infinity,Infinity)[0])continue;
  const top=v.anchor.side==='top',edge=v.anchor.edge;
  const ahead=[...nodes.values()].filter(n=>n!==v.node&&v.exitX>n.x-2&&v.exitX<n.x+n.w+2)
   .map(n=>top?n.y+n.h:n.y).filter(y=>top?y<edge:y>edge);
  if(!ahead.length)continue;
  const other=top?Math.max(...ahead):Math.min(...ahead),lo=Math.min(edge,other),hi=Math.max(edge,other),key=lo.toFixed(5)+'/'+hi.toFixed(5);
  if(!gaps.has(key))gaps.set(key,{lo,hi,ends:[]});gaps.get(key).ends.push(v);
 }
 for(const {lo,hi,ends:bank} of gaps.values()){
  const first=lo+4,last=hi-4;
  if(!bank.some(v=>v.ay<first||v.ay>last))continue;
  if(last-first<(bank.length-1)*4.25)throw Object.assign(Error('These devices need a wider gap for separate cable departures. Increase the placement spacing.'),{code:'CORE_LAYOUT_CAPACITY',owner:bank[0].node.sourceId});
  // Facing banks share this reservation. Independent clamping would put
  // their last and first cables on the same line in a compact body gap.
  bank.sort((a,b)=>a.anchor.side.localeCompare(b.anchor.side)||(a.anchor.side==='bottom'?a.rank-b.rank:b.rank-a.rank)||a.e.idx-b.e.idx);
  bank.forEach((v,i)=>{v.ay=bank.length===1?(first+last)/2:first+(last-first)*i/(bank.length-1);});
 }
}
function turnsClear(v,y){return (v.anchor.side==='top'?-1:1)*(y-v.anchor.edge)>=8;}
function minimalCandidate(route,nodes,obstacles,others,minX,maxX){
 const {a,b}=route,ax=a.anchor.x,bx=b.anchor.x,candidates=[route];
 if(a.anchor.escapeY!=null||b.anchor.escapeY!=null||a.anchor.departure||b.anchor.departure||a.moduleEscape||b.moduleEscape)return route;
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
 const sides=new Map(),moduleEscapes=planModuleEscapes([...endData.values()].map(v=>v.anchor));
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
    const moduleEscape=moduleEscapes.get(v.anchor);
    let escapeX=moduleEscape?.x??v.anchor.departure?.at(-1)[0]??v.anchor.x;if(!moduleEscape&&sorted.some(o=>o!==v&&Math.abs(o.anchor.x-v.anchor.x)<4))while(exits.some(o=>Math.abs(o-escapeX)<4))escapeX+=dir*6;let x=escapeX,ay=v.anchor.escapeY??v.anchor.edge+(v.anchor.side==='top'?-1:1)*(v.anchor.side==='top'?topClearance+pitch*i:bottomClearance+pitch*i)*scale;
    if(v.anchor.escapeRange){const matching=sorted.filter(o=>o.anchor.escapeRange&&near(o.anchor.escapeRange[0],v.anchor.escapeRange[0])&&near(o.anchor.escapeRange[1],v.anchor.escapeRange[1])),[lo,hi]=v.anchor.escapeRange;ay=lo+(hi-lo)*(matching.indexOf(v)+1)/(matching.length+1);}
    // Text explicitly positioned by the user remains an obstacle. Automatic
    // device titles are fitted after routing instead of forcing cable doglegs.
    let detour=false;for(const box of obstacles)if(!moduleEscape&&crossesText([[x,v.anchor.y],[x,ay]],box,3)){x=dir>0?Math.max(x,box.x+box.w+7):Math.min(x,box.x-7);detour=true;}
    if(detour)escapeX=x;exits.push(escapeX,x);
    ends.set(v.e.idx+'/'+v.which,{...v,rank:i,escapeX,exitX:x,ay,moduleEscape});
   });
  }
  fitNeighborDepartures(ends,nodes,obstacles);
  const tracks=[],routes=[],references=[];
  const order=internal.slice().sort((a,b)=>Math.abs(ends.get(a.idx+'/a').ay-ends.get(a.idx+'/b').ay)-Math.abs(ends.get(b.idx+'/a').ay-ends.get(b.idx+'/b').ay)||a.idx-b.idx);
  for(const e of order){
   const a=ends.get(e.idx+'/a'),b=ends.get(e.idx+'/b'),side=sides.get(e.idx),lo=Math.min(a.ay,b.ay)-7,hi=Math.max(a.ay,b.ay)+7;
   let lane=0;while(tracks.some(t=>t.side===side&&t.lane===lane&&Math.min(hi,t.hi)>Math.max(lo,t.lo)))lane++;
   let rail=side==='left'?left-18-railPitch*lane:right+18+railPitch*lane;
   const blockers=[...nodes.values()].filter(n=>n.y<hi&&n.y+n.h>lo);
   const direction=side==='left'?-1:1;
   for(let attempt=0;attempt<=blockers.length+tracks.length;attempt++){
    const block=blockers.find(n=>rail>n.x-5&&rail<n.x+n.w+5);
    if(block){rail=direction<0?block.x-6:block.x+block.w+6;continue;}
    if(tracks.some(t=>Math.abs(t.rail-rail)<Math.min(10,railPitch)&&Math.min(hi,t.hi)>Math.max(lo,t.lo))){rail+=direction*6;continue;}
    break;
   }
   tracks.push({side,lane,lo,hi,rail});
   routes.push({e,a,b,side,rail,hosts:[a.node.key,b.node.key],points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])});
  }
  // Continuation badges sit outside the cable rails, not across a passing link.
  // Retain the existing boundary behavior for deliberately off-page edits.
  const referenceX=[...nodes.values()].every(n=>n.x>=minX&&n.x+n.w<=maxX)?Math.min(left-10,...tracks.filter(t=>t.side==='left').map(t=>t.rail-12)):left-10;
  for(const e of external){const which=ends.has(e.idx+'/a')?'a':'b',v=ends.get(e.idx+'/'+which),x=referenceX;const r={e,v,which,x,y:v.ay,hosts:[v.node.key],points:clean([...lead(v),[x,v.ay]])};routes.push(r);references.push(r);}
  for(let i=0;i<routes.length;i++)if(!routes[i].v){
   const route=routes[i],others=routes.filter((_,j)=>j!==i),{a,b}=route;
   let best=minimalCandidate(route,nodes,obstacles,others,minX,maxX);
   let cost=score([...others,best],nodes,obstacles,minX,maxX);
   // Edited rows may have another stack beside them. The nearest clear side
   // belongs to this pair of endpoints, not the widest device on the page.
   const localLeft=Math.min(a.node.x,b.node.x),localRight=Math.max(a.node.x+a.node.w,b.node.x+b.node.w);
   if((localLeft>left+.01||localRight<right-.01)&&score([best],nodes,obstacles,minX,maxX)[0])
    for(const distance of [0,1,2,3].map(i=>10+i*Math.max(12,railPitch)))for(const [rail,side] of [[localLeft-distance,'left'],[localRight+distance,'right']]){
     if(external.length&&side==='left'&&rail<referenceX+12)continue;
     const candidate={...route,rail,side,points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])};
     const value=score([...others,candidate],nodes,obstacles,minX,maxX);
     if(better(value,cost)){best=candidate;cost=value;}
    }
   const [west,east]=[a.node,b.node].sort((x,y)=>x.x-y.x);
   const low=west.x+west.w+10,high=east.x-10;
   if(low<=high){
    const count=Math.min(16,1+Math.floor((high-low)/Math.max(10,railPitch)));
    for(let j=0;j<count;j++){
     const rail=low+(high-low)*(j+.5)/count;
     const points=clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()]);
     const candidate={...route,rail,points};
     const value=score([...others,candidate],nodes,obstacles,minX,maxX);
     if(better(value,cost)){best=candidate;cost=value;}
    }
   }
   routes[i]=best;
   for(const v of [best.a,best.b])ends.set(v.e.idx+'/'+v.which,v);
  }
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
