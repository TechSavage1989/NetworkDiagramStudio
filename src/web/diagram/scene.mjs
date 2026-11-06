// Geometry is stored in page pixels with a top-left origin. Both exporters consume the same scene.
import {deviceFaceplate} from './faceplate.mjs';
import {editDeviceShape} from '../drawing-edits.mjs';
import {simplifyRoute} from './routing.mjs';
export const W = 1200, H = 920;
export const C = {ink:'#17364A',muted:'#435B6A',teal:'#006775',rule:'#CAD6DB',pale:'#F0F5F6',white:'#FFFFFF',up:'#D8F0DE',down:'#E2E7EA',amber:'#805400'};
export const xml = s => String(s ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const round = n => Math.round(n*1e5)/1e5;
export function rect(box,x,y,w,h,fill,stroke='none',weight=1){box.push({type:'rect',x,y,w,h,fill,stroke,weight});}
export function label(box,x,y,w,h,value,size=15,bold=false,color=C.ink,align='left'){
  box.push({type:'text',x,y,w,h,value:String(value ?? ''),size,bold,color,align});
}
export function short(s,n){return [...String(s??'')].length>n ? [...String(s)].slice(0,n-1).join('')+'…' : String(s??'');}
export const list = x => Array.isArray(x)?x:[];
export const split = (a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,i*n+n));
export function value(v){return Array.isArray(v)?v.map(value).join(', '):v!=null && typeof v!=='object'?String(v):'';}
export function rate(v){
  if(typeof v==='number') return v>=1e9?v/1e9+' Gbps':v>=1e6?v/1e6+' Mbps':String(v);
  return value(v);
}
export function mediaInfo(v,access=false){
  const m=value(v).toLowerCase();
  if(/dac|direct.attach|twinax/.test(m))return {name:'DAC',color:'#000000',plug:'DAC',slot:'dac'};
  if(/10gbase.sr|\bsr\b|short.reach|multi.?mode/.test(m))return {name:'SR fiber',color:'#FF0000',plug:'SFP',slot:'sr'};
  if(/10gbase.lr|\blr\b|long.reach|single.?mode/.test(m))return {name:'LR fiber',color:'#00B0F0',plug:'SFP',slot:'lr'};
  if(/fiber|fibre|optical/.test(m))return {name:'Fiber, reach unspecified',color:'#707A83',plug:'SFP'};
  if(/sfp/.test(m))return {name:'SFP, media unspecified',color:'#707A83'};
  if(/copper|rj.?45|twisted|base.t|cat[5-8]/.test(m))return {name:access?'AP copper':'Copper',color:access?'#00B050':'#FFD965'};
  return {name:'Media unspecified',color:'#707A83'};
}
export function linkLegend(page){
 const defaults=[['SR fiber','#FF0000'],['LR fiber','#00B0F0'],['DAC','#000000'],['Copper','#FFD965'],['AP copper','#00B050'],['Fiber / media unspecified','#707A83']],scope=page.editScope||page.name,entries=new Map();
 for(const path of page.items.filter(i=>i.type==='path')){const name=path.linkType||'Link',color=path.color.toUpperCase(),opacity=path.opacity??1,key=JSON.stringify([name,color,opacity]);if(!entries.has(key))entries.set(key,{name,color,opacity});}
 const values=[...entries.values()].sort((a,b)=>{const rank=n=>defaults.findIndex(([name])=>name===n||name.startsWith('Fiber')&&/unspecified|Fiber/.test(n));return (rank(a.name)<0?9:rank(a.name))-(rank(b.name)<0?9:rank(b.name))||a.color.localeCompare(b.color)||a.opacity-b.opacity;});
 if(!values.length)return;
 const cols=values.length<=6?3:6,rows=Math.ceil(values.length/cols),height=Math.min(22,54/rows),size=Math.min(12,height-3);
 if(size<10)throw Error('This sheet has too many distinct link styles for a legible legend. Split it into additional core pages.');
 label(page.items,38,148,1120,15,'LINK COLORS',11,true,C.muted);Object.assign(page.items.at(-1),{editKey:scope+'|legend|heading',full:true});
 values.forEach(({name,color,opacity},i)=>{const x=38+(i%cols)*1128/cols,y=167+Math.floor(i/cols)*height,canonical=defaults.findIndex(([n,c])=>(n===name||n.startsWith('Fiber')&&/unspecified|Fiber/.test(name))&&c===color&&opacity===1),id=canonical>=0?canonical:'custom|'+name+'|'+color+'|'+opacity;
  rect(page.items,x,y+6,22,3,color);Object.assign(page.items.at(-1),{opacity,name:name+' color key',legendEntry:true,editKey:scope+'|legend|'+id+'|swatch'});
  label(page.items,x+30,y,1128/cols-38,height,name+(opacity<1?' ('+Math.round(opacity*100)+'%)':''),size,false,C.ink);Object.assign(page.items.at(-1),{legendEntry:true,editKey:scope+'|legend|'+id+'|text',full:true});
 });
}
export function fresh(name,title,subtitle,project){
  const p={name,title,width:W,height:H,items:[]}, a=p.items;
  label(a,36,16,900,23,short(project.name||'Network project',90),15,true,C.teal);
  label(a,36,43,1128,48,title,33,true);
  label(a,36,99,1128,24,subtitle,16,false,C.muted);
  rect(a,36,138,1128,2,C.rule);
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
  return portList(d).filter(p=>!['virtual','logical','loopback','aggregate','link aggregation','vlan','softwareloopback','l3ipvlans','tunnel'].includes(String(p.type||'').toLowerCase()) &&
    !/^(?:vlan(?:if|[-. ]?\d)|loopback|lo\d+$|lag[- ]?\d|port-channel|po\d+$|ae\d+$|bridge-aggregation|route-aggregation|eth-trunk|bond\d+|null\d+|bridge[- ]?\d)/i.test(String(p.name)) &&
    !/\.\d+$/.test(String(p.name)));
}
export function state(v){return /^(up|connected|online|active|operational)$/i.test(value(v))?'up':/down|disabled|offline|disconnected|inactive/i.test(value(v))?'down':'unknown';}
export function addDevice(page,project,d,bounds,key,opts={}){
  const asset=actualAsset(project,d), ports=physicalPorts(d), ap=d.kind==='ap',panel=!asset&&!ap?deviceFaceplate(d):null;
  const ratio=asset?+asset.width/+asset.height:panel?.ratio|| (ap?1:d.kind==='unknown'?3:9);
  const g={type:'device',key,sourceId:d.id,instanceKey:opts.instanceKey,name:d.name||d.id,kind:d.kind,model:d.model||'',...fitRatio(ratio,...bounds),asset,
    masterKey:asset?'asset:'+String(asset.id??d.stencilId??d.id):'device:'+d.id,ports:Object.create(null),children:[],fallback:!asset};
  const addAnchor=(k,p)=>{if(Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1))g.ports[String(k)]=[...p];};
  if(asset){
    for(const [k,v] of Object.entries(asset.anchors||{}))addAnchor(k,Array.isArray(v)?v:[v?.x,v?.y]);
  } else if(panel){
    Object.assign(g.ports,panel.ports);g.children=panel.children;g.physicalLayout=panel.verified;g.layoutSource=panel.source;
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
  editDeviceShape(page,project,g);page.items.push(g);
  return g;
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
  return {device:g.key,port:id,x:g.x+nx*g.w,y:g.y+ny*g.h,side:ny<=.5?'top':'bottom',edge:g.y+(ny<=.5?0:g.h)};
}
export function optic(page,project,device,body,anchor,info){
  if(!info.plug)return anchor;
  const existing=page.items.find(i=>i.kind==='plug'&&i.host?.device===anchor.device&&i.host?.port===anchor.port);
  if(existing)return {...anchor,device:existing.key,port:'cable',x:existing.x+existing.w*existing.ports.cable[0],y:existing.y+existing.h*existing.ports.cable[1]};
  const optics=project.optics||{}, forti=/forti/i.test([device.vendor,device.model].join(' '));
  const selection=info.slot==='sr' && forti ? optics.fg_sr||optics.sr : optics[info.slot];
  const asset=actualAsset(project,typeof selection==='object'&&selection?{stencil:selection}:{stencilId:selection});
  const ratio=asset?asset.width/asset.height:1.58;
  const bounds=fitRatio(ratio,0,0,Math.max(4,body.w*.028),Math.max(3,body.h*.20));
  const w=bounds.w,h=bounds.h,key='plug-'+page.items.length;
  const assigned=asset?.anchors?.cable;
  const port=Array.isArray(assigned)&&assigned.length===2&&assigned.every(n=>Number.isFinite(n)&&n>=0&&n<=1)?assigned:[.5,.5];
  const g={type:'device',key,sourceId:device.id,name:info.name+' '+(info.plug==='DAC'?'cable end':'optic'),kind:'plug',model:'',x:anchor.x-w/2,y:anchor.y-h/2,w,h,asset,
    masterKey:'plug:'+(asset?.id||info.plug),ports:{cable:port},children:[],fallback:!asset};
  if(!asset){
    rect(g.children,0,0,1,1,'#CCD4D7','#263D49',.8);
    if(info.plug==='DAC')rect(g.children,.28,.20,.44,.60,'#334753');
    else for(const x of [.11,.55])rect(g.children,x,.20,.34,.60,'#335B70');
  }
  g.host={device:anchor.device,port:anchor.port};
  editDeviceShape(page,project,g);page.items.push(g);return {...anchor,device:g.key,port:'cable',x:g.x+g.w*port[0],y:g.y+g.h*port[1]};
}
export function route(page,from,to,points,color,name,linkType='Link',sourceLink=null,generatedDevice=null){
  const pts=simplifyRoute(points);
  if(pts.length<2)return;
  page.items.push({type:'path',from,to,points:pts,color,name,linkType,sourceLink,generatedDevice,weight:2.2});
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
        if(margin>2 && between(p[axis],a[axis],b[axis])&&between(p[1-axis],s.a[1-axis],s.b[1-axis]))marks.push({p,rad:Math.min(Math.max(7,(r.weight||2.2)*2+2),margin*.40)});
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
  const scale=Math.max(1,i.size*.56), count=Math.max(1,Math.floor(i.w/scale));
  // Keep complete content in the SVG accessibility title and native Visio shape.
  const s=i.full?i.value:short(i.value,count),anchor=i.align==='right'?'end':i.align==='center'?'middle':'start';
  const rotation=i.angle?' transform="rotate('+round(-i.angle*180/Math.PI)+' '+round(i.x+i.w/2)+' '+round(i.y+i.h/2)+')"':'';
  return '<text'+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+rotation+' x="'+round(i.x+(i.align==='right'?i.w:i.align==='center'?i.w/2:0))+'" y="'+round(i.y+i.h/2+i.size*.34)+'" text-anchor="'+anchor+'" font-size="'+i.size+'" font-weight="'+(i.bold?'700':'400')+'" fill="'+i.color+'"><title>'+xml(i.value)+'</title>'+xml(s)+'</text>';
}
export function svgPage(p){
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
    return ((i.opacity??1)>0?hopPaths:[]).map(d=>'<path class="link-hop-clearance" d="'+d+'" fill="none" stroke="#FFFFFF" stroke-width="'+((i.weight||2.2)+3.5)+'" pointer-events="none" aria-hidden="true"/>').join('')+'<path'+(i.editKey?' data-drawing-key="'+xml(i.editKey)+'"':'')+' d="'+path+'" fill="none" stroke="'+i.color+'" stroke-opacity="'+(i.opacity??1)+'" stroke-width="'+i.weight+'" stroke-linejoin="round"><title>'+xml(i.name)+'</title></path>';
  };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="'+xml(p.title)+'" style="font-family:Arial,Helvetica,sans-serif"><title>'+xml(p.title)+'</title><rect width="100%" height="100%" fill="#fff"/>'+p.items.map(draw).join('')+'</svg>';
}
