// Deterministic placement against actual text boxes and every cable segment.
export function textWidth(value,size=12,bold=false){
 let w=0;for(const c of String(value)){w+=/[MW@%#]/.test(c)?.94:/[ilI1.,:;!|' ]/.test(c)?.29:/[A-Z]/.test(c)?.72:/[0-9]/.test(c)?.57:.56;}return Math.ceil(w*size*(bold?1.06:1)+6);
}
export function textFootprint(box){
 if(Math.abs(Math.abs(box.angle||0)-Math.PI/2)>1e-6)return box;
 return {...box,x:box.x+(box.w-box.h)/2,y:box.y+(box.h-box.w)/2,w:box.h,h:box.w,angle:0};
}
export const intersects=(first,second,pad=0)=>{
 const a=textFootprint(first),b=textFootprint(second);
 return a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;
};
export function crossesText(points,box,pad=2){
 box=textFootprint(box);
 const b={x:box.x-pad,y:box.y-pad,w:box.w+pad*2,h:box.h+pad*2};
 return points.slice(1).some((to,i)=>{const from=points[i];return from[1]===to[1]?from[1]>b.y&&from[1]<b.y+b.h&&Math.max(from[0],to[0])>b.x&&Math.min(from[0],to[0])<b.x+b.w:from[0]>b.x&&from[0]<b.x+b.w&&Math.max(from[1],to[1])>b.y&&Math.min(from[1],to[1])<b.y+b.h;});
}
export const pathCrossesText=(path,box,pad=2)=>crossesText(path.points,box,pad)||(path.hops||[]).some(hop=>intersects(hop,box,pad));
export function embeddedTextBoxes(page){
 const result=[];for(const g of page.items.filter(i=>i.type==='device')){
  for(const c of g.children.filter(c=>c.type==='text'))result.push({x:g.x+c.x*g.w,y:g.y+c.y*g.h,w:Math.max(c.w*g.w,textWidth(c.value,c.size,c.bold)),h:c.h*g.h,owner:g});
  for(const t of g.asset?.native?.texts||[]){const width=t.w*g.w,w=Math.max(width,textWidth(t.text,t.size*g.w,t.bold)),x=g.x+t.x*g.w-width/2;result.push({x:t.align==='left'?x:t.align==='right'?x+width-w:g.x+t.x*g.w-w/2,y:g.y+t.y*g.h-t.size*g.w*.7,w,h:t.size*g.w*1.4,owner:g});}
 }return result;
}
// Only enumerate offsets which can produce an on-page label. Keep the original
// grid phase and search order even when the starting point is far off-page.
function visibleOffsets(origin,direction,step,limit,lo,hi){
 if(![origin,step,limit,lo,hi].every(Number.isFinite)||lo>hi)return [];
 const first=Math.ceil(Math.max(0,direction>0?lo-origin:origin-hi)/step),last=Math.floor(Math.min(limit,direction>0?hi-origin:origin-lo)/step);
 const count=Math.max(0,Math.min(last-first+1,Math.ceil((hi-lo)/step)+2,512)),out=[];
 for(let i=0;i<count;i++){const offset=(first+i)*step,x=origin+direction*offset;if(x>=lo&&x<=hi)out.push({offset,x,direction});}
 return out;
}
export function placeDeviceTitles(page,project,nodes){
 const minX=page.dynamic?(page.originX||0)+36:page.legendLayout==='sidebar'?(page.sidebar?.titleLeft??318):38,minY=page.dynamic?(page.originY||0)+36:151,maxX=(page.originX||0)+(page.width||1200)-38,maxY=(page.originY||0)+(page.height||975)-69;
 const edits=project.layout?.drawingEdits||{},titles=page.items.filter(i=>i.titleOwner),paths=page.items.filter(i=>i.type==='path'),bodies=[...nodes.values()],occupied=[...page.items.filter(i=>i.type==='text'&&!i.titleOwner).map(i=>({...i})),...embeddedTextBoxes(page)];
 for(const node of bodies)for(const slot of ['title','detail']){
  const group=titles.filter(i=>i.titleOwner===node.sourceId&&(i.titleSlot||'title')===slot);if(!group.length)continue;
  const fixed=group.some(i=>Number.isFinite(edits[i.editKey]?.x)||Number.isFinite(edits[i.editKey]?.y));if(fixed){occupied.push(...group);continue;}
  // Caption boxes are measured before placement and can contain wrapped text.
  // Reserving the complete string's unwrapped width would make a valid box
  // impossible to place, even when it fits by itself on an otherwise empty page.
  const x0=group[0].x,y0=group[0].y,w=Math.max(...group.map(i=>i.x-x0+i.w)),h=Math.max(...group.map(i=>i.y-y0+i.h)),candidates=[];
  const xs=visibleOffsets(node.x,1,8,Math.max(0,node.w-w),minX,maxX-w).map(p=>p.x);
  if(slot==='detail')for(const x of xs)candidates.push({x,y:node.y+node.h+5,w,h});
  for(const gap of [5,9,14,20,28,38,50,64])for(const x of xs)candidates.push({x,y:node.y-h-gap,w,h});
  for(const gap of [7,12,18,26,36,48])for(const x of xs)candidates.push({x,y:node.y+node.h+gap,w,h});
  candidates.push({x:node.x-w-12,y:node.y,w,h},{x:node.x+node.w+12,y:node.y,w,h});
  const clear=b=>!bodies.some(n=>intersects(b,n,3))&&!occupied.some(t=>intersects(b,t,3))&&!paths.some(p=>pathCrossesText(p,b,3));
  let fit=candidates.find(b=>b.x>=minX&&b.x+b.w<=maxX&&b.y>=minY&&b.y+b.h<maxY&&clear(b));
  if(!fit&&page.dynamic){
   // A growing canvas has no paper boundary. Search obstacle edges near the
   // device, then reserve an outside column if the surrounding routes are full.
   // Merely increasing page height cannot fix a blocked caption beside a body.
   const obstacles=[...bodies,...occupied,...paths.flatMap(p=>p.points.map(([x,y])=>({x,y,w:0,h:0})))],preferredY=slot==='detail'?node.y+node.h+5:node.y-h-6;
   const nearest=(values,origin)=>[...new Set(values)].sort((a,b)=>Math.abs(a-origin)-Math.abs(b-origin)).slice(0,64);
   const xs=nearest([node.x,node.x+node.w-w,...obstacles.flatMap(b=>[b.x-w-12,b.x+b.w+12])],node.x),ys=nearest([preferredY,...obstacles.flatMap(b=>[b.y-h-9,b.y+b.h+9])],preferredY);
   const extra=xs.flatMap(x=>ys.map(y=>({x,y,w,h}))).sort((a,b)=>Math.abs(a.x-node.x)+Math.abs(a.y-preferredY)-Math.abs(b.x-node.x)-Math.abs(b.y-preferredY));
   fit=extra.find(clear)||{x:Math.max(...obstacles.map(b=>b.x+b.w))+24,y:preferredY,w,h};
  }
  if(!fit){const error=Error('This page needs more space for a device title. Move a device to another core page.');Object.assign(error,{code:'CORE_LAYOUT_CAPACITY',role:'title',owner:node.sourceId,page:page.name,slot});throw error;}
  for(const t of group){t.x+=fit.x-x0;t.y+=fit.y-y0;occupied.push({...t});}
 }
}
// A displaced caption can still identify its cable through a clear, short leader.
function cableLeader(box,owner,paths,obstacles){
 const candidates=[];
 for(let i=1;i<owner.points.length;i++){
  const a=owner.points[i-1],b=owner.points[i],vertical=a[0]===b[0],axis=vertical?1:0;
  const start=vertical?box.y:box.x,length=vertical?box.h:box.w;
  const lo=Math.max(start+2,Math.min(a[axis],b[axis])+3),hi=Math.min(start+length-2,Math.max(a[axis],b[axis])-3);
  if(lo>hi)continue;
  const along=Math.max(lo,Math.min(hi,start+length/2));
  const from=vertical?a[0]:a[1],edge=vertical?box.x:box.y,end=edge+(from<edge?0:vertical?box.w:box.h);
  const distance=Math.abs(end-from);
  if(distance>120||distance<2)continue;
  const leader=vertical?{x:Math.min(from,end),y:along-.5,w:distance,h:1}:{x:along-.5,y:Math.min(from,end),w:1,h:distance};
  if(obstacles.some(o=>intersects(leader,o,2))||paths.some(path=>path!==owner&&pathCrossesText(path,leader,2)))continue;
  candidates.push({leader,distance});
 }
 return candidates.sort((a,b)=>a.distance-b.distance)[0]?.leader;
}
// Shortest gap between a text box and a cable's segments (0 when touching).
function boxDistance(box,path){
 let best=Infinity;
 for(let i=1;i<(path?.points?.length||0);i++){
  const [a,b]=[path.points[i-1],path.points[i]],x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
  const dx=Math.max(0,box.x-x1,x0-(box.x+box.w)),dy=Math.max(0,box.y-y1,y0-(box.y+box.h));best=Math.min(best,Math.hypot(dx,dy));
 }
 return best;
}
export function placeCableLabels(page,requests,edits={},{portLeaders=false}={}){
 const minY=page.dynamic?(page.originY||0)+36:158,maxY=(page.originY||0)+(page.height||975)-69,maxX=(page.originX||0)+(page.width||1200)-38;
 const occupied=[...page.items.filter(i=>i.type==='text').map(i=>({...i})),...embeddedTextBoxes(page)],bodies=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),paths=page.items.filter(i=>i.type==='path');
 const result=[],sidebar=page.legendLayout==='sidebar',contentLeft=page.dynamic?(page.originX||0)+36:sidebar?(page.sidebar?.contentLeft??306):38;
 const measure=req=>{
  const source=Array.isArray(req.value)?req.value:[req.value],patches=source.map((_,i)=>edits[req.editKey+'|'+i]||{}),size=Math.max(req.minSize??12,req.size||12,...patches.map(p=>p.size||0)),maxWidth=sidebar?(req.role==='media'&&page.dynamic?180:96):req.side==='right'?Math.max(96,1154-Math.max(req.outer+8,984)):Math.max(100,Math.min(req.outer-46,250));
  const lines=[];for(const [index,original] of source.entries()){const patch=patches[index];if(patch.hidden)continue;const value=patch.value??original;let line='',fragment=0;const push=()=>lines.push({value:line,patch,key:req.editKey+'|'+index+(fragment++?'|wrap'+fragment:'')});for(const char of String(value)){if(line&&textWidth(line+char,size,true)>maxWidth){push();line='';}line+=char;}if(line)push();}
  return {patches,size,lines,w:lines.length?Math.max(...lines.map(s=>textWidth(s.value,size,s.patch.bold!==false))):0,h:lines.length*(size+4)};
 };
 const clear=(b,owner,inline)=>!(b.x<contentLeft||b.x+b.w>maxX||b.y<minY||b.y+b.h>maxY||occupied.some(o=>intersects(b,o,3))||bodies.some(o=>intersects(b,o,3))||paths.some(p=>inline&&p===owner?(p.hops||[]).some(hop=>intersects(hop,b,2)):pathCrossesText(p,b,2)));
 // Port names of leads leaving the same side of one device sit in line: one
 // shared distance from the device, each beside its lead on a common side,
 // or on its own line (white background) where there is no room beside it.
 const banked=new Set();
 // Port names of leads leaving the same side of one device sit in line: one
 // shared distance from the device edge, beside each lead on a common side or
 // on its own line (white background) where there is no room beside it. A
 // lead belongs to the side it crosses when it actually leaves its device.
 const strictlyInside=([x,y],n)=>x>n.x+.01&&x<n.x+n.w-.01&&y>n.y+.01&&y<n.y+n.h-.01,within=([x,y],n)=>x>=n.x-.01&&x<=n.x+n.w+.01&&y>=n.y-.01&&y<=n.y+n.h+.01;
 const banks=new Map();
 for(const req of requests){
  if(req.role!=='port'||!req.bank||req.linkId==null)continue;
  const owner=paths.find(path=>path.linkId===req.linkId),m=measure(req);
  if(!owner||m.lines.length!==1||m.patches.some(p=>Number.isFinite(p.x)||Number.isFinite(p.y)))continue;
  const points=req.endpoint&&req.endpoint!==(owner.startEndpoint||'a')?[...owner.points].reverse():owner.points;
  let lead=null;
  for(let i=0;i+1<points.length&&!lead;i++){
   const a=points[i],b=points[i+1],host=bodies.find(n=>within(a,n)&&!strictlyInside(b,n)&&!within(b,n));if(!host)continue;
   const vertical=a[0]===b[0];if(vertical===(a[1]===b[1]))break;
   const axis=vertical?1:0,dir=Math.sign(b[axis]-a[axis]),from=vertical?(dir<0?host.y:host.y+host.h):(dir<0?host.x:host.x+host.w);
   if(Math.abs(b[axis]-from)<m.w+16)break;
   lead={req,owner,m,axis,dir,at:vertical?a[0]:a[1],from,to:b[axis],side:(host.key||host.sourceId)+'|'+(vertical?(dir<0?'top':'bottom'):(dir<0?'left':'right'))};
  }
  if(lead)banks.set(lead.side,[...(banks.get(lead.side)||[]),lead]);
 }
 for(const leads of banks.values()){
  if(leads.length<2)continue;
  const {axis,dir}=leads[0],length=Math.max(...leads.map(l=>l.m.w)),near=dir<0?Math.min(...leads.map(l=>l.from)):Math.max(...leads.map(l=>l.from)),far=dir<0?Math.max(...leads.map(l=>l.to)):Math.min(...leads.map(l=>l.to));
  let best=null;leads.sort((p,q)=>p.at-q.at);
  // From the device outward, bounded; each name ends at the same distance
  // from the edge. One style for the row (beside on one side, or on the line),
  // a mixed row only where a side is taken; most names in line wins.
  const sides=axis===1?['left','right']:['above','below'];
  for(let step=0,start=near+dir*8;step<60&&(far-start)*dir>=length+4;step++,start+=dir*4){
   for(const [rank,mode] of [sides[0],sides[1],'inline',sides[0]+'+inline',sides[1]+'+inline'].entries()){
    const placed=[];
    for(const lead of leads){
     const {m}=lead,th=m.h,lo=dir<0?start-m.w:start,middle=lo+m.w/2,inlineLength=m.w+8;
     // Vertical leads carry rotated text; horizontal leads carry level text.
     const inline=axis===1?{x:lead.at-inlineLength/2,y:middle-th/2,w:inlineLength,h:th,angle:Math.PI/2,inline:true,parts:[inlineLength]}:{x:middle-inlineLength/2,y:lead.at-th/2,w:inlineLength,h:th,inline:true,parts:[inlineLength]};
     const beside=side=>axis===1?{x:(side==='left'?lead.at-th-4:lead.at+4)+(th-m.w)/2,y:middle-th/2,w:m.w,h:th,angle:Math.PI/2,attached:true}:{x:lo,y:side==='above'?lead.at-th-4:lead.at+4,w:m.w,h:th,attached:true};
     const options=mode==='inline'?[inline]:mode.includes('+')?[beside(mode.split('+')[0]),inline]:[beside(mode)];
     for(const box of options){
      const f=textFootprint(box);
      if(clear(f,lead.owner,box.inline)&&!placed.some(q=>intersects(f,q.footprint,3))&&(box.inline||!pathCrossesText(lead.owner,f,1))){placed.push({lead,box,footprint:f});break;}
     }
    }
    if(placed.length>=2&&(!best||placed.length>best.placed.length||placed.length===best.placed.length&&rank<best.rank))best={placed,rank};
   }
   if(best?.placed.length===leads.length&&best.rank===0)break;
  }
  if(!best)continue;
  for(const {lead,box,footprint} of best.placed){
   const {req,m}=lead;occupied.push(footprint);banked.add(req);
   // Names end nearest the device so the row reads evenly.
   result.push({...req,...box,lines:m.lines,size:m.size,textAlign:axis===1?(dir<0?'left':'right'):(dir<0?'right':'left')});
  }
 }
 // One request at one text size: the chosen box, or null when nothing fits.
 const placeOne=req=>{
  const {patches,size,lines,w,h}=measure(req),candidates=[];if(!lines.length)return {skip:true};
  // A moved label is pinned, not an automatic-placement suggestion. Preserve
  // its exact saved coordinates across redraws and page format changes.
  const pinned=patches.find(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(pinned)return {box:{x:pinned.x,y:pinned.y,w:Math.max(w,pinned.w||0),h:Math.max(h,pinned.h||0),angle:pinned.angle||0,manual:true},lines,size};
  const owner=paths.find(path=>path.linkId===req.linkId&&req.linkId!=null);let endpoint=null,nearSegments=1,half=Infinity,leaves=0;
  // The cable read from this label's own end, with the distance along it to
  // each bend, so a port name never settles by the far end's port.
  const points=owner?(req.endpoint&&req.endpoint!==(owner.startEndpoint||'a')?[...owner.points].reverse():owner.points):[],travelled=[0];
  for(let i=1;i<points.length;i++)travelled.push(travelled[i-1]+Math.abs(points[i][0]-points[i-1][0])+Math.abs(points[i][1]-points[i-1][1]));
  if(owner){
   const segments=points.slice(1).map((b,i)=>[points[i],b]);
   // "Near the port" starts where the cable leaves its equipment: a chassis
   // module lead first runs inside the body, where no label can sit.
   const inside=([x,y])=>bodies.some(n=>x>n.x&&x<n.x+n.w&&y>n.y&&y<n.y+n.h),firstOut=Math.max(0,segments.findIndex(([a,b])=>!inside([(a[0]+b[0])/2,(a[1]+b[1])/2])));
   nearSegments=firstOut+1;endpoint=segments[firstOut]?.[0]||points[0];
   // "Nearer this port" is measured on the visible cable, between where it
   // leaves this equipment and where it enters the far equipment.
   let lastOut=segments.length-1;while(lastOut>firstOut&&inside([(segments[lastOut][0][0]+segments[lastOut][1][0])/2,(segments[lastOut][0][1]+segments[lastOut][1][1])/2]))lastOut--;
   // An off-page cable has no far port name to share its length with.
   half=owner.startEndpoint!=null?travelled[lastOut+1]:(travelled[firstOut]+travelled[lastOut+1])/2;leaves=travelled[firstOut];
   const order=segments.map((_,i)=>i);if(req.role==='media')order.sort((i,j)=>{const [[a,b],[c,d]]=[segments[i],segments[j]];return Math.hypot(d[0]-c[0],d[1]-c[1])-Math.hypot(b[0]-a[0],b[1]-a[1])||i-j;});
   for(const [rank,index] of order.entries()){const segment=req.role==='media'?rank:index,[a,b]=segments[index];
    const vertical=a[0]===b[0],axis=vertical?1:0;
    const lo=Math.max(vertical?minY:page.dynamic?contentLeft:sidebar?contentLeft:306,Math.min(a[axis],b[axis])+4),hi=Math.min((vertical?maxY:maxX)-w,Math.max(a[axis],b[axis])-w-4);
    const preferred=req.role==='media'?(lo+hi)/2:a[axis]<b[axis]?lo:hi;
    const positions=[...visibleOffsets(preferred,1,8,1200,lo,hi),...visibleOffsets(preferred,-1,8,1200,lo,hi)].sort((a,b)=>a.offset-b.offset);
    for(const {x:along} of positions)for(const offset of [-h-5,5]){
     const x=vertical?a[0]+offset:along,y=vertical?along:a[1]+offset;
     const corridor=vertical?{x:Math.min(x,a[0]),y,w:h+5,h:w}:{x,y:Math.min(y,a[1]),w,h:h+5};
     if(paths.some(path=>path!==owner&&pathCrossesText(path,corridor,1)))continue;
     const at=travelled[index]+Math.abs(along+w/2-a[axis]);
     candidates.push(vertical?{x:x+(h-w)/2,y:y+(w-h)/2,w,h,angle:Math.PI/2,attached:true,segment,at}:{x,y,w,h,attached:true,segment,at});
    }
   }
  }
  const late=[];
  if(owner&&req.role==='media'){
   // Visio-style connector text: one line on the cable itself, on a white
   // background. Dense parallel bundles keep their even pitch instead of being
   // pushed apart only to make room for captions beside each cable.
   const th=size+4,parts=lines.map(s=>textWidth(s.value,size,s.patch.bold!==false)+8),total=parts.reduce((a,b)=>a+b,0);
   const runs=owner.points.slice(1).map((b,i)=>[owner.points[i],b]).sort(([a,b],[c,d])=>Math.abs(d[0]-c[0])+Math.abs(d[1]-c[1])-Math.abs(b[0]-a[0])-Math.abs(b[1]-a[1]));
   // A short run, or one shared with a port label, may still hold the same
   // caption as two stacked lines centered on the cable.
   const stacked=lines.length>1?Math.max(...parts):Infinity;
   for(const [length,stack] of [[total,false],[stacked,true]])for(const [a,b] of runs){
    const list=stack?late:candidates;
    if(!Number.isFinite(length))continue;
    const vertical=a[0]===b[0],axis=vertical?1:0,lo=Math.min(a[axis],b[axis])+12,hi=Math.max(a[axis],b[axis])-12-length;
    if(hi<lo)continue;
    const steps=new Set([.5,.35,.65,.2,.8,.05,.95].map(t=>lo+(hi-lo)*t));for(let along=lo;along<=hi&&steps.size<48;along+=8)steps.add(along);
    for(const along of steps){
     const across=stack?th*lines.length:th;
     list.push(vertical?{x:a[0]-length/2,y:along+length/2-across/2,w:length,h:across,angle:Math.PI/2,inline:true,stacked:stack,parts}:{x:along,y:a[1]-across/2,w:length,h:across,inline:true,stacked:stack,parts});
    }
   }
  }
  if(owner&&req.role==='port'){
   // A crowded port can still carry its name on its own cable, on a white
   // background, on the half of the cable nearer that port.
   const th=size+4,parts=lines.map(s=>textWidth(s.value,size,s.patch.bold!==false)+8),length=parts.reduce((a,b)=>a+b,0);
   // Bounded: a few dozen spots from this end, inside the visible page.
   let spots=0;
   for(let i=1;i<points.length&&travelled[i-1]<half&&spots<96;i++){
    const a=points[i-1],b=points[i],vertical=a[0]===b[0],axis=vertical?1:0,direction=Math.sign(b[axis]-a[axis])||1,run=Math.abs(b[axis]-a[axis]),across=vertical?a[0]:a[1];
    if(vertical?across<contentLeft||across>maxX:across<minY||across>maxY)continue;
    for(let step=12,count=0;step+length+12<=run&&step<=4000&&count<48&&spots<96;step+=8){
     const start=a[axis]+direction*step,lo=Math.min(start,start+direction*length),at=travelled[i-1]+step+length/2;if(at>half)break;
     if(vertical?lo<minY||lo+length>maxY:lo<contentLeft||lo+length>maxX)continue;
     count++;spots++;
     late.push(vertical?{x:a[0]-length/2,y:lo+length/2-th/2,w:length,h:th,angle:Math.PI/2,inline:true,parts,at}:{x:lo,y:a[1]-th/2,w:length,h:th,inline:true,parts,at});
    }
   }
  }
  if(owner){
   // Short segments can still take a readable horizontal callout with a leader.
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],vertical=a[0]===b[0],length=travelled[i]-travelled[i-1];
    for(const fraction of [.5,.25,.75])for(const gap of [6,14,28,48,72,100]){
     const x=a[0]+(b[0]-a[0])*fraction,y=a[1]+(b[1]-a[1])*fraction,at=travelled[i-1]+length*fraction;
     if(vertical)candidates.push({x:x+gap,y:y-h/2,w,h,at},{x:x-w-gap,y:y-h/2,w,h,at});
     else candidates.push({x:x-w/2,y:y+gap,w,h,at},{x:x-w/2,y:y-h-gap,w,h,at});
    }
   }
  }
  if(req.near)candidates.push({x:req.near.x,y:req.near.y-h/2,w,h},{x:req.near.x-w-18,y:req.near.y-h/2,w,h});
  if(req.segment){const [a,b]=req.segment,lo=Math.min(a[0],b[0])+5,hi=Math.max(a[0],b[0])-w-5;
   const desired=req.side==='right'?lo+6:Math.max(lo,hi-6);
   const visibleLo=Math.max(lo,contentLeft),visibleHi=Math.min(hi,maxX-w),limit=Math.max(0,hi-lo)+12;
   const positions=[...visibleOffsets(desired,1,10,limit,visibleLo,visibleHi),...visibleOffsets(desired,-1,10,limit,visibleLo,visibleHi)].sort((a,b)=>a.offset-b.offset||b.direction-a.direction);
   for(const dy of [-h-4,4])for(const {x} of positions)candidates.push({x,y:a[1]+dy,w,h});
  }
  // Preserve legacy partial-axis edits as candidates; complete pinned positions above never reflow.
  const preferred=patches.find(p=>Number.isFinite(p.x)||Number.isFinite(p.y));if(preferred)candidates.unshift({x:preferred.x??(req.side==='right'?req.outer+8:req.outer-w-8),y:preferred.y??req.y-h/2,w:Math.max(w,preferred.w||0),h:Math.max(h,preferred.h||0),angle:preferred.angle});
  candidates.push(...late);
  if(owner&&req.role==='media')candidates.sort((a,b)=>Number(!!b.inline)-Number(!!a.inline));
  const gutter=req.side==='right'?Math.max(req.outer+8,984):sidebar?req.outer-w-8:Math.min(req.outer-w-8,322-w),mainBodies=bodies.filter(b=>b.kind!=='handoff'),gutters=[gutter,...(sidebar?[Math.min(...(mainBodies.length?mainBodies:bodies).map(b=>b.x))-26-w]:[])];
  for(let n=0;n<740;n+=4)for(const sign of [1,-1])for(const x of gutters)candidates.push({x,y:req.y-h/2+n*sign,w,h});
  // A label set beside its cable must read as that cable's: prefer spots
  // where every other cable is clearly farther away, then any clear spot.
  const clearlyOwn=b=>{const own=boxDistance(b,owner);return paths.every(p=>p===owner||boxDistance(b,p)>=own+8);};
  let box;
  // Passes: clearly by its own port; then anywhere on the half of the cable
  // nearer its own port; only then any clear spot.
  // A port name takes the spot nearest its own port: beside the cable, or on
  // its own line when the nearest clear spot beside it is much farther.
  const reach=c=>(c.at??Infinity)+(c.inline?60:0),nearest=req.role==='port'&&owner?[...candidates].sort((p,q)=>reach(p)-reach(q)):candidates;
  for(const strict of owner?req.role==='port'?[true,'half',false]:[true,false]:[false]){
   for(const candidate of strict==='half'?nearest:candidates){
    if(strict&&req.role==='port'&&owner&&!(candidate.at<=half))continue;
    // The first pass stays close to where the cable leaves its equipment.
    if(strict===true&&req.role==='port'&&owner&&!(candidate.at<=leaves+120))continue;
    const b=textFootprint(candidate);
    if(b.x<(contentLeft)||b.x+b.w>maxX||b.y<minY||b.y+b.h>maxY||occupied.some(o=>intersects(b,o,3))||bodies.some(o=>intersects(b,o,3))||paths.some(p=>candidate.inline&&p===owner?(p.hops||[]).some(hop=>intersects(hop,b,2)):pathCrossesText(p,b,2)))continue;
    // A port name stays by its port: the strict pass only uses the lead and
    // the first run from that endpoint, or a short leader line near it.
    if(strict===true&&candidate.attached&&(req.role==='port'&&candidate.segment>nearSegments||!clearlyOwn(b)))continue;
    if(strict===true&&req.role==='port'&&!candidate.attached&&!candidate.inline&&endpoint&&Math.hypot(b.x+b.w/2-endpoint[0],b.y+b.h/2-endpoint[1])>160)continue;
    // Port names sit beside or on their own cable; no leader lines.
    if(req.role==='port'&&owner&&!req.allowLeader&&!candidate.attached&&!candidate.inline)continue;
    const leader=owner&&!candidate.attached&&!candidate.inline?cableLeader(b,owner,paths,[...occupied,...bodies]):null;
    if(owner&&req.role!=='reference'&&!candidate.attached&&!candidate.inline&&!leader)continue;
    box={...candidate,leader};break;
   }
   if(box)break;
  }
  return box?{box,lines,size}:{failed:true,clearance:h+12};
 };
 for(const req of requests){
  if(banked.has(req))continue;
  // A port name may shrink a little (not below 8) before the page is
  // re-planned with wider cable spacing to make room for it.
  let placed=null;
  for(const scale of req.role==='port'?[1,.88,.76]:[1]){
   const base=req.size||12,size=Math.max(8,base*scale);
   placed=placeOne(scale===1?req:{...req,size,minSize:Math.min(req.minSize??12,size)});
   if(placed.box||placed.skip)break;
  }
  // Last resort, once the page has already made more room (or cannot grow):
  // a short leader line rather than a missing port name.
  if(!placed.box&&!placed.skip&&req.role==='port'&&portLeaders)placed=placeOne({...req,allowLeader:true});
  if(placed.skip)continue;
  if(!placed.box){const first=placeOne(req);return {ok:false,failed:req,placed:result,clearance:first.clearance??28};}
  const {box,lines,size}=placed;
  occupied.push(box);if(box.leader)occupied.push(box.leader);
  result.push({...req,...box,lines,size});
 }
 for(const b of result){if(b.leader)page.items.push({type:'rect',...b.leader,fill:b.color||'#17364A',stroke:'none',weight:0,editKey:b.editKey+'|leader'});
  if(b.inline){
   // Consecutive boxes along the cable; vertical text reads bottom to top.
   // Stacked captions share one length and sit line by line across the cable.
   if(b.stacked){
    const th=b.h/b.lines.length;
    for(let i=0;i<b.lines.length;i++){
     const shift=(i-(b.lines.length-1)/2)*th,center=b.angle?{x:b.x+b.w/2+shift,y:b.y+b.h/2}:{x:b.x+b.w/2,y:b.y+b.h/2+shift};
     page.items.push({type:'text',x:center.x-b.w/2,y:center.y-th/2,w:b.w,h:th,angle:b.angle,value:b.lines[i].value,size:b.size,bold:b.lines[i].patch.bold??true,color:b.lines[i].patch.color||b.color||'#17364A',align:'center',background:'#FFFFFF',full:true,labelRole:b.role,_textFactor:b.fontFactor||1,linkId:b.linkId,relatedPort:b.role==='port'?String(b.value):null,relatedEnd:b.endpoint||null,relatedCableKey:paths.find(path=>path.linkId===b.linkId)?.editKey,editKey:b.lines[i].key});
    }
    continue;
   }
   let offset=0;
   for(let i=0;i<b.lines.length;i++){
    const w=b.parts[i],center=b.angle?{x:b.x+b.w/2,y:b.y+b.h/2+b.w/2-offset-w/2}:{x:b.x+offset+w/2,y:b.y+b.h/2};offset+=w;
    page.items.push({type:'text',x:center.x-w/2,y:center.y-b.h/2,w,h:b.h,angle:b.angle,value:b.lines[i].value,size:b.size,bold:b.lines[i].patch.bold??true,color:b.lines[i].patch.color||b.color||'#17364A',align:'center',background:'#FFFFFF',full:true,labelRole:b.role,_textFactor:b.fontFactor||1,linkId:b.linkId,relatedPort:b.role==='port'?String(b.value):null,relatedEnd:b.endpoint||null,relatedCableKey:paths.find(path=>path.linkId===b.linkId)?.editKey,editKey:b.lines[i].key});
   }
   continue;
  }
  for(let i=0;i<b.lines.length;i++)page.items.push({type:'text',x:b.angle?b.x+i*(b.size+4)+(b.size+4-b.h)/2:b.x,y:b.angle?b.y+(b.h-b.size-4)/2:b.y+i*(b.size+4),w:b.w,h:b.size+4,angle:b.angle,value:b.lines[i].value,size:b.size,bold:b.lines[i].patch.bold??true,color:b.lines[i].patch.color||b.color||'#17364A',align:b.lines[i].patch.align||b.textAlign||(b.side==='left'?'right':'left'),full:true,labelRole:b.role,_textFactor:b.fontFactor||1,linkId:b.linkId,relatedPort:b.role==='port'?String(b.value):null,relatedEnd:b.endpoint||null,relatedCableKey:paths.find(path=>path.linkId===b.linkId)?.editKey,editKey:b.lines[i].key});}
 return {ok:true,placed:result};
}
