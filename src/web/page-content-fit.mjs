import {drawingObjects,drawingBounds} from './drawing-edits.mjs';
import {wrapPortText} from './port-table.mjs';

// Measure painted content, not the old sheet rectangle. Include rotated native
// details, cable jumps and stroke extents, but not generated page furniture.
export function contentBounds(page,exclude=new Set()){
 const boxes=[];
 for(const item of drawingObjects(page)){
  if(exclude.has(item)||exclude.has(item.parent)||item.hidden)continue;
  const box=drawingBounds(item);
  if(box&&[box.x,box.y,box.w,box.h].every(Number.isFinite)){
   const pad=item.type==='path'?(item.weight||0)/2:item.stroke&&item.stroke!=='none'?(item.weight||0)/2:0;
   boxes.push({x:box.x-pad,y:box.y-pad,w:box.w+2*pad,h:box.h+2*pad});
  }
  for(const hop of item.hops||[])boxes.push({x:hop.x-hop.w/2,y:hop.y-hop.h,w:hop.w,h:hop.h*2});
 }
 if(!boxes.length)return null;
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
 return {x,y,w:Math.max(1,...boxes.map(b=>b.x+b.w-x)),h:Math.max(1,...boxes.map(b=>b.y+b.h-y))};
}

// Header/footer geometry lives in paper units, independently of diagram scale.
// Explicit furniture edits keep their saved offsets and sizes in paper units.
// Legacy callers without the original geometry keep edited objects as content.
export function paperFurniture(page,project,width,height,unit,margin){
 const edits=project?.layout?.drawingEdits||{},items=page.items.filter(i=>(i.pageHeading||i.pageFrame)&&(!edits[i.editKey]||i._pageFurnitureSource&&(i.pageHeading||['brand','header-background'].includes(i.pageFrame)))),automatic=new Set(items),placements=new Map(),left=(page.originX||0)+margin,right=(page.originX||0)+width-margin,top=(page.originY||0)+margin,bottom=(page.originY||0)+height-margin,span=right-left;
 const find=role=>items.find(i=>(i.pageHeading||i.pageFrame)===role);
 const text=(item,x,y,w)=>{
  if(!item)return 0;
  const originalY=y;
  const prev=item.presentation||{scale:1,fontScale:1,x:0,y:0},size=item.size/(prev.scale||1)*unit;
  const patch=edits[item.editKey],source=item._pageFurnitureSource;
  if(patch&&source){
   if(Number.isFinite(patch.w))w=patch.w*unit;
   if(Number.isFinite(patch.x))x+=(patch.x-source.x)*unit;
   if(Number.isFinite(patch.y))y+=(patch.y-source.y)*unit;
  }
  const h=Number.isFinite(patch?.h)?patch.h*unit:Math.max(size*1.25,wrapPortText(item.value,w,size,item.bold).length*size*1.25);
  placements.set(item,{x,y,w,h,size,scale:unit/(prev.scale||1)});return Math.max(h,y+h-originalY);
 };
 const banner=find('header-background'),inset=banner?12*unit:0,brand=find('brand'),projectName=find('project'),brandWidth=brand?Math.min((span-2*inset)*.43,264*unit):0;
 let y=top+(banner?6*unit:0);
 const nameHeight=text(projectName,left+inset,y,Math.max(unit,span-2*inset-brandWidth-(brand?16*unit:0))),brandHeight=text(brand,right-inset-brandWidth,y,brandWidth);
 if(projectName||brand)y+=Math.max(nameHeight,brandHeight)+5*unit;
 const title=find('title');if(title)y+=text(title,left+inset,y,span-2*inset)+3*unit;
 if(banner){
  const prev=banner.presentation||{scale:1},patch=edits[banner.editKey],source=banner._pageFurnitureSource;let box={x:left,y:top,w:span,h:y-top+3*unit,scale:unit/(prev.scale||1)};
  if(patch&&source){for(const k of ['x','y'])if(Number.isFinite(patch[k]))box[k]+=(patch[k]-source[k])*unit;for(const k of ['w','h'])if(Number.isFinite(patch[k]))box[k]=patch[k]*unit;}
  placements.set(banner,box);y+=6*unit;
 }
 const subtitle=find('subtitle');if(subtitle)y+=text(subtitle,left,y,span)+6*unit;
 const rule=find('rule');if(rule){placements.set(rule,{x:left,y,w:span,h:unit,scale:unit/(rule.presentation?.scale||1)});y+=unit+6*unit;}
 const number=find('footer-number'),footer=find('footer-name'),footerRule=find('footer-rule');let footerHeight=0;
 for(const [item,x,w] of [[number,right-164*unit,164*unit],[footer,left,span-(number?180*unit:0)]]){
  const h=text(item,x,0,w);if(item){placements.get(item).y=bottom-h;footerHeight=Math.max(footerHeight,h+6*unit);}
 }
 if(footerRule){placements.set(footerRule,{x:left,y:bottom-footerHeight,w:span,h:unit,scale:unit/(footerRule.presentation?.scale||1)});footerHeight+=7*unit;}
 return {automatic,placements,body:{x:left,y,w:span,h:Math.max(unit,bottom-footerHeight-y)}};
}

export function placePaperFurniture(furniture,factor,dx,dy,bounds){
 for(const item of furniture.automatic){
  let box=furniture.placements.get(item);
  if(item.pageFrame==='sidebar'&&!box)box={x:item.x*factor+dx,y:bounds.y*factor+dy,w:item.w*factor,h:bounds.h*factor,scale:factor};
  if(!box)continue;
  const prev=item.presentation||{scale:1,x:0,y:0,fontScale:1},s=box.scale;
  item.presentation={...prev,scale:(prev.scale||1)*s,x:(prev.x||0)*s+box.x-item.x*s,y:(prev.y||0)*s+box.y-item.y*s,fontScale:(prev.fontScale||1)*s};
  for(const key of ['weight','sampleWeight'])if(Number.isFinite(item[key]))item[key]*=s;
  Object.assign(item,Object.fromEntries(Object.entries(box).filter(([key])=>key!=='scale')));
 }
}
