import {hardwareProfile,portCapability} from '../imports/hardware.mjs';
import {C,W,H,addDevice,bridge,fresh,getAnchor,label,list,mediaInfo,optic,physicalPorts,portList,rate,rect,route,short,split,state,svgPage,value,xml} from './scene.mjs';
export {exportVisio,exportStencil} from './visio.mjs';

const cmp=(a,b)=>String(a).localeCompare(String(b),'en',{numeric:true,sensitivity:'base'});
const idOf=v=>String(v&&typeof v==='object'?v.id:v??'');
const nameOf=d=>String(d?.name||d?.id||'Unnamed');
const field=(o,...keys)=>keys.map(k=>value(o?.[k])).find(Boolean)||'';
function inventory(p){
  const devices=new Map(), links=[];
  for(const d of list(p.devices))if(d && idOf(d.id) && !devices.has(idOf(d.id)))devices.set(idOf(d.id),d);
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
function batches(edges,maxEdges,maxNodes,columnFor){
  const out=[];let es=[],ids=new Set(),terminals=new Set(),columns=[];
  function flush(){if(es.length)out.push({es,ids:[...ids]});es=[];ids=new Set();terminals=new Set();columns=[];}
  for(const e of edges){
    const t=[e.a+'|'+e.ap,e.b+'|'+e.bp];
    const exits=[columnFor(e.a,e.ap),columnFor(e.b,e.bp)].filter(Boolean);
    // Distinct jacks on multirow chassis can share a vertical lead out of the same bank.
    const sharedLead=exits.some(x=>columns.some(o=>o.id===x.id&&o.top===x.top&&Math.abs(o.x-x.x)<3));
    if(es.length&&(es.length>=maxEdges||new Set([...ids,e.a,e.b]).size>maxNodes||t.some(k=>terminals.has(k))||sharedLead))flush();
    es.push(e);ids.add(e.a);ids.add(e.b);t.forEach(k=>terminals.add(k));columns.push(...exits);
  }
  flush();return out;
}
function core(p,db){
  const devices=new Map(db.devices),handoffs=[];
  for(const d of db.devices.values()){
    if(d.kind==='ap')continue;
    const occupied=new Set(db.links.flatMap(l=>l.a===d.id?[l.ap]:l.b===d.id?[l.bp]:[]));
    for(const port of physicalPorts(d)){
      const children=portList(d).filter(sub=>sub.parent===port.name&&sub.sdwanMember);
      const uplink=port.sdwanMember||port.role==='wan'?port:children[0]||port;
      const explicit=port.handoff||port.role==='handoff';
      if(occupied.has(port.name)||(!explicit&&!((uplink.role==='wan'||uplink.sdwanMember)&&(uplink.gateway||uplink.zone||uplink.ip||uplink.state==='up'))))continue;
      let id='handoff:'+d.id+'/'+port.name;while(devices.has(id))id+='_';
      const capability=portCapability(hardwareProfile(d),port.name);
      const media=port.media||(/base-t$/i.test(capability||'')?'copper':'unknown');
      const name=typeof port.handoff==='string'?port.handoff:uplink.description||port.description||(children.length?children.map(sub=>sub.name).join(', '):port.name+' handoff');
      const gateways=[...new Set([port,...children].map(sub=>sub.gateway).filter(Boolean))];
      devices.set(id,{id,name,kind:'handoff',model:uplink.zone||(uplink.vlan?'VLAN '+uplink.vlan:'Site handoff'),ip:gateways.length?'Gateway '+gateways.join(', '):'',ports:[{name:'handoff'}]});
      handoffs.push({a:id,ap:'handoff',b:d.id,bp:port.name,media,speed:port.speed,status:'configured',idx:db.links.length+handoffs.length});
    }
  }
  db={devices,links:[...handoffs,...db.links]};
  const filtered=db.links.filter(e=>![db.devices.get(e.a).kind,db.devices.get(e.b).kind].includes('ap')||[db.devices.get(e.a).kind,db.devices.get(e.b).kind].every(k=>k==='ap'));
  const probes=new Map();
  function exitColumn(id,port){
    if(!probes.has(id))probes.set(id,addDevice({items:[]},p,db.devices.get(id),[384,0,466,50],'probe'));
    const node=probes.get(id),key=Object.keys(node.ports).find(k=>k.toLowerCase()===port.toLowerCase());
    if(key===undefined)return null;
    const [x,y]=node.ports[key];
    return {id,top:y<=.5,x:x*node.w};
  }
  const pages=batches(filtered,6,6,exitColumn), attached=new Set(filtered.flatMap(e=>[e.a,e.b]));
  const solo=[...db.devices].filter(([id,d])=>d.kind!=='ap'&&!attached.has(id)).map(([id])=>id);
  for(const ids of split(solo,5))pages.push({es:[],ids});if(!pages.length)pages.push({es:[],ids:[]});
  return pages.map(({es,ids},ip)=>{
    const page=fresh('Core Network','Core Network','Infrastructure devices and their reported or configured links',p);const a=page.items;
    if(!ids.length){empty(page,'No infrastructure devices or links were supplied.');return page;}
    ids.sort((a,b)=>{const rank=id=>({handoff:0,firewall:1,switch:2})[db.devices.get(id).kind]??3;return rank(a)-rank(b);});
    const nodes=new Map(),railMarks=[],rowH=Math.min(140,660/ids.length);
    const top=180+(660-ids.length*rowH)/2;
    ids.forEach((id,i)=>{
      const d=db.devices.get(id),y=top+i*rowH+rowH/2;
      const k=addDevice(page,p,d,[384,y-25,466,50],'node'+i);
      if(d.kind==='handoff')label(a,k.x+12,k.y,k.w-24,k.h,d.name,16,true,C.ink,'center');
      nodes.set(id,k);
      label(a,38,y-26,226,22,short(nameOf(d),28),16,true);
      label(a,38,y-2,223,17,short([d.vendor,d.model].filter(Boolean).join(' ')||d.kind||'Device',30),13,false,C.muted);
      label(a,38,y+17,224,16,value(d.ip)||(k.fallback?'Schematic front':''),12,false,C.muted);
    });
    rect(a,879,163,1,665,C.rule);
    label(a,904,163,250,22,es.length?'LINK REGISTER':'DEVICE INVENTORY',14,true,C.teal);
    if(!es.length)label(a,904,213,248,32,'No links supplied here',15,false,C.muted);
    const departures=new Map();
    function endpoint(id,port,unique,prefer,info){
      const node=nodes.get(id),dist=getAnchor(node,port,prefer,unique),bucket=id+'/'+dist.side;
      const count=departures.get(bucket)||0;departures.set(bucket,count+1);
      // Rail lanes sit outside all equipment bodies. Unmapped positions use the perimeter.
      const ay=dist.edge+(dist.side==='top'?-1:1)*(10+count*5);
      const start=node.kind!=='handoff' && info.plug && !String(dist.port).startsWith('uplink.')?optic(page,p,db.devices.get(id),node,dist,info):dist;
      return {anchor:start,ay};
    }
    es.forEach((e,i)=>{
      const info=mediaInfo(e.media),ea=endpoint(e.a,e.ap,i*2,'top',info),eb=endpoint(e.b,e.bp,i*2+1,'bottom',info);
      const rail=384-14*(i+1);
      // Keep the full-height rail between chassis and captions. Short horizontal leads run within each row's clearance band.
      route(page,ea.anchor,eb.anchor,[[ea.anchor.x,ea.anchor.y],[ea.anchor.x,ea.ay],[rail,ea.ay],[rail,eb.ay],[eb.anchor.x,eb.ay],[eb.anchor.x,eb.anchor.y]],info.color,'L'+(e.idx+1)+' · '+[nameOf(db.devices.get(e.a)),e.ap,'/',nameOf(db.devices.get(e.b)),e.bp].join(' '));
      railMarks.push({x:rail,y1:ea.ay,y2:eb.ay,n:e.idx+1});
      const y=202+i*98;
      rect(a,904,y+9,18,3,info.color);
      label(a,930,y,228,24,'L'+(e.idx+1)+'   '+info.name,15,true);
      label(a,904,y+25,253,20,nameOf(db.devices.get(e.a))+' · '+(e.ap||'port unknown'),13);
      label(a,904,y+47,253,20,nameOf(db.devices.get(e.b))+' · '+(e.bp||'port unknown'),13);
      label(a,904,y+70,253,17,[rate(e.speed),value(e.status)].filter(Boolean).join('  ·  '),12,false,C.muted);
    });
    if(es.length){
      const horizontals=a.filter(v=>v.type==='path').flatMap(v=>v.points.slice(1).map((b,j)=>[v.points[j],b]).filter(([a,b])=>a[1]===b[1]));
      for(const r of railMarks){
        const lo=Math.min(r.y1,r.y2)+9,hi=Math.max(r.y1,r.y2)-9;
        for(let y=(lo+hi)/2; y<=hi; y+=7){
          if(horizontals.some(([a,b])=>Math.min(a[0],b[0])<r.x+21&&Math.max(a[0],b[0])>r.x&&Math.abs(a[1]-y)<8))continue;
          label(a,r.x+2,y-6,28,12,'L'+r.n,9,true,C.muted);break;
        }
      }
    }
    return page;
  });
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
function portMaps(project,db){
  const switches=[...db.devices.values()].filter(d=>d.kind==='switch');
  if(!switches.length){const p=fresh('MDF Port Map','MDF Port Map','Port identity, state and configured assignment',project);empty(p,'No switch inventory was supplied.');return [p];}
  const out=[];
  for(const d of switches){
    const ports=physicalPorts(d), cols=[['Interfaces',198],['State',102],['Speed',111],['Role / description',363],['Native VLAN',125],['Tagged VLANs',229]];
    const settings=new Map();
    for(const port of ports){
      const o=uplinkSettings(d,port), fields=[o.state||'Unknown',rate(o.speed),[o.role,o.description].filter(Boolean).join(' · '),value(o.native),vlanSet(o.tagged)];
      const key=JSON.stringify(fields);
      if(!settings.has(key))settings.set(key,{fields,names:[]});
      settings.get(key).names.push(o.name);
    }
    const rows=[...settings.values()].map(g=>[interfaceList(g.names),...g.fields]);
    const probe=addDevice({items:[]},project,d,[67,178,1066,123],'probe');
    const dense=Object.keys(probe.ports).length>80;
    const indexPorts=ports.filter(o=>dense||!probe.ports[o.name]);
    const indexes=split(indexPorts,36),buckets=split(wrappedRows(cols,rows),indexes.length?11:15);
    const fillFor=o=>state(o.state)==='up'?C.up:state(o.state)==='down'?C.down:'#F6E7BB';
    for(let i=0;i<Math.max(1,buckets.length,indexes.length);i++){
      const br=buckets[i]||[],index=indexes[i]||[];
      const p=fresh('MDF Port Map','MDF Port Map',nameOf(d)+'  ·  '+[d.vendor,d.model,d.ip].filter(Boolean).join('  ·  '),project), a=p.items;
      const g=addDevice(p,project,d,[67,178,1066,123],'panel');
      // Omit overlapping badges on dense panels; use a separate, paginated index.
      for(const o of ports){
        const pt=g.ports[o.name];if(!pt||dense)continue;
        const [nx,ny]=pt,cx=g.x+nx*g.w,cy=g.y+ny*g.h;
        const badge=String(o.name).split(/[/:]/).at(-1),bw=Math.min(32,Math.max(12,(badge.length*6)+5));
        rect(a,cx-bw/2,cy-8,bw,16,fillFor(o),'#46606A',.65);label(a,cx-bw/2,cy-8,bw,16,badge,10,true,C.ink,'center');
      }
      label(a,38,315,1110,24,(g.asset?'Imported front view':'Schematic port positions')+'   ·   Green = up     Gray = down     Amber = unknown',14,false,C.muted);
      if(index.length){
        label(a,38,347,1120,22,'INTERFACE INDEX   /   '+(dense?'Dense panel':'Unmapped jack positions'),13,true,C.teal);
        index.forEach((o,j)=>{
          const x=38+(j%12)*94,y=372+Math.floor(j/12)*25;
          rect(a,x,y,89,20,fillFor(o),C.rule,.6);label(a,x+3,y,83,20,o.name,11,true,C.ink,'center');
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
  const db=inventory(project),pages=[...core(project,db),...portMaps(project,db),...wireless(project,db),...logical(project,db)];
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
