// Physical obstructions and merged cables are hard constraints. After those,
// prefer a short clear path; a small crossing with a hop is cheaper than a long
// trip around the page. Candidate scoring only compares the changing cable.
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
  return crossesText(route.points.slice(first,last+1),box,(route.weight||4)/2-.01);
 });
}
const routeGeometry=new WeakMap();
function geometry(route){
 let value=routeGeometry.get(route);
 if(!value||value.points!==route.points){const lines=segments(route.points);value={points:route.points,lines:lines.map(line=>({...line,route,weight:route.weight||4})),length:lines.reduce((n,s)=>n+Math.abs(s.b[0]-s.a[0])+Math.abs(s.b[1]-s.a[1]),0),bends:Math.max(0,route.points.length-2)};routeGeometry.set(route,value);}
 return value;
}
function exteriorLane(line,nodes){
 if(line.exterior===undefined)line.exterior=!line.h&&![...nodes.values()].some(node=>line.a[0]>node.x&&line.a[0]<node.x+node.w&&overlap(line.a[1],line.b[1],node.y,node.y+node.h)>0);
 return line.exterior;
}
function routeScore(r,nodes,obstacles,seen,minX,maxX,railGap=6){
 const {lines,length,bends}=geometry(r);let blocked=r.points.some(([x])=>x<minX||x>maxX)?1:0,shared=0,crossed=0;
 for(const node of nodes.values())if(crossesPanel(r,node))blocked++;
 for(const s of lines){
  const {a,b,h}=s;
  for(const box of obstacles)if(crossesText([a,b],box,(r.weight||4)/2))blocked++;
  for(const t of seen){
   if(t.route===r)continue;
   if(h===t.h){const clearance=Math.max(((r.weight||4)+t.weight)/2+.25,!h&&exteriorLane(s,nodes)&&exteriorLane(t,nodes)?railGap:0);if(Math.abs(a[h?1:0]-t.a[h?1:0])<clearance-.001&&overlap(a[h?0:1],b[h?0:1],t.a[h?0:1],t.b[h?0:1])>.01)shared++;}
   else{const x=h?t.a[0]:a[0],y=h?a[1]:t.a[1];if(between(x,h?a[0]:t.a[0],h?b[0]:t.b[0])&&between(y,h?t.a[1]:a[1],h?t.b[1]:b[1]))crossed++;}
  }
 }
 return [blocked,shared,length+crossed*12+bends*2,crossed,bends,length];
}
function score(routes,nodes,obstacles,minX=306,maxX=1162,railGap=6){
 const seen=[],total=[0,0,0,0,0,0];
 for(const route of routes){const value=routeScore(route,nodes,obstacles,seen,minX,maxX,railGap);for(let i=0;i<total.length;i++)total[i]+=value[i];seen.push(...geometry(route).lines);}
 return total;
}
function better(a,b){for(let i=0;i<a.length;i++){if(Math.abs(a[i]-b[i])>.001)return a[i]<b[i];}return false;}
function gapRailCandidates(route,others,nodes,minX,maxX,railGap){
 const {a,b}=route,lo=Math.min(a.ay,b.ay),hi=Math.max(a.ay,b.ay),blocked=[],weight=route.weight||4;
 if(hi-lo<.01)return [];
 // A few fixed exterior samples can all coincide with occupied rails. Find
 // the actual free intervals for this vertical span, then try only the eight
 // nearest boundaries/midpoints. This is bounded by geometry, not page width.
 for(const node of nodes.values())if(overlap(lo,hi,node.y,node.y+node.h)>.01)blocked.push([node.x-weight/2,node.x+node.w+weight/2]);
 for(const line of others)if(!line.h&&overlap(lo,hi,line.a[1],line.b[1])>.01){
  const gap=Math.max((weight+line.weight)/2+.25,exteriorLane(line,nodes)?railGap:0);blocked.push([line.a[0]-gap,line.a[0]+gap]);
 }
 const intervals=blocked.filter(([a,b])=>b>=minX&&a<=maxX).sort((a,b)=>a[0]-b[0]),free=[];let start=minX;
 for(const [a,b] of intervals){if(a>=start)free.push([start,Math.min(maxX,a)]);start=Math.max(start,b);if(start>maxX)break;}
 if(start<=maxX)free.push([start,maxX]);
 const center=(a.exitX+b.exitX)/2,cost=x=>Math.abs(x-a.exitX)+Math.abs(x-b.exitX),candidates=new Set();
 for(const [low,high] of free)if(low<=high)for(const x of [Math.max(low,Math.min(high,center)),low,high])candidates.add(x);
 return [...candidates].sort((x,y)=>cost(x)-cost(y)||Math.abs(x-center)-Math.abs(y-center)||x-y).slice(0,8);
}
// Reserve physical chassis corridors once for the complete bank, including
// links on opposite sides. A full center sends excess leads around their own
// column's exterior; it must not spread rails over the neighboring module.
export function planModuleEscapes(anchors,{weight=4,pitch=6,minX=-Infinity,maxX=Infinity}={}){
 const result=new Map(),owners=new Map();
 for(const anchor of anchors)if(anchor.moduleEscape){const owner=anchor.moduleEscape.owner;if(!owners.has(owner))owners.set(owner,[]);owners.get(owner).push(anchor);}
 for(const bank of owners.values()){
  const tracks=[],outer={left:[],right:[]};
  const centerBenefit=anchor=>{
   const spec=anchor.moduleEscape,center=Math.max(spec.channel[0],Math.min(spec.channel[1],anchor.x)),outer=spec.outer+(spec.column==='left'?-10:10);
   const cost=x=>Math.abs(x-anchor.x)+(Number.isFinite(spec.peerX)?Math.abs(x-spec.peerX):0);
   return cost(outer)-cost(center);
  };
  const order=bank.slice().sort((a,b)=>{
   const x=a.moduleEscape,y=b.moduleEscape;
   return (x.channel[1]-x.channel[0])-(y.channel[1]-y.channel[0])||centerBenefit(b)-centerBenefit(a)||x.column.localeCompare(y.column)||
    (x.column==='left'?1:-1)*((a.side==='bottom'?-a.y:a.y)-(b.side==='bottom'?-b.y:b.y))||b.x-a.x||a.port.localeCompare(b.port);
  });
  for(const anchor of order){
   const spec=anchor.moduleEscape,width=anchor.weight||weight,[lo,hi]=[spec.channel[0]+width/2,spec.channel[1]-width/2];
   const ys=spec.bands.flat(),low=Math.min(anchor.edge,...ys),high=Math.max(anchor.edge,...ys);
   const candidates=[lo,hi,...tracks.flatMap(t=>{const gap=(width+t.weight)/2+.25;return [t.x,t.x-gap,t.x+gap];})].filter(x=>x>=lo-1e-7&&x<=hi+1e-7)
    .sort((a,b)=>spec.column==='left'?a-b:b-a);
   const x=spec.bands.length?candidates.find(x=>!tracks.some(t=>Math.min(high,t.high)>Math.max(low,t.low)&&Math.abs(x-t.x)<(width+t.weight)/2+.25-1e-7)):undefined;
   const outside=outer[spec.column],prior=outside.at(-1),distance=prior?prior.distance+Math.max(pitch,(prior.weight+width)/2+.25):Math.max(10,width/2+4),outerX=spec.outer+(spec.column==='left'?-1:1)*distance;
   const travel=x=>Math.abs(x-anchor.x)+(Number.isFinite(spec.peerX)?Math.abs(x-spec.peerX):0);
   const outerClear=outerX-width/2>=minX&&outerX+width/2<=maxX;
   const preferOuter=outerClear&&spec.outerBands.length&&Number.isFinite(spec.peerX)&&travel(outerX)+.01<travel(x??Infinity);
   if(x!==undefined&&!preferOuter){tracks.push({x,low,high,weight:width});result.set(anchor,{x,via:'center'});}
   else{
    if(!spec.outerBands.length||!outerClear)throw Object.assign(Error('This module has no free cable corridor. Enlarge the device or move the edited socket.'),{code:'CORE_LAYOUT_CAPACITY',owner:spec.owner,port:anchor.port});
    outside.push({distance,weight:width});result.set(anchor,{x:outerX,via:'outer'});
   }
  }
  const groups=new Map();
  for(const anchor of bank){const key=anchor.moduleEscape.region;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(anchor);}
  for(const group of groups.values()){
   const order=group.slice().sort((a,b)=>Math.abs(result.get(a).x-a.x)-Math.abs(result.get(b).x-b.x)||a.y-b.y||a.port.localeCompare(b.port));
   let chosen;
   for(const standard of [true,false]){
    const placed=[];
    for(const anchor of order){
     const target=result.get(anchor),spec=anchor.moduleEscape,bands=target.via==='center'?spec.bands:spec.outerBands;
     let y;
     for(const [lo,hi] of bands){
      const separation=p=>Math.max(standard?pitch:0,((anchor.weight||weight)+(p.anchor.weight||weight))/2+.25);
      const candidates=[lo,hi,...placed.flatMap(p=>[p.y-separation(p),p.y+separation(p)])].filter(y=>y>=lo-1e-7&&y<=hi+1e-7).sort((a,b)=>Math.abs(a-anchor.y)-Math.abs(b-anchor.y));
      y=candidates.find(y=>!placed.some(p=>overlap(anchor.x,target.x,p.anchor.x,p.x)>.01&&Math.abs(y-p.y)<separation(p)-1e-7));
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
  const turn=anchor.y+(anchor.side==='top'?-1:1)*Math.max(2,(anchor.weight||4)/2+1);
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
    !score([{points:[[v.anchor.x,v.anchor.y],[peer.anchor.x,peer.anchor.y]],weight:v.anchor.weight||4,hosts:[v.node.key,peer.node.key]}],nodes,obstacles,-Infinity,Infinity)[0])continue;
  const top=v.anchor.side==='top',edge=v.anchor.edge;
  const ahead=[...nodes.values()].filter(n=>n!==v.node&&v.exitX>n.x-2&&v.exitX<n.x+n.w+2)
   .map(n=>top?n.y+n.h:n.y).filter(y=>top?y<edge:y>edge);
  if(!ahead.length)continue;
  const other=top?Math.max(...ahead):Math.min(...ahead),lo=Math.min(edge,other),hi=Math.max(edge,other),key=lo.toFixed(5)+'/'+hi.toFixed(5);
  if(!gaps.has(key))gaps.set(key,{lo,hi,ends:[]});gaps.get(key).ends.push(v);
 }
 for(const {lo,hi,ends:bank} of gaps.values()){
  const margin=Math.max(4,...bank.map(v=>(v.anchor.weight||4)/2+2)),first=lo+margin,last=hi-margin;
  if(!bank.some(v=>v.ay<first||v.ay>last))continue;
  // Facing banks share this reservation. Independent clamping would put
  // their last and first cables on the same line in a compact body gap.
  bank.sort((a,b)=>a.anchor.side.localeCompare(b.anchor.side)||(a.anchor.side==='bottom'?a.rank-b.rank:b.rank-a.rank)||a.e.idx-b.e.idx);
  const gaps=bank.slice(1).map((v,i)=>((v.anchor.weight||4)+(bank[i].anchor.weight||4))/2+.25),required=gaps.reduce((sum,gap)=>sum+gap,0);
  if(last-first<required)throw Object.assign(Error('These devices need a wider gap for separate cable departures. Increase the placement spacing.'),{code:'CORE_LAYOUT_CAPACITY',owner:bank[0].node.sourceId});
  let y=first;bank.forEach((v,i)=>{if(i)y+=gaps[i-1]+(last-first-required)/Math.max(1,bank.length-1);v.ay=bank.length===1?(first+last)/2:y;});
 }
}
function turnsClear(v,y){return (v.anchor.side==='top'?-1:1)*(y-v.anchor.edge)>=Math.max(8,(v.anchor.weight||4)/2+2);}
function minimalCandidate(route,nodes,obstacles,evaluate){
 const {a,b}=route,ax=a.anchor.x,bx=b.anchor.x,candidates=[route];
 if(a.anchor.escapeY!=null||b.anchor.escapeY!=null||a.anchor.departure||b.anchor.departure||a.moduleEscape||b.moduleEscape||a.exitX!==ax||b.exitX!==bx)return route;
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
 let best=route,cost=evaluate(route);
 for(const r of candidates.slice(1)){
  if((a.anchor.side==='top'?-1:1)*(r.points[1][1]-r.points[0][1])<=0||(b.anchor.side==='top'?-1:1)*(r.points.at(-2)[1]-r.points.at(-1)[1])<=0)continue;
  // A short route may only leave the endpoint chassis through its selected edge.
  const interior=r.points.slice(1,-1);if(interior.some(p=>[a.node,b.node].some(n=>p[0]>n.x&&p[0]<n.x+n.w&&p[1]>n.y&&p[1]<n.y+n.h)))continue;
  let blocked=false;for(const s of segments(r.points))for(const n of nodes.values())if(n===a.node||n===b.node){const endpoint=(n===a.node?r.points[0]:r.points.at(-1)),own=s.a[0]===endpoint[0]&&s.a[1]===endpoint[1]||s.b[0]===endpoint[0]&&s.b[1]===endpoint[1];if(!own&&(s.h?between(s.a[1],n.y,n.y+n.h)&&overlap(s.a[0],s.b[0],n.x,n.x+n.w)>0:between(s.a[0],n.x,n.x+n.w)&&overlap(s.a[1],s.b[1],n.y,n.y+n.h)>0))blocked=true;}
  if(blocked)continue;const value=evaluate(r);if(better(value,cost)){best=r;cost=value;}
 }
 return best;
}
export function coreRoutes(internal,external,endData,banks,nodes,{left,right,pitch=22,railPitch=12,topClearance=50,bottomClearance=18,scale=1,obstacles=[],minX=306,maxX=1162}){
 const bodies=[...nodes.values()];
 if(bodies.some(n=>n.x<minX))minX=Math.min(minX,...bodies.map(n=>n.x))-Math.max(24,endData.size*railPitch);
 if(bodies.some(n=>n.x+n.w>maxX))maxX=Math.max(maxX,...bodies.map(n=>n.x+n.w))+Math.max(24,endData.size*railPitch);
 const sides=new Map(),moduleEscapes=planModuleEscapes([...endData.values()].map(v=>v.anchor),{pitch:Math.max(6,railPitch),minX,maxX}),stats={builds:1,candidates:0};
 for(const e of internal){const a=endData.get(e.idx+'/a'),b=endData.get(e.idx+'/b'),west=Math.min(a.node.x,b.node.x),east=Math.max(a.node.x+a.node.w,b.node.x+b.node.w);sides.set(e.idx,a.anchor.x+b.anchor.x>west+east?'right':'left');}
 function build(){
  const ends=new Map();
  for(const bank of banks.values()){
   const sorted=bank.slice().sort((a,b)=>{
    const as=sides.get(a.e.idx)||'left',bs=sides.get(b.e.idx)||'left';
    return as.localeCompare(bs)||(as==='left'?a.anchor.x-b.anchor.x:b.anchor.x-a.anchor.x)||a.anchor.y-b.anchor.y||a.e.idx-b.e.idx;
   }),escapeChoices=new Map(),reserved=[];
   // Reserve a shared socket column from its exposed row inward, independently
   // of the eventual left/right route. Otherwise a deeper port's long lead can
   // pass over the short departure of the outer port on the same x coordinate.
   for(const v of sorted.slice().sort((a,b)=>(a.anchor.side==='top'?a.anchor.y-b.anchor.y:b.anchor.y-a.anchor.y)||a.anchor.x-b.anchor.x||a.e.idx-b.e.idx)){
    const module=moduleEscapes.get(v.anchor),weight=v.anchor.weight||4,dir=sides.get(v.e.idx)==='right'?1:-1;
    const limit=v.anchor.escapeY??v.anchor.edge,low=Math.min(v.anchor.y,limit),high=Math.max(v.anchor.y,limit);
    let x=module?.x??v.anchor.departure?.at(-1)[0]??v.anchor.x;
    if(!module&&sorted.some(o=>o!==v&&Math.abs(o.anchor.x-v.anchor.x)<(weight+(o.anchor.weight||4))/2))while(reserved.some(o=>Math.min(high,o.high)>Math.max(low,o.low)&&Math.abs(o.x-x)<(weight+o.weight)/2+.25))x+=dir*Math.max(6,weight+.25);
    escapeChoices.set(v,x);reserved.push({x,weight,low,high});
   }
   sorted.forEach((v,i)=>{
    const side=sides.get(v.e.idx)||'left',dir=side==='right'?1:-1;
    const moduleEscape=moduleEscapes.get(v.anchor);
    const weight=v.anchor.weight||4;
    let escapeX=escapeChoices.get(v),x=escapeX,ay=v.anchor.escapeY??v.anchor.edge+(v.anchor.side==='top'?-1:1)*(v.anchor.side==='top'?topClearance+pitch*i:bottomClearance+pitch*i)*scale;
    if(v.anchor.escapeRange){
     const matching=sorted.filter(o=>o.anchor.escapeRange&&near(o.anchor.escapeRange[0],v.anchor.escapeRange[0])&&near(o.anchor.escapeRange[1],v.anchor.escapeRange[1])),[lo,hi]=v.anchor.escapeRange,index=matching.indexOf(v),widths=matching.map(o=>o.anchor.weight||4),required=widths.reduce((sum,width)=>sum+width,0)+.25*(matching.length+1);
     if(hi-lo<required)throw Object.assign(Error('This stack gap is too narrow for the selected cable widths. Enlarge the device or reduce the cable width.'),{code:'CORE_LAYOUT_CAPACITY',owner:v.node.sourceId});
     const gap=(hi-lo-widths.reduce((sum,width)=>sum+width,0))/(matching.length+1);ay=lo+widths.slice(0,index).reduce((sum,width)=>sum+width,0)+weight/2+gap*(index+1);
    }
    // Text explicitly positioned by the user remains an obstacle. Automatic
    // device titles are fitted after routing instead of forcing cable doglegs.
    let detour=false;for(const box of obstacles)if(!moduleEscape&&crossesText([[x,v.anchor.y],[x,ay]],box,3)){x=dir>0?Math.max(x,box.x+box.w+7):Math.min(x,box.x-7);detour=true;}
    if(detour)escapeX=x;
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
   routes.push({e,a,b,side,rail,weight:Math.max(a.anchor.weight||4,b.anchor.weight||4),hosts:[a.node.key,b.node.key],points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])});
  }
  // Continuation badges sit outside the cable rails, not across a passing link.
  // Retain the existing boundary behavior for deliberately off-page edits.
  const referenceX=[...nodes.values()].every(n=>n.x>=minX&&n.x+n.w<=maxX)?Math.min(left-10,...tracks.filter(t=>t.side==='left').map(t=>t.rail-12)):left-10;
  for(const e of external){const which=ends.has(e.idx+'/a')?'a':'b',v=ends.get(e.idx+'/'+which),x=referenceX;const r={e,v,which,x,y:v.ay,weight:v.anchor.weight||4,hosts:[v.node.key],points:clean([...lead(v),[x,v.ay]])};routes.push(r);references.push(r);}
  // Two bounded local passes let a cable use space released by its neighbor.
  // Do not rebuild the bank for every side flip or rescore unchanged pairs.
  for(let pass=0;pass<2;pass++)for(let i=0;i<routes.length;i++)if(!routes[i].v){
   const route=routes[i],others=routes.filter((_,j)=>j!==i).flatMap(r=>geometry(r).lines),{a,b}=route;
   const evaluate=candidate=>{stats.candidates++;return routeScore(candidate,nodes,obstacles,others,minX,maxX,railPitch);};
   let best=minimalCandidate(route,nodes,obstacles,evaluate);
   let cost=evaluate(best);
   // Edited rows may have another stack beside them. The nearest clear side
   // belongs to this pair of endpoints, not the widest device on the page.
   const localLeft=Math.min(a.node.x,b.node.x),localRight=Math.max(a.node.x+a.node.w,b.node.x+b.node.w);
   const rails=new Set([route.rail,a.exitX,b.exitX,(a.exitX+b.exitX)/2]);
   for(const distance of [0,1,2,3].map(i=>Math.max(8,route.weight/2+4)+i*Math.max(6,railPitch)))for(const rail of [localLeft-distance,localRight+distance,a.node.x-distance,a.node.x+a.node.w+distance,b.node.x-distance,b.node.x+b.node.w+distance])rails.add(rail);
   for(const rail of gapRailCandidates(route,others,nodes,minX,maxX,railPitch))rails.add(rail);
   for(const rail of rails){const side=rail<(localLeft+localRight)/2?'left':'right';
     if(external.length&&side==='left'&&rail<referenceX+12)continue;
     const candidate={...route,rail,side,points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])};
     const value=evaluate(candidate);
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
     const value=evaluate(candidate);
     if(better(value,cost)){best=candidate;cost=value;}
    }
   }
   routes[i]=best;
   for(const v of [best.a,best.b])ends.set(v.e.idx+'/'+v.which,v);
  }
  return {routes,references,ends};
 }
 const best=build(),cost=score(best.routes,nodes,obstacles,minX,maxX,railPitch);
 return {...best,cost,stats};
}
