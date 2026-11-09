// Project-wide defaults for each editable drawing text category.
// Each preset is optional. Explicit per-object edits always take priority.
export const globalTextCategories=[
 ['deviceNames','Device names'],
 ['deviceDetails','Device details and model captions'],
 ['portLabels','Port and interface labels'],
 ['linkLabels','Connection and cable labels'],
 ['pageTitles','Page titles'],
 ['pageMetadata','Project headings, subtitles and footers'],
 ['connectionKey','Connection type legend'],
 ['sidebarText','Information sidebar text'],
 ['tableText','Port inventory and routing table text'],
 ['otherText','Other diagram text']
];
const ids=new Set(globalTextCategories.map(([id])=>id));
const isObject=x=>x&&typeof x==='object'&&!Array.isArray(x);
const hex=/^#[0-9A-Fa-f]{6}$/;
export function cleanGlobalTextStyles(raw={}){
 const src=isObject(raw)?raw:{},result={};
 for(const [key,value] of Object.entries(src)){
  if(!ids.has(key)||!isObject(value))continue;
  const out={};
  if(Number.isFinite(value.scale)&&value.scale>=.4&&value.scale<=2.5&&value.scale!==1)out.scale=value.scale;
  if(typeof value.color==='string'&&hex.test(value.color))out.color=value.color.toUpperCase();
  if(typeof value.bold==='boolean')out.bold=value.bold;
  if(['left','center','right'].includes(value.align))out.align=value.align;
  if(Object.keys(out).length)result[key]=out;
 }
 return result;
}
export function globalTextCategory(item){
 if(item?.type!=='text')return null;
 if(item.pageTitle)return 'pageTitles';
 if(item.pageHeading||item.pageFrame)return 'pageMetadata';
 if(item.labelRole)return item.labelRole==='port'?'portLabels':'linkLabels';
 if(item.titleOwner||item.deviceInfo)return item.titleSlot==='detail'||item.deviceInfo==='model'||item.deviceInfo==='mac'?'deviceDetails':'deviceNames';
 if(item.legendEntry||/\|legend\|/.test(item.editKey||''))return 'connectionKey';
 if(item.panelGroup||/\|info-panel\|/.test(item.editKey||''))return 'sidebarText';
 if(item.portTableRole==='interface')return 'portLabels';
 if(item.tableContent||item.logicalColumn!=null||item.logicalRecord!=null)return 'tableText';
 return 'otherText';
}
export function applyGlobalTextStyles(page,raw,edits={}){
 const styles=cleanGlobalTextStyles(raw);
 if(!Object.keys(styles).length)return page;
 for(const item of page?.items||[]){
  const category=globalTextCategory(item),style=styles[category];
  if(!style)continue;
  const local=isObject(edits[item.editKey])?edits[item.editKey]:{};
  if(style.color&&!Object.hasOwn(local,'color'))item.color=style.color;
  if(typeof style.bold==='boolean'&&!Object.hasOwn(local,'bold'))item.bold=style.bold;
  if(style.align&&!Object.hasOwn(local,'align'))item.align=style.align;
  if(style.scale&&!Object.hasOwn(local,'size')){
   const factor=style.scale,oldWidth=item.w,oldHeight=item.h;
   item.size*=factor;
   // Retain fixed table-column widths and faceplate bounds; textLayout may
   // reduce font size to its readable floor when a fixed cell is too narrow.
   if(!item.tableContent&&!item.pageFrame&&!item.panelGroup){
    item.w=oldWidth*factor;item.h=oldHeight*factor;
    if(item.align==='center')item.x-=(item.w-oldWidth)/2;
    if(item.align==='right')item.x-=item.w-oldWidth;
    item.y-=(item.h-oldHeight)/2;
   }
  }
 }
 return page;
}
