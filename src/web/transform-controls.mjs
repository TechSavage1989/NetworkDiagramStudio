import {devicePoint} from './diagram/device-geometry.mjs';
import {drawingBounds,scaleDrawingItems,moveDrawingItems} from './drawing-edits.mjs';
export const rotatable=item=>['device','text','arttext','group'].includes(item?.type);
export function transformGeometry(item,handle,dx,dy,{shiftKey=false}={}){
 const b=drawingBounds(item);
 if(handle==='rotate'){
  let angle=(item.angle||0)-Math.atan2(dx,b.h/2+28-dy);
  if(shiftKey)angle=Math.round(angle/(Math.PI/12))*Math.PI/12;
  while(angle>Math.PI)angle-=2*Math.PI;while(angle<=-Math.PI)angle+=2*Math.PI;
  return {angle};
 }
 const sx=handle.includes('w')?-1:1,sy=handle.includes('n')?-1:1;
 const factor=Math.max(.1,Math.min(4,1+(dx*sx*b.w+dy*sy*b.h)/Math.max(1,b.w*b.w+b.h*b.h)));
 return {factor,dx:sx<0?b.w*(1-factor):0,dy:sy<0?b.h*(1-factor):0};
}
export function transformEdits(page,edits,item,geometry){
 if(geometry.angle!=null){if(!rotatable(item)||!Number.isFinite(geometry.angle))throw Error('Select a device or text to rotate.');const pinned=item.type==='device'?moveDrawingItems(page,edits,new Map([[item.editKey,[0,0]]])):edits;return {...pinned,[item.editKey]:{...pinned?.[item.editKey],angle:geometry.angle,rotationMode:'fixed'}};}
 const b=drawingBounds(item),commands=item.type==='vector'?item.commands.filter(c=>c.length===3):null,local=commands?{x:Math.min(...commands.map(c=>c[1])),y:Math.min(...commands.map(c=>c[2]))}:item,point=item.normalized?devicePoint(item.parent,local.x,local.y):null,origin=point?{x:point[0],y:point[1]}:local;
 const dx=geometry.dx+(origin.x-b.x)*(geometry.factor-1),dy=geometry.dy+(origin.y-b.y)*(geometry.factor-1);
 const keys=new Set([item.editKey]),scaled=scaleDrawingItems(page,edits,keys,geometry.factor),moved=moveDrawingItems(page,scaled,new Map([[item.editKey,[dx,dy]]]),{preventSidebarOverlap:true});
 return moved;
}
export function transformControls(svg,item){
 if(item.type==='path')return;
 const b=drawingBounds(item);if(!b)return;
 const ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g');group.setAttribute('class','transform-controls');
 const scale=Math.abs(svg.getScreenCTM()?.a)||1,r=5/scale;
 const add=(type,attrs)=>{const n=document.createElementNS(ns,type);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));group.append(n);return n;};
 for(const [handle,x,y]of [['nw',b.x,b.y],['ne',b.x+b.w,b.y],['sw',b.x,b.y+b.h],['se',b.x+b.w,b.y+b.h]])add('rect',{x:x-r,y:y-r,width:r*2,height:r*2,'data-transform':handle,'data-drawing-key':item.editKey,'aria-label':'Resize '+handle});
 if(rotatable(item)){
  add('line',{x1:b.x+b.w/2,y1:b.y,x2:b.x+b.w/2,y2:b.y-28});
  add('circle',{cx:b.x+b.w/2,cy:b.y-28,r,'data-transform':'rotate','data-drawing-key':item.editKey,'aria-label':item.type==='device'?'Rotate device':'Rotate text'});
 }
 svg.append(group);
}
