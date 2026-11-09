// Cable interaction uses the painted route and a screen-pixel allowance. It
// never adds a wider hit stroke to the drawing or changes its physical width.
export const cablePickRadius=12;
const lineSelector='path.diagram-cable,rect.diagram-legend-line';
const tau=Math.PI*2,number=/[MLA]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;
const bound=points=>({x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1])),right:Math.max(...points.map(p=>p[0])),bottom:Math.max(...points.map(p=>p[1]))});
const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const boxDistance=(p,b)=>Math.hypot(Math.max(b.x-p[0],0,p[0]-b.right),Math.max(b.y-p[1],0,p[1]-b.bottom));
const transformed=(p,m)=>[m.a*p[0]+m.c*p[1]+m.e,m.b*p[0]+m.d*p[1]+m.f];

// scene.mjs emits M/L segments and circular semicircles for crossing hops.
// Preserve the arcs exactly for picking, so a nearby crossing does not select
// the cable beneath the visible hop. Unsupported geometry fails closed.
export function cableGeometry(path){
 const tokens=String(path||'').match(number)||[],segments=[];let previous=null;
 for(let i=0;i<tokens.length;){
  const op=tokens[i++];
  if(op==='M'||op==='L'){
   const end=[+tokens[i++],+tokens[i++]];if(!end.every(Number.isFinite))return null;
   if(op==='L'&&previous)segments.push({a:previous,b:end,bounds:bound([previous,end])});previous=end;
  }else if(op==='A'&&previous){
   let [rx,ry,rotation,large,sweep,x,y]=tokens.slice(i,i+7).map(Number);i+=7;
   if(![rx,ry,rotation,large,sweep,x,y].every(Number.isFinite)||rx<=0||ry<=0||rotation||large||![0,1].includes(sweep))return null;
   const end=[x,y],center=[(previous[0]+x)/2,(previous[1]+y)/2],radius=Math.hypot(x-previous[0],y-previous[1])/2,vertical=Math.abs(y-previous[1])>Math.abs(x-previous[0]);
   // SVG radii follow the page axes: along a vertical cable the chord uses ry.
   [rx,ry]=vertical?[ry,rx]:[rx,ry];
   // Jumps are semicircles or flatter bridges; anything taller fails closed.
   if(Math.abs(radius-rx)>.03||ry>rx+.02)return null;
   // One crossing is a semicircle; a bridge over several is a half-ellipse
   // with its rx along the cable and ry toward the apex.
   const start=Math.atan2(previous[1]-center[1],previous[0]-center[0]),turn=sweep?1:-1,u=[Math.cos(start),Math.sin(start)],v=[Math.cos(start+turn*Math.PI/2),Math.sin(start+turn*Math.PI/2)];
   const samples=Array.from({length:33},(_,n)=>{const t=Math.PI*n/32;return [center[0]+u[0]*rx*Math.cos(t)+v[0]*ry*Math.sin(t),center[1]+u[1]*rx*Math.cos(t)+v[1]*ry*Math.sin(t)];});
   const arc=Math.abs(rx-ry)<=.02?{center,radius,start,sweep}:null;
   segments.push({a:previous,b:end,arc,samples,bounds:bound(samples),...(arc?{}:{ellipse:true})});previous=end;
  }else return null;
 }
 if(!segments.length)return null;
 return {segments,bounds:{x:Math.min(...segments.map(s=>s.bounds.x)),y:Math.min(...segments.map(s=>s.bounds.y)),right:Math.max(...segments.map(s=>s.bounds.right)),bottom:Math.max(...segments.map(s=>s.bounds.bottom))}};
}

function arcDistance(p,segment){
 const {center,radius,start,sweep}=segment.arc,angle=Math.atan2(p[1]-center[1],p[0]-center[0]);
 const progress=((sweep?angle-start:start-angle)%tau+tau)%tau;
 return progress<=Math.PI+1e-9?Math.abs(Math.hypot(p[0]-center[0],p[1]-center[1])-radius):Math.min(Math.hypot(p[0]-segment.a[0],p[1]-segment.a[1]),Math.hypot(p[0]-segment.b[0],p[1]-segment.b[1]));
}

export function closestCable(candidates,point,matrix,{radius=cablePickRadius}={}){
 if(!matrix||![point.x,point.y,matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].every(Number.isFinite))return null;
 const determinant=matrix.a*matrix.d-matrix.b*matrix.c,scale=Math.hypot(matrix.a,matrix.b);if(Math.abs(determinant)<1e-12||!scale)return null;
 const uniform=Math.abs(scale-Math.hypot(matrix.c,matrix.d))<scale*1e-7&&Math.abs(matrix.a*matrix.c+matrix.b*matrix.d)<scale*scale*1e-7;
 const p=[(matrix.d*(point.x-matrix.e)-matrix.c*(point.y-matrix.f))/determinant,(-matrix.b*(point.x-matrix.e)+matrix.a*(point.y-matrix.f))/determinant];
 let best=null,bestDistance=Infinity;
 for(const candidate of candidates){
  const geometry=candidate.geometry;if(!geometry)continue;
  const halfWidth=Math.max(0,Number(candidate.weight)||0)*(uniform?scale:Math.max(scale,Math.hypot(matrix.c,matrix.d)))/2,limit=radius+halfWidth;
  if(uniform&&boxDistance(p,geometry.bounds)*scale>limit)continue;
  let distance=Infinity;
  for(const segment of geometry.segments){
   if(uniform){if(boxDistance(p,segment.bounds)*scale>Math.min(limit,distance))continue;distance=Math.min(distance,(segment.arc?arcDistance(p,segment):segment.ellipse?Math.min(...segment.samples.slice(1).map((q,n)=>segmentDistance(p,segment.samples[n],q))):segmentDistance(p,segment.a,segment.b))*scale);}
   else{const points=segment.samples||[segment.a,segment.b];for(let n=1;n<points.length;n++)distance=Math.min(distance,segmentDistance([point.x,point.y],transformed(points[n-1],matrix),transformed(points[n],matrix)));}
  }
  // Distance is measured from the painted edge. Ties follow SVG paint order,
  // which is stable and selects the visible upper cable at a shared point.
  const gap=Math.max(0,distance-halfWidth);
  if(gap<=radius&&gap<=bestDistance+1e-7){best=candidate;bestDistance=gap;}
 }
 return best?{...best,distance:bestDistance}:null;
}

// enabled: cables can be selected and focused (Edit drawing). highlight: the
// nearest cable glows under the pointer, which also helps while only viewing.
export function cableProximity(canvas,{enabled=()=>false,highlight=enabled}={}){
 let svg=null,candidates=[],hover=null,halo=null,frame=null,pending=null,active=false;
 const windowFor=()=>canvas.ownerDocument?.defaultView;
 function clear(){
  if(frame!=null)windowFor()?.cancelAnimationFrame(frame);frame=null;pending=null;
  hover?.classList.remove('cable-hover');hover=null;halo?.remove();halo=null;canvas.classList.remove('near-cable');
 }
 function setHover(path){
  if(path===hover)return;clear();if(!path||!svg||!highlight())return;
  hover=path;path.classList.add('cable-hover');canvas.classList.add('near-cable');
  halo=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');halo.setAttribute('class','cable-proximity-halo');halo.setAttribute('data-editor-only','cable-hover');halo.setAttribute('aria-hidden','true');halo.setAttribute('pointer-events','none');
  const matrix=svg.getScreenCTM(),scale=Math.hypot(matrix.a,matrix.b),candidate=candidates.find(item=>item.element===path),paintedWidth=candidate?.weight??(Number(path.getAttribute('stroke-width'))||0);
  // CSS transforms on the root SVG also scale non-scaling-stroke in Chromium.
  // Compensate the glow padding explicitly, keeping its screen width steady.
  for(const padding of [12,6]){const line=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');for(const [key,value] of Object.entries({d:candidate?.path||path.getAttribute('d'),fill:'none',stroke:'#16839a','stroke-width':paintedWidth+padding/scale,'stroke-opacity':padding===12?.16:.3,'stroke-linejoin':'round','stroke-linecap':'round','pointer-events':'none'}))line.setAttribute(key,String(value));if(path.hasAttribute('mask'))line.setAttribute('mask',path.getAttribute('mask'));halo.append(line);}
  path.before(halo);
 }
 function resolve(event,forHover=false){
  if(!svg||!(forHover?highlight():enabled())||event.altKey)return null;
  const target=event.target;if(!target?.closest)return null;
  // Existing artwork and edit controls always take priority. A background
  // click may find a nearby cable, but may never reach through another object.
  if(target.closest('[data-inline-editor],.cable-controls,[data-device-id],text,foreignObject,a,button,input,select,textarea'))return null;
  const keyed=target.closest('[data-drawing-key]');if(keyed&&!keyed.matches(lineSelector))return null;
  return closestCable(candidates,{x:event.clientX,y:event.clientY},svg.getScreenCTM())?.element||null;
 }
 function sync(){
  const next=!!svg&&!!enabled();if(next===active)return;if(!next)clear();active=next;
  for(const {element} of candidates){if(next){element.setAttribute('tabindex','0');element.setAttribute('role','button');element.setAttribute('aria-label',(element.matches('rect')?'Select connection key: ':'Select connection: ')+(element.querySelector('title')?.textContent||'Cable'));}else for(const name of ['tabindex','role','aria-label'])element.removeAttribute(name);}
 }
 return {
  show(element){clear();svg=element;candidates=[...(svg?.querySelectorAll?.('path.diagram-cable[data-drawing-key],rect.diagram-legend-line[data-drawing-key]')||[])].filter(element=>Number(element.getAttribute(element.matches('rect')?'fill-opacity':'stroke-opacity')??1)>0).map(element=>{const legend=element.matches('rect'),x=Number(element.getAttribute('x')),y=Number(element.getAttribute('y'))+Number(element.getAttribute('height'))/2,path=legend?'M '+x+' '+y+' L '+(x+Number(element.getAttribute('width')))+' '+y:element.getAttribute('d');return {element,key:element.getAttribute('data-drawing-key'),path,weight:Number(element.getAttribute(legend?'height':'stroke-width')),geometry:cableGeometry(path)};});active=false;sync();},
  clear,
  sync,
  resolve,
  hover(event){if(!svg||!highlight()){clear();return;}pending=event;if(frame!=null)return;const win=windowFor();if(!win)return;frame=win.requestAnimationFrame(()=>{frame=null;const next=pending;pending=null;setHover(next?resolve(next,true):null);});},
  focus(target){sync();setHover(active&&target?.matches?.(lineSelector)?target:null);},
  reset(){clear();svg=null;candidates=[];active=false;}
 };
}
