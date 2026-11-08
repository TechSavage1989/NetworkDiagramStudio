import {pageFamily} from '../page-options.mjs';

// Cache planner output before presentation, edit patches, page numbers and SVG
// are applied. A caller always receives its own scene, so selection/export code
// cannot alter the accepted cache. Drawing edits only invalidate their family.
export function cachedDraftPages(cache,family,project,build){
 if(!cache)return build();
 const layout=project.layout||{},reports=new Map((layout.reportPages||[]).map(r=>['report:'+r.id,r.family]));
 const familyOf=key=>reports.get(String(key).split('|')[0])||pageFamily(String(key).split('|')[0]);
 const drawingEdits=Object.fromEntries(Object.entries(layout.drawingEdits||{}).filter(([key])=>family==='reports'?key.startsWith('report:'):familyOf(key)===family||family==='logical'&&familyOf(key)==='trunk'));
 const input={...project,layout:{...layout,drawingEdits}};
 if(family!=='switchports')delete input.layout.switchport;
 // Source selection has already been composed into devices/links. Raw evidence
 // and source metadata do not participate in drawing calculations.
 delete input.evidence;delete input.warnings;
 const signature=JSON.stringify(input),previous=cache.get(family);
 if(previous?.signature===signature)return structuredClone(previous.pages);
 const pages=build();cache.set(family,{signature,pages:structuredClone(pages)});return pages;
}
