import {cableProximity} from './cable-proximity.mjs';

export function diagramViewport(canvas,{out,inside,fit,percent,onDevice,onShape,onBeforeInteraction,onMoveStart,onBoxStart,onBackground,onEdit,canSelectCable}={}){
 const views=new Map();let current=null,svg=null,drag=null,space=false,clickTimer=null,clickTarget=null,lastBox=null;
 const cables=cableProximity(canvas,{enabled:()=>!space&&!drag&&!!canSelectCable?.()});
 const clamp=v=>Math.max(.0001,Math.min(6,v)),textInput=target=>target.closest('[data-inline-editor]');
 const itemKey=(target,event)=>((!event.altKey&&target.closest('[data-device-id]'))||target.closest('[data-drawing-key]'))?.getAttribute('data-drawing-key');
 const point=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return [p.x,p.y];};
 function apply(){cables.clear();if(!svg||!current)return;lastBox=canvas.getBoundingClientRect();svg.style.transform='translate('+current.x+'px,'+current.y+'px) scale('+current.scale+')';if(percent)percent.textContent=(current.scale<.01?(current.scale*100).toFixed(2):Math.round(current.scale*100))+'%';}
 function fitPage(){if(!svg||!current)return;const width=svg.viewBox.baseVal.width,height=svg.viewBox.baseVal.height,scale=clamp(Math.min((canvas.clientWidth-36)/width,(canvas.clientHeight-36)/height));Object.assign(current,{userSized:false,scale,x:(canvas.clientWidth-width*scale)/2,y:(canvas.clientHeight-height*scale)/2});apply();}
 function zoom(factor,x=canvas.clientWidth/2,y=canvas.clientHeight/2){if(!current)return;const before=current.scale,scale=clamp(before*factor);current.x=x-(x-current.x)*scale/before;current.y=y-(y-current.y)*scale/before;current.scale=scale;current.userSized=true;apply();}
 if(out)out.onclick=()=>zoom(1/1.25);if(inside)inside.onclick=()=>zoom(1.25);if(fit)fit.onclick=fitPage;
 canvas.tabIndex=0;canvas.setAttribute('aria-label','Diagram viewport. Scroll to zoom. In Edit drawing, drag a box to select; hold Space or use the middle button to pan.');
 canvas.addEventListener('wheel',e=>{if(!svg||textInput(e.target))return;e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(!svg||textInput(e.target)||![0,1].includes(e.button))return;if(onBeforeInteraction?.(e)===false)return;const target=e.button===0&&!space?(cables.resolve(e)||e.target):e.target;cables.clear();canvas.focus({preventScroll:true});const key=itemKey(target,e),box=e.button===0&&!space&&!key?onBoxStart?.(e,point(e)):null;
  drag={x:e.clientX,y:e.clientY,viewX:current.x,viewY:current.y,id:e.pointerId,moved:false,target,box,move:e.button===0&&!space&&key?onMoveStart?.(key,e):null};
  // A toolbar resize may still be queued when an edit begins. Freeze the
  // visible view now so its observer cannot refit or rebase the gesture.
  if(drag.move){current.userSized=true;lastBox=canvas.getBoundingClientRect();}
  canvas.setPointerCapture(e.pointerId);if(e.button===1||space||box||drag.move)e.preventDefault();});
 canvas.addEventListener('pointermove',e=>{if(!drag){cables.hover(e);return;}if(e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved){clearTimeout(clickTimer);if(drag.box)drag.box.preview(point(e),e);else if(drag.move){current.userSized=true;drag.move.preview(dx/current.scale,dy/current.scale,e);canvas.classList.add('moving');}else{current.userSized=true;current.x=drag.viewX+dx;current.y=drag.viewY+dy;canvas.classList.add('panning');apply();}}});
 canvas.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const saved=drag,target=drag.target;drag=null;canvas.classList.remove('panning','moving');if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(saved.moved){if(saved.box)saved.box.commit(point(e),e);else saved.move?.commit((e.clientX-saved.x)/current.scale,(e.clientY-saved.y)/current.scale,e);return;}saved.box?.cancel();
  if(e.button===0){clickTarget=target;const id=target.closest('[data-device-id]')?.getAttribute('data-device-id'),key=itemKey(target,e);if(key&&onShape?.(key,id,e,target))return;if(id){clearTimeout(clickTimer);clickTimer=setTimeout(()=>onDevice?.(id),400);}else onBackground?.(e);}});
 canvas.addEventListener('pointercancel',()=>{cables.clear();drag?.move?.cancel();drag?.box?.cancel();drag=null;canvas.classList.remove('panning','moving');});
 canvas.addEventListener('pointerleave',()=>cables.clear());
 canvas.addEventListener('dblclick',e=>{if(textInput(e.target)||e.shiftKey||e.ctrlKey||e.metaKey)return;clearTimeout(clickTimer);
  // Capture retargets dblclick to the canvas. Selection can also reveal a
  // toolbar between clicks, before its ResizeObserver has rebased the view.
  // Recheck cable proximity after that reflow, retaining artwork priority.
  const remembered=clickTarget&&svg?.contains(clickTarget)?clickTarget:e.target,cable=cables.resolve({target:remembered,clientX:e.clientX,clientY:e.clientY,altKey:e.altKey}),target=cable||remembered,text=target.closest('text[data-drawing-key]'),key=text?.getAttribute('data-drawing-key')||itemKey(target,e);if(key){e.preventDefault();if(cable)onShape?.(key,null,e,target);onEdit?.(key,e,target);}});
 canvas.addEventListener('dragstart',e=>{if(svg&&!textInput(e.target))e.preventDefault();});
 canvas.addEventListener('keydown',e=>{if(!svg||textInput(e.target)||(['Enter',' '].includes(e.key)&&e.target.closest('.cable-controls')))return;const cable=e.target.matches?.('path.diagram-cable');if(cable&&canSelectCable?.()&&['Enter',' '].includes(e.key)){e.preventDefault();onShape?.(itemKey(e.target,e),null,e,e.target);cables.focus(e.target);}else if(e.key===' '){space=true;cables.clear();e.preventDefault();}else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.25);}else if(e.key==='-'){e.preventDefault();zoom(1/1.25);}else if(e.key==='0'){e.preventDefault();fitPage();}else if(e.key==='Enter'){const id=e.target.closest('[data-device-id]')?.getAttribute('data-device-id');if(id)onDevice?.(id);}});
 canvas.addEventListener('focusin',e=>cables.focus(e.target));canvas.addEventListener('focusout',()=>cables.clear());
 canvas.addEventListener('keyup',e=>{if(e.key===' ')space=false;});canvas.addEventListener('blur',()=>{space=false;cables.clear();});
 const observer=new ResizeObserver(()=>{if(!svg||!current)return;if(!current.userSized)fitPage();else{const box=canvas.getBoundingClientRect();if(lastBox){current.x+=lastBox.left-box.left;current.y+=lastBox.top-box.top;}apply();}});observer.observe(canvas);
 return {show(key,element){clearTimeout(clickTimer);clickTarget=null;cables.reset();svg=element;svg.style.width=svg.viewBox.baseVal.width+'px';svg.style.height=svg.viewBox.baseVal.height+'px';canvas.classList.add('diagram-view');let fresh=false;if(!views.has(key)){views.set(key,{x:0,y:0,scale:1});fresh=true;}current=views.get(key);const origin=svg.viewBox.baseVal;if(!fresh){current.x+=(origin.x-(current.originX||0))*current.scale;current.y+=(origin.y-(current.originY||0))*current.scale;}current.originX=origin.x;current.originY=origin.y;canvas.replaceChildren(element);cables.show(element);if(fresh)fitPage();else apply();},clear(){clearTimeout(clickTimer);clickTarget=null;cables.reset();svg=null;current=null;canvas.classList.remove('diagram-view');if(percent)percent.textContent='';},reset(){views.clear();cables.clear();},preserve(){if(current)current.userSized=true;},syncCableInteraction(){cables.sync();},fit:fitPage};
}
