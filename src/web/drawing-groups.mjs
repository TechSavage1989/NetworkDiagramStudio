import {drawingObjects,drawingBounds,moveDrawingItems,scaleDrawingItems,cleanDrawingEdits} from './drawing-edits.mjs';
import {devicePoint} from './diagram/device-geometry.mjs';
import {unpresentPatch} from './presentation.mjs';

// Groups reference stable edit keys, never copies of native artwork or inventory.
export function cleanDrawingGroups(raw){
 const seen=new Set();return (Array.isArray(raw)?raw:[]).slice(0,500).flatMap(group=>{
  if(!group||typeof group.id!=='string'||!group.id||group.id.length>100)return [];
  const keys=[...new Set((Array.isArray(group.keys)?group.keys:[]).filter(k=>typeof k==='string'&&k.length<=500&&k.includes('|')&&!seen.has(k)))];
  if(keys.length<2)return [];keys.forEach(k=>seen.add(k));return [{id:group.id,keys}];
 });
}
export function expandDrawingGroups(groups,keys){const result=new Set(keys);for(const group of cleanDrawingGroups(groups))if(group.keys.some(k=>result.has(k)))for(const key of group.keys)result.add(key);return result;}
export function groupDrawingSelection(groups,keys,id){
 const selected=expandDrawingGroups(groups,keys);if(selected.size<2)throw Error('Select at least two objects to group.');
 return cleanDrawingGroups([...cleanDrawingGroups(groups).filter(g=>!g.keys.some(k=>selected.has(k))),{id,keys:[...selected]}]);
}
export function ungroupDrawingSelection(groups,keys){return cleanDrawingGroups(groups).filter(g=>!g.keys.some(k=>keys.has(k)));}
export function drawingGroupItem(page,keys){
 const hosts=new Set(page.items.filter(i=>i.type==='device'&&keys.has(i.editKey)).map(i=>i.key));
 // Attached optics follow their selected chassis. Transforming them a second
 // time would pin their generated socket position and fork module legends.
 const items=drawingObjects(page).filter(i=>keys.has(i.editKey)&&!keys.has(i.parent?.editKey)&&!(i.kind==='plug'&&hosts.has(i.host?.device))),boxes=items.map(drawingBounds).filter(Boolean);if(!boxes.length||boxes.length<2&&keys.size<2)return null;
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
 return {type:'group',editKey:items[0].editKey,x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y,angle:0,items};
}
export function transformDrawingGroup(page,edits,keys,{factor=1,angle=0,dx=0,dy=0}={}){
 const group=drawingGroupItem(page,keys);if(!group)return edits;
 if(group.items.every(i=>i.type==='path'))throw Error('Select the connected devices to resize or rotate cables.');
 if(!Number.isFinite(angle)||!Number.isFinite(factor)||factor<.1||factor>4)throw Error('Choose a valid group transform.');
 // Native details move/scale in their parent coordinates. Arbitrary detail or
 // cable rotation is not representable safely; reject the whole operation.
 if(angle&&group.items.some(i=>i.normalized||!['device','text','arttext','path'].includes(i.type)))throw Error('Rotate groups of whole devices and text. Ungroup to edit native details individually.');
 const cx=group.x+group.w/2,cy=group.y+group.h/2,c=Math.cos(angle),s=Math.sin(angle),offsets=new Map();
 for(const item of group.items){
  if(item.type==='path')continue;
  const local=item.type==='vector'?{x:Math.min(...item.commands.filter(c=>c.length===3).map(c=>c[1])),y:Math.min(...item.commands.filter(c=>c.length===3).map(c=>c[2]))}:item;
  const origin=item.normalized?devicePoint(item.parent,local.x,local.y):[local.x,local.y];
  const b=drawingBounds(item),x=b.x+b.w/2,y=b.y+b.h/2;
  // Scale the original anchor around the shared pivot; rotate centers while
  // preserving each object's unrotated local dimensions and native children.
  const rx=(x-cx)*c+(y-cy)*s-(x-cx),ry=-(x-cx)*s+(y-cy)*c-(y-cy);
  offsets.set(item.editKey,[(origin[0]-cx)*(factor-1)+rx*factor+dx,(origin[1]-cy)*(factor-1)+ry*factor+dy]);
 }
 let result=scaleDrawingItems(page,edits,new Set(offsets.keys()),factor);
 result=moveDrawingItems(page,result,offsets);
 for(const item of group.items){
  if(item.type==='path'){
   // Re-route from the physical sockets instead of rotating orthogonal bends.
   if(result[item.editKey]){result[item.editKey]={...result[item.editKey]};delete result[item.editKey].points;}
  }else if(angle)result[item.editKey]={...result[item.editKey],...unpresentPatch(item,{angle:Math.atan2(Math.sin((item.angle||0)+angle),Math.cos((item.angle||0)+angle)),rotationMode:'fixed'})};
 }
 const movedDevices=new Set(group.items.filter(i=>i.type==='device').map(i=>i.key));
 for(const path of page.items)if(path.type==='path'&&(movedDevices.has(path.from?.device)||movedDevices.has(path.to?.device))&&result[path.editKey]?.points){result[path.editKey]={...result[path.editKey]};delete result[path.editKey].points;}
 return cleanDrawingEdits(result);
}
