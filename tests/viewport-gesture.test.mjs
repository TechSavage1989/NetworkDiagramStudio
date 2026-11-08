import test from 'node:test';
import assert from 'node:assert/strict';
import {diagramViewport} from '../src/web/viewport.mjs';
import {dragAxis} from '../src/web/snapping.mjs';

function fixture(t){
 let notifyResize;
 const previous=globalThis.ResizeObserver;
 globalThis.ResizeObserver=class{constructor(callback){notifyResize=callback;}observe(){}};
 t.after(()=>{if(previous===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=previous;});
 const handlers=new Map(),rect={left:30,top:200},canvas={clientWidth:1000,clientHeight:600,
  classList:{add(){},remove(){}},addEventListener(type,handler){handlers.set(type,handler);},setAttribute(){},
  getBoundingClientRect(){return {...rect,width:this.clientWidth,height:this.clientHeight};},replaceChildren(){},
  focus(){},setPointerCapture(){},hasPointerCapture(){return false;}};
 const svg={style:{},viewBox:{baseVal:{x:0,y:0,width:1200,height:916}}},device={x:400,y:400},preview=[0,0];
 const viewport=diagramViewport(canvas,{onMoveStart(){
  const axisFor=dragAxis(),delta=(dx,dy,event)=>{const axis=axisFor(dx,dy,event.shiftKey);return [axis===1?0:dx,axis===0?0:dy];};
  return {preview(dx,dy,event){preview.splice(0,2,...delta(dx,dy,event));},commit(dx,dy,event){const [x,y]=delta(dx,dy,event);device.x+=x;device.y+=y;preview.splice(0,2,0,0);}};
 }});
 viewport.show('Drawing',svg);
 const visible=()=>{
  const transform=/translate\(([-\d.e]+)px,([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(svg.style.transform);assert.ok(transform);
  const [,x,y,scale]=transform.map(Number);
  return {x:rect.left+x+(device.x+preview[0])*scale,y:rect.top+y+(device.y+preview[1])*scale,scale};
 };
 const target={closest(selector){return selector==='[data-inline-editor]'?null:this;},getAttribute(){return 'device';}};
 const dispatch=(type,x,y)=>handlers.get(type)({pointerId:1,button:0,clientX:x,clientY:y,target,shiftKey:true,preventDefault(){}});
 return {visible,dispatch,resize(){rect.top+=20;canvas.clientHeight-=20;},notifyResize:()=>notifyResize()};
}

for(const timing of ['before the first movement','after the first movement'])test('an editable drag keeps its visible origin when a delayed resize runs '+timing,t=>{
 const view=fixture(t);
 // Selection/status wrapping has already changed the visible canvas, while
 // ResizeObserver has not yet delivered that earlier layout notification.
 view.resize();const before=view.visible(),x=before.x+5,y=before.y+5;
 view.dispatch('pointerdown',x,y);
 if(timing==='before the first movement')view.notifyResize();
 view.dispatch('pointermove',x+30,y+4);
 if(timing==='after the first movement')view.notifyResize();
 const moving=view.visible();assert.ok(Math.abs(moving.x-before.x-30)<1e-7);assert.ok(Math.abs(moving.y-before.y)<1e-7);assert.equal(moving.scale,before.scale);
 view.dispatch('pointermove',x+60,y+25);view.dispatch('pointerup',x+60,y+25);
 const after=view.visible();assert.ok(Math.abs(after.x-before.x-60)<1e-7);assert.ok(Math.abs(after.y-before.y)<1e-7);assert.equal(after.scale,before.scale);
});
