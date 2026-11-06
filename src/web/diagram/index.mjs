import {corePages} from './core.mjs';
import {orderedDevices} from '../layout.mjs';
import {hardwareProfile,portCapability} from '../imports/hardware.mjs';
import {C,W,H,addDevice,bridge,fresh,getAnchor,label,list,mediaInfo,optic,physicalPorts,portList,rate,rect,route,short,split,state,svgPage,value,xml} from './scene.mjs';
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
function wrapWords(input,max){
  let rest=String(input??'');if(!rest)return [''];const out=[];
  while(rest.length>max){let cut=rest.lastIndexOf(' ',max);if(cut<max*.43)cut=max;out.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();}
  out.push(rest);return out;
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
    const fields=cols.map((c,k)=>wrapWords(value(row[k]),Math.max(3,Math.floor((c[1]-18)/7.4))));
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

function portMapLegend(items,hasAsset){
  for(const [x,color,title] of [[38,'ap','AP peer'],[148,'profile','AP profile'],[282,'uplink','Uplink / LAG'],
      [438,'wired','Wired'],[534,'other','Other / unassigned']]){
    rect(items,x,314,18,14,portFills[color],'#647781',.6);
    label(items,x+25,309,144,24,title,13,false,C.muted);
  }
  label(items,755,309,405,24,hasAsset?'Imported front view':'Schematic port positions',13,false,C.muted,'right');
  label(items,38,330,82,20,'State mark',12,true,C.muted);
  for(const [x,st] of [[128,'up'],[189,'down'],[268,'unknown']]){
    rect(items,x,338,18,3,stateMarks[st]);label(items,x+23,330,68,20,st,12,false,C.muted);
  }
}

function portMaps(project,db){
  const switches=[...db.devices.values()].filter(d=>d.kind==='switch');
  if(!switches.length){const p=fresh('MDF Port Map','MDF Port Map','Port identity, state and configured assignment',project);empty(p,'No switch inventory was supplied.');return [p];}
  const out=[];
  for(const d of switches){
    const ports=physicalPorts(d), assignment=portAssignments(project,db,d,ports);
    const cols=[['Interfaces',148],['Assignment',178],['State',80],['Speed',99],['Mode / description',249],['Native VLAN',107],['Tagged VLANs',267]];
    const settings=new Map();
    for(const port of ports){
      const o=uplinkSettings(d,port), fields=[assignment(port)[0],o.state||'Unknown',rate(o.speed),[o.role,o.description].filter(Boolean).join(' · '),value(o.native),vlanSet(o.tagged)];
      const key=JSON.stringify(fields);
      if(!settings.has(key))settings.set(key,{fields,names:[]});
      settings.get(key).names.push(o.name);
    }
    const rows=[...settings.values()].map(g=>[interfaceList(g.names),...g.fields]);
    const probe=addDevice({items:[]},project,d,[67,178,1066,123],'probe');
    const dense=Object.keys(probe.ports).length>80;
    const indexPorts=ports.filter(o=>dense||!probe.ports[o.name]);
    const indexes=split(indexPorts,36),buckets=split(wrappedRows(cols,rows),indexes.length?11:15);
    function badge(a,x,y,w,h,o,text,size){
      rect(a,x,y,w,h,portFills[assignment(o)[1]],'#617480',.65);
      rect(a,x+1,y+h-3,w-2,2,stateMarks[state(o.state)]);
      label(a,x,y-1,w,h,text,size,true,C.ink,'center');
    }
    for(let i=0;i<Math.max(1,buckets.length,indexes.length);i++){
      const br=buckets[i]||[],index=indexes[i]||[];
      const p=fresh('MDF Port Map','MDF Port Map',nameOf(d)+'  ·  '+[d.vendor,d.model,d.ip].filter(Boolean).join('  ·  '),project), a=p.items;
      const g=addDevice(p,project,d,[67,178,1066,123],'panel');
      // Omit overlapping badges on dense panels; use a separate, paginated index.
      for(const o of ports){
        const pt=g.ports[o.name];if(!pt||dense)continue;
        const [nx,ny]=pt,cx=g.x+nx*g.w,cy=g.y+ny*g.h;
        const text=String(o.name).split(/[/:]/).at(-1),bw=Math.min(32,Math.max(12,(text.length*6)+5));
        badge(a,cx-bw/2,cy-8,bw,16,o,text,10);
      }
      portMapLegend(a,!!g.asset);
      if(index.length){
        label(a,38,354,1120,22,'INTERFACE INDEX   /   '+(dense?'Dense panel':'Unmapped jack positions'),13,true,C.teal);
        index.forEach((o,j)=>{
          const x=38+(j%12)*94,y=380+Math.floor(j/12)*25;
          badge(a,x,y,89,20,o,o.name,11);
        });
      }
      if(br.length)table(p,cols,br,index.length?468:357);
      else if(!ports.length)label(a,38,368,1120,40,'No physical switch port records were supplied.',16,false,C.muted);
      out.push(p);
    }
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
    let bucket=[],counts={top:0,bottom:0},columns=new Set();const batches=[];
    for(const e of sorted){
      const k=getAnchor(panel,e.sp,'top',e.idx),side=k.side;
      const col=side+' '+k.x.toFixed(1);
      if(counts[side]===4||columns.has(col)||bucket.some(b=>b.sp===e.sp)){batches.push(bucket);bucket=[];counts={top:0,bottom:0};columns=new Set();}
      bucket.push(e);counts[side]++;columns.add(col);
    }
    if(bucket.length)batches.push(bucket);
    for(const batch of batches){
      const p=fresh('Wireless Connections','Wireless Connections',nameOf(device)+'  ·  access-point uplinks and physical switch ports',project),a=p.items;
      const swg=addDevice(p,project,device,[101,412,998,91],'switch');
      const per={top:[],bottom:[]};
      batch.forEach((e,i)=>{const start=getAnchor(swg,e.sp,'top',e.idx);per[start.side].push({e,start});});
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
        rs.forEach(({e,start},i)=>{
          const ap=db.devices.get(e.apId),center=centers[i],y=top?248:649;
          const edgeKey=top?'uplink.bottom':'uplink.top';
          const dest=addDevice(p,project,ap,[center-36,y,72,72],'ap'+side+i,{apEdge:edgeKey});
          const end=getAnchor(dest,edgeKey,top?'bottom':'top',i);
          const register=[e.sp||'Port unknown',rate(e.speed),value(e.status)].filter(Boolean).join(' · ');
          const lw=Math.min(245,980/rs.length);
          label(a,center-lw/2,top?166:732,lw,26,nameOf(ap),18,true,C.ink,'center');
          label(a,center-lw/2,top?194:760,lw,21,register,13,true,C.teal,'center');
          label(a,center-lw/2,top?216:783,lw,18,[ap.ip,e.apPort||'AP port unspecified'].filter(Boolean).join(' · '),12,false,C.muted,'center');
          const track=order.indexOf(i),lane=top?381-13*track:543+13*track;
          const info=mediaInfo(e.media,true);
          route(p,start,end,[[start.x,start.y],[start.x,lane],[end.x,lane],[end.x,end.y]],info.color,'AP link '+(e.idx+1));
        });
      }
      out.push(p);
    }
  }
  const unseen=[...apIds].filter(id=>!linked.has(id)).map(id=>db.devices.get(id));
  if(unseen.length)out.push(...tablePages(project,'Wireless Connections','Access points with no mapped switch uplink',[['Access point',390],['Model',370],['Management address',368]],unseen.map(d=>[nameOf(d),d.model,d.ip]),''));
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
  for(const batch of split(groups,6))for(const rows of split(ids,16)){
    const p=fresh('Trunk VLANs','Trunk VLANs','Native and tagged VLANs by configured interface group',project),a=p.items;
    label(a,36,150,1128,25,'N   Native / untagged       T   Tagged       ·   Outside configured membership',13,true,C.muted);
    const left=303,colW=(1164-left)/batch.length;
    rect(a,36,188,1128,77,C.ink);label(a,49,208,245,35,'VLAN / Name',15,true,C.white);
    batch.forEach((g,i)=>{const x=left+i*colW+4;
      label(a,x,193,colW-8,22,g.device,14,true,C.white,'center');
      label(a,x,217,colW-8,18,interfaceList(g.ports),12,false,C.white,'center');
      label(a,x,238,colW-8,17,vlanSet(g.tagged),11,false,C.white,'center');
    });
    rows.forEach((id,i)=>{const y=265+i*34;rect(a,36,y,1128,34,i%2?C.pale:C.white);
      label(a,48,y,250,34,id+'    '+(names.get(id)||''),14,true);
      batch.forEach((g,j)=>{const x=left+(j+.5)*colW,ch=g.native===id?'N':g.tagged.some(k=>String(k).toLowerCase()==='all'||Number(k)===id)?'T':'·';
        if(ch!=='·')rect(a,x-18,y+6,36,22,ch==='N'?C.ink:'#D7ECE8');
        label(a,x-19,y+5,38,24,ch,13,true,ch==='N'?C.white:C.ink,'center');
      });
    });pages.push(p);
  }
  return pages;
}
function logical(project,db){
  const rows=[], trunks=[];
  for(const d of db.devices.values()){
    const name=nameOf(d);
    list(d.vlans).forEach(v=>{
      const ifaces=list(v.interfaces);
      if(!ifaces.length)rows.push([name,'VLAN '+value(v.id),value(v.name),value(v.ip||v.address),'']);
      else ifaces.forEach(i=>rows.push([name,'VLAN '+value(v.id),[v.name,i.name].filter(Boolean).join(' / '),value(i.ip||v.ip),value(i.parent)]));
    });
    list(d.bridges).forEach(b=>rows.push([name,'Bridge',value(b.name),value(b.type),value(b.members)]));
    list(d.routes).forEach(r=>rows.push([name,'Route',typeof r==='string'?r:field(r,'destination','prefix','network','dst','subnet'),field(r,'nextHop','gateway','via','next_hop'),field(r,'interface','outInterface','port','device')]));
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
  return [...tablePages(project,'VLANs and Routing','Configured VLANs, interface addresses and routing entries',[['Device',250],['Record',138],['Name / destination',283],['Address / next hop / type',281],['Egress / members',176]],rows,'No VLAN or route records were supplied.'),
    ...(matrix.length?matrix:tablePages(project,'Trunk VLANs','Native and tagged VLAN membership on trunks and aggregates',[['Device',243],['Interface',164],['Native VLAN',145],['Tagged VLANs',235],['LAG',94],['Description',247]],trunks,'No trunk, tagged-port or aggregate records were supplied.'))];
}
export function buildPages(project={}){
  const db=inventory(project),pages=[...corePages(project,db),...portMaps(project,db),...wireless(project,db),...logical(project,db)];
  const totals=new Map(),seen=new Map();
  for(const p of pages)totals.set(p.name,(totals.get(p.name)||0)+1);
  pages.forEach((p,i)=>{
    const n=(seen.get(p.name)||0)+1;seen.set(p.name,n);
    if(totals.get(p.name)>1)p.name+=' '+n;
    rect(p.items,36,873,1128,1,C.rule);label(p.items,36,881,972,21,p.name,12,false,C.muted);label(p.items,1050,880,114,22,(i+1)+' / '+pages.length,13,true,C.teal,'right');
    bridge(p);p.svg=svgPage(p);
  });
  return pages;
}
export function printDocument(pages){
  return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Network documentation</title><style>@page{size:landscape;margin:5mm}*{box-sizing:border-box}body{margin:0;background:#e9edef}section{background:white;max-width:1200px;margin:12px auto;break-after:page;page-break-after:always}section:last-child{break-after:auto;page-break-after:auto}svg{display:block;width:100%;height:auto}@media print{body{background:white}section{margin:0;max-width:none;height:95vh}svg{width:100%;height:100%}}</style><body>'+pages.map(p=>'<section aria-label="'+xml(p.name)+'">'+svgPage(p)+'</section>').join('')+'</body></html>';
}
