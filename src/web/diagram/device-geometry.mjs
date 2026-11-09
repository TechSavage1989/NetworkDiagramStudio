// Scene angles use mathematical radians: positive angles turn upward on screen.
export function devicePoint(g,nx,ny){
 const cx=g.x+g.w/2,cy=g.y+g.h/2,a=g.angle||0,c=Math.cos(a),s=Math.sin(a),x=(nx-.5)*g.w,y=(ny-.5)*g.h;
 return [cx+x*c+y*s,cy-x*s+y*c];
}
export function deviceLocalDelta(g,dx,dy){const a=g.angle||0,c=Math.cos(a),s=Math.sin(a);return [dx*c-dy*s,dx*s+dy*c];}
export function deviceRegionBounds(g,r={x:0,y:0,w:1,h:1}){
 const x=r.x??0,y=r.y??0,w=r.w??1,h=r.h??1,points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(p=>devicePoint(g,...p)),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
export const deviceBounds=g=>deviceRegionBounds(g);
export function routingDevice(g){return g.angle?{...g,...deviceBounds(g),angle:0,moduleChannel:null,panelRegions:null}:g;}
// Rotate the real socket, then find an orthogonal local departure around other
// occupied modules. Conservative transformed rectangles may require more room,
// but never move the jack or create a substitute physical port.
export function rotatedDeviceAnchor(g,id,nx,ny,sideHint,weight=4,additionalBoxes=[]){
 if(!['top','bottom'].includes(sideHint))sideHint=ny<=.5?'top':'bottom';
 const [x,y]=devicePoint(g,nx,ny),body=deviceBounds(g),pad=weight/2+1;
 const own=(g.panelRegions||[]).find(r=>nx>=(r.x??0)-1e-8&&nx<=(r.x??0)+(r.w??1)+1e-8&&ny>=r.y-1e-8&&ny<=r.y+r.h+1e-8);
 const sockets=(g.children||[]).filter(c=>c.socketPart===0&&!(nx>=c.x-1e-8&&nx<=c.x+c.w+1e-8&&ny>=c.y-1e-8&&ny<=c.y+c.h+1e-8));
 const boxes=[...(g.panelRegions||[]).filter(r=>r!==own&&!r.empty).map(r=>deviceRegionBounds(g,r)),...sockets.map(c=>deviceRegionBounds(g,c)),...additionalBoxes].map(b=>({x:b.x-pad,y:b.y-pad,w:b.w+2*pad,h:b.h+2*pad}));
 const inside=(p,b)=>p[0]>b.x+1e-7&&p[0]<b.x+b.w-1e-7&&p[1]>b.y+1e-7&&p[1]<b.y+b.h-1e-7;
 const clear=(a,b)=>!boxes.some(r=>a[0]===b[0]?a[0]>r.x+1e-7&&a[0]<r.x+r.w-1e-7&&Math.min(Math.max(a[1],b[1]),r.y+r.h)>Math.max(Math.min(a[1],b[1]),r.y)+1e-7:a[1]>r.y+1e-7&&a[1]<r.y+r.h-1e-7&&Math.min(Math.max(a[0],b[0]),r.x+r.w)>Math.max(Math.min(a[0],b[0]),r.x)+1e-7);
 const xs=[...new Set([x,body.x-pad,body.x+body.w+pad,...boxes.flatMap(b=>[b.x,b.x+b.w])])].sort((a,b)=>a-b),ys=[...new Set([y,body.y-pad,body.y+body.h+pad,...boxes.flatMap(b=>[b.y,b.y+b.h])])].sort((a,b)=>a-b);
 const index=(ix,iy)=>iy*xs.length+ix,start=index(xs.indexOf(x),ys.indexOf(y)),dist=new Map([[start,0]]),previous=new Map(),pending=new Set([start]);let goal=null;
 while(pending.size){let at=null;for(const n of pending)if(at==null||dist.get(n)<dist.get(at))at=n;pending.delete(at);const ix=at%xs.length,iy=Math.floor(at/xs.length),p=[xs[ix],ys[iy]];
  if(p[1]===(sideHint==='top'?body.y-pad:body.y+body.h+pad)){goal=at;break;}
  for(const [jx,jy] of [[ix-1,iy],[ix+1,iy],[ix,iy-1],[ix,iy+1]]){if(jx<0||jy<0||jx>=xs.length||jy>=ys.length)continue;const q=[xs[jx],ys[jy]],next=index(jx,jy);if(boxes.some(b=>inside(q,b))||!clear(p,q))continue;const cost=dist.get(at)+Math.abs(q[0]-p[0])+Math.abs(q[1]-p[1]);if(cost<(dist.get(next)??Infinity)){dist.set(next,cost);previous.set(next,at);pending.add(next);}}
 }
 if(goal==null)throw Object.assign(Error('This rotated device has no clear cable departure. Move or enlarge the device, or adjust its rotation.'),{code:'CORE_LAYOUT_CAPACITY',owner:g.sourceId,port:id});
 const points=[];for(let n=goal;n!=null;n=previous.get(n))points.unshift([xs[n%xs.length],ys[Math.floor(n/xs.length)]]);
 return {device:g.key,port:id,x,y,side:sideHint==='top'?'top':'bottom',edge:sideHint==='top'?body.y:body.y+body.h,weight,departure:points.slice(1),rotatedDeparture:true};
}
