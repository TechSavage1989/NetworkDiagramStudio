import {parseHex} from './color-picker.mjs';
export const linkDefaults=[['SR fiber','#FF0000'],['LR fiber','#00B0F0'],['DAC','#000000'],['Copper','#FFD965'],['AP copper','#00B050'],['Fiber / media unspecified','#707A83']];
const goodKey=s=>typeof s==='string'&&s.length>0&&s.length<=100&&!['__proto__','constructor','prototype'].includes(s);
export function linkTypeIndex(name){return linkDefaults.findIndex(([n])=>n===name||n.startsWith('Fiber')&&/unspecified|Fiber/.test(name));}
export function cleanLinkStyles(raw){
 const result=Object.create(null);if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
 for(const [type,value] of Object.entries(raw).slice(0,100)){if(!goodKey(type)||!value||typeof value!=='object'||Array.isArray(value))continue;const s={};
  for(const key of ['title','description','lineTitle','lineDescription'])if(typeof value[key]==='string')s[key]=value[key].slice(0,key.includes('Description')||key==='description'?240:120);
  const color=parseHex(value.color);if(color)s.color=color;
  if(Number.isFinite(value.opacity)&&value.opacity>=0&&value.opacity<=1)s.opacity=value.opacity;
  if(Object.keys(s).length)result[type]=s;
 }return result;
}
export function applyLinkStyles(page,raw){
 const styles=cleanLinkStyles(raw);
 for(const path of page.items.filter(i=>i.type==='path')){const s=styles[path.linkType];if(!s)continue;if(s.color)path.color=s.color;if(s.opacity!=null)path.opacity=s.opacity;path.linkStyle=s;}
 for(const swatch of page.items.filter(i=>i.legendEntry&&i.type==='rect')){const s=styles[swatch.linkType];if(s?.color)swatch.fill=s.color;if(s?.opacity!=null)swatch.opacity=s.opacity;}
}
export function legendStyleId(type,color,opacity,configured=false){const ix=linkTypeIndex(type);return ix>=0&&(configured||linkDefaults[ix][1]===parseHex(color)&&opacity===1)?String(ix):'custom|'+type+'|'+parseHex(color)+'|'+opacity;}
export function changeLinkStyle(project,pages,type,change){
 const current=pages.flatMap(p=>p.items).find(i=>i.type==='path'&&i.linkType===type),color=current?.color||linkDefaults[linkTypeIndex(type)]?.[1]||'#707A83';
 const linkStyles=cleanLinkStyles({...project.layout?.linkStyles,[type]:{color,opacity:current?.opacity??1,...project.layout?.linkStyles?.[type],...change}}),drawingEdits={...project.layout?.drawingEdits};
 const style=linkStyles[type];if(!style)throw Error('Choose a valid link style.');
 for(const page of pages)for(const item of page.items.filter(i=>i.legendEntry&&i.linkType===type)){
  const part=item.type==='rect'?'swatch':item.legendDescription?'description':'text',key=(page.editScope||page.name)+'|legend|'+legendStyleId(type,style.color||item.fill||'#707A83',style.opacity??1,true)+'|'+part,old=drawingEdits[item.editKey];
  if(old&&key!==item.editKey&&!drawingEdits[key])drawingEdits[key]={...old};
 }
 return {linkStyles,drawingEdits};
}
export function linkCaption(project,type,speed){const style=project.layout?.linkStyles?.[type]||{};return [style.lineTitle||type,style.lineDescription,speed].filter(Boolean);}
