import {deviceModel,deviceDetails,macCaption} from '../device-details.mjs';
import {logicalPages} from './logical.mjs';
import {corePages} from './core.mjs';
import {applyDrawingEdits} from '../drawing-edits.mjs';
import {pageNumber} from '../page-options.mjs';
import {applyLinkStyles} from '../link-styles.mjs';
import {orderedDevices} from '../layout.mjs';
import {comparePorts,hasPortDetails,consecutivePorts,wrapPortText,portColumnPrefix,portRanges,portNumberBox} from '../port-table.mjs';
import {hardwareProfile,portCapability} from '../imports/hardware.mjs';
import {C,W,H,addDevice,bridge,fresh,getAnchor,label,linkLegend,list,mediaInfo,optic,physicalPorts,portList,portNumber,rate,rect,route,split,state,svgPage,value,xml} from './scene.mjs';
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
function empty(p,msg){rect(p.items,36,168,1128,88,C.pale);label(p.items,57,187,1082,48,msg,18,false,C.muted);}
function caption(p,x,y,w,code,title,details){
  label(p.items,x,y,100,22,code,13,true,C.teal);
  label(p.items,x,y+23,w,23,title,16,true);
  label(p.items,x,y+48,w,21,details,13,false,C.muted);
}
function table(page,cols,rows,start=174){
  const a=page.items;
  rect(a,36,start,1128,32,C.ink);
  let x=36;for(const [title,w] of cols){label(a,x+8,start,w-16,32,title,14,true,C.white);x+=w;}
  rows.forEach((row,i)=>{
    const y=start+32+i*28;rect(a,36,y,1128,28,i%2?C.pale:C.white);let xx=36;
    row.forEach((v,j)=>{const wid=cols[j][1];label(a,xx+8,y,wid-12,28,v,13,j===0);xx+=wid;});
  });
}
function wrappedRows(cols,rows){
  return rows.flatMap(row=>{
    const fields=cols.map((c,k)=>wrapPortText(value(row[k]),c[1]-18,13,k===0));
    return Array.from({length:Math.max(...fields.map(f=>f.length))},(_,l)=>fields.map(f=>f[l]||''));
  });
}
function tablePages(project,name,subtitle,cols,rows,none){
  const buckets=split(wrappedRows(cols,rows),23);
  if(!buckets.length)buckets.push([]);
  return buckets.map(b=>{const p=fresh(name,name,subtitle,project);if(b.length)table(p,cols,b);else empty(p,none);return p;});
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

function portNumbers(items,g,ports,{fill=()=>C.pale,selected=null,stateKey=false}={}){
 const entries=ports.flatMap(port=>{const match=Object.entries(g.ports).find(([name])=>name.toLowerCase()===port.name.toLowerCase());return match?[{port,text:portNumber(port.name),x:g.x+match[1][0]*g.w,y:g.y+match[1][1]*g.h}]:[];}),box=portNumberBox(entries);
 if(!box.readable)return;
 for(const {port,text,x,y} of entries){const active=selected?.has(port.name.toLowerCase()),key=g.editKey+'|port-number|'+port.name;
  rect(items,x-box.w/2,y-box.h/2,box.w,box.h,selected?(active?referencePortFills.ap:C.pale):fill(port),'#617480',.6);Object.assign(items.at(-1),{editKey:key+'|box',portNumberRole:'box',portName:port.name,sourceId:g.sourceId});
  if(stateKey){rect(items,x-box.w/2+1,y+box.h/2-3,box.w-2,2,portStateFills[state(port.state)]);Object.assign(items.at(-1),{editKey:key+'|state',portNumberRole:'state',portName:port.name,sourceId:g.sourceId});}
  label(items,x-box.w/2,y-box.h/2,box.w,box.h,text,box.size,true,C.ink,'center');Object.assign(items.at(-1),{editKey:key+'|text',portNumberRole:'text',portName:port.name,sourceId:g.sourceId,full:true});
 }
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

function portMapLegend(items,viewLabel,top){
 for(const [x,color,title] of [[38,'ap','AP peer'],[148,'profile','AP profile'],[282,'uplink','Uplink / LAG'],[438,'wired','Wired'],[534,'other','Other / unassigned']]){rect(items,x,top+3,18,13,portFills[color],'#647781',.6);label(items,x+25,top-2,144,23,title,12,false,C.muted);}
 label(items,755,top-2,405,23,viewLabel,12,false,C.muted,'right');label(items,38,top+20,82,18,'State mark',11,true,C.muted);
 for(const [x,st] of [[128,'up'],[189,'down'],[268,'unknown']]){rect(items,x,top+27,18,3,portStateFills[st],'#617480',.5);label(items,x+23,top+19,68,18,st,11,false,C.muted);}
}
function referencePortLegend(page,top,roles){
 const a=page.items,scope=page.editScope,definitions=[['wired','Wired data / voice'],['ap','Wireless AP'],['profile','AP profile'],['uplink','Backbone / uplink'],['other','Other / unassigned']],used=definitions.filter(([role])=>roles.has(role)),width=990/Math.max(1,used.length);
 label(a,38,top,115,24,'PORT ROLES',12,true,C.teal);a.at(-1).editKey=scope+'|port-legend|roles';
 used.forEach(([role,title],i)=>{const x=160+i*width;rect(a,x,top+3,22,19,referencePortFills[role],'#617480',.6);a.at(-1).editKey=scope+'|port-legend|'+role+'|box';label(a,x+32,top,Math.max(80,width-38),24,title,13,false,C.ink);Object.assign(a.at(-1),{editKey:scope+'|port-legend|'+role+'|text',full:true});});
 label(a,38,top+34,115,23,'LINK STATE',12,true,C.teal);a.at(-1).editKey=scope+'|port-legend|state';
 for(const [i,title,color] of [[0,'Up','#829AA6'],[1,'Down',C.white],[2,'Unknown','#C1A36E']]){const x=160+i*240;rect(a,x,top+37,22,17,color,'#617480',.6);a.at(-1).editKey=scope+'|port-legend|state|'+title+'|box';label(a,x+32,top+33,180,24,title,13,false,C.ink);a.at(-1).editKey=scope+'|port-legend|state|'+title+'|text';}
 return top+65;
}
function referencePortMaps(project,db,switches,options){
 const filter=options.detailFilter||'all',repeat=options.repeatFaceplate===true,out=[];
 // A pair of full-width panels and the assignment matrix reproduce the source
 // drawing's hierarchy. Further pairs and long detail rows continue normally.
 for(const devices of split(switches,2)){
  const columns=[['Port assignment',230],...devices.map(d=>[nameOf(d)+' ports',devices.length===2?190:260]),['VLANs and link details',devices.length===2?518:638]],records=new Map(),data=devices.map(d=>({device:d,ports:physicalPorts(d).sort(comparePorts)}));
  for(const info of data){const {device:d,ports}=info,assignment=portAssignments(project,db,d,ports);info.assignment=assignment;info.shown=[];info.prefix=portColumnPrefix(ports.map(p=>p.name));
   for(const port of ports){const o=uplinkSettings(d,port),peers=db.links.flatMap(link=>link.a===d.id&&link.ap.toLowerCase()===o.name.toLowerCase()?[{id:link.b,port:link.bp,link}]:link.b===d.id&&link.bp.toLowerCase()===o.name.toLowerCase()?[{id:link.a,port:link.ap,link}]:[]);
    if(!hasPortDetails(o,peers.length>0,filter))continue;info.shown.push(o.name);
    const assigned=assignment(port),role=assigned[1],defaultAccess=!peers.length&&!o.lag&&Number(o.native)===1&&!o.tagged?.length&&!o.voice&&!o.description;
    const title=o.lag&&role==='uplink'?'LAG '+o.lag:role==='ap'?'Wireless access points':role==='profile'?assigned[0]==='Configured AP port'?'Configured AP ports':'Matches AP profile':role==='wired'?(o.voice!=null||o.tagged?.length?'Wired data / voice':'Wired access'):assigned[0]==='No peer reported'?'Configured / unassigned':assigned[0];
    const purpose=o.description&&o.description.length<=56?o.description:defaultAccess?'Default access':title,vlan=[o.role?'Mode: '+o.role:'',o.native!=null&&value(o.native)!==''?'Native VLAN '+value(o.native)+(o.nativeTagged?' (tagged)':''):'',o.tagged?.length?'Tagged VLANs '+vlanSet(o.tagged):'',o.allowedExcept?.length?'Except VLANs '+vlanSet(o.allowedExcept):'',o.voice!=null?'Voice VLAN '+value(o.voice):'',o.lag?'LAG '+o.lag:'',o.ip||o.address?'IP '+value(o.ip||o.address):'',o.description&&o.description.length>56?o.description:''].filter(Boolean),signature=JSON.stringify([purpose,role,vlan]);
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
  let at=0,sheet=0,repeatFits=true;
  do{const p=fresh('MDF Port Map','MDF port map','Switch front panels, configured port roles and link state'+(sheet?' | details continued':''),project),a=p.items,overview=sheet===0||repeat&&repeatFits,scope='MDF Port Map|'+devices.map(d=>d.id).join(',')+'|sheet:'+sheet;p.title='MDF Port Map';p.editScope=scope;let start=184;
   if(overview){let bottom=150,nextTitle=151;const used=new Set();data.forEach(info=>{const d=info.device,up=info.ports.filter(port=>state(port.state)==='up').length,summary=[deviceDetails(d),up+' of '+info.ports.length+' ports up'].filter(Boolean).join(' | ');let titleSize=21,titleLines=wrapPortText(nameOf(d),536,titleSize,true);while(titleLines.length>2&&titleSize>15)titleLines=wrapPortText(nameOf(d),536,--titleSize,true);const titleLineHeight=titleSize*1.15,summaryLines=wrapPortText(summary,559,13),textHeight=Math.max(titleLines.length*titleLineHeight,summaryLines.length*16);
     p.editScope='MDF Port Map|'+d.id+'|sheet:'+sheet;const g=addDevice(p,project,d,[41,nextTitle+textHeight+8,1118,116],'panel:'+d.id);p.editScope=scope;
     const textTop=g.y-8-textHeight>=146?g.y-8-textHeight:g.y+g.h+8;
     titleLines.forEach((text,line)=>{label(a,41,textTop+line*titleLineHeight,536,titleLineHeight,text,titleSize,true,C.ink);Object.assign(a.at(-1),{editKey:g.editKey+'|port-map-title|'+line,full:true});});
     summaryLines.forEach((text,line)=>{label(a,600,textTop+line*16,559,16,text,13,false,C.muted,'right');Object.assign(a.at(-1),{editKey:g.editKey+'|port-map-summary'+(line?'|line:'+line:''),full:true});});
     info.ports.forEach(port=>used.add(info.assignment(port)[1]));portNumbers(a,g,info.ports,{fill:port=>referencePortFills[info.assignment(port)[1]],stateKey:true});bottom=Math.max(bottom,g.y+g.h,textTop+textHeight);nextTitle=bottom+18;
    });start=referencePortLegend(p,bottom+15,used)+10;
   }
   const shown=data.reduce((sum,info)=>sum+info.shown.length,0),total=data.reduce((sum,info)=>sum+info.ports.length,0);if(shown<total){label(a,38,start-20,1120,17,shown+' of '+total+' port records in details | '+(total-shown)+' hidden by table filter',11,false,C.muted);a.at(-1).editKey=scope+'|filter-summary';}
   const captions=columns.map(([title,w],column)=>{const info=data[column-1],caption=info?title+(info.prefix?' ('+info.prefix+')':''):title;return wrapPortText(caption,w-24,13,true);}),header=Math.max(39,9+15*Math.max(...captions.map(lines=>lines.length))),canTable=start+header+(rows[at]?.height||20)<=851;if(!canTable)repeatFits=false;
   if(header+184+(rows[at]?.height||20)>851)throw Error('This port-map column heading needs more space. Use a shorter device name or a wider port-map view.');
   if(canTable){rect(a,36,start,1128,header,C.ink);a.at(-1).editKey=scope+'|assignment-header';let x=36;columns.forEach(([title,w],column)=>{captions[column].forEach((text,line)=>{label(a,x+12,start+4+line*15,w-24,18,text,13,true,C.white);a.at(-1).editKey=scope+'|column|'+column+'|'+line;});x+=w;});}
   let y=start+header,count=0;const members=[];
   while(canTable&&at<rows.length&&y+rows[at].height<=851){const row=rows[at++];let hash=2166136261;for(const char of JSON.stringify([row.title,row.vlan,row.ports]))hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;const rowKey=scope+'|assignment|'+hash.toString(36)+'|part:'+row.part;members.push(...row.members);rect(a,36,y+2,1128,row.height-3,count%2?C.pale:C.white);a.at(-1).editKey=rowKey+'|background';rect(a,36,y+2,5,row.height-3,referencePortFills[row.role]);a.at(-1).editKey=rowKey+'|role';let x=36;
    row.lines.forEach((lines,column)=>{lines.forEach((text,line)=>{label(a,x+12,y+6+line*14,columns[column][1]-24,14,text,12,column===0,C.ink);Object.assign(a.at(-1),{editKey:rowKey+'|cell:'+column+'|line:'+line,portTableRole:column>0&&column<=devices.length?'interface':'detail',portAssignmentRole:column===0?'assignment':column<=devices.length?'ports':'details',full:true});});x+=columns[column][1];});y+=row.height;count++;
   }
   if(!rows.length)label(a,49,start+47,1100,25,total?'No ports match the selected table filter. All physical ports remain on the faceplate.':'No physical switch port records were supplied.',14,false,C.muted);
   const included=new Set(members.map(m=>JSON.stringify([m.device,m.name]))),portRecords=data.flatMap(info=>info.ports.filter(port=>included.has(JSON.stringify([info.device.id,port.name]))).map(port=>({device:info.device.id,name:port.name})));p.portMap={device:devices[0].id,devices:devices.map(d=>d.id),shown,total,rowNames:portRecords.map(port=>port.name),portRecords,density:'compact',overview,assignmentMatrix:true};out.push(p);sheet++;
  }while(at<rows.length);
 }
 return out;
}
function portMaps(project,db){
 const switches=[...db.devices.values()].filter(d=>d.kind==='switch');if(!switches.length){const p=fresh('MDF Port Map','MDF Port Map','Port identity, state and configured assignment',project);empty(p,'No switch inventory was supplied.');return [p];}
 const out=[],options=project.layout?.portMap||{},filter=options.detailFilter||'all',group=options.groupConsecutive!==false,compact=options.density!=='expanded',repeat=options.repeatFaceplate===true;
 if(compact&&group)return referencePortMaps(project,db,switches,options);
 const columns=compact?[['INTERFACE',110],['CONNECTION / PURPOSE / DESCRIPTION',574],['LINK',130],['MODE / VLANS',314]]:[['INTERFACE',120],['CONNECTION / ASSIGNMENT',284],['LINK',140],['VLAN CONFIGURATION',272],['DESCRIPTION',312]],lineHeight=compact?14:16;
 for(const d of switches){
  const ports=physicalPorts(d).sort(comparePorts),assignment=portAssignments(project,db,d,ports),records=[];let shown=0;
  for(const port of ports){
   const o=uplinkSettings(d,port),peers=db.links.flatMap(l=>l.a===d.id&&l.ap.toLowerCase()===o.name.toLowerCase()?[[l.b,l.bp]]:l.b===d.id&&l.bp.toLowerCase()===o.name.toLowerCase()?[[l.a,l.ap]]:[]);
   if(!hasPortDetails(o,peers.length>0,filter))continue;shown++;
   const assigned=assignment(port),peerNames=peers.map(([id,p])=>nameOf(db.devices.get(id))+(p?' / '+p:'')),vlan=[o.role?'Mode: '+o.role:'',o.native!=null&&value(o.native)!==''?'Native: '+value(o.native)+(o.nativeTagged?' (tagged)':''):'',o.tagged?.length?'Tagged: '+vlanSet(o.tagged):'',o.allowedExcept?.length?'Except: '+vlanSet(o.allowedExcept):'',o.voice!=null?'Voice: '+value(o.voice):'',o.lag?'LAG: '+o.lag:'',o.ip||o.address?'IP: '+value(o.ip||o.address):''].filter(Boolean);
   const fields=[[assigned[0],...peerNames].join('\n'),[state(o.state)==='unknown'?'Not observed':state(o.state)==='up'?'Up':'Down',rate(o.speed)].filter(Boolean).join('\n'),vlan.join('\n'),o.description||''];
   const compactFields=[[assigned[0],...peerNames,o.description||''].filter(Boolean).join(' | '),[state(o.state)==='unknown'?'Unknown':state(o.state)==='up'?'Up':'Down',rate(o.speed)].filter(Boolean).join(' '),vlan.map(v=>v.replace(/^Mode: /,'').replace(/^Native: /,'N:').replace(/^Tagged: /,'T:')).join(' | ')];
   const signature=JSON.stringify(fields),previous=records.at(-1);if(group&&previous?.signature===signature&&consecutivePorts(previous.names.at(-1),o.name))previous.names.push(o.name);
   else records.push({names:[o.name],fields:compact?compactFields:fields,signature,color:portFills[assigned[1]],linkState:state(o.state)});
  }
  const rows=records.flatMap(record=>{const values=[interfaceList(record.names),...record.fields],lines=values.map((v,j)=>wrapPortText(v,columns[j][1]-20,12,j===0)),size=Math.max(...lines.map(l=>l.length)),chunks=[];
   for(let start=0;start<size;start+=7){const slice=lines.map(l=>l.slice(start,start+7));if(start&&!slice[0].length)slice[0]=[interfaceList(record.names),'(continued)'];chunks.push({...record,lines:slice,height:Math.max(compact?20:38,(compact?6:14)+Math.max(...slice.map(l=>l.length))*lineHeight)});}return chunks;
  });
  let at=0,sheet=0,repeatFits=true;
  do{
   const p=fresh('MDF Port Map','MDF Port Map',nameOf(d)+'  |  '+deviceDetails(d)+(sheet?'  |  details continued':''),project),a=p.items,overview=sheet===0||repeat&&repeatFits;p.editScope=p.name+'|'+d.id+'|sheet:'+sheet;
   let summary=156,start=190;
   if(overview){
    const g=addDevice(p,project,d,[45,159,1110,84],'panel');portNumbers(a,g,ports,{fill:port=>portFills[assignment(port)[1]],stateKey:true});
    const legendTop=Math.max(250,g.y+g.h+7);portMapLegend(a,g.asset?'Imported front view':g.physicalLayout?'Verified hardware port layout':'Port positions need mapping',legendTop);summary=legendTop+43;start=Math.max(324,summary+27);
   }
   label(a,38,summary,1120,20,shown+' of '+ports.length+' port records in details'+(shown<ports.length?'  |  '+(ports.length-shown)+' hidden by table filter':'')+'  |  '+(group?'Consecutive matching ports grouped':'One row per interface')+(compact?'  |  N: native, T: tagged':''),11,false,C.muted);
   const header=compact?27:31,canTable=start+header+(rows[at]?.height||20)<=851;
   if(!canTable)repeatFits=false;
   if(canTable){rect(a,36,start,1128,header,'#E8F1F3');rect(a,36,start,3,header,C.teal);let x=36;for(const [title,w] of columns){label(a,x+10,start,w-20,header,title,11,true,C.teal);x+=w;}}
   let y=start+header,count=0;const rowNames=[];
   while(canTable&&at<rows.length&&y+rows[at].height<=851){const row=rows[at++];rowNames.push(...row.names);rect(a,36,y,1128,row.height,count%2?'#F5F8FA':C.white);rect(a,36,y+row.height-1,1128,1,'#DCE5E9');rect(a,36,y+4,3,row.height-8,row.color);let x=36;
    row.lines.forEach((lines,j)=>{lines.forEach((text,k)=>{label(a,x+10,y+(compact?3:6)+k*lineHeight,columns[j][1]-20,lineHeight,text,12,j===0,j===0?C.teal:j===2&&k===0?stateMarks[row.linkState]:C.ink);Object.assign(a.at(-1),{portTableRole:j===0?'interface':'detail',full:true});});x+=columns[j][1];});y+=row.height;count++;
   }
   if(!rows.length)label(a,49,start+46,1100,25,ports.length?'No ports match the selected table filter. All physical ports remain on the faceplate.':'No physical switch port records were supplied.',14,false,C.muted);
   p.portMap={device:d.id,shown,total:ports.length,rowNames:[...new Set(rowNames)],density:compact?'compact':'expanded',overview};out.push(p);sheet++;
  }while(at<rows.length);
 }
 return out;
}
function wireless(project,db){
  const apIds=new Set([...db.devices.keys()].filter(id=>db.devices.get(id).kind==='ap')),linked=new Set(),groups=new Map();
  for(const e of db.links){
    const left=apIds.has(e.a),right=apIds.has(e.b);if(left===right)continue;
    const sw=left?e.b:e.a;
    const record={...e,sw,sp:left?e.bp:e.ap,apId:left?e.a:e.b,apPort:left?e.ap:e.bp};
    const arr=groups.get(sw)||[];arr.push(record);groups.set(sw,arr);linked.add(record.apId);
  }
  const out=[];
  for(const [sw,items] of groups){
    const device=db.devices.get(sw);
    const sorted=items.slice().sort((a,b)=>cmp(a.sp,b.sp)||cmp(a.apId,b.apId));
    // Keep at most four per bank, including arbitrary imported socket layouts.
    const temp={items:[]},panel=addDevice(temp,project,device,[101,412,998,91],'inspect');
    const captionFor=e=>{const name=mediaInfo(e.media,true).name,s=project.layout?.linkStyles?.[name]||{};return [s.lineTitle&&s.lineTitle!==name?s.lineTitle:'',s.lineDescription].filter(Boolean).join(' | ');};
    const identityKey=(e,role)=>{let hash=14695981039346656037n;for(const c of JSON.stringify([e.apId,e.sw,e.sp,e.apPort]))hash=BigInt.asUintN(64,(hash^BigInt(c.codePointAt(0)))*1099511628211n);return 'Wireless Connections|'+role+'|'+hash.toString(36);};
    const measured=(e,role,value,width)=>{const key=identityKey(e,role),patch=project.layout?.drawingEdits?.[key]||{},size=patch.size||12,w=patch.w||width,bold=patch.bold??false,text=patch.value??value;return {key,value:text,size,w,bold,height:patch.hidden||!text?0:Math.max(patch.h||18,wrapPortText(text,w,size,bold).length*size*1.25)};};
    const captions=(e,width)=>{
      const ap=db.devices.get(e.apId),register=[e.sp||'Port unknown',rate(e.speed)].filter(Boolean).join(' · '),detail=[ap.ip,e.apPort||'AP port unspecified'].filter(Boolean).join(' · ');
      const model=measured(e,'model',deviceModel(ap),width),mac=measured(e,'mac',macCaption(ap,e.apPort),width),titleHeight=Math.max(26,wrapPortText(nameOf(ap),width,18,true).length*22),registerHeight=Math.max(21,wrapPortText(register,width,13,true).length*16),detailHeight=Math.max(18,wrapPortText(detail,width,12).length*15),notes=captionFor(e)?wrapPortText(captionFor(e),width,12):[];
      return {register,detail,model,mac,titleHeight,registerHeight,detailHeight,notes,height:titleHeight+2+model.height+registerHeight+1+detailHeight+mac.height+2+notes.length*14};
    };
    const captionLines=Math.max(0,...items.map(e=>captionFor(e)?wrapPortText(captionFor(e),245,12).length:0)),longLegend=items.some(e=>(project.layout?.linkStyles?.[mediaInfo(e.media,true).name]?.description||'').length>80),longName=items.some(e=>captions(e,245).height>150),capacity=longLegend||longName?1:Math.min(4,Math.max(1,5-captionLines));
    let bucket=[],counts={top:0,bottom:0},columns=new Set();const batches=[];
    for(const e of sorted){
      const k=getAnchor(panel,e.sp,'top',e.idx),side=k.side;
      const col=side+' '+k.x.toFixed(1);
      if(counts[side]===capacity||capacity===1&&bucket.length||columns.has(col)||bucket.some(b=>b.sp===e.sp)){batches.push(bucket);bucket=[];counts={top:0,bottom:0};columns=new Set();}
      bucket.push(e);counts[side]++;columns.add(col);
    }
    if(bucket.length)batches.push(bucket);
    for(const batch of batches){
      const p=fresh('Wireless Connections','Wireless Connections',nameOf(device)+'  ·  access-point uplinks and physical switch ports',project),a=p.items;p.editScope=p.name+'|'+sw+'|sheet:'+batches.indexOf(batch);
      const preview={items:batch.map(e=>({type:'path',color:mediaInfo(e.media,true).color,linkType:mediaInfo(e.media,true).name,sourceLink:e}))};applyLinkStyles(preview,project.layout?.linkStyles);linkLegend(preview);const headingOffset=Math.max(0,(preview.legendBottom||189)+10-216);
      const bank=side=>batch.filter(e=>getAnchor(panel,e.sp,'top',e.idx).side===side),tops=bank('top'),bottoms=bank('bottom'),bankHeight=rows=>Math.max(70,...rows.map(e=>captions(e,Math.min(capacity===1?680:245,980/Math.max(1,rows.length))).height));
      const upper=216+headingOffset+(tops.length?bankHeight(tops)+6+72+39+13*(tops.length-1):0),lower=bottoms.length?H-55-82-bankHeight(bottoms)-170-13*(bottoms.length-1):H-170;
      const switchY=Math.max(upper,Math.min(459,lower));
      const swg=addDevice(p,project,device,[101,switchY,998,91],'switch');
      const per={top:[],bottom:[]};
      batch.forEach((e,i)=>{const start=getAnchor(swg,e.sp,'top',e.idx);per[start.side].push({e,start});});
      // Number the switch's own jacks. Connected AP ports are highlighted, and
      // the same labels remain independent editable text in Visio.
      const selected=new Set(batch.map(e=>e.sp.toLowerCase()));
      portNumbers(a,swg,physicalPorts(device),{selected});
      for(const side of ['top','bottom']){
        const top=side==='top', rs=per[side].sort((a,b)=>a.start.x-b.start.x);
        const centers=rs.map((v,i)=>{
          let cx=95+1010*(i+.5)/rs.length;
          // Avoid a vertical rail aligned with another jack's outward leg.
          while(rs.some((other,j)=>i!==j&&Math.abs(cx-other.start.x)<4))cx+=5;
          return cx;
        });
        const right=[],left=[];
        rs.forEach((r,i)=>(centers[i]>r.start.x?right:left).push(i));
        const order=[...right.reverse(),...left];  // inner to outer without same-bank crossings
        const bankWidth=Math.min(capacity===1?680:245,980/Math.max(1,rs.length)),bankHeight=Math.max(70,...rs.map(({e})=>captions(e,bankWidth).height)),bottomY=Math.max(switchY+135+13*(rs.length-1)+35,Math.min(678,H-55-82-bankHeight));
        rs.forEach(({e,start},i)=>{
          const ap=db.devices.get(e.apId),center=centers[i],lw=bankWidth,caption=captions(e,lw),textY=top?216+headingOffset:bottomY+82,y=top?216+headingOffset+bankHeight+6:bottomY;
          if(!top&&textY+caption.height>H-55)throw Error('This wireless caption needs more space. Shorten the device name or link description.');
          const edgeKey=top?'uplink.bottom':'uplink.top';
          const dest=addDevice(p,project,ap,[center-36,y,72,72],'ap'+side+i,{apEdge:edgeKey,instanceKey:e.sw+'/'+e.sp+'/'+e.apPort});
          const end=getAnchor(dest,edgeKey,top?'bottom':'top',i);
          label(a,center-lw/2,textY,lw,caption.titleHeight,nameOf(ap),18,true,C.ink,'center');
          let captionY=textY+caption.titleHeight+2;
          if(caption.model.height){const m=caption.model;label(a,center-m.w/2,captionY,m.w,m.height,m.value,m.size,m.bold,C.muted,'center');Object.assign(a.at(-1),{editKey:m.key,full:true,deviceInfo:'model',sourceId:ap.id});captionY+=m.height;}
          label(a,center-lw/2,captionY,lw,caption.registerHeight,caption.register,13,true,C.teal,'center');
          captionY+=caption.registerHeight+1;label(a,center-lw/2,captionY,lw,caption.detailHeight,caption.detail,12,false,C.muted,'center');
          if(caption.mac.height){const m=caption.mac;label(a,center-m.w/2,captionY+caption.detailHeight,m.w,m.height,m.value,m.size,m.bold,C.muted,'center');Object.assign(a.at(-1),{editKey:m.key,full:true,deviceInfo:'mac',sourceId:ap.id});}
          caption.notes.forEach((text,n)=>{label(a,center-lw/2,textY+caption.height-caption.notes.length*14+n*14,lw,14,text,12,false,C.muted,'center');a.at(-1).full=true;});
          const track=order.indexOf(i),lane=top?switchY-21-13*track:switchY+135+13*track;
          const info=mediaInfo(e.media,true);
          const rail=center<start.x?swg.x-18-13*track:swg.x+swg.w+18+13*track,escape=start.escapeRange?start.escapeRange[0]+(start.escapeRange[1]-start.escapeRange[0])*(i+1)/(rs.length+1):null;
          const points=escape==null?[[start.x,start.y],[start.x,lane],[end.x,lane],[end.x,end.y]]:[[start.x,start.y],[start.x,escape],[rail,escape],[rail,lane],[end.x,lane],[end.x,end.y]];
          route(p,start,end,points,info.color,'AP link '+(e.idx+1),info.name,{a:e.a,ap:e.ap,b:e.b,bp:e.bp,media:e.media,speed:e.speed,status:e.status});
        });
      }
      out.push(p);
    }
  }
  const unseen=[...apIds].filter(id=>!linked.has(id)).map(id=>db.devices.get(id));
  if(unseen.length)out.push(...tablePages(project,'Wireless Connections','Access points with no mapped switch uplink',[['Access point',390],['Model',370],['IP / MAC address',368]],unseen.map(d=>[nameOf(d),deviceModel(d),[d.ip,macCaption(d)].filter(Boolean).join(' | ')]),''));
  if(!out.length){const p=fresh('Wireless Connections','Wireless Connections','Access-point uplinks',project);empty(p,'No access points or switch-to-AP links were supplied.');out.push(p);}
  return out;
}
function membershipMatrix(project,db) {
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
      const key=JSON.stringify([native,tagged]),g=profiles.get(key)||{device:nameOf(d),ports:[],native,tagged};
      g.ports.push(o.name);profiles.set(key,g);
    }
    groups.push(...profiles.values());
  }
  if(!groups.length||!names.size)return [];
  const pages=[],ids=[...names.keys()].sort((a,b)=>a-b);
  // Measure actual headings and rows, then choose the fewest sheets across
  // the whole matrix. A fixed six-column cap wastes space on short labels.
  const rowSizes=ids.map(id=>({id,height:Math.max(26,wrapPortText(id+'    '+(names.get(id)||''),250,14,true).length*17+8)}));
  const left=303,width=1164-left,limit=Math.floor(width/72),plans=new Array(groups.length+1);
  plans[groups.length]={pages:0,splits:0,headerArea:0};
  for(let at=groups.length-1;at>=0;at--){
    for(let count=1;count<=Math.min(limit,groups.length-at);count++){
      const batch=groups.slice(at,at+count),colW=width/count,headings=batch.map(g=>({g,nameHeight:Math.max(22,wrapPortText(g.device,colW-8,14,true).length*17),portsHeight:Math.max(18,wrapPortText(interfaceList(g.ports),colW-8,12).length*15),taggedHeight:Math.max(17,wrapPortText(vlanSet(g.tagged),colW-8,11).length*14)})),headerHeight=Math.max(69,...headings.map(h=>h.nameHeight+h.portsHeight+h.taggedHeight+12)),top=188+headerHeight;
      if(rowSizes.some(row=>top+row.height>851)||!plans[at+count])continue;
      const buckets=[];let bucket=[],height=0;
      for(const row of rowSizes){if(bucket.length&&top+height+row.height>851){buckets.push(bucket);bucket=[];height=0;}bucket.push(row);height+=row.height;}if(bucket.length)buckets.push(bucket);
      const tail=plans[at+count],candidate={batch,colW,headings,headerHeight,top,buckets,next:at+count,pages:buckets.length+tail.pages,splits:buckets.length-1+tail.splits,headerArea:headerHeight*buckets.length+tail.headerArea},best=plans[at];
      if(!best||candidate.pages<best.pages||candidate.pages===best.pages&&(candidate.splits<best.splits||candidate.splits===best.splits&&candidate.headerArea<best.headerArea))plans[at]=candidate;
    }
  }
  if(!plans[0])throw Error('A trunk-matrix label needs more room than one page. Shorten its device, interface or VLAN name.');
  for(let at=0;at<groups.length;at=plans[at].next){
    const {batch,colW,headings,headerHeight,top,buckets}=plans[at];
    for(const rows of buckets){
    const p=fresh('Trunk VLANs','Trunk VLANs','Native and tagged VLANs by configured interface group',project),a=p.items;
    label(a,36,150,1128,25,'N   Native / untagged       T   Tagged       ·   Outside configured membership',13,true,C.muted);
    rect(a,36,188,1128,headerHeight,C.ink);label(a,49,188,245,headerHeight,'VLAN / Name',15,true,C.white);
    headings.forEach(({g,nameHeight,portsHeight,taggedHeight},i)=>{const x=left+i*colW+4;
      label(a,x,193,colW-8,nameHeight,g.device,14,true,C.white,'center');
      label(a,x,193+nameHeight,colW-8,portsHeight,interfaceList(g.ports),12,false,C.white,'center');
      label(a,x,193+nameHeight+portsHeight,colW-8,taggedHeight,vlanSet(g.tagged),11,false,C.white,'center');
    });
    let y=top;rows.forEach(({id,height},i)=>{rect(a,36,y,1128,height,i%2?C.pale:C.white);
      label(a,48,y,250,height,id+'    '+(names.get(id)||''),14,true);
      batch.forEach((g,j)=>{const x=left+(j+.5)*colW,ch=g.native===id?'N':g.tagged.some(k=>String(k).toLowerCase()==='all'||Number(k)===id)?'T':'·';
        if(ch!=='·')rect(a,x-18,y+(height-22)/2,36,22,ch==='N'?C.ink:'#D7ECE8');
        label(a,x-19,y+(height-24)/2,38,24,ch,13,true,ch==='N'?C.white:C.ink,'center');
      });y+=height;
    });pages.push(p);
    }
  }
  return pages;
}
function logical(project,db){
  const sections=[], trunks=[];
  for(const d of db.devices.values()){
    const name=nameOf(d),rows=[];
    list(d.vlans).forEach(v=>{
      const ifaces=list(v.interfaces);
      if(!ifaces.length)rows.push([name,'VLAN '+value(v.id),value(v.name),value(v.ip||v.address),'']);
      else ifaces.forEach(i=>rows.push([name,'VLAN '+value(v.id),[v.name,i.name].filter(Boolean).join(' / '),value(i.ip||v.ip),value(i.parent)]));
    });
    list(d.bridges).forEach(b=>rows.push([name,'Bridge',value(b.name),value(b.type),value(b.members)]));
    list(d.routes).forEach(r=>rows.push([name,'Route',typeof r==='string'?r:field(r,'destination','prefix','network','dst','subnet'),field(r,'nextHop','gateway','via','next_hop'),field(r,'interface','outInterface','port','device')]));
    if(rows.length)sections.push({id:d.id,name,rows:rows.map(row=>row.slice(1))});
    const profiles=new Map();
    portList(d).forEach(port=>{
      const o=uplinkSettings(d,port);
      if(!value(o.tagged)&&!value(o.lag)&&!/trunk|uplink/i.test(value(o.role)))return;
      const values=[value(o.native)||'Unspecified',vlanSet(o.tagged)||'Unspecified',value(o.lag),value(o.description)],key=JSON.stringify(values);
      if(!profiles.has(key))profiles.set(key,{names:[],values});
      profiles.get(key).names.push(o.name);
    });
    for(const g of profiles.values())trunks.push([name,interfaceList(g.names),...g.values]);
  }
  const matrix=membershipMatrix(project,db);
  return [...logicalPages(project,sections),
    ...(matrix.length?matrix:tablePages(project,'Trunk VLANs','Native and tagged VLAN membership on trunks and aggregates',[['Device',243],['Interface',164],['Native VLAN',145],['Tagged VLANs',235],['LAG',94],['Description',247]],trunks,'No trunk, tagged-port or aggregate records were supplied.'))];
}
export function buildPages(project={}){
  const db=inventory(project),pages=[...corePages(project,db),...portMaps(project,db),...wireless(project,db),...logical(project,db)];
  const totals=new Map(),seen=new Map();
  for(const p of pages)totals.set(p.name,(totals.get(p.name)||0)+1);
  pages.forEach((p,i)=>{
    const n=(seen.get(p.name)||0)+1;seen.set(p.name,n);
    if(totals.get(p.name)>1)p.name+=' '+n;
    rect(p.items,36,H-47,1128,1,C.rule);label(p.items,36,H-39,972,21,p.name,12,false,C.muted);const number=pageNumber(project.layout?.pageNumbers,i,pages.length);if(number!=null){label(p.items,1000,H-40,164,22,number,13,true,C.teal,'right');p.items.at(-1).editKey=p.name+'|page-number';}
    applyDrawingEdits(p,project);if(p.title==='Wireless Connections'){linkLegend(p);applyDrawingEdits(p,project);}bridge(p);p.svg=svgPage(p);
  });
  return pages;
}
export function printDocument(pages){
  return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Network documentation</title><style>@page{size:landscape;margin:5mm}*{box-sizing:border-box}body{margin:0;background:#e9edef}section{background:white;max-width:1200px;margin:12px auto;break-after:page;page-break-after:always}section:last-child{break-after:auto;page-break-after:auto}svg{display:block;width:100%;height:auto}@media print{body{background:white}section{margin:0;max-width:none;height:95vh}svg{width:100%;height:100%}}</style><body>'+pages.map(p=>'<section aria-label="'+xml(p.name)+'">'+svgPage(p)+'</section>').join('')+'</body></html>';
}
