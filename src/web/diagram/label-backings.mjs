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
export function labelBackingItems(items,{nativeText=false}={}){
 const cables=items.filter(i=>i.type==='path'&&(i.opacity??1)>0).map(item=>({item,parts:envelopes(item)}));
 return items.flatMap(text=>{
  if(text.type!=='text'||!text.background)return [text];
  const angle=text.angle||0,c=Math.cos(angle),s=Math.sin(angle),cx=text.x+text.w/2,cy=text.y+text.h/2;
  const local=([x,y])=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c];
  const world=([x,y])=>[cx+(x-cx)*c+(y-cy)*s,cy-(x-cx)*s+(y-cy)*c];
  let pieces=[{x:text.x,y:text.y,w:text.w,h:text.h}];
  for(const {item,parts} of cables){
   const own=text.relatedCableKey?item.editKey===text.relatedCableKey:text.linkId!=null&&item.linkId===text.linkId;
   if(own)continue;
   // Round joins and antialiasing must remain clear, including thick strokes.
   const pad=(item.weight||defaultLinkWeight)/2+.1;
   for(const points of parts){
    const transformed=points.map(local),localPoints=points.length===2?clipSegment(transformed,text,pad):transformed;
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
