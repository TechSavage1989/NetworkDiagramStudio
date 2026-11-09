// Physical obstructions and merged cables are hard constraints. After those,
// prefer a short clear path; a small crossing with a hop is cheaper than a long
// trip around the page. Candidate scoring only compares the changing cable.
const near=(a,b)=>Math.abs(a-b)<2.3;
const overlap=(a,b,c,d)=>Math.min(Math.max(a,b),Math.max(c,d))-Math.max(Math.min(a,b),Math.min(c,d));
const between=(p,a,b)=>p>Math.min(a,b)+.01&&p<Math.max(a,b)-.01;
export function simplifyRoute(points){
 const out=[];for(const point of points){const p=[...point];if(out.length&&p[0]===out.at(-1)[0]&&p[1]===out.at(-1)[1])continue;while(out.length>1){const a=out.at(-2),b=out.at(-1);if((a[0]===b[0]&&b[0]===p[0]&&b[1]>=Math.min(a[1],p[1])&&b[1]<=Math.max(a[1],p[1]))||(a[1]===b[1]&&b[1]===p[1]&&b[0]>=Math.min(a[0],p[0])&&b[0]<=Math.max(a[0],p[0])))out.pop();else break;}out.push(p);}return out;
}
// A collinear spike between two interior turns (down a lane and straight back
// up the same line) only adds length and a false bend. The first and last
// segments are never shortened, so a lead cannot reverse through its chassis.
function collapseSpikes(points){
 let out=points;
 for(let changed=true;changed;){
  changed=false;
  for(let i=2;i<out.length-2;i++){
   const [a,b,c]=[out[i-1],out[i],out[i+1]],axis=a[0]===b[0]&&b[0]===c[0]?1:a[1]===b[1]&&b[1]===c[1]?0:-1;
   if(axis<0||b[axis]>=Math.min(a[axis],c[axis])&&b[axis]<=Math.max(a[axis],c[axis]))continue;
   out=simplifyRoute([...out.slice(0,i),...out.slice(i+1)]);changed=true;break;
  }
 }
 return out;
}
const clean=points=>collapseSpikes(simplifyRoute(points));
// Shared drawing rhythm (scene units, 96 dpi). Parallel cables keep a visible
// white gap, cable rails keep clear of every device body, and finished routes
// are redistributed onto evenly pitched tracks inside each open channel.
export const ROUTE_STYLE=Object.freeze({clearance:24,gap:6,pitch:18,rowPitch:20,titleReserve:34,detailReserve:26,modulePitch:10});
const separation=(a,b)=>(a+b)/2+ROUTE_STYLE.gap;
function segments(points){return points.slice(1).map((b,i)=>({a:points[i],b,h:points[i][1]===b[1]})).filter(s=>s.a[0]!==s.b[0]||s.a[1]!==s.b[1]);}
import {crossesText} from './labels.mjs';
function crossesPanel(route,node){
 // An empty bay is open faceplate: the host's own leads may pass through it.
 // Once a cable has left its socket, its rows and rail stay outside a modular
 // chassis, even through empty slots or the gaps between them.
 if(node.moduleChannel&&route.hosts.includes(node.key)&&route.a&&route.b&&Number.isFinite(route.rail)&&route.shape!=='z'&&route.shape!=='direct'){
  const middle=[[route.a.exitX,route.a.ay],[route.rail,route.a.ay],[route.rail,route.b.ay],[route.b.exitX,route.b.ay]];
  if(crossesText(middle,{x:node.x,y:node.y,w:node.w,h:node.h},(route.weight||4)/2-.01))return true;
 }
 // Equipment a cable does not connect to is solid: its own member or module
 // gaps are corridors only for its own leads.
 const regions=!route.hosts.includes(node.key)?[{y:0,h:1}]:node.panelRegions?.length?node.panelRegions.filter(region=>!region.empty||!route.hosts.includes(node.key)):[{y:0,h:1}];
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
// A vertical cable run alongside a device body, closer than the standard
// clearance, reads as part of the faceplate. Own socket leads are exempt.
function hugs(s,r,nodes){
 if(s.h)return 0;
 const start=r.points[0],end=r.points.at(-1),local=p=>Math.abs(p[0]-start[0])+Math.abs(p[1]-start[1])<12||Math.abs(p[0]-end[0])+Math.abs(p[1]-end[1])<12;
 if(local(s.a)||local(s.b))return 0;
 let count=0;const x=s.a[0],w=(r.weight||4)/2;
 for(const node of nodes.values()){
  if(overlap(s.a[1],s.b[1],node.y,node.y+node.h)<=1)continue;
  const distance=x<node.x?node.x-x:x>node.x+node.w?x-node.x-node.w:-1;
  if(distance>=0&&distance<ROUTE_STYLE.clearance-w-.01)count++;
 }
 return count;
}
function routeScore(r,nodes,obstacles,seen,minX,maxX,railGap=6){
 const {lines,length,bends}=geometry(r);let blocked=r.points.some(([x])=>x<minX||x>maxX)?1:0,shared=0,crossed=0,tight=0;
 for(const node of nodes.values())if(crossesPanel(r,node))blocked++;
 for(const s of lines){
  const {a,b,h}=s;
  for(const box of obstacles)if(crossesText([a,b],box,(r.weight||4)/2))blocked++;
  tight+=hugs(s,r,nodes);
  for(const t of seen){
   if(t.route===r)continue;
   if(h===t.h){
    const distance=Math.abs(a[h?1:0]-t.a[h?1:0]),parallel=overlap(a[h?0:1],b[h?0:1],t.a[h?0:1],t.b[h?0:1])>.01;
    const clearance=Math.max(((r.weight||4)+t.weight)/2+.25,!h&&exteriorLane(s,nodes)&&exteriorLane(t,nodes)?railGap:0);
    if(parallel&&distance<clearance-.001)shared++;
    else if(parallel&&distance<separation(r.weight||4,t.weight)-.001)tight++;
   }
   else{const x=h?t.a[0]:a[0],y=h?a[1]:t.a[1];if(between(x,h?a[0]:t.a[0],h?b[0]:t.b[0])&&between(y,h?t.a[1]:a[1],h?t.b[1]:b[1]))crossed++;}
  }
 }
 // Crowded parallels and device-hugging rails cost about as much as a short
 // detour: enough to choose a clear neighboring lane, never a page-wide trip.
 return [blocked,shared,length+crossed*12+bends*2+tight*40,crossed,bends,length];
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
 for(const node of nodes.values())if(overlap(lo,hi,node.y,node.y+node.h)>.01)blocked.push([node.x-Math.max(weight/2,ROUTE_STYLE.clearance),node.x+node.w+Math.max(weight/2,ROUTE_STYLE.clearance)]);
 for(const line of others)if(!line.h&&overlap(lo,hi,line.a[1],line.b[1])>.01){
  const gap=Math.max(separation(weight,line.weight),exteriorLane(line,nodes)?railGap:0);blocked.push([line.a[0]-gap,line.a[0]+gap]);
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
   // The center corridor keeps a visible gap between leads; when it is full
   // the next lead uses its column's exterior, and only a chassis with no
   // exterior room falls back to the tightest separate center tracks.
   const free=gap=>{const candidates=[lo,hi,(lo+hi)/2,...tracks.flatMap(t=>{const g=gap(t);return [t.x,t.x-g,t.x+g];})].filter(x=>x>=lo-1e-7&&x<=hi+1e-7)
    .sort((a,b)=>spec.column==='left'?a-b:b-a);
    return spec.bands.length?candidates.find(x=>!tracks.some(t=>Math.min(high,t.high)>Math.max(low,t.low)&&Math.abs(x-t.x)<gap(t)-1e-7)):undefined;};
   const roomy=free(t=>separation(width,t.weight)),tight=free(t=>(width+t.weight)/2+.25);
   const outside=outer[spec.column],prior=outside.at(-1),distance=prior?prior.distance+Math.max(pitch,ROUTE_STYLE.pitch,separation(prior.weight,width)):Math.max(ROUTE_STYLE.clearance,width/2+4),outerX=spec.outer+(spec.column==='left'?-1:1)*distance;
   const travel=x=>Math.abs(x-anchor.x)+(Number.isFinite(spec.peerX)?Math.abs(x-spec.peerX):0);
   const outerClear=outerX-width/2>=minX&&outerX+width/2<=maxX,outerOpen=outerClear&&spec.outerBands.length;
   const preferOuter=outerOpen&&Number.isFinite(spec.peerX)&&travel(outerX)+.01<travel(roomy??Infinity);
   const x=roomy!==undefined&&!preferOuter?roomy:!outerOpen?tight:undefined;
   if(x!==undefined){tracks.push({x,low,high,weight:width,anchor});result.set(anchor,{x,via:'center'});}
   else{
    if(!spec.outerBands.length||!outerClear)throw Object.assign(Error('This module has no free cable corridor. Enlarge the device or move the edited socket.'),{code:'CORE_LAYOUT_CAPACITY',owner:spec.owner,port:anchor.port});
    outside.push({distance,weight:width});result.set(anchor,{x:outerX,via:'outer'});
   }
  }
  // Spread the center tracks evenly across the corridor (order preserved).
  // Leads leaving up and down share one corridor even when their measured
  // channels differ slightly, so overlapping channels are spread together
  // inside their common width.
  const byChannel=[];
  for(const t of tracks.slice().sort((a,b)=>a.anchor.moduleEscape.channel[0]-b.anchor.moduleEscape.channel[0])){
   const [c0,c1]=t.anchor.moduleEscape.channel,group=byChannel.find(g=>Math.min(g.hi,c1)>Math.max(g.lo,c0));
   if(group){group.list.push(t);group.lo=Math.max(group.lo,c0);group.hi=Math.min(group.hi,c1);}else byChannel.push({list:[t],lo:c0,hi:c1});
  }
  for(const {list,lo:c0,hi:c1} of byChannel){
   // Mixed channels keep the planned tracks, which already hold the gap
   // across both directions; re-spreading would squeeze the wider channel.
   if(new Set(list.map(t=>t.anchor.moduleEscape.channel.join('/'))).size>1)continue;
   const sorted=list.slice().sort((a,b)=>a.x-b.x),touch=(a,b)=>Math.min(a.high,b.high)>Math.max(a.low,b.low);
   for(const [i,t] of sorted.entries()){t.layer=0;for(const prior of sorted.slice(0,i))if(touch(prior,t))t.layer=Math.max(t.layer,prior.layer+1);}
   const layers=Math.max(...sorted.map(t=>t.layer))+1,width=Math.max(...sorted.map(t=>t.weight));
   const lo=c0+width/2,hi=c1-width/2,step=layers>1?Math.min(ROUTE_STYLE.pitch,(hi-lo)/(layers-1)):0;
   // An even spread tighter than the visible gap keeps the planned tracks,
   // which already hold that gap (or the tight fallback of a full chassis).
   const minimum=Math.max(...sorted.map(t=>(t.weight+width)/2+.25)),roomy=sorted.every((t,i)=>sorted.every((u,j)=>i===j||!touch(t,u)||Math.abs(t.x-u.x)>=separation(t.weight,u.weight)-1e-7));
   if(layers>1&&(step<minimum-1e-7||roomy&&step<Math.max(...sorted.map(t=>separation(t.weight,width)))-1e-7))continue;
   const start=(lo+hi)/2-step*(layers-1)/2;
   for(const t of sorted){t.x=start+t.layer*step;result.get(t.anchor).x=t.x;}
  }
  const groups=new Map();
  for(const anchor of bank){const key=anchor.moduleEscape.region;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(anchor);}
  for(const group of groups.values()){
   const order=group.slice().sort((a,b)=>Math.abs(result.get(a).x-a.x)-Math.abs(result.get(b).x-b.x)||a.y-b.y||a.port.localeCompare(b.port));
   let chosen;
   // Prefer a readable module pitch with clear socket edges; tighter levels
   // and the full band only when the bay is small.
   for(const [inset,level] of [true,false].flatMap(inset=>[ROUTE_STYLE.modulePitch,7,5.5,0].map(level=>[inset,level]))){
    if(chosen)break;
    const placed=[];
    for(const anchor of order){
     const target=result.get(anchor),spec=anchor.moduleEscape,bands=target.via==='center'?spec.bands:spec.outerBands;
     // Use the band above or below the sockets with the most room per lead,
     // so a busy module splits its turns instead of crowding one band.
     let best;
     // Bands run edge to edge between module frames and socket rows. Keep a
     // visible gap from both edges; a band too small for it uses its middle.
     const pad=inset?(anchor.weight||weight)/2+3:0;
     for(const [index,band] of bands.entries()){
      const [lo,hi]=!pad?band:band[1]-band[0]>2*pad?[band[0]+pad,band[1]-pad]:[(band[0]+band[1])/2,(band[0]+band[1])/2];
      const separation=p=>Math.max(level,((anchor.weight||weight)+(p.anchor.weight||weight))/2+.25);
      const candidates=[lo,hi,...placed.flatMap(p=>[p.y-separation(p),p.y+separation(p)])].filter(y=>y>=lo-1e-7&&y<=hi+1e-7).sort((a,b)=>Math.abs(a-anchor.y)-Math.abs(b-anchor.y));
      const y=candidates.find(y=>!placed.some(p=>overlap(anchor.x,target.x,p.anchor.x,p.x)>.01&&Math.abs(y-p.y)<separation(p)-1e-7));
      if(y===undefined)continue;
      const room=(hi-lo)/(placed.filter(p=>p.band[0]===lo&&p.band[1]===hi).length+1);
      if(!best||room>best.room+1e-7)best={y,band:[lo,hi],room,index};
     }
     if(!best)break;
     placed.push({anchor,x:target.x,y:best.y,band:best.band});
    }
    if(placed.length===order.length){chosen=placed;break;}
   }
   if(!chosen)throw Object.assign(Error('This module needs more room for separate cables. Enlarge the device or move some connections to another page.'),{code:'CORE_LAYOUT_CAPACITY',owner:order[0].moduleEscape.owner,port:order[0].port});
   // Even spacing inside each band, keeping the chosen order of overlapping turns.
   // Center and exterior turns can use overlapping bands of the same module;
   // those keep their first placement, which already holds every separation.
   const bands=new Map();for(const p of chosen){const key=p.band.join('/');if(!bands.has(key))bands.set(key,[]);bands.get(key).push(p);}
   const shared=key=>{const [lo,hi]=key.split('/').map(Number);return [...bands.keys()].some(other=>{if(other===key)return false;const [a,b]=other.split('/').map(Number);return Math.min(hi,b)>Math.max(lo,a)+1e-7;});};
   for(const [key,list] of bands.entries()){
    if(shared(key))continue;
    const sorted=list.slice().sort((a,b)=>a.y-b.y),touch=(a,b)=>overlap(a.anchor.x,a.x,b.anchor.x,b.x)>.01;
    for(const [i,p] of sorted.entries()){p.layer=0;for(const prior of sorted.slice(0,i))if(touch(prior,p))p.layer=Math.max(p.layer,prior.layer+1);}
    const layers=Math.max(...sorted.map(p=>p.layer))+1,[lo,hi]=sorted[0].band;
    // A lone turn runs along the middle of its band, clear of the socket edges.
    if(layers<2){for(const p of sorted)p.y=(lo+hi)/2;continue;}
    const step=Math.min(ROUTE_STYLE.rowPitch,(hi-lo)/(layers-1)),start=(lo+hi)/2-step*(layers-1)/2;
    if(step+1e-7<Math.max(...sorted.map(p=>(p.anchor.weight||weight)+.25)))continue;
    for(const p of sorted)p.y=start+p.layer*step;
   }
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
 for(const y of ys)if(turnsClear(a,y)&&turnsClear(b,y))candidates.push({...route,shape:'z',a:{...a,ay:y},b:{...b,ay:y},points:clean([[ax,a.anchor.y],[ax,y],[bx,y],[bx,b.anchor.y]])});
 if(ax===bx&&((a.anchor.side==='bottom'&&b.anchor.side==='top'&&a.anchor.y<b.anchor.y)||(a.anchor.side==='top'&&b.anchor.side==='bottom'&&a.anchor.y>b.anchor.y)))candidates.push({...route,shape:'direct',points:[[ax,a.anchor.y],[bx,b.anchor.y]]});
 // Compact circuit cards can leave an open corridor inside the stack width.
 // Consider those rails before accepting a long trip around the whole rack.
 if(a.node.kind==='handoff'||b.node.kind==='handoff'){
  const stack=[...nodes.values()].filter(n=>n.kind!=='handoff');
  if(stack.length){const left=Math.min(...stack.map(n=>n.x)),right=Math.max(...stack.map(n=>n.x+n.w));
   const rails=new Set([route.rail,left+8,right-8,ax,bx,...[...nodes.values()].flatMap(n=>[n.x-ROUTE_STYLE.clearance,n.x+n.w+ROUTE_STYLE.clearance])]);
   // Two cards on one row can need the same side. Give their departure
   // segments separate lanes instead of accepting a shared horizontal run.
   const departures=[{a,b}];for(const offset of [-12,12]){const end=a.node.kind==='handoff'?'a':'b',v=end==='a'?a:b,y=v.ay+offset;if(turnsClear(v,y))departures.push({a,b,[end]:{...v,ay:y}});}
   for(const {a,b} of departures)for(const rail of rails)if(rail===route.rail||rail>left&&rail<right)candidates.push({...route,shape:'rail',a,b,rail,side:rail<(left+right)/2?'left':'right',points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])});
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
// Neat channels: after routing, the movable runs of every cable (the
// horizontal departure rows in body gaps and the vertical rails beside the
// equipment) are redistributed onto evenly pitched tracks. Order is preserved
// among runs that overlap, so crossings are unchanged; tracks keep the
// standard clearance from device bodies and leave the device title/detail bands
// free when the gap allows. Every channel change is kept only when it adds no
// obstruction, merged segment or crossing.
function fixedEnd(v){return !v||v.anchor.escapeY!=null||!!v.anchor.escapeRange;}
// Off-page cables that leave one side of a device trade their rows so the
// lane farthest out ends nearest the device: none then crosses another on its
// way to the tag column. Kept only when the page has fewer crossings.
function crossingCount(paths){
 const segments=paths.flatMap((points,owner)=>points.slice(1).map((b,i)=>({owner,a:points[i],b})));let count=0;
 for(const h of segments.filter(s=>s.a[1]===s.b[1]&&s.a[0]!==s.b[0]))for(const v of segments.filter(s=>s.a[0]===s.b[0]&&s.a[1]!==s.b[1])){
  if(h.owner===v.owner)continue;const x=v.a[0],y=h.a[1];
  if(x>Math.min(h.a[0],h.b[0])+.5&&x<Math.max(h.a[0],h.b[0])-.5&&y>Math.min(v.a[1],v.b[1])+.5&&y<Math.max(v.a[1],v.b[1])-.5)count++;
 }
 return count;
}
function untangleReferences(references,routes){
 const groups=new Map();for(const r of references){const key=r.v.node.key+'|'+r.v.anchor.side;groups.set(key,[...(groups.get(key)||[]),r]);}
 for(const group of groups.values()){
  if(group.length<2)continue;
  const before=group.map(r=>({ay:r.v.ay,y:r.y,points:r.points})),score=()=>crossingCount(routes.map(r=>r.points));
  const baseline=score(),lane=r=>r.points.length>=2?r.points.at(-2)[0]:r.v.anchor.x,top=group[0].v.anchor.side==='top';
  // Rows nearest the device first; lanes from the outside (left) in.
  const rows=group.map(r=>r.v.ay).sort((a,b)=>top?b-a:a-b),order=[...group].sort((a,b)=>lane(a)-lane(b));
  order.forEach((r,i)=>{r.v.ay=rows[i];r.y=rows[i];r.points=composeRoute(r);});
  if(score()>=baseline)group.forEach((r,i)=>{r.v.ay=before[i].ay;r.y=before[i].y;r.points=before[i].points;});
 }
}
function composeRoute(r){
 if(r.v)return clean([...lead(r.v),[r.x,r.v.ay]]);
 if(r.shape==='direct')return r.points;
 if(r.shape==='z')return clean([[r.a.anchor.x,r.a.anchor.y],[r.a.anchor.x,r.a.ay],[r.b.anchor.x,r.b.ay],[r.b.anchor.x,r.b.anchor.y]]);
 return clean([...lead(r.a),[r.rail,r.a.ay],[r.rail,r.b.ay],...lead(r.b).reverse()]);
}
function sameRoute(points,r){const next=composeRoute(r);return next.length===points.length&&next.every((p,i)=>Math.abs(p[0]-points[i][0])<.01&&Math.abs(p[1]-points[i][1])<.01);}
function rowItems(routes){
 const items=[],row=(r,ends,c,xs)=>({r,ends,c,lo:Math.min(...xs),hi:Math.max(...xs),w:r.weight||4,set:c=>{for(const k of ends)r[k]={...r[k],ay:c};}});
 for(const r of routes){
  if(r.shape==='direct'||!sameRoute(r.points,r))continue;
  if(r.v){if(!fixedEnd(r.v))items.push(row(r,['v'],r.v.ay,[r.v.exitX,r.x]));continue;}
  if(r.shape==='z'||Math.abs(r.a.ay-r.b.ay)<.01){
   if(fixedEnd(r.a)||fixedEnd(r.b))continue;
   items.push(row(r,['a','b'],r.a.ay,r.shape==='z'?[r.a.anchor.x,r.b.anchor.x]:[r.a.exitX,r.b.exitX,r.rail]));continue;
  }
  for(const k of ['a','b'])if(!fixedEnd(r[k]))items.push(row(r,[k],r[k].ay,[r[k].exitX,r.rail]));
 }
 return items;
}
// Vertical runs: rails between the two departure rows, and the exterior lane
// of a chassis lead (which may continue as the rail when both share an x).
function railItems(routes){
 const items=[];
 for(const r of routes){
  if(r.shape==='z'||r.shape==='direct'||!sameRoute(r.points,r))continue;
  const w=r.weight||4,ends=r.v?[['v',r.v]]:[['a',r.a],['b',r.b]],merged=new Set();
  for(const [k,v] of ends){
   if(v.moduleEscape?.via!=='outer'||Math.abs(v.exitX-v.moduleEscape.x)>.01)continue;
   const other=r.v?null:r[k==='a'?'b':'a'],joined=!r.v&&Math.abs(r.rail-v.exitX)<.01&&Math.abs(r.a.ay-r.b.ay)>.01;
   if(joined)merged.add(k);
   const ys=[v.moduleEscape.y,joined?other.ay:v.ay];
   items.push({r,c:v.exitX,lo:Math.min(...ys),hi:Math.max(...ys),w,lane:k,turn:v.anchor.x,set:c=>{r[k]={...r[k],exitX:c,moduleEscape:{...r[k].moduleEscape,x:c}};if(joined)r.rail=c;}});
  }
  if(r.v||!Number.isFinite(r.rail)||merged.size||Math.abs(r.a.ay-r.b.ay)<.01||Math.abs(r.rail-r.a.exitX)<.01||Math.abs(r.rail-r.b.exitX)<.01)continue;
  items.push({r,c:r.rail,lo:Math.min(r.a.ay,r.b.ay),hi:Math.max(r.a.ay,r.b.ay),w,set:c=>{r.rail=c;}});
 }
 return items;
}
// Bounds along the channel axis: device bodies set the mode (open on one side,
// or a gap between two bodies); fixed segments and endpoint rules only limit.
function channelBounds(item,axis,nodes,fixed,reserve){
 const margin=item.w/2;let span=[item.lo-margin,item.hi+margin],low=-Infinity,high=Infinity,lowNode=null,highNode=null;
 const scan=()=>{for(const n of nodes.values()){
  const [a,b,c,d]=axis==='y'?[n.x,n.x+n.w,n.y,n.y+n.h]:[n.y,n.y+n.h,n.x,n.x+n.w];
  if(overlap(span[0],span[1],a,b)<=.5)continue;
  if(d<=item.c+.01&&d>low){low=d;lowNode=n;}
  if(c>=item.c-.01&&c<high){high=c;highNode=n;}
 }};
 scan();
 // A row wholly beside the equipment (between an exterior lane and its rail)
 // still belongs to the body gap it runs through.
 if(axis==='y'&&!lowNode&&!highNode){span=[-Infinity,Infinity];scan();}
 // Exterior channels are one channel along the whole column; a gap between two
 // bodies is its own channel.
 const keyLow=lowNode&&highNode?lowNode.key:lowNode?'body':'open',keyHigh=lowNode&&highNode?highNode.key:highNode?'body':'open';
 const [lowReserve,highReserve]=reserve(item,lowNode,highNode);
 let min=low+lowReserve,max=high-highReserve,hardMin=-Infinity,hardMax=Infinity;
 for(const f of fixed){
  if(f.route===item.r||overlap(span[0],span[1],f.lo,f.hi)<=.01)continue;
  const gap=separation(item.w,f.w);
  if(f.c<item.c)hardMin=Math.max(hardMin,f.c+gap);else hardMax=Math.min(hardMax,f.c-gap);
 }
 return {min,max,hardMin,hardMax,key:keyLow+'|'+keyHigh,open:[!lowNode,!highNode]};
}
function layout1d(group,pitch,minPitch){
 // Layers: a run takes the next track after every overlapping run before it.
 const sorted=group.slice().sort((a,b)=>a.c-b.c||a.lo-b.lo),touch=(a,b)=>overlap(a.lo-a.w-4,a.hi+a.w+4,b.lo,b.hi)>0;
 const [openLow,openHigh]=[group.some(i=>i.bounds.open[0]),group.some(i=>i.bounds.open[1])];
 if(openLow&&openHigh)return null;
 const order=openLow?sorted.slice().reverse():sorted;
 for(const [i,item] of order.entries()){item.layer=0;for(const prior of order.slice(0,i))if(touch(prior,item))item.layer=Math.max(item.layer,prior.layer+1);}
 const tracks=Math.max(...group.map(i=>i.layer))+1;
 if(!openLow&&!openHigh){
  const min=Math.max(...group.map(i=>i.bounds.min)),max=Math.min(...group.map(i=>i.bounds.max)),room=max-min;
  if(room<0)return null;
  const step=tracks<2?0:Math.min(pitch,room/(tracks-1));
  if(tracks>1&&step<minPitch-.001)return null;
  // Keep the evenly pitched block where the router put it, inside the band.
  const span=step*(tracks-1),mean=group.reduce((n,i)=>n+i.c,0)/group.length;
  const start=Math.max(min,Math.min(max-span,mean-span/2));
  return new Map(group.map(i=>[i,start+i.layer*step]));
 }
 // One open side: pack against the body with an even pitch.
 const out=new Map(),dir=openLow?-1:1;
 for(const item of order.slice().sort((a,b)=>a.layer-b.layer)){
  let c=openLow?item.bounds.max:item.bounds.min;
  for(const [other,value] of out)if(other.layer<item.layer&&touch(other,item))c=dir>0?Math.max(c,value+pitch):Math.min(c,value-pitch);
  if(!Number.isFinite(c))return null;
  out.set(item,c);
 }
 return out;
}
function neatChannels(routes,ends,nodes,obstacles,{minX,maxX,railPitch,uniform=0}){
 // Only the moved cables need rescoring against the rest of the page.
 const local=list=>{const total=[0,0,0];for(const r of list){const others=[];for(const o of routes)if(o!==r)others.push(...geometry(o).lines);const v=routeScore(r,nodes,obstacles,others,minX,maxX,railPitch);total[0]+=v[0];total[1]+=v[1];total[2]+=v[3];}return total;};
 const snapshot=list=>list.map(r=>[r,r.points,r.rail,r.a,r.b,r.v,r.x]);
 const restore=saved=>{for(const [r,points,rail,a,b,v,x] of saved){r.points=points;r.rail=rail;r.a=a;r.b=b;r.v=v;r.x=x;}};
 // Apply a set of new coordinates; keep it only when it adds no obstruction,
 // merged segment or crossing (or, with fewer=true, removes a crossing).
 const apply=(changes,fewer=false)=>{
  const affected=[...new Set(changes.map(([item])=>item.r))],before=local(affected),saved=snapshot(affected);
  for(const [item,c] of changes)item.set(c);
  for(const r of affected)r.points=composeRoute(r);
  const after=local(affected);
  // A repair may trade one crossing (drawn with a jump) for a merged segment.
  if(after[0]<=before[0]&&(fewer==='separate'?after[1]<before[1]||after[1]===before[1]&&after[2]<=before[2]:(fewer||after[1]<=before[1])&&(fewer?after[2]<before[2]:after[2]<=before[2])))return true;
  restore(saved);return false;
 };
 // Device titles sit above a body and model/address details below it. Keep
 // those bands clear when the gap allows, otherwise fall back to clearance.
 const rowReserve=tight=>(item,above,below)=>{
  const reserveFor=(n,top)=>!n?0:tight||n.kind==='handoff'?Math.max(12,separation(item.w,item.w)):top?ROUTE_STYLE.titleReserve:ROUTE_STYLE.detailReserve;
  return [reserveFor(above,false),reserveFor(below,true)];
 };
 const railReserve=()=>()=>[ROUTE_STYLE.clearance,ROUTE_STYLE.clearance];
 const prepare=(kind,tight=false)=>{
  const row=kind==='row',items=row?rowItems(routes):railItems(routes);if(!items.length)return [];
  const fixed=[];
  for(const r of routes)for(const line of segments(r.points)){
   if(line.h!==row)continue;
   const c=line.a[row?1:0],lo=Math.min(line.a[row?0:1],line.b[row?0:1]),hi=Math.max(line.a[row?0:1],line.b[row?0:1]);
   if(items.some(i=>i.r===r&&Math.abs(i.c-c)<.01&&overlap(i.lo,i.hi,lo,hi)>-.01))continue;
   fixed.push({route:r,c,lo,hi,w:r.weight||4});
  }
  items.bound=(item,tight)=>{
   item.bounds=channelBounds(item,row?'y':'x',nodes,fixed,(row?rowReserve:railReserve)(tight));
   const limit=(edge,dir,room)=>{if(dir<0)item.bounds.hardMax=Math.min(item.bounds.hardMax,edge-room);else item.bounds.hardMin=Math.max(item.bounds.hardMin,edge+room);};
   // Every joined run keeps its direction: no lead or row may reverse.
   if(item.ends)for(const k of item.ends){const v=item.r[k],dir=v.anchor.side==='top'?-1:1;limit(v.anchor.edge,dir,Math.max(v.anchor.weight||4,Math.min(ROUTE_STYLE.clearance,dir*(v.ay-v.anchor.edge))));}
   else{
    // A joint shared with another movable run is checked at its new position.
    const lane=k=>items.find(i=>i.r===item.r&&i.lane===k),rail=items.find(i=>i.r===item.r&&!i.lane&&!i.ends);
    item.joints=item.lane?[{x:item.turn},...(Math.abs(item.r.rail-item.c)>.01?[{x:item.r.rail,item:rail}]:[])]:[{x:item.r.a.exitX,item:lane('a')},{x:item.r.b.exitX,item:lane('b')}];
    for(const joint of item.joints)if(!joint.item)limit(joint.x,joint.x>item.c?-1:1,separation(item.w,item.w));
   }
   if(!row){item.bounds.hardMin=Math.max(item.bounds.hardMin,minX+item.w);item.bounds.hardMax=Math.min(item.bounds.hardMax,maxX-item.w);}
  };
  for(const item of items)items.bound(item,tight);
  // Channels: runs between the same pair of bodies that touch along the axis.
  const groups=[],seen=new Set();
  for(const item of items){
   if(seen.has(item))continue;const group=[item];seen.add(item);
   for(let i=0;i<group.length;i++)for(const other of items)if(!seen.has(other)&&other.bounds.key===group[i].bounds.key&&overlap(group[i].lo-24,group[i].hi+24,other.lo,other.hi)>0){seen.add(other);group.push(other);}
   groups.push(group);
  }
  groups.bound=items.bound;return groups;
 };
 // Untangle: swapping the tracks of two overlapping runs in one channel
 // removes the crossing their order created. Bounded pairwise passes.
 const untangle=kind=>{
  let budget=Math.max(60,routes.length*12);
  for(const group of prepare(kind)){
   if(group.length<2)continue;
   for(let pass=0;pass<3&&budget>0;pass++){
    let improved=false;const sorted=group.slice().sort((a,b)=>a.c-b.c);
    for(let i=0;i<sorted.length&&budget>0;i++)for(let j=i+1;j<Math.min(sorted.length,i+5)&&budget>0;j++){
     const a=sorted[i],b=sorted[j];
     if(overlap(a.lo,a.hi,b.lo,b.hi)<=.01||a.r===b.r)continue;
     if(b.c<a.bounds.hardMin||b.c>a.bounds.hardMax||a.c<b.bounds.hardMin||a.c>b.bounds.hardMax)continue;
     const moved=new Map([[a,b.c],[b,a.c]]);
     if([a,b].some(item=>(item.joints||[]).some(j=>j.item&&Math.sign(j.x-item.c)!==Math.sign((moved.get(j.item)??j.item.c)-moved.get(item)))))continue;
     budget--;
     if(apply([[a,b.c],[b,a.c]],true)){[a.c,b.c]=[b.c,a.c];sorted[i]=b;sorted[j]=a;improved=true;}
    }
    if(!improved)break;
   }
  }
 };
 const pass=kind=>{
  const row=kind==='row',groups=prepare(kind),step=uniform?Math.max(uniform,row?0:railPitch):row?ROUTE_STYLE.rowPitch:Math.max(ROUTE_STYLE.pitch,railPitch);
  const plans=[];
  for(const group of groups){
   const minPitch=Math.max(...group.map(i=>separation(i.w,i.w)));
   const valid=placed=>placed&&[...placed].every(([item,c])=>c>=item.bounds.hardMin-.001&&c<=item.bounds.hardMax+.001&&
    (item.joints||[]).every(j=>!j.item||Math.sign(j.x-item.c)===Math.sign((placed.get(j.item)??j.item.c)-c)&&Math.abs((placed.get(j.item)??j.item.c)-c)>=separation(item.w,j.item.w)-.001));
   let placed=layout1d(group,step,minPitch);
   if(!valid(placed)&&row){for(const item of group)groups.bound(item,true);placed=layout1d(group,step,minPitch);}
   plans.push({group,placed,valid,minPitch});
  }
  // Even line spacing: every group in the same channel (one gap between two
  // bodies, or one exterior side) uses one shared lattice at the chosen pitch,
  // so bundles start at the same offset instead of where each was routed.
  if(uniform){
   const channels=new Map();
   for(const plan of plans){if(!plan.placed)continue;const key=plan.group[0].bounds.key;if(!channels.has(key))channels.set(key,[]);channels.get(key).push(plan);}
   for(const list of channels.values()){
    const items=list.flatMap(p=>p.group),open=items[0].bounds.open,layers=Math.max(...items.map(i=>i.layer))+1,minPitch=Math.max(...list.map(p=>p.minPitch));
    let place;
    if(!open[0]&&!open[1]){const lo=Math.max(...items.map(i=>i.bounds.min)),hi=Math.min(...items.map(i=>i.bounds.max)),u=layers<2?0:Math.min(step,(hi-lo)/(layers-1));if(hi<lo||layers>1&&u<minPitch-.001)continue;const start=Math.max(lo,(lo+hi)/2-u*(layers-1)/2);place=i=>start+i.layer*u;}
    else if(open[0]!==open[1]){const dir=open[0]?-1:1,base=open[0]?Math.min(...items.map(i=>i.bounds.max)):Math.max(...items.map(i=>i.bounds.min));if(!Number.isFinite(base))continue;place=i=>base+dir*i.layer*step;}
    else continue;
    for(const plan of list){const lattice=new Map(plan.group.map(i=>[i,place(i)]));if(plan.valid(lattice))plan.placed=lattice;}
   }
  }
  for(const {placed,valid} of plans){
   if(!valid(placed)||[...placed].every(([item,c])=>Math.abs(item.c-c)<.01))continue;
   apply([...placed]);
  }
 };
 // Untangled orders are accepted only if the spaced result is clean overall.
 const total=()=>{const v=score(routes,nodes,obstacles,minX,maxX,railPitch);return [v[0],v[1],v[3]];};
 // Untangled track orders are kept only when the evenly spaced result has
 // fewer crossings and no new obstruction or merged segment. Compare plain
 // spacing, all untangle stages together, and each stage on its own.
 const original=total(),raw=snapshot(routes),spaced=()=>{pass('rail');pass('row');pass('rail');},clean=next=>next[0]<=original[0]&&next[1]<=original[1];
 spaced();let best=total(),saved=snapshot(routes);
 if(!clean(best)||best[2]>original[2]){restore(raw);best=original;saved=raw;}
 restore(raw);untangle('rail');untangle('row');untangle('rail');spaced();
 let next=total();if(clean(next)&&next[2]<best[2]){best=next;saved=snapshot(routes);}
 restore(raw);let stage=raw,stageBest=original;
 for(const kind of ['rail','row','rail']){
  untangle(kind);const trial=snapshot(routes);spaced();next=total();
  if(clean(next)&&next[2]<stageBest[2]){stageBest=next;stage=trial;if(next[2]<best[2]){best=next;saved=snapshot(routes);}}
  restore(stage);
 }
 restore(saved);
 // Final repair: a run left closer than the visible gap to a parallel cable
 // moves to the nearest clear coordinate inside its channel, validated like
 // every other change. Bounded by a small budget per page.
 const leadConflicts=r=>{
  // Runs beside equipment closer than the clearance count too, so a repair
  // never trades a merged segment for a cable hugging a device.
  let count=0;const own=segments(r.points);for(const q of own)count+=hugs(q,r,nodes);
  for(const o of routes)if(o!==r)for(const t of segments(o.points))for(const q of own){
   if(q.h!==t.h)continue;const along=q.h?0:1,c1=q.a[q.h?1:0],c2=t.a[t.h?1:0];
   const lo=Math.max(Math.min(q.a[along],q.b[along]),Math.min(t.a[along],t.b[along])),hi=Math.min(Math.max(q.a[along],q.b[along]),Math.max(t.a[along],t.b[along]));
   // Collinear runs that almost meet end to end read as one cable, so a
   // break shorter than the standard clearance counts as well.
   if(hi-lo<=-ROUTE_STYLE.clearance||Math.abs(c1-c2)>=separation(r.weight||4,o.weight||4)-.001)continue;
   const mid=(lo+hi)/2,[x,y]=q.h?[mid,c1]:[c1,mid];
   if(![...nodes.values()].some(n=>x>n.x&&x<n.x+n.w&&y>n.y&&y<n.y+n.h))count++;
  }
  return count;
 };
 const repair=kind=>{
  const row=kind==='row';let budget=Math.max(40,routes.length*4);
  for(const group of prepare(kind))for(const item of group){
   if(budget<=0)return;
   const lines=routes.filter(o=>o!==item.r).flatMap(o=>segments(o.points).filter(l=>l.h===row).map(l=>({c:l.a[row?1:0],lo:Math.min(l.a[row?0:1],l.b[row?0:1]),hi:Math.max(l.a[row?0:1],l.b[row?0:1]),w:o.weight||4})));
   // Rails also keep the standard clearance from equipment they run beside.
   const beside=c=>!row&&!item.lane&&[...nodes.values()].some(n=>overlap(item.lo,item.hi,n.y,n.y+n.h)>1&&(c<n.x?n.x-c:c>n.x+n.w?c-n.x-n.w:-1)>=0&&(c<n.x?n.x-c:c-n.x-n.w)<ROUTE_STYLE.clearance-item.w/2-.01);
   const crowded=c=>beside(c)||lines.some(l=>overlap(item.lo,item.hi,l.lo,l.hi)>.01&&Math.abs(l.c-c)<separation(item.w,l.w)-.001);
   // Moving a row also moves the ends of its leads: count every parallel
   // overlap of the whole cable outside equipment, before and after.
   const touching=c=>{const saved=snapshot([item.r]);item.set(c);item.r.points=composeRoute(item.r);const n=leadConflicts(item.r);restore(saved);return n;};
   const base=leadConflicts(item.r);
   if(!base&&!crowded(item.c))continue;
   const options=[];for(let k=1;k<=30;k++)options.push(item.c+k*2,item.c-k*2);
   for(const c of options){
    if(c<item.bounds.hardMin-.001||c>item.bounds.hardMax+.001||crowded(c)||base&&touching(c)>=base)continue;
    if((item.joints||[]).some(j=>j.item&&(Math.sign(j.x-item.c)!==Math.sign(j.item.c-c)||Math.abs(j.item.c-c)<separation(item.w,j.item.w)-.001)))continue;
    budget--;if(apply([[item,c]],'separate')){item.c=c;break;}
    if(budget<=0)return;
   }
  }
 };
 repair('row');repair('rail');
 for(const r of routes){if(r.a)ends.set(r.e.idx+'/'+r.a.which,r.a);if(r.b)ends.set(r.e.idx+'/'+r.b.which,r.b);if(r.v){ends.set(r.e.idx+'/'+r.which,r.v);r.y=r.v.ay;}}
}
export function coreRoutes(internal,external,endData,banks,nodes,{left,right,pitch=22,railPitch=12,topClearance=50,bottomClearance=18,scale=1,obstacles=[],minX=306,maxX=1162,neat=true,uniform=0,referenceLabel=0,directionNeutralLevels=false}){
 const bodies=[...nodes.values()];
 if(bodies.some(n=>n.x<minX))minX=Math.min(minX,...bodies.map(n=>n.x))-Math.max(24,endData.size*railPitch);
 if(bodies.some(n=>n.x+n.w>maxX))maxX=Math.max(maxX,...bodies.map(n=>n.x+n.w))+Math.max(24,endData.size*railPitch);
 const sides=new Map(),moduleEscapes=planModuleEscapes([...endData.values()].map(v=>v.anchor),{pitch:Math.max(6,railPitch),minX,maxX}),stats={builds:1,candidates:0};
 for(const e of internal){const a=endData.get(e.idx+'/a'),b=endData.get(e.idx+'/b'),west=Math.min(a.node.x,b.node.x),east=Math.max(a.node.x+a.node.w,b.node.x+b.node.w);sides.set(e.idx,a.anchor.x+b.anchor.x>west+east?'right':'left');}
 function build(){
  const ends=new Map();
  for(const bank of banks.values()){
   const sorted=bank.slice().sort((a,b)=>{
    // Wireless leads from the same switch edge use one consistent physical
    // port order. Their levels no longer jump when the destination rail flips
    // from left to right. Other sheet families keep their existing ordering.
    if(directionNeutralLevels)return a.anchor.x-b.anchor.x||a.anchor.y-b.anchor.y||a.e.idx-b.e.idx;
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
   const lanePitch=Math.max(ROUTE_STYLE.pitch,railPitch),clear=ROUTE_STYLE.clearance;
   // Equipment in neighboring columns starts in the gap between them, not
   // around the outside of the whole drawing. Each gap keeps its own lanes.
   const [west,east]=[a.node,b.node].sort((x,y)=>x.x-y.x),gapLow=west.x+west.w+clear,gapHigh=east.x-clear;
   if(gapHigh-gapLow>=0&&a.node!==b.node){
    const key='gap:'+Math.round(gapLow);let lane=0;
    while(tracks.some(t=>t.side===key&&t.lane===lane&&Math.min(hi,t.hi)>Math.max(lo,t.lo)))lane++;
    const rail=gapLow+lanePitch*lane,blocked=[...nodes.values()].some(n=>n.y<hi&&n.y+n.h>lo&&rail>n.x-clear+.01&&rail<n.x+n.w+clear-.01);
    if(rail<=gapHigh+1e-6&&!blocked){tracks.push({side:key,lane,lo,hi,rail});routes.push({e,a,b,side:a.node===west?'right':'left',rail,weight:Math.max(a.anchor.weight||4,b.anchor.weight||4),hosts:[a.node.key,b.node.key],points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])});continue;}
   }
   let lane=0;while(tracks.some(t=>t.side===side&&t.lane===lane&&Math.min(hi,t.hi)>Math.max(lo,t.lo)))lane++;
   let rail=side==='left'?left-clear-lanePitch*lane:right+clear+lanePitch*lane;
   const blockers=[...nodes.values()].filter(n=>n.y<hi&&n.y+n.h>lo);
   const direction=side==='left'?-1:1;
   for(let attempt=0;attempt<=blockers.length+tracks.length;attempt++){
    const block=blockers.find(n=>rail>n.x-clear+.01&&rail<n.x+n.w+clear-.01);
    if(block){rail=direction<0?block.x-clear:block.x+block.w+clear;continue;}
    if(tracks.some(t=>Math.abs(t.rail-rail)<lanePitch-.01&&Math.min(hi,t.hi)>Math.max(lo,t.lo))){rail+=direction*lanePitch;continue;}
    break;
   }
   tracks.push({side,lane,lo,hi,rail});
   routes.push({e,a,b,side,rail,weight:Math.max(a.anchor.weight||4,b.anchor.weight||4),hosts:[a.node.key,b.node.key],points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])});
  }
  // Continuation badges sit outside the cable rails, not across a passing link.
  // Retain the existing boundary behavior for deliberately off-page edits.
  const referenceX=([...nodes.values()].every(n=>n.x>=minX&&n.x+n.w<=maxX)?Math.min(left-10,...tracks.filter(t=>t.side==='left').map(t=>t.rail-12)):left-10)-referenceLabel;
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
   for(const distance of [0,1,2,3].map(i=>Math.max(ROUTE_STYLE.clearance,route.weight/2+4)+i*Math.max(ROUTE_STYLE.pitch,railPitch)))for(const rail of [localLeft-distance,localRight+distance,a.node.x-distance,a.node.x+a.node.w+distance,b.node.x-distance,b.node.x+b.node.w+distance])rails.add(rail);
   for(const rail of gapRailCandidates(route,others,nodes,minX,maxX,railPitch))rails.add(rail);
   for(const rail of rails){const side=rail<(localLeft+localRight)/2?'left':'right';
     if(external.length&&side==='left'&&rail<referenceX+12)continue;
     const candidate={...route,shape:'rail',rail,side,points:clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()])};
     const value=evaluate(candidate);
     if(better(value,cost)){best=candidate;cost=value;}
    }
   const [west,east]=[a.node,b.node].sort((x,y)=>x.x-y.x);
   const low=west.x+west.w+ROUTE_STYLE.clearance,high=east.x-ROUTE_STYLE.clearance;
   if(low<=high){
    const count=Math.min(16,1+Math.floor((high-low)/Math.max(10,railPitch)));
    for(let j=0;j<count;j++){
     const rail=low+(high-low)*(j+.5)/count;
     const points=clean([...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()]);
     const candidate={...route,shape:'rail',rail,points};
     const value=evaluate(candidate);
     if(better(value,cost)){best=candidate;cost=value;}
    }
   }
   routes[i]=best;
   for(const v of [best.a,best.b])ends.set(v.e.idx+'/'+v.which,v);
  }
  if(neat)neatChannels(routes,ends,nodes,obstacles,{minX,maxX,railPitch,uniform});
  // Off-page tags line up in one column outside every finished left rail and
  // every lane of the other off-page cables, so no cable crosses a tag.
  if(references.length&&[...nodes.values()].every(n=>n.x>=minX&&n.x+n.w<=maxX)){
   const gap=Math.max(12,ROUTE_STYLE.pitch),lanes=routes.flatMap(r=>r.v?r.points.slice(0,-1):r.points).map(p=>p[0]).filter(x=>x<left);
   const x=Math.min(referenceX,...routes.filter(r=>!r.v&&Number.isFinite(r.rail)&&r.rail<left).map(r=>r.rail-gap-referenceLabel),...lanes.map(x=>x-gap-referenceLabel));
   if(x<referenceX&&x>=minX)for(const r of references){r.x=x;r.points=composeRoute(r);}
   untangleReferences(references,routes);
  }
  return {routes,references,ends};
 }
 const best=build(),cost=score(best.routes,nodes,obstacles,minX,maxX,railPitch);
 return {...best,cost,stats};
}
