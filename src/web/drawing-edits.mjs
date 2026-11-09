import {textFootprint} from './diagram/labels.mjs';
import {applyLinkStyles} from './link-styles.mjs';
import {placeBeside} from './arrange.mjs';
import {automaticDeviceGap} from './compact-layout.mjs';
import {unpresentPatch} from './presentation.mjs';
const keyOk=s=>typeof s==='string'&&s.length<=500&&!/^(?:__proto__|constructor|prototype)$/.test(s);
const colors=/^(?:#[0-9a-f]{3}|#[0-9a-f]{6}|none)$/i;
const numbers=['x','y','w','h','size','weight','angle'];
export function cleanDrawingEdits(raw){
 const result=Object.create(null);if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
 for(const [key,input] of Object.entries(raw).slice(0,10000)){
  if(!keyOk(key)||!input||typeof input!=='object'||Array.isArray(input))continue;const out={};
  for(const k of numbers)if(Number.isFinite(input[k])&&Math.abs(input[k])<=(['x','y'].includes(k)?1e7:12000)&&(!['w','h','size','weight'].includes(k)||input[k]>0))out[k]=input[k];
  if(Number.isFinite(input.opacity)&&input.opacity>=0&&input.opacity<=1)out.opacity=input.opacity;
  if(Number.isFinite(input.cableFraction)&&input.cableFraction>=0&&input.cableFraction<=1)out.cableFraction=input.cableFraction;
  if(['auto','fixed'].includes(input.rotationMode))out.rotationMode=input.rotationMode;
  for(const k of ['fill','stroke','color'])if(colors.test(input[k]||''))out[k]=input[k];
  if(typeof input.value==='string')out.value=input.value.slice(0,10000);
  if(typeof input.name==='string')out.name=input.name.slice(0,300);
  if(typeof input.bold==='boolean')out.bold=input.bold;if(typeof input.hidden==='boolean')out.hidden=input.hidden;
  if(['left','center','right'].includes(input.align))out.align=input.align;
  if(Array.isArray(input.points)&&input.points.length>=2&&input.points.length<=200&&input.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e7)))out.points=input.points.map(p=>[...p]);
  if(Array.isArray(input.commands)&&input.commands.length<=10000&&input.commands.every(c=>Array.isArray(c)&&['M','L','Z'].includes(c[0])&&c.length===(c[0]==='Z'?1:3)&&c.slice(1).every(v=>Number.isFinite(v)&&Math.abs(v)<=10000)))out.commands=input.commands.map(c=>[...c]);
  if(Object.keys(out).length)result[key]=out;
 }
 return result;
}
export const deviceEditKey=(page,g)=>(page.editScope||page.name)+'|device|'+g.sourceId+'|'+(g.kind==='plug'?'plug:'+g.host?.port:g.instanceKey||'body');
export function editDeviceShape(page,project,g){
 const key=deviceEditKey(page,g),legacy=deviceEditKey({name:page.name},g),edits=project.layout?.drawingEdits||{},patch=s=>edits[key+s]??edits[legacy+s],change=patch('');g.editKey=key;g.legacyEditKey=legacy;
 if(change)for(const k of ['x','y','w','h'])if(Number.isFinite(change[k]))g[k]=change[k];
 if(typeof change?.name==='string')g.name=change.name;
 g.children.forEach((c,i)=>{const slot=c.editSlot??i;c.editKey=key+'|child|'+slot;c.legacyEditKey=legacy+'|child|'+slot;const change=patch('|child|'+slot);if(change){Object.assign(c,change);if(c.anchorName){const [x,y]=c.anchorOrigin;for(const [port,point] of Object.entries(g.ports))if(Math.abs(point[0]-x)<1e-8&&Math.abs(point[1]-y)<1e-8)g.ports[port]=[c.x+c.w/2,c.y+c.h/2];}}});
 if(g.asset?.native){
  g.asset={...g.asset,native:{paths:g.asset.native.paths.map((p,i)=>({...p,...patch('|vector|'+i)})),texts:g.asset.native.texts.map((t,i)=>{const change=patch('|arttext|'+i);return {...t,...change,...(change?.value!=null?{text:change.value}:{})};})}};
 }
 const changes=Object.entries(edits).filter(([k])=>k===key||k.startsWith(key+'|')||k===legacy||k.startsWith(legacy+'|'));if(changes.length){const json=JSON.stringify(changes);let hash=0;for(const c of json)hash=Math.imul(hash,31)+c.charCodeAt(0)|0;g.masterKey+=':edit:'+hash;}
}
export function applyDrawingEdits(page,project){
 const edits=project.layout?.drawingEdits||{},seen=new Map(),taken=new Set(page.items.map(i=>i.editKey).filter(Boolean));
 page.items.forEach((item,i)=>{
  if(!item.editKey){const semantic=item.semantic||JSON.stringify(item.type==='text'?[item.value,item.labelRole]:item.type==='path'?[item.name.replace(/^L\d+ /,'')]:[item.type,item.x,item.y,item.w,item.h]);let hash=0;for(const c of semantic)hash=Math.imul(hash,31)+c.charCodeAt(0)|0;const base=page.name+'|'+item.type+'|'+hash;let count=seen.get(base)||0;while(taken.has(base+'|'+count))count++;seen.set(base,count+1);item.editKey=base+'|'+count;taken.add(item.editKey);}
  if(item.type!=='device'&&!item.labelRole&&!item._panelTransform&&edits[item.editKey])Object.assign(item,edits[item.editKey],{full:true});
 if(item.type==='path'&&edits[item.editKey]?.points&&item.from&&item.to){const pts=item.points.map(p=>[...p]);for(const [end,adj,anchor] of [[0,1,item.from],[pts.length-1,pts.length-2,item.to]]){const old=pts[end];if(pts[adj][0]===old[0])pts[adj][0]=anchor.x;else pts[adj][1]=anchor.y;pts[end]=[anchor.x,anchor.y];}item.points=pts;}
 });
 page.items=page.items.filter(i=>!edits[i.editKey]?.hidden);
 for(const i of page.items)if(i.type==='device')i.children=i.children.filter(c=>!edits[c.editKey]?.hidden);
 applyLinkStyles(page,project.layout?.linkStyles,edits);
}
export function drawingObjects(page){const out=[];for(const item of page.items){out.push(item);if(item.type!=='device')continue;if(!item.asset)for(const child of item.children)out.push({...child,parent:item,normalized:true});else if(item.asset.native){item.asset.native.paths.forEach((p,i)=>out.push({...p,type:'vector',name:p.name||'Vector path '+(i+1),editKey:item.editKey+'|vector|'+i,parent:item,normalized:true}));item.asset.native.texts.forEach((t,i)=>out.push({...t,type:'arttext',value:t.text,editKey:item.editKey+'|arttext|'+i,parent:item,normalized:true}));}}return out;}
export function drawingBounds(item){
 if(item.type==='arttext'&&item.normalized)return {key:item.editKey,x:item.parent.x+(item.x-item.w/2)*item.parent.w,y:item.parent.y+item.y*item.parent.h-item.size*item.parent.w*.7,w:item.w*item.parent.w,h:item.size*item.parent.w*1.4};
 let x=item.x,y=item.y,w=item.w,h=item.h;
 if(item.type==='path'||item.type==='vector'){
  const pts=item.type==='path'?item.points:item.commands.filter(c=>c.length===3).map(c=>c.slice(1));if(!pts.length)return null;
  x=Math.min(...pts.map(p=>p[0]));y=Math.min(...pts.map(p=>p[1]));w=Math.max(...pts.map(p=>p[0]))-x;h=Math.max(...pts.map(p=>p[1]))-y;
 }else if(item.type==='arttext'){x=item.x-item.w/2;y=item.y-item.size*.7;h=item.size*1.4;}
 if(item.normalized){x=item.parent.x+x*item.parent.w;y=item.parent.y+y*item.parent.h;w*=item.parent.w;h*=item.parent.h;}
 const bounds=item.type==='text'?textFootprint({x,y,w,h,angle:item.angle}):{x,y,w,h};
 return {key:item.editKey,x:bounds.x,y:bounds.y,w:bounds.w,h:bounds.h};
}
function moveCable(item,dx,dy){
 const original=item.points;
 if(!item.from||!item.to)return original.map(([x,y])=>[x+dx,y+dy]);
 if(original.length===2){const [a,b]=original;if(a[0]===b[0]){const sign=Math.sign(b[1]-a[1])||1,space=Math.min(12,Math.abs(b[1]-a[1])/3);return [a,[a[0],a[1]+space*sign],[a[0]+dx,a[1]+space*sign],[a[0]+dx,b[1]-space*sign],[b[0],b[1]-space*sign],b].map(p=>[...p]);}const sign=Math.sign(b[0]-a[0])||1,space=Math.min(12,Math.abs(b[0]-a[0])/3);return [a,[a[0]+space*sign,a[1]],[a[0]+space*sign,a[1]+dy],[b[0]-space*sign,a[1]+dy],[b[0]-space*sign,b[1]],b].map(p=>[...p]);}
 const pts=original.map(([x,y],i)=>i===0||i===original.length-1?[x,y]:[x+dx,y+dy]);
 for(const [end,adj] of [[0,1],[pts.length-1,pts.length-2]])if(original[end][0]===original[adj][0])pts[adj][0]=original[end][0];else pts[adj][1]=original[end][1];
 return pts;
}
// The top-level device that owns a cable end; a plug resolves to its host.
function endOwner(shapes,end){let shape=shapes.get(end?.device);if(shape?.kind==='plug')shape=shapes.get(shape.host?.device);return shape?.editKey;}
const sameOffset=(a,b)=>a&&b&&a[0]===b[0]&&a[1]===b[1];
// Everything one move carries. Generated WAN/ISP/egress cards travel with the
// device they hand off from, so they stay above it by default and keep any
// arrangement the user gave them; a card that has its own offset, or is the
// placement reference (exclude), stays independent. A cable with saved bends
// whose two ends move together moves with them instead of keeping old bends.
export function movementOffsets(page,edits,offsets,{exclude=[]}={}){
 const result=new Map(offsets),skip=new Set(exclude),shapes=new Map(page.items.filter(i=>i.type==='device').map(i=>[i.key,i]));
 for(const card of page.items)if(card.type==='device'&&card.kind==='handoff'&&card.ownerKey&&result.has(card.ownerKey)&&!result.has(card.editKey)&&!skip.has(card.editKey))result.set(card.editKey,result.get(card.ownerKey));
 for(const path of page.items){
  if(path.type!=='path'||!path.from||!path.to||result.has(path.editKey)||!(edits?.[path.editKey]?.points||edits?.[path.legacyEditKey]?.points))continue;
  const a=result.get(endOwner(shapes,path.from)),b=result.get(endOwner(shapes,path.to));
  if(sameOffset(a,b)&&(a[0]||a[1]))result.set(path.editKey,a);
 }
 return result;
}
// Keep manually dragged core equipment clear of the information sidebar.
// The scene may expand to the right, but the reserved content area is solid.
export function safeCoreMoveOffsets(page,offsets){
 if(page?.legendLayout!=='sidebar'||!Number.isFinite(page.sidebar?.divider))return new Map(offsets);
 const boundary=page.sidebar.divider+20,out=new Map(offsets);
 for(const [key,[dx,dy]] of out){
  const item=page.items.find(i=>i.editKey===key);
  if(item?.type==='device'&&item.kind!=='plug'&&item.kind!=='handoff'&&!item.moduleLegend&&item.sourceId!=='module-legend')
   out.set(key,[Math.max(dx,boundary-item.x),dy]);
 }
 return out;
}
export function moveDrawingItems(page,edits,offsets,{preventSidebarOverlap=false}={}){
 offsets=movementOffsets(page,edits,preventSidebarOverlap?safeCoreMoveOffsets(page,offsets):offsets);
 const objects=drawingObjects(page),result=cleanDrawingEdits(edits),shapes=new Map(page.items.filter(i=>i.type==='device').map(i=>[i.key,i]));
 if(page.coreDeviceIds&&objects.some(item=>offsets.has(item.editKey)&&(item.type==='device'||item.parent?.type==='device'))){
  // Any positioned device detail disables automatic core packing. Preserve
  // the visible body positions before that first edit, including WAN cards.
  // Do not add these pins to offsets: an independently moved child must not
  // be treated as if its parent was part of the user's selection.
  const ids=new Set(page.coreDeviceIds);
  for(const item of page.items)if(item.type==='device'&&item.kind!=='plug'&&(ids.has(item.sourceId)||item.kind==='handoff')&&!item.sourceId?.startsWith('module-legend-')&&!item.sourceId?.startsWith('continuation-'))result[item.editKey]={...result[item.editKey],...unpresentPatch(item,{x:item.x,y:item.y})};
 }
 for(const [key,[dx,dy]] of offsets){
  const item=objects.find(o=>o.editKey===key);if(!item||item.parent&&offsets.has(item.parent.editKey))continue;
  const localX=item.normalized?dx/item.parent.w:dx,localY=item.normalized?dy/item.parent.h:dy,patch={...(result[key]||{})};
  // A cable whose two ends move by the same offset is translated whole.
  if(item.type==='path')patch.points=item.from&&item.to&&sameOffset(offsets.get(endOwner(shapes,item.from)),[dx,dy])&&sameOffset(offsets.get(endOwner(shapes,item.to)),[dx,dy])?item.points.map(([x,y])=>[x+dx,y+dy]):moveCable(item,dx,dy);
  else if(item.type==='vector')patch.commands=item.commands.map(c=>c.length===3?[c[0],c[1]+localX,c[2]+localY]:[...c]);
  else {
   Object.assign(patch,{x:item.x+localX,y:item.y+localY});
   if(item.labelRole){delete patch.cableFraction;if(item.angle)patch.angle=item.angle;}
  }
  const changed=item.type==='path'?{points:patch.points}:item.type==='vector'?{commands:patch.commands}:{x:patch.x,y:patch.y,...(item.labelRole&&item.angle?{angle:item.angle}:{})};
  result[key]={...(result[key]||{}),...unpresentPatch(item,changed)};
  if(item.labelRole)delete result[key].cableFraction;
 }
 return cleanDrawingEdits(result);
}
export function placeDrawingDevices(page,edits,keys,referenceKey,side,spacing='auto'){
 const devices=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),picked=new Set(keys),reference=devices.find(i=>i.editKey===referenceKey&&!picked.has(i.editKey));
 if(!devices.some(i=>picked.has(i.editKey))||!reference)throw Error('Choose devices and a different reference device.');
 // WAN/ISP cards of a placed device come along as part of its group.
 const selected=new Set(movementOffsets({items:devices},{},new Map([...picked].map(k=>[k,[0,0]])),{exclude:[referenceKey]}).keys()),chosen=devices.filter(i=>selected.has(i.editKey));
 const scale=reference.presentation?.scale||1,padding=typeof spacing==='number'?spacing:spacing==='auto'?automaticDeviceGap(page,[...chosen,reference],side):({compact:56,normal:96,wide:160}[spacing]??96)*scale;
 if(!Number.isFinite(padding))throw Error('Choose a valid placement spacing.');
 const others=devices.filter(i=>!selected.has(i.editKey)),obstacles=others.filter(i=>i!==reference).map(drawingBounds);
 // The information sidebar is a reserved, solid region. Place beside must
 // search for a clear location or report a capacity issue, never overlap it.
 if(page.legendLayout==='sidebar'&&Number.isFinite(page.sidebar?.divider)){
  const x=page.originX||0,y=page.originY||0,right=page.sidebar.divider+20;
  obstacles.push({key:'reserved-sidebar',x,y,w:Math.max(0,right-x),h:page.height});
 }
 const offsets=placeBeside(chosen.map(drawingBounds),drawingBounds(reference),side,obstacles,padding,{clearance:20*scale,maxAdjustment:Math.max(160*scale,padding*2)});
 // Pin every visible reference, including generated WAN cards, before core
 // routing retries can choose a new automatic arrangement. This is one edit.
 for(const item of others)offsets.set(item.editKey,[0,0]);
 return moveDrawingItems(page,edits,offsets);
}
export function scaleDrawingItems(page,edits,keys,factor){
 if(!Number.isFinite(factor)||factor<.1||factor>4)throw Error('Choose a size from 10 to 400 percent.');
 const selected=new Set(keys),result=cleanDrawingEdits(edits);
 for(const item of drawingObjects(page)){
  if(!selected.has(item.editKey)||selected.has(item.parent?.editKey)||item.type==='path')continue;
  const change={};
  for(const k of ['w','h','size'])if(Number.isFinite(item[k]))change[k]=item[k]*factor;
  if(item.type==='vector'){
   const points=item.commands.filter(c=>c.length===3),x=Math.min(...points.map(c=>c[1])),y=Math.min(...points.map(c=>c[2]));
   change.commands=item.commands.map(c=>c.length===3?[c[0],x+(c[1]-x)*factor,y+(c[2]-y)*factor]:[...c]);
  }
  const patch=unpresentPatch(item,change),clean=cleanDrawingEdits({[item.editKey]:patch})[item.editKey];
  if(!clean||Object.keys(clean).length!==Object.keys(patch).length)throw Error('This size exceeds the supported object dimensions.');
  result[item.editKey]={...result[item.editKey],...clean};
 }
 return result;
}
