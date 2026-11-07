import {recordArtwork} from './native-art.mjs';
import {connectionRows} from './visio-connections.mjs';
// Visio shapes use local inches with a bottom-left origin. Keep artwork and
// connection points in that same space until the final image is flattened.
export const identity=[1,0,0,1,0,0];
export function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export const transform=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
export function shapeTransform(c){
 const angle=Number(c.Angle)||0,cos=Math.cos(angle),sin=Math.sin(angle),sx=Number(c.FlipX)?-1:1,sy=Number(c.FlipY)?-1:1;
 const w=Number(c.Width)||0,h=Number(c.Height)||0,px=Number(c.LocPinX??w/2),py=Number(c.LocPinY??h/2);
 const matrix=[cos*sx,sin*sx,-sin*sy,cos*sy,Number(c.PinX)||0,Number(c.PinY)||0];
 return multiply(matrix,[1,0,0,1,-px,-py]);
}
const children=(e,tag)=>Array.from(e?.children||[]).filter(n=>n.localName===tag);
export const cellValues=shape=>Object.fromEntries(children(shape,'Cell').map(e=>[e.getAttribute('N'),e.getAttribute('V')]));
const color=(v,fallback)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:/^RGB\(/i.test(v||'')?v:fallback;
// A/B lie on the arc; C rotates the ellipse; D is major/minor aspect ratio.
// https://learn.microsoft.com/en-us/office/client-developer/visio/ellipticalarcto-row-geometry-section
export function ellipseArc(from,through,to,angle,ratio){
 if(!(ratio>0&&Number.isFinite(ratio+angle)))return null;
 const cos=Math.cos(angle),sin=Math.sin(angle),map=([x,y])=>[cos*x+sin*y,(-sin*x+cos*y)*ratio];
 const [a,b,c]=[from,through,to].map(map),u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-a[0],c[1]-a[1]],det=2*(u[0]*v[1]-u[1]*v[0]);
 if(Math.abs(det)<1e-14)return null;
 const uu=u[0]**2+u[1]**2,vv=v[0]**2+v[1]**2,cx=a[0]+(uu*v[1]-vv*u[1])/det,cy=a[1]+(u[0]*vv-v[0]*uu)/det;
 const radius=Math.hypot(a[0]-cx,a[1]-cy),start=Math.atan2(a[1]-cy,a[0]-cx),mid=Math.atan2(b[1]-cy,b[0]-cx),end=Math.atan2(c[1]-cy,c[0]-cx),tau=Math.PI*2,norm=x=>(x%tau+tau)%tau;
 return [cos*cx-sin*cy/ratio,sin*cx+cos*cy/ratio,radius,radius/ratio,angle,start,end,norm(mid-start)>norm(end-start)];
}
export function masterBounds(root){
 const c=cellValues(root),w=Number(c.Width),h=Number(c.Height);
 if(w>0&&h>0&&w/h<1000&&h/w<1000)return {x:0,y:0,w,h};
 const points=[];
 function walk(shape,matrix,depth){
  if(shape.getAttribute('Del')==='1')return;
  if(depth>24)throw Error('Stencil group is too deeply nested.');
  const c=cellValues(shape),sw=Number(c.Width),sh=Number(c.Height),world=depth?multiply(matrix,shapeTransform(c)):matrix;
  if(depth&&sw>0&&sh>0&&(children(shape,'ForeignData').length||children(shape,'Section').some(s=>s.getAttribute('N')==='Geometry'&&cellValues(s).NoShow!=='1'))){
   for(const [x,y] of [[0,0],[sw,0],[sw,sh],[0,sh]])points.push(transform(world,x,y));
  }
  for(const child of children(children(shape,'Shapes')[0],'Shape'))walk(child,world,depth+1);
 }
 walk(root,identity,0);
 if(!points.length)throw Error('Master has no usable artwork bounds.');
 const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1]));
 const bw=Math.max(...points.map(p=>p[0]))-x,bh=Math.max(...points.map(p=>p[1]))-y;
 if(!(bw>0&&bh>0&&bw/bh<1000&&bh/bw<1000))throw Error('Master has no usable artwork bounds.');
 return {x,y,w:bw,h:bh};
}
export function connectionLayout(root,artBounds,name=''){
 const points=[];
 function walk(shape,matrix,depth){
  if(shape.getAttribute('Del')==='1')return;
  if(depth>24)throw Error('Stencil group is too deeply nested.');
  const world=depth?multiply(matrix,shapeTransform(cellValues(shape))):matrix;
  for(const p of connectionRows(shape,depth?'':name)){
   const [x,y]=transform(world,p.x,p.y);if(!Number.isFinite(x+y))throw Error('Invalid stencil connection transform.');
   points.push({...p,x,y});if(points.length>12000)throw Error('Stencil has too many connection points.');
  }
  for(const child of children(children(shape,'Shapes')[0],'Shape'))walk(child,world,depth+1);
 }
 walk(root,identity,0);
 const x=Math.min(artBounds.x,...points.map(p=>p.x)),y=Math.min(artBounds.y,...points.map(p=>p.y));
 const w=Math.max(artBounds.x+artBounds.w,...points.map(p=>p.x))-x,h=Math.max(artBounds.y+artBounds.h,...points.map(p=>p.y))-y;
 if(!(w>0&&h>0&&w/h<1000&&h/w<1000))throw Error('Stencil connection points extend beyond usable artwork bounds.');
 const anchors=Object.create(null),counts=new Map();
 for(const p of points)counts.set(p.key,(counts.get(p.key)||0)+1);
 const used=new Map();
 for(const p of points){
  let key=p.key;
  // Distinct points with the same name must not create an invented midpoint
  // or silently bind a cable to an arbitrary first occurrence.
  if(counts.get(key)>1){const n=(used.get(key)||0)+1;used.set(key,n);key+=' (connection '+n+')';}
  const base=key;let suffix=2;while(Object.hasOwn(anchors,key))key=base+' ('+(suffix++)+')';
  anchors[key]=[(p.x-x)/w,1-(p.y-y)/h].map(v=>Math.max(0,Math.min(1,v)));
 }
 return {bounds:{x,y,w,h},anchors};
}
export async function renderMaster(root,decode,name=''){
 const {bounds,anchors}=connectionLayout(root,masterBounds(root),name),{w,h}=bounds;
 const scale=Math.min(2400/w,1600/h),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
 const recorder=recordArtwork(canvas.getContext('2d'),canvas.width,canvas.height),ctx=recorder.ctx,unsupported=new Set();let drawn=0;
 ctx.setTransform(canvas.width/w,0,0,-canvas.height/h,-bounds.x*canvas.width/w,(bounds.y+h)*canvas.height/h);
 async function walk(shape,matrix,depth){
  if(shape.getAttribute('Del')==='1')return;
  if(depth>24)throw Error('Stencil group is too deeply nested.');
  const c=cellValues(shape),sw=Number(c.Width)||0,sh=Number(c.Height)||0;
  const local=depth?shapeTransform(c):identity,world=multiply(matrix,local);
  ctx.save();ctx.transform(...local);
  for(const section of children(shape,'Section').filter(s=>s.getAttribute('N')==='Geometry')){
   const flags=cellValues(section);if(Number(flags.NoShow)||!(sw>0&&sh>0))continue;
   ctx.beginPath();let old=[0,0],marks=0;
   for(const row of children(section,'Row')){
    if(row.getAttribute('Del')==='1')continue;
    const t=row.getAttribute('T'),v=cellValues(row),rel=t?.startsWith('Rel'),x=(Number(v.X)||0)*(rel?sw:1),y=(Number(v.Y)||0)*(rel?sh:1);
    if(t==='MoveTo'||t==='RelMoveTo')ctx.moveTo(x,y);
    else if(t==='LineTo'||t==='RelLineTo')ctx.lineTo(x,y);
    else if(t==='ArcTo'){
     const dx=x-old[0],dy=y-old[1],len=Math.hypot(dx,dy),sag=Number(v.A)||0;
     if(len)ctx.quadraticCurveTo((old[0]+x)/2-dy/len*sag*2,(old[1]+y)/2+dx/len*sag*2,x,y);
    }else if(t==='Ellipse'){
     const ax=(Number(v.A)||0)-x,ay=(Number(v.B)||0)-y,bx=(Number(v.C)||0)-x,by=(Number(v.D)||0)-y;
     ctx.ellipse(x,y,Math.hypot(ax,ay),Math.hypot(bx,by),Math.atan2(ay,ax),0,Math.PI*2);
    }else if(t==='EllipticalArcTo'||t==='RelEllipticalArcTo'){
     const arc=ellipseArc(old,[(Number(v.A)||0)*(rel?sw:1),(Number(v.B)||0)*(rel?sh:1)],[x,y],Number(v.C)||0,Number(v.D)||0);
     if(arc)ctx.ellipse(...arc);else ctx.lineTo(x,y);
    }else if(t==='RelQuadBezTo')ctx.quadraticCurveTo(Number(v.A)*sw,Number(v.B)*sh,x,y);
    else if(t==='RelCubBezTo')ctx.bezierCurveTo(Number(v.A)*sw,Number(v.B)*sh,Number(v.C)*sw,Number(v.D)*sh,x,y);
    else {unsupported.add(t||'unknown geometry');continue;}
    old=[x,y];marks++;
   }
   if(marks){
    ctx.fillStyle=color(c.FillForegnd,'#FFFFFF');ctx.strokeStyle=color(c.LineColor,'#263D49');ctx.lineWidth=Number(c.LineWeight)||.008;
    if(c.FillPattern!=='0'&&flags.NoFill!=='1')ctx.fill('evenodd');
    if(c.LinePattern!=='0'&&flags.NoLine!=='1')ctx.stroke();drawn++;
   }
  }
  const foreign=children(shape,'ForeignData')[0];
  if(foreign){
   const image=await decode(foreign),iw=Number(c.ImgWidth)||sw,ih=Number(c.ImgHeight)||sh;
   ctx.save();ctx.beginPath();ctx.rect(0,0,sw,sh);ctx.clip();ctx.translate(Number(c.ImgOffsetX)||0,(Number(c.ImgOffsetY)||0)+ih);ctx.scale(1,-1);ctx.drawImage(image,0,0,iw,ih);ctx.restore();drawn++;
  }
  const text=children(shape,'Text')[0]?.textContent?.trim();
  if(text&&c.HideText!=='1'){
   const char=children(shape,'Section').find(s=>s.getAttribute('N')==='Character'),style=cellValues(children(char,'Row')[0]);
   const size=Number(style.Size)||.12,lines=text.split(/\n/).slice(0,60);ctx.save();ctx.translate(sw/2,sh/2);ctx.scale(1,-1);ctx.font=size+'px Arial';ctx.fillStyle=color(style.Color,'#17364A');ctx.textAlign='center';ctx.textBaseline='middle';
   lines.forEach((v,i)=>ctx.fillText(v,0,(i-(lines.length-1)/2)*size*1.2,sw));ctx.restore();drawn++;
  }
  for(const child of children(children(shape,'Shapes')[0],'Shape'))await walk(child,world,depth+1);
  ctx.restore();
 }
 await walk(root,identity,0);
 if(!drawn||unsupported.size)throw Error(unsupported.size?'Unsupported vector geometry ('+[...unsupported].join(', ')+'). Convert this master with desktop Visio or import its PNG faceplate.':'No supported artwork in this master.');
 return {dataUrl:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,anchors,native:recorder.result()};
}
