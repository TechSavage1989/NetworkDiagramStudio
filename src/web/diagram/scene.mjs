import {logicalPort} from '../physical-links.mjs';
import {pageGeometry,pageFamily} from '../page-options.mjs';
import {deviceScale} from '../presentation.mjs';
// Geometry is stored in page pixels with a top-left origin. Both exporters consume the same scene.
import {coreSidebar} from './sidebar.mjs';
import {deviceFaceplate} from './faceplate.mjs';
import {editDeviceShape} from '../drawing-edits.mjs';
import {simplifyRoute} from './routing.mjs';
import {linkDefaults,legendStyleId,cleanLinkStyles} from '../link-styles.mjs';
import {wrapPortText} from '../port-table.mjs';
import {connectionMediaInfo} from '../connection-types.mjs';
import {genericDeviceSymbol} from '../device-symbols.mjs';
import {textWidth} from './labels.mjs';
export const W = 1200, H = 975;
export const C = {ink:'#16364A',muted:'#536779',teal:'#166574',rule:'#CEDCE0',pale:'#F0F5F6',white:'#FFFFFF',up:'#D8F0DE',down:'#E2E7EA',amber:'#805400'};
export const xml = s => String(s ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const round = n => Math.round(n*1e5)/1e5;
export const cableWeight = 4;
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
  label(page.items,38,147,side.width,26*s*tf,'CONNECTION TYPES',16*s*tf,true,C.teal);Object.assign(page.items.at(-1),{editKey:scope+'|legend|heading',full:true});let y=147+51*s*tf;
  const rank=name=>({Copper:0,'AP copper':1,'SR fiber':2,DAC:3,'LR fiber':4})[name]??5;
  for(const {name,color,opacity,weight,style,speeds} of values.slice().sort((a,b)=>rank(a.name)-rank(b.name))){const id=legendStyleId(name,color,opacity,!!style)+(weight===cableWeight?'':'|weight|'+weight),title=titleOf({name,style,speeds,opacity}),lines=wrapPortText(title,textSpan,size),description=style?.description?wrapPortText(style.description,textSpan,detailSize):[];
   rect(page.items,38,y+11*s,52*s,weight,color);Object.assign(page.items.at(-1),{opacity,sampleWeight:weight,name:name+' color key',legendEntry:true,linkType:name,editKey:scope+'|legend|'+id+'|swatch'});
   lines.forEach((text,n)=>{label(page.items,textX,y+n*lineHeight,textSpan,lineHeight,text,size,false,C.ink);Object.assign(page.items.at(-1),{legendEntry:true,linkType:name,legendFullText:style?.title||name,editKey:scope+'|legend|'+id+'|text'+(n?'|wrap'+n:''),full:true});});
   description.forEach((text,n)=>{label(page.items,textX,y+lines.length*lineHeight+n*detailHeight,textSpan,detailHeight,text,detailSize,false,C.muted);Object.assign(page.items.at(-1),{legendEntry:true,legendDescription:true,legendFullText:style.description,linkType:name,editKey:scope+'|legend|'+id+'|description'+(n?'|wrap'+n:''),full:true});});y+=Math.max(44*s,lines.length*lineHeight+description.length*detailHeight+12*s);
  }page.legendBottom=y;return;
 }
 const span=(page.width||W)-72,cols=Math.min(values.length<=6?3:6,Math.max(1,Math.floor(span/240))),size=12,width=span/cols-38,rows=[];
 const entriesWithText=values.map(entry=>({...entry,lines:wrapPortText(titleOf(entry),width,size),description:entry.style?.description?wrapPortText(entry.style.description,width,11):[]}));
 for(let i=0;i<entriesWithText.length;i+=cols)rows.push(Math.max(...entriesWithText.slice(i,i+cols).map(e=>Math.max(22,e.lines.length*15+e.description.length*14+5))));
 label(page.items,38,148,(page.width||W)-80,15,'LINK COLORS',11,true,C.muted);Object.assign(page.items.at(-1),{editKey:scope+'|legend|heading',full:true});
 entriesWithText.forEach(({name,color,opacity,weight,style,lines,description},i)=>{const x=38+(i%cols)*span/cols,y=167+rows.slice(0,Math.floor(i/cols)).reduce((a,b)=>a+b,0),id=legendStyleId(name,color,opacity,!!style)+(weight===cableWeight?'':'|weight|'+weight);
  rect(page.items,x,y+6,22,weight,color);Object.assign(page.items.at(-1),{opacity,sampleWeight:weight,name:name+' color key',legendEntry:true,linkType:name,editKey:scope+'|legend|'+id+'|swatch'});
  lines.forEach((text,n)=>{label(page.items,x+30,y+n*15,width,15,text,size,false,C.ink);Object.assign(page.items.at(-1),{legendEntry:true,linkType:name,legendFullText:style?.title||name,editKey:scope+'|legend|'+id+'|text'+(n?'|wrap'+n:''),full:true});});
  description.forEach((text,n)=>{label(page.items,x+30,y+lines.length*15+n*14,width,14,text,11,false,C.muted);Object.assign(page.items.at(-1),{legendEntry:true,legendDescription:true,legendFullText:style.description,linkType:name,editKey:scope+'|legend|'+id+'|description'+(n?'|wrap'+n:''),full:true});});
 });page.legendBottom=167+rows.reduce((a,b)=>a+b,0);
}
export function fresh(name,title,subtitle,project){
  const geometry=pageGeometry(project,pageFamily(name));if(project._reportPrefix)name=project._reportPrefix+'|'+name;
  const p={name,title,...geometry,items:[]}, a=p.items,span=p.width-72,nameWidth=Math.max(180,span-308);
  const projectName=project.name||'Network project',nameHeight=Math.max(23,wrapPortText(projectName,nameWidth,15,true).length*18);
  label(a,36,Math.max(0,39-nameHeight),nameWidth,Math.min(39,nameHeight),projectName,15,true,C.teal);
  label(a,p.width-300,18,264,23,'NETWORK DOCUMENTATION',13,true,C.teal,'right');a.at(-1).pageFrame='brand';
  label(a,36,43,span,48,title,33,true);a.at(-1).pageTitle=true;
  label(a,36,99,span,36,subtitle,16,false,C.muted);
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
  const addAnchor=(k,p)=>{if(Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1))g.ports[String(k)]=[...p];};
  if(asset){
    for(const [k,v] of Object.entries(asset.anchors||{}))addAnchor(k,Array.isArray(v)?v:[v?.x,v?.y]);
  } else if(panel){
    Object.assign(g.ports,panel.ports);g.children=panel.children;g.panelRegions=panel.regions;g.physicalLayout=panel.verified;g.layoutSource=panel.source;
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
  const clearance=3;
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
export function getAnchor(g,raw,sideHint,unique){
  const k=String(raw??''), keys=Object.keys(g.ports);
  let id=keys.find(a=>a.toLowerCase()===k.toLowerCase());
  if(id==null && k && !k.includes('/') && !isNaN(+k)) id=keys.find(a=>a===k);
  if(id==null){
    // An unmatched port on a real front has no known jack coordinates. Give it a perimeter attachment.
    id='uplink.'+unique;const frac=.14+.72*((unique%7)+1)/8;
    g.ports[id]=[frac,sideHint==='top'?0:1];
  }
  const [nx,ny]=g.ports[id];
  const regions=g.panelRegions||[],region=regions.find(r=>ny>=r.y-1e-8&&ny<=r.y+r.h+1e-8);
  const top=region?ny<=region.y+region.h/2:ny<=.5;
  const side=top?'top':'bottom',edge=region?(top?region.y:region.y+region.h):(top?0:1);
  const anchor={device:g.key,port:id,x:g.x+nx*g.w,y:g.y+ny*g.h,side,edge:g.y+edge*g.h};
  if(region&&regions.length>1){
    const adjacent=regions.filter(r=>r!==region&&(top?r.y+r.h<=region.y+1e-8:r.y>=edge-1e-8));
    if(adjacent.length){
      const other=top?Math.max(...adjacent.map(r=>r.y+r.h)):Math.min(...adjacent.map(r=>r.y));
      anchor.escapeY=g.y+(edge+other)/2*g.h;
      anchor.escapeRange=[g.y+Math.min(edge,other)*g.h,g.y+Math.max(edge,other)*g.h];
    }
  }
  const socket=g.children.find(c=>c.anchorOrigin&&Math.abs(c.x+c.w/2-nx)<1e-7&&Math.abs(c.y+c.h/2-ny)<1e-7);
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
export function bridge(page){
  const routes=page.items.filter(i=>i.type==='path'), prior=[];
  for(const r of routes){
    r.commands=[['M',...r.points[0]]];r.hops=[];
    for(let j=1;j<r.points.length;j++){
      const a=r.points[j-1],b=r.points[j],h=a[1]===b[1],axis=h?0:1,dir=Math.sign(b[axis]-a[axis]);
      const marks=[];
      for(const s of prior){
        if(s.h===h)continue;
        const x=h?s.a[0]:a[0],y=h?a[1]:s.a[1],p=[x,y];
        const margin=Math.min(Math.abs(p[axis]-a[axis]),Math.abs(p[axis]-b[axis]),Math.abs(p[1-axis]-s.a[1-axis]),Math.abs(p[1-axis]-s.b[1-axis]));
        const between=(v,c,d)=>v>Math.min(c,d)&&v<Math.max(c,d);
        if(margin>2 && between(p[axis],a[axis],b[axis])&&between(p[1-axis],s.a[1-axis],s.b[1-axis]))marks.push({p,rad:Math.min(Math.max(7,(r.weight||cableWeight)*2+2),margin*.40)});
      }
      marks.sort((m,n)=>dir*(m.p[axis]-n.p[axis]));
      let end=a[axis];
      for(let k=0;k<marks.length;k++){
        const {p,rad}=marks[k],next=marks[k+1]?.p[axis]??b[axis];
        const radius=Math.min(rad,Math.abs(p[axis]-end)*.46,Math.abs(next-p[axis])*.46);if(radius<1)continue;
        const before=[...p],after=[...p],mid=[...p];before[axis]-=dir*radius;after[axis]+=dir*radius;mid[1-axis]-=radius;
        r.commands.push(['L',...before],['A',...mid,...after]);r.hops.push({x:Math.min(before[0],mid[0],after[0])-2,y:Math.min(before[1],mid[1],after[1])-2,w:Math.max(before[0],mid[0],after[0])-Math.min(before[0],mid[0],after[0])+4,h:Math.max(before[1],mid[1],after[1])-Math.min(before[1],mid[1],after[1])+4});end=after[axis];
      }
      r.commands.push(['L',...b]);
    }
    r.points.slice(1).forEach((b,i)=>prior.push({a:r.points[i],b,h:r.points[i][1]===b[1]}));
  }
}
function svgText(i){
  const {lines,size,lineHeight}=textLayout(i),anchor=i.align==='right'?'end':i.align==='center'?'middle':'start',x=round(i.x+(i.align==='right'?i.w:i.align==='center'?i.w/2:0)),y=i.y+(i.h-lines.length*lineHeight)/2+lineHeight/2+size*.34;
  const rotation=i.angle?' transform="rotate('+round(-i.angle*180/Math.PI)+' '+round(i.x+i.w/2)+' '+round(i.y+i.h/2)+')"':'';
  const content=lines.length===1?xml(lines[0]):lines.map((line,n)=>'<tspan x="'+x+'" y="'+round(y+n*lineHeight)+'">'+xml(line)+'</tspan>').join('');
  return '<text'+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+rotation+' x="'+x+'" y="'+round(y)+'" text-anchor="'+anchor+'" font-size="'+size+'" font-weight="'+(i.bold?'700':'400')+'" fill="'+i.color+'"><title>'+xml(i.value)+'</title>'+content+'</text>';
}
export function svgPage(p){
  const W=p.width||1200,H=p.height||975;
  const draw=(i)=>{
    if(i.type==='rect')return '<rect'+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+' x="'+round(i.x)+'" y="'+round(i.y)+'" width="'+round(i.w)+'" height="'+round(i.h)+'" fill="'+i.fill+'" fill-opacity="'+(i.opacity??1)+'" stroke="'+i.stroke+'" stroke-width="'+i.weight+'"'+(i.name?'><title>'+xml(i.name)+'</title></rect>':'/>');
    if(i.type==='text')return svgText(i);
    if(i.type==='device'){
      const a=i.asset,child=i.children.map(c=>draw({...c,x:i.x+c.x*i.w,y:i.y+c.y*i.h,w:c.w*i.w,h:c.h*i.h})).join('');
      const artwork=a?.native?a.native.paths.filter(p=>!p.hidden).map((p,n)=>'<path data-drawing-key="'+xml(i.editKey+'|vector|'+n)+'" d="'+p.commands.map(([op,x,y])=>op==='Z'?'Z':op+' '+round(i.x+x*i.w)+' '+round(i.y+y*i.h)).join(' ')+'" fill="'+xml(p.fill)+'" stroke="'+xml(p.stroke)+'" stroke-width="'+round(p.weight*i.w)+'"/>').join('')+a.native.texts.filter(t=>!t.hidden).map((t,n)=>svgText({x:i.x+t.x*i.w-t.w*i.w/2,y:i.y+t.y*i.h-t.size*i.w*.7,w:t.w*i.w,h:t.size*i.w*1.4,size:t.size*i.w,value:t.text,color:t.color,bold:t.bold||false,align:t.align||'center',angle:t.angle,full:true,editKey:i.editKey+'|arttext|'+n})).join(''):a?'<image x="'+round(i.x)+'" y="'+round(i.y)+'" width="'+round(i.w)+'" height="'+round(i.h)+'" href="'+a.dataUrl+'"/>':child;
      return '<g'+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+(i.sourceId?' data-device-id="'+xml(i.sourceId)+'" tabindex="0" role="button" aria-label="Find stencil for '+xml(i.name)+'"':'')+'><title>'+xml(i.name+(i.fallback&&i.kind!=='plug'?' (schematic)':''))+'</title>'+artwork+'</g>';
    }
    // Convert three-point semicircles to precise SVG arcs.
    let last=null;const hopPaths=[];
    const path=i.commands.map(cmd=>{
      const [t,x,y,ex,ey]=cmd;
      if(t==='A'){
        const dx=ex-last[0],dy=ey-last[1],rad=Math.hypot(dx,dy)/2;
        const sweep=dx*(y-last[1])-dy*(x-last[0])<0?1:0;
        const arc='A '+round(rad)+' '+round(rad)+' 0 0 '+sweep+' '+round(ex)+' '+round(ey);hopPaths.push('M '+last.map(round).join(' ')+' '+arc);last=[ex,ey];return arc;
      }
      last=[x,y];return t+' '+round(x)+' '+round(y);
    }).join(' ');
    return ((i.opacity??1)>0?hopPaths:[]).map(d=>'<path class="link-hop-clearance" d="'+d+'" fill="none" stroke="#FFFFFF" stroke-width="'+((i.weight||cableWeight)+3.5)+'" pointer-events="none" aria-hidden="true"/>').join('')+(i.editKey?'<path class="cable-hit-target" data-drawing-key="'+xml(i.editKey)+'" d="'+path+'" fill="none" stroke="transparent" stroke-width="16" vector-effect="non-scaling-stroke" pointer-events="none" aria-hidden="true"/>':'')+'<path'+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+' d="'+path+'" fill="none" stroke="'+i.color+'" stroke-opacity="'+(i.opacity??1)+'" stroke-width="'+(i.weight||cableWeight)+'" stroke-linejoin="round"><title>'+xml(i.name)+'</title></path>';
  };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(p.originX||0)+' '+(p.originY||0)+' '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="'+xml(p.title)+'" style="font-family:Calibri,Carlito,Arial,sans-serif"><title>'+xml(p.title)+'</title><rect x="'+(p.originX||0)+'" y="'+(p.originY||0)+'" width="100%" height="100%" fill="#fff"/>'+p.items.map(draw).join('')+'</svg>';
}
