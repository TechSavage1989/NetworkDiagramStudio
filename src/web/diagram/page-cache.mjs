import {pageFamily} from '../page-options.mjs';

const documentationGroupingEdit=key=>/(?:^|\|)(?:VLANs and Routing\|(?:device|shared)\||Port Inventory - Interfaces\|scope\|)/.test(key)||/^VLANs and Routing(?: \d+)?\|text\|/.test(key);

// Cache planner output before presentation, edit patches, page numbers and SVG
// are applied. A caller always receives its own scene, so selection/export code
// cannot alter the accepted cache. Independent page families remain reusable.
export function cachedDraftPages(cache,family,project,build){
 if(!cache)return build();
 const layout=project.layout||{},reports=new Map((layout.reportPages||[]).map(r=>['report:'+r.id,r.family]));
 const familyOf=key=>reports.get(String(key).split('|')[0])||pageFamily(String(key).split('|')[0]);
 const drawingEdits=Object.fromEntries(Object.entries(layout.drawingEdits||{}).filter(([key])=>family==='reports'?key.startsWith('report:'):familyOf(key)===family||family==='logical'&&familyOf(key)==='trunk'));
 const input={...project,layout:{...layout,drawingEdits}};
 if(project._organizeCandidate?.family!==family)delete input._organizeCandidate;
 if(family!=='switchports')delete input.layout.switchport;
 // Editor-only and single-family settings must not rebuild every page:
 // snapping never changes a drawing; arrangement and cable text affect only
 // network pages; even line spacing affects network and wireless pages.
 delete input.layout.snapping;
 if(family!=='core'){delete input.layout.coreArrangement;delete input.layout.cableCaptions;}
 if(family!=='core'&&family!=='wireless'){delete input.layout.lineSpacing;delete input.layout.hopStyle;}
 // Source selection has already been composed into devices/links. Raw evidence
 // and source metadata do not participate in drawing calculations.
 delete input.evidence;delete input.warnings;
 // Interface and network tables share record grouping. A saved scope edit can
 // split or retain a shared section in either planner. Values/styles remain
 // local, so only edit-key presence enters this cross-family dependency.
 const groupingEdits=family==='ports'||family==='logical'?Object.keys(layout.drawingEdits||{}).filter(documentationGroupingEdit):[];
 const signature=JSON.stringify([input,groupingEdits]),previous=cache.get(family);
 if(previous?.signature===signature)return structuredClone(previous.pages);
 // Undo, Redo and returning to an earlier setting reuse a recent build of
 // this family instead of planning it again. The current entry stays at
 // cache.get(family); a few earlier ones are kept within a size budget.
 const older=recent(cache,family),index=older.findIndex(entry=>entry.signature===signature);
 if(index>=0){const [entry]=older.splice(index,1);remember(older,previous);cache.set(family,entry);return structuredClone(entry.pages);}
 const pages=build();remember(older,previous);cache.set(family,{signature,pages:structuredClone(pages)});return pages;
}
// Two earlier builds cover edit, Undo and Redo; projects with large embedded
// artwork (long signatures) keep fewer.
const histories=new WeakMap(),RECENT=2,RECENT_CHARS=24e6;
function recent(cache,family){
 // A cleared cache (new project or reload) starts a fresh history.
 let history=histories.get(cache);if(!history||!cache.size&&history.size)histories.set(cache,history=new Map());
 if(!history.has(family))history.set(family,[]);return history.get(family);
}
function remember(list,entry){
 if(!entry)return;list.unshift(entry);
 let chars=0;for(let i=0;i<list.length;i++){chars+=list[i].signature.length;if(i>=RECENT||chars>RECENT_CHARS){list.length=i;break;}}
}
