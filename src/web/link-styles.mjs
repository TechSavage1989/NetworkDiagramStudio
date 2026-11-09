import {parseHex} from './color-picker.mjs';
import {unpresentPatch} from './presentation.mjs';
export const linkDefaults=[['SR fiber','#FF0000'],['LR fiber','#00B0F0'],['DAC','#000000'],['Copper','#FFD965'],['AP copper','#00B050'],['Fiber / media unspecified','#707A83']];
export const defaultLinkWeight=4;
const validWeight=value=>Number.isFinite(value)&&value>0&&value<=12000;
const goodKey=s=>typeof s==='string'&&s.length>0&&s.length<=160&&!['__proto__','constructor','prototype'].includes(s);
export function linkTypeIndex(name){return name==='Media unspecified'?5:linkDefaults.findIndex(([n])=>n===name);}
export function cleanLinkStyles(raw){
 const result=Object.create(null);if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
 for(const [type,value] of Object.entries(raw).slice(0,100)){if(!goodKey(type)||!value||typeof value!=='object'||Array.isArray(value))continue;const s={};
  for(const key of ['title','description','lineTitle','lineDescription'])if(typeof value[key]==='string')s[key]=value[key].slice(0,key.includes('Description')||key==='description'?240:160);
  const color=parseHex(value.color);if(color)s.color=color;
  if(Number.isFinite(value.opacity)&&value.opacity>=0&&value.opacity<=1)s.opacity=value.opacity;
  if(validWeight(value.weight))s.weight=value.weight;
  if(typeof value.showSpeed==='boolean')s.showSpeed=value.showSpeed;
  if(Object.keys(s).length)result[type]=s;
 }return result;
}
export function linkWeight(project,type,override){return validWeight(override)?override:validWeight(project.layout?.linkStyles?.[type]?.weight)?project.layout.linkStyles[type].weight:defaultLinkWeight;}
export function applyLinkStyles(page,raw,edits={}){
 const styles=cleanLinkStyles(raw);
 for(const path of page.items.filter(i=>i.type==='path')){const s=styles[path.linkType];if(!s)continue;if(s.color)path.color=s.color;if(s.opacity!=null)path.opacity=s.opacity;if(s.weight&&!validWeight((edits[path.editKey]??edits[path.legacyEditKey])?.weight))path.weight=s.weight;path.linkStyle=s;}
 for(const swatch of page.items.filter(i=>i.legendEntry&&i.type==='rect')){const s=styles[swatch.linkType];if(s?.color)swatch.fill=s.color;if(s?.opacity!=null)swatch.opacity=s.opacity;if(s&&validWeight(swatch.sampleWeight))swatch.h=swatch.sampleWeight;}
}
export function legendStyleId(type,color,opacity,configured=false){const ix=linkTypeIndex(type);return ix>=0&&(configured||linkDefaults[ix][1]===parseHex(color)&&opacity===1)?String(ix):configured?'style|'+type:'custom|'+type+'|'+parseHex(color)+'|'+opacity;}
export function legendEntryId(type,color,opacity,configured=false,weight=defaultLinkWeight){return legendStyleId(type,color,opacity,configured)+(weight===defaultLinkWeight?'':'|weight|'+weight);}
const rawWeight=path=>{const weight=unpresentPatch(path,{weight:path.weight||defaultLinkWeight}).weight;return [path.from?.weight,path.to?.weight,path.linkStyle?.weight].find(original=>validWeight(original)&&Math.abs(original-weight)<=Number.EPSILON*16*Math.max(1,weight))??weight;};
function legendGroups(page,type){
 const prefix=(page.editScope||page.name)+'|legend|',groups=new Map();
 for(const path of page.items.filter(i=>i.type==='path'&&i.linkType===type)){const weight=rawWeight(path),key=prefix+legendEntryId(type,path.color,path.opacity??1,!!path.linkStyle,weight);groups.set(key,{key,weight});}
 // Existing scene keys also cover a legacy/custom entry after its text or
 // sample was edited. Hidden entries are recovered from the cable groups.
 for(const item of page.items.filter(i=>i.legendEntry&&i.linkType===type)){const part=/\|(swatch|text|description)(?:\|wrap\d+)?$/.exec(item.editKey||'');if(!part)continue;const key=item.editKey.slice(0,part.index),weight=Number(/\|weight\|([^|]+)$/.exec(key)?.[1]||defaultLinkWeight);groups.set(key,{key,weight});}
 return [...groups.values()];
}
// Map the complete legend identity, including thickness and wrapped text.
// The raw cable width is recovered before comparing presented page copies.
export function migrateLegendEdits(pages,targets,edits,type,targetTypes=[type],{widthChanged=false}={}){
 const result={...edits},written=new Set();
 for(const page of pages){const targetPage=targets.find(p=>(p.editScope||p.name)===(page.editScope||page.name))||targets.find(p=>p.name===page.name);if(!targetPage)continue;
  const activeKeys=new Set(targetTypes.flatMap(target=>legendGroups(page,target).map(group=>group.key)));
  for(const source of legendGroups(page,type))for(const [oldKey,old] of Object.entries(edits)){
   if(!oldKey.startsWith(source.key+'|'))continue;const suffix=oldKey.slice(source.key.length);if(!/^\|(swatch|text|description)(?:\|wrap\d+)?$/.test(suffix))continue;
   for(const targetType of targetTypes){const choices=legendGroups(targetPage,targetType),target=choices.find(g=>Math.abs(g.weight-source.weight)<1e-8)||choices[0];if(!target)continue;const key=target.key+suffix,patch={...old};
    if(widthChanged&&suffix==='|swatch'){delete patch.h;delete patch.weight;}
    // A key left behind by an earlier width/color must not beat the current
    // edited entry when that style returns. An actually active destination
    // keeps priority when several live entries merge into one shared style.
    if(key===oldKey||!result[key]||!activeKeys.has(target.key)&&!written.has(key)){result[key]=patch;written.add(key);}
   }
  }
 }
 return result;
}
export function changeLinkStyle(project,pages,type,change,{applyWeight=Object.hasOwn(change,'weight'),migrate=true}={}){
 if(Object.hasOwn(change,'weight')&&!validWeight(change.weight))throw Error('Line width must be greater than 0 and at most 12000.');
 const current=pages.flatMap(p=>p.items).find(i=>i.type==='path'&&i.linkType===type),color=current?.color||linkDefaults[linkTypeIndex(type)]?.[1]||'#707A83';
 const linkStyles=cleanLinkStyles({...project.layout?.linkStyles,[type]:{color,opacity:current?.opacity??1,...project.layout?.linkStyles?.[type],...change}}),drawingEdits={...project.layout?.drawingEdits};
 const style=linkStyles[type];if(!style)throw Error('Choose a valid link style.');
 if(applyWeight&&style.weight)for(const path of pages.flatMap(p=>p.items).filter(i=>i.type==='path'&&i.linkType===type))for(const key of [path.editKey,path.legacyEditKey])if(drawingEdits[key]?.weight){const patch={...drawingEdits[key]};delete patch.weight;if(Object.keys(patch).length)drawingEdits[key]=patch;else delete drawingEdits[key];}
 const targets=pages.map(page=>({...page,items:page.items.filter(i=>i.type==='path').map(path=>{
  if(path.linkType!==type)return path;const override=(drawingEdits[path.editKey]??drawingEdits[path.legacyEditKey])?.weight,weight=validWeight(override)?override:style.weight||rawWeight(path);
  return {...path,color:style.color||path.color,opacity:style.opacity??path.opacity??1,weight,presentation:undefined,linkStyle:style};
 })}));
 return {linkStyles,drawingEdits:migrate?migrateLegendEdits(pages,targets,drawingEdits,type,[type],{widthChanged:applyWeight&&!!style.weight}):drawingEdits};
}
export function hasLineCaption(project,type){const style=project.layout?.linkStyles?.[type];return !!(style&&(style.lineTitle?.trim()&&style.lineTitle!==type||style.lineDescription?.trim()));}
export function linkCaption(project,type,speed){const style=project.layout?.linkStyles?.[type]||{};return [style.lineTitle||type,style.lineDescription,speed].filter(Boolean);}
