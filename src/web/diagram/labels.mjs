// Deterministic placement against actual text boxes and every cable segment.
export function textWidth(value,size=12,bold=false){
 let w=0;for(const c of String(value)){w+=/[MW@%#]/.test(c)?.94:/[ilI1.,:;!|' ]/.test(c)?.29:/[A-Z]/.test(c)?.72:/[0-9]/.test(c)?.57:.56;}return Math.ceil(w*size*(bold?1.06:1)+6);
}
export const intersects=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;
export function crossesText(points,box,pad=2){
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
export function placeDeviceTitles(page,project,nodes){
 const edits=project.layout?.drawingEdits||{},titles=page.items.filter(i=>i.titleOwner),paths=page.items.filter(i=>i.type==='path'),bodies=[...nodes.values()],occupied=[...page.items.filter(i=>i.type==='text'&&!i.titleOwner).map(i=>({...i})),...embeddedTextBoxes(page)];
 for(const node of bodies)for(const slot of ['title','detail']){
  const group=titles.filter(i=>i.titleOwner===node.sourceId&&(i.titleSlot||'title')===slot);if(!group.length)continue;
  const fixed=group.some(i=>Number.isFinite(edits[i.editKey]?.x)||Number.isFinite(edits[i.editKey]?.y));if(fixed){occupied.push(...group);continue;}
  const x0=group[0].x,y0=group[0].y,w=Math.max(...group.map(i=>i.x-x0+Math.max(i.w,textWidth(i.value,i.size,i.bold)))),h=Math.max(...group.map(i=>i.y-y0+i.h)),candidates=[];
  if(slot==='detail')for(let dx=0;dx<=Math.max(0,node.w-w);dx+=8)candidates.push({x:node.x+dx,y:node.y+node.h+5,w,h});
  for(const gap of [5,12,24,40])for(let dx=0;dx<=Math.max(0,node.w-w);dx+=8)candidates.push({x:node.x+dx,y:node.y-h-gap,w,h});
  for(let dx=0;dx<=Math.max(0,node.w-w);dx+=8)candidates.push({x:node.x+dx,y:node.y+node.h+7,w,h});
  candidates.push({x:node.x-w-12,y:node.y,w,h},{x:node.x+node.w+12,y:node.y,w,h});
  const fit=candidates.find(b=>b.x>=(page.legendLayout==='sidebar'?318:38)&&b.x+b.w<=1162&&b.y>=151&&b.y+b.h<906&&!bodies.some(n=>intersects(b,n,3))&&!occupied.some(t=>intersects(b,t,3))&&!paths.some(p=>pathCrossesText(p,b,3)));
  if(!fit)throw Error('This page needs more space for a device title. Move a device to another core page.');
  for(const t of group){t.x+=fit.x-x0;t.y+=fit.y-y0;occupied.push({...t});}
 }
}
export function placeCableLabels(page,requests,edits={}){
 const occupied=[...page.items.filter(i=>i.type==='text').map(i=>({...i})),...embeddedTextBoxes(page)],bodies=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),paths=page.items.filter(i=>i.type==='path');
 const result=[];
 for(const req of requests){
  const source=Array.isArray(req.value)?req.value:[req.value],patches=source.map((_,i)=>edits[req.editKey+'|'+i]||{}),size=Math.max(12,req.size||12,...patches.map(p=>p.size||0)),sidebar=page.legendLayout==='sidebar',maxWidth=sidebar?96:req.side==='right'?Math.max(96,1154-Math.max(req.outer+8,984)):Math.max(100,Math.min(req.outer-46,250));
  const lines=[];for(const [index,original] of source.entries()){const patch=patches[index];if(patch.hidden)continue;const value=patch.value??original;let line='',fragment=0;const push=()=>lines.push({value:line,patch,key:req.editKey+'|'+index+(fragment++?'|wrap'+fragment:'')});for(const char of String(value)){if(line&&textWidth(line+char,size,true)>maxWidth){push();line='';}line+=char;}if(line)push();}if(!lines.length)continue;
  const w=Math.max(...lines.map(s=>textWidth(s.value,size,s.patch.bold!==false))),h=lines.length*(size+4),candidates=[];
  if(req.near)candidates.push({x:req.near.x,y:req.near.y-h/2,w,h},{x:req.near.x-w-18,y:req.near.y-h/2,w,h});
  if(req.segment){const [a,b]=req.segment,lo=Math.min(a[0],b[0])+5,hi=Math.max(a[0],b[0])-w-5;
   const desired=req.side==='right'?lo+6:Math.max(lo,hi-6);
   for(const dy of [-h-4,4])for(let n=0;n<=Math.max(0,hi-lo)+12;n+=10){for(const sign of [1,-1]){const x=desired+n*sign;if(x>=lo&&x<=hi)candidates.push({x,y:a[1]+dy,w,h});}}
  }
  const preferred=patches.find(p=>Number.isFinite(p.x)||Number.isFinite(p.y));if(preferred)candidates.unshift({x:preferred.x??(req.side==='right'?req.outer+8:req.outer-w-8),y:preferred.y??req.y-h/2,w:Math.max(w,preferred.w||0),h:Math.max(h,preferred.h||0)});
  const gutter=req.side==='right'?Math.max(req.outer+8,984):sidebar?req.outer-w-8:Math.min(req.outer-w-8,322-w),mainBodies=bodies.filter(b=>b.kind!=='handoff'),gutters=[gutter,...(sidebar?[Math.min(...(mainBodies.length?mainBodies:bodies).map(b=>b.x))-26-w]:[])];
  for(let n=0;n<740;n+=4)for(const sign of [1,-1])for(const x of gutters)candidates.push({x,y:req.y-h/2+n*sign,w,h});
  const box=candidates.find(b=>b.x>=(sidebar?306:38)&&b.x+b.w<=1162&&b.y>=158&&b.y+b.h<=906&&!occupied.some(o=>intersects(b,o,3))&&!bodies.some(o=>intersects(b,o,3))&&!paths.some(p=>pathCrossesText(p,b,2)));
  if(!box)return {ok:false,failed:req,placed:result};
  occupied.push(box);result.push({...req,...box,lines,size});
 }
 for(const b of result){for(let i=0;i<b.lines.length;i++)page.items.push({type:'text',x:b.x,y:b.y+i*(b.size+4),w:b.w,h:b.size+4,value:b.lines[i].value,size:b.size,bold:b.lines[i].patch.bold??true,color:b.lines[i].patch.color||b.color||'#17364A',align:b.lines[i].patch.align||(b.side==='left'?'right':'left'),full:true,labelRole:b.role,linkId:b.linkId,editKey:b.lines[i].key});}
 return {ok:true,placed:result};
}
