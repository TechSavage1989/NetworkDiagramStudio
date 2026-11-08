import {drawingBounds,moveDrawingItems,cleanDrawingEdits} from './drawing-edits.mjs';
import {compactLayouts,automaticDeviceGap} from './compact-layout.mjs';
export {automaticDeviceGap} from './compact-layout.mjs';
import {crossesText,intersects,pathCrossesText} from './diagram/labels.mjs';
import {simplifyRoute} from './diagram/routing.mjs';

const clone=value=>structuredClone(value);
const overlap=(a,b,c,d)=>Math.min(Math.max(a,b),Math.max(c,d))-Math.max(Math.min(a,b),Math.min(c,d));
const inside=(v,a,b)=>v>Math.min(a,b)+.01&&v<Math.max(a,b)-.01;
export const connectionDevices=page=>(page?.items||[]).filter(item=>item.type==='device'&&item.kind!=='plug'&&!item.sourceId?.startsWith('module-legend-')&&!item.sourceId?.startsWith('continuation-'));
const cables=page=>(page?.items||[]).filter(item=>item.type==='path'&&item.from&&item.to);
const contentText=page=>page.items.filter(item=>item.type==='text'&&(item.titleOwner||item.deviceTextOwner||item.labelRole||item.wirelessCaption));
function bounds(boxes){
 if(!boxes.length)return {x:0,y:0,w:0,h:0};
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
 return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
}
function crossesEquipment(path,device){
 const own=[path.from?.device,path.to?.device].includes(device.key)||[path.sourceLink?.a,path.sourceLink?.b].includes(device.sourceId),regions=device.moduleChannel&&!own?[{x:0,y:0,w:1,h:1}]:device.panelRegions?.length?device.panelRegions:[{x:0,y:0,w:1,h:1}];
 return regions.some(region=>{
  const box={x:device.x+(region.x||0)*device.w,y:device.y+region.y*device.h,w:(region.w??1)*device.w,h:region.h*device.h},inBox=([x,y])=>x>=box.x&&x<=box.x+box.w&&y>=box.y&&y<=box.y+box.h;
  let first=0,last=path.points.length-1;
  if(own){while(first<last&&inBox(path.points[first]))first++;while(last>first&&inBox(path.points[last]))last--;}
  return crossesText(path.points.slice(first,last+1),box,(path.weight||4)/2-.01);
 });
}

// Quality is measured on rendered world geometry, including painted widths.
// Device and label collisions are hard constraints, never scoring tradeoffs.
export function analyzeConnections(page){
 const devices=connectionDevices(page),paths=cables(page),texts=contentText(page),segments=[],anchors=new Map(page.items.filter(item=>item.type==='device').map(item=>[item.key,item]));
 let length=0,bends=0,crossings=0,parallelOverlaps=0,obstructions=0,attachmentErrors=0,orthogonalErrors=0;
 for(let i=0;i<devices.length;i++)for(const other of devices.slice(i+1))if(intersects(devices[i],other,1))obstructions++;
 for(const path of paths){
  const points=simplifyRoute(path.points),weight=path.weight||4;bends+=Math.max(0,points.length-2);
  if(Math.hypot(points[0][0]-path.from.x,points[0][1]-path.from.y)>.01||Math.hypot(points.at(-1)[0]-path.to.x,points.at(-1)[1]-path.to.y)>.01)attachmentErrors++;
  for(const end of [path.from,path.to]){const host=anchors.get(end.device),port=host?.ports?.[end.port];if(!port||Math.hypot(end.x-host.x-port[0]*host.w,end.y-host.y-port[1]*host.h)>.01)attachmentErrors++;}
  for(const device of devices)if(crossesEquipment(path,device))obstructions++;
  for(const text of texts)if(pathCrossesText(path,text,Math.max(1,weight/2)))obstructions++;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],horizontal=Math.abs(a[1]-b[1])<.001;if(!horizontal&&Math.abs(a[0]-b[0])>.001)orthogonalErrors++;
   length+=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
   const axis=a[horizontal?1:0],lo=Math.min(a[horizontal?0:1],b[horizontal?0:1]),hi=Math.max(a[horizontal?0:1],b[horizontal?0:1]);
   for(const prior of segments)if(prior.path!==path){
    if(prior.horizontal===horizontal){if(overlap(lo,hi,prior.lo,prior.hi)>.01&&Math.abs(axis-prior.axis)<(weight+prior.weight)/2+.24)parallelOverlaps++;}
    else if(inside(axis,prior.lo,prior.hi)&&inside(prior.axis,lo,hi))crossings++;
   }
   segments.push({path,horizontal,axis,lo,hi,weight});
  }
 }
 for(let i=0;i<texts.length;i++){
  const text=texts[i];for(const other of texts.slice(i+1))if(intersects(text,other,0))obstructions++;
  for(const device of devices)if(!(text.deviceTextOwner===device.sourceId&&(!text.ownerInstanceKey||text.ownerInstanceKey===device.instanceKey))&&intersects(text,device,1))obstructions++;
 }
 const footprint=bounds([...devices,...texts,...paths].map(drawingBounds).filter(Boolean));
 return {devices:devices.length,connections:paths.length,length,bends,crossings,parallelOverlaps,obstructions,attachmentErrors,orthogonalErrors,footprint,area:footprint.w*footprint.h,squareArea:Math.max(footprint.w,footprint.h)**2,
  valid:!parallelOverlaps&&!obstructions&&!attachmentErrors&&!orthogonalErrors};
}

function groupsFor(page){
 const devices=connectionDevices(page),hosts=devices.filter(device=>device.kind!=='handoff'),groups=hosts.map(device=>({id:device.sourceId+'|'+(device.instanceKey||''),sourceId:device.sourceId,key:device.editKey,devices:[device]}));
 for(const device of devices.filter(device=>device.kind==='handoff')){
  const owner=groups.find(group=>device.sourceId?.startsWith('handoff:'+group.sourceId+'/'));
  if(owner)owner.devices.push(device);else groups.push({id:device.sourceId,sourceId:device.sourceId,key:device.editKey,devices:[device]});
 }
 for(const group of groups){
  const text=contentText(page).filter(item=>group.devices.some(device=>[item.titleOwner,item.deviceTextOwner].includes(device.sourceId)&&(!item.ownerInstanceKey||item.ownerInstanceKey===device.instanceKey)));
  group.bounds=bounds([...group.devices,...text].map(drawingBounds));
 }
 return groups.sort((a,b)=>a.bounds.y-b.bounds.y||a.bounds.x-b.bounds.x||a.id.localeCompare(b.id));
}

function editedPositions(page,edits,groups,positions){
 const offsets=new Map(connectionDevices(page).map(device=>[device.editKey,[0,0]]));
 for(const group of groups){
  const position=positions.get(group.id);if(!position)continue;
  const delta=[position.x-group.bounds.x,position.y-group.bounds.y],ids=new Set(group.devices.map(d=>d.sourceId));
  for(const device of group.devices)offsets.set(device.editKey,delta);
  // Automatic captions follow their owner on regeneration. A caption explicitly
  // placed by the user moves with that owner without losing its relative offset.
  for(const item of page.items)if((ids.has(item.titleOwner)||ids.has(item.deviceTextOwner))&&(!item.ownerInstanceKey||group.devices.some(device=>device.instanceKey===item.ownerInstanceKey))&&(Number.isFinite(edits[item.editKey]?.x)||Number.isFinite(edits[item.editKey]?.y)))offsets.set(item.editKey,delta);
 }
 return moveDrawingItems(page,edits,offsets);
}
function clearCableBends(page,edits,keep){
 const result=clone(edits||{});if(keep)return result;
 for(const path of cables(page))for(const key of [path.editKey,path.legacyEditKey].filter(Boolean))if(result[key]?.points){delete result[key].points;if(!Object.keys(result[key]).length)delete result[key];}
 return result;
}
const identity=page=>JSON.stringify([page.name,connectionDevices(page).map(d=>[d.sourceId,d.instanceKey,d.w,d.h,Object.entries(d.ports||{}).sort(([a],[b])=>a.localeCompare(b))]).sort(),cables(page).map(path=>[path.from.device,path.from.port,path.to.device,path.to.port]).sort()]);
const sceneFields=['editKey','type','x','y','w','h','points','commands','value','text','name','size','color','fill','stroke','weight','opacity','angle','bold','align','hidden','ports'];
function sceneGeometry(page){
 const shape=item=>{
  const result=Object.fromEntries(sceneFields.filter(key=>item[key]!==undefined).map(key=>[key,item[key]]));
  if(item.children)result.children=item.children.map(shape);
  // The artwork is immutable project data. Compare its identity and editable
  // native geometry without serializing potentially large image data URLs.
  if(item.asset)result.asset={id:item.asset.id,width:item.asset.width,height:item.asset.height,...(item.asset.native?{paths:item.asset.native.paths.map(shape),texts:item.asset.native.texts.map(shape)}:{})};
  return result;
 };
 return JSON.stringify([page.name,page.displayName,page.width,page.height,page.originX,page.originY,page.items.map(shape)]);
}
function quality(metrics,before){
 const relative=(value,base)=>base?value/base:0;
 return relative(metrics.squareArea,before.squareArea)*.24+relative(metrics.area,before.area)*.16+relative(metrics.length,before.length)*.44+relative(metrics.bends,before.bends)*.10+relative(metrics.crossings,before.crossings||1)*.06;
}
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));

// Each candidate gets one bounded planner attempt. No accepted project mutation
// occurs until the caller applies the returned edit set as one history entry.
export async function organizeConnections(project,page,{buildPages,currentPages,compact=true,keepManualBends=true,signal,onProgress=()=>{},yieldWork=yieldFrame,maxCandidates=10}={}){
 if(typeof buildPages!=='function')throw Error('A drawing planner is required.');
 const before=analyzeConnections(page),groups=groupsFor(page),baselineEdits=project.layout?.drawingEdits||{},edits=clearCableBends(page,baselineEdits,keepManualBends),pinned=moveDrawingItems(page,edits,new Map(connectionDevices(page).map(device=>[device.editKey,[0,0]]))),candidates=[{name:'Current positions',edits:pinned}],seen=new Set([JSON.stringify(pinned)]),originalIdentity=identity(page);
 if(!before.connections)throw Error('This page has no connections to organize.');
 const add=(name,next)=>{const key=JSON.stringify(next);if(!seen.has(key)){seen.add(key);candidates.push({name,edits:next});}};
 if(compact&&groups.length>1){
  const frame=connectionDevices(page)[0]?.presentation?.scale||1,baseX=Math.max(((page.sidebar?.contentLeft||36)+32)*frame,Math.min(...groups.map(group=>group.bounds.x))),baseY=Math.max(155*frame,Math.min(...groups.map(group=>group.bounds.y))),gap=automaticDeviceGap(page);
  const order=groups.slice(),links=cables(page).map(path=>path.sourceLink).filter(Boolean),degrees=new Map(groups.map(group=>[group.id,links.filter(link=>link.a===group.sourceId||link.b===group.sourceId).length]));
  const topology=groups.slice().sort((a,b)=>(degrees.get(b.id)||0)-(degrees.get(a.id)||0)||order.indexOf(a)-order.indexOf(b));
  const sideGap=Math.max(gap,(page.connectionLayout?.railPitch||10)*Math.max(1,...degrees.values())+24);
  const variants=[];for(const factor of [1,.7,1.35])for(const [name,list] of [['Saved order',order],['Connected groups',topology]]){
   const choices=compactLayouts(list.map(group=>({id:group.id,w:group.bounds.w,h:group.bounds.h})),{gapX:(factor>1?sideGap:gap)*factor,gapY:gap*factor,left:baseX,top:baseY,maxColumns:Math.min(4,groups.length)});
   choices.sort((a,b)=>Math.max(a.w,a.h)-Math.max(b.w,b.h));
   variants.push({name,list,choices});
  }
  for(let rank=0;rank<4;rank++)for(const {name,list,choices} of variants){const choice=choices[rank];if(choice)add(name+' / '+choice.columns+' columns',editedPositions(page,edits,list,choice.positions));}
 }
 const limit=Math.max(1,Math.min(12,maxCandidates)),replay=limit>1,plan=candidates.slice(0,replay?limit-1:1),others=new Map((currentPages||[]).filter(p=>p!==page&&p.name!==page.name).map(p=>[p.name,sceneGeometry(p)]));
 const baseline={page,edits:baselineEdits,metrics:before,pages:currentPages,changed:false,name:'Current layout'};
 let best=baseline,tested=0,rejected=0;const rejections=[];
 const validate=pages=>{
  const next=pages.find(p=>p.name===page.name);
  if(!next||identity(next)!==originalIdentity||[...others].some(([name,signature])=>sceneGeometry(pages.find(p=>p.name===name)||{items:[]})!==signature))throw Error('This layout would alter another page or a port attachment.');
  const metrics=analyzeConnections(next);
  if(!metrics.valid||metrics.length>before.length*1.08+1||metrics.squareArea>before.squareArea*1.08+1)throw Error('This layout needs more physical clearance or a longer route.');
  return {page:next,metrics,pages};
 };
 for(const candidate of plan){
  if(signal?.aborted)throw new DOMException('Connection analysis cancelled.','AbortError');
  onProgress({completed:tested,total:plan.length+(replay?1:0),name:candidate.name});await yieldWork();
  if(signal?.aborted)throw new DOMException('Connection analysis cancelled.','AbortError');
  try{
   const source={...project,layout:{...project.layout,drawingEdits:cleanDrawingEdits(candidate.edits)}};
   if(replay)source._organizeCandidate={family:page.coreDeviceIds?'core':'wireless',name:page.name,scope:page.editScope,clearance:page.connectionLayout};else delete source._organizeCandidate;
   const checked=validate(buildPages(source)),{page:next,metrics}=checked;
   if(!best.metrics.valid||quality(metrics,before)<quality(best.metrics,before)-.001){
    best={...checked,edits:candidate.edits,changed:sceneGeometry(next)!==sceneGeometry(page),name:candidate.name};
   }
  }catch(error){if(signal?.aborted||error.name==='AbortError')throw error;rejected++;rejections.push({name:candidate.name,code:error.code||'LAYOUT_REJECTED',reason:error.message});}
  tested++;
 }
 if(best.changed&&replay){
  const name='Verify saved layout';
  if(signal?.aborted)throw new DOMException('Connection analysis cancelled.','AbortError');
  onProgress({completed:tested,total:plan.length+1,name});await yieldWork();
  if(signal?.aborted)throw new DOMException('Connection analysis cancelled.','AbortError');
  try{
   // Only drawing edits are saved. Rebuild once without candidate clearance
   // hints so the reviewed scene is exactly what Apply and reopen will show.
   const source={...project,layout:{...project.layout,drawingEdits:cleanDrawingEdits(best.edits)}};delete source._organizeCandidate;
   const checked=validate(buildPages(source));
   if(before.valid&&quality(checked.metrics,before)>=quality(before,before)-.001)throw Error('The saved layout does not improve the current drawing.');
   best={...best,...checked,changed:sceneGeometry(checked.page)!==sceneGeometry(page)};
  }catch(error){if(signal?.aborted||error.name==='AbortError')throw error;rejected++;rejections.push({name,code:error.code||'LAYOUT_REJECTED',reason:error.message});best=baseline;}
  tested++;
 }
 onProgress({completed:tested,total:tested,name:'Complete'});
 return {...best,before,tested,rejected,rejections,manualBends:cables(page).filter(path=>baselineEdits[path.editKey]?.points).length,keepManualBends};
}
