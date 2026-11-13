import {pageFamily} from '../page-options.mjs';

const documentationGroupingEdit=key=>/(?:^|\|)(?:VLANs and Routing\|(?:device|shared)\||Port Inventory - Interfaces\|scope\|)/.test(key)||/^VLANs and Routing(?: \d+)?\|text\|/.test(key);

// Cache planner output before presentation, edit patches, page numbers and SVG
// are applied. A caller always receives its own scene, so selection/export code
// cannot alter the accepted cache. Independent page families remain reusable.
export function cachedDraftPages(cache,family,project,build){
 if(!cache)return build();
 const entry=cachedDraftEntry(cache,family,project,build);return entry.shared?structuredClone(entry.pages):entry.pages;
}
// The family's draft pages and a serial that identifies this exact build.
// Shared pages belong to the cache and must be copied before any change; a
// fresh build is the caller's own.
let serials=0;
export function cachedDraftEntry(cache,family,project,build){
 const layout=project.layout||{},reports=new Map((layout.reportPages||[]).map(r=>['report:'+r.id,r.family]));
 const familyOf=key=>reports.get(String(key).split('|')[0])||pageFamily(String(key).split('|')[0]);
 const own=key=>family==='reports'?String(key).startsWith('report:'):familyOf(key)===family||family==='logical'&&familyOf(key)==='trunk';
 const drawingEdits=Object.fromEntries(Object.entries(layout.drawingEdits||{}).filter(([key])=>own(key)));
 const input={...project,layout:{...layout,drawingEdits}};
 // Saved paper frames and single-page paper belong to one page. The first
 // edit on a paper page saves its frame; other families must not replan for
 // it. Wireless-only paper choices only reach the wireless planner.
 const visible=layout.pageSetup?.visible;
 if(visible&&typeof visible==='object'){
  const next={...visible};for(const field of ['lockFrames','editFrames','pages'])if(next[field]&&typeof next[field]==='object')next[field]=Object.fromEntries(Object.entries(next[field]).filter(([name])=>own(name)));
  if(family!=='wireless'){delete next.wirelessFit;delete next.wirelessFitExplicit;delete next.wirelessStack;}
  // Network and VLAN planners never read saved frames.
  if(family==='core'||family==='logical'){delete next.lockFrames;delete next.editFrames;}
  input.layout.pageSetup={...layout.pageSetup,visible:next};
 }
 if(project._organizeCandidate?.family!==family)delete input._organizeCandidate;
 if(family!=='switchports')delete input.layout.switchport;
 // Editor-only and single-family settings must not rebuild every page:
 // snapping never changes a drawing; arrangement and cable text affect only
 // network pages; even line spacing affects network and wireless pages.
 delete input.layout.snapping;
 // Global text styles are applied when pages are finished, never by a planner.
 // The site map measures its cards with the chosen sizes, so it keeps them.
 if(family!=='sitemap')delete input.layout.textStyles;
 if(family!=='sitemap')delete input.layout.siteMap;
 if(family!=='core'){delete input.layout.coreArrangement;delete input.layout.cableCaptions;delete input.layout.corePortNumbers;delete input.layout.deviceCaptions;}
 if(family!=='core'&&family!=='wireless'){delete input.layout.lineSpacing;delete input.layout.hopStyle;}
 // Which devices share a VLANs and Routing or Port Inventory page.
 if(family!=='logical'&&family!=='ports')delete input.layout.documentPages;
 // Source selection has already been composed into devices/links. Raw evidence
 // and source metadata do not participate in drawing calculations.
 delete input.evidence;delete input.warnings;
 // Interface and network tables share record grouping. A saved scope edit can
 // split or retain a shared section in either planner. Values/styles remain
 // local, so only edit-key presence enters this cross-family dependency.
 const groupingEdits=family==='ports'||family==='logical'?Object.keys(layout.drawingEdits||{}).filter(documentationGroupingEdit):[];
 const signature=JSON.stringify([input,groupingEdits]),previous=cache.get(family);
 if(previous?.signature===signature)return {pages:previous.pages,serial:previous.serial,shared:true};
 // Undo, Redo and returning to an earlier setting reuse a recent build of
 // this family instead of planning it again. The current entry stays at
 // cache.get(family); a few earlier ones are kept within a size budget.
 const older=recent(cache,family),index=older.findIndex(entry=>entry.signature===signature);
 if(index>=0){const [entry]=older.splice(index,1);remember(older,previous);cache.set(family,entry);return {pages:entry.pages,serial:entry.serial,shared:true};}
 const pages=build(),serial=++serials;remember(older,previous);cache.set(family,{signature,serial,pages:structuredClone(pages)});return {pages,serial,shared:false};
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

// Finished pages (edits applied, fitted, SVG written) keyed by their draft
// build, name and position. A page is reused only when the layout settings
// and its own family's drawing edits are exactly the same; the memo starts
// again with a cleared cache.
const finishedMemos=new WeakMap(),FINISHED_KEEP=3;
export function finishedPageMemo(cache){
 if(!cache)return null;
 let memo=finishedMemos.get(cache);if(!memo||!cache.size&&memo.size)finishedMemos.set(cache,memo=new Map());
 return memo;
}
export function rememberFinished(memo,key,value,pageCount){
 memo.delete(key);memo.set(key,value);
 const limit=Math.max(24,FINISHED_KEEP*pageCount);while(memo.size>limit)memo.delete(memo.keys().next().value);
}
export function familyEditsOf(project,family){
 const layout=project.layout||{},reports=new Map((layout.reportPages||[]).map(r=>['report:'+r.id,r.family]));
 const familyOf=key=>reports.get(String(key).split('|')[0])||pageFamily(String(key).split('|')[0]);
 return JSON.stringify(Object.entries(layout.drawingEdits||{}).filter(([key])=>familyOf(key)===family||family==='logical'&&familyOf(key)==='trunk'));
}
