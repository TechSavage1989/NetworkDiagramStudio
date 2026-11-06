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
export async function renderMaster(root,decode,namedAnchors){
 const c=cellValues(root),w=Number(c.Width),h=Number(c.Height);
 if(!(w>0&&h>0&&w/h<1000&&h/w<1000))throw Error('Master has no usable physical bounds.');
 const scale=Math.min(2400/w,1600/h),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
 const ctx=canvas.getContext('2d'),anchors=Object.create(null),unsupported=new Set();let drawn=0;
 ctx.setTransform(canvas.width/w,0,0,-canvas.height/h,0,canvas.height);
 async function walk(shape,matrix,depth){
  if(depth>24)throw Error('Stencil group is too deeply nested.');
  const c=cellValues(shape),sw=Number(c.Width)||0,sh=Number(c.Height)||0;
  const local=depth?shapeTransform(c):identity,world=multiply(matrix,local);
  ctx.save();ctx.transform(...local);
  const points=namedAnchors(shape,depth?'':undefined,{x:0,y:0,w:sw,h:sh});
  for(const [key,[nx,ny]] of Object.entries(points)){const [x,y]=transform(world,nx*sw,(1-ny)*sh);if(x>=0&&x<=w&&y>=0&&y<=h&&!Object.hasOwn(anchors,key))anchors[key]=[x/w,1-y/h];}
  for(const section of children(shape,'Section').filter(s=>s.getAttribute('N')==='Geometry')){
   const flags=cellValues(section);if(Number(flags.NoShow))continue;
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
 return {dataUrl:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,anchors};
}
