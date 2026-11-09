// Editor-only highlighting between the Connection types legend and cables.
// No source, line styles, geometry or exported scene data are modified.
export function connectionTypeForSelection(page,keys=[]){
 const objects=new Map((page?.items||[]).filter(item=>item.editKey).map(item=>[item.editKey,item]));
 const types=new Set();
 for(const key of keys){
  const item=objects.get(key);
  const related=item?.relatedCableKey?objects.get(item.relatedCableKey):null;
  const type=item?.linkType||related?.linkType;
  if(typeof type==='string'&&type)types.add(type);
 }
 return types;
}
export function connectionTypeHighlights(canvas){
 let svg=null,hoverLegend=null,hoverCable=null,selected=new Set();
 const typeOf=node=>node?.closest?.('[data-link-type]')?.getAttribute('data-link-type')||null;
 const active=()=>new Set([...selected,hoverLegend,hoverCable].filter(Boolean));
 const update=()=>{
  if(!svg)return;
  const types=active(),on=types.size>0;
  for(const node of svg.querySelectorAll('[data-link-type]')){
   const match=types.has(node.getAttribute('data-link-type'));
   node.classList.toggle('connection-type-active',match);
   node.classList.toggle('connection-type-muted',on&&!match);
  }
 };
 const onMove=event=>{
  const target=event.target;
  const next=target?.closest?.('.diagram-legend-line,[data-link-type].connection-legend-text');
  const type=next?typeOf(next):null;
  if(type!==hoverLegend){hoverLegend=type;update();}
 };
 const onLeave=()=>{if(hoverLegend){hoverLegend=null;update();}};
 const onFocus=event=>{const next=event.target?.closest?.('.diagram-legend-line,[data-link-type].connection-legend-text');const type=next?typeOf(next):null;if(type!==hoverLegend){hoverLegend=type;update();}};
 function show(next){
  if(svg){svg.removeEventListener('pointermove',onMove);svg.removeEventListener('pointerleave',onLeave);svg.removeEventListener('focusin',onFocus);svg.removeEventListener('focusout',onLeave);}
  svg=next||null;hoverLegend=null;hoverCable=null;
  if(svg){svg.addEventListener('pointermove',onMove);svg.addEventListener('pointerleave',onLeave);svg.addEventListener('focusin',onFocus);svg.addEventListener('focusout',onLeave);}
  update();
 }
 return {
  show,
  setCableHover(element){const type=element?.getAttribute?.('data-link-type')||null;if(type===hoverCable)return;hoverCable=type;update();},
  setSelected(types){selected=new Set(types||[]);update();},
  clear(){show(null);selected.clear();}
 };
}
