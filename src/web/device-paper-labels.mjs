import {textLayout} from './diagram/scene.mjs';
import {textWidth,intersects,pathCrossesText} from './diagram/labels.mjs';
import {deviceBounds} from './diagram/device-geometry.mjs';
import {presentation} from './presentation.mjs';
import {deviceCaptionPlacement,captionCorner} from './device-captions.mjs';

// Paper labels are not hardware. A small chassis must not force its name and
// model to the same tiny scale. Place measured automatic captions in nearby
// clear space after fitting hardware; never move sockets, cables or user text.
// Drawing units per paper pixel at which caption text is measured.
const MEASURE_UNIT=2.5;
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
 const bodies=page.items.filter(i=>i.type==='device'&&i.kind!=='plug').map(i=>({...i,...deviceBounds(i)})),paths=page.items.filter(i=>i.type==='path');
 const occupied=page.items.filter(i=>(i.type==='text'||i.panelGroup)&&!i.hidden),edge=2*unit,left=(page.originX||0)+edge,right=(page.originX||0)+page.width-edge,top=(page.originY||0)+edge,bottom=(page.originY||0)+page.height-edge;
 // A top dock is a horizontal header rail, not unused side whitespace.
 // Keep automatic body captions below it while side panels retain only their
 // real occupied footprints, allowing intentional use of empty space below.
 const topRail=settings.panel.position==='top'?page.items.filter(i=>i.panelGroup&&!i.hidden):[];
 const captionTop=topRail.length?Math.max(top,...topRail.map(i=>i.y+i.h))+2*unit:top;
 // One size for every caption of a kind on the page (device names, device
 // details): the largest, up to the readable target, at which every one of
 // them still finds clear space next to its own device. Captions are never
 // left at mixed sizes because some had room and others did not.
 // Text is measured at one scale per paper unit, so a sheet drawn in paper
 // units (locked) and the same sheet in its own drawing units (unlocked)
 // choose identical sizes and places: the fixed padding of text measurement
 // would otherwise count for more on one than the other. Each placed box gets
 // back the full padding the renderer measures with, so wrapping is unchanged.
 const k=MEASURE_UNIT/unit,pad=Math.max(0,textWidth('',1)-textWidth('',1)/k),padRoom=textWidth('',1)*(1-1/MEASURE_UNIT)*unit;
 const measureWidth=(value,size,bold)=>textWidth(value,size*k,bold)/k,layoutAt=(item,w,h,size)=>textLayout({...item,w:w*k,h:h*k,size:size*k});
 const place=(item,size,taken,near=null)=>{
  const body=bodies.find(b=>b.sourceId===item.titleOwner);if(!body)return null;
  const natural=measureWidth(item.value,size,item.bold),widths=[Math.min(natural,Math.max(body.w,160*unit)),Math.min(natural,Math.max(body.w,240*unit)),Math.min(natural,320*unit)].filter((v,i,a)=>v>0&&a.indexOf(v)===i),candidates=[];
  for(const w of widths){
   // textLayout and the exporters share wrapping. Give the full point size
   // enough height, rather than letting the text fitter reduce it.
   const measured=layoutAt(item,w,page.height,size),h=measured.lines.length*size*1.2;
   // The chosen corner first (name above and details below on the left by
   // default), sliding along that edge, then the other side of the device,
   // and only then beside it. Closer gaps win within a tier.
   const corners=deviceCaptionPlacement(project,item.titleOwner),corner=captionCorner(body,item.titleSlot==='detail'?corners.info:corners.name,w,h),anchor=corner.x,span=Math.max(0,body.w-w),step=Math.max(8*unit,span/24);
   const xs=[...new Set([...Array.from({length:Math.floor(span/step)+1},(_,k)=>corner.right?anchor-k*step:anchor+k*step),body.x+span/2,corner.right?body.x:body.x+span])];
   // Closeness to the device comes first: the chosen corner wins unless its
   // nearest clear spot is well out (past cables and labels), when a spot
   // right against the device on the other side, or beside it, is taken.
   // Details and a name on the same side stack: the details sit against the
   // device and the name stays beyond the band they need, counting its
   // distance from there.
   const sibling=item.titleSlot==='detail'?null:labels.find(other=>other!==item&&other.titleOwner===item.titleOwner&&other.titleSlot==='detail'),infoAbove=/^above/.test(corners.info||'below-left'),band=above=>sibling&&infoAbove===above?sibling.h/unit+3+4:0;
   // `near`: against the device's top or bottom edge, anywhere along it:
   // 'corner' on the chosen side up to 28 units out, 'side' on the other one
   // up to 8 (beyond its own details when they share the side).
   for(const [tier,above] of [[0,corner.above],[1,!corner.above]]){const reserved=band(above);for(const gap of [3,8,16,28,44,64]){if(gap<reserved)continue;for(const x of xs)candidates.push({x,y:above?body.y-h-gap*unit:body.y+body.h+gap*unit,w,h,size,near:gap-reserved+tier*20<=28?tier?'side':'corner':null,rank:(gap-reserved+tier*20+Math.abs(x-anchor)/(4*unit))*1e3+h*.2});}}
   for(const y of [body.y,body.y+(body.h-h)/2,body.y+body.h-h])candidates.push({x:body.x-w-8*unit,y,w,h,size,rank:(8+20+Math.abs(y-body.y)/(4*unit))*1e3},{x:body.x+body.w+8*unit,y,w,h,size,rank:(8+20+Math.abs(y-body.y)/(4*unit))*1e3});
  }
  candidates.sort((a,b)=>a.rank-b.rank);
  const clear=b=>b.x>=left&&b.x+b.w<=right&&b.y>=captionTop&&b.y+b.h<=bottom&&!bodies.some(n=>intersects(b,n,2*unit))&&!occupied.some(t=>t!==item&&!taken.has(t)&&intersects(b,t,2*unit))&&![...taken.values()].some(t=>intersects(b,t,2*unit))&&!paths.some(p=>pathCrossesText(p,b,Math.max(2*unit,(p.weight||0)/2+unit)));
  // The renderer's padding is added back after placement, on the left of
  // right-aligned text: keep that room clear of other device captions too,
  // in the same paper units whether the sheet is locked or not.
  const room=c=>c.x>body.x+.5&&c.x+c.w>=body.x+body.w-.5?{...c,x:c.x-padRoom,w:c.w+padRoom}:{...c,w:c.w+padRoom};
  const textClear=b=>!labels.some(t=>t!==item&&!taken.has(t)&&intersects(b,t,2*unit))&&![...taken.values()].some(t=>intersects(b,t,2*unit));
  const fit=candidates.find(c=>(!near||c.near===near||near==='side'&&c.near==='corner')&&clear(c)&&textClear(room(c)));if(!fit)return null;const {rank,near:_,...box}=fit;return {...box,body};
 };
 const trial=(group,size,near)=>{const taken=new Map();for(const item of group){const box=place(item,size,taken,near);if(!box)return null;taken.set(item,box);}return taken;};
 // The largest common size, between the captions' own size and the target,
 // at which trial() places every caption of the group.
 const largest=(group,smallest,target,near)=>{let placed=trial(group,target,near),size=target;if(placed||!(smallest<target))return {placed,size};let lo=smallest,hi=target;placed=trial(group,lo,near);size=lo;if(placed)for(let n=0;n<5;n++){const mid=(lo+hi)/2,at=trial(group,mid,near);if(at){lo=mid;placed=at;size=mid;}else hi=mid;}return {placed,size};};
 for(const slot of ['name','detail']){
  const group=automatic.filter(i=>(i.titleSlot==='detail'?'detail':'name')===slot&&bodies.some(b=>b.sourceId===i.titleOwner));if(!group.length)continue;
  const requested=requestedFor(group[0]),target=requested*unit/.75,smallest=Math.min(...group.map(i=>i.size).filter(v=>v>0));
  // Already readable everywhere: nothing to move.
  if(group.every(i=>textLayout(i).size>=target-.001)&&Math.max(...group.map(i=>i.size))-smallest<.01)continue;
  // Closeness first: every caption of the kind against its own device on its
  // chosen side, at the largest size that allows; when not even their own size
  // finds such a spot for all of them, against the device on either side; and
  // only then farther out (and beside). A larger size never moves a caption
  // to the other side of its device or away from it.
  let placed=null,size=target;
  for(const near of ['corner','side',null]){({placed,size}=largest(group,smallest,target,near));if(placed)break;}
  if(placed){for(const [item,box] of placed){const {body,...geometry}=box,ownAlign=Object.hasOwn(edits[item.editKey]||{},'align');Object.assign(item,geometry);if(!ownAlign&&item.align!=='center')item.align=box.x>body.x+.5&&box.x+box.w>=body.x+body.w-.5?'right':'left';
   // The renderer's own padding: right-aligned text keeps its right edge.
   if(pad){item.w+=pad;if(item.align==='right')item.x-=pad;}item.paperDeviceLabel=true;}}
  // No common clear size: every caption of the kind keeps the smallest one,
  // where it is, so they still match.
  else for(const item of group)if(item.size>smallest){const factor=smallest/item.size;Object.assign(item,{w:item.w*factor,h:item.h*factor,size:smallest,paperDeviceLabel:true});}
  // A genuine capacity conflict is reported, never hidden by overlap or crop.
  for(const item of group)result.push({key:item.editKey,targetPt:requested,actualPt:textLayout(item).size/unit*.75,improved:!!placed&&size>=target-.001,commonPt:(placed?size:smallest)/unit*.75});
 }
 page.deviceLabelReadability=result;
}
