import {paperSizes} from '../page-options.mjs';

// Report paper is independent of the network drawing's page setup.
// Preserve the existing A4 landscape default for saved projects.
export const reportPaperChoices=paperSizes.filter(([id])=>new Set(['letter','legal','tabloid','a5','a4','a3','a2']).has(id)).map(([id,name])=>[id,name]);
const dimensions=new Map(paperSizes.map(([id,name,w,h])=>[id,{name,w,h}]));
export function cleanReportPaper(raw={}){
 const input=typeof raw==='string'?{preset:raw}:raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 return {preset:reportPaperChoices.some(([id])=>id===input.preset)?input.preset:'a4',orientation:input.orientation==='portrait'?'portrait':'landscape'};
}
export function reportPageGeometry(raw={}){
 const paper=cleanReportPaper(raw),source=dimensions.get(paper.preset),short=Math.min(source.w,source.h),long=Math.max(source.w,source.h),portrait=paper.orientation==='portrait';
 const widthMm=portrait?short:long,heightMm=portrait?long:short;
 return {...paper,widthMm,heightMm,width:widthMm*96/25.4,height:heightMm*96/25.4};
}
export function reportPageLabel(raw={}){
 const paper=cleanReportPaper(raw),name=dimensions.get(paper.preset).name;
 return name+' '+paper.orientation;
}
export function reportFileStem(raw={}){
 const paper=cleanReportPaper(raw);
 return paper.preset==='a4'&&paper.orientation==='landscape'?'a4':paper.preset+'-'+paper.orientation;
}
