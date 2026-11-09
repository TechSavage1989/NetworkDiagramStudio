import {paperDimensions} from './page-options.mjs';
// Editor-only page rulers. The tick marks follow the SVG viewBox and the
// actual selected paper dimensions, not the desktop's display DPI.
export function pageRulerTicks(lengthPx,originPx,pxPerUnit,{minor=.25,major=1}={}){
 if(![lengthPx,originPx,pxPerUnit].every(Number.isFinite)||pxPerUnit<=0)return [];
 const minorStep=minor*Math.max(1,2**Math.max(0,Math.ceil(Math.log2(8/(minor*pxPerUnit)))));
 const from=Math.max(0,Math.ceil((0-originPx)/(minorStep*pxPerUnit))),to=Math.min(10000,Math.floor((lengthPx-originPx)/(minorStep*pxPerUnit)));
 const ticks=[];
 for(let i=from;i<=to;i++){
  const value=i*minorStep,at=originPx+value*pxPerUnit,majorTick=Math.abs(value/major-Math.round(value/major))<1e-7;
  ticks.push({at,value,major:majorTick,medium:Math.abs(value/(major/2)-Math.round(value/(major/2)))<1e-7});
 }
 return ticks;
}

export function createPageRulers(host){
 const top=document.createElement('canvas'),side=document.createElement('canvas'),unit=document.createElement('button');
 top.className='page-ruler-top';top.setAttribute('aria-label','Horizontal page ruler');
 side.className='page-ruler-side';side.setAttribute('aria-label','Vertical page ruler');
 unit.className='page-ruler-unit';unit.type='button';unit.title='Switch ruler units between inches and millimeters';unit.setAttribute('aria-label','Ruler units');
 let widthMm=0,heightMm=0,mode='in',transform=null,visible=false;
 const dpr=()=>Math.min(3,Math.max(1,window.devicePixelRatio||1));
 const setup=(canvas,w,h)=>{
  const scale=dpr();canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  const ctx=canvas.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#f7fafb';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#8ba0ab';ctx.fillStyle='#344b57';ctx.lineWidth=1;ctx.font='10px Segoe UI, Arial, sans-serif';
  return ctx;
 };
 function render(){
  if(!visible||!transform||!host.isConnected)return;
  const w=host.clientWidth,h=host.clientHeight;
  if(w<26||h<26)return;
  const tx=setup(top,w-24,24),sy=setup(side,24,h-24),ratio=mode==='mm'?1:25.4,major=mode==='mm'?10:1,minor=mode==='mm'?2:.25;
  const pxPerHorizontal=(transform.scale*transform.w)/(widthMm/ratio),pxPerVertical=(transform.scale*transform.h)/(heightMm/ratio);
  const xTicks=pageRulerTicks(w-24,transform.x-24,pxPerHorizontal,{minor,major});
  const yTicks=pageRulerTicks(h-24,transform.y-24,pxPerVertical,{minor,major});
  for(const tick of xTicks){
   const x=Math.round(tick.at)+.5,height=tick.major?12:tick.medium?8:4;
   tx.beginPath();tx.moveTo(x,24);tx.lineTo(x,24-height);tx.stroke();
   if(tick.major){const label=mode==='mm'?String(Math.round(tick.value)):String(Math.round(tick.value));tx.fillText(label,x+2,9);}
  }
  for(const tick of yTicks){
   const y=Math.round(tick.at)+.5,length=tick.major?12:tick.medium?8:4;
   sy.beginPath();sy.moveTo(24,y);sy.lineTo(24-length,y);sy.stroke();
   if(tick.major)sy.fillText(String(Math.round(tick.value)),2,Math.max(10,y-3));
  }
  unit.textContent=mode;
  unit.title=(mode==='mm'?'Millimeters':'Inches')+' - click to switch units';
  unit.setAttribute('aria-label','Ruler units: '+(mode==='mm'?'millimeters':'inches'));
  top.dataset.unit=side.dataset.unit=mode;
  top.dataset.pageWidthMm=String(widthMm);side.dataset.pageHeightMm=String(heightMm);
 }
 unit.onclick=()=>{mode=mode==='mm'?'in':'mm';render();};
 return {
  show(svg,paper){
   const dimensions=paperDimensions(paper?.visiblePaper);widthMm=dimensions?.widthMm||Number(paper?.widthMm)||svg.viewBox.baseVal.width*25.4/96;
   heightMm=dimensions?.heightMm||Number(paper?.heightMm)||svg.viewBox.baseVal.height*25.4/96;
   const name=paper?.visiblePaper?.preset||paper?.paper?.preset||'';
   mode=/^a[1-5]$/.test(name)?'mm':'in';
   visible=true;host.append(top,side,unit);render();
  },
  sync(view,svg){if(!svg)return;transform={...view,w:svg.viewBox.baseVal.width,h:svg.viewBox.baseVal.height};render();},
  clear(){visible=false;transform=null;for(const el of [top,side,unit])el.remove();},
  render,
  get unit(){return mode;},
 };
}
