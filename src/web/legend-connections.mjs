import {connectionMediaInfo,cleanConnectionDetails} from './connection-types.mjs';
import {sameConnection,prepareConnection} from './connection-edit.mjs';
import {changeLinkStyle,migrateLegendEdits} from './link-styles.mjs';
import {cleanDrawingEdits} from './drawing-edits.mjs';
import {buildPages} from './diagram/index.mjs';
import {unpresentPatch} from './presentation.mjs';

const typeOf=(project,link)=>connectionMediaInfo(link.media,[link.a,link.b].some(id=>project.devices.find(d=>d.id===id)?.kind==='ap')).name;
export function legendConnections(project,pages,type){
 const records=project.links.filter(link=>typeOf(project,link)===type).map(link=>({link}));
 for(const path of pages.flatMap(page=>page.items).filter(item=>item.type==='path'&&item.linkType===type&&item.sourceLink)){
  if(!records.some(record=>sameConnection(record.link,path.sourceLink)))records.push({link:path.sourceLink,generatedDevice:path.generatedDevice});
 }
 return records;
}
export function commonConnectionDetails(records){
 return Object.fromEntries(['media','speed'].map(key=>{const values=[...new Set(records.map(({link})=>String(link[key]??(key==='media'?'unknown':''))))];return [key,values.length===1?values[0]:null];}));
}
// Prepare the entire legend edit without mutating the accepted project. One
// validation/history commit owns metadata, styles and migrated drawing patches.
export function changeLegendConnections(project,pages,type,details,style,extraEdits={},build=buildPages){
 const records=legendConnections(project,pages,type),changes={},widthChanged=Object.hasOwn(style,'weight');
 for(const key of ['media','speed'])if(Object.hasOwn(details,key))changes[key]=cleanConnectionDetails({[key]:details[key]})[key];
 const changed=records.filter(({link})=>Object.entries(changes).some(([key,value])=>value!==String(link[key]??(key==='media'?'unknown':''))));
 let next={...project,devices:project.devices.slice(),links:project.links.slice(),layout:{...project.layout,drawingEdits:cleanDrawingEdits({...project.layout?.drawingEdits,...extraEdits})}};
 if(!changed.length){next.layout={...next.layout,...changeLinkStyle(next,pages,type,{...(Object.keys(changes).length?{showSpeed:true}:{}),...style})};return next;}
 const oldPaths=pages.flatMap(page=>page.items.filter(item=>item.type==='path'&&changed.some(({link})=>sameConnection(link,item.sourceLink))).map(item=>({page:page.name,item,patch:next.layout.drawingEdits[item.editKey]})));
 for(const {link,generatedDevice} of changed){const index=next.links.findIndex(l=>sameConnection(l,link)),updated={...link,...changes};if(index<0)Object.assign(next,prepareConnection(next,updated,-1,generatedDevice));else next.links[index]={...next.links[index],...changes};}
 const edits=next.layout.drawingEdits;for(const {page:name,item} of oldPaths){
  delete edits[item.editKey];
  // Refresh overridden connection details too, retaining their position/font.
  for(const label of pages.find(page=>page.name===name)?.items||[])if(label.labelRole==='media'&&label.linkId===item.linkId&&edits[label.editKey]){const patch={...edits[label.editKey]};delete patch.value;edits[label.editKey]=patch;}
 }
 const types=[...new Set(records.map(({link})=>typeOf(next,{...link,...changes})))];
 for(const target of types){const value={...project.layout?.linkStyles?.[type],...style,showSpeed:true};for(const key of ['title','lineTitle'])if(value[key]===type)value[key]=target;next.layout={...next.layout,...changeLinkStyle(next,pages,target,value,{applyWeight:widthChanged,migrate:false})};}
 let rebuilt=build(next),widthGroupsChanged=false;const migrated=next.layout.drawingEdits;
 for(const page of rebuilt)for(const path of page.items.filter(item=>item.type==='path')){
  const old=oldPaths.find(old=>old.page===page.name&&sameConnection(old.item.sourceLink,path.sourceLink));if(!old)continue;
  if(old.patch){const patch={...old.patch};delete patch.color;delete patch.opacity;if(widthChanged)delete patch.weight;else if(patch.weight&&Math.abs(unpresentPatch(path,{weight:path.weight}).weight-patch.weight)>1e-8)widthGroupsChanged=true;migrated[path.editKey]=patch;}
 }
 // A restored per-line width can recreate a distinct legend row. Migrate
 // against that accepted identity, not the temporary default-width rebuild.
 if(widthGroupsChanged)rebuilt=build(next);
 let legendEdits=migrateLegendEdits(pages,rebuilt,migrated,type,types,{widthChanged});for(const target of types)if(target!==type)legendEdits=migrateLegendEdits(pages,rebuilt,legendEdits,target,[target],{widthChanged});
 next.layout.drawingEdits=legendEdits;
 return next;
}
