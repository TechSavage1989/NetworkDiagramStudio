import {cleanLabelBacking} from '../label-backing-settings.mjs';
import {devicePoint,deviceRegionBounds} from './device-geometry.mjs';
import {physicalInventory} from '../physical-links.mjs';
import {cachedDraftPages} from './page-cache.mjs';
import {buildSwitchportReports,sharedReportPalette,aggregateKey,cleanSwitchportSettings,portMapSheets} from '../reports/index.mjs';
import {luminance} from '../reports/palette.mjs';
import {portLabelLayout,portLabelText} from './port-label-layout.mjs';
import {informationPanel,dockInformationPanel} from './information-panel.mjs';
import {presentation,scaleText,scalePage,displayPageName,cleanReportPages,deviceScale} from '../presentation.mjs';
import {applyGlobalTextStyles} from '../global-text-styles.mjs';
import {fitDynamicPage} from './dynamic-page.mjs';
import {deviceModel,deviceDetails,macCaption} from '../device-details.mjs';
import {equipmentPadding,equipmentSize,equipmentViews,equipmentScope,canContinueEquipment} from './equipment-layout.mjs';
import {deviceFaceplate} from './faceplate.mjs';
import {logicalPages} from './logical.mjs';
import {documentationMode,documentationSections,includeTrunkReference,interfaceAddresses,savedReportLayout,logicalInventoryColumns,logicalInventoryName} from './documentation.mjs';
import {corePages} from './core.mjs';
import {buildWirelessPages} from './wireless-layout.mjs';
import {applyDrawingEdits,drawingObjects,deviceEditKey} from '../drawing-edits.mjs';
import {cleanPageNumbers,footerAllowance,pageNumber,pageGeometry,pageFamily,fitColumns,printPageStyles,fitVisiblePage} from '../page-options.mjs';
import {applyLinkStyles} from '../link-styles.mjs';
import {orderedDevices,hopStyle} from '../layout.mjs';
import {comparePorts,hasPortDetails,consecutivePorts,wrapPortText,portColumnPrefix,portRanges,portNumberBox} from '../port-table.mjs';
import {textWidth,intersects} from './labels.mjs';
import {hardwareProfile,portCapability} from '../imports/hardware.mjs';
import {C,addDevice,bridge,fresh,getAnchor,label,linkLegend,list,mediaInfo,optic,physicalPorts,portList,portNumber,rate,rect,route,split,state,svgPage,value,xml} from './scene.mjs';
export {exportVisio,exportStencil} from './visio.mjs';

const cmp=(a,b)=>String(a).localeCompare(String(b),'en',{numeric:true,sensitivity:'base'});
const idOf=v=>String(v&&typeof v==='object'?v.id:v??'');
const nameOf=d=>String(d?.name||d?.id||'Unnamed');
const field=(o,...keys)=>keys.map(k=>value(o?.[k])).find(Boolean)||'';
function inventory(p){
  const devices=new Map(), links=[];
  for(const d of orderedDevices(p))if(d && idOf(d.id) && !devices.has(idOf(d.id)))devices.set(idOf(d.id),d);
  for(const [idx,v] of list(p.links).entries()){
    if(!v||!idOf(v.a)||!idOf(v.b))continue;
    const a=idOf(v.a),b=idOf(v.b);
    for(const id of [a,b])if(!devices.has(id))devices.set(id,{id,name:id,kind:'unknown',ports:[]});
    links.push({...v,a,b,ap:value(v.ap),bp:value(v.bp),idx});
  }
  return {devices,links};
}
function empty(p,msg){rect(p.items,36,168,p.width-72,88,C.pale);label(p.items,57,187,p.width-118,48,msg,18,false,C.muted);}
function caption(p,x,y,w,code,title,details){
  label(p.items,x,y,100,22,code,13,true,C.teal);
  label(p.items,x,y+23,w,23,title,16,true);
  label(p.items,x,y+48,w,21,details,13,false,C.muted);
}
function table(page,cols,rows,start=174){
  const a=page.items;
  rect(a,36,start,page.width-72,32,C.ink);
  let x=36;for(const [title,w] of cols){label(a,x+8,start,w-16,32,title,14,true,C.white);x+=w;}
  rows.forEach((row,i)=>{
    const y=start+32+i*28;rect(a,36,y,page.width-72,28,i%2?C.pale:C.white);let xx=36;
    row.forEach((v,j)=>{const wid=cols[j][1];label(a,xx+8,y,wid-12,28,v,13,j===0);xx+=wid;});
  });
}
function wrappedRows(cols,rows){
  return rows.flatMap(row=>{
    const fields=cols.map((c,k)=>wrapPortText(value(row[k]),c[1]-18,13,k===0));
    return Array.from({length:Math.max(...fields.map(f=>f.length))},(_,l)=>Object.assign(fields.map(f=>f[l]||''),{sourceDeviceId:row.sourceDeviceId}));
  });
}
function tablePages(project,name,subtitle,cols,rows,none){
  const {width,height}=pageGeometry(project,pageFamily(name));cols=fitColumns(cols,width-72);const buckets=split(wrappedRows(cols,rows),Math.max(1,Math.floor((height-280+footerAllowance(project))/28)));
  if(!buckets.length)buckets.push([]);
  return buckets.map(b=>{const p=fresh(name,name,subtitle,project);if(b.length)table(p,cols,b);else empty(p,none);p.sourceDeviceIds=[...new Set(b.map(r=>r.sourceDeviceId).filter(Boolean))];return p;});
}
function vlanSet(raw){
  if(!Array.isArray(raw) || !raw.length || raw.some(v=>!Number.isInteger(Number(v))))return value(raw);
  const ids=[...new Set(raw.map(Number))].sort((a,b)=>a-b),ranges=[];
  for(let i=0;i<ids.length;){
    let j=i;while(j+1<ids.length&&ids[j+1]===ids[j]+1)j++;
    ranges.push(j===i?String(ids[i]):ids[i]+'-'+ids[j]);i=j+1;
  }
  return ranges.join(', ');
}
function uplinkSettings(d,o){
  const lag=value(o.lag).trim().toLowerCase();
  if(!lag)return o;
  const norm=v=>String(v).toLowerCase().replace(/^(?:lag|port-channel|po|ae|bond|bridge-aggregation|route-aggregation|eth-trunk)\s*/,'').trim();
  const leader=portList(d).find(x=>x!==o&&/^(?:lag\s*\d|port-channel|po\d|ae\d|bond|bridge-aggregation|route-aggregation|eth-trunk)/i.test(x.name)&&norm(x.name)===norm(lag));
  if(!leader)return o;
  return {...o,native:value(o.native)?o.native:leader.native,tagged:value(o.tagged)?o.tagged:leader.tagged};
}
function interfaceList(names){
  const parts=names.map(n=>{const m=String(n).match(/^(.*?)(\d+)$/);return m?{prefix:m[1],suffix:+m[2],raw:n}:{prefix:null,raw:n};});
  parts.sort((a,b)=>cmp(a.raw,b.raw));
  const out=[];
  for(let i=0;i<parts.length;){
    let j=i;
    while(j+1<parts.length && parts[i].prefix!==null && parts[j+1].prefix===parts[i].prefix && parts[j+1].suffix===parts[j].suffix+1)j++;
    out.push(j===i?String(parts[i].raw):parts[i].raw+'-'+parts[j].suffix);i=j+1;
  }
  return out.join(', ');
}
const portFills = {ap:'#BCDFCC', profile:'#E2EFE6', uplink:'#BDD9E9', wired:'#EEE1C2', other:'#E5EAED'};
const stateMarks = {up:'#27734E', down:'#5B6871', unknown:'#A26B14'};
const referencePortFills={wired:'#8294B3',ap:'#7FD3AD',profile:'#B9DFCF',uplink:'#B5D5DE',other:'#D8DEE2'};
const portStateFills={up:'#829AA6',down:'#FFFFFF',unknown:'#C1A36E'};

// The faceplate color under a point: the topmost painted body/module rect.
// Imported artwork has no measurable surface, so it keeps the default ink.
function surfaceAt(g,x,y){
 let color=x>=g.x&&x<=g.x+g.w&&y>=g.y&&y<=g.y+g.h?null:'#FFFFFF';
 for(const c of g.children||[]){
  if(c.type!=='rect'||c.socketPart!=null||!/^#[0-9a-f]{6}$/i.test(c.fill||''))continue;
  const bx=g.x+c.x*g.w,by=g.y+c.y*g.h;if(x>=bx&&x<=bx+c.w*g.w&&y>=by&&y<=by+c.h*g.h)color=c.fill;
 }
 return color;
}
const readableOn=color=>color&&luminance(color)<.33?'#FFFFFF':'#111827';
function diamond(items,x,y,size,fill,stroke,weight=.5){items.push({type:'vector',x,y,w:size,h:size,commands:[['M',x+size/2,y],['L',x+size,y+size/2],['L',x+size/2,y+size],['L',x,y+size/2],['Z']],fill,stroke,weight});}
// Port numbers are plain bold text in black or white, whichever reads against
// the faceplate behind them. Role or VLAN color stays on the socket itself.
// Optional marks follow the switchport builder: a dot per tagged VLAN along
// the top of the jack, a diamond for the voice VLAN and the trunk's outline.
const MIN_DOT=1.5;
// Plate labels (module and bay names, model text) are tiny at faceplate
// scale. On a printed port map each grows, after the port numbers and jack
// faces are placed, to the largest size up to 11 px that still fits its own
// box and stays clear of every number, face and other label. It never shrinks.
function readablePlateText(g,obstacles=[],maximum=11){
 const texts=(g.children||[]).filter(c=>c.type==='text'&&c.value&&!c.hidden&&!c.angle&&[c.x,c.y,c.w,c.h].every(Number.isFinite));
 const footprint=(c,size)=>{const box={x:g.x+c.x*g.w,y:g.y+c.y*g.h,w:c.w*g.w,h:c.h*g.h},lines=String(c.value).split('\n'),w=Math.min(box.w,Math.max(...lines.map(line=>textWidth(line,size,!!c.bold)))),h=lines.length*size*1.2;return {x:box.x+(c.align==='right'?box.w-w:c.align==='center'?(box.w-w)/2:0),y:box.y+(box.h-h)/2,w,h};};
 const placed=new Map(texts.map(c=>[c,footprint(c,c.size||5)]));
 for(const c of texts){
  const base=c.size||5,width=c.w*g.w,lines=String(c.value).split('\n'),others=[...placed].filter(([o])=>o!==c).map(([,b])=>b);
  for(let next=maximum;next>base;next-=.5){
   if(lines.some(line=>textWidth(line,next,!!c.bold)>width))continue;
   const box=footprint(c,next);if([...obstacles,...others].some(o=>intersects(box,o,.5)))continue;
   c.size=next;placed.set(c,box);break;
  }
 }
}
// Jack faces take the switchport builder's shapes: copper 25.2 x 23.2 and
// optical 25.2 x 16.2. Copper jacks share one width, as large as the plate
// allows, then optical cages share theirs around the copper faces (optical
// modules usually have more room, and the extra width holds more dots). A face
// keeps the edge beside its port number and grows away from it, so rows meet
// edge to edge; faces stay inside their own module, never cover a number and
// always cover the jack artwork. A group that cannot take the builder shape
// keeps its jack's proportions and grows uniformly instead.
const FACE_HEIGHT={copper:23.2/25.2,optical:16.2/25.2};
function faceBoxes(g,entries,limit=2.6){
 const faces=entries.filter(e=>e.socket),result=new Map();if(!faces.length)return result;
 const copper=e=>/rj|copper|base-?t/i.test(String(e.socket.form||'RJ45')),ratio=e=>copper(e)?FACE_HEIGHT.copper:FACE_HEIGHT.optical,eps=1e-6;
 const over=(a,b)=>a.x<b.x+b.w-eps&&b.x<a.x+a.w-eps&&a.y<b.y+b.h-eps&&b.y<a.y+a.h-eps,within=(b,r)=>b.x>=r.x-eps&&b.y>=r.y-eps&&b.x+b.w<=r.x+r.w+eps&&b.y+b.h<=r.y+r.h+eps;
 const numbers=entries.map(e=>e.number).filter(Boolean),bound=e=>e.region&&within(e.socket,e.region)?e.region:g;
 const shaped=(e,w)=>{const s=e.socket,h=w*ratio(e),side=e.number?.side;return {x:s.x+s.w/2-w/2,y:side==='above'?s.y:side==='below'?s.y+s.h-h:s.y+s.h/2-h/2,w,h};};
 const scaled=(e,k)=>{const s=e.socket;return {x:s.x+s.w/2-s.w*k/2,y:s.y+s.h/2-s.h*k/2,w:s.w*k,h:s.h*k};};
 const fits=(group,make,v,obstacles)=>{const boxes=group.map(e=>make(e,v));return boxes.every((b,i)=>within(b,bound(group[i]))&&!numbers.some(n=>over(b,n))&&!obstacles.some(o=>over(b,o))&&boxes.every((o,j)=>j<=i||!over(b,o)));};
 const grow=(group,make,low,high,obstacles)=>{if(!(high>=low)||!fits(group,make,low,obstacles))return null;if(fits(group,make,high,obstacles))return high;let lo=low,hi=high;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(fits(group,make,mid,obstacles))lo=mid;else hi=mid;}return lo;};
 const span=group=>[Math.max(...group.map(e=>Math.max(e.socket.w,e.socket.h/ratio(e)))),limit*Math.max(...group.map(e=>e.socket.w))];
 const groups=[faces.filter(copper),faces.filter(e=>!copper(e))].filter(group=>group.length),placed=[];
 for(const [index,group] of groups.entries()){
  const obstacles=[...placed,...groups.slice(index+1).flat().map(e=>e.socket)];let make=shaped,v=grow(group,shaped,...span(group),obstacles);
  if(v==null){make=scaled;v=grow(group,scaled,1,limit,obstacles)??1;}
  for(const e of group){const box=make(e,v);result.set(e,box);placed.push(box);}
 }
 return result;
}
function portNumbers(items,g,ports,{fill=()=>C.pale,selected=null,stateKey=false,marks=null,fontScale=null,format=null,unconfiguredFill=null}={}){
 const firstItem=items.length;
 const size=10*(fontScale??1),minimum=8*(fontScale??1),formatting=format?{format}:{};
 let layout=portLabelLayout(g,ports,{fontSize:size,minFontSize:minimum,minWidth:0,measureRequired:false,...formatting});
 if(!layout.readable)layout=portLabelLayout(g,ports,{fontSize:size,minFontSize:minimum,minWidth:0,vertical:true,...formatting});
 if(!layout.readable){const alternatives=[false,true].map(vertical=>portLabelLayout(g,ports,{fontSize:minimum,minFontSize:minimum,minWidth:0,vertical})),required=alternatives.map(v=>v.requiredWidth).filter(Number.isFinite);throw Object.assign(Error('This port map needs a wider device to keep the port numbers readable. Use a wider page or the Switchport report layout.'),{code:'PORT_LABEL_CAPACITY',requiredWidth:required.length?Math.min(...required):null,sourceId:g.sourceId});}
 // Port maps with VLAN marks give every jack face on the plate the builder's shape.
 const faces=marks?faceBoxes(g,layout.entries):null;
 for(const entry of layout.entries){
  const {port,text,number:box,content:inner,editKey:key,socket}=entry,shape=faces?.get(entry);
  const face=socket&&shape&&(Math.abs(shape.w-socket.w)>1e-6||Math.abs(shape.h-socket.h)>1e-6||Math.abs(shape.y-socket.y)>1e-6)?shape:null;
  const kx=face?face.w/socket.w:1,ky=face?face.h/socket.h:1,content=face&&inner?{x:face.x+(inner.x-socket.x)*kx,y:face.y+(inner.y-socket.y)*ky,w:inner.w*kx,h:inner.h*ky}:inner;const active=selected?.has(port.name.toLowerCase()),color=port.unconfigured?unconfiguredFill:selected?(active?referencePortFills.ap:null):fill(port),metadata={portName:port.name,sourceId:g.sourceId},mark=port.unconfigured?null:marks?.(port);
  // An enlarged face keeps the jack look: a dark frame around the fill.
  (layout.faces||=[]).push(face||socket);
  if(face){rect(items,face.x,face.y,face.w,face.h,'#2B3440','#1B222B',.6);Object.assign(items.at(-1),{portName:port.name,sourceId:g.sourceId,editKey:key+'|socket-face',portNumberRole:'face'});}
  if(content&&color){const outline=mark?.lag;rect(items,content.x,content.y,content.w,content.h,mark?.stack?'#111827':color,outline||'none',outline?Math.max(1.2,Math.min(2,content.w*.12)):0);Object.assign(items.at(-1),{...metadata,editKey:key+'|socket-fill',portNumberRole:'socket'});}
  if(content&&mark&&!mark.stack){
   // Every tagged VLAN gets a dot, as in the switchport builder: rows fill the
   // jack face from the top, shrinking the dots until all of them fit and
   // leaving room for the voice diamond.
   const reserve=mark.voice?Math.max(2.5,Math.min(6,content.h*.42,content.w*.42))+Math.min(2.5,content.h/4)+.5:0;
   // Dots never shrink below the builder's smallest readable marker. When a
   // jack still cannot hold them, the sheet asks for wider hardware; until it
   // gets it, the last spot shows a 'more' marker and the full set is listed.
   const grid=(r,f=1)=>{const w=content.w*f,h=content.h*f,step=r*2+.6,per=Math.max(1,Math.floor((w-1)/step)),rows=Math.max(1,Math.floor((h-reserve*f-1-r*2)/step)+1);return {r,step,per,rows};};
   let fit=null;for(let r=Math.max(MIN_DOT,Math.min(2,content.w*.09));r>=MIN_DOT-1e-9&&!fit;r-=.05){const g=grid(r);if(g.per*g.rows>=mark.tagged.length)fit=g;}
   if(!fit){
    let f=1.05;while(f<4){const g=grid(MIN_DOT,f);if(g.per*g.rows>=mark.tagged.length)break;f+=.05;}
    layout.markWidth=Math.max(layout.markWidth||0,g.w*f);layout.overflow=[...(layout.overflow||[]),{port,tagged:mark.tagged.map(dot=>dot.id)}];
   }
   const {r,step,per}=fit||grid(MIN_DOT),capacity=fit?mark.tagged.length:Math.max(1,per*grid(MIN_DOT).rows-1),dots=mark.tagged.slice(0,capacity),more=fit?0:mark.tagged.length-dots.length;
   [...dots,...(more?[{more:true}]:[])].forEach((dot,i,all)=>{const row=Math.floor(i/per),n=Math.min(per,all.length-row*per),x0=content.x+content.w/2-n*step/2+step/2,x=x0+(i%per)*step-r,y=content.y+1+row*step;
    if(dot.more){items.push({type:'ellipse',x,y,w:r*2,h:r*2,fill:'#111827',stroke:'#FFFFFF',weight:.3,...metadata,editKey:key+'|vlan-more',portNumberRole:'tagged-more',moreCount:more});rect(items,x+r*.45,y+r-.2,r*1.1,.4,'#FFFFFF');Object.assign(items.at(-1),{...metadata,editKey:key+'|vlan-more|h',portNumberRole:'tagged-more'});rect(items,x+r-.2,y+r*.45,.4,r*1.1,'#FFFFFF');Object.assign(items.at(-1),{...metadata,editKey:key+'|vlan-more|v',portNumberRole:'tagged-more'});return;}
    items.push({type:'ellipse',x,y,w:r*2,h:r*2,fill:dot.color,stroke:'#374151',weight:Math.min(.3,r*.3),...metadata,editKey:key+'|vlan|'+dot.id,portNumberRole:'tagged'});});
   if(mark.voice){const size=Math.max(2.5,Math.min(6,content.h*.42,content.w*.42));diamond(items,content.x+(content.w-size)/2,content.y+content.h-size-Math.min(2.5,content.h/4),size,mark.voice,'#374151',.35);Object.assign(items.at(-1),{...metadata,editKey:key+'|voice',portNumberRole:'voice'});}
  }
  if(stateKey&&content&&!port.unconfigured){rect(items,content.x,content.y+content.h-Math.min(2,content.h/3),content.w,Math.min(2,content.h/3),portStateFills[state(port.state)]);Object.assign(items.at(-1),{...metadata,editKey:key+'|state',portNumberRole:'state'});}
  const textBox=box.vertical?{x:box.x+(box.w-box.h)/2,y:box.y+(box.h-box.w)/2,w:box.h,h:box.w}:box;
  label(items,textBox.x,textBox.y,textBox.w,textBox.h,text,box.size,true,readableOn(surfaceAt(g,box.x+box.w/2,box.y+box.h/2)),'center');Object.assign(items.at(-1),{...metadata,editKey:key+'|text',portNumberRole:'text',numberSide:box.side,numberBox:{x:box.x,y:box.y,w:box.w,h:box.h},socketBounds:socket,full:true,...(fontScale!=null?{_textFactor:fontScale}:{}),...(box.vertical?{angle:Math.PI/2}:{})});
 }
 if(g.angle)for(const item of items.slice(firstItem)){
  if(item.type==='vector'){item.commands=item.commands.map(([op,x,y])=>op==='Z'?['Z']:[op,...devicePoint(g,(x-g.x)/g.w,(y-g.y)/g.h)]);}
  else {const [cx,cy]=devicePoint(g,(item.x+item.w/2-g.x)/g.w,(item.y+item.h/2-g.y)/g.h);item.x=cx-item.w/2;item.y=cy-item.h/2;item.angle=(item.angle||0)+g.angle;}
  for(const key of ['socketBounds','numberBox'])if(item[key]){const b=item[key];item[key]=deviceRegionBounds(g,{x:(b.x-g.x)/g.w,y:(b.y-g.y)/g.h,w:b.w/g.w,h:b.h/g.h});}
 }
 return layout;
}
// One VLAN/LAG color per identity on every sheet, shared with the Switchport
// reports palette (CIELAB-separated soft fills, contrasting LAG outlines).
const FALLBACK_VLANS=['#CDEBAD','#B7DFEF','#F6D3A0','#E6C9F3','#F4BBC0','#BDE8D9','#DBD5A8','#D0D5F7','#FFC1A5','#A6DFE0','#E4D1B9','#F7BFE9','#C8DCA5','#C3CCED','#F6E4A2','#E3C8CC'];
const FALLBACK_LAGS=['#2B6CB0','#2F855A','#D53F8C','#2C7A7B','#975A16','#C05621','#6B46C1','#C53030'];
// As in the switchport builder: white means the configuration removes the
// native VLAN; gray means no native VLAN was supplied for the port.
const NATIVE_NOT_SUPPLIED='#E6E6E6',noNative=port=>port.nativeState==='None'||!!port.nativeTagged;
function portMapPalette(project,db){
 const vlanId=v=>{const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=4094?n:null;},switches=[...db.devices.values()].filter(d=>d.kind==='switch');
 const items=switches.map(d=>({id:d.id,inventory:{blockers:[],vlans:(d.vlans||[]).map(v=>({id:vlanId(v.id),name:String(v.name||''),voice:!!v.voice})).filter(v=>v.id),
  ports:physicalPorts(d).map(p=>({untaggedVlan:vlanId(p.native),untaggedState:vlanId(p.native)?'':'None',taggedVlans:(p.tagged||[]).map(vlanId).filter(Boolean),voiceVlan:vlanId(p.voice),aggregate:p.lag?String(p.lag):''}))}}));
 let shared=null;try{shared=sharedReportPalette(items,cleanSwitchportSettings(project.layout?.switchport).palette);}catch{shared=null;}
 const ids=[...new Set(items.flatMap(item=>[...item.inventory.vlans.map(v=>v.id),...item.inventory.ports.flatMap(p=>[p.untaggedVlan,...p.taggedVlans,p.voiceVlan])]).filter(Boolean))].sort((a,b)=>a-b);
 const lags=[...new Set(items.flatMap(item=>item.inventory.ports.map(p=>aggregateKey(p.aggregate)).filter(Boolean)))].sort();
 const vlans=shared?.vlans||Object.fromEntries(ids.map((id,i)=>[id,id===1?'#9FAAB5':FALLBACK_VLANS[i%FALLBACK_VLANS.length]])),aggregates=shared?.aggregates||Object.fromEntries(lags.map((key,i)=>[key,FALLBACK_LAGS[i%FALLBACK_LAGS.length]]));
 const vlan=id=>vlans[vlanId(id)]||'#CBD5E1',lag=key=>key?aggregates[aggregateKey(key)]||FALLBACK_LAGS[0]:null;
 const native=port=>vlanId(port.native)?vlan(port.native):noNative(port)?'#FFFFFF':NATIVE_NOT_SUPPLIED;
 const marks=port=>{const n=vlanId(port.native),voice=vlanId(port.voice);return {tagged:(port.tagged||[]).map(vlanId).filter(id=>id&&id!==n&&id!==voice).map(id=>({id,color:vlan(id)})),voice:voice?vlan(voice):null,lag:lag(port.lag),stack:false};};
 return {vlan,lag,native,marks};
}

function portAssignments(project,db,device,ports){
  const key=name=>String(name).trim().toLowerCase();
  const peers=new Map(), outside=new Set();
  for(const [id,port] of list(project.excludedPeerPorts))if(id===device.id)outside.add(key(port));
  for(const link of db.links){
    for(const [id,port,remote,remotePort] of [[link.a,link.ap,link.b,link.bp],[link.b,link.bp,link.a,link.ap]]){
      if(id!==device.id)continue;
      const ids=peers.get(key(port))||new Map();
      ids.set(JSON.stringify([remote,key(remotePort)]),{id:remote,kind:db.devices.get(remote)?.kind,status:link.status});
      peers.set(key(port),ids);
    }
  }
  const special=p=>p.lag||p.handoff||p.sdwanMember||/^(uplink|handoff|wan)$/i.test(p.role||'')||
    /\b(uplink|handoff|backbone)\b/i.test(p.description||'');
  const profileKey=p=>{
    if(special(p)||p.role!=='trunk'||!Number.isInteger(Number(p.native))||Number(p.native)<1||
        !Array.isArray(p.tagged)||!p.tagged.length||p.tagged.some(v=>!Number.isInteger(Number(v))))return '';
    return JSON.stringify([Number(p.native),vlanSet(p.tagged),!!p.nativeTagged,value(p.voice),vlanSet(p.allowedExcept)]);
  };
  const roles=new Map(), apProfiles=new Map();
  for(const p of ports){
    const id=key(p.name),records=peers.get(id);
    if(outside.has(id)){roles.set(id,[records?.size?'Peer needs review':'Peer outside scope','other']);continue;}
    if(!records?.size)continue;
    const [peer]=records.values();
    if(records.size!==1 || state(p.state)==='down' || /conflict|unverified|inferred/i.test(peer.status||'')){
      roles.set(id,['Peer needs review','other']);
    }else if(peer.kind==='ap'){
      roles.set(id,['AP peer','ap']);
      const signature=profileKey(p);
      if(signature){
        if(!apProfiles.has(signature))apProfiles.set(signature,new Set());
        apProfiles.get(signature).add(peer.id);
      }
    }else if(peer.kind==='switch'||peer.kind==='firewall'||peer.kind==='handoff'){
      roles.set(id,[peer.kind==='switch'?'Switch uplink':peer.kind==='firewall'?'Firewall uplink':'Handoff','uplink']);
    }else{
      roles.set(id,['Other wired peer','wired']);
    }
  }
  for(const p of ports){
    const id=key(p.name);if(roles.has(id))continue;
    if(p.lag)roles.set(id,['LAG '+p.lag+' member','uplink']);
    else if(special(p))roles.set(id,[p.handoff||p.role==='handoff'?'Handoff':'Labeled uplink','uplink']);
    else if(apProfiles.get(profileKey(p))?.size>=2)roles.set(id,['Matches AP profile','profile']);
    else if(p.role==='ap')roles.set(id,['Configured AP port','profile']);
    else if(['access','wired','voice'].includes(p.role))roles.set(id,['Wired access','wired']);
    else roles.set(id,['No peer reported','other']);
  }
  return p=>roles.get(key(p.name));
}

function referencePortLegend(page,top,roles){
 const a=page.items,scope=page.editScope,definitions=[['wired','Wired data / voice'],['ap','Wireless AP'],['profile','AP profile'],['uplink','Backbone / uplink'],['other','Other / unassigned']],used=definitions.filter(([role])=>roles.has(role)),cols=Math.max(1,Math.min(used.length,Math.floor((page.width-200)/185))),width=(page.width-200)/cols;
 label(a,38,top,115,24,'PORT ROLES',12,true,C.teal);a.at(-1).editKey=scope+'|port-legend|roles';
 used.forEach(([role,title],i)=>{const x=160+i%cols*width,y=top+Math.floor(i/cols)*30;rect(a,x,y+3,22,19,referencePortFills[role],'#617480',.6);a.at(-1).editKey=scope+'|port-legend|'+role+'|box';label(a,x+32,y,width-38,24,title,13,false,C.ink);Object.assign(a.at(-1),{editKey:scope+'|port-legend|'+role+'|text',full:true});});
 const stateY=top+Math.max(1,Math.ceil(used.length/cols))*30+4;
 label(a,38,stateY,115,23,'LINK STATE',12,true,C.teal);a.at(-1).editKey=scope+'|port-legend|state';
 for(const [i,title,color] of [[0,'Up','#829AA6'],[1,'Down',C.white],[2,'Unknown','#C1A36E']]){const x=160+i*Math.min(240,(page.width-200)/3);rect(a,x,stateY+3,22,17,color,'#617480',.6);a.at(-1).editKey=scope+'|port-legend|state|'+title+'|box';label(a,x+32,stateY-1,Math.min(180,(page.width-200)/3-38),24,title,13,false,C.ink);a.at(-1).editKey=scope+'|port-legend|state|'+title+'|text';}
 return stateY+31;
}
function portPanelCaption(project,d,ports,width){
 const half=(width-82)/2,up=ports.filter(port=>state(port.state)==='up').length,summary=[deviceDetails(d,project),up+' of '+ports.length+' ports up'].filter(Boolean).join(' | ');
 let titleSize=21,titleLines=wrapPortText(nameOf(d),half-23,titleSize,true);while(titleLines.length>2&&titleSize>15)titleLines=wrapPortText(nameOf(d),half-23,--titleSize,true);
 const titleLineHeight=titleSize*1.15,summaryLines=wrapPortText(summary,half,13),textHeight=Math.max(titleLines.length*titleLineHeight,summaryLines.length*16);
 return {half,titleLines,titleSize,titleLineHeight,summaryLines,textHeight};
}
function portEquipmentPlan(project,switches,requestedWidth){
 const {width:W,height:H}=pageGeometry(project,'ports'),span=W-82,budget=Math.max(120,H-420),indivisible=switches.filter(d=>!canContinueEquipment(project,d));
 // Prefer room for details beside the overview. A bounded common reduction is
 // shared by every device, including devices on continuation sheets.
 const ideal=Math.min(span,...indivisible.map(d=>span*Math.max(100,H-575)/(equipmentSize(project,d,span).h/deviceScale(project,d))));
 const hard=Math.min(span,...indivisible.map(d=>span*Math.max(80,H-229-portPanelCaption(project,d,physicalPorts(d),W).textHeight)/(equipmentSize(project,d,span).h/deviceScale(project,d))));
 const width=requestedWidth??Math.min(hard,Math.max(span*.78,ideal)),views=switches.flatMap(d=>equipmentViews(project,d,width,Math.max(80,budget-portPanelCaption(project,d,physicalPorts(d),W).textHeight-34))),groups=[];let group=[],used=0;
 for(const d of views){const height=equipmentSize(project,d,width).h+portPanelCaption(project,d,physicalPorts(d),W).textHeight+26;
  if(group.length&&(group.length===2||group.some(v=>v.id===d.id)||used+height>budget)){groups.push(group);group=[];used=0;}group.push(d);used+=height;
 }if(group.length)groups.push(group);return {width,views,groups};
}
// Switchport-builder sheet sections: a light section bar, then compact rows.
function sectionBar(items,x,y,w,title,key){rect(items,x,y,w,20,'#E3ECF5','#C4D3E3',.75);items.at(-1).editKey=key+'|bar';label(items,x+8,y+1,w-16,18,title,12,true,'#1B3A4B');Object.assign(items.at(-1),{editKey:key+'|title',full:true});return y+26;}
// Port inventory sheets follow the switchport builder: a dark device bar,
// then every port record in one table. Ports with identical configuration
// share a row (port count in brackets); live state and peers stay per port.
// Builder port-map sheet (Configuration Inspector / Switchport Diagram Builder
// layout): one device per sheet under a dark header block, each stack member
// under its own slim bar, the VLAN key down the right, trunks and port
// descriptions beside or under the hardware, and a symbol key at the foot.
const memberOf=name=>String(name).match(/^(?:(?:GigabitEthernet|TenGigabitEthernet|Gi|Te|TwentyFiveGigE|HundredGigE|Ethernet|Eth))?(\d+)\//i)?.[1];
function socketSummary(view){
 const counts=new Map();
 for(const s of deviceFaceplate(view,{padding:equipmentPadding})?.sockets||[]){if(s.primary===false)continue;const form=String(s.form||'Port').replace(/^RJ45$/,'RJ-45');counts.set(form,(counts.get(form)||0)+1);}
 return [...counts].sort((a,b)=>b[1]-a[1]).map(([form,n])=>n+' '+form).join(' + ');
}
function keySections(devices,palette,{lags=true,descriptions=true,names=devices,unsupplied=false,overflow=[]}={}){
 const vlans=new Map(),voices=new Set(),sections=[];
 for(const device of devices)for(const port of physicalPorts(device)){for(const id of [port.native,...(port.tagged||[]),port.voice]){const n=Number(id);if(Number.isInteger(n)&&n>0&&!vlans.has(n))vlans.set(n,[...devices,...names].map(d=>d.vlans?.find(v=>Number(v.id)===n)?.name).find(Boolean)||'');}if(Number(port.voice)>0)voices.add(Number(port.voice));}
 sections.push({key:'vlans',title:'VLAN key',width:220,entries:[...[...vlans].sort(([a],[b])=>a-b).map(([id,name])=>({key:'vlan:'+id,indent:40,text:id+(name?'  '+name:'')+(voices.has(id)?' (voice)':''),paint:(items,x,y,key)=>{const color=palette.vlan(id);rect(items,x,y+3,14,13,color,'#5B6B82',.6);items.at(-1).editKey=key+'|swatch';items.push({type:'ellipse',x:x+19,y:y+6,w:7,h:7,fill:color,stroke:'#374151',weight:.35,editKey:key+'|dot'});if(voices.has(id)){diamond(items,x+29,y+5,9,color,'#374151',.35);items.at(-1).editKey=key+'|voice';}}})),
  ...(devices.some(d=>physicalPorts(d).some(p=>!(Number(p.native)>0)&&!noNative(p)))||unsupplied?[{key:'unsupplied',indent:40,text:'Native not supplied',paint:(items,x,y,key)=>{rect(items,x,y+3,14,13,NATIVE_NOT_SUPPLIED,'#5B6B82',.6);items.at(-1).editKey=key+'|swatch';}}]:[]),
  ...(devices.some(d=>physicalPorts(d).some(p=>!(Number(p.native)>0)&&noNative(p)))?[{key:'none',indent:40,text:'No native VLAN',paint:(items,x,y,key)=>{rect(items,x,y+3,14,13,'#FFFFFF','#5B6B82',.6);items.at(-1).editKey=key+'|swatch';}}]:[])]});
 const lagMembers=new Map();
 for(const device of devices)for(const port of physicalPorts(device).sort(comparePorts))if(port.lag){const key=String(port.lag);if(!lagMembers.has(key))lagMembers.set(key,[]);lagMembers.get(key).push({device,name:port.name});}
 if(lags&&lagMembers.size)sections.push({key:'lags',title:'Trunks / LAGs',width:300,entries:[...lagMembers].map(([lag,members])=>({key:'lag:'+lag,indent:36,text:(/^\d+$/.test(lag)?'LAG '+lag:lag.replace(/^trk/i,'Trk'))+': '+devices.map(d=>{const names=members.filter(m=>m.device===d).map(m=>m.name);return names.length?(devices.length>1?nameOf(d)+' ':'')+portRanges(names,portColumnPrefix(physicalPorts(d).map(p=>p.name))):'';}).filter(Boolean).join('; '),paint:(items,x,y,key)=>{rect(items,x,y+3,26,13,'#FFFFFF',palette.lag(lag),2);items.at(-1).editKey=key+'|swatch';}}))});
 // Jacks showing a '+' marker list their complete tagged VLAN set here.
 if(overflow.length){const groups=new Map();for(const {port,tagged} of overflow){const ids=[...new Set(tagged)].sort((a,b)=>a-b),key=ids.join(',');if(!groups.has(key))groups.set(key,{ids,names:[]});groups.get(key).names.push(port.name);}
  const ranges=ids=>{const out=[];for(let i=0;i<ids.length;){let j=i;while(j+1<ids.length&&ids[j+1]===ids[j]+1)j++;out.push(j>i+1?ids[i]+'-'+ids[j]:j===i+1?ids[i]+', '+ids[j]:String(ids[i]));i=j+1;}return out.join(', ');};
  sections.push({key:'tagged-overflow',title:'Tagged VLANs (+ on the jack)',width:320,entries:[...groups.values()].map(({ids,names},i)=>({key:'tagged-overflow:'+i,indent:0,text:(devices.length>1?nameOf(devices[0])+' ':'')+portRanges(names,portColumnPrefix(physicalPorts(devices[0]).map(p=>p.name)))+': '+ranges(ids)}))});}
 const notes=new Map();
 for(const device of devices)for(const port of physicalPorts(device).sort(comparePorts)){const text=String(port.description||'').trim();if(!text)continue;const key=JSON.stringify([device.id,text]);if(!notes.has(key))notes.set(key,{device,text,names:[]});notes.get(key).names.push(port.name);}
 if(descriptions&&notes.size)sections.push({key:'descriptions',title:'Port descriptions',width:320,entries:[...notes.values()].map(({device,text,names},i)=>({key:'description:'+i,indent:0,text:(devices.length>1?nameOf(device)+' ':'')+portRanges(names,portColumnPrefix(physicalPorts(device).map(p=>p.name)))+': '+text}))});
 return sections;
}
// Lays out sections in a box; draw=false only measures. Returns the bottom.
function drawSections(items,sections,x,y,width,scope,draw=true,columns=null){
 for(const section of sections){
  if(draw)sectionBar(items,x,y,width,section.title,scope+'|key|'+section.key);y+=26;
  const cols=columns??Math.max(1,Math.floor(width/section.width)),cell=width/cols;
  for(let i=0;i<section.entries.length;i+=cols){
   const row=section.entries.slice(i,i+cols).map(entry=>({...entry,lines:wrapPortText(entry.text,cell-entry.indent-6,12)})),height=Math.max(20,...row.map(entry=>entry.lines.length*15+5));
   if(draw)row.forEach((entry,column)=>{const cx=x+column*cell,key=scope+'|key|'+entry.key;entry.paint?.(items,cx,y,key);entry.lines.forEach((line,n)=>{label(items,cx+entry.indent,y+n*15,cell-entry.indent-6,17,line,12,false,C.ink);Object.assign(items.at(-1),{editKey:key+'|line:'+n,full:true});});});
   y+=height;
  }
  y+=8;
 }
 return y;
}
function builderFooter(page,palette,scope,sheet,sampleVlan){
 const a=page.items,H=page.height,W=page.width,sample=sampleVlan?palette.vlan(sampleVlan):'#CDEBAD',outline=palette.lag('1');let x=38,y=H-98;
 const symbol=(title,paint)=>{const width=textWidth(title,12)+46;if(x>38&&x+width>W-38){x=38;y+=20;}paint(x);label(a,x+22,y,textWidth(title,12)+4,18,title,12,false,C.ink);Object.assign(a.at(-1),{editKey:scope+'|legend|'+title,full:true});x+=width;};
 symbol('Native VLAN',x=>{rect(a,x,y+3,14,12,sample,'#5B6B82',.6);});
 symbol('Tagged VLAN',x=>{a.push({type:'ellipse',x:x+3,y:y+5,w:8,h:8,fill:sample,stroke:'#374151',weight:.35});});
 symbol('Voice VLAN',x=>{diamond(a,x+2,y+4,10,'#E8705F','#374151',.35);});
 symbol('LAG / trunk',x=>{rect(a,x,y+3,14,12,'#FFFFFF',outline,2);});
 symbol('Stack / VSF',x=>{rect(a,x,y+3,14,12,'#111827');});
 symbol('Link state strip',x=>{rect(a,x,y+12,5,3,portStateFills.up);rect(a,x+5,y+12,5,3,portStateFills.down,'#5B6B82',.3);rect(a,x+10,y+12,5,3,portStateFills.unknown);});
 const note=wrapPortText('Confirm live link, LLDP/CDP and MAC address tables before moving production cables.  |  Sheet '+sheet,W-76,11);
 note.forEach((text,line)=>{label(a,38,y+22+line*15,W-76,15,text,11,false,C.muted);a.at(-1).editKey=scope+'|legend|note'+(line?'|'+line:'');});
}
function builderSheets(project,db,info,palette,plan,settings={}){
 // A sheet too narrow for readable numbers beside the key column puts the key
 // under the hardware instead, before the common width is widened. So does a
 // sheet whose jacks are too small for every VLAN dot, when the key below
 // lets the hardware (and its jacks) grow.
 let side;
 try{side=builderLayout(project,db,info,palette,plan,settings,true);}
 catch(error){if(error.code!=='PORT_LABEL_CAPACITY')throw error;return builderLayout(project,db,info,palette,plan,settings,false);}
 const crowded=pages=>pages.reduce((n,page)=>n+page.items.filter(i=>i.portNumberRole==='tagged-more'&&i.type==='ellipse').length,0);
 if(crowded(side)){try{const below=builderLayout(project,db,info,palette,plan,settings,false);if(crowded(below)<crowded(side))return below;}catch(error){if(error.code!=='PORT_LABEL_CAPACITY')throw error;}}
 return side;
}
function builderLayout(project,db,info,palette,plan,{sheetLabel='1 / 1'}={},column=true){
 const {width:W,height:H}=pageGeometry(project,'ports'),d=info.device,prefix=project._reportPrefix?project._reportPrefix+'|':'',keyW=column&&W>=1000?Math.min(230,Math.max(190,W*.17)):0,mainW=W-72-(keyW?keyW+16:0),hw=Math.min(plan.width,mainW),footerTop=H-108;
 const ports=info.ports,up=ports.filter(port=>state(port.state)==='up').length,stackPart=canContinueEquipment(project,d);
 const parts=stackPart?[...d.stackMembers].sort((a,b)=>Number(a.id)-Number(b.id)).map(member=>{const ids=String(member.id),known=new Set(d.stackMembers.map(m=>String(m.id))),physical=new Set(physicalPorts(d).map(p=>p.name)),first=member===d.stackMembers.slice().sort((a,b)=>Number(a.id)-Number(b.id))[0];
  const view={...d,stackMembers:[member],ports:(d.ports||[]).filter(p=>!physical.has(p.name)||memberOf(p.name)===ids||first&&!known.has(memberOf(p.name))),stackContinuation:true,equipmentPart:ids};
  return {view,member,bar:['Member '+member.id,member.model||d.model,socketSummary(view)].filter(Boolean).join('  |  ')};}):[{view:d}];
 const models=stackPart?[...new Set(d.stackMembers.map(m=>m.model).filter(Boolean))].join(' / ')||d.model:d.model;
 const bodyKey=deviceEditKey({editScope:prefix+'MDF Port Map|'+equipmentScope(d)+'|sheet:0'},{sourceId:d.id});
 const out=[];let sheet=0;
 const newSheet=()=>{
  const p=fresh('MDF Port Map','MDF port map','Switch front panel, VLAN membership, trunks and link state',project),a=p.items,scope=prefix+'MDF Port Map|'+equipmentScope(d)+'|sheet:'+sheet;
  p.items.splice(0,5);p.editScope=scope;p.title='MDF Port Map';
  const blockW=W-72-(keyW?keyW+16:0),half=(blockW-40)/2,title=nameOf(d)+(sheet?' (continued)':''),site=wrapPortText(project.name||'Network project',half,10,true),model=wrapPortText(String(models||''),half,14,true);
  let titleSize=22,titleLines=wrapPortText(title,half,titleSize,true);while(titleLines.length>2&&titleSize>15)titleLines=wrapPortText(title,half,--titleSize,true);const pitch=Math.ceil(titleSize*1.25);
  const sub=wrapPortText([...deviceDetails(d,project).split(' | ').filter(part=>part&&part!==String(models)&&part!==d.model),ports.length+' interfaces',up+' of '+ports.length+' up'].join('  |  '),half,12);
  const right=20+site.length*13+model.length*19+sub.length*16,height=Math.max(36+titleLines.length*pitch,right)+10;
  rect(a,36,12,blockW,height,'#14283D');a.at(-1).editKey=scope+'|sheet-header';
  label(a,52,18,half,15,'NETWORK PORT MAP',10,true,'#C7D4E2');Object.assign(a.at(-1),{editKey:scope+'|sheet-kicker',full:true});
  titleLines.forEach((text,line)=>{label(a,52,36+line*pitch,half,pitch,text,titleSize,true,C.white);Object.assign(a.at(-1),{editKey:bodyKey+'|port-map-title|'+line,full:true});});
  let ry=18;
  // The project name stays on every sheet.
  label(a,52+half+20,ry,half,site.length*13,project.name||'Network project',10,true,'#C7D4E2');Object.assign(a.at(-1),{editKey:scope+'|sheet-site',full:true});ry+=site.length*13;
  model.forEach((text,line)=>{label(a,52+half+20,ry+2,half,19,text,14,true,C.white);Object.assign(a.at(-1),{editKey:bodyKey+'|port-map-model'+(line?'|line:'+line:''),full:true});ry+=19;});
  sub.forEach((text,line)=>{label(a,52+half+20,ry+3,half,16,text,12,false,'#C7D4E2');Object.assign(a.at(-1),{editKey:bodyKey+'|port-map-summary'+(line?'|line:'+line:''),full:true});ry+=16;});
  p.portMap={device:d.id,devices:[d.id],shown:info.shown.length,total:ports.length,rowNames:[],portRecords:[],density:'compact',overview:false,bookletRole:sheet?'key':'map'};
  out.push(p);sheet++;return {p,top:12+height+14};
 };
 let {p,top:y}=newSheet(),hasPlate=false,unsupplied=false,markWidth=0;const overflow=[];
 // Hardware, member by member, continuing onto another sheet only when needed.
 for(const part of parts){
  const barH=part.bar?17:0,size=equipmentSize(project,part.view,hw);
  if(hasPlate&&y+barH+size.h>footerTop-8)({p,top:y}=newSheet());
  if(part.bar){rect(p.items,36,y,hw,barH-2,'#14283D');p.items.at(-1).editKey=bodyKey+'|member-bar|'+part.member.id;label(p.items,42,y,hw-12,barH-2,part.bar,10,true,C.white);Object.assign(p.items.at(-1),{editKey:bodyKey+'|member-bar|'+part.member.id+'|text',full:true});}
  p.editScope=prefix+'MDF Port Map|'+equipmentScope(part.view)+'|sheet:0';
  p.portMap.overview=true;p.portMap.bookletRole='map';
  const g=addDevice(p,project,part.view,[36,y+barH,hw,1],'panel:'+d.id+(part.member?':'+part.member.id:''),{fitWidth:true,padding:equipmentPadding});p.editScope=prefix+'MDF Port Map|'+equipmentScope(d)+'|sheet:'+(sheet-1);
  // Every socket is numbered, as on the builder sheet; only configured ports
  // carry VLAN fills and marks. Chassis modules number their own ports 1..n.
  const known=physicalPorts(part.view),names=new Set(known.map(port=>port.name.toLowerCase())),sockets=Object.keys(g.ports).filter(name=>!/^uplink\./.test(name)&&!names.has(name.toLowerCase())).map(name=>({name,unconfigured:true}));
  if(sockets.length)unsupplied=true;
  const numbering={fill:palette.native,marks:palette.marks,stateKey:true,unconfiguredFill:NATIVE_NOT_SUPPLIED,...(d.modules?.length&&!stackPart?{format:name=>portLabelText(name).replace(/^[A-Z]{1,2}(?=\d+$)/,'')}:{})};
  let drawn;try{drawn=portNumbers(p.items,g,[...known,...sockets],numbering);}catch(error){if(error.code!=='PORT_LABEL_CAPACITY'||!sockets.length)throw error;drawn=portNumbers(p.items,g,known,numbering);}
  if(!g.asset)readablePlateText(g,[...(drawn?.faces||[]),...(drawn?.entries||[]).map(entry=>entry.number)].filter(Boolean));
  if(drawn?.overflow)overflow.push(...drawn.overflow);if(drawn?.markWidth)markWidth=Math.max(markWidth,drawn.markWidth);
  y=g.y+g.h+(part.bar?4:10);hasPlate=true;
 }
 // A chassis names each slot's module under the hardware.
 if(!stackPart&&d.modules?.length){const sockets=deviceFaceplate(d,{padding:equipmentPadding})?.sockets||[],slots=d.modules.filter(m=>!m.member).map(m=>{const counts=new Map();for(const s of sockets.filter(s=>s.primary!==false&&new RegExp('^'+m.slot+'\\d+$','i').test(s.name))){const form=String(s.form).replace(/^RJ45$/,'RJ-45');counts.set(form,(counts.get(form)||0)+1);}return 'Slot '+m.slot+': '+[m.model,[...counts].map(([f,n])=>n+' '+f).join(' + ')].filter(Boolean).join(' ');});
  const lines=wrapPortText(slots.join('   ·   '),hw,11);
  // The slot line never runs into the footer key; a full sheet continues.
  if(y+lines.length*14>footerTop-8)({p,top:y}=newSheet());
  lines.forEach((text,line)=>{label(p.items,36,y+line*14,hw,14,text,11,false,C.muted);Object.assign(p.items.at(-1),{editKey:bodyKey+'|slots'+(line?'|'+line:''),full:true});});y+=lines.length*14+6;}
 // The VLAN key down the right; lists beside it when they fit, else under the hardware.
 const scope=prefix+'MDF Port Map|'+equipmentScope(d),[vlanSection,...lists]=keySections([d],palette,{names:[...db.devices.values()],unsupplied,overflow});
 // Hardware too small for every tagged dot asks the planner for a width.
 if(markWidth)Object.assign(out[0].portMap,{markWidth,markSource:d.id});
 let columnBottom=0,listsDrawn=false;
 if(keyW){const first=out[0];columnBottom=drawSections(first.items,[vlanSection],W-36-keyW,12,keyW,scope);
  if(lists.length&&p===first&&drawSections([],lists,W-36-keyW,columnBottom,keyW,scope,false,1)<=footerTop){columnBottom=drawSections(first.items,lists,W-36-keyW,columnBottom,keyW,scope,true,1);listsDrawn=true;}
  if(out.length>1&&lists.length&&!listsDrawn&&drawSections([],lists,W-36-keyW,12,keyW,scope,false,1)<=footerTop){drawSections(p.items,lists,W-36-keyW,12,keyW,scope,true,1);listsDrawn=true;}}
 const under=keyW?lists:[vlanSection,...lists];
 if(!listsDrawn&&under.length){
  y+=6;if(drawSections([],under,36,y,mainW,scope,false)>footerTop)({p,top:y}=newSheet());
  y=drawSections(p.items,under,36,y,keyW?mainW:W-72,scope);
 }
 const sampleVlan=Number(String(vlanSection.entries[0]?.key||'').replace('vlan:',''))||null;
 out.forEach((page,index)=>builderFooter(page,palette,scope+'|sheet:'+index,sheetLabel+(out.length>1?' ('+(index+1)+' of '+out.length+')':''),sampleVlan));
 out.contentBottom=Math.max(y,p===out[0]?columnBottom:0);out.last=p;
 return out;
}
function bookletInventory(project,db,device,ports,options,palette,grouped,start=null){
 // Natural order keeps chassis slots together (A1-A8, then B1) and numeric member/port order.
 // Dense, still-editable inventory typography. Compact columns and reduced
 // vertical padding affect the tabular inventory only, never port faceplates.
 const type={cell:10,line:12,row:18,pad:3,header:10,headerLine:13,maxChunk:9};
 const {width:W,height:H}=pageGeometry(project,'ports'),filter=options.detailFilter||'all',sorted=ports.slice().sort((a,b)=>cmp(a.name,b.name)||comparePorts(a,b)),prefix=portColumnPrefix(sorted.map(p=>p.name));
 // Short columns keep their heading readable; Description, Tagged VLANs and
 // Connected to share the rest of the page width.
 const spec=[['Ports'+(prefix?' ('+prefix+')':''),112],['Description',180,true],['Mode',132,false,textWidth('255.255.255.255/32',type.cell)+14],['Native',80],['Tagged VLANs',150,true],['LAG',52],['Voice',52],['Link',122],['Connected to',220,true]],span=W-72,total=spec.reduce((n,c)=>n+c[1],0);
 const widths=spec.map(([title,w,,minimum=0])=>Math.max(w*span/total,textWidth(title,type.header,true)+12,minimum));let excess=widths.reduce((n,w)=>n+w,0)-span;
 for(let pass=0;pass<3&&excess>.01;pass++){const flexible=spec.map((c,i)=>c[2]&&widths[i]>60?i:-1).filter(i=>i>=0),room=flexible.reduce((n,i)=>n+widths[i]-60,0);if(!room)break;for(const i of flexible){const take=Math.min(widths[i]-60,excess*(widths[i]-60)/room);widths[i]-=take;}excess=widths.reduce((n,w)=>n+w,0)-span;}
 if(excess>.01){const scale=span/(span+excess);for(let i=0;i<widths.length;i++)widths[i]*=scale;}
 const columns=spec.map(([title],i)=>[title,widths[i]]);
 const roles=['ports','assignment',...columns.slice(2).map(()=>'details')],records=[],assignment=portAssignments(project,db,device,sorted);let shown=0;
 for(const port of sorted){
  const o=uplinkSettings(db.devices.get(device.id)||device,port),peers=db.links.flatMap(l=>l.a===device.id&&l.ap.toLowerCase()===o.name.toLowerCase()?[[l.b,l.bp,l]]:l.b===device.id&&l.bp.toLowerCase()===o.name.toLowerCase()?[[l.a,l.ap,l]]:[]);
  if(!hasPortDetails(o,peers.length>0,filter))continue;shown++;
  const native=o.native!=null&&value(o.native)!==''?value(o.native):'',tagged=(o.tagged||[]).filter(t=>String(t)!==native);
  const addresses=interfaceAddresses(o),mode=(o.mode?value(o.mode):addresses.length&&!native?'Routed':tagged.length?'Tagged/mixed':native?'Untagged':'Not specified')+(addresses.length?'\n'+addresses.join('\n'):'');
  // A configured description wins; otherwise the inferred assignment is shown muted.
  const purpose=assignment(port)[0],inferred=!o.description&&purpose&&!/^(?:No peer reported|Configured \/ unassigned)$/.test(purpose);
  const fields=[o.description||(inferred?purpose:''),mode,native?native+(o.nativeTagged?' (tagged)':''):addresses.length?'Routed':'None',[tagged.length?vlanSet(tagged):'',o.allowedExcept?.length?'except '+vlanSet(o.allowedExcept):''].filter(Boolean).join(' '),value(o.lag),o.voice!=null?value(o.voice):''];
  const member={name:o.name,state:state(o.state),speed:rate(o.speed||peers.find(p=>p[2].speed)?.[2].speed),media:value(o.media||peers.find(p=>p[2].media)?.[2].media),peers:peers.map(([id,peerPort])=>nameOf(db.devices.get(id))+(peerPort?' / '+peerPort:''))};
  // Consecutive ports with identical settings share a row, as in the builder.
  const signature=JSON.stringify(fields),previous=records.at(-1),record=grouped&&previous?.signature===signature&&consecutivePorts(previous.members.at(-1).name,o.name)?previous:null;
  if(record)record.members.push(member);else records.push({signature,fields,inferred,swatch:palette.native(o),members:[member]});
 }
 const label3=s=>s==='up'?'Up':s==='down'?'Down':'Unknown';
 const rows=records.flatMap(record=>{
  const names=record.members.map(m=>m.name),states=[...new Set(record.members.map(m=>m.state))],speeds=[...new Set(record.members.map(m=>m.speed).filter(Boolean))],media=[...new Set(record.members.map(m=>m.media).filter(Boolean))];
  const link=[states.length===1?label3(states[0]):['up','down','unknown'].map(s=>{const n=record.members.filter(m=>m.state===s).length;return n?n+' '+label3(s).toLowerCase():'';}).filter(Boolean).join(', '),speeds.length===1?speeds[0]:'',media.length===1?media[0]:''].filter(Boolean).join(' · ');
  const connected=record.members.filter(m=>m.peers.length).map(m=>(names.length>1?portRanges([m.name],prefix)+': ':'')+m.peers.join(', ')).join('; ');
  const values=[portRanges(names,prefix)+(names.length>1?' ('+names.length+')':''),...record.fields.slice(0,1),...record.fields.slice(1),link,connected];
  const lines=values.map((v,i)=>v?wrapPortText(v,columns[i][1]-12,type.cell,i===0):[]),size=Math.max(1,...lines.map(l=>l.length)),chunks=[];
  let hash=2166136261;for(const char of JSON.stringify([record.signature,names]))hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  for(let from=0;from<size;from+=type.maxChunk){const slice=lines.map(l=>l.slice(from,from+type.maxChunk));if(from&&!slice[0].length)slice[0]=wrapPortText(portRanges(names,prefix)+' (continued)',columns[0][1]-12,type.cell,true);chunks.push({record,names,lines:slice,part:from/type.maxChunk,key:hash.toString(36),height:Math.max(type.row,2*type.pad+type.line*Math.max(...slice.map(l=>l.length)))});}
  return chunks;
 });
 const headings=columns.map(([title,w])=>wrapPortText(title,w-12,type.header,true)),header=Math.max(24,6+type.headerLine*Math.max(...headings.map(l=>l.length)));
 const barTitle=wrapPortText(nameOf(device)+'  /  Port inventory',W-100,15,true),barDetailLines=wrapPortText(deviceDetails(device,project)+'  |  Ports 0000-0000 of 0000',W-100,10).length,barHeight=10+barTitle.length*17+barDetailLines*12;
 const out=[],scopeBase=(project._reportPrefix?project._reportPrefix+'|':'')+'Port Inventory|'+equipmentScope(device);let at=0,sheet=0;
 do{
  // A combined sheet starts the table under its faceplates when the bar,
  // heading and first row fit there; the rest continues on inventory pages.
  // On a combined sheet the faceplate bar already names the device, so its
  // table opens with a slim section bar instead of a second dark bar.
  const filterLine=sheet===0&&shown<ports.length?20:0,slim=26,slimFits=wrapPortText(nameOf(device)+'  /  Port inventory  |  Ports '+ports.length+'-'+ports.length+' of '+ports.length,W-88,11,true).length===1,host=sheet===0&&start&&slimFits&&start.top+slim+filterLine+header+(rows[0]?.height||type.row)<=H-82+footerAllowance(project)?start.page:null,bar=host?slim-8:barHeight;
  const p=host||fresh('MDF Port Map','MDF port map','Port assignments, descriptions, VLANs and link state',project),a=p.items,scope=scopeBase+'|sheet:'+sheet;if(!host)p.editScope=scope;
  let y=host?start.top:150;const barTop=y,tableTop=barTop+bar+8+filterLine;y=tableTop;
  if(sheet===0&&shown<ports.length){label(a,38,barTop+bar+6,W-80,18,shown+' of '+ports.length+' port records in details | '+(ports.length-shown)+' hidden by table filter',11,false,C.muted);a.at(-1).editKey=scope+'|filter-summary';}
  const tableStart=a.length;if(!host)p.tableTop=tableTop;else p.tableTop??=tableTop;
  rect(a,36,y,W-72,header,'#E3ECF5','#C4D3E3',.75);a.at(-1).editKey=scope+'|inventory-header';let x=36;
  columns.forEach(([,w],column)=>{headings[column].forEach((text,line)=>{label(a,x+6,y+3+line*type.headerLine,w-10,type.headerLine,text,type.header,true,'#1B3A4B');Object.assign(a.at(-1),{editKey:scope+'|column|'+column+'|'+line,full:true});});x+=w;});y+=header;
  const members=[];let count=0;
  while(at<rows.length&&y+rows[at].height<=H-124+footerAllowance(project)){
   const row=rows[at++],rowKey=scopeBase+'|row|'+row.key+'|part:'+row.part;members.push(...(row.part?[]:row.names));
   rect(a,36,y,W-72,row.height,count%2?'#F3F7FA':C.white);a.at(-1).editKey=rowKey+'|background';rect(a,36,y+row.height-1,W-72,1,'#DCE5E9');a.at(-1).editKey=rowKey+'|rule';
   let cx=36;
   row.lines.forEach((lines,column)=>{
    const indent=column===3&&!row.part?24:6;
    if(column===3&&!row.part){rect(a,cx+6,y+5,10,9,row.record.swatch,'#5B6B82',.6);a.at(-1).editKey=rowKey+'|swatch';}
    lines.forEach((text,line)=>{label(a,cx+indent,y+type.pad+line*type.line,columns[column][1]-indent-4,type.line,text,type.cell,column===0,column===0?'#1B3A4B':column===1&&row.record.inferred?C.muted:C.ink);Object.assign(a.at(-1),{editKey:rowKey+'|cell:'+column+'|line:'+line,portTableRole:column===0?'interface':'detail',portAssignmentRole:roles[column],full:true});});
    cx+=columns[column][1];
   });
   y+=row.height;count++;
  }
  if(!rows.length){label(a,49,y+20,W-100,25,ports.length?'No ports match the selected table filter. All physical ports remain on the faceplate.':'No physical switch port records were supplied.',14,false,C.muted);a.at(-1).editKey=scope+'|empty';}
  for(const item of a.slice(tableStart))item.tableContent=true;
  const pageNames=new Set(members),records=sorted.filter(port=>pageNames.has(port.name)).map(port=>({device:device.id,name:port.name}));
  const first=records.length?sorted.findIndex(port=>port.name===records[0].name)+1:0,last=records.length?sorted.findIndex(port=>port.name===records.at(-1).name)+1:0;
  if(host)sectionBar(a,36,barTop,W-72,nameOf(device)+'  /  Port inventory  |  '+(records.length?'Ports '+first+'-'+last+' of '+ports.length:ports.length+' ports'),scope+'|section');
  else{
   rect(a,36,barTop,W-72,barHeight,'#14283D');a.at(-1).editKey=scope+'|bar';
   barTitle.forEach((text,line)=>{label(a,50,barTop+4+line*17,W-100,17,text,15,true,C.white);Object.assign(a.at(-1),{editKey:scope+'|bar-title'+(line?'|'+line:''),full:true});});
   const detail=wrapPortText([deviceDetails(device,project),records.length?'Ports '+first+'-'+last+' of '+ports.length:ports.length+' ports'].filter(Boolean).join('  |  '),W-100,10);
   detail.slice(0,barDetailLines).forEach((text,line)=>{label(a,50,barTop+5+barTitle.length*17+line*12,W-100,12,text,10,false,'#C7D4E2');Object.assign(a.at(-1),{editKey:scope+'|bar-detail'+(line?'|'+line:''),full:true});});
  }
  const note=wrapPortText('Confirm live link, LLDP/CDP and MAC address tables before moving production cables.'+(grouped?' Ports with the same settings share a row (port count in brackets).':''),W-76,11);
  const noted=(!host||start.last&&start.note!==false)&&y+12+note.length*15<=H-75+footerAllowance(project);if(noted)note.forEach((text,line)=>{label(a,38,y+12+line*15,W-76,15,text,11,false,C.muted);a.at(-1).editKey=scope+'|note'+(line?'|'+line:'');});
  out.end={page:p,y:y+(noted?12+note.length*15:0),hosted:!!host};
  if(host)out.hosted={records,shown};
  else{p.portMap={device:device.id,devices:[device.id],shown,total:ports.length,rowNames:records.map(r=>r.name),portRecords:records,density:'compact',overview:false,bookletRole:'inventory',inventoryTable:true};namePortInventory(p);out.push(p);}
  sheet++;
 }while(at<rows.length);
 return out;
}
function bookletHeader(page){
 const banner=[];
 rect(banner,36,12,page.width-72,82,C.ink);banner.at(-1).pageFrame='header-background';
 const [projectName,brand,title]=page.items;
 for(const item of [projectName,brand,title])item.color=C.white;
 projectName.x+=12;projectName.y=Math.max(18,projectName.y);projectName.w-=24;
 brand.x-=12;
 title.x+=12;title.w-=24;
 page.items.unshift(...banner);
}
function namePortInventory(page){
 page.name=page.name.replace(/MDF Port Map$/,'Port Inventory');
 page.title='Port Inventory';
 page.items.find(item=>item.pageTitle).value=page.title;
 page.items[3].value='Port assignments, descriptions, VLANs and link state';
 bookletHeader(page);
}
function referencePortMaps(project,db,switches,options,plan){
 const {width:W,height:H}=pageGeometry(project,'ports'),half=(W-82)/2;
 const separate=options.presentation!=='combined'&&(options.presentation==='separate'||options.repeatFaceplate!==true);
 const filter=options.detailFilter||'all',repeat=!separate&&options.repeatFaceplate===true,out=[];
 const palette=separate?portMapPalette(project,db):null;
 // Booklet sheets: one builder sheet per whole device (members continue onto
 // another sheet only when they do not fit), then its inventory. The
 // Automatic merged sheet hosts the table under that device's own lists.
 if(separate){
  const seen=new Set(),devices=plan.views.filter(v=>!seen.has(v.id)&&seen.add(v.id)).map(v=>switches.find(d=>d.id===v.id)||v);
  devices.forEach((d,index)=>{
   const ports=physicalPorts(d).sort(comparePorts),shown=ports.filter(port=>{const o=uplinkSettings(db.devices.get(d.id)||d,port);return hasPortDetails(o,db.links.some(l=>l.a===d.id&&l.ap.toLowerCase()===o.name.toLowerCase()||l.b===d.id&&l.bp.toLowerCase()===o.name.toLowerCase()),filter);}).map(port=>port.name);
   const sheets=builderSheets(project,db,{device:d,ports,shown},palette,plan,{sheetLabel:(index+1)+' / '+devices.length});out.push(...sheets);
   if(options.mergeSheets===true&&sheets.length===1){
    const map=sheets[0],pages=bookletInventory(project,db,d,ports,options,palette,true,{page:map,top:sheets.contentBottom+16,last:true,note:false}),records=pages.hosted?.records||[];out.push(...pages);
    if(pages.hosted){map.portMap={...map.portMap,rowNames:records.map(r=>r.name),portRecords:records,mergedInventory:true};delete map.portMap.bookletRole;}
   }else out.push(...bookletInventory(project,db,d,ports,options,palette,true));
  });
  return out;
 }
 // Pack measured panels first; keep their member-local assignment data with them.
 for(const devices of plan.groups){
  const columns=fitColumns([['Port assignment',230],...devices.map(d=>[nameOf(d)+' ports',devices.length===2?190:260]),['VLANs and link details',devices.length===2?518:638]],W-72),records=new Map(),data=devices.map(d=>({device:d,ports:physicalPorts(d).sort(comparePorts)}));
  for(const info of data){const {device:d,ports}=info,assignment=portAssignments(project,db,d,ports);info.assignment=assignment;info.shown=[];info.prefix=portColumnPrefix(ports.map(p=>p.name));
   for(const port of ports){const o=uplinkSettings(db.devices.get(d.id)||d,port),peers=db.links.flatMap(link=>link.a===d.id&&link.ap.toLowerCase()===o.name.toLowerCase()?[{id:link.b,port:link.bp,link}]:link.b===d.id&&link.bp.toLowerCase()===o.name.toLowerCase()?[{id:link.a,port:link.ap,link}]:[]);
    if(!hasPortDetails(o,peers.length>0,filter))continue;info.shown.push(o.name);
    const assigned=assignment(port),role=assigned[1],defaultAccess=!peers.length&&!o.lag&&Number(o.native)===1&&!o.tagged?.length&&!o.voice&&!o.description;
    const title=o.lag&&role==='uplink'?'LAG '+o.lag:role==='ap'?'Wireless access points':role==='profile'?assigned[0]==='Configured AP port'?'Configured AP ports':'Matches AP profile':role==='wired'?(o.voice!=null||o.tagged?.length?'Wired data / voice':'Wired access'):assigned[0]==='No peer reported'?'Configured / unassigned':assigned[0];
    const purpose=o.description&&o.description.length<=56?o.description:defaultAccess?'Default access':title,vlan=[o.role?'Mode: '+o.role:'',o.native!=null&&value(o.native)!==''?'Native VLAN '+value(o.native)+(o.nativeTagged?' (tagged)':''):'',o.tagged?.length?'Tagged VLANs '+vlanSet(o.tagged):'',o.allowedExcept?.length?'Except VLANs '+vlanSet(o.allowedExcept):'',o.voice!=null?'Voice VLAN '+value(o.voice):'',o.lag?'LAG '+o.lag:'',interfaceAddresses(o).length?'IP '+interfaceAddresses(o).join(', '):'',o.description&&o.description.length>56?o.description:''].filter(Boolean),signature=JSON.stringify([purpose,role,vlan]);
    if(!records.has(signature))records.set(signature,{signature,title:purpose,role,vlan,ports:devices.map(()=>[]),members:[]});
    const row=records.get(signature);row.ports[devices.indexOf(d)].push(o.name);row.members.push({device:d.id,name:o.name,state:state(o.state),speed:rate(o.speed||peers.find(p=>p.link.speed)?.link.speed),media:value(o.media||peers.find(p=>p.link.media)?.link.media),peers:peers.map(p=>nameOf(db.devices.get(p.id))+(p.port?' / '+p.port:'')),assignment:assigned[0]});
   }
  }
  const rows=[...records.values()].flatMap(record=>{
   const details=[...record.vlan],states=new Set(record.members.map(p=>p.state)),speeds=new Set(record.members.map(p=>p.speed).filter(Boolean)),media=new Set(record.members.map(p=>p.media).filter(Boolean));
   if(speeds.size===1)details.push([...speeds][0]);if(media.size===1)details.push([...media][0]);
   if(states.size===1)details.push([...states][0]==='up'?'All ports up':[...states][0]==='down'?'All ports down':'Link state unknown');
   const exceptions=new Map();
   for(const member of record.members){const detail=[states.size>1?(member.state==='up'?'Up':member.state==='down'?'Down':'Unknown'):'',speeds.size>1?member.speed:'',media.size>1?member.media:'',...member.peers].filter(Boolean).join(' | ');if(!detail)continue;const key=JSON.stringify([member.device,detail]);if(!exceptions.has(key))exceptions.set(key,{device:member.device,detail,names:[]});exceptions.get(key).names.push(member.name);}
   for(const exception of exceptions.values()){const info=data.find(d=>d.device.id===exception.device);details.push((devices.length>1?nameOf(info.device)+' ':'')+portRanges(exception.names,info.prefix)+': '+exception.detail);}
   const values=[record.title,...record.ports.map((names,i)=>portRanges(names,data[i].prefix)),details.join(' | ')],lines=values.map((v,i)=>wrapPortText(v,columns[i][1]-24,12,i===0)),length=Math.max(...lines.map(l=>l.length)),chunks=[];
   for(let from=0;from<length;from+=7){const sliced=lines.map(l=>l.slice(from,from+7));if(from){if(!sliced[0].length)sliced[0]=wrapPortText(record.title+' (continued)',columns[0][1]-24,12,true);for(let i=1;i<=devices.length;i++)if(!sliced[i].length)sliced[i]=wrapPortText(portRanges(record.ports[i-1],data[i-1].prefix),columns[i][1]-24,12);}chunks.push({...record,lines:sliced,part:from/7,height:Math.max(devices.length===2?34:20,(devices.length===2?12:6)+14*Math.max(...sliced.map(l=>l.length)))});}return chunks;
  });
  let at=0,sheet=0,repeatFits=true,legendPending=false;
  do{const p=fresh('MDF Port Map','MDF port map',(separate?'Switch front panels, VLAN membership, trunks and link state':'Switch front panels, configured port roles and link state')+(sheet?' | details continued':''),project),a=p.items,overview=sheet===0||repeat&&repeatFits,scope=(project._reportPrefix?project._reportPrefix+'|':'')+'MDF Port Map|'+devices.map(equipmentScope).join(',')+'|sheet:'+sheet;p.title='MDF Port Map';p.editScope=scope;let start=184;const frameCount=a.length;
   const shown=data.reduce((sum,info)=>sum+info.shown.length,0),total=data.reduce((sum,info)=>sum+info.ports.length,0);
   const used=new Set(data.flatMap(info=>info.ports.map(port=>info.assignment(port)[1])));
   if(overview){let bottom=150,nextTitle=151;data.forEach(info=>{const d=info.device,{titleLines,titleSize,titleLineHeight,summaryLines,textHeight}=portPanelCaption(project,d,info.ports,W);
     p.editScope=(project._reportPrefix?project._reportPrefix+'|':'')+'MDF Port Map|'+equipmentScope(d)+'|sheet:'+sheet;const g=addDevice(p,project,d,[(W-plan.width)/2,nextTitle+textHeight+8,plan.width,1],'panel:'+d.id,{fitWidth:true,padding:equipmentPadding});p.editScope=scope;
     const textTop=g.y-8-textHeight>=146?g.y-8-textHeight:g.y+g.h+8;
     titleLines.forEach((text,line)=>{label(a,41,textTop+line*titleLineHeight,(half-23),titleLineHeight,text,titleSize,true,C.ink);Object.assign(a.at(-1),{editKey:g.editKey+'|port-map-title|'+line,full:true});});
     summaryLines.forEach((text,line)=>{label(a,(41+half),textTop+line*16,half,16,text,13,false,C.muted,'right');Object.assign(a.at(-1),{editKey:g.editKey+'|port-map-summary'+(line?'|line:'+line:''),full:true});});
     portNumbers(a,g,info.ports,{fill:port=>referencePortFills[info.assignment(port)[1]],stateKey:true});bottom=Math.max(bottom,g.y+g.h,textTop+textHeight);nextTitle=bottom+18;
    });
    {
     const probe={...p,items:[]},end=referencePortLegend(probe,bottom+15,used)+10;
    if(end<=H-75+footerAllowance(project)){a.push(...probe.items);start=end;legendPending=false;}else{start=H;legendPending=true;repeatFits=false;}
    }
   }else if(legendPending){start=referencePortLegend(p,151,used)+10;legendPending=false;}
   if(shown<total&&start<H-75+footerAllowance(project)){label(a,38,start-20,(W-80),17,shown+' of '+total+' port records in details | '+(total-shown)+' hidden by table filter',11,false,C.muted);a.at(-1).editKey=scope+'|filter-summary';}
   const captions=columns.map(([title,w],column)=>{const info=data[column-1],caption=info?title+(info.prefix?' ('+info.prefix+')':''):title;return wrapPortText(caption,w-24,13,true);}),header=Math.max(39,9+15*Math.max(...captions.map(lines=>lines.length))),canTable=start+header+(rows[at]?.height||20)<=(H-124+footerAllowance(project));if(!canTable)repeatFits=false;
   if(header+184+(rows[at]?.height||20)>(H-124+footerAllowance(project)))throw Error('This port-map column heading needs more space. Use a shorter device name or a wider port-map view.');
   const tableStart=a.length;p.tableTop=start;
   if(canTable){rect(a,36,start,(W-72),header,C.ink);a.at(-1).editKey=scope+'|assignment-header';let x=36;columns.forEach(([title,w],column)=>{captions[column].forEach((text,line)=>{label(a,x+12,start+4+line*15,w-24,18,text,13,true,C.white);a.at(-1).editKey=scope+'|column|'+column+'|'+line;});x+=w;});}
   let y=start+header,count=0;const members=[];
   while(canTable&&at<rows.length&&y+rows[at].height<=(H-124+footerAllowance(project))){const row=rows[at++];let hash=2166136261;for(const char of JSON.stringify([row.title,row.vlan,row.ports]))hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;const rowKey=scope+'|assignment|'+hash.toString(36)+'|part:'+row.part;members.push(...row.members);rect(a,36,y+2,(W-72),row.height-3,count%2?C.pale:C.white);a.at(-1).editKey=rowKey+'|background';rect(a,36,y+2,5,row.height-3,referencePortFills[row.role]);a.at(-1).editKey=rowKey+'|role';let x=36;
    row.lines.forEach((lines,column)=>{lines.forEach((text,line)=>{label(a,x+12,y+6+line*14,columns[column][1]-24,14,text,12,column===0,C.ink);Object.assign(a.at(-1),{editKey:rowKey+'|cell:'+column+'|line:'+line,portTableRole:column>0&&column<=devices.length?'interface':'detail',portAssignmentRole:column===0?'assignment':column<=devices.length?'ports':'details',full:true});});x+=columns[column][1];});y+=row.height;count++;
   }
   if(!rows.length&&canTable)label(a,49,start+47,(W-100),25,total?'No ports match the selected table filter. All physical ports remain on the faceplate.':'No physical switch port records were supplied.',14,false,C.muted);
   for(const item of a.slice(tableStart))item.tableContent=true;
   const included=new Set(members.map(m=>JSON.stringify([m.device,m.name]))),portRecords=data.flatMap(info=>info.ports.filter(port=>included.has(JSON.stringify([info.device.id,port.name]))).map(port=>({device:info.device.id,name:port.name})));p.portMap={device:devices[0].id,devices:devices.map(d=>d.id),shown,total,rowNames:portRecords.map(port=>port.name),portRecords,density:'compact',overview:!separate&&overview,assignmentMatrix:true,...(separate?{bookletRole:'inventory'}:{})};if(separate)namePortInventory(p);out.push(p);sheet++;
  }while(at<rows.length||legendPending);
 }
 return out;
}
// The builder sheet is painted in the colors of each device's core-diagram
// artwork: its plate, or a chassis frame with its module bays. Vector stencils
// give their largest filled shape; raster-only artwork keeps the builder's own.
const solidColor=fill=>typeof fill==='string'&&/^#[0-9a-f]{6}$/i.test(fill);
function artworkColors(project,d){
 let g;try{g=addDevice({items:[]},project,d,[0,0,400,1],'artwork-colors',{fitWidth:true,padding:equipmentPadding});}catch{return null;}
 if(g.asset){
  let best=null;
  for(const path of g.asset.native?.paths||[]){
   if(path.hidden||!solidColor(path.fill))continue;const points=path.commands.filter(c=>c.length>=3).map(([,x,y])=>[x,y]).filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y));if(!points.length)continue;
   const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),area=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));if(!best||area>best.area)best={area,fill:path.fill,stroke:path.stroke};
  }
  return best?{body:best.fill,stroke:solidColor(best.stroke)?best.stroke:null}:null;
 }
 const rects=(g.children||[]).filter(c=>c.type==='rect'&&solidColor(c.fill)&&c.w>0&&c.h>0);if(!rects.length)return null;
 const plate=rects.reduce((a,b)=>b.w*b.h>a.w*a.h?b:a),slots=(g.panelRegions||[]).filter(r=>/^[A-L]$/.test(String(r.id??''))),near=(a,b)=>Math.abs(a-b)<1e-6;
 const bay=slots.length?rects.find(c=>slots.some(r=>near(c.x,r.x)&&near(c.y,r.y)&&near(c.w,r.w)&&near(c.h,r.h))):null;
 return bay?{frame:plate.fill,frameStroke:solidColor(plate.stroke)?plate.stroke:null,body:bay.fill,stroke:solidColor(bay.stroke)?bay.stroke:null}:{body:plate.fill,stroke:solidColor(plate.stroke)?plate.stroke:null};
}
function portMaps(project,db){
 const switches=[...db.devices.values()].filter(d=>d.kind==='switch'),interfaces=documentationSections(project,db.devices.values()).filter(section=>section.inventory),extra=interfaces.length?logicalPages(project,interfaces,{name:logicalInventoryName,family:'ports',columns:logicalInventoryColumns,compact:true,omitEmpty:true,subtitle:'Logical and routed interfaces, observed state and configured membership'}):[];
 for(const page of extra){page.interfaceInventory=true;page.interfaceSections=page.logicalSections;delete page.logicalSections;page.tableTop=160;for(const item of page.items)if(item.y>=160)item.tableContent=true;bookletHeader(page);}
 if(!switches.length)return [...(extra.length&&documentationMode(project)==='concise'?[]:portMapsAtScale(project,db)),...extra];
 const savedKeys=Object.keys(project.layout?.drawingEdits||{}).filter(key=>/(?:^|\|)(?:MDF Port Map|Port Inventory)(?:\b|\|)/.test(key)&&!key.includes(logicalInventoryName)),retention=new WeakMap(),retained=pages=>{if(!savedKeys.length)return 0;if(!retention.has(pages)){const keys=new Set(pages.flatMap(page=>drawingObjects(page).flatMap(item=>[item.editKey,item.legacyEditKey])));retention.set(pages,savedKeys.filter(key=>keys.has(key)).length);}return retention.get(pages);};
 // Port maps use the switchport builder's sheet by default, fitted to US
 // Letter (or the chosen fixed port-map paper) and painted in each device's
 // artwork colors. The realistic faceplate is a choice in Port map options.
 const mapOptions=project.layout?.portMap||{},sheetGeometry=pageGeometry(project,'ports');
 // Drawing-port-map proportions are independent of print paper. The renderer
 // grows a single logical sheet for large member stacks; the paper preset
 // only scales that completed scene at print/export time.
 const paper={width:1056,height:816,preset:'letter',widthMm:279.4,heightMm:215.9,fill:true};
 const sheets=mapOptions.mapStyle==='faceplate'||mapOptions.presentation==='combined'?new Map():portMapSheets(project,switches,paper,new Map(switches.map(d=>[d.id,artworkColors(project,d)])));
 let initial=portEquipmentPlan(project,switches),best;
 // A narrower common scale may change stack member ranges. An existing
 // edited range takes priority over a page-count saving, including edits
 // loaded directly from a project rather than made through the editor.
 const prefer=pages=>!best||retained(pages)>retained(best)||retained(pages)===retained(best)&&pages.length<best.length;
 for(let attempt=0;attempt<4;attempt++){
  try{best=portMapsAtScale(project,db,initial);break;}
  catch(error){if(error.code!=='PORT_LABEL_CAPACITY'||!Number.isFinite(error.requiredWidth))throw error;
   const d=switches.find(d=>d.id===error.sourceId),width=Math.max(initial.width+1,error.requiredWidth/(d?deviceScale(project,d):1)+2),geometry=pageGeometry(project,'ports');
   // The default Letter sheet gives way to a growing page when it cannot keep
   // the numbers readable; a chosen fixed paper reports the limit.
   if(width>geometry.width-82){if(!geometry.dynamic&&!geometry.preferred)throw error;if(geometry.preferred)project={...project,_portsDynamic:true};const grown=pageGeometry(project,'ports');project={...project,_pageGeometry:{...project._pageGeometry,ports:{width:Math.ceil(width+82),height:grown.height}}};}
   initial=portEquipmentPlan(project,switches,width);
  }
 }
 if(!best)throw Error('The port labels need more space. Choose a wider port-map page.');
 // Every tagged VLAN dot at a readable size, as the switchport builder sizes
 // its sheets: widen the common hardware for the whole family when a jack
 // needs it, growing a dynamic page; fixed paper keeps the '+' marker list.
 const crowded=pages=>pages.filter(page=>page.portMap?.markWidth).map(page=>{const d=switches.find(d=>d.id===page.portMap.markSource);return page.portMap.markWidth/(d?deviceScale(project,d):1)+2;});
 for(let attempt=0;attempt<4&&switches.some(d=>!sheets.has(d.id));attempt++){
  // A growing page also keeps its VLAN key column (up to 230 plus a 16 gap);
  // a fixed sheet widens the hardware only to its own width, and may then
  // move the key under the hardware (builderSheets).
  const geometry=pageGeometry(project,'ports'),room=82+246;let next=project,width=Math.max(0,...crowded(best));
  if(!geometry.dynamic)width=Math.min(width,geometry.width-82);
  if(width<=initial.width+1)break;
  if(geometry.dynamic&&width>geometry.width-room)next={...project,_pageGeometry:{...project._pageGeometry,ports:{width:Math.ceil(width+room),height:geometry.height}}};
  try{const plan=portEquipmentPlan(next,switches,width),pages=portMapsAtScale(next,db,plan);best=pages;initial=plan;project=next;}catch(error){if(error.code!=='PORT_LABEL_CAPACITY')throw error;break;}
 }
 const legible=pages=>!pages.some(page=>page.portMap?.markWidth);
 for(const scale of switches.some(d=>deviceScale(project,d)!==1)?[]:[.9,.8]){try{const plan=portEquipmentPlan(project,switches,initial.width*scale),pages=portMapsAtScale(project,db,plan);if(prefer(pages)&&(legible(pages)||!legible(best)))best=pages;}catch(error){if(error.code!=='PORT_LABEL_CAPACITY')throw error;}}
 const options=project.layout?.portMap||{},auto=!options.presentation||options.presentation==='auto',edited=savedKeys.length>0,customized=Object.entries(project.layout?.presentation?.pages||{}).some(([key,settings])=>!key.includes(logicalInventoryName)&&(/(?:^|\|)Port Inventory(?:\b|\|)/.test(key)||/(?:^|\|)MDF Port Map(?:\b|\|)/.test(key)&&Object.keys(settings).some(key=>!['name','hidden'].includes(key))));
 // Try a measured combined sheet only when it saves a page. Existing
 // separate sheets, enlarged text and drawing edits keep their layout.
 if(auto&&!sheets.size&&documentationMode(project)==='concise'&&options.density!=='expanded'&&!edited&&!customized&&(project.layout?.presentation?.defaults?.textScale||1)===1){
  const combined={...project,layout:{...project.layout,portMap:{...options,presentation:'separate',mergeSheets:true}}};
  try{const pages=portMapsAtScale(combined,db,initial);if(prefer(pages))best=pages;}catch(error){if(error.code!=='PORT_LABEL_CAPACITY')throw error;}
 }
 for(const page of best)if(page.portMap)page.portMap.presentation=page.portMap.bookletRole?'separate':'combined';
 if(sheets.size){
  // The builder sheet replaces that switch's faceplate map; its port
  // inventory tables stay.
  const placed=new Set(),out=[];
  for(const page of best){
   const id=page.portMap?.device;
   if(!id||!sheets.has(id)||page.portMap.bookletRole==='inventory'){out.push(page);continue;}
   if(placed.has(id))continue;placed.add(id);
   const d=switches.find(d=>d.id===id),ports=physicalPorts(d);
   out.push(...sheets.get(id).map((sheet,i)=>Object.assign(sheet,{family:'ports',title:'MDF Port Map',portMap:{device:id,devices:[id],shown:ports.length,total:ports.length,rowNames:[],portRecords:[],density:'compact',overview:true,bookletRole:i?'key':'map',presentation:'separate',switchportSheet:true}})));
  }
  best=out;
 }
 const ordered=[...best,...extra],isInventory=page=>page.portMap?.bookletRole==='inventory'||/^Port Inventory/.test(page.name);
 return [...ordered.filter(page=>!isInventory(page)),...ordered.filter(isInventory)];
}
function portMapsAtScale(project,db,plan){
 const {width:W,height:H}=pageGeometry(project,'ports');
 const switches=[...db.devices.values()].filter(d=>d.kind==='switch');if(!switches.length){const p=fresh('MDF Port Map','MDF Port Map','Port identity, state and configured assignment',project);empty(p,'No switch inventory was supplied.');return [p];}
 const out=[],options=project.layout?.portMap||{},filter=options.detailFilter||'all',group=options.groupConsecutive!==false,compact=options.density!=='expanded',separate=options.presentation!=='combined'&&(options.presentation==='separate'||options.repeatFaceplate!==true),repeat=!separate&&options.repeatFaceplate===true;
 if(compact&&group)return referencePortMaps(project,db,switches,options,plan);
 const palette=separate?portMapPalette(project,db):null;
 const columns=fitColumns(compact?[['INTERFACE',110],['CONNECTION / PURPOSE / DESCRIPTION',574],['LINK',130],['MODE / VLANS',314]]:[['INTERFACE',120],['CONNECTION / ASSIGNMENT',284],['LINK',140],['VLAN CONFIGURATION',272],['DESCRIPTION',312]],W-72),lineHeight=compact?14:16;
 const drawn=new Set();
 for(const d of plan.views){
  const ports=physicalPorts(d).sort(comparePorts),assignment=portAssignments(project,db,d,ports),records=[];let shown=0;
  for(const port of ports){
   const o=uplinkSettings(db.devices.get(d.id)||d,port),peers=db.links.flatMap(l=>l.a===d.id&&l.ap.toLowerCase()===o.name.toLowerCase()?[[l.b,l.bp]]:l.b===d.id&&l.bp.toLowerCase()===o.name.toLowerCase()?[[l.a,l.ap]]:[]);
   if(!hasPortDetails(o,peers.length>0,filter))continue;shown++;
   const assigned=assignment(port),peerNames=peers.map(([id,p])=>nameOf(db.devices.get(id))+(p?' / '+p:'')),vlan=[o.role?'Mode: '+o.role:'',o.native!=null&&value(o.native)!==''?'Native: '+value(o.native)+(o.nativeTagged?' (tagged)':''):'',o.tagged?.length?'Tagged: '+vlanSet(o.tagged):'',o.allowedExcept?.length?'Except: '+vlanSet(o.allowedExcept):'',o.voice!=null?'Voice: '+value(o.voice):'',o.lag?'LAG: '+o.lag:'',interfaceAddresses(o).length?'IP: '+interfaceAddresses(o).join(', '):''].filter(Boolean);
   const fields=[[assigned[0],...peerNames].join('\n'),[state(o.state)==='unknown'?'Not observed':state(o.state)==='up'?'Up':'Down',rate(o.speed)].filter(Boolean).join('\n'),vlan.join('\n'),o.description||''];
   const compactFields=[[assigned[0],...peerNames,o.description||''].filter(Boolean).join(' | '),[state(o.state)==='unknown'?'Unknown':state(o.state)==='up'?'Up':'Down',rate(o.speed)].filter(Boolean).join(' '),vlan.map(v=>v.replace(/^Mode: /,'').replace(/^Native: /,'N:').replace(/^Tagged: /,'T:')).join(' | ')];
   const signature=JSON.stringify(fields),previous=records.at(-1);if(group&&previous?.signature===signature&&consecutivePorts(previous.names.at(-1),o.name))previous.names.push(o.name);
   else records.push({names:[o.name],fields:compact?compactFields:fields,signature,color:portFills[assigned[1]],linkState:state(o.state)});
  }
  const rows=records.flatMap(record=>{const values=[interfaceList(record.names),...record.fields],lines=values.map((v,j)=>wrapPortText(v,columns[j][1]-20,12,j===0)),size=Math.max(...lines.map(l=>l.length)),chunks=[];
   for(let start=0;start<size;start+=7){const slice=lines.map(l=>l.slice(start,start+7));if(start&&!slice[0].length)slice[0]=[interfaceList(record.names),'(continued)'];chunks.push({...record,lines:slice,height:Math.max(compact?20:38,(compact?6:14)+Math.max(...slice.map(l=>l.length))*lineHeight)});}return chunks;
  });
  let at=0,sheet=0,repeatFits=true,legendPending=false;
  do{
   const p=fresh('MDF Port Map','MDF Port Map',nameOf(d)+'  |  '+deviceDetails(d,project)+(sheet?'  |  details continued':''),project),a=p.items,overview=sheet===0||repeat&&repeatFits;p.editScope=p.name+'|'+equipmentScope(d)+'|sheet:'+sheet;
   let summary=156,start=190;const frameCount=a.length;
   if(overview&&separate){
    // Builder sheet first (whole device, once). One row per interface uses the
    // switchport inventory table; the expanded density keeps its detail table.
    if(!drawn.has(d.id)){drawn.add(d.id);const whole=switches.find(x=>x.id===d.id)||d,wholePorts=physicalPorts(whole).sort(comparePorts),shownNames=wholePorts.filter(port=>{const o=uplinkSettings(db.devices.get(whole.id)||whole,port);return hasPortDetails(o,db.links.some(l=>l.a===whole.id&&l.ap.toLowerCase()===o.name.toLowerCase()||l.b===whole.id&&l.bp.toLowerCase()===o.name.toLowerCase()),filter);}).map(port=>port.name);
     out.push(...builderSheets(project,db,{device:whole,ports:wholePorts,shown:shownNames},palette,plan,{sheetLabel:drawn.size+' / '+new Set(plan.views.map(v=>v.id)).size}));}
    if(compact){out.push(...bookletInventory(project,db,d,ports,options,palette,false));break;}
   }else if(overview){
    const g=addDevice(p,project,d,[(W-plan.width)/2,159,plan.width,1],'panel',{fitWidth:true,padding:equipmentPadding});portNumbers(a,g,ports,{fill:port=>portFills[assignment(port)[1]],stateKey:true});
    {
     const legendTop=g.y+g.h+10,probe={...p,items:[]},end=referencePortLegend(probe,legendTop,new Set(ports.map(port=>assignment(port)[1])));
    if(end+40<=H-75+footerAllowance(project)){a.push(...probe.items);summary=end;start=summary+40;legendPending=false;}else{summary=H;start=H;legendPending=true;repeatFits=false;}
    }
   }else if(legendPending){summary=referencePortLegend(p,151,new Set(ports.map(port=>assignment(port)[1])));start=summary+40;legendPending=false;}
   if(summary<H-75+footerAllowance(project))label(a,38,summary,(W-80),20,shown+' of '+ports.length+' port records in details'+(shown<ports.length?'  |  '+(ports.length-shown)+' hidden by table filter':'')+'  |  '+(group?'Consecutive matching ports grouped':'One row per interface')+(compact?'  |  N: native, T: tagged':''),11,false,C.muted);
   const header=compact?27:31,canTable=start+header+(rows[at]?.height||20)<=(H-124+footerAllowance(project));
   if(!canTable)repeatFits=false;
   const tableStart=a.length;p.tableTop=start;
   if(canTable){rect(a,36,start,(W-72),header,'#E8F1F3');rect(a,36,start,3,header,C.teal);let x=36;for(const [title,w] of columns){label(a,x+10,start,w-20,header,title,11,true,C.teal);x+=w;}}
   let y=start+header,count=0;const rowNames=[];
   while(canTable&&at<rows.length&&y+rows[at].height<=(H-124+footerAllowance(project))){const row=rows[at++];rowNames.push(...row.names);rect(a,36,y,(W-72),row.height,count%2?'#F5F8FA':C.white);rect(a,36,y+row.height-1,(W-72),1,'#DCE5E9');rect(a,36,y+4,3,row.height-8,row.color);let x=36;
    row.lines.forEach((lines,j)=>{lines.forEach((text,k)=>{label(a,x+10,y+(compact?3:6)+k*lineHeight,columns[j][1]-20,lineHeight,text,12,j===0,j===0?C.teal:j===2&&k===0?stateMarks[row.linkState]:C.ink);Object.assign(a.at(-1),{portTableRole:j===0?'interface':'detail',full:true});});x+=columns[j][1];});y+=row.height;count++;
   }
   if(!rows.length&&canTable)label(a,49,start+46,(W-100),25,ports.length?'No ports match the selected table filter. All physical ports remain on the faceplate.':'No physical switch port records were supplied.',14,false,C.muted);
   for(const item of a.slice(tableStart))item.tableContent=true;
   p.portMap={device:d.id,shown,total:ports.length,rowNames:[...new Set(rowNames)],density:compact?'compact':'expanded',overview:!separate&&overview,...(separate?{bookletRole:'inventory'}:{})};if(separate)namePortInventory(p);out.push(p);sheet++;
  }while(at<rows.length||legendPending);
 }
 return out;
}
function wireless(project,db){
  return buildWirelessPages(project,db,{portNumbers,tablePages,empty});
}

function membershipMatrix(project,db) {
  const {width:W,height:H}=pageGeometry(project,'trunk'),nameWidth=Math.min(250,(W-72)*.24);
  const groups=[],names=new Map();
  for(const d of db.devices.values()){
    for(const v of list(d.vlans))if(Number.isInteger(+v.id))names.set(+v.id,names.get(+v.id)||v.name||'');
    if(d.kind!=='switch')continue;
    const profiles=new Map();
    for(const raw of portList(d)){
      const o=uplinkSettings(d,raw),native=Number(o.native),tagged=list(o.tagged);
      if(!(native>0)&&!tagged.length)continue;
      if(native>0&&!names.has(native))names.set(native,'');
      for(const id of tagged)if(Number(id)>0&&!names.has(+id))names.set(+id,'');
      const key=JSON.stringify([native,tagged]),g=profiles.get(key)||{device:nameOf(d),deviceId:d.id,ports:[],native,tagged};
      g.ports.push(o.name);profiles.set(key,g);
    }
    groups.push(...profiles.values());
  }
  if(!groups.length||!names.size)return [];
  const pages=[],ids=[...names.keys()].sort((a,b)=>a-b);
  // Measure actual headings and rows, then choose the fewest sheets across
  // the whole matrix. A fixed six-column cap wastes space on short labels.
  const rowSizes=ids.map(id=>({id,height:Math.max(26,wrapPortText(id+'    '+(names.get(id)||''),nameWidth,14,true).length*17+8)}));
  const left=53+nameWidth,width=W-36-left,limit=Math.floor(width/72),plans=new Array(groups.length+1);
  plans[groups.length]={pages:0,splits:0,headerArea:0};
  for(let at=groups.length-1;at>=0;at--){
    for(let count=1;count<=Math.min(limit,groups.length-at);count++){
      const batch=groups.slice(at,at+count),colW=width/count,headings=batch.map(g=>({g,nameHeight:Math.max(22,wrapPortText(g.device,colW-8,14,true).length*17),portsHeight:Math.max(18,wrapPortText(interfaceList(g.ports),colW-8,12).length*15),taggedHeight:Math.max(17,wrapPortText(vlanSet(g.tagged),colW-8,11).length*14)})),headerHeight=Math.max(69,...headings.map(h=>h.nameHeight+h.portsHeight+h.taggedHeight+12)),top=188+headerHeight;
      if(rowSizes.some(row=>top+row.height>(H-124+footerAllowance(project)))||!plans[at+count])continue;
      const buckets=[];let bucket=[],height=0;
      for(const row of rowSizes){if(bucket.length&&top+height+row.height>(H-124+footerAllowance(project))){buckets.push(bucket);bucket=[];height=0;}bucket.push(row);height+=row.height;}if(bucket.length)buckets.push(bucket);
      const tail=plans[at+count],candidate={batch,colW,headings,headerHeight,top,buckets,next:at+count,pages:buckets.length+tail.pages,splits:buckets.length-1+tail.splits,headerArea:headerHeight*buckets.length+tail.headerArea},best=plans[at];
      if(!best||candidate.pages<best.pages||candidate.pages===best.pages&&(candidate.splits<best.splits||candidate.splits===best.splits&&candidate.headerArea<best.headerArea))plans[at]=candidate;
    }
  }
  if(!plans[0])throw Error('A trunk-matrix label needs more room than one page. Shorten its device, interface or VLAN name.');
  for(let at=0;at<groups.length;at=plans[at].next){
    const {batch,colW,headings,headerHeight,top,buckets}=plans[at];
    for(const rows of buckets){
    const p=fresh('Trunk VLANs','Trunk VLANs','Native and tagged VLANs by configured interface group',project),a=p.items;p.sourceDeviceIds=[...new Set(batch.map(g=>g.deviceId))];
    label(a,36,150,(W-72),25,'N   Native / untagged       T   Tagged       ·   Outside configured membership',13,true,C.muted);
    rect(a,36,188,(W-72),headerHeight,C.ink);label(a,49,188,nameWidth-5,headerHeight,'VLAN / Name',15,true,C.white);
    headings.forEach(({g,nameHeight,portsHeight,taggedHeight},i)=>{const x=left+i*colW+4;
      label(a,x,193,colW-8,nameHeight,g.device,14,true,C.white,'center');
      label(a,x,193+nameHeight,colW-8,portsHeight,interfaceList(g.ports),12,false,C.white,'center');
      label(a,x,193+nameHeight+portsHeight,colW-8,taggedHeight,vlanSet(g.tagged),11,false,C.white,'center');
    });
    let y=top;rows.forEach(({id,height},i)=>{rect(a,36,y,(W-72),height,i%2?C.pale:C.white);
      label(a,48,y,nameWidth,height,id+'    '+(names.get(id)||''),14,true);
      batch.forEach((g,j)=>{const x=left+(j+.5)*colW,ch=g.native===id?'N':g.tagged.some(k=>String(k).toLowerCase()==='all'||Number(k)===id)?'T':'·';
        if(ch!=='·')rect(a,x-18,y+(height-22)/2,36,22,ch==='N'?C.ink:'#D7ECE8');
        label(a,x-19,y+(height-24)/2,38,24,ch,13,true,ch==='N'?C.white:C.ink,'center');
      });y+=height;
    });pages.push(p);
    }
  }
  return pages;
}
function logical(project,db,options={}){
  const sections=documentationSections(project,db.devices.values()).filter(section=>!section.inventory),trunks=[],includeTrunks=options.includeTrunks||includeTrunkReference(project),showLogical=sections.length||documentationMode(project)==='full'||savedReportLayout(project,'logical')||options.includeLogical;
  for(const d of db.devices.values()){
    if(!includeTrunks)break;
    const name=nameOf(d);
    const profiles=new Map();
    portList(d).forEach(port=>{
      const o=uplinkSettings(d,port);
      if(!value(o.tagged)&&!value(o.lag)&&!/trunk|uplink/i.test(value(o.role)))return;
      const values=[value(o.native)||'Unspecified',vlanSet(o.tagged)||'Unspecified',value(o.lag),value(o.description)],key=JSON.stringify(values);
      if(!profiles.has(key))profiles.set(key,{names:[],values});
      profiles.get(key).names.push(o.name);
    });
    for(const g of profiles.values())trunks.push(Object.assign([name,interfaceList(g.names),...g.values],{sourceDeviceId:d.id}));
  }
  const matrix=includeTrunks?membershipMatrix(project,db):[];
  return [...(showLogical?logicalPages(project,sections,{compact:documentationMode(project)==='concise',omitEmpty:documentationMode(project)==='concise'}):[]),
    ...(includeTrunks?(matrix.length?matrix:tablePages(project,'Trunk VLANs','Native and tagged VLAN membership on trunks and aggregates',[['Device',243],['Interface',164],['Native VLAN',145],['Tagged VLANs',235],['LAG',94],['Description',247]],trunks,'No trunk, tagged-port or aggregate records were supplied.')):[])];
}
export function buildPages(project={},options={}){
  const db=inventory(project),cached=(family,build)=>cachedDraftPages(options.cache,family,project,build),pages=[...cached('core',()=>corePages(project,physicalInventory(db))),...cached('ports',()=>portMaps(project,db)),...cached('wireless',()=>wireless(project,physicalInventory(db))),...cached('logical',()=>logical(project,db)),...cached('switchports',()=>buildSwitchportReports(project))];
  for(const report of cleanReportPages(project.layout?.reportPages,(project.devices||[]).map(d=>d.id))){
    const selected=new Set(report.devices),copy={...project,devices:(project.devices||[]).filter(d=>selected.has(d.id)),links:(project.links||[]).filter(l=>selected.has(l.a)&&selected.has(l.b)),_reportPrefix:'report:'+report.id},data=inventory(copy);
    const generated=report.family==='ports'?portMaps(copy,data):report.family==='wireless'?wireless(copy,physicalInventory(data)):logical(copy,data,{includeTrunks:report.family==='trunk',includeLogical:report.family==='logical'}).filter(p=>pageFamily(p.title)===report.family);
    generated.forEach((p,i)=>{p.reportId=report.id;p.sourceDeviceIds=report.devices;p.displayName=report.name+(generated.length>1?' '+(i+1):'');});pages.push(...generated);
  }
  const totals=new Map(),seen=new Map();
  for(const p of pages)totals.set(p.name,(totals.get(p.name)||0)+1);
  pages.forEach(p=>{
    const n=(seen.get(p.name)||0)+1;seen.set(p.name,n);
    if(totals.get(p.name)>1)p.name+=' '+n;
  });
  const visible=pages.filter(p=>!presentation(project,p).hidden);
  pages.forEach(p=>{
    p.labelBacking=cleanLabelBacking(project.layout?.labelBacking);
    applyDrawingEdits(p,project);p.displayName=displayPageName(project,p);for(const item of p.items.filter(i=>i.pageTitle)){item.value=project.layout?.drawingEdits?.[item.editKey]?.value??p.displayName;item.w=Math.max(item.w,textWidth(item.value,item.size,true));}
    // Switchport sheets already reserve measured headers, keys and footers.
    // Keep their readable number/marker layout intact while allowing ordinary
    // object edits and uniform drawing scale like the other page families.
    if(p.switchportReport){if(p.family==='ports')for(const item of p.items.filter(i=>i.reportFooterRole==='page')){item.value=project.layout?.drawingEdits?.[item.editKey]?.value??pageNumber(project.layout?.pageNumbers,Math.max(0,visible.indexOf(p)),visible.length);if(!project.layout?.drawingEdits?.[item.editKey]){item.x=p.width-264;item.w=240;item.h=24;}}scalePage(p,project);fitVisiblePage(p,project);p.svg=svgPage({...p,title:p.displayName});return;}
    if(p.title==='Wireless Connections'){linkLegend(p);applyDrawingEdits(p,project);}bridge(p,{style:hopStyle(project)});fitDynamicPage(p,project);
    const bottom=(p.originY||0)+p.height,right=(p.originX||0)+p.width;
    if(cleanPageNumbers(project.layout?.pageNumbers).footer){rect(p.items,36,bottom-47,right-72,1,C.rule);p.items.at(-1).pageFrame='footer-rule';label(p.items,36,bottom-39,right-228,21,p.displayName,12,false,C.muted);p.items.at(-1).pageFrame='footer-name';}const number=pageNumber(project.layout?.pageNumbers,Math.max(0,visible.indexOf(p)),visible.length);if(number!=null){label(p.items,right-200,bottom-40,164,22,number,13,true,C.teal,'right');Object.assign(p.items.at(-1),{editKey:p.name+'|page-number',pageFrame:'footer-number'});}
    applyDrawingEdits(p,project);if(!p.coreDeviceIds&&(project.layout?.presentation?.pages?.[p.name]?.panel||project.layout?.presentation?.pages?.[p.name.split('|')[0]]?.panel||Object.entries(presentation(project,p).panel).some(([k,v])=>k==='visible'?!v:k==='position'?v!=='left':k==='width'?v!==244:['scale','textScale'].includes(k)?v!==1:k==='sections'?v.some(k=>!['connections','modules'].includes(k)):false)))informationPanel(p,project);scaleText(p,project);applyGlobalTextStyles(p,project.layout?.textStyles,project.layout?.drawingEdits);dockInformationPanel(p,project);fitDynamicPage(p,project,{footer:true});scalePage(p,project);fitVisiblePage(p,project);p.svg=svgPage({...p,title:p.displayName});
  });
  return options.includeHidden?pages:visible;
}
export function printDocument(pages){
 return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Network documentation</title><style>*{box-sizing:border-box}body{margin:0;background:#e9edef}section{background:white;margin:12px auto;break-after:page;page-break-after:always}section:last-child{break-after:auto;page-break-after:auto}svg{display:block;width:100%;height:100%}@media print{body{background:white}section{margin:0}}'+printPageStyles(pages)+'</style><body id="print-set">'+pages.map(p=>'<section aria-label="'+xml(p.displayName||p.name)+'">'+svgPage({...p,title:p.displayName||p.title})+'</section>').join('')+'</body></html>';
}
