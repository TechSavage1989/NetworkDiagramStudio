// Logical neighbor observations remain in inventory/review, but are not cables.
const virtual=new Set(['virtual','logical','loopback','aggregate','link aggregation','vlan','softwareloopback','l3ipvlans','tunnel','hard-switch','switch','vap-switch','vdom-link','redundant']);
// Monitoring systems also name logical interfaces by kind, such as Auvik's
// "Virtual NIC" for a switch's VLAN (management) interface.
const virtualType=type=>virtual.has(type)||/\bvirtual\b/.test(type);
export function logicalPort(port={}){
 return Boolean(port.logical===true||port.parent||port.members?.length||virtualType(String(port.type||'').toLowerCase())||virtualType(String(port.configuredType||'').toLowerCase())||/^(?:vlan(?:if|[-. ]?\d)|loopback|lo\d+$|lag[- ]?\d|trk\d+$|port-channel|po\d+$|ae\d+$|bridge-aggregation|route-aggregation|eth-trunk|bond\d+|null\d+|bridge[- ]?\d|tunnel\d*|irb\d*|bvi\d*|bdi\d*)/i.test(String(port.name||''))||/^\S+\.\d+$/.test(String(port.name||'')));
}
export function physicalLink(link,devices){
 if(link.physicalEvidence?.kind==='alternate-interface'&&link.status!=='confirmed')return false;
 return [[link.a,link.ap],[link.b,link.bp]].every(([id,name])=>{
  const device=devices instanceof Map?devices.get(id):devices.find(d=>d.id===id);
  const port=device?.ports?.find(p=>String(p.name).toLowerCase()===String(name).toLowerCase());
  return !logicalPort(port||{name});
 });
}
export const physicalInventory=db=>({...db,links:db.links.filter(link=>physicalLink(link,db.devices))});

const unknownName=name=>/^(?:some interface|unknown|unspecified|n\/?a|-|\?)$/i.test(String(name??'').trim());
const lookup=devices=>id=>devices instanceof Map?devices.get(id):devices.find(d=>d.id===id);
const portOf=(device,name)=>device?.ports?.find(p=>String(p.name).toLowerCase()===String(name).toLowerCase());

// A monitoring system can report a switch port's neighbor as the peer's VLAN
// (management) interface, and the peer's uplink as this switch's VLAN
// interface. When each device has exactly one physical port seeing the other
// this way and no physical link joins them yet, the two halves describe one
// cable between those two ports. The halves stay in the inventory for review;
// the joined link is marked inferred. This never synthesizes a port.
export function joinLogicalObservations(links,devices,warnings=new Set()){
 const get=lookup(devices),logical=(id,name)=>logicalPort(portOf(get(id),name)||{name});
 const pairs=new Set(),halves=new Map(),added=[];
 for(const link of links){
  if(link.a===link.b)continue;
  const la=logical(link.a,link.ap),lb=logical(link.b,link.bp);
  if(!la&&!lb){pairs.add([link.a,link.b].sort().join('\n'));continue;}
  if(la&&lb)continue;
  const [local,lp,remote,rp]=la?[link.b,link.bp,link.a,link.ap]:[link.a,link.ap,link.b,link.bp];
  if(unknownName(lp))continue;
  const key=local+'\n'+remote;if(!halves.has(key))halves.set(key,[]);halves.get(key).push({lp,rp,link});
 }
 for(const [key,rows] of halves){
  const [a,b]=key.split('\n');if(a>b||pairs.has([a,b].sort().join('\n')))continue;
  const back=halves.get(b+'\n'+a);if(!back)continue;
  const ours=[...new Set(rows.map(row=>row.lp.toLowerCase()))],theirs=[...new Set(back.map(row=>row.lp.toLowerCase()))];
  if(ours.length!==1||theirs.length!==1)continue;
  const ap=rows[0].lp,bp=back[0].lp,speed=rows.find(row=>row.link.speed)?.link.speed||back.find(row=>row.link.speed)?.link.speed||'';
  const reportedEndpoints=[...rows,...back].map(({link})=>({a:link.a,ap:link.ap,b:link.b,bp:link.bp}));
  added.push({a,ap,b,bp,media:'unknown',speed,status:'inferred',endpointSource:'logical neighbor observations',reportedEndpoints});
  const A=get(a)?.name||a,B=get(b)?.name||b;
  warnings.add(A+' '+ap+' and '+B+' '+bp+' each report the other device\'s VLAN interface ('+rows[0].rp+', '+back[0].rp+'); drawing joins them as one inferred cable. Verify the connection.');
 }
 return added;
}

// Monitoring systems also report alternatives that are not the cable itself:
// an HA/management interface next to the data port of the same firewall, a
// peer interface that is down next to one that is up, and an endpoint seen on
// an uplink that also reaches it through the switch it is attached to. Retain
// every observation for review, but draw the one the evidence supports. This
// never synthesizes a port, and a confirmed link is never changed.
export function reconcilePhysicalObservations(links,devices,warnings=new Set()){
 const get=lookup(devices);
 const special=name=>/^(?:ha\d*|hasync|heartbeat|mgmt\d*|management\d*)$/i.test(name);
 const infrastructure=id=>['switch','router','firewall'].includes(get(id)?.kind);
 const name=id=>get(id)?.name||id,ends=link=>[[link.a,link.ap,link.b,link.bp],[link.b,link.bp,link.a,link.ap]];
 const alternate=(link,reason,preferred)=>{if(link.status!=='confirmed')link.physicalEvidence={kind:'alternate-interface',reason,preferred};return link.status!=='confirmed';};
 for(const link of links)if(link.physicalEvidence?.kind==='alternate-interface')delete link.physicalEvidence;
 const usable=()=>links.filter(link=>physicalLink(link,devices));
 // An endpoint on an uplink and on a port of the switch that uplink leads to.
 {
  const live=usable(),at=new Map();
  const byDevice=new Map();
  for(const link of live)for(const [local,lp,remote,rp] of ends(link)){
   const key=local+'\n'+String(lp).toLowerCase();if(!at.has(key))at.set(key,[]);at.get(key).push({remote,rp,link});
   if(!byDevice.has(local))byDevice.set(local,[]);byDevice.get(local).push(link);
  }
  for(const link of live)for(const [x,xp,e] of ends(link)){
   if(!infrastructure(x)||infrastructure(e)||unknownName(xp))continue;
   // Other switches, routers or firewalls on the same jack of x.
   const uplinks=(at.get(x+'\n'+String(xp).toLowerCase())||[]).filter(row=>row.link!==link&&row.remote!==x&&row.remote!==e&&infrastructure(row.remote));
   const found=[];
   for(const row of uplinks)for(const other of byDevice.get(e)||[]){
    if(other===link||other===row.link)continue;
    for(const [local,,remote,rp] of ends(other))if(local===e&&remote===row.remote&&String(rp).toLowerCase()!==String(row.rp).toLowerCase())found.push({device:row.remote,port:rp});
   }
   const via=[...new Set(found.map(entry=>entry.device))];
   if(via.length!==1)continue;
   const port=found[0].port;
   if(alternate(link,'Seen through '+name(via[0])+', which reports this device on its own port.',{device:via[0],port}))warnings.add(name(x)+' '+xp+': '+name(e)+' is reached through '+name(via[0])+'; drawing uses '+name(via[0])+' '+port+'.');
  }
 }
 // Several interfaces of one peer on the same jack.
 const groups=new Map();
 for(const link of usable())for(const [local,lp,remote,rp] of ends(link)){
  if(unknownName(lp)||unknownName(rp))continue;
  const key=JSON.stringify([local,String(lp).toLowerCase(),remote]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push({link,local,lp,remote,rp});
 }
 for(const rows of groups.values()){
  if(new Set(rows.map(row=>row.rp.toLowerCase())).size<2)continue;
  // A peer interface reported down is not the cable when another one is up.
  const down=row=>portOf(get(row.remote),row.rp)?.state==='down',up=rows.filter(row=>!down(row)),upPorts=[...new Set(up.map(row=>row.rp.toLowerCase()))];
  if(upPorts.length===1){
   for(const row of rows.filter(down))if(alternate(row.link,'Reported down next to an interface of the same peer that is up.',{device:row.remote,port:up[0].rp}))warnings.add(name(row.local)+' '+row.lp+': '+name(row.remote)+' '+row.rp+' is reported down; drawing uses '+up[0].rp+'.');
   continue;
  }
  if(get(rows[0].remote)?.kind!=='firewall')continue;
  const data=rows.filter(row=>!special(row.rp)),ports=[...new Set(data.map(row=>row.rp.toLowerCase()))];
  if(ports.length!==1)continue;
  const preferred=data[0];
  for(const row of rows.filter(row=>special(row.rp)))if(alternate(row.link,'HA/management alternative to an observed data port on the same peer.',{device:row.remote,port:preferred.rp}))warnings.add(name(row.local)+' '+row.lp+': '+name(row.remote)+' '+row.rp+' is an alternate HA/management observation; drawing uses observed '+preferred.rp+'.');
 }
}
