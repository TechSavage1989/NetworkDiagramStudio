import {labelBackingItems} from './diagram/label-backings.mjs';
import {cableWeight,svgPage,textLayout,cornerRadius} from './diagram/scene.mjs';

// All report exports are local. The PDF uses the same vector scene and embedded
// font as the printable report; PNGs carry explicit 300-dpi resolution metadata.
const color=(value,fallback='#16364a')=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
const paint=value=>value&&value!=='none'&&value!=='transparent';
// Rotate around the original chassis center, never its axis-aligned bounds.
// Baking vector points and text centers keeps cable/backing calculations in
// page coordinates; raster and ellipse paint retains a local PDF transform.
function rotateItem(item,group){
 const angle=group.angle||0;if(!angle)return item;
 const cx=group.x+group.w/2,cy=group.y+group.h/2,c=Math.cos(angle),s=Math.sin(angle);
 const point=([x,y])=>[cx+(x-cx)*c+(y-cy)*s,cy-(x-cx)*s+(y-cy)*c];
 if(item.type==='vector'||item.type==='path')return {...item,
  ...(item.points?{points:item.points.map(point)}:{}),
  ...(item.commands?{commands:item.commands.map(([op,...xy])=>[op,...xy.flatMap((v,n)=>n%2?[]:point([v,xy[n+1]]))])}:{})};
 const [x,y]=point([item.x+item.w/2,item.y+item.h/2]);
 return {...item,x:x-item.w/2,y:y-item.h/2,angle:(item.angle||0)+angle};
}
function flatten(items,parent){
 const out=[];
 for(const item of items||[]){
  const i=parent?{...item,x:parent.x+item.x*parent.w,y:parent.y+item.y*parent.h,w:item.w*parent.w,h:item.h*parent.h}:item;
  if(i.type!=='device'){out.push(i);continue;}
  let children=[];
  if(i.asset?.native){
   for(const path of i.asset.native.paths.filter(p=>!p.hidden))children.push({type:'vector',commands:path.commands.map(([op,x,y])=>op==='Z'?['Z']:[op,i.x+x*i.w,i.y+y*i.h]),fill:path.fill,stroke:path.stroke,weight:path.weight*i.w});
   for(const t of i.asset.native.texts.filter(t=>!t.hidden))children.push({type:'text',x:i.x+t.x*i.w-t.w*i.w/2,y:i.y+t.y*i.h-t.size*i.w*.7,w:t.w*i.w,h:t.size*i.w*1.4,size:t.size*i.w,value:t.text,color:t.color,bold:t.bold,align:t.align||'center',angle:t.angle,art:true});
  }else if(i.asset?.dataUrl)children.push({type:'image',x:i.x,y:i.y,w:i.w,h:i.h,dataUrl:i.asset.dataUrl});
  else children=flatten(i.children,i);
  out.push(...children.map(child=>rotateItem(child,i)));
 }
 return out;
}
function pdfPath(commands,scale,ox,oy){
 const result=[];let last;
 const point=(x,y)=>[(x-ox)*scale,(y-oy)*scale];
 for(const [op,x,y,ex,ey] of commands||[]){
  if(op==='Z'){result.push({op:'h',c:[]});continue;}
  if(op==='A'&&last){
   // A jump is a half-ellipse: rx along the cable, ry to its apex (equal for one crossing).
   const a=last,b=[ex,ey],center=[(a[0]+b[0])/2,(a[1]+b[1])/2],middle=[x,y],rx=Math.hypot(b[0]-a[0],b[1]-a[1])/2,ry=Math.hypot(middle[0]-center[0],middle[1]-center[1])||rx;
   const normal=[(middle[0]-center[0])/ry,(middle[1]-center[1])/ry],tangent=[(b[0]-a[0])/(2*rx),(b[1]-a[1])/(2*rx)],kx=.5522847498*rx,ky=.5522847498*ry;
   result.push({op:'c',c:[...point(a[0]+normal[0]*ky,a[1]+normal[1]*ky),...point(middle[0]-tangent[0]*kx,middle[1]-tangent[1]*kx),...point(...middle)]});
   result.push({op:'c',c:[...point(middle[0]+tangent[0]*kx,middle[1]+tangent[1]*kx),...point(b[0]+normal[0]*ky,b[1]+normal[1]*ky),...point(...b)]});last=b;continue;
  }
  result.push({op:op==='M'?'m':'l',c:point(x,y)});last=[x,y];
 }
 return result;
}
const bounds=(points,pad=0)=>{const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {x:Math.min(...xs)-pad,y:Math.min(...ys)-pad,w:Math.max(...xs)-Math.min(...xs)+2*pad,h:Math.max(...ys)-Math.min(...ys)+2*pad};};
const overlaps=(a,b)=>a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y;
function convexHull(points){
 const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=list=>{const out=[];for(const point of list){while(out.length>1&&cross(out.at(-2),out.at(-1),point)<=0)out.pop();out.push(point);}return out;};
 return [...half(sorted).slice(0,-1),...half(sorted.slice().reverse()).slice(0,-1)];
}
function pdfHopOutlines(start,command,radius){
 // Follow the exact cubic approximation that pdfPath paints. Adaptive offset
 // samples stay within .02 page pixels of their chord, with bounded recursion.
 // The cap at each endpoint is flat, matching SVG's default butt cap.
 const end=command.slice(3,5),rx=Math.hypot(end[0]-start[0],end[1]-start[1])/2,ry=Math.hypot(command[1]-(start[0]+end[0])/2,command[2]-(start[1]+end[1])/2),simple=radius<.8*Math.min(rx,ry)**2/Math.max(rx,ry);
 const samples=[],path=pdfPath([['M',...start],command],1,0,0);let previous=start;
 for(const part of path.slice(1)){
  const control=[previous,part.c.slice(0,2),part.c.slice(2,4),part.c.slice(4,6)];
  const at=t=>{
   const u=1-t,p=[0,1].map(axis=>u*u*u*control[0][axis]+3*u*u*t*control[1][axis]+3*u*t*t*control[2][axis]+t*t*t*control[3][axis]);
   const d=[0,1].map(axis=>3*u*u*(control[1][axis]-control[0][axis])+6*u*t*(control[2][axis]-control[1][axis])+3*t*t*(control[3][axis]-control[2][axis])),length=Math.hypot(...d)||1,n=[-d[1]*radius/length,d[0]*radius/length];
   return {left:[p[0]+n[0],p[1]+n[1]],right:[p[0]-n[0],p[1]-n[1]]};
  };
  const subdivide=(t0,a,t1,b,depth)=>{
   const t=(t0+t1)/2,m=at(t),error=Math.max(...['left','right'].map(side=>Math.hypot(m[side][0]-(a[side][0]+b[side][0])/2,m[side][1]-(a[side][1]+b[side][1])/2)));
   if(error>(simple?.02:.005)&&depth<8){subdivide(t0,a,t,m,depth+1);subdivide(t,m,t1,b,depth+1);}else samples.push(b);
  };
  const first=at(0);if(!samples.length)samples.push(first);subdivide(0,first,1,at(1),0);previous=control[3];
 }
 // A conservative curvature bound keeps the ordinary offset band simple.
 // Tight jumps and flatter bundle arcs can fold their inner offset. Represent
 // those as separate convex swept pieces instead of a self-crossing band.
 if(simple)return [[...samples.map(p=>p.left),...samples.slice().reverse().map(p=>p.right)]];
 // Neighboring pieces overlap by one sampled interval. Merely touching at a
 // common cross-section can leave antialias seams in rasterized PDF clips.
 // The tighter sampling above allows each piece to span two intervals.
 return samples.map((sample,n)=>convexHull(samples.slice(Math.max(0,n-1),n+2).flatMap(point=>[point.left,point.right]))).filter(points=>points.length>=3);
}
function pdfCableClips(items){
 const cables=[],hops=[];
 for(const item of items.filter(item=>item.type==='path'&&(item.opacity??1)>0)){
  const weight=item.weight||cableWeight,segments=[],commands=item.commands||item.points?.map(([x,y],n)=>[n?'L':'M',x,y])||[];let last;
  for(const command of commands){
   const end=command[0]==='A'?command.slice(3,5):command.slice(1,3);
   if(last&&command[0]!=='M'){
    const points=command[0]==='A'?[last,command.slice(1,3),end]:[last,end];segments.push(bounds(points,weight/2));
    if(command[0]==='A')hops.push({owner:item,bounds:bounds(points,(weight+3.5)/2),start:last,command,radius:(weight+3.5)/2});
   }
   last=end;
  }
  cables.push({item,segments});
 }
 const clips=new Map();
 for(const hop of hops){
  const affected=cables.filter(cable=>cable.item!==hop.owner&&cable.segments.some(segment=>overlaps(segment,hop.bounds)));if(!affected.length)continue;
  const pieces=pdfHopOutlines(hop.start,hop.command,hop.radius).map(points=>({points,bounds:bounds(points)}));
  for(const cable of affected){
   const selected=pieces.filter(piece=>cable.segments.some(segment=>overlaps(segment,piece.bounds))).map(piece=>piece.points);
   if(selected.length)clips.set(cable.item,[...(clips.get(cable.item)||[]),...selected]);
  }
 }
 return clips;
}
export async function exportPdf(pages,{title='Network documentation'}={}){
 if(!pages?.length)throw Error('Choose at least one page to export.');
 const Constructor=globalThis.jspdf?.jsPDF;if(!Constructor)throw Error('The local PDF exporter is unavailable. Reopen the application and retry.');
 const {reportFonts}=await import('./vendor/report-fonts.mjs');
 const scale=.75,first=pages[0],format=p=>[p.width*scale,p.height*scale],orientation=p=>p.width>=p.height?'landscape':'portrait';
 const pdf=new Constructor({unit:'pt',format:format(first),orientation:orientation(first),compress:true,putOnlyUsedFonts:true});
 for(const [style,data] of Object.entries(reportFonts)){const file='Report-'+style+'.ttf';pdf.addFileToVFS(file,data);pdf.addFont(file,'NDSReport',style);}
 pdf.setProperties({title,creator:'NetworkDiagramStudio',subject:'Local switchport and network documentation'});
 pages.forEach((page,index)=>{
  if(index)pdf.addPage(format(page),orientation(page));
  const ox=page.originX||0,oy=page.originY||0;
  const x=v=>(v-ox)*scale,y=v=>(v-oy)*scale;
  const items=labelBackingItems(flatten(page.items),page.labelBacking),clips=pdfCableClips(items);
  for(const i of items){
   pdf.saveGraphicsState();
   if(i.angle&&['rect','ellipse','image'].includes(i.type)){
    // PDF's native Y axis points up, unlike the scene and jsPDF's drawing API.
    const c=Math.cos(i.angle),s=Math.sin(i.angle),cx=x(i.x+i.w/2),cy=(page.height-i.y-i.h/2+oy)*scale;
    pdf.setCurrentTransformationMatrix(new pdf.Matrix(c,s,-s,c,cx-c*cx+s*cy,cy-s*cx-c*cy));
   }
   if(i.opacity!=null&&i.opacity<1)pdf.setGState(new pdf.GState({opacity:i.opacity,'stroke-opacity':i.opacity}));
   pdf.setLineWidth((i.weight||(i.type==='path'?cableWeight:1))*scale);pdf.setDrawColor(color(i.stroke||i.color));pdf.setFillColor(color(i.fill,'#ffffff'));
   if(i.type==='rect'){
    const style=paint(i.fill)?paint(i.stroke)?'FD':'F':'S',r=cornerRadius(i)*scale;
    if(paint(i.fill)||paint(i.stroke)){if(r)pdf.roundedRect(x(i.x),y(i.y),i.w*scale,i.h*scale,r,r,style);else pdf.rect(x(i.x),y(i.y),i.w*scale,i.h*scale,style);}
   }else if(i.type==='text'){
    const {lines,size,lineHeight}=textLayout(i),align=i.align==='right'?'right':i.align==='center'?'center':'left';
    pdf.setFont('NDSReport',i.bold?'bold':'normal');pdf.setFontSize(size*scale);pdf.setTextColor(color(i.color));
    const tx=i.x+(align==='right'?i.w:align==='center'?i.w/2:0),ty=i.y+(i.h-lines.length*lineHeight)/2+lineHeight/2+size*.34;
    lines.forEach((line,n)=>{
     let px=tx,py=ty+n*lineHeight;
     if(i.angle){const cx=i.x+i.w/2,cy=i.y+i.h/2,dx=px-cx,dy=py-cy;px=cx+dx*Math.cos(i.angle)+dy*Math.sin(i.angle);py=cy-dx*Math.sin(i.angle)+dy*Math.cos(i.angle);}
     pdf.text(String(line),x(px),y(py),{align,angle:(i.angle||0)*180/Math.PI});
    });
   }else if(i.type==='image'){
    if(/^data:image\/(png|jpeg);base64,/i.test(i.dataUrl||''))pdf.addImage(i.dataUrl,x(i.x),y(i.y),i.w*scale,i.h*scale,undefined,'FAST');
   }else if(i.type==='path'||i.type==='vector'){
    const commands=i.commands||i.points?.map(([x,y],n)=>[n?'L':'M',x,y]);
    if(i.type==='path'){
     pdf.setLineJoin('round');pdf.setLineCap('butt');
     for(const outline of clips.get(i)||[]){
      // Intersect outside each outline separately. One combined even-odd
      // path would incorrectly restore cable ink where clearances overlap.
      // Only this cable is clipped; artwork and later items keep their state.
      pdf.rect(0,0,page.width*scale,page.height*scale,null);
      pdf.path([...outline.map((point,n)=>({op:n?'l':'m',c:[x(point[0]),y(point[1])]})),{op:'h',c:[]}]);
      pdf.clipEvenOdd();pdf.discardPath();
     }
    }
    const path=pdfPath(commands,scale,ox,oy);
    if(path.length){pdf.path(path);if(i.type==='vector'&&paint(i.fill)){paint(i.stroke)?pdf.fillStroke():pdf.fill();}else pdf.stroke();}
   }else if(i.type==='ellipse')pdf.ellipse(x(i.x+i.w/2),y(i.y+i.h/2),i.w*scale/2,i.h*scale/2,paint(i.fill)?paint(i.stroke)?'FD':'F':'S');
   pdf.restoreGraphicsState();
  }
 });
 return new Uint8Array(pdf.output('arraybuffer'));
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function resolutionChunk(dpi){
 const chunk=new Uint8Array(21),view=new DataView(chunk.buffer);view.setUint32(0,9);chunk.set([112,72,89,115],4);view.setUint32(8,Math.round(dpi/0.0254));view.setUint32(12,Math.round(dpi/0.0254));chunk[16]=1;
 let crc=-1;for(const v of chunk.subarray(4,17))crc=crcTable[(crc^v)&255]^(crc>>>8);view.setUint32(17,(crc^-1)>>>0);return chunk;
}
export async function exportPng(page,{dpi=300}={}){
 if(!page||!Number.isFinite(page.width)||!Number.isFinite(page.height))throw Error('Choose a valid report page.');
 const scale=dpi/96,width=Math.round(page.width*scale),height=Math.round(page.height*scale);
 if(width>28000||height>28000||width*height>90_000_000)throw Error('This wall chart is too large for a PNG. Export the A4 booklet or vector PDF.');
 const {reportFonts}=await import('./vendor/report-fonts.mjs');
 const fonts='<defs><style>@font-face{font-family:NDSReport;src:url(data:font/ttf;base64,'+reportFonts.normal+')}@font-face{font-family:NDSReport;font-weight:700;src:url(data:font/ttf;base64,'+reportFonts.bold+')}</style></defs>';
 const svg=(page.svg||svgPage(page)).replace(/style="font-family:[^"]*"/,'style="font-family:NDSReport,Arial,sans-serif"').replace(/(<svg\b[^>]*>)/,'$1'+fonts),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{
  const image=new Image();image.decoding='async';image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw Error('PNG rendering is unavailable.');
  context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));canvas.width=canvas.height=1;if(!blob)throw Error('The image could not be encoded.');
  const bytes=new Uint8Array(await blob.arrayBuffer()),chunk=resolutionChunk(dpi),parts=[bytes.subarray(0,33),chunk];
  // Replace an encoder's default pHYs chunk instead of creating two resolutions.
  let offset=33;const view=new DataView(bytes.buffer);while(offset+12<=bytes.length){const length=view.getUint32(offset),end=offset+length+12;if(end>bytes.length)throw Error('PNG encoder returned an invalid image.');if(String.fromCharCode(...bytes.subarray(offset+4,offset+8))!=='pHYs')parts.push(bytes.subarray(offset,end));offset=end;}
  return new Uint8Array(await new Blob(parts,{type:'image/png'}).arrayBuffer());
 }finally{URL.revokeObjectURL(url);}
}
