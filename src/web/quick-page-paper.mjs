import {effectiveWirelessPaperProject} from './wireless-paper-defaults.mjs';
import {cleanPageSetup,cleanPaper,visiblePagePaper,paperSizes} from './page-options.mjs';

// A quick change is intentionally page-local, even when its old value was inherited.
// Refit the chosen page without discarding authored object positions or other frames.
// With All pages, the change is global: it becomes the drawing default and
// replaces the same setting on every page group and page (their other
// settings stay). A later page-only change overrides it again, until the next
// global change.
export function quickPagePaperLayout(layout,page,patch,{all=false}={}){
 if(!page?.name&&!all)throw Error('Choose a drawing page first.');
 if(patch.preset!==undefined&&patch.preset!=='dynamic'&&!paperSizes.some(([key])=>key===patch.preset))throw Error('Choose a supported paper size.');
 if(patch.orientation!==undefined&&!['portrait','landscape'].includes(patch.orientation))throw Error('Choose a supported orientation.');
 if(patch.locked!==undefined&&typeof patch.locked!=='boolean')throw Error('Choose locked or unlocked.');
 const setup=cleanPageSetup(layout?.pageSetup),apply=current=>{const paper=cleanPaper({...current,...patch});if(paper.preset==='dynamic')paper.locked=false;return paper;};
 if(all){
  setup.visible.default=apply(setup.visible.default);
  for(const key of Object.keys(setup.visible.groups))setup.visible.groups[key]=apply(setup.visible.groups[key]);
  for(const key of Object.keys(setup.visible.pages))setup.visible.pages[key]=apply(setup.visible.pages[key]);
  setup.visible.lockFrames={};setup.visible.editFrames={};
 }else{
  setup.visible.pages[page.name]=apply(visiblePagePaper({layout},page));
  delete setup.visible.lockFrames[page.name];delete setup.visible.editFrames[page.name];
 }
 return effectiveWirelessPaperProject({layout:{...layout,pageSetup:setup}}).layout;
}
