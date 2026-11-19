// Logical neighbor observations remain in inventory/review, but are not cables.
const virtual=new Set(['virtual','logical','loopback','aggregate','link aggregation','vlan','softwareloopback','l3ipvlans','tunnel','hard-switch','switch','vap-switch','vdom-link','redundant']);
// Monitoring systems also name logical interfaces by kind, such as Auvik's
// "Virtual NIC" for a switch's VLAN (management) interface.
const virtualType=type=>virtual.has(type)||/\bvirtual\b/.test(type);
export function logicalPort(port={}){
 return Boolean(port.logical===true||port.parent||port.members?.length||virtualType(String(port.type||'').toLowerCase())||virtualType(String(port.configuredType||'').toLowerCase())||/^(?:vlan(?:if|[-. ]?\d)|loopback|lo\d+$|lag[- ]?\d|trk\d+$|port-channel|po\d+$|ae\d+$|bridge-aggregation|route-aggregation|eth-trunk|bond\d+|null\d+|bridge[- ]?\d|tunnel\d*|irb\d*|bvi\d*|bdi\d*|default_vlan$)/i.test(String(port.name||''))||/^\S+\.\d+$/.test(String(port.name||'')));
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
// The note written for a joined link, so it can go when the link gives way.
const joinNotes=new WeakMap();
export const joinNote=link=>joinNotes.get(link);
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
  const joined={a,ap,b,bp,media:'unknown',speed,status:'inferred',endpointSource:'logical neighbor observations',reportedEndpoints},A=get(a)?.name||a,B=get(b)?.name||b;
  const note=A+' '+ap+' and '+B+' '+bp+' each report the other device\'s VLAN interface ('+rows[0].rp+', '+back[0].rp+'); drawing joins them as one inferred cable. Verify the connection.';
  joinNotes.set(joined,note);warnings.add(note);added.push(joined);
 }
 return added;
}

// Monitoring systems also report alternatives that are not the cable itself:
// an HA/management interface next to the data port of the same firewall, a
// peer interface that is down next to one that is up, and an endpoint seen on
// an uplink that also reaches it through the switch it is attached to. Retain
// every observation for review, but draw the one the evidence supports. This
// never synthesizes a port, and a confirmed link is never changed. Each note
// names the cable that is actually drawn in place of the hidden one.
export function reconcilePhysicalObservations(links,devices,warnings=new Set()){
 const get=lookup(devices);
 const special=name=>/^(?:ha\d*|hasync|heartbeat|mgmt\d*|management\d*)$/i.test(name);
 const infrastructure=id=>['switch','router','firewall'].includes(get(id)?.kind);
 const name=id=>get(id)?.name||id,ends=link=>[[link.a,link.ap,link.b,link.bp],[link.b,link.bp,link.a,link.ap]];
 for(const link of links)if(link.physicalEvidence?.kind==='alternate-interface')delete link.physicalEvidence;
 const usable=()=>links.filter(link=>physicalLink(link,devices));
 // Each hidden link remembers the link drawn in its place; notes are written
 // at the end, once every rule has run.
 const marks=[],instead=new Map();
 const hide=(link,reason,preferredLink,note)=>{
  if(link.status==='confirmed')return;
  link.physicalEvidence={kind:'alternate-interface',reason};instead.set(link,preferredLink);marks.push({link,note});
 };
 // Several interfaces of one peer on the same jack: a down interface next to
 // one that is up, or a firewall HA/management interface next to a data port.
 const peerRules=()=>{
  const groups=new Map();
  for(const link of usable())for(const [local,lp,remote,rp] of ends(link)){
   if(unknownName(lp)||unknownName(rp))continue;
   const key=JSON.stringify([local,String(lp).toLowerCase(),remote]);
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push({link,local,lp,remote,rp});
  }
  for(const rows of groups.values()){
   if(new Set(rows.map(row=>row.rp.toLowerCase())).size<2)continue;
   const down=row=>portOf(get(row.remote),row.rp)?.state==='down',up=rows.filter(row=>!down(row)),upPorts=[...new Set(up.map(row=>row.rp.toLowerCase()))];
   if(upPorts.length===1){
    for(const row of rows.filter(down))hide(row.link,'Reported down next to an interface of the same peer that is up.',up[0].link,{row,kind:'down'});
    continue;
   }
   if(get(rows[0].remote)?.kind!=='firewall')continue;
   const data=rows.filter(row=>!special(row.rp)),ports=[...new Set(data.map(row=>row.rp.toLowerCase()))];
   if(ports.length!==1)continue;
   for(const row of rows.filter(row=>special(row.rp)))hide(row.link,'HA/management alternative to an observed data port on the same peer.',data[0].link,{row,kind:'ha'});
  }
 };
 // An endpoint on an uplink and on a port of the switch that uplink leads to.
 // Candidates are collected first and each one is hidden only when following
 // the switches it is reached through ends at a cable that stays drawn (a
 // confirmed one counts); a loop of candidates (redundant paths) proves
 // nothing, so those stay as observed.
 const throughRule=()=>{
  const live=usable(),at=new Map(),byDevice=new Map(),candidates=new Map();
  for(const link of live)for(const [local,lp,remote,rp] of ends(link)){
   const key=local+'\n'+String(lp).toLowerCase();if(!at.has(key))at.set(key,[]);at.get(key).push({remote,rp,link});
   if(!byDevice.has(local))byDevice.set(local,[]);byDevice.get(local).push(link);
  }
  for(const link of live)for(const [x,xp,e] of ends(link)){
   if(link.status==='confirmed'||!infrastructure(x)||infrastructure(e)||unknownName(xp))continue;
   // Other switches, routers or firewalls on the same jack of x.
   const uplinks=(at.get(x+'\n'+String(xp).toLowerCase())||[]).filter(row=>row.link!==link&&row.remote!==x&&row.remote!==e&&infrastructure(row.remote));
   const found=[];
   for(const row of uplinks)for(const other of byDevice.get(e)||[]){
    if(other===link||other===row.link)continue;
    for(const [local,,remote,rp] of ends(other))if(local===e&&remote===row.remote&&String(rp).toLowerCase()!==String(row.rp).toLowerCase())found.push({device:row.remote,port:rp,link:other});
   }
   const via=[...new Set(found.map(entry=>entry.device))];
   if(via.length===1)candidates.set(link,{x,xp,e,via:via[0],options:found});
  }
  const drawn=start=>{
   const seen=new Set([start]);let queue=[start];
   while(queue.length){
    const next=[];
    for(const link of queue)for(const option of candidates.get(link).options){
     if(seen.has(option.link))continue;seen.add(option.link);
     if(!candidates.has(option.link)||option.link.status==='confirmed')return option;
     next.push(option.link);
    }
    queue=next;
   }
   return null;
  };
  for(const [link,c,target] of [...candidates].map(([link,c])=>[link,c,drawn(link)]))if(target)hide(link,'Seen through '+name(c.via)+', which reports this device on its own port.',target.link,{c,kind:'through'});
 };
 peerRules();throughRule();
 // A cable hidden as reached-through can leave a down or HA interface alone on
 // its jack; such groups are looked at again.
 peerRules();
 // The cable drawn in place of a hidden one, following further replacements.
 const shown=link=>{const seen=new Set();while(link&&!seen.has(link)&&!physicalLink(link,devices)){seen.add(link);link=instead.get(link);}return link&&physicalLink(link,devices)?link:null;};
 const farEnd=(link,device)=>ends(link).find(([local])=>local!==device)||ends(link)[0];
 for(const {link,note} of marks){
  const target=shown(instead.get(link)),evidence=link.physicalEvidence;
  if(target){const [device,port]=farEnd(target,note.kind==='through'?note.c.e:note.row.remote);evidence.preferred={device,port};}
  if(note.kind==='through'){
   const {x,xp,e,via}=note.c;
   warnings.add(name(x)+' '+xp+': '+name(e)+' is reached through '+name(via)+'; '+(target?'drawing uses '+name(evidence.preferred.device)+' '+evidence.preferred.port:'no other cable to it is drawn')+'.');
   continue;
  }
  const {row}=note,direct=target&&ends(target).some(([local,lp,remote])=>local===row.local&&String(lp).toLowerCase()===String(row.lp).toLowerCase()&&remote===row.remote);
  const uses=!target?'':direct?ends(target).find(([local])=>local===row.remote)[1]:name(evidence.preferred.device)+' '+evidence.preferred.port;
  if(note.kind==='down')warnings.add(name(row.local)+' '+row.lp+': '+name(row.remote)+' '+row.rp+' is reported down; drawing uses '+(uses||'none of its cables')+'.');
  else warnings.add(name(row.local)+' '+row.lp+': '+name(row.remote)+' '+row.rp+' is an alternate HA/management observation; drawing uses observed '+(uses||'none of its cables')+'.');
 }
}
