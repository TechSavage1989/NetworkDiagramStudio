import {cleanPageSetup} from './page-options.mjs';

const wireless=name=>/(?:^|\|)Wireless Connections(?:\b|\|)/.test(name);
export function hasAuthoredWirelessGeometry(layout){
 return Object.entries(layout?.drawingEdits||{}).some(([key,edit])=>wireless(key)&&['x','y','w','h','angle','points'].some(k=>edit?.[k]!=null));
}
// Old releases saved `layout` as their default, even when the user merely
// selected Letter or locked the sheet. That is not a deliberate keep-rows
// choice. Upgrade automatic geometry, not authored objects or legacy frames
// whose source layout is unknown. No source project mutation on open/render.
export function effectiveWirelessPaperProject(project){
 const layout=project.layout||{},{pageSetup,...otherLayout}=layout,raw=pageSetup?.visible||{};
 if(raw.wirelessFitExplicit||raw.fitMode==='preserve'||['adaptive','readable'].includes(raw.wirelessFit))return project;
 const frames={...raw.lockFrames,...raw.editFrames};
 if(hasAuthoredWirelessGeometry(layout)){
  if(!Object.entries(frames).some(([name,f])=>wireless(name)&&f.wirelessFit==='adaptive'))return project;
  const setup=cleanPageSetup(layout.pageSetup);setup.visible.wirelessFit='adaptive';
  return {...project,layout:{pageSetup:setup,...otherLayout}};
 }
 if(Object.entries(frames).some(([name,f])=>wireless(name)&&(!f.wirelessFit||f.wirelessFit==='readable-legacy')))return project;
 // Keep normalized pageSetup in one stable insertion position so unrelated
 // edit-key changes do not invalidate other families' JSON cache signatures.
 const setup=cleanPageSetup(layout.pageSetup);setup.visible.wirelessFit='adaptive';
 for(const field of ['lockFrames','editFrames'])for(const [name,frame] of Object.entries(setup.visible[field]))if(wireless(name)&&frame.wirelessFit==='layout')delete setup.visible[field][name];
 return {...project,layout:{pageSetup:setup,...otherLayout}};
}
