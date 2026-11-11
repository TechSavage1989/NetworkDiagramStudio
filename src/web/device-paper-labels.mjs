import {textLayout} from './diagram/scene.mjs';
import {textWidth,intersects,pathCrossesText} from './diagram/labels.mjs';
import {deviceBounds} from './diagram/device-geometry.mjs';
import {presentation} from './presentation.mjs';

// Paper labels are not hardware. A small chassis must not force its name and
// model to the same tiny scale. Place measured automatic captions in nearby
// clear space after fitting hardware; never move sockets, cables or user text.
export function readableDeviceLabels(page,project,unit=1){
 const settings=presentation(project,page),minimum=settings.minimumTextPt*(settings.textScale||1);
 if(!minimum||!Number.isFinite(unit)||unit<=0)return;
 const edits=project.layout?.drawingEdits||{},labels=page.items.filter(i=>i.type==='text'&&i.titleOwner&&!i.hidden&&String(i.value||'').trim()),automatic=labels.filter(i=>!['x','y','w','h','size','angle'].some(k=>Number.isFinite(edits[i.editKey]?.[k]))&&!i.angle);
 if(!automatic.length)return;
 const bodies=page.items.filter(i=>i.type==='device'&&i.kind!=='plug').map(i=>({...i,...deviceBounds(i)})),paths=page.items.filter(i=>i.type==='path');
 const occupied=page.items.filter(i=>(i.type==='text'||i.panelGroup)&&!i.hidden),edge=2*unit,left=(page.originX||0)+edge,right=(page.originX||0)+page.width-edge,top=(page.originY||0)+edge,bottom=(page.originY||0)+page.height-edge;
 // A top dock is a horizontal header rail, not unused side whitespace.
 // Keep automatic body captions below it while side panels retain only their
 // real occupied footprints, allowing intentional use of empty space below.
 const topRail=settings.panel.position==='top'?page.items.filter(i=>i.panelGroup&&!i.hidden):[];
 const captionTop=topRail.length?Math.max(top,...topRail.map(i=>i.y+i.h))+2*unit:top;
 const result=[];
 for(const item of automatic){
  const body=bodies.find(b=>b.sourceId===item.titleOwner);
  if(!body||['x','y','w','h','angle'].some(k=>Number.isFinite(edits[body.editKey]?.[k]))){continue;}
  const category=item.titleSlot==='detail'?'deviceDetails':'deviceNames',style=project.layout?.textStyles?.[category],requested=Number.isFinite(style?.size)?style.size:minimum*(style?.scale||1),target=requested*unit/ .75;
  if(textLayout(item).size>=target-.001){continue;}
  const size=Math.max(item.size,target),natural=textWidth(item.value,size,item.bold),widths=[Math.min(natural,Math.max(body.w,160*unit)),Math.min(natural,Math.max(body.w,240*unit)),Math.min(natural,320*unit)].filter((v,i,a)=>v>0&&a.indexOf(v)===i),candidates=[];
  for(const w of widths){
   // textLayout and the exporters share wrapping. Give the full requested
   // point size enough height, rather than letting the text fitter reduce it.
   const measured=textLayout({...item,w,h:page.height,size}),h=measured.lines.length*size*1.2;
   const xs=[body.x,body.x+(body.w-w)/2,body.x+body.w-w];
   for(const gap of [3,8,16,28,44,64])for(const x of xs){
    candidates.push({x,y:body.y-h-gap*unit,w,h,size},{x,y:body.y+body.h+gap*unit,w,h,size});
   }
   for(const y of [body.y,body.y+(body.h-h)/2,body.y+body.h-h])candidates.push({x:body.x-w-8*unit,y,w,h,size},{x:body.x+body.w+8*unit,y,w,h,size});
  }
  const preferred=item.titleSlot==='detail'?body.y+body.h+3*unit:body.y-size*1.2-3*unit;
  candidates.sort((a,b)=>(Math.abs(a.x-body.x)+Math.abs(a.y-preferred)+a.h*.2)-(Math.abs(b.x-body.x)+Math.abs(b.y-preferred)+b.h*.2));
  const clear=b=>b.x>=left&&b.x+b.w<=right&&b.y>=captionTop&&b.y+b.h<=bottom&&!bodies.some(n=>intersects(b,n,2*unit))&&!occupied.some(t=>t!==item&&intersects(b,t,2*unit))&&!paths.some(p=>pathCrossesText(p,b,Math.max(2*unit,(p.weight||0)/2+unit)));
  const fit=candidates.find(clear);
  if(fit){Object.assign(item,fit);item.paperDeviceLabel=true;}
  // A genuine capacity conflict is reported, never hidden by overlap or crop.
  result.push({key:item.editKey,targetPt:requested,actualPt:textLayout(item).size/unit*.75,improved:!!fit});
  
 }
 page.deviceLabelReadability=result;
}
