// Shared geometry for diagram selection and physical-port mapping.
export function arrangeBoxes(boxes,action){
 if(boxes.length<2)throw Error('Select at least two items.');
 const left=Math.min(...boxes.map(b=>b.x)),right=Math.max(...boxes.map(b=>b.x+b.w)),top=Math.min(...boxes.map(b=>b.y)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
 const result=new Map(boxes.map(b=>[b.key,[0,0]]));
 if(action==='space-x'||action==='space-y'){
  if(boxes.length<3)throw Error('Select at least three items to distribute.');
  const axis=action==='space-x'?'x':'y',size=axis==='x'?'w':'h',sorted=boxes.slice().sort((a,b)=>a[axis]-b[axis]||String(a.key).localeCompare(String(b.key),'en',{numeric:true}));
  const start=sorted[0][axis],end=sorted.at(-1)[axis]+sorted.at(-1)[size],gap=(end-start-sorted.reduce((n,b)=>n+b[size],0))/(sorted.length-1);
  if(gap<-.001)throw Error('Spread the outside items farther apart before distributing them.');
  let at=start;for(const b of sorted){result.set(b.key,axis==='x'?[at-b.x,0]:[0,at-b.y]);at+=b[size]+gap;}
 }else for(const b of boxes){
  const target=({left:[left-b.x,0],right:[right-b.x-b.w,0],top:[0,top-b.y],bottom:[0,bottom-b.y-b.h],'center-x':[(left+right-b.w)/2-b.x,0],'center-y':[0,(top+bottom-b.h)/2-b.y]})[action];
  if(!target)throw Error('Unknown alignment.');result.set(b.key,target);
 }
 return result;
}
export function arrangeAnchors(anchors,keys,action,reference=keys[0]){
 const chosen=[...new Set(keys)].filter(k=>Array.isArray(anchors[k]));if(chosen.length<2)throw Error('Select at least two mapped ports.');
 const out=Object.fromEntries(Object.entries(anchors).map(([k,p])=>[k,[...p]]));
 if(action==='row'||action==='column'){
  const axis=action==='row'?1:0,point=anchors[reference]||anchors[chosen[0]];for(const key of chosen)out[key][axis]=point[axis];
 }else{
  const axis=action==='space-x'?0:action==='space-y'?1:-1;if(axis<0)throw Error('Unknown port alignment.');
  if(chosen.length<3)throw Error('Select at least three ports to distribute.');
  const sorted=chosen.sort((a,b)=>anchors[a][axis]-anchors[b][axis]||a.localeCompare(b,'en',{numeric:true})),start=anchors[sorted[0]][axis],end=anchors[sorted.at(-1)][axis];
  if(end-start<.00001)throw Error('Move the outside ports apart first.');
  sorted.forEach((k,i)=>out[k][axis]=start+(end-start)*i/(sorted.length-1));
 }
 return out;
}
export function placeBeside(boxes,target,side,obstacles=[],padding=72,{clearance=Math.min(24,padding),maxAdjustment=Math.max(160,padding*2)}={}){
 if(!boxes.length||!target||!['left','right','above','below'].includes(side))throw Error('Choose devices and a reference device.');
 if(![padding,clearance,maxAdjustment].every(n=>Number.isFinite(n)&&n>=0))throw Error('Choose a valid placement gap.');
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),w=Math.max(...boxes.map(b=>b.x+b.w))-x,h=Math.max(...boxes.map(b=>b.y+b.h))-y;
 const horizontal=side==='left'||side==='right',direction=side==='left'||side==='above'?-1:1;
 const base={x:side==='left'?target.x-w-padding:side==='right'?target.x+target.w+padding:target.x+(target.w-w)/2,y:side==='above'?target.y-h-padding:side==='below'?target.y+target.h+padding:target.y+(target.h-h)/2,w,h};
 const moved=boxes.map(b=>({...b,x:base.x+b.x-x,y:base.y+b.y-y})),queue=[],seen=new Set(),epsilon=.00001;
 // Search close to the requested side in both axes. A crowded drawing must not
 // turn a local placement into an unbounded sideways jump. Empty space inside a
 // multi-device selection is not an obstacle.
 const push=(dx,dy)=>{const outward=(horizontal?dx:dy)*direction,distance=dx*dx+dy*dy,key=dx.toFixed(5)+','+dy.toFixed(5);
  if(outward<-epsilon||distance>maxAdjustment*maxAdjustment+epsilon||seen.has(key))return;
  seen.add(key);queue.push({dx,dy,distance,across:Math.abs(horizontal?dy:dx)});
 };
 push(0,0);
 for(let attempt=0;queue.length&&attempt<1024;attempt++){
  queue.sort((a,b)=>a.distance-b.distance||a.across-b.across||a.dx-b.dx||a.dy-b.dy);const at=queue.shift();let blocked=false;
  for(const b of moved)for(const o of obstacles){
   if(b.x+at.dx+b.w+clearance<=o.x+epsilon||b.x+at.dx>=o.x+o.w+clearance-epsilon||b.y+at.dy+b.h+clearance<=o.y+epsilon||b.y+at.dy>=o.y+o.h+clearance-epsilon)continue;
   blocked=true;
   push(o.x-clearance-b.w-b.x,at.dy);push(o.x+o.w+clearance-b.x,at.dy);
   push(at.dx,o.y-clearance-b.h-b.y);push(at.dx,o.y+o.h+clearance-b.y);
  }
  if(!blocked)return new Map(boxes.map(b=>[b.key,[base.x-x+at.dx,base.y-y+at.dy]]));
 }
 throw Error('There is no nearby clear position on this side. Move nearby devices or choose another side.');
}
