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
 const pages=build();cache.set(family,{signature,pages:structuredClone(pages)});return pages;
}
