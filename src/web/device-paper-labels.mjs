import {textLayout} from './diagram/scene.mjs';
import {textWidth,intersects,pathCrossesText} from './diagram/labels.mjs';
import {deviceBounds} from './diagram/device-geometry.mjs';
import {presentation} from './presentation.mjs';
import {deviceCaptionPlacement,captionCorner} from './device-captions.mjs';

// Paper labels are not hardware. A small chassis must not force its name and
// model to the same tiny scale. Place measured automatic captions in nearby
// clear space after fitting hardware; never move sockets, cables or user text.
export function readableDeviceLabels(page,project,unit=1){
 const settings=presentation(project,page),minimum=settings.minimumTextPt*(settings.textScale||1);
 if(!minimum||!Number.isFinite(unit)||unit<=0)return;
 const edits=project.layout?.drawingEdits||{},labels=page.items.filter(i=>i.type==='text'&&i.titleOwner&&!i.hidden&&String(i.value||'').trim()),automatic=labels.filter(i=>!['x','y','w','h','size','angle'].some(k=>Number.isFinite(edits[i.editKey]?.[k]))&&!i.angle);
 // A caption the user moved keeps its readable size: it grows from where it
 // was dropped instead of shrinking back to its unfitted size.
 const moved=labels.filter(i=>!automatic.includes(i)&&['x','y'].some(k=>Number.isFinite(edits[i.editKey]?.[k]))&&!['w','h','size','angle'].some(k=>Number.isFinite(edits[i.editKey]?.[k]))&&!i.angle);
 const requestedFor=item=>{const style=project.layout?.textStyles?.[item.titleSlot==='detail'?'deviceDetails':'deviceNames'];return Number.isFinite(style?.size)?style.size:minimum*(style?.scale||1);};
 const result=[];
 for(const item of moved){
  const requested=requestedFor(item),target=requested*unit/.75;if(textLayout(item).size>=target-.001||!(item.size>0))continue;
  const factor=Math.max(item.size,target)/item.size;Object.assign(item,{w:item.w*factor,h:item.h*factor,size:item.size*factor,paperDeviceLabel:true});
  result.push({key:item.editKey,targetPt:requested,actualPt:textLayout(item).size/unit*.75,improved:true});
 }
 if(!automatic.length){if(result.length)page.deviceLabelReadability=result;return;}
 const corners=deviceCaptionPlacement(project);
 const bodies=page.items.filter(i=>i.type==='device'&&i.kind!=='plug').map(i=>({...i,...deviceBounds(i)})),paths=page.items.filter(i=>i.type==='path');
 const occupied=page.items.filter(i=>(i.type==='text'||i.panelGroup)&&!i.hidden),edge=2*unit,left=(page.originX||0)+edge,right=(page.originX||0)+page.width-edge,top=(page.originY||0)+edge,bottom=(page.originY||0)+page.height-edge;
 // A top dock is a horizontal header rail, not unused side whitespace.
 // Keep automatic body captions below it while side panels retain only their
 // real occupied footprints, allowing intentional use of empty space below.
 const topRail=settings.panel.position==='top'?page.items.filter(i=>i.panelGroup&&!i.hidden):[];
 const captionTop=topRail.length?Math.max(top,...topRail.map(i=>i.y+i.h))+2*unit:top;
 for(const item of automatic){
  // Captions of moved or pinned devices are still automatic: they stay with
  // their device at a readable size.
  const body=bodies.find(b=>b.sourceId===item.titleOwner);
  if(!body)continue;
  const requested=requestedFor(item),target=requested*unit/ .75;
  if(textLayout(item).size>=target-.001){continue;}
  const size=Math.max(item.size,target),natural=textWidth(item.value,size,item.bold),widths=[Math.min(natural,Math.max(body.w,160*unit)),Math.min(natural,Math.max(body.w,240*unit)),Math.min(natural,320*unit)].filter((v,i,a)=>v>0&&a.indexOf(v)===i),candidates=[];
  for(const w of widths){
   // textLayout and the exporters share wrapping. Give the full requested
   // point size enough height, rather than letting the text fitter reduce it.
   const measured=textLayout({...item,w,h:page.height,size}),h=measured.lines.length*size*1.2;
   // The chosen corner first (name above and details below on the left by
   // default), then the opposite edge alignment, centered, the other side
   // of the device, and only then beside it. Closer gaps win within a tier.
   // Slide along the edge from the chosen corner (past a cable rising into
   // a corner socket, for example) before giving up the corner.
   const corner=captionCorner(body,item.titleSlot==='detail'?corners.info:corners.name,w,h),anchor=corner.x,span=Math.max(0,body.w-w),step=Math.max(8*unit,span/24);
   const xs=[...new Set([...Array.from({length:Math.floor(span/step)+1},(_,k)=>corner.right?anchor-k*step:anchor+k*step),body.x+span/2,corner.right?body.x:body.x+span])];
   for(const [tier,above] of [[0,corner.above],[1,!corner.above]])for(const gap of [3,8,16,28,44,64])for(const x of xs)candidates.push({x,y:above?body.y-h-gap*unit:body.y+body.h+gap*unit,w,h,size,rank:tier*1e6+(gap+Math.abs(x-anchor)/(4*unit))*1e3+h*.2});
   for(const y of [body.y,body.y+(body.h-h)/2,body.y+body.h-h])candidates.push({x:body.x-w-8*unit,y,w,h,size,rank:2e6+Math.abs(y-body.y)},{x:body.x+body.w+8*unit,y,w,h,size,rank:2e6+Math.abs(y-body.y)});
  }
  candidates.sort((a,b)=>a.rank-b.rank);
  const clear=b=>b.x>=left&&b.x+b.w<=right&&b.y>=captionTop&&b.y+b.h<=bottom&&!bodies.some(n=>intersects(b,n,2*unit))&&!occupied.some(t=>t!==item&&intersects(b,t,2*unit))&&!paths.some(p=>pathCrossesText(p,b,Math.max(2*unit,(p.weight||0)/2+unit)));
  const fit=candidates.find(clear);
  if(fit){const {rank,...box}=fit,ownAlign=Object.hasOwn(edits[item.editKey]||{},'align');Object.assign(item,box);if(!ownAlign&&item.align!=='center')item.align=box.x>body.x+.5&&box.x+box.w>=body.x+body.w-.5?'right':'left';item.paperDeviceLabel=true;}
  // A genuine capacity conflict is reported, never hidden by overlap or crop.
  result.push({key:item.editKey,targetPt:requested,actualPt:textLayout(item).size/unit*.75,improved:!!fit});
 }
 page.deviceLabelReadability=result;
}
