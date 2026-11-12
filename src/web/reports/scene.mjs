import {label,rect} from '../diagram/scene.mjs';
import {textWidth,intersects} from '../diagram/labels.mjs';
import {wrapPortText} from '../port-table.mjs';
import {portLabelLayout,portLabelText} from '../diagram/port-label-layout.mjs';
import {aggregateKey,markerVlans,nativeFill,vlanIds,voiceVlan,luminance} from './palette.mjs';
import {taggedText,reportText} from './model.mjs';
import {reportPageGeometry,reportPageLabel} from './paper.mjs';

export const reportPaper=reportPageGeometry();
const ink='#16364a',muted='#536779',rule='#cedce0',navy='#203746',pale='#eef4f6',MARGIN=24,bodyFont=10;
// The drawing set may request its page margin (Paper & print → Page margin);
// standalone Switchport report outputs keep the 24-unit default.
const marginOf=request=>Number.isFinite(request?.margin)&&request.margin>=0?request.margin:MARGIN;
const normalStyle={scale:1,numberFont:10,groupFont:11,markerRadius:2.1,compact:false};
const compactStyles=[.9,.8,.7,.6,.55].map(scale=>({scale,numberFont:scale>=.8?9:8,groupFont:10,markerRadius:Math.max(1.5,2.1*scale),compact:true}));
// Port maps in the drawing set fill their sheet: jacks, VLAN dots and numbers
// grow together while the complete map and key still fit.
const largeStyles=[1.8,1.6,1.45,1.3,1.15].map(scale=>({scale,numberFont:Math.min(14,Math.round(10*Math.sqrt(scale)*10)/10),groupFont:Math.min(14,Math.round(11*Math.sqrt(scale)*10)/10),markerRadius:2.1*scale,compact:false}));
const unique=values=>[...new Set(values)],rows=value=>Array.isArray(value)?value:[],value=(object,key)=>object?.[key]??Object.entries(object||{}).find(([name])=>name.toLowerCase()===key.toLowerCase())?.[1];
export class ReportCapacityError extends Error{constructor(message,details={}){super(message);this.code='SWITCHPORT_REPORT_CAPACITY';Object.assign(this,details);}}
function text(items,x,y,w,value,size=bodyFont,bold=false,color=ink,align='left',extra={}){
 const lines=wrapPortText(value,w,size,bold),h=Math.max(size*1.2,lines.length*size*1.2);label(items,x,y,w,h,value,size,bold,color,align);Object.assign(items.at(-1),{full:true,...extra});return h;
}
function ellipse(items,x,y,w,h,fill,stroke=ink,weight=.65,extra={}){items.push({type:'ellipse',x,y,w,h,fill,stroke,weight,...extra});}
function diamond(items,x,y,size,fill,stroke=ink,weight=.7,extra={}){items.push({type:'vector',commands:[['M',x+size/2,y],['L',x+size,y+size/2],['L',x+size/2,y+size],['L',x,y+size/2],['Z']],fill,stroke,weight,...extra});}
function logoDimensions(data){
 try{const bytes=Uint8Array.from(atob(data.split(',')[1]),character=>character.charCodeAt(0)),view=new DataView(bytes.buffer);if(bytes[0]===137&&bytes[1]===80)return {w:view.getUint32(16),h:view.getUint32(20)};for(let at=2;at+9<bytes.length;){if(bytes[at]!==255)break;const marker=bytes[at+1],length=view.getUint16(at+2);if([192,193,194].includes(marker))return {w:view.getUint16(at+7),h:view.getUint16(at+5)};if(length<2)break;at+=length+2;}}catch{}return {w:2,h:1};
}
// A request may carry its own sheet (port maps default to US Letter).
const paperOf=request=>{
 const requested=request?.paper;
 // Diagram port maps already supply a complete drawing-paper geometry.
 // Switchport report options supply only the paper name and orientation.
 if(requested&&Number.isFinite(requested.width)&&Number.isFinite(requested.height)&&requested.width>0&&requested.height>0)
  return {...requested,orientation:requested.orientation|| (requested.width>=requested.height?'landscape':'portrait'),
   widthMm:requested.widthMm||requested.width*25.4/96,heightMm:requested.heightMm||requested.height*25.4/96};
 return reportPageGeometry(requested);
};
function page(request,name,title,subtitle,role,ids,width=paperOf(request).width,height=paperOf(request).height,compact=false){const margin=marginOf(request);
 const sheet=paperOf(request),titleSize=compact?18:20,subtitleSize=compact?10:10.5,p={reportMargin:margin,dense:!!request?.fill,name:'Switchport reports|'+name,title,displayName:title,family:'switchports',switchportReport:true,role,sourceDeviceIds:[...ids],width,height,widthMm:width*25.4/96,heightMm:height*25.4/96,paper:{preset:sheet.preset||'custom',orientation:sheet.orientation|| (width>=height?'landscape':'portrait'),widthMm:width*25.4/96,heightMm:height*25.4/96},items:[],compact},a=p.items,logo=request.logoDataUrl,inset=Number.isFinite(request?.margin)?margin:0,textX=inset?inset+12:margin,available=width-textX*2-(logo?130:0),titleHeight=Math.max(titleSize*1.2,wrapPortText(title,available,titleSize,true).length*titleSize*1.2),subtitleHeight=Math.max(subtitleSize*1.2,wrapPortText(subtitle,available,subtitleSize).length*subtitleSize*1.2),headerHeight=titleHeight+subtitleHeight+(compact?14:30);
 // Drawing-set port maps keep their header band inside the page margin on
 // every edge; standalone Switchport report outputs keep their full-width band.
 rect(a,inset,inset,width-inset*2,headerHeight,navy,'none',1,inset?6:0);Object.assign(a.at(-1),{editKey:p.name+'|header-band',reportHeaderBand:true});text(a,textX,inset+(compact?5:12),available,title,titleSize,true,'#ffffff','left',{editKey:p.name+'|title'});text(a,textX,inset+(compact?8:18)+titleHeight,available,subtitle,subtitleSize,false,'#dce9ee','left',{editKey:p.name+'|subtitle'});p.contentTop=inset+headerHeight+(compact?8:16);
 if(logo){const dims=logoDimensions(logo),h=Math.min(headerHeight-20,48),w=Math.min(112,h*dims.w/dims.h),actualH=w*dims.h/dims.w,lx=width-textX-w-4,ly=inset+(headerHeight-actualH)/2;rect(a,lx-4,ly-4,w+8,actualH+8,'#ffffff','none');Object.assign(a.at(-1),{reportLogoBacking:true,editKey:p.name+'|logo-backing'});a.push({type:'device',kind:'logo',key:p.name+'|logo',editKey:p.name+'|logo',masterKey:'report-logo:'+logo.slice(-120),name:'Report logo',x:lx,y:ly,w,h:actualH,ports:{},children:[],asset:{name:'Report logo',width:dims.w,height:dims.h,dataUrl:logo}});}
 return p;
}
// Port maps carry the builder's cable-move safety note at their foot, with or
// without the page footer.
export const CABLE_MOVE_NOTE='Confirm live link, LLDP/CDP, and MAC address table before moving production cables.';
const MAP_ROLES=new Set(['onePage','wall','workspace']);
function finish(p,request,palette,inventory,index=1,count=1){const margin=p.reportMargin??MARGIN;
 // The footer band sits just inside the bottom page margin (47 units up on
 // the builder's 24-unit margin), so a margin setting moves it with the map.
 const a=p.items,footer=request.pageFooter?.footer!==false,y=footer?p.height-margin-23:p.height-margin-15,room=p.width-margin*2-(request.pageFooter?.show?252:100),separate='Configured settings and observed state remain separate.';
 if(footer)rect(a,margin,y,p.width-margin*2,1,rule);
 const note=MAP_ROLES.has(p.role)?(footer&&textWidth(CABLE_MOVE_NOTE+'  '+separate,9)<=room?CABLE_MOVE_NOTE+'  '+separate:CABLE_MOVE_NOTE):footer?separate:'';
 if(note)text(a,margin,y+(footer?8:4),room,note,9,false,muted,'left',{editKey:p.name+'|footer-note',reportFooterRole:MAP_ROLES.has(p.role)?'safety':'note'});
 if(request.pageFooter?.show!==false)text(a,p.width-margin-95,y+(footer?8:4),95,index+' / '+count,9,false,muted,'right',{reportFooterRole:'page'});
 // Text without its own key is keyed by its generated wording, so an edit
 // stays with that text when the sheet is repacked; the older index key is
 // kept as a fallback for edits saved before.
 const seen=new Map();
 for(const [n,item] of a.entries()){
  if(item.editKey)continue;
  if(item.type!=='text'){item.editKey=p.name+'|item|'+n;continue;}
  let hash=0;for(const c of JSON.stringify([item.value,item.labelRole]))hash=Math.imul(hash,31)+c.charCodeAt(0)|0;
  const base=p.name+'|text|'+hash,count=seen.get(base)||0;seen.set(base,count+1);item.editKey=base+'|'+count;item.legacyEditKey=p.name+'|item|'+n;
 }
 p.reportPalette=palette;p.reportInventory=inventory?.hostname;p.reportSourceVersion='1.18.5';return p;
}
export function numberReportPages(pages){return pages.map((p,index)=>({...p,items:p.items.map(item=>item.reportFooterRole==='page'?{...item,value:(index+1)+' / '+pages.length}:item)}));}
// '*' marks a trunk whose tagged VLANs come from a policy (all, or all
// except some); its dots show the VLANs that policy allows.
const POLICY_KEY='All VLANs allowed (trunk policy)';
function symbolKeyItems(inventory){
 const titles=['Native VLAN','Tagged VLAN','Voice VLAN','LAG / trunk'];
 if(inventory.ports.some(port=>port.stackLink))titles.push('Stack / VSF');
 if(inventory.ports.some(port=>port.disabled))titles.push('Disabled');
 if(inventory.ports.some(port=>port.taggedVlanPolicy))titles.push(POLICY_KEY);
 return titles;
}
function symbolKeyHeight(inventory,width){
 let x=0,rows=1;
 for(const title of symbolKeyItems(inventory)){
  const step=textWidth(title,10)+35;
  if(x>0&&x+step>width){rows++;x=0;}x+=step;
 }
 return rows*18-1;
}
function symbolKey(p,y,palette,inventory){
 const a=p.items,margin=p.reportMargin??MARGIN;let x=margin,lineY=y;
 const example=Object.values(palette.vlans)[0]||'#b9cfdf',outline=Object.values(palette.aggregates)[0]||'#486ba4';
 const entry=(title,paint)=>{
  const step=textWidth(title,10)+35;
  if(x>margin&&x+step>p.width-margin){x=margin;lineY+=18;}
  paint(x,lineY);text(a,x+19,lineY,Math.max(70,textWidth(title,10)),title,10,false,muted);x+=step;
 };
 entry('Native VLAN',(x,y)=>rect(a,x,y+2,12,10,example,ink,.65,2));
 entry('Tagged VLAN',(x,y)=>ellipse(a,x+2,y+3,8,8,example));
 entry('Voice VLAN',(x,y)=>diamond(a,x+1,y+2,10,example));
 entry('LAG / trunk',(x,y)=>rect(a,x,y+2,12,10,'#ffffff',outline,2,2.5));
 if(inventory.ports.some(port=>port.stackLink))entry('Stack / VSF',(x,y)=>rect(a,x,y+2,12,10,'#000000','none',1,2));
 if(inventory.ports.some(port=>port.disabled))entry('Disabled',(x,y)=>text(a,x+1,y,12,'!',11,true));
 if(inventory.ports.some(port=>port.taggedVlanPolicy))entry(POLICY_KEY,(x,y)=>{label(a,x+1,y,12,14,'*',13,true,ink,'center');});
 return lineY+17;
}
function mergeInventories(items){return {hostname:'Workspace',ports:items.flatMap(item=>item.inventory.ports),vlans:items.flatMap(item=>item.inventory.vlans),groups:items.flatMap(item=>item.inventory.groups)};}
// Port-map sheets use the builder's dense key: one line per VLAN or LAG,
// up to five columns.
// Port-map sheets use the builder's dense key: one line per VLAN or LAG, up
// to five columns. VLANs and LAGs each have their own heading, and a long key
// uses smaller type (within reason) so the map keeps its room.
function keySections(inventory,palette,width,compact=false,dense=false){
 const ids=vlanIds(inventory),lagIds=unique(inventory.ports.map(port=>aggregateKey(port.aggregate)).filter(Boolean)),count=ids.length+lagIds.length,font=dense?(count>40?8.5:count>20?9:10):10,line=font*1.2;
 const columns=Math.max(1,Math.min(dense?5:4,Math.floor(width/((dense?190:230)*font/10)))),columnWidth=width/columns,vlans=ids.map(id=>({id,vlan:true,voice:inventory.vlans.some(vlan=>vlan.id===id&&vlan.voice)||inventory.ports.some(port=>port.voiceVlan===id),fill:palette.vlans[id],title:'VLAN '+id+(inventory.vlans.some(vlan=>vlan.id===id&&vlan.voice)||inventory.ports.some(port=>port.voiceVlan===id)?' / Voice':''),names:(palette.aliases[id]||[]).join(' / ')}));
 if(inventory.ports.some(port=>!port.stackLink&&!port.untaggedVlan&&port.untaggedState!=='None'))vlans.push({id:'unknown',fill:'#e6e6e6',title:'Native not supplied',names:''});
 if(inventory.ports.some(port=>!port.stackLink&&!port.untaggedVlan&&port.untaggedState==='None'))vlans.push({id:'none',fill:'#ffffff',title:'No native VLAN',names:''});
 const lags=lagIds.map(aggregate=>({id:'lag:'+aggregate,fill:'#ffffff',stroke:palette.aggregates[aggregate],title:'LAG / trunk '+aggregate,names:inventory.ports.filter(port=>aggregateKey(port.aggregate)===aggregate).map(port=>port.id).join(', ')}));
 const layout=entries=>{
  if(dense)for(const entry of entries){entry.title=(/^VLAN /.test(entry.title)?entry.title.slice(5):/^LAG \/ trunk /.test(entry.title)?entry.title.slice(12):entry.title)+(entry.names?(entry.id.startsWith?.('lag:')?': ':'  ')+entry.names:'');entry.names='';}
  for(const entry of entries){entry.font=font;entry.titleHeight=wrapPortText(entry.title,columnWidth-(dense?44:30),font,!dense).length*line;entry.namesHeight=entry.names?wrapPortText(entry.names,columnWidth-30,font).length*line:compact||dense?0:line;}
  const rows=[];for(let offset=0;offset<entries.length;offset+=columns){const row=entries.slice(offset,offset+columns),height=Math.max(...row.map(entry=>entry.titleHeight+entry.namesHeight))+(dense?3:compact?6:8);rows.push({entries:row,height,columns,columnWidth});}
  return rows;
 };
 return [{key:'vlans',title:'VLANs',rows:layout(vlans)},{key:'lags',title:'LAGs / trunks',rows:layout(lags)}].filter(section=>section.rows.length);
}
function keyRows(inventory,palette,width,compact=false,dense=false){return keySections(inventory,palette,width,compact,dense).flatMap(section=>section.rows);}
// Drawing-set maps keep it to one small muted note (no heading).
const basisNote=basis=>'Uplink module unconfirmed: '+basis.text;
function basisHeight(inventory,width,compact=false,dense=false){const basis=uplinkBasis(inventory);if(!basis)return 0;if(dense)return wrapPortText(basisNote(basis),width,9).length*9*1.2+(compact?4:6);return (compact?18:23)+wrapPortText(basis.text,width,9.5).length*9.5*1.2+(compact?4:6);}
function legendHeight(inventory,palette,width,compact=false,dense=false){return keySections(inventory,palette,width,compact,dense).reduce((height,section)=>height+(compact?18:23)+section.rows.reduce((sum,row)=>sum+row.height,0)+(compact?2:4),0)+basisHeight(inventory,width,compact,dense)+symbolKeyHeight(inventory,width)+(compact?7:13);}
function legend(p,y,inventory,palette,{continued=false}={}){const margin=p.reportMargin??MARGIN;
 const a=p.items,w=p.width-margin*2;
 for(const section of keySections(inventory,palette,w,p.compact,p.dense)){
  text(a,margin,y,w,section.title+(continued?' / continued':''),p.compact?11:12,true,ink,'left',{editKey:p.name+'|key-heading|'+section.key,reportKeyHeading:section.key});y+=p.compact?18:23;
  for(const row of section.rows){for(let column=0;column<row.entries.length;column++){const entry=row.entries[column],x=margin+column*row.columnWidth;rect(a,x,y+1,14,12,entry.fill,entry.stroke||muted,entry.stroke?2:.7,2.5);const marked=p.dense&&entry.vlan,tx=marked?x+36:x+22;
    if(marked){const extra={editKey:p.name+'|key|'+entry.id+'|marker',reportKeyMarker:entry.id};if(entry.voice)diamond(a,x+18,y+1.5,11,entry.fill,'#263c49',.5,extra);else ellipse(a,x+18.5,y+2,10,10,entry.fill,'#263c49',.5,extra);}
    text(a,tx,y,row.columnWidth-(marked?44:30),entry.title,entry.font,!p.dense,ink,'left',{reportKeyTitle:entry.id});if(entry.names)text(a,x+22,y+entry.titleHeight,row.columnWidth-30,entry.names,entry.font,false,muted,'left',{reportKeyNames:entry.id});}y+=row.height;}
  y+=p.compact?2:4;
 }
 y=drawBasis(p,y,inventory,w);
 return symbolKey(p,y+(p.compact?1:5),palette,inventory)+(p.compact?5:8);
}
// The builder's uplink note for an unconfirmed module, under its own heading.
function drawBasis(p,y,inventory,width,x=p.reportMargin??MARGIN,dense=p.dense){const basis=uplinkBasis(inventory);if(!basis)return y;if(dense){const h=text(p.items,x,y,width,basisNote(basis),9,false,muted,'left',{editKey:p.name+'|uplink-basis',reportUplinkBasis:true});return y+h+(p.compact?4:6);}text(p.items,x,y,width,basis.title,p.compact?11:12,true,ink,'left',{editKey:p.name+'|key-heading|uplinks',reportKeyHeading:'uplinks'});y+=p.compact?18:23;const h=text(p.items,x,y,width,basis.text,9.5,false,muted,'left',{editKey:p.name+'|uplink-basis',reportUplinkBasis:true});return y+h+(p.compact?4:6);}
// Port descriptions go under the key when every one of them fits the space
// left on the sheet; otherwise they stay in the Port Inventory pages.
function describedPorts(inventory){return (inventory.ports||[]).filter(port=>String(port.description||'').trim()&&String(port.description).trim()!==port.id).map(port=>({id:port.id,text:String(port.description).trim()}));}
function descriptionLayout(inventory,width,font=9){
 const entries=describedPorts(inventory);if(!entries.length)return {entries,height:0};
 const columns=Math.max(1,Math.min(4,Math.floor(width/250))),columnWidth=width/columns,line=font*1.2,idWidth=Math.min(columnWidth*.4,Math.max(...entries.map(entry=>textWidth(entry.id,font,true)))+6),rows=[];
 // Read down each column, then across, like the Port Inventory tables.
 const perColumn=Math.ceil(entries.length/columns),ordered=[];for(let r=0;r<perColumn;r++)for(let c=0;c<columns;c++){const entry=entries[c*perColumn+r];if(entry)ordered.push({...entry,column:c});}
 for(let offset=0;offset<ordered.length;){const row=[];while(offset<ordered.length&&(!row.length||ordered[offset].column>row.at(-1).column))row.push(ordered[offset++]);rows.push(row);}
 for(let r=0;r<rows.length;r++){const row=rows[r].map(entry=>({...entry,h:Math.max(1,wrapPortText(entry.id,idWidth,font,true).length,wrapPortText(entry.text,columnWidth-idWidth-10,font).length)*line}));rows[r]={entries:row,height:Math.max(...row.map(entry=>entry.h))+2};}
 return {entries,rows,columns,columnWidth,idWidth,font,height:20+rows.reduce((sum,row)=>sum+row.height,0)+4};
}
function drawDescriptions(p,y,inventory,limit){
 const margin=p.reportMargin??MARGIN,a=p.items,layout=descriptionLayout(inventory,p.width-margin*2);
 if(!layout.entries.length||y+layout.height>limit)return y;
 text(a,margin,y,p.width-margin*2,'Port descriptions',p.compact?11:12,true,ink,'left',{editKey:p.name+'|key-heading|descriptions',reportKeyHeading:'descriptions'});y+=20;
 for(const row of layout.rows){row.entries.forEach(entry=>{const x=margin+entry.column*layout.columnWidth;text(a,x,y,layout.idWidth,entry.id,layout.font,true,ink,'left',{editKey:p.name+'|description|'+entry.id+'|port',reportDescription:entry.id});text(a,x+layout.idWidth,y,layout.columnWidth-layout.idWidth-10,entry.text,layout.font,false,muted,'left',{editKey:p.name+'|description|'+entry.id,reportDescription:entry.id});});y+=row.height;}
 p.reportDescriptions=layout.entries.length;return y+4;
}
// The lowest point content may reach above the footer band and safety note.
const contentLimit=p=>p.height-(p.reportMargin??MARGIN)-27;
function modelLabel(inv){return inv.reportModel||inv.chassisModel||unique(inv.groups.filter(group=>!group.slot).map(group=>group.product).filter(Boolean)).join(' / ');}
function displayName(inv){return unique(inv.devices.filter(detail=>!detail.parentId&&detail.name).map(detail=>detail.name)).join(' / ')||inv.hostname;}
// A group heading names the member or slot, its model number (for example
// JL256A) and its hardware (for example 48 RJ-45 + 4 SFP+), then the device
// details entered for it while they still fit on the heading's line.
// "GigabitEthernet0/49" -> "Gi49", "TenGigabitEthernet0/1" -> "Te1": the
// builder's labels for the sockets of an unconfirmed module.
export function shortInterface(id){
 const m=String(id).match(/^([A-Za-z-]+)[\d/.]*?(\d+)$/);if(!m)return String(id);
 const kind=m[1].toLowerCase(),prefix=kind.startsWith('ten')?'Te':kind.startsWith('twentyfive')?'Twe':kind.startsWith('forty')?'Fo':kind.startsWith('hundred')?'Hu':m[1].slice(0,2).replace(/^./,c=>c.toUpperCase());
 return prefix+m[2];
}
// A 3560-E 48-port switch takes X2 modules or TwinGig converters in its two
// uplink bays (the Switchport builder's CiscoHardware.Is3560E48).
const is3560E48=inv=>inv.groups.some(group=>!group.configuredInterfaces&&/3560-?E[- ]?48|WS-C3560E-48/i.test(String(group.product||'')+' '+String(inv.model||'')));
// The builder's note under the key when a module is unconfirmed.
function uplinkBasis(inv){
 if(!inv.groups.some(group=>group.configuredInterfaces&&group.socketLayout?.length))return null;
 return {title:'Uplink configuration - installed sockets unconfirmed',text:(is3560E48(inv)?'Upper bay: Te1 OR Gi49/Gi50. Lower bay: Te2 OR Gi51/Gi52. ':'')+'Each interface retains its own saved settings; alternatives do not add installed sockets.'};
}
export function hardwareSummary(group){
 // Interfaces of an unconfirmed module have no known media to count.
 if(group.configuredInterfaces)return '';
 const counts=new Map();for(const socket of group.socketLayout||[]){const media=/RJ|copper/i.test(socket.media)?'RJ-45':socket.media||'port';counts.set(media,(counts.get(media)||0)+1);}
 if(!counts.size){if(group.copper)counts.set('RJ-45',group.copper);if(group.optical)counts.set(group.opticalType||'SFP',group.optical);}
 return [...counts].sort(([a],[b])=>(b==='RJ-45')-(a==='RJ-45')).map(([media,n])=>n+' '+media).join(' + ');
}
// On drawing-set maps an unconfirmed module's heading is one short line
// ("Uplink interfaces"); its alternatives are a small note under the key.
function groupTitle(inv,group,width=Infinity,font=11,fill=false){
 const short=fill&&group.configuredInterfaces,detail=inv.devices.find(detail=>detail.id===(group.slot?group.device+'/'+group.slot:group.device)),members=unique(inv.groups.map(row=>row.device)),identity=group.slot?(members.length>1?'Member '+group.device+' / ':'')+(group.rear?'Rear module ':'Slot ')+group.slot:members.length>1?'Member '+group.device:group.rear?'Rear panel':short?String(group.id).replace(/\s*-\s*module unconfirmed$/i,''):group.id;
 let title=[identity,group.product,hardwareSummary(group),group.configuredInterfaces&&!short?(is3560E48(inv)?'X2 / TwinGig alternatives':'Configured interfaces'):''].filter(Boolean).join(' | ');
 for(const part of [detail?.name,detail?.serialNumber?'S/N '+detail.serialNumber:'',detail?.assetTag?'Asset '+detail.assetTag:''].filter(Boolean))if(textWidth(title+' | '+part,font,true)<=width)title+=' | '+part;
 return title;
}
// Drawing-set port maps share one reference socket width: the narrowest at
// which every port holds all of its tagged dots at the builder's smallest
// marker (radius 1.5) in a centered grid, optical faces taking the full row
// height where they need it (as opticalFaces draws them).
export function standardPortMapWidth(inv){
 const specs=inv.groups.flatMap(group=>group.socketLayout.map(socket=>({socket,port:inv.ports.find(port=>port.group===group.id&&port.number===socket.number)}))).filter(row=>row.port&&markerVlans(inv,row.port).length);
 const fits=w=>specs.every(({socket,port})=>{const optical=!/RJ|copper/i.test(socket.media),h=w*(optical?OPTICAL_HEIGHT.tall:23.2/25.2);return largestDot(markerVlans(inv,port).length,dotArea(0,0,w,h,dotReserve(port,optical,normalStyle.numberFont,true,true)))>=1.5;});
 let width=16;while(width<=512&&!fits(width))width+=.5;
 if(width>512)throw new ReportCapacityError('VLAN membership exceeds readable marker capacity. Use the complete inventory table for this interface.');
 return width;
}
function markerSize(inv,style=normalStyle){
 const specs=inv.groups.flatMap(group=>group.socketLayout.map(socket=>({socket,port:inv.ports.find(port=>port.group===group.id&&port.number===socket.number)}))).filter(row=>row.port);
 // Faces keep the same copper/optical aspect ratios. Large membership sets
 // enlarge every face together; the fixed-paper solver reports capacity.
 const step=style.markerRadius*2+1,top=style.markerRadius*2+2.2;
 let width=Math.max(30*style.scale,...specs.map(({socket,port})=>textWidth((port.displayNumber||portLabelText(port.id))+socket.suffix,style.numberFont,true)+2));
 const fits=width=>specs.every(({socket,port})=>{const h=width*(/RJ|copper/i.test(socket.media)?23.2:16.2)/25.2,columns=Math.max(1,Math.floor((width-4)/step)),bottom=port.disabled||port.taggedVlanPolicy?style.numberFont*1.2+1:3,lines=Math.max(0,Math.floor((h-bottom-top)/step)+1);return markerVlans(inv,port).length<=columns*lines;});
 while(width<=512&&!fits(width))width+=.5;if(width>512)throw new ReportCapacityError('VLAN membership exceeds readable marker capacity. Use the complete inventory table for this interface.');return width;
}
// Port maps fill each jack: tagged dots form a centered grid, rows centered
// and the block centered in the face, growing outward from the middle. One
// radius serves every port on a map: the largest at which its most filled
// port still holds all of its markers, with a gap of DOT_GAP x r between
// neighbours and at most a readable maximum for sparse maps.
const DOT_GAP=.28;
// Port maps and stack/workspace sheets share the same reference socket
// proportions. Fitting paper never makes module optics taller for its own
// sake; a drawing-set map whose busiest optical port would hold only small
// dots gives its optical faces the full copper-face height its rows already
// reserve (opticalFaces), so the dots there can be larger.
const OPTICAL_HEIGHT={builder:16.2/25.2,map:16.2/25.2,tall:23.2/25.2};
const DOT_TARGET=3;
function opticalFaces(inv,portWidth,style){
 const ports=inv.groups.flatMap(group=>group.socketLayout.filter(socket=>!/RJ|copper/i.test(socket.media)).map(socket=>inv.ports.find(port=>port.group===group.id&&port.number===socket.number))).filter(Boolean);
 const most=Math.max(0,...ports.map(port=>markerVlans(inv,port).length));if(!most)return OPTICAL_HEIGHT.map;
 const at=ratio=>largestDot(most,dotArea(0,0,portWidth,portWidth*ratio,dotReserve({},true,style.numberFont,true)));
 return at(OPTICAL_HEIGHT.map)<DOT_TARGET&&at(OPTICAL_HEIGHT.tall)>at(OPTICAL_HEIGHT.map)*1.1?OPTICAL_HEIGHT.tall:OPTICAL_HEIGHT.map;
}
// Each port's own dots: as large as its face allows (at most the map cap),
// never smaller than the map's common radius or the builder's smallest dot.
// Dots stay above the latch line unless overlapping it makes them notably larger.
function portDots(n,sx,sy,w,h,port,optical,plan){
 const cap=Math.min(5,w*.14),floor=Math.max(1.5,plan.markerRadius??1.5),beside=!!plan.outsideMarks?.(port),clear=dotArea(sx,sy,w,h,dotReserve(port,optical,plan.numberFont,false,beside)),over=dotArea(sx,sy,w,h,dotReserve(port,optical,plan.numberFont,true,beside));
 const size=area=>Math.floor(Math.min(cap,largestDot(n,area))*.999*1000)/1000;
 let area=clear,r=size(clear);const overlap=size(over);if(overlap>r*1.15||r<floor){area=over;r=overlap;}
 if(r<floor)return null;const grid=dotLayout(n,area,r);return grid.fits?{r,grid}:null;
}
const dotArea=(x,y,w,h,bottom)=>({x:x+1.6,y:y+1.6,w:Math.max(0,w-3.2),h:Math.max(0,h-1.6-bottom)});
// Dots stay above the jack's latch line when they fit there; a port that
// needs the room may overlap it (the dots are drawn over the line). A
// disabled '!' or policy '*' mark keeps its own band at the bottom, unless
// the map draws those marks beside the port number (outside).
const dotReserve=(port,optical,numberFont,overlap=false,outside=false)=>!outside&&(port.disabled||port.taggedVlanPolicy)?numberFont*1.2+1:overlap?1.6:optical?2.4:3;
// Drawing-set maps put a port's '*' (trunk VLAN policy) and '!' (disabled)
// marks beside its number when the pitch leaves room, never inside the jack,
// so the marks never take room from the dots.
const MARK_GAP=1.5;
const portDisplay=(inv,port)=>inv.groups.find(group=>group.id===port.group)?.configuredInterfaces?shortInterface(port.id):String(port.displayNumber||portLabelText(port.id));
// A port's marks sit beside its own number when they stay clear of the
// widest neighboring number; otherwise they keep the band inside the jack.
function marksOutside(inv,portWidth,style){
 const font=style.numberFont,pitch=portWidth+(style.compact?1:2),glyph=value=>textWidth(value,font,true)-6,widest=Math.max(0,...inv.ports.map(port=>glyph(portDisplay(inv,port))));
 return port=>!(port.disabled||port.taggedVlanPolicy)||glyph(portDisplay(inv,port))/2+glyph((port.taggedVlanPolicy?'*':'')+(port.disabled?'!':''))+MARK_GAP*2<=pitch-widest/2;
}
function largestDot(n,box){let best=0;for(let cols=1;cols<=n;cols++){const rows=Math.ceil(n/cols),r=Math.min(box.w/(2*cols+DOT_GAP*(cols-1)),box.h/(2*rows+DOT_GAP*(rows-1)));if(r>best)best=r;}return best;}
function dotLayout(n,box,r){
 const gap=r*DOT_GAP,step=r*2+gap,most=Math.max(1,Math.floor((box.w+gap)/step+1e-9)),rows=Math.ceil(n/most),cols=Math.ceil(n/rows),top=box.y+(box.h-(rows*step-gap))/2;
 return {fits:rows*step-gap<=box.h+1e-6&&Math.min(n,cols)*step-gap<=box.w+1e-6,points:Array.from({length:n},(_,i)=>{const row=Math.floor(i/cols),count=Math.min(cols,n-row*cols),left=box.x+(box.w-(count*step-gap))/2;return {cx:left+(i-row*cols)*step+r,cy:top+row*step+r};})};
}
function fillRadius(inv,plan){
 const specs=inv.groups.flatMap(group=>group.socketLayout.map(socket=>({socket,port:inv.ports.find(port=>port.group===group.id&&port.number===socket.number)}))).filter(row=>row.port),w=plan.portWidth;
 let radius=Math.min(5,w*.14);
 for(const {socket,port} of specs){const n=markerVlans(inv,port).length;if(!n)continue;const optical=!/RJ|copper/i.test(socket.media),h=w*(optical?plan.opticalRatio:23.2/25.2);radius=Math.min(radius,largestDot(n,dotArea(0,0,w,h,dotReserve(port,optical,plan.style.numberFont,true,!!plan.outsideMarks?.(port)))));}
 // Never smaller than the builder's own markers; the builder layout keeps those.
 return radius>=plan.style.markerRadius?Math.floor(radius*1000)/1000:null;
}
// Drawing-set maps (fill), like the compact style, set a two-row panel's rows
// almost touching: their numbers go above the top row and below the bottom one.
function groupPlan(inv,group,portWidth,style=normalStyle,fill=false){
 const ports=inv.ports.filter(port=>port.group===group.id),pitch=portWidth+(style.compact?1:2),faceHeight=portWidth*23.2/25.2,layout=group.socketLayout,rowsCount=Math.max(...layout.map(socket=>socket.row))+1,numberFont=style.numberFont,rowPitch=faceHeight+((style.compact||fill)&&rowsCount<=2?1.4:numberFont*1.2+(style.compact?3:6));
 // A configured-interface panel (an unconfirmed module) measures its heading,
 // which may wrap, before its rows.
 if(group.configuredInterfaces&&!group.socketLayout?.length){const width=Math.max(300,Math.max(...ports.map(port=>textWidth(port.id,10)))+270),header=Math.max(24,wrapPortText(groupTitle(inv,group,width-14,style.groupFont,fill),width-14,style.groupFont,true).length*style.groupFont*1.2+8);return {group,ports,configured:true,width,header,style,height:header+3+Math.max(1,ports.length)*22};}
 const minimum=Math.min(...layout.map(socket=>socket.column)),maximum=Math.max(...layout.map(socket=>socket.column)),width=Math.max(180,(maximum-minimum)*pitch+portWidth+16),header=Math.max(style.compact?14:22,wrapPortText(groupTitle(inv,group,width-14,style.groupFont,fill),width-14,style.groupFont,true).length*style.groupFont*1.2+(style.compact?2:8)),height=header+numberFont*1.2+(style.compact?1.2:4)+faceHeight+Math.max(0,rowsCount-1)*rowPitch+numberFont*1.2+(style.compact?3:8);
 return {group,ports,width,height,header,minimum,pitch,faceHeight,rowPitch,portWidth,rowsCount,numberFont,style};
}
function devicePlan(item,style=normalStyle,width=null,fill=false){
 const inv=item.inventory,portWidth=width??item.standardPortWidth??markerSize(inv,style),opticalRatio=fill?opticalFaces(inv,portWidth,style):OPTICAL_HEIGHT.builder,outsideMarks=fill?marksOutside(inv,portWidth,style):null,plans=inv.groups.map(group=>({...groupPlan(inv,group,portWidth,style,fill),opticalRatio,fill,outsideMarks})),bands=[];
 if(inv.chassisSlots&&inv.groups.every(group=>/^[A-L]$/.test(group.slot))){
  const slotWidth=Math.max(280,...plans.map(plan=>plan.width)),slotHeight=Math.max(80,...plans.map(plan=>plan.height));
  for(let slot=0;slot<inv.chassisSlots;slot+=2){const panels=[0,1].map(column=>({plan:plans.find(plan=>plan.group.slot===String.fromCharCode(65+slot+column)),empty:String.fromCharCode(65+slot+column),x:column*(slotWidth+16)})),height=panels.some(panel=>panel.plan)?slotHeight:24*Math.max(1,Math.min(1.2,style.scale));for(const panel of panels){panel.w=slotWidth;panel.h=height;}bands.push({panels,width:slotWidth*2+16,height});}
 }else for(const plan of plans)bands.push({panels:[{plan,x:0,w:plan.width,h:plan.height}],width:plan.width,height:plan.height});
 return {item,portWidth,opticalRatio,outsideMarks,bands,style,gap:style.compact?2:8,width:Math.max(200,...bands.map(band=>band.width)),height:bands.reduce((height,band)=>height+band.height+(style.compact?2:8),0)};
}
// A port map may carry the device's core-diagram artwork colors (item.artwork):
// slot panels take the plate or module-bay color, a chassis frame shows
// between its slots, and numbers and captions stay readable on either.
const panelColors=item=>{const art=item.artwork||{},body=art.body||'#edf1f2',dark=luminance(body)<.4;return {body,stroke:art.stroke||(art.body?'#5d7079':'#a8b7be'),empty:art.body||'#f4f6f7',emptyStroke:art.stroke||(art.body?'#5d7079':'#bdc8cc'),text:dark?'#ffffff':ink,muted:dark?'#d6dee2':muted,frame:art.frame||null,frameStroke:art.frameStroke||art.frame||null};};
function drawPanel(p,item,palette,plan,x,y,width=plan.width,height=plan.height){
 const inv=item.inventory,group=plan.group,a=p.items,scope='Switchport reports|'+p.role+'|'+item.id+'|group|'+group.id;
 const colors=panelColors(item);rect(a,x,y,width,height,colors.body,colors.stroke,.7,6);// The panel and its heading identify the switch, stack member or module so a
 // double-click opens that device's port map details.
 const identity={reportMember:String(group.device||'1'),reportSlot:group.slot||'',reportIdentity:group.slot?group.device+'/'+String(group.slot).toUpperCase():String(group.device||'1')};
 Object.assign(a.at(-1),{editKey:scope+'|body',reportPanel:true,reportGroup:group.id,sourceId:item.id,...identity});rect(a,x,y,width,plan.header||24,navy,'none',1,6);
 text(a,x+7,y+(plan.style?.compact?1:4),width-14,groupTitle(inv,group,plan.width-14,plan.style?.groupFont||11,plan.fill),plan.style?.groupFont||11,true,'#ffffff','left',{editKey:scope+'|title',reportDevice:item.id,...identity});
 if(plan.configured){let at=y+(plan.header||24)+5;for(const port of plan.ports){text(a,x+8,at,width-16,port.id+' | '+port.media+' | configured alternative',10,false,ink,'left',{reportPort:port.id,editKey:scope+'|configured|'+port.id});at+=22;}return;}
 const sockets=[],portEntries=[];
 for(const spec of group.socketLayout){
  const port=plan.ports.find(port=>port.number===spec.number);if(!port)throw new ReportCapacityError('A report socket has no matching interface.',{deviceId:item.id,group:group.id});
  const optical=!/RJ|copper/i.test(spec.media),w=plan.portWidth,h=w*(optical?plan.opticalRatio??OPTICAL_HEIGHT.builder:23.2/25.2),sx=x+8+(spec.column-plan.minimum)*plan.pitch,sy=y+plan.header+plan.numberFont*1.2+(plan.style.compact?1.2:4)+spec.row*plan.rowPitch+(plan.faceHeight-h)/2,fill=nativeFill(port,palette),outline=palette.aggregates[aggregateKey(port.aggregate)],socketKey=scope+'|port|'+port.id+(spec.suffix?'|'+spec.suffix:'');
  // All bodies and socket anchors are report-local. The topology hardware and
  // its saved anchors are never changed to make a reference sheet fit.
  rect(a,sx,sy,w,h,fill,outline||'#50616c',outline?2.2:.8,Math.min(3,w*.1));Object.assign(a.at(-1),{editKey:socketKey+'|face',reportPort:port.id,reportPortRole:'native',vlanId:port.untaggedVlan,sourceId:item.id,socketForm:spec.media});
  // Copper faces keep only the latch bar, as the builder draws them: small
  // decorative contact pins read as VLAN markers on an enlarged sheet.
  if(!optical)rect(a,sx+w*.32,sy+h-3,w*.36,2,'#4c5c65','none',1,1);else rect(a,sx+3,sy+h-2.1,w-6,.7,'#61727c');
  const markerIds=markerVlans(inv,port),radius=plan.markerRadius??plan.style.markerRadius,step=radius*2+1,cols=Math.max(1,Math.floor((w-4)/step)),bottomReserve=port.disabled||port.taggedVlanPolicy?plan.numberFont*1.2+1:3,availableRows=Math.max(0,Math.floor((h-bottomReserve-radius*2-2.2)/step)+1),markerTop=sy+2.2;
  const drawMarker=(id,cx,cy,r=radius)=>{const extra={editKey:socketKey+'|vlan|'+id,reportPort:port.id,reportPortRole:voiceVlan(inv,port,id)?'voice':'tagged',vlanId:id,sourceId:item.id,name:'VLAN '+id+(voiceVlan(inv,port,id)?' voice':' tagged')};if(voiceVlan(inv,port,id)){diamond(a,cx-r-.3,cy-r-.3,r*2+.6,'#ffffff','#ffffff',.3);diamond(a,cx-r,cy-r,r*2,palette.vlans[id],'#263c49',.5,extra);}else{ellipse(a,cx-r-.3,cy-r-.3,r*2+.6,r*2+.6,'#ffffff','#ffffff',.3);ellipse(a,cx-r,cy-r,r*2,r*2,palette.vlans[id],'#263c49',.5,extra);}};
  // Drawing-set maps size each port's dots to fill its own face.
  const own=plan.fill&&markerIds.length?portDots(markerIds.length,sx,sy,w,h,port,optical,plan):null;
  if(own)markerIds.forEach((id,index)=>drawMarker(id,own.grid.points[index].cx,own.grid.points[index].cy,own.r));
  else if(plan.markerRadius!=null&&markerIds.length){const beside=!!plan.outsideMarks?.(port);let grid=dotLayout(markerIds.length,dotArea(sx,sy,w,h,dotReserve(port,optical,plan.numberFont,false,beside)),radius);if(!grid.fits)grid=dotLayout(markerIds.length,dotArea(sx,sy,w,h,dotReserve(port,optical,plan.numberFont,true,beside)),radius);if(!grid.fits)throw new ReportCapacityError('The complete VLAN markers do not fit interface '+port.id+'.',{deviceId:item.id,port:port.id});markerIds.forEach((id,index)=>drawMarker(id,grid.points[index].cx,grid.points[index].cy));}
  else{if(markerIds.length>cols*availableRows)throw new ReportCapacityError('The complete VLAN markers do not fit interface '+port.id+'.',{deviceId:item.id,port:port.id});
   markerIds.forEach((id,index)=>drawMarker(id,sx+2.6+radius+(index%cols)*step,markerTop+radius+Math.floor(index/cols)*step));}
  if(port.disabled&&!plan.outsideMarks?.(port))text(a,sx+w-9,sy+h-plan.numberFont*1.2,8,'!',plan.numberFont,true,fill==='#000000'?'#ffffff':ink,'center',{editKey:socketKey+'|disabled',reportPort:port.id,reportPortRole:'disabled'});
  if(port.taggedVlanPolicy&&!plan.outsideMarks?.(port))text(a,sx+2,sy+h-plan.numberFont*1.2,Math.max(10,w-12),'*',plan.numberFont,true,fill==='#000000'?'#ffffff':ink,'left',{editKey:socketKey+'|policy',reportPort:port.id,reportPortRole:'policy'});
  const name=port.id+(spec.suffix?' ['+spec.suffix+']':'');portEntries.push({name,source:port,socketKey,display:(group.configuredInterfaces?shortInterface(port.id):port.displayNumber||portLabelText(port.id))+spec.suffix});sockets.push({name,x:sx,y:sy,w,h,form:spec.media});
 }
 const labelGroup={x,y,w:width,h:height,editKey:scope,sourceId:item.id,ports:Object.fromEntries(sockets.map(socket=>[socket.name,[(socket.x+socket.w/2-x)/width,(socket.y+socket.h/2-y)/height]])),children:sockets.map(socket=>({type:'rect',socketPart:0,socketForm:socket.form,x:(socket.x-x)/width,y:(socket.y-y)/height,w:socket.w/width,h:socket.h/height})),panelRegions:[{x:0,y:0,w:1,h:1}]},numbers=portLabelLayout(labelGroup,portEntries,{fontSize:plan.numberFont,format:(_name,port)=>port.display,measureRequired:false,minWidth:plan.style.compact?0:Math.min(18,plan.portWidth),gap:plan.style.compact?1:2});
 if(!numbers.readable)throw new ReportCapacityError('The port numbers need more room in '+group.id+'.',{deviceId:item.id,group:group.id});
 for(const entry of numbers.entries){const b=entry.number;label(a,b.x,b.y,b.w,b.h,entry.text,b.size,true,colors.text,'center');Object.assign(a.at(-1),{editKey:entry.editKey+'|text',portNumberRole:'text',reportPortRole:'number',reportPort:entry.port.source.id,portName:entry.port.source.id,sourceId:item.id,full:true});
  // The '*' and '!' marks follow the number, outside the jack.
  if(plan.outsideMarks?.(entry.port.source)){const port=entry.port.source,key=entry.port.socketKey;let at=b.x+b.w/2+(textWidth(entry.text,b.size,true)-6)/2+MARK_GAP;
   for(const [mark,role] of [[port.taggedVlanPolicy?'*':'','policy'],[port.disabled?'!':'','disabled']]){if(!mark)continue;const mw=textWidth(mark,b.size,true)-6+1;label(a,at,b.y,mw+2,b.h,mark,b.size,true,colors.text,'left');Object.assign(a.at(-1),{editKey:key+'|'+role,reportPort:port.id,reportPortRole:role,sourceId:item.id});at+=mw;}}
 }
 p.reportSockets??=[];p.reportSockets.push(...sockets.map(socket=>({...socket,deviceId:item.id,group:group.id})));p.reportNumberBoxes??=[];p.reportNumberBoxes.push(...numbers.labelObstacles);
}
function drawBand(p,plan,band,x,y,palette){const colors=panelColors(plan.item);for(const panel of band.panels){if(panel.plan)drawPanel(p,plan.item,palette,panel.plan,x+panel.x,y,panel.w,panel.h);else{rect(p.items,x+panel.x,y,panel.w,panel.h,colors.empty,colors.emptyStroke,.7,6);text(p.items,x+panel.x+8,y+Math.min(8,(panel.h-14)/2),panel.w-16,'Slot '+panel.empty+' / Not declared',11,false,colors.muted);}}}
function blockHeading(p,item,x,y,width,continued=false){const inv=item.inventory,title=displayName(inv)+(continued?' / continued':''),description=[modelLabel(inv),inv.os,inv.firmware!=='Unknown'?inv.firmware:''].filter(Boolean).join(' | '),height=text(p.items,x,y,width,title,14,true,ink,'left',{editKey:p.name+'|'+item.id+'|device-title'});return y+height+4+text(p.items,x,y+height+4,width,description,10,false,muted)+9;}
function drawBlock(p,plan,x,y,palette,{bands=plan.bands,continued=false,heading=true}={}){let at=heading?blockHeading(p,plan.item,x,y,Math.max(plan.width,260),continued):y;
 // A chassis shows its frame color around and between its slots.
 const colors=panelColors(plan.item);if(colors.frame&&plan.item.inventory.chassisSlots&&bands.length){const m=Math.min(3,plan.gap/2+1),h=bands.reduce((sum,band)=>sum+band.height,0)+plan.gap*(bands.length-1),w=Math.max(...bands.map(band=>band.width));rect(p.items,x-m,at-m,w+m*2,h+m*2,colors.frame,colors.frameStroke,.8,8);Object.assign(p.items.at(-1),{editKey:'Switchport reports|'+p.role+'|'+plan.item.id+'|frame',reportFrame:true,sourceId:plan.item.id});}
 for(const band of bands){drawBand(p,plan,band,x,at,palette);at+=band.height+plan.gap;}return at;}
function blockHeight(plan){const inv=plan.item.inventory;return Math.max(16.8,wrapPortText(displayName(inv),Math.max(plan.width,260),14,true).length*16.8)+4+Math.max(12,wrapPortText([modelLabel(inv),inv.os,inv.firmware!=='Unknown'?inv.firmware:''].filter(Boolean).join(' | '),Math.max(plan.width,260),10).length*12)+9+plan.height;}

// A port map uses the whole sheet: for each number style it grows the jacks
// until the map and key fill the page, then keeps the style whose dots come
// out largest (numbers no smaller than 8 px). Near ties keep larger numbers.
// Without a footer or page number a map reclaims the band except the strip
// its safety note needs.
// Room the footer leaves for content: 9 units more without the footer rule
// and page number, and the footer band moves with the page margin.
function footerGain(request){return (request.pageFooter&&!request.pageFooter.footer&&!request.pageFooter.show?9:0)-(marginOf(request)-MARGIN);}
// Height below the content that the footer band (or the safety note alone)
// needs on a sheet with this margin.
export function footerSpace(request,margin){const bare=request.pageFooter&&!request.pageFooter.footer&&!request.pageFooter.show;return bare?margin+16:margin+41;}
// A chassis painted with its frame color shows that frame around its slots;
// keep room for it inside the page margin.
const frameRoom=item=>item.artwork?.frame&&item.inventory.chassisSlots?3:0;
function mapCandidates(item,palette,request,styles,extra=0){const margin=marginOf(request);
 const sheet=paperOf(request),tops=new Map(),contentTop=compact=>{if(!tops.has(compact))tops.set(compact,page(request,item.id+'|measure',displayName(item.inventory)+' / Port map',[modelLabel(item.inventory),item.inventory.ports.length+' interfaces'].filter(Boolean).join(' | '),'onePage',[item.id],sheet.width,sheet.height,compact).contentTop);return tops.get(compact);};
 const frame=frameRoom(item),fits=(plan,style)=>plan.width+frame*2<=sheet.width-margin*2&&contentTop(style.compact)+plan.height+(style.compact?4:12)+legendHeight(item.inventory,palette,sheet.width-margin*2,style.compact,true)+extra+(style.compact?49:59)-footerGain(request)<=sheet.height+.01;
 const out=[];
 for(const style of styles){
  let base;try{base=devicePlan(item,style,null,true);}catch(error){if(error.code!=='SWITCHPORT_REPORT_CAPACITY')throw error;continue;}
  if(!fits(base,style))continue;
  const at=k=>devicePlan(item,style,base.portWidth*k,true),most=item.standardPortWidth?1:Math.max(1,56/base.portWidth);let lo=1,hi=most;
  if(fits(at(hi),style))lo=hi;else for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(fits(at(mid),style))lo=mid;else hi=mid;}
  const plan=at(lo),fit=fillRadius(item.inventory,plan);out.push({style,plan,fit,score:fit??style.markerRadius});
 }
 const best=Math.max(0,...out.map(c=>c.score));
 return out.sort((a,b)=>(b.score>=best*.95)-(a.score>=best*.95)||b.style.numberFont-a.style.numberFont||b.score-a.score);
}
export function reportDiagram(item,palette,request,{wall=false}={}){const margin=marginOf(request);
 if(item.validation&&!item.validation.ok)throw new ReportCapacityError(item.validation.errors.join(' '),{deviceId:item.id});
 let failure;
 const styles=wall?[normalStyle]:[...(request?.fill&&!item.standardPortWidth?largeStyles:[]),normalStyle,...compactStyles];
 // Port descriptions are shown when there is room: the map may give up a
 // little size for them (its VLAN markers stay at least 85% as large).
 let candidates=request?.fill&&!wall?mapCandidates(item,palette,request,styles):styles.map(style=>({style,plan:devicePlan(item,style),fit:null}));
 const descriptions=request?.fill&&!wall?descriptionLayout(item.inventory,paperOf(request).width-margin*2).height:0;
 if(descriptions&&candidates.length){const roomy=mapCandidates(item,palette,request,styles,descriptions);const best=list=>Math.max(...list.map(c=>c.score));if(roomy.length&&best(roomy)>=best(candidates)*.85)candidates=roomy;}
 for(const {style,plan,fit} of candidates){
  const sheet=paperOf(request),width=wall?Math.max(sheet.width,plan.width+margin*2):sheet.width,radius=fit;
  // A port map (request.fill) draws one dot size, as large as its most
  // filled port allows.
  if(radius!=null)for(const band of plan.bands)for(const panel of band.panels)if(panel.plan)panel.plan.markerRadius=radius;
  const frame=wall?0:frameRoom(item);
  if(plan.width+frame*2>width-margin*2){failure=new ReportCapacityError('The complete physical banks of '+displayName(item.inventory)+' exceed readable '+reportPageLabel(request.paper)+' width. Use larger paper or the wall chart.',{deviceId:item.id,requiredWidth:plan.width+margin*2});continue;}
  const p=page(request,item.id+'|'+(wall?'wall':'a4'),displayName(item.inventory)+' / Port map',[modelLabel(item.inventory),item.inventory.ports.length+' interfaces'].filter(Boolean).join(' | '),wall?'wall':'onePage',[item.id],width,sheet.height,style.compact),keyHeight=legendHeight(item.inventory,palette,width-margin*2,style.compact,!!request?.fill),gap=style.compact?4:12,needed=p.contentTop+plan.height+gap+keyHeight+(style.compact?49:59)-footerGain(request);
  if(wall){p.height=Math.max(p.height,needed);p.paper={preset:'custom',orientation:p.width>=p.height?'landscape':'portrait',widthMm:p.width*25.4/96,heightMm:p.height*25.4/96};}else if(needed>p.height+.01){failure=new ReportCapacityError('The complete port map and VLAN key need '+Math.ceil(needed)+' px of readable height; '+reportPageLabel(request.paper)+' provides '+Math.floor(p.height)+' px. The booklet keeps all content on continued sheets.',{deviceId:item.id,requiredHeight:needed});continue;}
  try{const bottom=drawBlock(p,plan,margin+frame,p.contentTop+frame,palette,{heading:false})+frame,keyBottom=legend(p,bottom+gap,item.inventory,palette);if(!wall)drawDescriptions(p,keyBottom+4,item.inventory,contentLimit(p));p.widthMm=p.width*25.4/96;p.heightMm=p.height*25.4/96;p.reportGeometryScale=style.scale;p.reportNumberFont=style.numberFont;if(fit!=null){p.reportMarkerFit=fit;p.reportMarkerRadius=radius;}return finish(p,request,palette,item.inventory);}catch(error){if(error.code!=='SWITCHPORT_REPORT_CAPACITY')throw error;failure=error;}
 }
 throw failure;
}

// Responsive port-map workspace layout: wide paper can show member panels in
// two balanced columns, with one shared key. Port/socket sizing is unchanged;
// only the measured member bands are grouped into a compact grid.
export function responsiveStackPlan(plan,targetAspect){
 const memberCount=plan.item.inventory.groups.filter(group=>!group.slot).length;
 if(!(targetAspect>1.12)||memberCount<3||memberCount>8||plan.bands.length<3)return plan;
 const columns=2,cellWidth=Math.max(...plan.bands.map(band=>band.width)),gap=20,bands=[];
 for(let index=0;index<plan.bands.length;index+=columns){
  const pair=plan.bands.slice(index,index+columns);
  const height=Math.max(...pair.map(band=>band.height));
  bands.push({panels:pair.flatMap((band,column)=>band.panels.map(panel=>({...panel,x:panel.x+column*(cellWidth+gap)}))),width:cellWidth*columns+gap,height});
 }
 return {...plan,bands,width:cellWidth*columns+gap,height:bands.reduce((sum,band)=>sum+band.height+plan.gap,0)};
}
export function workspaceDiagrams(items,palette,request){const margin=marginOf(request);
 const plans=items.filter(item=>item.validation?.ok!==false).map(item=>responsiveStackPlan(devicePlan(item,normalStyle,null,!!request?.fill),request?.targetAspect)),pages=[];let current=null,currentPlans=[],at=0;
 const originalSheet=paperOf(request),sheet={...originalSheet,width:request?.dynamicCanvas?Math.max(originalSheet.width,...plans.map(plan=>plan.width+margin*2)):originalSheet.width},dynamicHeight=request?.dynamicCanvas?Math.max(sheet.height,Math.ceil(page(request,'workspace|measure',request.title||'Switchport reports','Shared port maps and VLAN key','workspace',[]).contentTop+plans.reduce((sum,plan)=>sum+blockHeight(plan)+12,0)+legendHeight(mergeInventories(plans.map(plan=>plan.item)),palette,sheet.width-margin*2,false,false)+180-footerGain(request))):null;
 const make=()=>{const p=page(request,'workspace|'+pages.length,request.title||request.outputLabel||'Switchport reports','Shared port maps and VLAN key','workspace',[],sheet.width,dynamicHeight??sheet.height);if(dynamicHeight)p.paper={preset:'custom',orientation:p.width>=p.height?'landscape':'portrait',widthMm:p.widthMm,heightMm:p.heightMm};pages.push(p);current=p;currentPlans=[];at=p.contentTop;return p;};
 const close=()=>{if(!current)return;const inv=mergeInventories(currentPlans.map(plan=>plan.item)),keyBottom=legend(current,at+10,inv,palette);drawDescriptions(current,keyBottom+4,inv,contentLimit(current));current.sourceDeviceIds=unique(currentPlans.map(plan=>plan.item.id));current=null;};
 const standalone=plan=>{
  let single;try{single=reportDiagram(plan.item,palette,request);}catch{return false;}
  if(current&&currentPlans.length)close();else if(current){pages.pop();current=null;}
  single.name='Switchport reports|workspace|'+plan.item.id;single.role='workspace';single.workspaceTitle=request.title;single.standaloneConfiguration=true;single._reportFinished=true;pages.push(single);return true;
 };
 for(const plan of plans){
  if(plan.width>sheet.width-margin*2){if(standalone(plan))continue;throw new ReportCapacityError('The complete physical bank of '+displayName(plan.item.inventory)+' is too wide for shared '+reportPageLabel(request.paper)+' sheets.',{deviceId:plan.item.id});}
  if(!current)make();let required=blockHeight(plan),candidate=mergeInventories([...currentPlans.map(row=>row.item),plan.item]),keyHeight=legendHeight(candidate,palette,current.width-margin*2);
  if(at+required+keyHeight+69-footerGain(request)>current.height&&currentPlans.length){close();make();candidate=plan.item.inventory;keyHeight=legendHeight(candidate,palette,current.width-margin*2);}
  // An editable dynamic sheet must grow before considering compact
  // standalone pagination. It is not bounded by fixed print paper height.
  if(request?.dynamicCanvas&&at+required+keyHeight+69-footerGain(request)>current.height){
   current.height=Math.ceil(at+required+keyHeight+160);
   current.heightMm=current.height*25.4/96;
   current.paper={preset:'custom',orientation:current.width>=current.height?'landscape':'portrait',widthMm:current.widthMm,heightMm:current.heightMm};
  }
  if(at+required+keyHeight+69-footerGain(request)<=current.height){at=drawBlock(current,plan,margin,at,palette)+12;currentPlans.push(plan);continue;}
  if(standalone(plan))continue;
  // Whole configurations are preferred. Oversized stacks/chassis continue at
  // complete member/module-row boundaries, always with a complete local key.
  if(currentPlans.length){close();make();}let bands=[],continued=false;
  for(const band of plan.bands){
   const partial={...plan,bands:[...bands,band],height:[...bands,band].reduce((sum,row)=>sum+row.height+8,0)},limit=current.contentTop+blockHeight(partial)+keyHeight+69-footerGain(request);
   if(limit>current.height&&bands.length){at=drawBlock(current,plan,margin,current.contentTop,palette,{bands,continued})+12;currentPlans=[plan];close();make();bands=[];continued=true;}
   if(current.contentTop+blockHeight({...plan,bands:[band],height:band.height+8})+keyHeight+69-footerGain(request)>current.height)throw new ReportCapacityError('One module/member and its complete VLAN key cannot fit '+reportPageLabel(request.paper)+' at readable size.',{deviceId:plan.item.id});
   bands.push(band);
  }
  if(bands.length){at=drawBlock(current,plan,margin,current.contentTop,palette,{bands,continued})+12;currentPlans=[plan];close();}
 }
 close();for(const [index,p] of pages.entries())if(!p._reportFinished)finish(p,request,palette,mergeInventories(items.filter(item=>p.sourceDeviceIds.includes(item.id))),index+1,pages.length);return numberReportPages(pages);
}

function tablePages(item,palette,request,title,columns,records,role){const margin=marginOf(request);
 const sheet=paperOf(request),pages=[],contentWidth=sheet.width-margin*2,scale=contentWidth/columns.reduce((sum,column)=>sum+column.width,0),widths=columns.map(column=>column.width*scale),lineHeight=12.5,padding=5,bottom=sheet.height-62;let p,y;
 const start=()=>{p=page(request,item.id+'|'+role+'|'+pages.length,displayName(item.inventory)+' / '+title,'Complete values continue on additional pages when needed.',role,[item.id]);pages.push(p);let x=margin;y=p.contentTop;rect(p.items,x,y,contentWidth,27,navy);for(let column=0;column<columns.length;column++){text(p.items,x+padding,y+6,widths[column]-padding*2,columns[column].label,10,true,'#ffffff');x+=widths[column];}y+=27;};
 for(const [recordIndex,record] of records.entries()){
  const values=columns.map(column=>String(column.value(record)??'')),lines=values.map((value,index)=>wrapPortText(value,widths[index]-padding*2,10,index===0)),maxLines=Math.max(1,...lines.map(lines=>lines.length));let offset=0,segment=0;
  while(offset<maxLines){
   const repeated=offset>0?wrapPortText(values[0]+' (continued)',widths[0]-padding*2,10,true).length:lines[0].length,minimum=Math.max(1,repeated);
   if(!p||y+padding*2+lineHeight*minimum>bottom)start();const available=Math.floor((bottom-y-padding*2)/lineHeight),count=Math.min(maxLines-offset,available),height=Math.max(24,Math.max(count,minimum)*lineHeight+padding*2);if(count<1){start();continue;}
   rect(p.items,margin,y,contentWidth,height,recordIndex%2?'#f0f5f6':'#ffffff',rule,.5);let x=margin;
   for(let column=0;column<columns.length;column++){
    const shown=lines[column].slice(offset,offset+count).join('\n'),identity=column===0&&offset>0?values[0]+' (continued)':shown;
    if(identity){label(p.items,x+padding,y+padding,widths[column]-padding*2,height-padding*2,identity,10,column===0,ink);Object.assign(p.items.at(-1),{editKey:'Switchport reports|'+item.id+'|'+role+'|record|'+(record.id??recordIndex)+'|'+columns[column].key+'|'+segment,full:true,tableContent:true,reportTableRole:columns[column].key,reportRecord:record.id??recordIndex,sourceId:item.id});}
    x+=widths[column];
   }
   y+=height;offset+=count;segment++;
  }
 }
 for(const [index,p] of pages.entries())finish(p,request,palette,item.inventory,index+1,pages.length);return pages;
}
export function inventoryPages(item,palette,request){
 const inv=item.inventory,columns=[{key:'id',label:'Port',width:108,value:port=>port.id},{key:'description',label:'Description',width:230,value:port=>port.description},{key:'mode',label:'Mode',width:78,value:port=>port.mode},{key:'native',label:'Native',width:74,value:port=>port.untaggedVlan??port.untaggedState},{key:'tagged',label:'Tagged VLANs',width:180,value:taggedText},{key:'aggregate',label:'LAG / trunk',width:98,value:port=>port.aggregate},{key:'voice',label:'Voice',width:74,value:port=>port.voiceVlan??''},{key:'state',label:'Admin / observed state',width:232,value:port=>(port.disabled===true?'Disabled':port.disabled===false?'Enabled':'Admin unknown')+'\nObserved: '+port.liveState}],pages=tablePages(item,palette,request,'Port inventory',columns,inv.ports,'inventory');
 if(inv.logicalInterfaces.length)pages.push(...tablePages(item,palette,request,'Logical and unplaced interfaces',columns,inv.logicalInterfaces,'logical-interfaces'));
 const details=inv.devices.map(detail=>({id:detail.id,section:detail.label||detail.id,value:[detail.model?'Model: '+detail.model:'',detail.name?'Name: '+detail.name:'',detail.serialNumber?'Serial number: '+detail.serialNumber:'',detail.assetTag?'Asset tag: '+detail.assetTag:'',detail.notes?'Notes: '+detail.notes:'',detail.moduleSelections?.length?'Modules: '+detail.moduleSelections.map(module=>module.slot+' = '+module.sku).join('; '):''].filter(Boolean).join('\n')}));
 const notes=[...details,...inv.ports.concat(inv.logicalInterfaces).filter(port=>port.notes.length||port.connectedDevice!=='Unknown/Confirm before use'||port.usage!=='Unknown/Confirm before use'||port.speed!=='Not specified'||port.relatedInterfaces.length).map(port=>({id:'port:'+port.id,section:'Interface '+port.id,value:[...port.notes,port.connectedDevice!=='Unknown/Confirm before use'?'Observed peer: '+port.connectedDevice:'',port.usage!=='Unknown/Confirm before use'?'Usage: '+port.usage:'',port.speed!=='Not specified'?'Speed: '+port.speed:'',port.relatedInterfaces.length?'Related logical interfaces: '+port.relatedInterfaces.join(', '):''].filter(Boolean).join('\n')})),...inv.svis.map((row,index)=>({id:'svi:'+index,section:'Layer 3 / '+row.interface,value:row.address})),...['routes','management','mirrors','assumptions'].flatMap(section=>inv[section].map((value,index)=>({id:section+':'+index,section,value})))];
 if(notes.length)pages.push(...tablePages(item,palette,request,'Device details and notes',[{key:'section',label:'Device / interface / section',width:240,value:row=>row.section},{key:'value',label:'Complete details',width:834,value:row=>row.value}],notes,'notes'));
 const observed=rows(item.supplementary).flatMap(source=>rows(value(source,'observations')).map((row,index)=>({id:value(source,'id')+':'+index,source:reportText(value(source,'name')),category:reportText(value(row,'category')),interface:reportText(value(row,'interface')),field:reportText(value(row,'field')),value:reportText(value(row,'value'))})));
 if(observed.length)pages.push(...tablePages(item,palette,request,'Supplementary observations',[{key:'source',label:'Source',width:190,value:row=>row.source},{key:'interface',label:'Interface / category',width:180,value:row=>[row.interface,row.category].filter(Boolean).join('\n')},{key:'field',label:'Observed field',width:180,value:row=>row.field},{key:'value',label:'Observed value',width:524,value:row=>row.value}],observed,'observations'));
 return pages;
}
export function blockedReport(item,palette,request,errors){const margin=marginOf(request);
 const p=page(request,item.id+'|blocked',displayName(item.inventory)+' / Report needs review','Inventory and configuration remain available in the details pages.','validation',[item.id]);let y=p.contentTop;text(p.items,margin,y,p.width-margin*2,'Complete report generation is blocked',16,true,'#9c3c23');y+=32;for(const error of errors)y+=text(p.items,margin,y,p.width-margin*2,error,11,false,ink)+10;if(y>p.height-62){p.height=y+62;p.heightMm=p.height*25.4/96;}return finish(p,request,palette,item.inventory);
}
export function validateReportScene(p){
 const errors=[];for(const item of p.items){if(item.type==='text'){if(item.size<8)errors.push('Text is below the readable report minimum.');if(textWidth(String(item.value).split('\n').sort((a,b)=>b.length-a.length)[0]||'',item.size,item.bold)>item.w+6&&wrapPortText(item.value,item.w,item.size,item.bold).length*item.size*1.2>item.h+.01)errors.push('A report caption does not fit its reserved box.');}if(Number.isFinite(item.x)&&Number.isFinite(item.y)&&Number.isFinite(item.w)&&Number.isFinite(item.h)&&(item.x<-.01||item.y<-.01||item.x+item.w>p.width+.01||item.y+item.h>p.height+.01))errors.push('A report item crosses the page boundary.');}
 for(const box of p.reportNumberBoxes||[])for(const socket of p.reportSockets||[])if(intersects(box,socket,.5))errors.push('A port number overlaps a socket.');
 return unique(errors);
}

// Shared measured primitives for the drawing-only adaptive paper planner.
// Standalone reports keep their established geometry and export behavior.
export const portMapPrimitives={devicePlan,fillRadius,page,finish,drawBlock,keyRows,keySections,text,ellipse,diamond,symbolKey,symbolKeyHeight,displayName,modelLabel,footerSpace,basisHeight,drawBasis,frameRoom};
