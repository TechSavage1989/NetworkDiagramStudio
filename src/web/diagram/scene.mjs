import {logicalPort} from '../physical-links.mjs';
import {pageGeometry,pageFamily} from '../page-options.mjs';
import {deviceScale} from '../presentation.mjs';
// Geometry is stored in page pixels with a top-left origin. Both exporters consume the same scene.
import {coreSidebar} from './sidebar.mjs';
import {deviceFaceplate} from './faceplate.mjs';
import {editDeviceShape} from '../drawing-edits.mjs';
import {simplifyRoute,ROUTE_STYLE} from './routing.mjs';
import {linkDefaults,legendEntryId,defaultLinkWeight,cleanLinkStyles} from '../link-styles.mjs';
import {wrapPortText} from '../port-table.mjs';
import {connectionMediaInfo} from '../connection-types.mjs';
import {genericDeviceSymbol} from '../device-symbols.mjs';
import {textWidth} from './labels.mjs';
export const W = 1200, H = 975;
export const C = {ink:'#16364A',muted:'#536779',teal:'#166574',rule:'#CEDCE0',pale:'#F0F5F6',white:'#FFFFFF',up:'#D8F0DE',down:'#E2E7EA',amber:'#805400'};
export const xml = s => String(s ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const round = n => Math.round(n*1e5)/1e5;
export const cableWeight = defaultLinkWeight;
export function rect(box,x,y,w,h,fill,stroke='none',weight=1){box.push({type:'rect',x,y,w,h,fill,stroke,weight});}
export function label(box,x,y,w,h,value,size=15,bold=false,color=C.ink,align='left'){
  box.push({type:'text',x,y,w,h,value:String(value ?? ''),size,bold,color,align});
}
export function displayPortCaption(port){const name=String(port??'');return /port/i.test(name)?name:'Port '+name;}
// A scene caption always retains its complete editable value. Both exporters
// use the same measured lines and only fit a fixed box down to a readable size.
export function textLayout(item){
 const original=Number(item.size)||12,min=Math.min(8,original),width=Math.max(1,item.w),height=Math.max(1,item.h);
 const failure=()=>Error('This text needs more space. Enlarge its text box or shorten the caption: '+String(item.value).slice(0,80));
 if(!item.art&&textWidth(String(item.value).replace(/\s/g,''),min,item.bold)-6>width*Math.max(1,Math.floor(height/(min*1.2))))throw failure();
 const at=size=>{const lines=item.art?String(item.value).split('\n'):wrapPortText(item.value,width+6,size,item.bold),lineHeight=lines.length===1?Math.min(height,size*1.2):size*1.2;return {lines,size,lineHeight};},fits=layout=>layout.lines.length*layout.lineHeight<=height+.001&&layout.lines.every(line=>textWidth(line,layout.size,item.bold)-6<=width+.001);
 const normal=at(original);if(item.art||fits(normal))return normal;
 let lo=min,hi=original,result=at(min);if(!fits(result))throw failure();
 for(let n=0;n<20;n++){const middle=(lo+hi)/2,candidate=at(middle);if(fits(candidate)){lo=middle;result=candidate;}else hi=middle;}
 return result;
}
export const list = x => Array.isArray(x)?x:[];
export const split = (a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,i*n+n));
export function value(v){return Array.isArray(v)?v.map(value).join(', '):v!=null && typeof v!=='object'?String(v):'';}
export function rate(v){
  if(typeof v==='number') return v>=1e9?v/1e9+' Gbps':v>=1e6?v/1e6+' Mbps':String(v);
  return value(v);
}
export function mediaInfo(v,access=false){
  return connectionMediaInfo(value(v),access);
}
export function linkLegend(page){
 const defaults=linkDefaults,scope=page.editScope||page.name,entries=new Map();
 for(const path of page.items.filter(i=>i.type==='path')){const name=path.linkType||'Link',color=path.color.toUpperCase(),opacity=path.opacity??1,weight=path.weight||cableWeight,key=JSON.stringify([name,color,opacity,weight]);if(!entries.has(key))entries.set(key,{name,color,opacity,weight,style:path.linkStyle,speeds:new Set()});if(path.sourceLink)entries.get(key).speeds.add(rate(path.sourceLink.speed)||'Unspecified speed');}
 const titleOf=entry=>(entry.style?.title||entry.name)+(entry.style?.showSpeed&&entry.speeds.size?' | '+[...entry.speeds].sort().join(', '):'')+(entry.opacity<1?' ('+Math.round(entry.opacity*100)+'%)':'');
 const values=[...entries.values()].sort((a,b)=>{const rank=n=>defaults.findIndex(([name])=>name===n||name.startsWith('Fiber')&&/unspecified|Fiber/.test(n));return (rank(a.name)<0?9:rank(a.name))-(rank(b.name)<0?9:rank(b.name))||a.color.localeCompare(b.color)||a.opacity-b.opacity;});
 if(!values.length)return;
 if(page.legendLayout==='sidebar'){
  const side=page.sidebar||coreSidebar(),s=side.scale,tf=side.textScale||1,textX=38+64*s,textSpan=side.width-64*s-4,size=Math.max(12,14*s)*tf,detailSize=Math.max(11,12*s)*tf,lineHeight=Math.max(size*1.25,18*s),detailHeight=Math.max(detailSize*1.25,15*s);
  label(page.items,38,147,side.width,26*s*tf,(page.sidebar?.connectionHeading||'CONNECTION TYPES').toUpperCase(),16*s*tf,true,C.teal);Object.assign(page.items.at(-1),{editKey:scope+'|legend|heading',full:true});let y=147+51*s*tf;
  const rank=name=>({Copper:0,'AP copper':1,'SR fiber':2,DAC:3,'LR fiber':4})[name]??5;
  for(const {name,color,opacity,weight,style,speeds} of values.slice().sort((a,b)=>rank(a.name)-rank(b.name))){const id=legendEntryId(name,color,opacity,!!style,weight),title=titleOf({name,style,speeds,opacity}),lines=wrapPortText(title,textSpan,size),description=style?.description?wrapPortText(style.description,textSpan,detailSize):[];
   rect(page.items,38,y+11*s,52*s,weight,color);Object.assign(page.items.at(-1),{opacity,sampleWeight:weight,name:name+' color key',legendEntry:true,linkType:name,editKey:scope+'|legend|'+id+'|swatch'});
   lines.forEach((text,n)=>{label(page.items,textX,y+n*lineHeight,textSpan,lineHeight,text,size,false,C.ink);Object.assign(page.items.at(-1),{legendEntry:true,linkType:name,legendFullText:style?.title||name,editKey:scope+'|legend|'+id+'|text'+(n?'|wrap'+n:''),full:true});});
   description.forEach((text,n)=>{label(page.items,textX,y+lines.length*lineHeight+n*detailHeight,textSpan,detailHeight,text,detailSize,false,C.muted);Object.assign(page.items.at(-1),{legendEntry:true,legendDescription:true,legendFullText:style.description,linkType:name,editKey:scope+'|legend|'+id+'|description'+(n?'|wrap'+n:''),full:true});});y+=Math.max(44*s,lines.length*lineHeight+description.length*detailHeight+12*s);
  }page.legendBottom=y;return;
 }
 const span=(page.width||W)-72,cols=Math.min(values.length<=6?3:6,Math.max(1,Math.floor(span/240))),size=12,width=span/cols-38,rows=[];
 const entriesWithText=values.map(entry=>({...entry,lines:wrapPortText(titleOf(entry),width,size),description:entry.style?.description?wrapPortText(entry.style.description,width,11):[]}));
 for(let i=0;i<entriesWithText.length;i+=cols)rows.push(Math.max(...entriesWithText.slice(i,i+cols).map(e=>Math.max(22,e.lines.length*15+e.description.length*14+5))));
 label(page.items,38,148,(page.width||W)-80,15,'LINK COLORS',11,true,C.muted);Object.assign(page.items.at(-1),{editKey:scope+'|legend|heading',full:true});
 entriesWithText.forEach(({name,color,opacity,weight,style,lines,description},i)=>{const x=38+(i%cols)*span/cols,y=167+rows.slice(0,Math.floor(i/cols)).reduce((a,b)=>a+b,0),id=legendEntryId(name,color,opacity,!!style,weight);
  rect(page.items,x,y+6,22,weight,color);Object.assign(page.items.at(-1),{opacity,sampleWeight:weight,name:name+' color key',legendEntry:true,linkType:name,editKey:scope+'|legend|'+id+'|swatch'});
  lines.forEach((text,n)=>{label(page.items,x+30,y+n*15,width,15,text,size,false,C.ink);Object.assign(page.items.at(-1),{legendEntry:true,linkType:name,legendFullText:style?.title||name,editKey:scope+'|legend|'+id+'|text'+(n?'|wrap'+n:''),full:true});});
  description.forEach((text,n)=>{label(page.items,x+30,y+lines.length*15+n*14,width,14,text,11,false,C.muted);Object.assign(page.items.at(-1),{legendEntry:true,legendDescription:true,legendFullText:style.description,linkType:name,editKey:scope+'|legend|'+id+'|description'+(n?'|wrap'+n:''),full:true});});
 });page.legendBottom=167+rows.reduce((a,b)=>a+b,0);
}
export function fresh(name,title,subtitle,project){
  const geometry=pageGeometry(project,pageFamily(name));if(project._reportPrefix)name=project._reportPrefix+'|'+name;
  const p={name,title,...geometry,items:[]}, a=p.items,span=p.width-72,nameWidth=Math.max(180,span-308);
  const projectName=project.name||'Network project',nameHeight=Math.max(23,wrapPortText(projectName,nameWidth,15,true).length*18);
  label(a,36,Math.max(0,39-nameHeight),nameWidth,Math.min(39,nameHeight),projectName,15,true,C.teal);a.at(-1).pageHeading='project';
  label(a,p.width-300,18,264,23,'NETWORK DOCUMENTATION',13,true,C.teal,'right');a.at(-1).pageFrame='brand';
  label(a,36,43,span,48,title,33,true);a.at(-1).pageTitle=true;a.at(-1).pageHeading='title';
  label(a,36,99,span,36,subtitle,16,false,C.muted);a.at(-1).pageHeading='subtitle';
  rect(a,36,138,span,2,C.rule);a.at(-1).pageFrame='rule';
  return p;
}
export function actualAsset(project,d){
  let a=d.stencil;
  if(!a && d.stencilId!=null){
    const s=project.stencils;
    a=Array.isArray(s)?s.find(i=>String(i?.id)===String(d.stencilId)):s&&Object.hasOwn(s,d.stencilId)?s[d.stencilId]:null;
  }
  const url=a?.dataUrl;
  if(!a || !Number.isFinite(+a.width) || !Number.isFinite(+a.height) || (a.view && !/^front$/i.test(a.view)) || typeof url!=='string' || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/i.test(url) || !(+a.width>0 && +a.height>0))return null;
  return a;
}
export function fitRatio(r,x,y,w,h){
  const width=Math.min(w,h*r),height=width/r;
  return {x:x+(w-width)/2,y:y+(h-height)/2,w:width,h:height};
}
export function portNumber(s){return String(s??'').match(/(\d+)(?:[^\d]*)$/)?.[1]||String(s??'');}
export function portList(d){return list(d.ports).filter(p=>p?.name!=null);}
export function physicalPorts(d){
  return portList(d).filter(p=>!logicalPort(p));
}
export function state(v){return /^(up|connected|online|active|operational)$/i.test(value(v))?'up':/down|disabled|offline|disconnected|inactive/i.test(value(v))?'down':'unknown';}
export function addDevice(page,project,d,bounds,key,opts={}){
  const asset=actualAsset(project,d), ports=physicalPorts(d), ap=d.kind==='ap',panel=!asset&&!ap?deviceFaceplate(d,opts):null,symbol=!asset&&!panel?genericDeviceSymbol(d.kind):null;
  const ratio=asset?+asset.width/+asset.height:panel?.ratio||symbol?.ratio|| (ap?1:d.kind==='handoff'?6:d.kind==='unknown'?3:9);
  const placement=opts.fillBounds?Object.fromEntries(['x','y','w','h'].map((key,n)=>[key,bounds[n]])):opts.fitWidth?{x:bounds[0],y:bounds[1],w:bounds[2],h:bounds[2]/ratio}:fitRatio(ratio,...bounds);
  const factor=deviceScale(project,d);if(!opts.fillBounds){placement.w*=factor;placement.h*=factor;}
  const g={type:'device',key,sourceId:d.id,instanceKey:opts.instanceKey,name:d.name||d.id,kind:d.kind,model:d.model||'',...placement,asset,
    masterKey:asset?'asset:'+String(asset.id??d.stencilId??d.id):'device:'+d.id,ports:Object.create(null),children:[],fallback:!asset};
  if(!asset&&d.stackMembers?.length)g.masterKey+=':members:'+d.stackMembers.map(m=>m.id).join(',')+':gap:'+(opts.padding??1);
  if(!asset&&d.stackMembers?.length&&opts.memberGaps&&Object.keys(opts.memberGaps).length){g.memberGaps={...opts.memberGaps};g.masterKey+=':member-gaps:'+JSON.stringify(Object.entries(opts.memberGaps).sort(([a],[b])=>a.localeCompare(b)));}
  const addAnchor=(k,p)=>{if(Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1))g.ports[String(k)]=[...p];};
  if(asset){
    for(const [k,v] of Object.entries(asset.anchors||{}))addAnchor(k,Array.isArray(v)?v:[v?.x,v?.y]);
  } else if(panel){
    Object.assign(g.ports,panel.ports);g.children=panel.children;g.panelRegions=panel.regions;g.moduleChannel=panel.moduleChannel;g.physicalLayout=panel.verified;g.layoutSource=panel.source;
  } else if(symbol){
    g.children=symbol.children;g.genericSymbol=true;
  } else if(d.kind==='handoff'){
    rect(g.children,0,0,1,1,'#EDF3F5','#A8BAC1',1);rect(g.children,0,0,.012,1,C.ink);g.ports.handoff=[.5,1];
  } else if(ap){
    rect(g.children,0,0,1,1,'#EDF2F3','#718995',1.2);
    rect(g.children,.055,.055,.89,.89,'#FAFCFC','#CED9DC',.65);
    for(const [j,h] of [.12,.21,.30].entries())rect(g.children,.31+j*.14,.56-h,.085,h,'#51818C');
    rect(g.children,.41,.76,.18,.028,'#A8BAC0');
  } else{
    rect(g.children,0,0,1,1,'#D7E0E3','#59717C',1.2);
    rect(g.children,.012,.20,.016,.60,d.kind==='firewall'?'#AD6450':'#65838D');
    label(g.children,.06,.15,.88,.7,'Port layout needs a model or mapped stencil',10,false,C.muted,'center');
  }
  if(opts.apEdge)g.ports[opts.apEdge]=[.5,opts.apEdge==='uplink.top'?0:1];
  editDeviceShape(page,project,g);
  const artworkScale=g.w/(placement.w/(opts.fillBounds?1:factor));
  if(artworkScale!==1)for(const child of g.children)if(child.type==='text'&&!Number.isFinite(project.layout?.drawingEdits?.[child.editKey]?.size))child.size*=artworkScale;
  page.items.push(g);
  return g;
}
// Move the lead into a free vertical channel before it reaches another jack.
function socketDeparture(device, anchor, socket){
  if(!socket)return undefined;
  const direction=anchor.side==='top'?-1:1;
  const boxes=device.children.filter(child=>child.socketPart===0&&child!==socket).map(child=>({
    x:device.x+child.x*device.w,y:device.y+child.y*device.h,w:child.w*device.w,h:child.h*device.h
  }));
  const clearance=(anchor.weight||cableWeight)/2+1;
  const ahead=boxes.filter(box=>direction>0?box.y>anchor.y&&box.y<anchor.edge:
    box.y+box.h<anchor.y&&box.y+box.h>anchor.edge);
  const obstructing=ahead.filter(box=>anchor.x>box.x-clearance&&anchor.x<box.x+box.w+clearance);
  if(!obstructing.length)return undefined;
  const turnY=direction>0?Math.min(...obstructing.map(box=>box.y))-clearance:
    Math.max(...obstructing.map(box=>box.y+box.h))+clearance;
  const socketEdge=device.y+(socket.y+(direction>0?socket.h:0))*device.h;
  if((turnY-socketEdge)*direction<0)return undefined;
  const candidates=ahead.flatMap(box=>[box.x+box.w+clearance,box.x-clearance])
    .sort((a,b)=>Math.abs(a-anchor.x)-Math.abs(b-anchor.x));
  const exit=candidates.find(x=>!ahead.some(box=>x>box.x-clearance+.001&&x<box.x+box.w+clearance-.001)&&
    !boxes.some(box=>turnY>box.y-clearance+.001&&turnY<box.y+box.h+clearance-.001&&
      Math.max(x,anchor.x)>box.x-clearance&&Math.min(x,anchor.x)<box.x+box.w+clearance));
  return exit===undefined?undefined:[[anchor.x,turnY],[exit,turnY]];
}
// A chassis lead may cross its own module horizontally, but its vertical run
// must use the open center or an exterior side, never the next module/bay.
// Empty bays the straight lead from (nx, ny) passes through on its side.
function baysBetween(g,nx,ny,region,top){
  const between=r=>r!==region&&nx>r.x&&nx<r.x+r.w&&(top?r.y+r.h<ny&&r.y+r.h>0:r.y>ny&&r.y<1);
  return g.panelRegions.some(r=>between(r)&&!r.empty)?null:g.panelRegions.filter(r=>between(r)&&r.empty);
}
function recordBayLead(g,nx,ny,region,top){if(baysBetween(g,nx,ny,region,top)?.length)g.bayLeads=[...(g.bayLeads||[]),nx];}
// The painted span of a bay caption, in normalized device coordinates.
function bayCaptions(g,bay){
  return g.children.filter(c=>c.type==='text'&&c.x<bay.x+bay.w&&c.x+c.w>bay.x&&c.y<bay.y+bay.h&&c.y+c.h>bay.y).map(c=>{
    const {lines,size,lineHeight}=textLayout({...c,w:c.w*g.w,h:c.h*g.h}),w=Math.max(...lines.map(line=>Math.max(0,textWidth(line,size,c.bold)-6)))/g.w,h=lines.length*lineHeight/g.h;
    const box=Math.max(...lines.map(line=>textWidth(line,size,c.bold)))/g.w+1/g.w;
    return {child:c,x:c.x+(c.align==='right'?c.w-w:c.align==='center'?(c.w-w)/2:0),y:c.y+(c.h-h)/2,w,h,box};
  });
}
// Slide an empty bay's caption along the bay to the nearest spot clear of
// every cable rising through it (including this socket's). The moved caption
// gets its own native master, since the same device elsewhere keeps the default.
function moveBayCaption(g,nx,ny,region,top,weight){
  const bays=baysBetween(g,nx,ny,region,top);if(bays?.length!==1)return false;
  const bay=bays[0],pad=(weight/2+3)/g.w,caption=bayCaptions(g,bay).find(c=>nx>c.x-pad&&nx<c.x+c.w+pad);if(!caption)return false;
  const columns=[...(g.bayLeads||[]),nx],edge=.012,clear=x=>columns.every(c=>c<x-pad||c>x+caption.w+pad);
  let best=null;for(let x=bay.x+edge;x<=bay.x+bay.w-edge-caption.box+1e-9;x+=1/g.w)if(clear(x)&&(best===null||Math.abs(x-caption.x)<Math.abs(best-caption.x)))best=x;
  if(best===null)return false;
  // The text box keeps its measured width; the painted text starts at best.
  Object.assign(caption.child,{x:best,w:Math.min(caption.box,bay.x+bay.w-best),align:'left'});
  g.masterKey=g.masterKey.replace(/:bay-caption:[^:]*$/,'')+':bay-caption:'+Math.round(best*1e4);return true;
}
// Sockets under an empty bay's caption share the bay below (or above) the
// caption. Each takes its own turn row and lane beside the caption edge it is
// nearer to; nearer sockets turn closest to the row and use the outer lane, so
// the doglegs nest without crossing. Returns null when the bay lacks room.
function captionDeparture(g,nx,ny,region,top,weight){
  const between=r=>r!==region&&nx>r.x&&nx<r.x+r.w&&(top?r.y+r.h<ny&&r.y+r.h>0:r.y>ny&&r.y<1);
  if(g.panelRegions.some(r=>between(r)&&!r.empty))return null;
  const bays=g.panelRegions.filter(r=>between(r)&&r.empty);if(bays.length!==1)return null;
  const bay=bays[0],padX=(weight/2+3)/g.w,padY=(weight/2+3)/g.h,stepY=ROUTE_STYLE.modulePitch/g.h;
  // The rise must not cross another socket of the same module (an inner row).
  const edge=top?bay.y+bay.h:bay.y,low=Math.min(ny,edge),high=Math.max(ny,edge);
  if(g.children.some(c=>c.socketPart===0&&!(c.anchorOrigin&&Math.abs(c.anchorOrigin[0]-nx)<1e-6&&Math.abs(c.anchorOrigin[1]-ny)<1e-6)&&nx>c.x-padX&&nx<c.x+c.w+padX&&c.y+c.h>low&&c.y<high))return null;
  const caption=g.children.filter(c=>c.type==='text'&&c.x<bay.x+bay.w&&c.x+c.w>bay.x&&c.y<bay.y+bay.h&&c.y+c.h>bay.y).map(c=>{
    const {lines,size,lineHeight}=textLayout({...c,w:c.w*g.w,h:c.h*g.h}),w=Math.max(...lines.map(line=>Math.max(0,textWidth(line,size,c.bold)-6)))/g.w,h=lines.length*lineHeight/g.h;
    const x=c.x+(c.align==='right'?c.w-w:c.align==='center'?(c.w-w)/2:0);return {x,y:c.y+(c.h-h)/2,w,h};
  }).find(c=>nx>c.x-padX&&nx<c.x+c.w+padX);
  if(!caption)return null;
  const left=nx<caption.x+caption.w/2,same=g.children.filter(c=>c.anchorOrigin&&Math.abs(c.anchorOrigin[1]-ny)<1e-6).map(c=>c.anchorOrigin[0])
    .filter(x=>x>caption.x-padX&&x<caption.x+caption.w+padX&&(x<caption.x+caption.w/2)===left).sort((a,b)=>left?a-b:b-a);
  const k=Math.max(0,same.findIndex(x=>Math.abs(x-nx)<1e-6)),n=Math.max(1,same.length);
  const near=top?bay.y+bay.h-padY:bay.y+padY,far=top?caption.y+caption.h+padY:caption.y-padY,turn=near+(top?-1:1)*k*stepY;
  if(top?turn<far:turn>far)return null;
  // Lanes keep a full cable separation from every socket column (a neighbor's
  // own straight lead) and from each other, scanning outward from the caption.
  const columns=g.children.filter(c=>c.anchorOrigin&&c.x<region.x+region.w&&c.x+c.w>region.x).map(c=>c.anchorOrigin[0]);
  const gap=(weight+ROUTE_STYLE.gap)/g.w,lanes=[];
  for(let x=left?caption.x-padX:caption.x+caption.w+padX;lanes.length<n&&x>bay.x+padX&&x<bay.x+bay.w-padX;x+=(left?-1:1)/g.w)
   if(columns.every(c=>Math.abs(c-x)>=gap)&&lanes.every(l=>Math.abs(l-x)>=gap))lanes.push(x);
  const lane=lanes[n-1-k];
  if(lane===undefined)return null;
  return [[g.x+nx*g.w,g.y+turn*g.h],[g.x+lane*g.w,g.y+turn*g.h]];
}
function modularAnchor(g,id,nx,ny,region,sideHint,socket,options={}){
  // An empty bay is open faceplate unless its own caption sits on the lead.
  const captionOn=r=>g.children.some(c=>{
    if(c.type!=='text'||c.x+c.w<=r.x||c.x>=r.x+r.w||c.y+c.h<=r.y||c.y>=r.y+r.h)return false;
    const {lines,size}=textLayout({...c,w:c.w*g.w,h:c.h*g.h}),w=Math.max(...lines.map(line=>Math.max(0,textWidth(line,size,c.bold)-6)))/g.w,pad=((options.weight||cableWeight)/2+2)/g.w;
    const left=c.x+(c.align==='right'?c.w-w:c.align==='center'?(c.w-w)/2:0);return nx>left-pad&&nx<left+w+pad;
  });
  // Empty bays only open the way toward the peer; they never turn a lead away.
  const blocked=(top,open=true)=>g.panelRegions.some(r=>r!==region&&nx>r.x&&nx<r.x+r.w&&
    (top?r.y+r.h<ny&&r.y+r.h>0:r.y>ny&&r.y<1)&&(!open||!r.empty||captionOn(r)));
  let top=sideHint==='top'||sideHint!=='bottom'&&ny<=.5;
  // An exposed outer row can leave directly even when its peer is above it.
  // Turning outside the chassis is preferable to crossing every inner row.
  if(blocked(top)&&!blocked(!top,false))top=!top;
  const side=top?'top':'bottom',weight=options.weight||cableWeight,anchor={device:g.key,port:id,x:g.x+nx*g.w,y:g.y+ny*g.h,side,edge:g.y+(top?0:g.h),weight};
  if(!blocked(top)){recordBayLead(g,nx,ny,region,top);const departure=socketDeparture(g,anchor,socket);if(departure)anchor.departure=departure;return anchor;}
  // Only an empty bay's caption is in the way. Slide the caption clear of every
  // cable rising through the bay so this socket also leaves straight; when no
  // clear spot exists, rise into the bay, turn under the caption and leave
  // beside it, rather than crossing the module's rows.
  if(moveBayCaption(g,nx,ny,region,top,weight)){recordBayLead(g,nx,ny,region,top);const departure=socketDeparture(g,anchor,socket);if(departure)anchor.departure=departure;return anchor;}
  const bayTurn=captionDeparture(g,nx,ny,region,top,weight);
  if(bayTurn){g.bayLeads=[...(g.bayLeads||[]),(bayTurn[1][0]-g.x)/g.w];anchor.departure=bayTurn;return anchor;}
  const center=(g.moduleChannel.left+g.moduleChannel.right)/2,column=nx<center?'left':'right';
  const pad=(weight/2+.01)/g.h,xPad=(weight/2+.01)/g.w,lo=region.y+pad,hi=region.y+region.h-pad;
  const details=g.children.filter(c=>(c.socketPart===0||c.type==='text')&&c.x+c.w>region.x&&c.x<region.x+region.w&&c.y+c.h>region.y&&c.y<region.y+region.h).map(c=>{
    if(c.type!=='text')return c;
    const {lines,size,lineHeight}=textLayout({...c,w:c.w*g.w,h:c.h*g.h}),w=Math.max(...lines.map(line=>textWidth(line,size,c.bold)-6))/g.w,h=lines.length*lineHeight/g.h;
    return {...c,x:c.x+(c.align==='right'?c.w-w:c.align==='center'?(c.w-w)/2:0),y:c.y+(c.h-h)/2,w,h};
  });
  const bandsFor=exit=>{
    const left=Math.min(nx,exit),right=Math.max(nx,exit),blocked=details.filter(c=>c.x+c.w>left&&c.x<right)
      .map(c=>[Math.max(lo,c.y-pad),Math.min(hi,c.y+c.h+pad)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
    const free=[];let cursor=lo;
    for(const [a,b] of blocked){if(a>cursor)free.push([cursor,a]);cursor=Math.max(cursor,b);}
    if(cursor<hi)free.push([cursor,hi]);
    return free.filter(([a,b])=>{
      const turn=Math.max(a,Math.min(b,ny)),low=Math.min(ny,turn),high=Math.max(ny,turn);
      return !details.some(c=>c!==socket&&nx>c.x-xPad&&nx<c.x+c.w+xPad&&Math.min(high,c.y+c.h+pad)>Math.max(low,c.y-pad));
    }).map(([a,b])=>[g.y+a*g.h,g.y+b*g.h]).sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])||Math.abs((a[0]+a[1])/2-anchor.y)-Math.abs((b[0]+b[1])/2-anchor.y));
  };
  const bands=bandsFor(center),outerBands=bandsFor(column==='left'?0:1);
  if(!bands.length&&!outerBands.length)throw Object.assign(Error('This module has no clear cable departure. Move the edited socket or enlarge the device.'),{code:'CORE_LAYOUT_CAPACITY',owner:g.sourceId,port:id});
  let left=g.moduleChannel.left,right=g.moduleChannel.right;
  // Management bays project slightly farther into the upper center. Derive
  // the usable rail from every bay along this lead rather than a guessed x.
  const lower=top?0:region.y,upper=top?region.y+region.h:1;
  for(const r of g.panelRegions)if(r.y<upper&&r.y+r.h>lower){
    if(r.x<center)left=Math.max(left,r.x+r.w);else right=Math.min(right,r.x);
  }
  anchor.moduleEscape={owner:g.key,region:region.id,column,channel:[g.x+left*g.w,g.x+right*g.w],
    outer:g.x+(column==='left'?0:g.w),bands,outerBands,peerX:options.peer?.x};
  return anchor;
}
export function getAnchor(g,raw,sideHint,unique,options={}){
  const k=String(raw??''), keys=Object.keys(g.ports);
  let id=keys.find(a=>a.toLowerCase()===k.toLowerCase());
  if(id==null && k && !k.includes('/') && !isNaN(+k)) id=keys.find(a=>a===k);
  if(id==null){
    // An unmatched port on a real front has no known jack coordinates. Give it a perimeter attachment.
    // Another unmatched port on the same side takes the next free slot, so
    // two cables never share one attachment point.
    id='uplink.'+unique;const y=sideHint==='top'?0:1,slot=n=>.14+.72*(n+1)/8,taken=Object.entries(g.ports).filter(([key,p])=>key!==id&&key.startsWith('uplink.')&&p[1]===y).map(([,p])=>p[0]);
    let frac=slot(unique%7);for(let n=0;n<7&&taken.some(x=>Math.abs(x-frac)<1e-6);n++)frac=slot((unique+n+1)%7);
    g.ports[id]=[frac,y];
  }
  const [nx,ny]=g.ports[id];
  const regions=g.panelRegions||[],region=regions.find(r=>nx>=(r.x??0)-1e-8&&nx<=(r.x??0)+(r.w??1)+1e-8&&ny>=r.y-1e-8&&ny<=r.y+r.h+1e-8);
  const socket=g.children.find(c=>c.anchorOrigin&&Math.abs(c.x+c.w/2-nx)<1e-7&&Math.abs(c.y+c.h/2-ny)<1e-7);
  if(g.moduleChannel&&region)return modularAnchor(g,id,nx,ny,region,sideHint,socket,options);
  const top=region?ny<=region.y+region.h/2:ny<=.5;
  const side=top?'top':'bottom',edge=region?(top?region.y:region.y+region.h):(top?0:1);
  const anchor={device:g.key,port:id,x:g.x+nx*g.w,y:g.y+ny*g.h,side,edge:g.y+edge*g.h,weight:options.weight||cableWeight};
  if(region&&regions.length>1){
    const adjacent=regions.filter(r=>r!==region&&(top?r.y+r.h<=region.y+1e-8:r.y>=edge-1e-8));
    if(adjacent.length){
      const other=top?Math.max(...adjacent.map(r=>r.y+r.h)):Math.min(...adjacent.map(r=>r.y));
      anchor.escapeY=g.y+(edge+other)/2*g.h;
      anchor.escapeRange=[g.y+Math.min(edge,other)*g.h,g.y+Math.max(edge,other)*g.h];
    }
  }
  const departure=socketDeparture(g,anchor,socket);
  if(departure)anchor.departure=departure;
  return anchor;
}
export function optic(page,project,device,body,anchor,info){
  if(!info.plug)return anchor;
  const existing=page.items.find(i=>i.kind==='plug'&&i.host?.device===anchor.device&&i.host?.port===anchor.port);
  if(existing)return {...anchor,device:existing.key,port:'cable',x:existing.x+existing.w*existing.ports.cable[0],y:existing.y+existing.h*existing.ports.cable[1]};
  const optics=project.optics||{}, forti=/forti/i.test([device.vendor,device.model].join(' '));
  const selection=info.slot==='sr' && forti ? optics.fg_sr||optics.sr : optics[info.slot];
  const asset=actualAsset(project,typeof selection==='object'&&selection?{stencil:selection}:{stencilId:selection});
  const ratio=asset?asset.width/asset.height:2;
  const bounds=fitRatio(ratio,0,0,Math.max(4,body.w*.028),Math.max(3,body.h*.20));
  const w=bounds.w,h=bounds.h,key='plug-'+page.items.length;
  const assigned=asset?.anchors?.cable;
  const port=Array.isArray(assigned)&&assigned.length===2&&assigned.every(n=>Number.isFinite(n)&&n>=0&&n<=1)?assigned:[.5,.5];
  const g={type:'device',key,sourceId:device.id,name:info.name+' '+(info.plug==='DAC'?'cable end':'optic'),kind:'plug',model:'',x:anchor.x-w/2,y:anchor.y-h/2,w,h,asset,
    masterKey:'plug:'+(asset?.id||(info.plug==='SFP'&&info.slot!=='sr'?'SFP:'+(info.slot||'fiber'):info.plug==='DAC'&&info.name!=='DAC'?'DAC:'+info.name:info.plug)),legacyMasterKey:'plug:'+info.plug,ports:{cable:port},children:[],fallback:!asset};
  if(!asset){
    // The same native geometry is used at the socket and in the module key.
    // Keep the body/socket child indices so existing detail edits still apply.
    const color=cleanLinkStyles(project.layout?.linkStyles)[info.name]?.color||info.color;
    rect(g.children,0,0,1,1,info.plug==='DAC'?'#2D3748':'#D5DBE3',color,1);
    g.children.at(-1).name='Module face';
    if(info.plug==='DAC'){rect(g.children,.2,.4375,.6,.125,'#9AA9C0');g.children.at(-1).name='Cable insert';}
    else for(const [i,x] of [.14,.59].entries()){rect(g.children,x,.25,.27,.5,'#2D3748');g.children.at(-1).name='Optical receptacle '+(i+1);}
  }
  g.host={device:anchor.device,port:anchor.port};
  const master=g.masterKey;editDeviceShape(page,project,g);if(!asset)g.legacyMasterKey+=g.masterKey.slice(master.length);page.items.push(g);return {...anchor,device:g.key,port:'cable',x:g.x+g.w*port[0],y:g.y+g.h*port[1]};
}
export function route(page,from,to,points,color,name,linkType='Link',sourceLink=null,generatedDevice=null){
  const pts=simplifyRoute(points);
  if(pts.length<2)return;
  page.items.push({type:'path',from,to,points:pts,color,name,linkType,sourceLink,generatedDevice,weight:cableWeight});
}
export function bridge(page,{style='single'}={}){
  const routes=page.items.filter(i=>i.type==='path'),segments=[];
  routes.forEach((r,order)=>r.points.slice(1).forEach((b,j)=>{const a=r.points[j];segments.push({r,order,j,a,b,h:a[1]===b[1],marks:[]});}));
  // Every crossing between two cables gets one jump. A cable crossing a
  // bundle of close parallel cables makes the jump (one bridge over all of
  // them); otherwise the later-drawn cable jumps, as before.
  const between=(v,c,d)=>v>Math.min(c,d)&&v<Math.max(c,d),crossings=[];
  for(const hs of segments.filter(s=>s.h))for(const vs of segments.filter(s=>!s.h)){
    if(hs.r===vs.r)continue;const p=[vs.a[0],hs.a[1]];
    if(!between(p[0],hs.a[0],hs.b[0])||!between(p[1],vs.a[1],vs.b[1]))continue;
    const margin=Math.min(Math.abs(p[0]-hs.a[0]),Math.abs(p[0]-hs.b[0]),Math.abs(p[1]-vs.a[1]),Math.abs(p[1]-vs.b[1]));if(margin<=2)continue;
    crossings.push({p,hs,vs,margin});
  }
  const near=(segment,p,axis)=>crossings.filter(c=>(c.hs===segment||c.vs===segment)&&Math.abs(c.p[axis]-p[axis])<30).length;
  for(const c of crossings){
    const along=near(c.hs,c.p,0),across=near(c.vs,c.p,1),owner=along>across?c.hs:across>along?c.vs:c.hs.order>c.vs.order?c.hs:c.vs;
    owner.marks.push({p:c.p,rad:Math.min(Math.max(7,(owner.r.weight||cableWeight)*2+2),c.margin*.40)});
  }
  for(const r of routes){
    r.commands=[['M',...r.points[0]]];r.hops=[];
    for(const segment of segments.filter(s=>s.r===r)){
      const {a,b,h}=segment,axis=h?0:1,dir=Math.sign(b[axis]-a[axis]),marks=segment.marks.sort((m,n)=>dir*(m.p[axis]-n.p[axis]));
      // Single style: one hop per crossed line, made smaller where crossings
      // are close, as Visio draws them. Bundle style: crossings closer than
      // two jumps share one wider bridge.
      const groups=[];
      for(const mark of marks){const last=groups.at(-1);if(style==='bundle'&&last&&Math.abs(mark.p[axis]-last.at(-1).p[axis])<2*Math.max(mark.rad,last.at(-1).rad)+6)last.push(mark);else groups.push([mark]);}
      let end=a[axis];
      for(let k=0;k<groups.length;k++){
        const group=groups[k],first=group[0].p,last=group.at(-1).p,rad=Math.min(...group.map(m=>m.rad)),next=groups[k+1]?.[0].p[axis]??b[axis];
        // A single hop shares the room to each neighboring crossing equally,
        // so a tight bundle still shows one small hop per line.
        const prevMark=k?groups[k-1].at(-1).p[axis]:null,nextMark=groups[k+1]?.[0].p[axis];
        const radius=style==='bundle'?Math.min(rad,Math.abs(first[axis]-end)*.46,Math.abs(next-last[axis])*.46):
          Math.min(rad,prevMark==null?Math.abs(first[axis]-a[axis])*.46:Math.abs(first[axis]-prevMark)/2-.5,nextMark==null?Math.abs(b[axis]-last[axis])*.46:Math.abs(nextMark-last[axis])/2-.5);
        if(radius<1)continue;
        const before=[...first],after=[...last],mid=[...first];before[axis]-=dir*radius;after[axis]+=dir*radius;mid[axis]=(before[axis]+after[axis])/2;mid[1-axis]-=radius;
        r.commands.push(['L',...before],['A',...mid,...after]);r.hops.push({x:Math.min(before[0],mid[0],after[0])-2,y:Math.min(before[1],mid[1],after[1])-2,w:Math.max(before[0],mid[0],after[0])-Math.min(before[0],mid[0],after[0])+4,h:Math.max(before[1],mid[1],after[1])-Math.min(before[1],mid[1],after[1])+4});end=after[axis];
      }
      r.commands.push(['L',...b]);
    }
  }
}
function svgText(i){
  const {lines,size,lineHeight}=textLayout(i),anchor=i.align==='right'?'end':i.align==='center'?'middle':'start',x=round(i.x+(i.align==='right'?i.w:i.align==='center'?i.w/2:0)),y=i.y+(i.h-lines.length*lineHeight)/2+lineHeight/2+size*.34;
  const rotation=i.angle?' transform="rotate('+round(-i.angle*180/Math.PI)+' '+round(i.x+i.w/2)+' '+round(i.y+i.h/2)+')"':'';
  const content=lines.length===1?xml(lines[0]):lines.map((line,n)=>'<tspan x="'+x+'" y="'+round(y+n*lineHeight)+'">'+xml(line)+'</tspan>').join('');
  const background=i.background?'<rect x="'+round(i.x)+'" y="'+round(i.y)+'" width="'+round(i.w)+'" height="'+round(i.h)+'" fill="'+xml(i.background)+'"'+rotation+' pointer-events="none"/>':'';
  return background+'<text'+(i.legendEntry?' class="connection-legend-text" data-link-type="'+xml(i.linkType)+'"':'')+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+rotation+' x="'+x+'" y="'+round(y)+'" text-anchor="'+anchor+'" font-size="'+size+'" font-weight="'+(i.bold?'700':'400')+'" fill="'+i.color+'"><title>'+xml(i.value)+'</title>'+content+'</text>';
}
// Retain one complete path for drawing and hit testing. The jump clearance is
// cut out of other cables only, so device artwork remains visible underneath.
function svgCableGeometry(item){
  let last=null;const hops=[],segments=[],weight=item.weight||cableWeight;
  const bounds=(points,pad)=>{const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {x:Math.min(...xs)-pad,y:Math.min(...ys)-pad,w:Math.max(...xs)-Math.min(...xs)+2*pad,h:Math.max(...ys)-Math.min(...ys)+2*pad};};
  const path=item.commands.map(cmd=>{
    const [t,x,y,ex,ey]=cmd;
    if(t==='A'){
      const dx=ex-last[0],dy=ey-last[1],rx=Math.hypot(dx,dy)/2,ry=Math.hypot(x-(last[0]+ex)/2,y-(last[1]+ey)/2);
      const sweep=dx*(y-last[1])-dy*(x-last[0])<0?1:0,vertical=Math.abs(dy)>Math.abs(dx);
      // SVG radii follow the page axes: a vertical cable's bridge is tall.
      const arc='A '+round(vertical?ry:rx)+' '+round(vertical?rx:ry)+' 0 0 '+sweep+' '+round(ex)+' '+round(ey),points=[last,[x,y],[ex,ey]];
      hops.push({d:'M '+last.map(round).join(' ')+' '+arc,bounds:bounds(points,(weight+3.5)/2)});segments.push(bounds(points,weight/2));last=[ex,ey];return arc;
    }
    if(t==='L'&&last)segments.push(bounds([last,[x,y]],weight/2));last=[x,y];return t+' '+round(x)+' '+round(y);
  }).join(' ');
  return {path,hops,segments,weight};
}
function svgCableMasks(page,geometries){
  const visible=[...geometries].filter(([item])=>(item.opacity??1)>0),hops=visible.flatMap(([item,g])=>g.hops.map(hop=>({...hop,item,weight:g.weight})));
  if(!hops.length)return {defs:'',masks:new Map()};
  // IDs must be stable for cached renders but different for different scenes
  // placed together by Print/PDF or the current/proposed layout comparison.
  let a=2166136261,b=5381;const signature=JSON.stringify([page.originX||0,page.originY||0,page.width||1200,page.height||975,visible.map(([,g])=>[g.path,g.weight])]);
  for(let n=0;n<signature.length;n++){const c=signature.charCodeAt(n);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}
  const prefix='nds-hops-'+(a>>>0).toString(36)+'-'+(b>>>0).toString(36);
  const overlap=(a,b)=>a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y,masks=new Map(),definitions=[];
  hops.forEach((hop,n)=>{hop.id=prefix+'-arc-'+n;definitions.push('<path id="'+hop.id+'" class="link-hop-clearance" d="'+hop.d+'" fill="none" stroke="#000000" stroke-width="'+(hop.weight+3.5)+'" pointer-events="none" aria-hidden="true"/>');});
  visible.forEach(([item,g],n)=>{
    const cutters=hops.filter(hop=>hop.item!==item&&g.segments.some(segment=>overlap(segment,hop.bounds)));if(!cutters.length)return;
    const id=prefix+'-cable-'+n;masks.set(item,id);
    // Bound each mask to its cable, not the full dynamic sheet. This avoids
    // allocating a page-sized masking surface for every crossed connection.
    const x=Math.min(...g.segments.map(s=>s.x))-2,y=Math.min(...g.segments.map(s=>s.y))-2,w=Math.max(...g.segments.map(s=>s.x+s.w))-x+2,h=Math.max(...g.segments.map(s=>s.y+s.h))-y+2,extent=' x="'+round(x)+'" y="'+round(y)+'" width="'+round(w)+'" height="'+round(h)+'"';
    definitions.push('<mask id="'+id+'" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"'+extent+' style="mask-type:luminance"><rect'+extent+' fill="#FFFFFF"/>'+cutters.map(hop=>'<use href="#'+hop.id+'"/>').join('')+'</mask>');
  });
  return {defs:'<defs>'+definitions.join('')+'</defs>',masks};
}
export function svgPage(p){
  const W=p.width||1200,H=p.height||975;
  const geometries=new Map(p.items.filter(i=>i.type==='path').map(i=>[i,svgCableGeometry(i)])),{defs,masks}=svgCableMasks(p,geometries);
  const draw=(i)=>{
    if(i.type==='rect')return '<rect'+(i.legendEntry?' class="diagram-legend-line" data-link-type="'+xml(i.linkType)+'"':'')+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+(i.anchorName?' data-port-name="'+xml(i.anchorName)+'"':'')+' x="'+round(i.x)+'" y="'+round(i.y)+'" width="'+round(i.w)+'" height="'+round(i.h)+'" fill="'+i.fill+'" fill-opacity="'+(i.opacity??1)+'" stroke="'+i.stroke+'" stroke-width="'+i.weight+'"'+(i.name?'><title>'+xml(i.name)+'</title></rect>':'/>');
    if(i.type==='ellipse')return '<ellipse'+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+(i.anchorName?' data-port-name="'+xml(i.anchorName)+'"':'')+' cx="'+round(i.x+i.w/2)+'" cy="'+round(i.y+i.h/2)+'" rx="'+round(i.w/2)+'" ry="'+round(i.h/2)+'" fill="'+i.fill+'" fill-opacity="'+(i.opacity??1)+'" stroke="'+i.stroke+'" stroke-width="'+i.weight+'"'+(i.name?'><title>'+xml(i.name)+'</title></ellipse>':'/>');
    if(i.type==='vector')return '<path'+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+' d="'+i.commands.map(([op,x,y])=>op==='Z'?'Z':op+' '+round(x)+' '+round(y)).join(' ')+'" fill="'+(i.fill||'none')+'" fill-opacity="'+(i.opacity??1)+'" stroke="'+(i.stroke||'none')+'" stroke-width="'+(i.weight||1)+'"'+(i.name?'><title>'+xml(i.name)+'</title></path>':'/>');
    if(i.type==='text')return svgText(i);
    if(i.type==='device'){
      const a=i.asset,child=i.children.map(c=>draw({...c,x:i.x+c.x*i.w,y:i.y+c.y*i.h,w:c.w*i.w,h:c.h*i.h})).join('');
      const artwork=a?.native?a.native.paths.filter(p=>!p.hidden).map((p,n)=>'<path data-drawing-key="'+xml(i.editKey+'|vector|'+n)+'" d="'+p.commands.map(([op,x,y])=>op==='Z'?'Z':op+' '+round(i.x+x*i.w)+' '+round(i.y+y*i.h)).join(' ')+'" fill="'+xml(p.fill)+'" stroke="'+xml(p.stroke)+'" stroke-width="'+round(p.weight*i.w)+'"/>').join('')+a.native.texts.filter(t=>!t.hidden).map((t,n)=>svgText({x:i.x+t.x*i.w-t.w*i.w/2,y:i.y+t.y*i.h-t.size*i.w*.7,w:t.w*i.w,h:t.size*i.w*1.4,size:t.size*i.w,value:t.text,color:t.color,bold:t.bold||false,align:t.align||'center',angle:t.angle,full:true,editKey:i.editKey+'|arttext|'+n})).join(''):a?'<image x="'+round(i.x)+'" y="'+round(i.y)+'" width="'+round(i.w)+'" height="'+round(i.h)+'" href="'+a.dataUrl+'"/>':child;
      return '<g'+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+(i.sourceId?' data-device-id="'+xml(i.sourceId)+'" tabindex="0" role="button" aria-label="Find stencil for '+xml(i.name)+'"':'')+'><title>'+xml(i.name+(i.fallback&&i.kind!=='plug'?' (schematic)':''))+'</title>'+artwork+'</g>';
    }
    const {path,weight}=geometries.get(i)||svgCableGeometry(i),mask=masks.get(i);
    return '<path class="diagram-cable"'+(i.linkType?' data-link-type="'+xml(i.linkType)+'"':'')+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+' d="'+path+'" fill="none" stroke="'+i.color+'" stroke-opacity="'+(i.opacity??1)+'" stroke-width="'+weight+'" stroke-linejoin="round"'+(mask?' mask="url(#'+mask+')"':'')+'><title>'+xml(i.name)+'</title></path>';
  };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(p.originX||0)+' '+(p.originY||0)+' '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="'+xml(p.title)+'" style="font-family:Calibri,Carlito,Arial,sans-serif"><title>'+xml(p.title)+'</title>'+defs+'<rect x="'+(p.originX||0)+'" y="'+(p.originY||0)+'" width="100%" height="100%" fill="#fff"/>'+p.items.map(draw).join('')+'</svg>';
}
