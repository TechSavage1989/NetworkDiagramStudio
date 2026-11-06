// Manual orthogonal cable edits. Port coordinates are never moved by these operations.
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const vertical=(a,b)=>a[0]===b[0];
export function tidyCable(points){
 const out=[];
 for(const p of points){if(out.length&&same(out.at(-1),p))continue;out.push([...p]);
  while(out.length>2){const [a,b,c]=out.slice(-3);if((a[0]===b[0]&&b[0]===c[0]&&(b[1]-a[1])*(c[1]-b[1])>=0)||(a[1]===b[1]&&b[1]===c[1]&&(b[0]-a[0])*(c[0]-b[0])>=0))out.splice(-2,1);else break;}
 }return out;
}
export function validCable(points){return Array.isArray(points)&&points.length>=2&&points.length<=200&&points.every((p,i)=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=12000)&&(!i||p[0]===points[i-1][0]||p[1]===points[i-1][1]));}
export function addCableBends(points,segment,offset=20){
 if(!Number.isInteger(segment)||segment<0||segment>=points.length-1)throw Error('Choose a cable segment.');
 const a=points[segment],b=points[segment+1],v=vertical(a,b),axis=v?1:0,cross=1-axis,delta=b[axis]-a[axis];
 if(Math.abs(delta)<6)throw Error('Choose a longer segment to add bends.');
 const p=[...a],q=[...b];p[axis]=a[axis]+delta/3;q[axis]=a[axis]+delta*2/3;
 const r=[...p],s=[...q];r[cross]+=offset;s[cross]+=offset;
 const result=tidyCable([...points.slice(0,segment+1),p,r,s,q,...points.slice(segment+1)]);
 if(!validCable(result))throw Error('The cable has too many bend points.');return result;
}
export function moveCablePoint(points,index,x,y){
 if(!Number.isInteger(index)||index<=0||index>=points.length-1)throw Error('Port endpoints stay attached. Choose an interior bend point.');
 if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Use finite bend coordinates.');
 const a=points[index-1],old=points[index],b=points[index+1],q=[x,y],before=vertical(a,old),after=vertical(old,b),out=points.slice(0,index).map(p=>[...p]);
 // Neighboring interior elbows can slide. At a port use a short dogleg instead.
 if((before?a[0]!==x:a[1]!==y)){
  if(index===1){const axis=before?1:0,cross=1-axis,mid=(a[axis]+q[axis])/2,p=[...a],r=[...q];p[axis]=r[axis]=mid===a[axis]?mid+12:mid;p[cross]=a[cross];out.push(p,r);}
  else out.push(before?[x,a[1]]:[a[0],y]);
 }
 out.push(q);
 if((after?b[0]!==x:b[1]!==y)){
  if(index===points.length-2){const axis=after?1:0,cross=1-axis,mid=(b[axis]+q[axis])/2,p=[...q],r=[...b];p[axis]=r[axis]=mid===b[axis]?mid+12:mid;r[cross]=b[cross];out.push(p,r);}
  else out.push(after?[x,b[1]]:[b[0],y]);
 }
 out.push(...points.slice(index+1).map(p=>[...p]));const result=tidyCable(out);
 if(!validCable(result))throw Error('The cable has too many bend points.');return result;
}
export function removeCablePoint(points,index){
 if(!Number.isInteger(index)||index<=0||index>=points.length-1)throw Error('Port endpoints cannot be removed.');
 const candidates=[],firstAxis=vertical(points[0],points[1]),lastAxis=vertical(points.at(-2),points.at(-1));
 // Delete a point with the neighboring elbows needed to straighten its detour.
 for(let start=1;start<=index;start++)for(let end=index;end<points.length-1;end++){
  const a=points[start-1],b=points[end+1],joins=a[0]===b[0]||a[1]===b[1]?[[]]:[[[a[0],b[1]]],[[b[0],a[1]]]];
  for(const middle of joins){const next=tidyCable([...points.slice(0,start),...middle,...points.slice(end+1)]);
   if(next.length>=points.length||next.slice(1,-1).some(p=>same(p,points[index]))||vertical(next[0],next[1])!==firstAxis||vertical(next.at(-2),next.at(-1))!==lastAxis)continue;
   candidates.push({points:next,removed:end-start+1,length:next.reduce((s,p,i)=>i?s+Math.abs(p[0]-next[i-1][0])+Math.abs(p[1]-next[i-1][1]):0,0)});
  }
 }
 candidates.sort((a,b)=>a.removed-b.removed||a.points.length-b.points.length||a.length-b.length);
 if(!candidates.length)throw Error('This bend is needed to keep the cable orthogonal and attached to its ports. Move it or remove another bend.');return candidates[0].points;
}
