import {textLayout} from './diagram/scene.mjs';
import {textWidth} from './diagram/labels.mjs';
import {contentBounds} from './page-content-fit.mjs';
import {presentation} from './presentation.mjs';
import {drawingBounds} from './drawing-edits.mjs';

// A docked information rail belongs to the paper, not to the model's fit.
// Keep its own measured geometry (including symbols and wrapped rows) together.
// Explicitly positioned/resized panel objects and free panels remain user-owned.
export function paperPanel(page,project,body,unit){
 const options=presentation(project,page).panel,items=page.items.filter(i=>i.panelGroup);
 if(!options.visible||options.position==='free'||!items.length)return null;
 const edits=project.layout?.drawingEdits||{};
 if(items.some(i=>['x','y','w','h','size','angle'].some(k=>Number.isFinite(edits[i.editKey]?.[k]))))return null;
 let bounds=contentBounds({items});if(!bounds)return null;
 const config=presentation(project,page),baseScale=(config.drawingScale||1),baseDesired=unit/baseScale;
 const sizes=items.filter(i=>i.type==='text'&&i.size>0).map(i=>textLayout({...i,h:1e7}).size);if(!sizes.length)return null;
 const minSize=Math.min(...sizes),readable=(config.minimumTextPt||0)*4/3*unit*options.textScale*config.textScale*options.scale/minSize,desired=Math.max(baseDesired,readable);
 const requestedWidth=options.paperWidth?body.w*options.paperWidth/100/desired:null;
 // Measure ink, not the old maximum row boxes. A short key should not
 // reserve a quarter of the sheet. A chosen width rewraps complete text.
 for(const item of items.filter(i=>i.type==='text').sort((a,b)=>a.y-b.y)){
  const oldBottom=item.y+item.h,oldHeight=item.h;
  if(requestedWidth){item.w=Math.max(item.size*3,requestedWidth-(item.x-bounds.x));const lines=textLayout({...item,h:1e7}).lines;item.h=Math.max(item.size*1.3,lines.length*item.size*1.3);const growth=Math.max(0,item.h-oldHeight);if(growth)for(const other of items)if(other!==item&&other.y>=oldBottom-.01)other.y+=growth;}
  else {const lines=textLayout(item).lines;item.w=Math.min(item.w,Math.max(...lines.map(line=>textWidth(line,item.size,item.bold)))+2);}
 }
 bounds=contentBounds({items});


 // Respect panel/text scaling and the selected physical readability floor.
 // A custom width is literal; tall content overflows instead of shrinking.
 const floor=Math.min(desired,Math.max(readable,10.67*unit*options.textScale*config.textScale/minSize));
 const horizontal=options.position==='top',availableW=horizontal?body.w:body.w*(options.paperWidth?options.paperWidth/100:.36);
 let scale=options.paperWidth?desired:Math.max(floor,Math.min(desired,availableW/bounds.w,body.h/bounds.h)),columns=1,belowFloor=false;
 // A side panel taller than the sheet flows into columns (whole rows, each
 // heading with its first row) before its text would drop below the readable
 // floor; only when that cannot fit does it shrink, never below 5 pt.
 if(!options.paperWidth&&!horizontal&&bounds.h*scale>body.h+1e-6){
  const flowed=flowPanel(items,bounds,body,{desired,floor,hardFloor:Math.min(floor,5*4/3*unit*options.textScale*config.textScale/minSize),gap:18*unit/desired});
  if(flowed){scale=flowed.scale;columns=flowed.columns;belowFloor=flowed.scale<floor-1e-9;bounds=contentBounds({items});}
 }
 const w=(requestedWidth?Math.max(bounds.w,requestedWidth):bounds.w)*scale,h=bounds.h*scale,gap=12*unit;
 const x=options.position==='right'?body.x+body.w-w:body.x,y=body.y;
 const area=horizontal?{...body,y:body.y+h+gap,h:Math.max(unit,body.h-h-gap)}:
  {...body,x:options.position==='left'?body.x+w+gap:body.x,w:Math.max(unit,body.w-w-gap)};
 const divider=horizontal?{x:body.x,y:area.y-gap/2,w:body.w,h:unit}:{x:options.position==='right'?area.x+area.w+gap/2:area.x-gap/2,y:body.y,w:unit,h:body.h};
 return {items:new Set(items),scale,x:x-bounds.x*scale,y:y-bounds.y*scale,body:area,divider,columns,belowFloor,overflow:h>body.h+1e-6||w>body.w+1e-6};
}

// Rows of a panel in reading order. Items that overlap vertically (a swatch
// and its caption, an icon and its text) form one row; a heading stays with
// the row after it so a column never starts or ends on a bare heading.
function panelRowsOf(items){
 const boxes=items.map(item=>({item,box:drawingBounds(item)})).filter(({box})=>box&&[box.x,box.y,box.w,box.h].every(Number.isFinite)).sort((a,b)=>a.box.y-b.box.y||a.box.x-b.box.x);
 const rows=[];
 for(const entry of boxes){const last=rows.at(-1);if(last&&entry.box.y<last.bottom-.5){last.entries.push(entry);last.bottom=Math.max(last.bottom,entry.box.y+entry.box.h);last.right=Math.max(last.right,entry.box.x+entry.box.w);}else rows.push({entries:[entry],top:entry.box.y,bottom:entry.box.y+entry.box.h,right:entry.box.x+entry.box.w});}
 const units=[];let pending=null;
 for(const row of rows){const heading=row.entries.every(({item})=>/\|heading$|\|title$/.test(item.editKey||'')&&item.type==='text');
  if(pending){pending.entries.push(...row.entries);pending.bottom=row.bottom;pending.right=Math.max(pending.right,row.right);if(!heading){units.push(pending);pending=null;}continue;}
  if(heading){pending={...row,entries:[...row.entries]};continue;}units.push(row);}
 if(pending)units.push(pending);
 return units;
}
// Fewest columns (up to six, at most 60% of the sheet) that hold the panel at
// readable size; the columns are balanced by height and keep reading order.
function flowPanel(items,bounds,body,{desired,floor,hardFloor,gap}){
 const units=panelRowsOf(items);if(units.length<2)return null;
 const spacing=units.slice(1).map((unit,i)=>Math.max(0,unit.top-units[i].bottom)),columnWidth=Math.max(...units.map(unit=>unit.right))-bounds.x;
 const pack=(count,limit)=>{
  const columns=[[]];let height=0;
  for(const [i,unit] of units.entries()){
   const h=unit.bottom-unit.top;let column=columns.at(-1),space=column.length?spacing[i-1]:0;
   if(column.length&&height+space+h>limit+1e-6){if(columns.length===count)return null;column=[];columns.push(column);height=0;space=0;}
   column.push({unit,offset:column.length?height+space:0});height+=space+h;
  }
  return columns;
 };
 const tallest=columns=>Math.max(...columns.map(column=>column.length?column.at(-1).offset+column.at(-1).unit.bottom-column.at(-1).unit.top:0));
 let best=null;
 for(let count=2;count<=6;count++){
  // Smallest column height that still uses at most `count` columns.
  let lo=Math.max(...units.map(unit=>unit.bottom-unit.top)),hi=bounds.h;if(!pack(count,hi))continue;
  for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(pack(count,mid))hi=mid;else lo=mid;}
  const columns=pack(count,hi).filter(column=>column.length),w=columns.length*columnWidth+(columns.length-1)*gap,h=tallest(columns),scale=Math.min(desired,body.w*.6/w,body.h/h);
  if(!best||scale>best.scale+1e-9)best={columns,scale,w,h};
  if(scale>=floor-1e-9)break;
 }
 if(!best||best.scale<hardFloor-1e-9)return null;
 best.columns.forEach((column,index)=>{for(const {unit,offset} of column){const dx=index*(columnWidth+gap),dy=bounds.y+offset-unit.top;if(!dx&&!dy)continue;for(const {item} of unit.entries)shiftPanelItem(item,dx,dy);}});
 return {scale:best.scale,columns:best.columns.length};
}
// Move a panel item and keep its inverse presentation, so an edit made on a
// flowed panel is saved in the panel's own coordinates.
function shiftPanelItem(item,dx,dy){
 item.x+=dx;item.y+=dy;
 if(item.points)item.points=item.points.map(([x,y])=>[x+dx,y+dy]);
 if(item.commands)item.commands=item.commands.map(([op,...v])=>op==='Z'?[op]:[op,...v.map((n,i)=>n+(i%2?dy:dx))]);
 for(const key of ['from','to'])if(item[key])item[key]={...item[key],x:item[key].x+dx,y:item[key].y+dy};
 if(item.presentation)item.presentation={...item.presentation,x:(item.presentation.x||0)+dx,y:(item.presentation.y||0)+dy};
}

// The default wireless key is a horizontal legend, not a sidebar. Pack its
// measured entries into paper-width rows, retaining every swatch and caption.
export function paperLinkKey(page,project,body,unit){
 if(page.title!=='Wireless Connections'||page.items.some(i=>i.panelGroup))return null;
 const items=page.items.filter(i=>i.editKey?.includes('|legend|'));
 if(!items.length||items.some(i=>Object.keys(project.layout?.drawingEdits?.[i.editKey]||{}).length))return null;
 const config=presentation(project,page),minSize=Math.min(...items.filter(i=>i.type==='text').map(i=>textLayout({...i,h:1e7}).size)),scale=Math.max(unit/(config.drawingScale||1),(config.minimumTextPt||0)*4/3*unit*config.textScale/minSize),transforms=new Map(),heading=items.find(i=>i.editKey.endsWith('|heading'));
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
