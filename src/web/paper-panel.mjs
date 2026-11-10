import {textWidth} from './diagram/labels.mjs';
import {contentBounds} from './page-content-fit.mjs';
import {presentation} from './presentation.mjs';

// A docked information rail belongs to the paper, not to the model's fit.
// Keep its own measured geometry (including symbols and wrapped rows) together.
// Explicitly positioned/resized panel objects and free panels remain user-owned.
export function paperPanel(page,project,body,unit){
 const options=presentation(project,page).panel,items=page.items.filter(i=>i.panelGroup);
 if(!options.visible||options.position==='free'||!items.length)return null;
 const edits=project.layout?.drawingEdits||{};
 if(items.some(i=>['x','y','w','h','size','angle'].some(k=>Number.isFinite(edits[i.editKey]?.[k]))))return null;
 const bounds=contentBounds({items});if(!bounds)return null;
 const sizes=items.filter(i=>i.type==='text'&&i.size>0).map(i=>i.size);
 if(!sizes.length)return null;
 const config=presentation(project,page),baseScale=(config.drawingScale||1);
 // Respect intentional panel/text scaling. At default settings, aim for 9pt
 // body text and never compress smaller details below their source paper size.
 const desired=unit/baseScale,minSize=Math.min(...sizes),floor=Math.min(desired,10.67*unit*options.textScale*config.textScale/minSize);
 const horizontal=options.position==='top',availableW=horizontal?body.w:body.w*.36;
 const scale=Math.max(floor,Math.min(desired,availableW/bounds.w,body.h/bounds.h));
 const w=bounds.w*scale,h=bounds.h*scale,gap=12*unit;
 const x=options.position==='right'?body.x+body.w-w:body.x,y=body.y;
 const area=horizontal?{...body,y:body.y+h+gap,h:Math.max(unit,body.h-h-gap)}:
  {...body,x:options.position==='left'?body.x+w+gap:body.x,w:Math.max(unit,body.w-w-gap)};
 const divider=horizontal?{x:body.x,y:area.y-gap/2,w:body.w,h:unit}:{x:options.position==='right'?area.x+area.w+gap/2:area.x-gap/2,y:body.y,w:unit,h:body.h};
 return {items:new Set(items),scale,x:x-bounds.x*scale,y:y-bounds.y*scale,body:area,divider,overflow:h>body.h+1e-6||w>body.w+1e-6};
}

// The default wireless key is a horizontal legend, not a sidebar. Pack its
// measured entries into paper-width rows, retaining every swatch and caption.
export function paperLinkKey(page,project,body,unit){
 if(page.title!=='Wireless Connections'||page.items.some(i=>i.panelGroup))return null;
 const items=page.items.filter(i=>i.editKey?.includes('|legend|'));
 if(!items.length||items.some(i=>Object.keys(project.layout?.drawingEdits?.[i.editKey]||{}).length))return null;
 const scale=unit/(presentation(project,page).drawingScale||1),transforms=new Map(),heading=items.find(i=>i.editKey.endsWith('|heading'));
 let y=body.y,x=body.x,rowHeight=0;
 if(heading){heading.w=body.w/scale;transforms.set(heading,{scale,x:body.x-heading.x*scale,y:y-heading.y*scale});y+=heading.h*scale+6*unit;}
 const groups=new Map();for(const item of items){if(item===heading)continue;const id=item.editKey.split('|legend|')[1].split('|')[0];if(!groups.has(id))groups.set(id,[]);groups.get(id).push(item);}
 for(const group of groups.values()){
  for(const item of group)if(item.type==='text')item.w=Math.min(item.w,textWidth(item.value,item.size,item.bold)+4*unit/scale);
  const b=contentBounds({items:group}),w=b.w*scale,h=b.h*scale;
  if(x>body.x&&x+w>body.x+body.w){x=body.x;y+=rowHeight+8*unit;rowHeight=0;}
  for(const item of group)transforms.set(item,{scale,x:x-b.x*scale,y:y-b.y*scale});
  x+=w+24*unit;rowHeight=Math.max(rowHeight,h);
 }
 const used=y+rowHeight+12*unit-body.y;
 return {items:new Set(items),transforms,body:{...body,y:body.y+used,h:Math.max(unit,body.h-used)},overflow:used>body.h||[...groups.values()].some(group=>contentBounds({items:group}).w*scale>body.w)};
}
