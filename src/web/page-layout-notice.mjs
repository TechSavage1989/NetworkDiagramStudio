// A saved-frame migration and an overflow are independent facts. Never let
// a more urgent clipping warning hide the action that can refresh that frame.
export function pageLayoutNotice(page){
 if(!page)return '';
 const notes=[],readable=page.paperReadability,smallText=readable?.minimumPt>0&&readable.actualPt!=null&&readable.actualPt<readable.minimumPt-.01;
 const whole=page.wirelessLayout?.wholeSwitch,below=readable?.apActualPt!=null&&readable.apActualPt<readable.apMinimumPt-.05;
 // A whole-switch sheet keeps every AP with its switch on any paper; say
 // what that costs in text size and how to get larger text.
 const wholeNote=readable?.apActualPt!=null&&whole&&(below||smallText);
 if(wholeNote)notes.push('Automatic AP layout: all '+new Set(page.wirelessLayout.links||[]).size+' AP links stay on this sheet with their switch, so AP details are '+readable.apActualPt.toFixed(1)+' pt'+(smallText&&readable.actualPt<readable.apActualPt-.05?' and the smallest text (port numbers) '+readable.actualPt.toFixed(1)+' pt':'')+' (below the '+readable.apMinimumPt+' pt target). For larger text, choose larger paper, Paper & print → Wireless stack view → Only stack members with AP links, or Paper & print → Paper layout → continuing wireless sheets.');
 else if(readable?.apActualPt!=null)notes.push('Automatic AP layout: AP details are '+readable.apActualPt.toFixed(1)+' pt on this paper'+(below?' (below the '+readable.apMinimumPt+' pt target; choose larger paper or review saved/manual text sizes).':'. Full switch-port labels are also on the AP cards. Small physical socket artwork may still need zoom or larger paper.'));
 if(page.wirelessLayout?.routingCompromise)notes.push('Some AP cables could not be routed fully clear on one sheet. Choose larger paper for a cleaner layout.');
 if(page.panelFitLegacy)notes.push('This saved page keeps its earlier layout. For readable information panels and link keys, open Paper & print and Apply paper settings to recalculate the fit. Your saved object edits are retained.');
 if(readable?.overflow)notes.push('This diagram needs more space at '+readable.minimumPt+' pt minimum text. Choose larger paper or split the drawing; Print/PDF may clip off-page content. Layout & content has text and panel sizing controls.');
 else if(page.pageOverflow)notes.push('Content extends beyond the page. Print/PDF and page-sized exports may clip it. Open Paper & print to change the sheet.');
 if(smallText&&wholeNote&&!page.pageOverflow){}
 else if(smallText&&!readable.preserved&&!page.pageOverflow)notes.push('The complete diagram fits this sheet, but some text is '+readable.actualPt.toFixed(1)+' pt, below the '+readable.minimumPt+' pt target. Choose larger paper, fewer details or additional pages for readable printing.');
 else if(smallText)notes.push('This page keeps text as small as '+readable.actualPt.toFixed(1)+' pt. For editable diagrams, open Paper & print and Apply paper settings to recalculate fitting. Imported artwork and native report sheets retain source typography; choose larger paper. Manual font sizes stay yours.');
 return notes.join(' ');
}
