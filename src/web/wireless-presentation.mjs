import {hasAuthoredWirelessGeometry} from './wireless-paper-defaults.mjs';
import {presentation} from './presentation.mjs';

// A deliberate AP layout/size change is a refit of automatic wireless content,
// not permission to discard authored geometry or unlock the chosen paper size.
export function refitWirelessPresentation(layout,previous,pages){
 const edits=layout.drawingEdits||{};
 if(!hasAuthoredWirelessGeometry(layout)&&pages.some(page=>page.wirelessLayout&&presentation({layout},page.name).wirelessApPlacement==='sides')){
  layout.pageSetup||={};layout.pageSetup.visible||={};layout.pageSetup.visible.wirelessFit='adaptive';layout.pageSetup.visible.wirelessFitExplicit=false;
 }
 for(const page of pages.filter(page=>page.wirelessLayout)){
  const before=presentation({layout:{presentation:previous}},page.name),after=presentation({layout},page.name);
  if(before.wirelessApScale===after.wirelessApScale&&before.wirelessApPlacement===after.wirelessApPlacement&&after.wirelessApPlacement!=='sides')continue;
  if(page.items.some(item=>['x','y','w','h','angle','points'].some(key=>edits[item.editKey]?.[key]!=null)))continue;
  for(const field of ['lockFrames','editFrames'])if(layout.pageSetup?.visible?.[field])delete layout.pageSetup.visible[field][page.name];
 }
 return layout;
}
