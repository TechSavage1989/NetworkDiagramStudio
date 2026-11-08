import {svgPage,textLayout} from './diagram/scene.mjs';

// All report exports are local. The PDF uses the same vector scene and embedded
// font as the printable report; PNGs carry explicit 300-dpi resolution metadata.
const color=(value,fallback='#16364a')=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
const paint=value=>value&&value!=='none'&&value!=='transparent';
function flatten(items,parent){
 const out=[];
 for(const item of items||[]){
  const i=parent?{...item,x:parent.x+item.x*parent.w,y:parent.y+item.y*parent.h,w:item.w*parent.w,h:item.h*parent.h}:item;
  if(i.type!=='device'){out.push(i);continue;}
  if(i.asset?.native){
   for(const path of i.asset.native.paths.filter(p=>!p.hidden))out.push({type:'vector',commands:path.commands.map(([op,x,y])=>op==='Z'?['Z']:[op,i.x+x*i.w,i.y+y*i.h]),fill:path.fill,stroke:path.stroke,weight:path.weight*i.w});
   for(const t of i.asset.native.texts.filter(t=>!t.hidden))out.push({type:'text',x:i.x+t.x*i.w-t.w*i.w/2,y:i.y+t.y*i.h-t.size*i.w*.7,w:t.w*i.w,h:t.size*i.w*1.4,size:t.size*i.w,value:t.text,color:t.color,bold:t.bold,align:t.align||'center',angle:t.angle,art:true});
  }else if(i.asset?.dataUrl)out.push({type:'image',x:i.x,y:i.y,w:i.w,h:i.h,dataUrl:i.asset.dataUrl});
  else out.push(...flatten(i.children,i));
 }
 return out;
}
function pdfPath(commands,scale,ox,oy){
 const result=[];let last;
 const point=(x,y)=>[(x-ox)*scale,(y-oy)*scale];
 for(const [op,x,y,ex,ey] of commands||[]){
  if(op==='Z'){result.push({op:'h',c:[]});continue;}
  if(op==='A'&&last){
   const a=last,b=[ex,ey],center=[(a[0]+b[0])/2,(a[1]+b[1])/2],middle=[x,y],r=Math.hypot(b[0]-a[0],b[1]-a[1])/2;
   const normal=[(middle[0]-center[0])/r,(middle[1]-center[1])/r],tangent=[(b[0]-a[0])/(2*r),(b[1]-a[1])/(2*r)],k=.5522847498*r;
   result.push({op:'c',c:[...point(a[0]+normal[0]*k,a[1]+normal[1]*k),...point(middle[0]-tangent[0]*k,middle[1]-tangent[1]*k),...point(...middle)]});
   result.push({op:'c',c:[...point(middle[0]+tangent[0]*k,middle[1]+tangent[1]*k),...point(b[0]+normal[0]*k,b[1]+normal[1]*k),...point(...b)]});last=b;continue;
  }
  result.push({op:op==='M'?'m':'l',c:point(x,y)});last=[x,y];
 }
 return result;
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
  for(const i of flatten(page.items)){
   pdf.saveGraphicsState();
   if(i.opacity!=null&&i.opacity<1)pdf.setGState(new pdf.GState({opacity:i.opacity,'stroke-opacity':i.opacity}));
   pdf.setLineWidth((i.weight||1)*scale);pdf.setDrawColor(color(i.stroke||i.color));pdf.setFillColor(color(i.fill,'#ffffff'));
   if(i.type==='rect'){
    if(paint(i.fill)||paint(i.stroke))pdf.rect(x(i.x),y(i.y),i.w*scale,i.h*scale,paint(i.fill)?paint(i.stroke)?'FD':'F':'S');
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
    if(i.type==='path'&&(i.opacity??1)>0){
     let previous;for(const command of commands||[]){
      if(command[0]==='A'&&previous){pdf.setDrawColor('#ffffff');pdf.setLineWidth(((i.weight||1)+3.5)*scale);pdf.path(pdfPath([['M',...previous],command],scale,ox,oy));pdf.stroke();previous=command.slice(3,5);}
      else previous=command.slice(1,3);
     }
     pdf.setDrawColor(color(i.stroke||i.color));pdf.setLineWidth((i.weight||1)*scale);
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
