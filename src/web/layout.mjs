import {cleanSnap} from './snapping.mjs';
import {cleanDrawingEdits} from './drawing-edits.mjs';
import {cleanLinkStyles} from './link-styles.mjs';
import {cleanPageNumbers,cleanPageSetup} from './page-options.mjs';
import {cleanPresentation,cleanReportPages} from './presentation.mjs';
import {cleanSwitchportSettings} from './reports/settings.mjs';
// Automatic core arrangement. Compact packs the saved order into the least
// area; vertical keeps one column; fixed counts keep that many
// columns. Every arrangement reads down each column, then across.
export const CORE_ARRANGEMENTS=Object.freeze(['compact','vertical','columns-2','columns-3','columns-4']);
export function coreArrangement(project,corePageId){
 const page=corePageId&&project?.layout?.corePages?.find(p=>p.id===corePageId),value=page?.arrangement||project?.layout?.coreArrangement;
 return CORE_ARRANGEMENTS.includes(value)?value:'compact';
}
export const coreLinkKey=link=>[link.a+'/'+link.ap,link.b+'/'+link.bp].sort().join('|');
export function orderedDevices(project){
 const order=new Map((project.layout?.order||[]).map((id,i)=>[id,i]));
 return (project.devices||[]).slice().sort((a,b)=>(order.get(a.id)??1e6)-(order.get(b.id)??1e6));
}
export function moveDevice(project,id,before){
 project.layout||={};const order=orderedDevices(project).map(d=>d.id).filter(v=>v!==id);
 const at=before==null?order.length:order.indexOf(before);order.splice(at<0?order.length:at,0,id);project.layout.order=order;
}
export function moveStep(project,id,step){
 const ids=orderedDevices(project).map(d=>d.id),i=ids.indexOf(id),j=i+step;
 if(i<0||j<0||j>=ids.length)return;
 [ids[i],ids[j]]=[ids[j],ids[i]];project.layout||={};project.layout.order=ids;
}
export function cleanLayout(raw,ids){
 const p=raw&&typeof raw==='object'?raw:{},known=new Set(ids),used=new Set(),pages=[];
 for(const v of Array.isArray(p.corePages)?p.corePages.slice(0,100):[]){
  if(!v||typeof v.id!=='string'||used.has(v.id))continue;used.add(v.id);
  pages.push({id:v.id.slice(0,120),showReferences:v.showReferences!==false,hiddenReferences:[...new Set((Array.isArray(v.hiddenReferences)?v.hiddenReferences:[]).filter(key=>typeof key==='string'&&key.length<=500).slice(0,10000))],name:String(v.name||'Core Network').slice(0,80),...(CORE_ARRANGEMENTS.includes(v.arrangement)?{arrangement:v.arrangement}:{}),devices:[...new Set((Array.isArray(v.devices)?v.devices:[]).filter(id=>known.has(id)))]});
 }
 return {suppressedHandoffs:[...new Set((Array.isArray(p.suppressedHandoffs)?p.suppressedHandoffs:[]).filter(id=>typeof id==='string'&&id.startsWith('handoff:')&&id.length<=650))],pageSetup:cleanPageSetup(p.pageSetup),linkStyles:cleanLinkStyles(p.linkStyles),pageNumbers:cleanPageNumbers(p.pageNumbers),snapping:cleanSnap(p.snapping),drawingEdits:cleanDrawingEdits(p.drawingEdits),order:[...new Set((Array.isArray(p.order)?p.order:[]).filter(id=>known.has(id)))],corePages:pages,
  switchport:cleanSwitchportSettings({...p.switchport,deviceIds:(Array.isArray(p.switchport?.deviceIds)?p.switchport.deviceIds:[]).filter(id=>known.has(id))}),presentation:cleanPresentation(p.presentation),reportPages:cleanReportPages(p.reportPages,ids),coreArrangement:CORE_ARRANGEMENTS.includes(p.coreArrangement)?p.coreArrangement:'compact',coreExclude:[...new Set((Array.isArray(p.coreExclude)?p.coreExclude:[]).filter(id=>known.has(id)))],includeAPs:p.includeAPs===true,documentation:p.documentation==='full'?'full':'concise',
  portMap:{presentation:['separate','combined','auto'].includes(p.portMap?.presentation)?p.portMap.presentation:p.portMap?.repeatFaceplate===true?'combined':'auto',density:p.portMap?.density==='expanded'?'expanded':'compact',repeatFaceplate:p.portMap?.repeatFaceplate===true,detailFilter:['all','assigned','connected'].includes(p.portMap?.detailFilter)?p.portMap.detailFilter:'all',groupConsecutive:p.portMap?.groupConsecutive!==false}};
}
