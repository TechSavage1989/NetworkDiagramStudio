export function cleanSnap(raw={}){raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};return {enabled:raw.enabled===true,grid:raw.grid===true,guides:raw.guides!==false,gridSize:Number.isFinite(raw.gridSize)?Math.max(1,Math.min(100,raw.gridSize)):10,distance:Number.isFinite(raw.distance)?Math.max(1,Math.min(24,raw.distance)):6,deviceEdges:raw.deviceEdges!==false,objectEdges:raw.objectEdges!==false,cablePoints:raw.cablePoints!==false,nudge:Number.isFinite(raw.nudge)?Math.max(.1,Math.min(20,raw.nudge)):1};}
// Keep one dominant axis for the duration of a Shift hold, even if the pointer
// later crosses the diagonal. Releasing Shift permits free movement again.
export function dragAxis(){let axis=null;return (dx,dy,shift)=>{if(!shift)axis=null;else if(axis===null&&(dx||dy))axis=Math.abs(dx)>=Math.abs(dy)?0:1;return axis;};}
export function snapPoint(point,settings,targets=[],bypass=false,onlyAxis=null){
 const s=cleanSnap(settings),out=[...point],guides=[];if(!s.enabled||bypass)return {point:out,guides};
 for(const axis of onlyAxis===null?[0,1]:[onlyAxis]){
  if(s.grid)out[axis]=Math.round(out[axis]/s.gridSize)*s.gridSize;
  if(s.guides){const match=targets.filter(t=>t.axis===axis&&Math.abs(t.value-point[axis])<=s.distance).sort((a,b)=>Math.abs(a.value-point[axis])-Math.abs(b.value-point[axis]))[0];if(match){out[axis]=match.value;guides.push(match);}}
 }return {point:out,guides};
}
export function snapBoxes(boxes,delta,settings,targets=[],bypass=false,onlyAxis=null){
 if(!boxes.length)return {delta:[...delta],guides:[]};const s=cleanSnap(settings);if(!s.enabled||bypass)return {delta:[...delta],guides:[]};
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h)),out=[...delta],guides=[];
 for(const axis of onlyAxis===null?[0,1]:[onlyAxis]){const refs=axis?[y,(y+bottom)/2,bottom]:[x,(x+right)/2,right];if(s.grid)out[axis]=Math.round((refs[0]+delta[axis])/s.gridSize)*s.gridSize-refs[0];
  if(s.guides){const matches=refs.flatMap(ref=>targets.filter(t=>t.axis===axis).map(t=>({target:t,offset:t.value-ref,error:Math.abs(t.value-ref-delta[axis])}))).filter(m=>m.error<=s.distance).sort((a,b)=>a.error-b.error);if(matches.length){out[axis]=matches[0].offset;guides.push(matches[0].target);}}
 }return {delta:out,guides};
}
export function boxSelected(objects,start,end){const x=Math.min(start[0],end[0]),y=Math.min(start[1],end[1]),r=Math.max(start[0],end[0]),b=Math.max(start[1],end[1]);return objects.filter(o=>o.x>=x&&o.y>=y&&o.x+o.w<=r&&o.y+o.h<=b).map(o=>o.key);}
