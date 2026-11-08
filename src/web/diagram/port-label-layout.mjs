import {textWidth,textFootprint,intersects} from './labels.mjs';

const finiteBox=box=>box&&['x','y','w','h'].every(key=>Number.isFinite(box[key]))&&box.w>=0&&box.h>=0;
const overlapX=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x;
const inside=(point,box)=>point.x>=box.x-1e-6&&point.x<=box.x+box.w+1e-6&&point.y>=box.y-1e-6&&point.y<=box.y+box.h+1e-6;
const union=boxes=>boxes.length?{x:Math.min(...boxes.map(b=>b.x)),y:Math.min(...boxes.map(b=>b.y)),w:Math.max(...boxes.map(b=>b.x+b.w))-Math.min(...boxes.map(b=>b.x)),h:Math.max(...boxes.map(b=>b.y+b.h))-Math.min(...boxes.map(b=>b.y))}:null;
const localBox=(g,box)=>({x:g.x+box.x*g.w,y:g.y+box.y*g.h,w:box.w*g.w,h:box.h*g.h});

// Keep distinct physical names such as x1, WAN1 and A1. Interface paths already
// identify the stack member or module in the surrounding hardware artwork.
export function portLabelText(name){
 const local=String(name??'').trim().split('/').at(-1);
 return local.replace(/^port(?=\d+$)/i,'');
}

function paintedText(g){
 const result=[];
 for(const child of g.children||[]){
  if(child.type!=='text'||child.hidden||!finiteBox(child))continue;
  const box=localBox(g,child),lines=String(child.value??'').split('\n'),size=child.size||5;
  const w=Math.min(box.w,Math.max(...lines.map(line=>textWidth(line,size,child.bold)-6))),h=Math.min(box.h,lines.length*size*1.2);
  result.push(textFootprint({...box,x:box.x+(child.align==='right'?box.w-w:child.align==='center'?(box.w-w)/2:0),y:box.y+(box.h-h)/2,w,h,angle:child.angle}));
 }
 for(const child of g.asset?.native?.texts||[]){
  if(child.hidden)continue;
  const w=Math.min(child.w*g.w,textWidth(child.text,child.size*g.w,child.bold)-6),h=child.size*g.w*1.4;
  result.push(textFootprint({x:g.x+child.x*g.w-child.w*g.w/2+(child.align==='left'?0:child.align==='right'?child.w*g.w-w:(child.w*g.w-w)/2),y:g.y+child.y*g.h-h/2,w,h,angle:child.angle}));
 }
 return result.filter(finiteBox);
}

function geometry(g,ports,options){
 const sockets=(g.children||[]).filter(child=>child.socketPart===0&&!child.hidden&&finiteBox(child)).map((child,index)=>({...localBox(g,child),form:child.socketForm,index,anchorName:child.anchorName}));
 const regions=(g.panelRegions?.length?g.panelRegions:[{x:0,y:0,w:1,h:1}]).map((region,index)=>({...localBox(g,{x:region.x??0,y:region.y??0,w:region.w??1,h:region.h??1}),id:region.id??index})).filter(finiteBox);
 const anchors=new Map(Object.entries(g.ports||{}).map(([name,point])=>[name.toLowerCase(),point])),entries=[],unmapped=[],seen=new Map();
 for(const port of ports||[]){
  const portName=String(port.name??''),point=anchors.get(portName.toLowerCase());
  if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)){unmapped.push(port);continue;}
  const anchor={x:g.x+point[0]*g.w,y:g.y+point[1]*g.h},same=seen.get(point.join(','));
  if(same){same.aliases.push(portName);same.ports.push(port);continue;}
  const socket=sockets.find(box=>Math.abs(box.x+box.w/2-anchor.x)<1e-6&&Math.abs(box.y+box.h/2-anchor.y)<1e-6)||null;
  const region=regions.filter(box=>inside(anchor,box)).sort((a,b)=>a.w*a.h-b.w*b.h)[0]||null;
  const inset=socket?Math.min(options.contentInset,socket.w/4,socket.h/4):0;
  const entry={port,ports:[port],portName,aliases:[],text:String(options.format(portName,port)),anchor,socket,content:socket?{x:socket.x+inset,y:socket.y+inset,w:socket.w-inset*2,h:socket.h-inset*2}:null,region,editKey:g.editKey+'|port-number|'+portName};
  entries.push(entry);seen.set(point.join(','),entry);
 }
 // Row bands align labels across copper and optical banks without changing
 // their slightly different native socket centers or envelopes.
 const rows=[];
 for(const entry of [...entries].sort((a,b)=>a.anchor.y-b.anchor.y||a.anchor.x-b.anchor.x)){
  const height=entry.socket?.h||0;
  let row=rows.find(row=>row.region===entry.region&&Math.abs(row.y-entry.anchor.y)<=Math.max(1,Math.min(row.height,height)*.26));
  if(!row){row={region:entry.region,y:entry.anchor.y,height,entries:[],top:Infinity,bottom:-Infinity};rows.push(row);}
  row.entries.push(entry);row.top=Math.min(row.top,entry.socket?.y??entry.anchor.y);row.bottom=Math.max(row.bottom,entry.socket?entry.socket.y+entry.socket.h:entry.anchor.y);entry.row=row;
 }
 return {entries,unmapped,sockets,regions,text:paintedText(g)};
}

// Each port has two possible bands. A two-choice constraint solve prevents a
// middle row from placing its number over either neighboring row's numbers.
// This stays deterministic, including when both choices are clear.
function chooseBands(candidates,blocked){
 const count=candidates.length,edges=Array.from({length:count*2},()=>[]),reverse=Array.from({length:count*2},()=>[]);
 const imply=(a,b)=>{edges[a].push(b);reverse[b].push(a);};
 for(let i=0;i<count;i++)for(let choice=0;choice<2;choice++)if(blocked[i][choice])imply(i*2+choice,i*2+(1-choice));
 const all=candidates.flatMap((pair,index)=>pair.map((box,choice)=>({box,node:index*2+choice,index}))).sort((a,b)=>a.box.x-b.box.x);
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length&&all[j].box.x<all[i].box.x+all[i].box.w+1;j++){
  const a=all[i],b=all[j];if(a.index===b.index||!intersects(a.box,b.box,1))continue;
  imply(a.node,b.node^1);imply(b.node,a.node^1);
 }
 const visited=new Uint8Array(edges.length),order=[];
 for(let start=0;start<edges.length;start++){
  if(visited[start])continue;const stack=[[start,0]];visited[start]=1;
  while(stack.length){const frame=stack.at(-1),next=edges[frame[0]][frame[1]++];if(next===undefined){order.push(frame[0]);stack.pop();}else if(!visited[next]){visited[next]=1;stack.push([next,0]);}}
 }
 const component=new Int32Array(edges.length).fill(-1);let id=0;
 for(const start of order.reverse()){
  if(component[start]!==-1)continue;const stack=[start];component[start]=id;
  while(stack.length)for(const next of reverse[stack.pop()])if(component[next]===-1){component[next]=id;stack.push(next);}id++;
 }
 const chosen=[];
 for(let i=0;i<count;i++){if(component[i*2]===component[i*2+1])return null;chosen.push(component[i*2]>component[i*2+1]?0:1);}
 return chosen;
}

function attempt(g,ports,options,size){
 const data=geometry(g,ports,options),textHeight=size*1.2,textSpan=Math.max(options.minWidth,...data.entries.map(entry=>textWidth(entry.text,size,true))),height=options.vertical?textSpan:textHeight,width=options.vertical?textHeight:textSpan,candidates=[],blocked=[];
 for(const entry of data.entries){
  const {anchor,socket,row,region}=entry,x=anchor.x-width/2;
  const neighbors=data.sockets.filter(box=>box!==socket&&overlapX({x,w:width},box)&&(!region||inside({x:box.x+box.w/2,y:box.y+box.h/2},region)));
  const above=neighbors.filter(box=>box.y+box.h<=anchor.y+.01),below=neighbors.filter(box=>box.y>=anchor.y-.01);
  const gapAbove=above.length?row.top-Math.max(...above.map(box=>box.y+box.h)):Infinity,gapBelow=below.length?Math.min(...below.map(box=>box.y))-row.bottom:Infinity;
  const preferBelow=above.length&&!below.length||above.length&&below.length&&gapBelow>gapAbove;
  const pair=[{x,y:row.top-options.gap-height,w:width,h:height,size,vertical:options.vertical,side:'above'},{x,y:row.bottom+options.gap,w:width,h:height,size,vertical:options.vertical,side:'below'}];
  if(preferBelow)pair.reverse();
  candidates.push(pair);
  blocked.push(pair.map(box=>{
   if(data.sockets.some(obstacle=>intersects(box,obstacle,options.obstacleGap))||data.text.some(obstacle=>intersects(box,obstacle,options.obstacleGap)))return true;
   // Outer labels may extend into report padding, but never into another
   // chassis module or stack member. Module channels remain empty.
   if(data.regions.some(other=>other!==region&&intersects(box,other,0)))return true;
   if(region?.id!=null&&g.moduleChannel&&(box.x<region.x||box.x+box.w>region.x+region.w||box.y<region.y||box.y+box.h>region.y+region.h))return true;
   return false;
  }));
 }
 const chosen=chooseBands(candidates,blocked),entries=data.entries.map((entry,index)=>{
  const {row,...clean}=entry,number=chosen?candidates[index][chosen[index]]:null;
  return {...clean,number,bounds:union([entry.socket,number].filter(Boolean))};
 });
 const labelObstacles=entries.flatMap(entry=>entry.number?[{...entry.number,portName:entry.portName,sourceId:g.sourceId}]:[]),bounds=union([{x:g.x,y:g.y,w:g.w,h:g.h},...labelObstacles]);
 return {entries,unmapped:data.unmapped,readable:chosen!==null,fontSize:size,labelHeight:height,labelWidth:width,socketObstacles:data.sockets,labelObstacles,bounds,padding:{top:Math.max(0,g.y-bounds.y),right:Math.max(0,bounds.x+bounds.w-g.x-g.w),bottom:Math.max(0,bounds.y+bounds.h-g.y-g.h),left:Math.max(0,g.x-bounds.x)}};
}

/**
 * Readable number bands outside the existing sockets. Input geometry and ports
 * are never mutated. All boxes are in unpresented page coordinates; renderers
 * use the existing editKey plus |text, |box or |state suffixes. A missing socket
 * means mapped artwork, not evidence for a newly invented connector.
 *
 * If the requested size cannot fit, readable is false and number boxes are
 * null. requiredWidth/requiredHeight recommend a uniform hardware enlargement
 * for the report planner, preserving native aspect ratio and every port point.
 * Call again with the actual enlarged scene group before painting. A null
 * requiredScale means that enlargement cannot resolve the mapped geometry.
 */
export function portLabelLayout(g,ports,raw={}){
 const fontSize=Math.max(8,Number.isFinite(raw.fontSize)?raw.fontSize:10),options={fontSize,vertical:raw.vertical===true,minFontSize:Math.min(fontSize,Math.max(8,Number.isFinite(raw.minFontSize)?raw.minFontSize:fontSize)),minWidth:Math.max(0,Number.isFinite(raw.minWidth)?raw.minWidth:18),gap:Math.max(1,Number.isFinite(raw.gap)?raw.gap:2),obstacleGap:Math.max(0,Number.isFinite(raw.obstacleGap)?raw.obstacleGap:1),contentInset:Math.max(0,Number.isFinite(raw.contentInset)?raw.contentInset:1),format:typeof raw.format==='function'?raw.format:portLabelText};
 if(!finiteBox(g)||!g.w||!g.h)throw new TypeError('Port labels need finite, positive device bounds.');
 let layout;
 for(let size=options.fontSize;size>=options.minFontSize-.001;size=Math.max(options.minFontSize,size-.5)){
  layout=attempt(g,ports,options,size);if(layout.readable)return {...layout,requiredScale:1,requiredWidth:g.w,requiredHeight:g.h};if(size===options.minFontSize)break;
 }
 if(raw.measureRequired===false)return {...layout,requiredScale:null,requiredWidth:null,requiredHeight:null};
 const maxScale=Math.max(1,Math.min(32,Number.isFinite(raw.maxScale)?raw.maxScale:16)),at=scale=>attempt({...g,w:g.w*scale,h:g.h*scale},ports,options,options.fontSize);
 let low=1,high=Math.min(maxScale,1.25),fit=at(high);
 while(!fit.readable&&high<maxScale){low=high;high=Math.min(maxScale,high*1.5);fit=at(high);}
 if(!fit.readable)return {...layout,requiredScale:null,requiredWidth:null,requiredHeight:null};
 for(let iteration=0;iteration<12;iteration++){const middle=(low+high)/2,result=at(middle);if(result.readable){high=middle;fit=result;}else low=middle;}
 const requiredScale=Math.ceil(high*1000)/1000;
 return {...layout,requiredScale,requiredWidth:Math.ceil(g.w*requiredScale),requiredHeight:g.h*requiredScale,requiredPadding:fit.padding};
}
