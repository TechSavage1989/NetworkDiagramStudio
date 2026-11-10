import {drawingBounds} from '../drawing-edits.mjs';
import {presentation} from '../presentation.mjs';
import {wrapPortText} from '../port-table.mjs';
import {automaticPanelContent,panelRows} from './panel-content.mjs';
import {panelFields} from '../presentation.mjs';
import {label,linkLegend,C} from './scene.mjs';

export function informationPanel(page,project){
 const config=presentation(project,page),options=config.panel,scope=page.name;
 const isPanel=i=>/\|(?:legend|module-legend)\||\|device\|module-legend-/.test(i.editKey||'');
 if(!page.coreDeviceIds&&page.items.some(isPanel)){
  page.items=page.items.filter(i=>!isPanel(i));page.legendLayout='sidebar';page.sidebar={scale:1,width:options.width,textScale:options.textScale*config.textScale,connectionHeading:options.sectionTitles.connections||'Connection types'};linkLegend(page);
  for(const item of page.items.filter(isPanel)){const patch=project.layout?.drawingEdits?.[item.editKey];if(patch)Object.assign(item,patch);}
 }
 page.items=page.items.filter(i=>!isPanel(i)||options.visible&&(i.editKey.includes('module-legend')?options.sections.includes('modules')&&!options.sectionContent.modules?.trim():options.sections.includes('connections')&&!options.sectionContent.connections?.trim()));
 if(!options.visible){page.items=page.items.filter(i=>i.pageFrame!=='sidebar');return;}
 const panel=page.items.filter(isPanel);for(const item of panel)if(item.type==='text')item._textFactor=config.textScale;
 const drawn=page.items.filter(i=>i.type==='device'&&i.kind!=='plug').map(i=>i.sourceId),members=page.coreDeviceIds||page.sourceDeviceIds||page.portMap?.devices||(page.portMap?.device?[page.portMap.device]:null)||page.logicalSections?.map(s=>s.deviceId)||(drawn.length?drawn:null);
 const ids=new Set(members||project.devices?.map(d=>d.id)||[]),devices=(project.devices||[]).filter(d=>ids.has(d.id));
 let y=Math.max(147,...panel.map(i=>i.y+(i.h||0)))+24;
 const section=(key,title,rows)=>{
  if(!options.sections.includes(key)||!rows.length)return;
  rows=rows.map((row,index)=>{const rowKey=typeof row==='string'?index:row.key,patch=project.layout?.drawingEdits?.[scope+'|info-panel|'+key+'|'+rowKey];return {key:rowKey,text:typeof patch?.value==='string'?patch.value:typeof row==='string'?row:row.text};}).filter(row=>row.text.trim());
  if(!rows.length)return;
  label(panel,38,y,options.width,25*options.textScale*config.textScale,title,16*options.textScale*config.textScale,true,C.teal);panel.at(-1).editKey=scope+'|info-panel|'+key+'|heading';panel.at(-1)._textFactor=config.textScale;y+=34*options.textScale*config.textScale;
  rows.forEach((row,index)=>{const text=typeof row==='string'?row:row.text,rowKey=typeof row==='string'?index:row.key;const size=12*options.textScale*config.textScale,lines=wrapPortText(text,options.width,size),height=lines.length*size*1.3;
   label(panel,38,y,options.width,height,text,size,false,C.ink);panel.at(-1).editKey=scope+'|info-panel|'+key+'|'+rowKey;panel.at(-1)._textFactor=config.textScale;y+=height+8*options.textScale;
  });y+=18*options.textScale;
 };
 const auto=automaticPanelContent(project,devices,options),labels=new Map(panelFields),custom=new Map(options.customSections.map(item=>[item.id,item.title]));
 // Preserve established printed headings while allowing fully editable display titles.
 for(const [id,title] of [['addresses','Device addresses'],['models','Device details'],['ports','Port details']])labels.set(id,title);
 for(const id of options.sections){
  if((id==='connections'||id==='modules')&&!options.sectionContent[id]?.trim()&&panel.some(item=>id==='modules'?/\|(?:module-legend)\||\|device\|module-legend-/.test(item.editKey||''):/\|legend\|/.test(item.editKey||'')))continue;
  const heading=options.sectionTitles[id]||custom.get(id)||labels.get(id)||id;
  let rows=panelRows(id,auto,options);
  // A deliberately edited body remains content even when its source inventory
  // disappears. A title-only edit does not manufacture an empty section.
  if(!rows.length){const prefix=scope+'|info-panel|'+id+'|';rows=Object.entries(project.layout?.drawingEdits||{}).filter(([key,patch])=>key.startsWith(prefix)&&/^\d+$/.test(key.slice(prefix.length))&&typeof patch.value==='string'&&patch.value.trim()).map(([key,patch])=>({key:key.slice(prefix.length),text:patch.value})).sort((a,b)=>Number(a.key)-Number(b.key));}
  section(id,heading.toUpperCase(),rows);
 }
 const added=panel.filter(i=>!page.items.includes(i));page.items.push(...added);
 if(!panel.length){page.items=page.items.filter(i=>i.pageFrame!=='sidebar');return;}
 // The sidebar is a true ordered set of sections, including the generated
 // Connection types and Port modules. Reposition each section as a whole,
 // retaining its text, colors, icons, and individual drawing-edit keys.
 const category=item=>{const key=item.editKey||'';
  if(key.includes('|info-panel|'))return key.split('|info-panel|')[1].split('|')[0];
  if(key.includes('|module-legend|')||key.includes('|device|module-legend-'))return 'modules';
  if(key.includes('|legend|'))return 'connections';
  return null;};
 let cursor=147;
 for(const id of options.sections){
  const group=panel.filter(item=>category(item)===id);
  if(!group.length)continue;
  const lo=Math.min(...group.map(item=>item.y)),hi=Math.max(...group.map(item=>item.y+(item.h||0))),shift=cursor-lo;
  for(const item of group)item.y+=shift;
  cursor+=hi-lo+15;
 }

 const factor=options.scale,height=Math.max(0,...panel.map(i=>i.y+(i.h||0)))-147;
 const extent=page.items.filter(i=>!isPanel(i)&&!i.editKey?.includes('|info-panel|')&&(i.type==='device'||i.type==='path'||i.y>=145&&!i.pageFrame)).flatMap(i=>i.points?i.points.map(p=>p[0]):[i.x+(i.w||0)]);
 const x=options.position==='right'?Math.max(38,...extent)+26:options.position==='free'?options.x:page.coreDeviceIds?38:-(options.width+40)*factor;
 const top=options.position==='top'?-(height+40)*factor:options.position==='free'?options.y:147;
 const tx=x-38*factor,ty=top-147*factor;
 for(const item of panel){
  const patch=project.layout?.drawingEdits?.[item.editKey];if(patch&&item.editKey.includes('|info-panel|'))Object.assign(item,patch);
  item.panelGroup=true;item._panelTransform={scale:factor,x:tx,y:ty};
  item.x=item.x*factor+tx;item.y=item.y*factor+ty;item.w*=factor;item.h*=factor;
  if(item.type==='text')item.size*=factor;
  if(item.type==='device'){for(const child of item.children)if(child.type==='text')child.size*=factor;item.masterKey+=':panel-scale:'+factor;}
 }
 if(options.position!=='left')page.items=page.items.filter(i=>i.pageFrame!=='sidebar');
}

// Dock after labels and text scaling have their final geometry. Use rotated
// bounds and cable points, not only the unrotated device rectangles.
export function dockInformationPanel(page,project){
 const options=presentation(project,page).panel;
 if(!options.visible||options.position==='free')return;
 const panel=page.items.filter(i=>i.panelGroup),content=page.items.filter(i=>!i.panelGroup&&!i.pageFrame&&!i.pageHeading&&!i.pageTitle&&(i.type==='device'||i.type==='path'||i.y>=145));
 const boxes=items=>items.map(drawingBounds).filter(b=>b&&[b.x,b.y,b.w,b.h].every(Number.isFinite));
 // Cross-page tags use the reserved sidebar rail on fixed-paper core sheets;
 // their placement is owned by the core pagination planner.
 const p=boxes(panel),c=boxes(options.position==='left'?content.filter(i=>!i.offPage):content);if(!p.length||!c.length)return;
 const left=Math.min(...p.map(b=>b.x)),right=Math.max(...p.map(b=>b.x+b.w)),bottom=Math.max(...p.map(b=>b.y+b.h));
 let dx=0,dy=0;
 if(options.position==='right')dx=Math.max(...c.map(b=>b.x+b.w))+26-left;
 if(options.position==='left'){const top=Math.min(...p.map(b=>b.y)),near=c.filter(b=>b.y<bottom&&b.y+b.h>top);if(near.length)dx=Math.min(0,Math.min(...near.map(b=>b.x))-26-right);}
 if(options.position==='top')dy=Math.min(...c.map(b=>b.y))-26-bottom;
 if(Math.abs(dx)<1e-8)dx=0;if(Math.abs(dy)<1e-8)dy=0;
 for(const item of panel){item.x+=dx;item.y+=dy;if(item.points)item.points=item.points.map(([x,y])=>[x+dx,y+dy]);if(item._panelTransform){item._panelTransform.x+=dx;item._panelTransform.y+=dy;}}
 if(dx||dy)page.items=page.items.filter(i=>i.pageFrame!=='sidebar');
}
