import {presentation} from '../presentation.mjs';
import {wrapPortText} from '../port-table.mjs';
import {automaticPanelContent,panelRows} from './panel-content.mjs';
import {panelFields} from '../presentation.mjs';
import {label,linkLegend,C,value} from './scene.mjs';

export function informationPanel(page,project){
 const config=presentation(project,page),options=config.panel,scope=page.name;
 const isPanel=i=>/\|(?:legend|module-legend)\||\|device\|module-legend-/.test(i.editKey||'');
 if(!page.coreDeviceIds&&page.items.some(isPanel)){
  page.items=page.items.filter(i=>!isPanel(i));page.legendLayout='sidebar';page.sidebar={scale:1,width:options.width,textScale:options.textScale*config.textScale};linkLegend(page);
  for(const item of page.items.filter(isPanel)){const patch=project.layout?.drawingEdits?.[item.editKey];if(patch)Object.assign(item,patch);}
 }
 page.items=page.items.filter(i=>!isPanel(i)||options.visible&&(i.editKey.includes('module-legend')?options.sections.includes('modules'):options.sections.includes('connections')));
 if(!options.visible){page.items=page.items.filter(i=>i.pageFrame!=='sidebar');return;}
 const panel=page.items.filter(isPanel);for(const item of panel)if(item.type==='text')item._textFactor=config.textScale;
 const drawn=page.items.filter(i=>i.type==='device'&&i.kind!=='plug').map(i=>i.sourceId),members=page.coreDeviceIds||page.sourceDeviceIds||page.portMap?.devices||(page.portMap?.device?[page.portMap.device]:null)||page.logicalSections?.map(s=>s.deviceId)||(drawn.length?drawn:null);
 const ids=new Set(members||project.devices?.map(d=>d.id)||[]),devices=(project.devices||[]).filter(d=>ids.has(d.id));
 let y=Math.max(147,...panel.map(i=>i.y+(i.h||0)))+24;
 const section=(key,title,rows)=>{
  if(!options.sections.includes(key)||!rows.length)return;
  label(panel,38,y,options.width,25*options.textScale*config.textScale,title,16*options.textScale*config.textScale,true,C.teal);panel.at(-1).editKey=scope+'|info-panel|'+key+'|heading';panel.at(-1)._textFactor=config.textScale;y+=34*options.textScale*config.textScale;
  rows.forEach((text,index)=>{const size=12*options.textScale*config.textScale,lines=wrapPortText(text,options.width,size),height=lines.length*size*1.3;
   label(panel,38,y,options.width,height,text,size,false,C.ink);panel.at(-1).editKey=scope+'|info-panel|'+key+'|'+index;panel.at(-1)._textFactor=config.textScale;y+=height+8*options.textScale;
  });y+=18*options.textScale;
 };
 const auto=automaticPanelContent(project,devices),labels=new Map(panelFields),custom=new Map(options.customSections.map(item=>[item.id,item.title]));
 for(const id of options.sections){
  if(id==='connections'||id==='modules')continue;
  const heading=options.sectionTitles[id]||custom.get(id)||labels.get(id)||id;
  section(id,heading.toUpperCase(),panelRows(id,auto,options));
 }
 const added=panel.filter(i=>!page.items.includes(i));page.items.push(...added);
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
