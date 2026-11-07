import {presentation} from '../presentation.mjs';
import {wrapPortText} from '../port-table.mjs';
import {deviceDetails} from '../device-details.mjs';
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
 const ids=new Set(page.coreDeviceIds||page.sourceDeviceIds||project.devices?.map(d=>d.id)||[]),devices=(project.devices||[]).filter(d=>ids.has(d.id));
 let y=Math.max(147,...panel.map(i=>i.y+(i.h||0)))+24;
 const section=(key,title,rows)=>{
  if(!options.sections.includes(key)||!rows.length)return;
  label(panel,38,y,options.width,25*options.textScale*config.textScale,title,16*options.textScale*config.textScale,true,C.teal);panel.at(-1).editKey=scope+'|info-panel|'+key+'|heading';panel.at(-1)._textFactor=config.textScale;y+=34*options.textScale*config.textScale;
  rows.forEach((text,index)=>{const size=12*options.textScale*config.textScale,lines=wrapPortText(text,options.width,size),height=lines.length*size*1.3;
   label(panel,38,y,options.width,height,text,size,false,C.ink);panel.at(-1).editKey=scope+'|info-panel|'+key+'|'+index;panel.at(-1)._textFactor=config.textScale;y+=height+8*options.textScale;
  });y+=18*options.textScale;
 };
 section('vlans','VLANS',devices.flatMap(d=>(d.vlans||[]).map(v=>[d.name,'VLAN '+value(v.id),v.name,v.ip||v.address].filter(Boolean).join(' · '))));
 section('addresses','DEVICE ADDRESSES',devices.filter(d=>d.ip||d.mac).map(d=>[d.name,d.ip,d.mac].filter(Boolean).join(' · ')));
 section('models','DEVICE DETAILS',devices.map(d=>[d.name,deviceDetails(d)].filter(Boolean).join(' · ')));
 section('routes','ROUTES',devices.flatMap(d=>(d.routes||[]).map(r=>d.name+' · '+(typeof r==='string'?r:[r.destination||r.prefix||r.network,r.gateway||r.nextHop,r.interface].filter(Boolean).join(' · ')))));
 section('ports','PORT DETAILS',devices.flatMap(d=>(d.ports||[]).filter(p=>p.description||p.native!=null||p.tagged?.length).map(p=>[d.name,p.name,p.description,p.native!=null?'Native VLAN '+p.native:'',p.tagged?.length?'Tagged '+value(p.tagged):'',p.speed,p.state].filter(Boolean).join(' · '))));
 section('notes','NOTES',options.notes.trim()?[options.notes]:[]);
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
