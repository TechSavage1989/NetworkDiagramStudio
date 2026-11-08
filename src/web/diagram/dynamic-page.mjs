import {drawingObjects,drawingBounds} from '../drawing-edits.mjs';

// Fit scene coordinates, including negative manual positions, without moving
// objects or rewriting their saved edits. Printing may use independent paper.
export function fitDynamicPage(page,project,{footer=false}={}){
 if(!page.dynamic)return page;
 const edits=project.layout?.drawingEdits||{};
 const boxes=drawingObjects(page).filter(i=>!i.pageFrame||edits[i.editKey]).map(drawingBounds).filter(b=>b&&[b.x,b.y,b.w,b.h].every(Number.isFinite));
 let left=0,top=0,right=1200,bottom=300;
 const footerSpace=Math.max(78,...page.items.filter(i=>/^footer-/.test(i.pageFrame||'')).map(i=>(i.h||0)+57));
 for(const b of boxes){left=Math.min(left,b.x-36);top=Math.min(top,b.y-36);right=Math.max(right,b.x+b.w+36);bottom=Math.max(bottom,b.y+b.h+footerSpace);}
 page.originX=left;page.originY=top;page.width=right-left;page.height=bottom-top;
 page.widthMm=page.width*25.4/96;page.heightMm=page.height*25.4/96;
 for(const item of page.items.filter(i=>i.pageFrame&&!edits[i.editKey])){
  if(item.pageFrame==='rule')item.w=right-72;
  if(item.pageFrame==='brand')item.x=right-36-item.w;
  if(item.pageFrame==='footer-rule'){item.y=bottom-47;item.w=right-72;}
  if(item.pageFrame==='footer-name'){item.y=bottom-39-item.h+21;item.w=right-228;}
  if(item.pageFrame==='footer-number'){item.x=right-36-item.w;item.y=bottom-40-item.h+22;}
  if(item.pageFrame==='sidebar')item.h=Math.max(1,bottom-214);
 }
 return page;
}

// Visio's page origin is bottom-left; normalize only the exported copy so its
// geometry and glued endpoints agree with an SVG with a negative viewBox.
export function normalizedPage(page){
 const dx=-(page.originX||0),dy=-(page.originY||0);if(!dx&&!dy)return page;
 return {...page,originX:0,originY:0,items:page.items.map(item=>{
  const next={...item};if(Number.isFinite(item.x))next.x+=dx;if(Number.isFinite(item.y))next.y+=dy;
  if(item.points)next.points=item.points.map(([x,y])=>[x+dx,y+dy]);
  if(item.type==='vector')next.commands=item.commands.map(([op,x,y])=>op==='Z'?['Z']:[op,x+dx,y+dy]);
  // A cable's drawn commands carry its jumps (arc apex and end pairs) and are
  // what the Visio connector writes; they move with the rest of the page.
  else if(item.commands)next.commands=item.commands.map(([op,...xy])=>[op,...xy.map((v,i)=>v+(i%2?dy:dx))]);
  if(item.hops)next.hops=item.hops.map(hop=>({...hop,x:hop.x+dx,y:hop.y+dy}));
  for(const key of ['from','to'])if(item[key])next[key]={...item[key],x:item[key].x+dx,y:item[key].y+dy};
  return next;
 })};
}
