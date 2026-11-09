import {deviceBounds,rotatedDeviceAnchor} from './device-geometry.mjs';
import {endpointLead} from './routing.mjs';
import {crossesText,textFootprint,intersects,embeddedTextBoxes} from './labels.mjs';

const overlap=(a,b,c,d)=>Math.min(Math.max(a,b),Math.max(c,d))-Math.max(Math.min(a,b),Math.min(c,d));
const inside=(p,b)=>p.x>=b.x-.01&&p.x<=b.x+b.w+.01&&p.y>=b.y-.01&&p.y<=b.y+b.h+.01;
const failure=()=>Object.assign(Error('This wireless port needs more room around its number.'),{code:'CORE_LAYOUT_CAPACITY'});
// Number bands retain their physical socket alignment. Cables leave through
// the nearest free interval beside a band instead of crossing its text.
export function wirelessNumberLeads(page,node,endData,project={}){
 const attached=[...endData.values()].filter(v=>v.node===node),edits=project.layout?.drawingEdits||{};
 if(node.angle){
  const numbers=page.items.filter(i=>i.sourceId===node.sourceId&&i.portNumberRole==='text').map(textFootprint),body=deviceBounds(node);
  for(const {anchor} of attached){const point=node.ports[anchor.port];if(point)Object.assign(anchor,rotatedDeviceAnchor(node,anchor.port,...point,anchor.side,anchor.weight,numbers));}
  return {numbers,obstacles:numbers.filter(b=>b.x<body.x||b.y<body.y||b.x+b.w>body.x+body.w||b.y+b.h>body.y+body.h)};
 }
 // Mapped bitmaps have anchors but no measured socket outline. Keep their
 // centered number band beyond the painted endpoint, not two pixels from its
 // center as a socket-free report label would otherwise be placed.
 // Port numbers are plain text items carrying their measured side and socket.
 const numberItems=()=>page.items.filter(i=>i.sourceId===node.sourceId&&i.portNumberRole==='text');
 for(const text of numberItems().filter(i=>!i.socketBounds)){
  const point=Object.entries(node.ports).find(([name])=>name.toLowerCase()===text.portName.toLowerCase())?.[1];if(!point)continue;
  if(Number.isFinite(edits[text.editKey]?.y))continue;const box=textFootprint(text);
  const gap=Math.max(4,...attached.filter(v=>v.anchor.port.toLowerCase()===text.portName.toLowerCase()).map(v=>(v.anchor.weight||4)/2+2)),y=node.y+point[1]*node.h,dy=text.numberSide==='below'?Math.max(0,y+gap-box.y):Math.min(0,y-gap-box.y-box.h);text.y+=dy;
 }
 const measureNumbers=()=>[...new Map(page.items.filter(i=>i.sourceId===node.sourceId&&i.portNumberRole==='text').map(textFootprint).map(box=>[[box.x,box.y,box.w,box.h].join('/'),box])).values()],sockets=node.children.filter(i=>i.socketPart===0).map(i=>({x:node.x+i.x*node.w,y:node.y+i.y*node.h,w:i.w*node.w,h:i.h*node.h})),regions=(node.panelRegions||[]).map(r=>({x:node.x+(r.x||0)*node.w,y:node.y+r.y*node.h,w:(r.w||1)*node.w,h:r.h*node.h})),reserved=[];let numbers=measureNumbers();
 const reserveNumberRow=(anchor,region)=>{
  if(node.moduleChannel)return false;
  const own=numberItems().find(i=>i.portName.toLowerCase()===anchor.port.toLowerCase());if(!own?.socketBounds)return false;
  const ownBox=textFootprint(own),texts=numberItems().filter(i=>i.numberSide===own.numberSide&&Math.abs(textFootprint(i).y-ownBox.y)<.01),boxes=texts.map(text=>({...textFootprint(text),socketBounds:text.socketBounds})),names=new Set(texts.map(i=>i.portName.toLowerCase()));if(texts.some(i=>Number.isFinite(edits[i.editKey]?.y)))return false;
  const peers=attached.filter(v=>names.has(v.anchor.port.toLowerCase())),gap=peers.reduce((sum,v)=>sum+(v.anchor.weight||4),0)+2*(peers.length+1),above=own.numberSide==='above',edge=above?Math.min(...boxes.map(i=>i.socketBounds?.y??i.y+i.h)):Math.max(...boxes.map(i=>i.socketBounds?i.socketBounds.y+i.socketBounds.h:i.y)),dy=above?Math.min(0,edge-gap-ownBox.y-ownBox.h):Math.max(0,edge+gap-ownBox.y);
  if(!dy)return false;const shifted=boxes.map(box=>({...box,y:box.y+dy})),otherNumbers=numberItems().filter(i=>!texts.includes(i)).map(textFootprint),otherRegions=regions.filter(r=>r!==region),hardwareText=embeddedTextBoxes(page).filter(box=>box.owner===node);
  if(shifted.some(box=>[...sockets,...otherNumbers,...otherRegions,...hardwareText].some(other=>intersects(box,other,1))))return false;
  for(const item of texts)item.y+=dy;numbers=measureNumbers();
  for(const peer of peers){const pad=(peer.anchor.weight||4)/2+1,bound=above?Math.min(...shifted.map(box=>box.y))-pad:Math.max(...shifted.map(box=>box.y+box.h))+pad;if(peer.anchor.escapeY==null)peer.anchor.edge=above?Math.min(peer.anchor.edge,bound):Math.max(peer.anchor.edge,bound);}
  return true;
 };
 const entries=attached.sort((a,b)=>a.anchor.y-b.anchor.y||a.anchor.x-b.anchor.x||a.e.idx-b.e.idx);
 for(const {anchor} of entries){const pad=(anchor.weight||4)/2+1;
  if(anchor.moduleEscape){
   const spec=anchor.moduleEscape;
   const bands=(source,x)=>{const blocked=numbers.filter(box=>overlap(anchor.x,x,box.x-pad,box.x+box.w+pad)>.01).map(box=>[box.y-pad,box.y+box.h+pad]).sort((a,b)=>a[0]-b[0]),free=[];
    for(const [lo,hi] of source){let cursor=lo;for(const [a,b] of blocked){if(b<=cursor||a>=hi)continue;if(a>cursor)free.push([cursor,Math.min(a,hi)]);cursor=Math.max(cursor,b);if(cursor>=hi)break;}if(cursor<hi)free.push([cursor,hi]);}
    return free.filter(([lo,hi])=>!numbers.some(box=>crossesText([[anchor.x,anchor.y],[anchor.x,Math.max(lo,Math.min(hi,anchor.y))]],box,pad)));
   };
   spec.bands=bands(spec.bands,(spec.channel[0]+spec.channel[1])/2);spec.outerBands=bands(spec.outerBands,spec.outer);
   if(!spec.bands.length&&!spec.outerBands.length)throw failure();continue;
  }
  const ay=anchor.escapeY??anchor.edge+(anchor.side==='top'?-12:12),existing=endpointLead({anchor,ay,exitX:anchor.departure?.at(-1)?.[0]??anchor.x});
  if(!numbers.some(box=>crossesText(existing,box,pad))){reserved.push({points:existing,weight:anchor.weight});continue;}
  const socket=sockets.find(box=>Math.abs(box.x+box.w/2-anchor.x)<.01&&Math.abs(box.y+box.h/2-anchor.y)<.01),region=regions.find(box=>inside(anchor,box));
  const choose=()=>{const ay=anchor.escapeY??anchor.edge+(anchor.side==='top'?-12:12),obstacles=[...numbers,...sockets.filter(box=>box!==socket),...regions.filter(box=>box!==region)],candidates=[anchor.x,...obstacles.flatMap(box=>[box.x-pad-.01,box.x+box.w+pad+.01])].filter(x=>!region||x>=region.x-pad&&x<=region.x+region.w+pad).sort((a,b)=>Math.abs(a-anchor.x)-Math.abs(b-anchor.x)||a-b),ys=[anchor.y,...(anchor.departure?[anchor.departure[0][1]]:[]),...(socket?[anchor.side==='top'?socket.y-pad-.01:socket.y+socket.h+pad+.01]:[])];
   for(const y of ys)for(const x of candidates){const points=[[anchor.x,anchor.y],[anchor.x,y],[x,y],[x,ay]];if(obstacles.some(box=>crossesText(points,box,pad)))continue;
    const lines=points.slice(1).map((b,i)=>[points[i],b]);if(reserved.some(other=>lines.some(([a,b])=>other.points.slice(1).some((d,i)=>{const c=other.points[i],h=a[1]===b[1],same=h===(c[1]===d[1]);return same&&Math.abs(a[h?1:0]-c[h?1:0])<((anchor.weight||4)+(other.weight||4))/2+.25&&overlap(a[h?0:1],b[h?0:1],c[h?0:1],d[h?0:1])>.01;}))))continue;
    return {points,x,y};
   }
  };
  let found=choose();if(!found&&reserveNumberRow(anchor,region))found=choose();
  if(!found)throw failure();anchor.departure=[[anchor.x,found.y],[found.x,found.y]];reserved.push({points:found.points,weight:anchor.weight});
 }
 // Internal bands are already protected by the immutable endpoint leads and
 // physical panel obstacles. Only outward bands need global route scoring;
 // checking hundreds of protected labels for every candidate is redundant.
 const pad=Math.max(3,...entries.map(v=>(v.anchor.weight||4)/2+1));
 return {numbers,obstacles:numbers.filter(box=>!regions.some(region=>box.x>=region.x+pad&&box.y>=region.y+pad&&box.x+box.w<=region.x+region.w-pad&&box.y+box.h<=region.y+region.h-pad))};
}
