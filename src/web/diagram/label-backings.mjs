import {textLayout} from './scene.mjs';
import {captionFontMetrics} from './caption-font-metrics.mjs';
import {cleanLabelBacking} from '../label-backing-settings.mjs';
import {defaultLinkWeight} from '../link-styles.mjs';
// Backings may conceal their own cable, never another connection. Keep the
// scene's paint order and cable/jump geometry intact: punch conservative stroke
// envelopes out of the backing instead of replaying or globally raising paths.
// Rectangles are subtracted in the caption's local axes, then emitted as native
// vector fills shared by SVG, PDF and Visio (including rotated captions).
function subtract(box,cut){
 const x=Math.max(box.x,cut.x),y=Math.max(box.y,cut.y),r=Math.min(box.x+box.w,cut.x+cut.w),b=Math.min(box.y+box.h,cut.y+cut.h);
 if(x>=r||y>=b)return [box];
 return [{x:box.x,y:box.y,w:box.w,h:y-box.y},{x:box.x,y:b,w:box.w,h:box.y+box.h-b},{x:box.x,y,w:x-box.x,h:b-y},{x:r,y,w:box.x+box.w-r,h:b-y}].filter(piece=>piece.w>0&&piece.h>0);
}
function clipSegment(points,box,pad){
 const [a,b]=points,delta=[b[0]-a[0],b[1]-a[1]];let lo=0,hi=1;
 for(let axis=0;axis<2;axis++){
  const min=(axis?box.y:box.x)-pad,max=min+(axis?box.h:box.w)+2*pad;
  if(Math.abs(delta[axis])<1e-10){if(a[axis]<min||a[axis]>max)return [];continue;}
  const t0=(min-a[axis])/delta[axis],t1=(max-a[axis])/delta[axis];lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return [];
 }
 return [lo,hi].map(t=>[a[0]+delta[0]*t,a[1]+delta[1]*t]);
}
function envelopes(path){
 const parts=[];let last;
 for(const command of path.commands||path.points?.map((point,n)=>[n?'L':'M',...point])||[]){
  const [op,x,y,ex,ey]=command,end=op==='A'?[ex,ey]:[x,y];
  if(last&&op!=='M'){
   // The half ellipse lies within the rectangle spanning its ends and apex.
   // Include all four corners before rotating to the caption's local axes.
   const points=op==='A'?[last,[x,y],end]:[last,end];
   if(op==='A'){
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    parts.push([[left,top],[right,top],[right,bottom],[left,bottom]]);
   }else parts.push(points);
  }
  last=end;
 }
 return parts;
}
// Measure actual ink, not the roomy selection/wrapping box. Keep the baseline,
// alignment and rotation center unchanged, including old manually widened boxes.
export function captionBackingBoxes(text,padding=.5){
 const {lines,size,lineHeight}=textLayout(text),metrics=captionFontMetrics[text.bold?'bold':'normal'],scale=size/2048;
 const baseline=text.y+(text.h-lines.length*lineHeight)/2+lineHeight/2+size*.34;
 return lines.flatMap((line,n)=>{
  let advance=0,left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const char of line){
   const m=metrics[char.codePointAt(0)]||[2048,0,-430,2048,1640];
   if(m[3]>m[1]&&m[4]>m[2]){left=Math.min(left,advance+m[1]);right=Math.max(right,advance+m[3]);top=Math.min(top,-m[4]);bottom=Math.max(bottom,-m[2]);}
   advance+=m[0];
  }
  if(!Number.isFinite(left))return [];
  const anchor=text.align==='right'?text.x+text.w-advance*scale:text.align==='center'?text.x+(text.w-advance*scale)/2:text.x;
  return [{x:anchor+left*scale-padding,y:baseline+n*lineHeight+top*scale-padding,w:(right-left)*scale+2*padding,h:(bottom-top)*scale+2*padding}];
 });
}
export function labelBackingItems(items,{nativeText=false,...options}={}){
 const settings=cleanLabelBacking(options);
 const cables=items.filter(i=>i.type==='path'&&(i.opacity??1)>0).map(item=>({item,parts:envelopes(item)}));
 return items.flatMap(text=>{
  if(text.type!=='text'||!text.background)return [text];
  const caption=['port','media'].includes(text.labelRole);
  if(caption&&settings.mode==='transparent')return [{...text,background:undefined}];
  const angle=text.angle||0,c=Math.cos(angle),s=Math.sin(angle),cx=text.x+text.w/2,cy=text.y+text.h/2;
  const local=([x,y])=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c];
  const world=([x,y])=>[cx+(x-cx)*c+(y-cy)*s,cy-(x-cx)*s+(y-cy)*c];
  const boxes=caption?captionBackingBoxes(text,settings.padding*(text.presentation?.fontScale||1)):[{x:text.x,y:text.y,w:text.w,h:text.h}];
  // Expanded multiline backings can overlap. Partition their union before
  // export so native compound fill rules cannot reopen the overlap as a hole.
  let pieces=[];
  for(const box of boxes){let additions=[box];for(const prior of pieces)additions=additions.flatMap(piece=>subtract(piece,prior));pieces.push(...additions);}
  const extent=pieces.length?{x:Math.min(...pieces.map(p=>p.x)),y:Math.min(...pieces.map(p=>p.y)),w:Math.max(...pieces.map(p=>p.x+p.w))-Math.min(...pieces.map(p=>p.x)),h:Math.max(...pieces.map(p=>p.y+p.h))-Math.min(...pieces.map(p=>p.y))}:text;
  for(const {item,parts} of cables){
   const own=text.relatedCableKey?item.editKey===text.relatedCableKey:text.linkId!=null&&item.linkId===text.linkId;
   if(own)continue;
   // Round joins and antialiasing must remain clear, including thick strokes.
   const pad=(item.weight||defaultLinkWeight)/2+.1;
   for(const points of parts){
    const transformed=points.map(local),localPoints=points.length===2?clipSegment(transformed,extent,pad):transformed;
    if(!localPoints.length)continue;
    const xs=localPoints.map(p=>p[0]),ys=localPoints.map(p=>p[1]),x=Math.min(...xs)-pad,y=Math.min(...ys)-pad;
    pieces=pieces.flatMap(piece=>subtract(piece,{x,y,w:Math.max(...xs)+pad-x,h:Math.max(...ys)+pad-y}));
    // Dense pathological scenes must stay bounded. Omitting the remaining
    // backing is safer than hiding a cable or allocating unbounded fragments.
    if(pieces.length>4096){pieces=[];break;}
   }
   if(!pieces.length)break;
  }
  if(nativeText)return [{...text,backingPieces:pieces.map(piece=>({...piece,x:piece.x-text.x,y:piece.y-text.y}))}];
  return [...pieces.map(({x,y,w,h})=>({type:'vector',captionBacking:true,name:'Caption backing',fill:text.background,stroke:'none',commands:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map((point,n)=>[n?'L':'M',...world(point)]).concat([['Z']])})),{...text,background:undefined}];
 });
}
