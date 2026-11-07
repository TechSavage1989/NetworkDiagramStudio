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
export function placeCableLabels(page,requests,edits={}){
 const minY=page.dynamic?(page.originY||0)+36:158,maxY=(page.originY||0)+(page.height||975)-69,maxX=(page.originX||0)+(page.width||1200)-38;
 const occupied=[...page.items.filter(i=>i.type==='text').map(i=>({...i})),...embeddedTextBoxes(page)],bodies=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),paths=page.items.filter(i=>i.type==='path');
 const result=[];
 for(const req of requests){
  const source=Array.isArray(req.value)?req.value:[req.value],patches=source.map((_,i)=>edits[req.editKey+'|'+i]||{}),size=Math.max(req.minSize??12,req.size||12,...patches.map(p=>p.size||0)),sidebar=page.legendLayout==='sidebar',contentLeft=page.dynamic?(page.originX||0)+36:sidebar?(page.sidebar?.contentLeft??306):38,maxWidth=sidebar?96:req.side==='right'?Math.max(96,1154-Math.max(req.outer+8,984)):Math.max(100,Math.min(req.outer-46,250));
  const lines=[];for(const [index,original] of source.entries()){const patch=patches[index];if(patch.hidden)continue;const value=patch.value??original;let line='',fragment=0;const push=()=>lines.push({value:line,patch,key:req.editKey+'|'+index+(fragment++?'|wrap'+fragment:'')});for(const char of String(value)){if(line&&textWidth(line+char,size,true)>maxWidth){push();line='';}line+=char;}if(line)push();}if(!lines.length)continue;
  const w=Math.max(...lines.map(s=>textWidth(s.value,size,s.patch.bold!==false))),h=lines.length*(size+4),candidates=[];
  const owner=paths.find(path=>path.linkId===req.linkId&&req.linkId!=null);
  if(owner){
   const points=req.endpoint&&req.endpoint!==(owner.startEndpoint||'a')?[...owner.points].reverse():owner.points;
   const segments=points.slice(1).map((b,i)=>[points[i],b]);
   if(req.role==='media')segments.sort(([a,b],[c,d])=>Math.hypot(d[0]-c[0],d[1]-c[1])-Math.hypot(b[0]-a[0],b[1]-a[1]));
   for(const [a,b] of segments){
    const vertical=a[0]===b[0],axis=vertical?1:0;
    const lo=Math.max(vertical?minY:page.dynamic?contentLeft:sidebar?contentLeft:306,Math.min(a[axis],b[axis])+4),hi=Math.min((vertical?maxY:maxX)-w,Math.max(a[axis],b[axis])-w-4);
    const preferred=req.role==='media'?(lo+hi)/2:a[axis]<b[axis]?lo:hi;
    const positions=[...visibleOffsets(preferred,1,8,1200,lo,hi),...visibleOffsets(preferred,-1,8,1200,lo,hi)].sort((a,b)=>a.offset-b.offset);
    for(const {x:along} of positions)for(const offset of [-h-5,5]){
     const x=vertical?a[0]+offset:along,y=vertical?along:a[1]+offset;
     const corridor=vertical?{x:Math.min(x,a[0]),y,w:h+5,h:w}:{x,y:Math.min(y,a[1]),w,h:h+5};
     if(paths.some(path=>path!==owner&&pathCrossesText(path,corridor,1)))continue;
     candidates.push(vertical?{x:x+(h-w)/2,y:y+(w-h)/2,w,h,angle:Math.PI/2,attached:true}:{x,y,w,h,attached:true});
    }
   }
  }
  if(owner){
   // Short segments can still take a readable horizontal callout with a leader.
   for(let i=1;i<owner.points.length;i++){
    const a=owner.points[i-1],b=owner.points[i],vertical=a[0]===b[0];
    for(const fraction of [.5,.25,.75])for(const gap of [6,14,28,48,72,100]){
     const x=a[0]+(b[0]-a[0])*fraction,y=a[1]+(b[1]-a[1])*fraction;
     if(vertical)candidates.push({x:x+gap,y:y-h/2,w,h},{x:x-w-gap,y:y-h/2,w,h});
     else candidates.push({x:x-w/2,y:y+gap,w,h},{x:x-w/2,y:y-h-gap,w,h});
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
  const preferred=patches.find(p=>Number.isFinite(p.x)||Number.isFinite(p.y));if(preferred)candidates.unshift({x:preferred.x??(req.side==='right'?req.outer+8:req.outer-w-8),y:preferred.y??req.y-h/2,w:Math.max(w,preferred.w||0),h:Math.max(h,preferred.h||0),angle:preferred.angle});
  const gutter=req.side==='right'?Math.max(req.outer+8,984):sidebar?req.outer-w-8:Math.min(req.outer-w-8,322-w),mainBodies=bodies.filter(b=>b.kind!=='handoff'),gutters=[gutter,...(sidebar?[Math.min(...(mainBodies.length?mainBodies:bodies).map(b=>b.x))-26-w]:[])];
  for(let n=0;n<740;n+=4)for(const sign of [1,-1])for(const x of gutters)candidates.push({x,y:req.y-h/2+n*sign,w,h});
  let box;
  for(const candidate of candidates){
   const b=textFootprint(candidate);
   if(b.x<(contentLeft)||b.x+b.w>maxX||b.y<minY||b.y+b.h>maxY||occupied.some(o=>intersects(b,o,3))||bodies.some(o=>intersects(b,o,3))||paths.some(p=>pathCrossesText(p,b,2)))continue;
   const leader=owner&&!candidate.attached?cableLeader(b,owner,paths,[...occupied,...bodies]):null;
   if(owner&&req.role!=='reference'&&!candidate.attached&&!leader)continue;
   box={...candidate,leader};break;
  }
  if(!box)return {ok:false,failed:req,placed:result,clearance:h+12};
  occupied.push(box);if(box.leader)occupied.push(box.leader);
  result.push({...req,...box,lines,size});
 }
 for(const b of result){if(b.leader)page.items.push({type:'rect',...b.leader,fill:b.color||'#17364A',stroke:'none',weight:0,editKey:b.editKey+'|leader'});for(let i=0;i<b.lines.length;i++)page.items.push({type:'text',x:b.angle?b.x+i*(b.size+4)+(b.size+4-b.h)/2:b.x,y:b.angle?b.y+(b.h-b.size-4)/2:b.y+i*(b.size+4),w:b.w,h:b.size+4,angle:b.angle,value:b.lines[i].value,size:b.size,bold:b.lines[i].patch.bold??true,color:b.lines[i].patch.color||b.color||'#17364A',align:b.lines[i].patch.align||(b.side==='left'?'right':'left'),full:true,labelRole:b.role,_textFactor:b.fontFactor||1,linkId:b.linkId,editKey:b.lines[i].key});}
 return {ok:true,placed:result};
}
