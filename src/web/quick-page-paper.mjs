import {effectiveWirelessPaperProject} from './wireless-paper-defaults.mjs';
import {cleanPageSetup,cleanPaper,visiblePagePaper,paperSizes} from './page-options.mjs';

// A quick change is intentionally page-local, even when its old value was inherited.
// Refit the chosen page without discarding authored object positions or other frames.
export function quickPagePaperLayout(layout,page,patch){
 if(!page?.name)throw Error('Choose a drawing page first.');
 if(patch.preset!==undefined&&patch.preset!=='dynamic'&&!paperSizes.some(([key])=>key===patch.preset))throw Error('Choose a supported paper size.');
 if(patch.orientation!==undefined&&!['portrait','landscape'].includes(patch.orientation))throw Error('Choose a supported orientation.');
 const setup=cleanPageSetup(layout?.pageSetup),current=visiblePagePaper({layout},page);
 const paper=cleanPaper({...current,...patch});
 if(paper.preset==='dynamic')paper.locked=false;
 setup.visible.pages[page.name]=paper;
 delete setup.visible.lockFrames[page.name];delete setup.visible.editFrames[page.name];
 return effectiveWirelessPaperProject({layout:{...layout,pageSetup:setup}}).layout;
}
