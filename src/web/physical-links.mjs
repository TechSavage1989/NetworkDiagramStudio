// Logical neighbor observations remain in inventory/review, but are not cables.
const virtual=new Set(['virtual','logical','loopback','aggregate','link aggregation','vlan','softwareloopback','l3ipvlans','tunnel','hard-switch','switch','vap-switch','vdom-link','redundant']);
export function logicalPort(port={}){
 return Boolean(port.logical===true||port.parent||port.members?.length||virtual.has(String(port.type||'').toLowerCase())||virtual.has(String(port.configuredType||'').toLowerCase())||/^(?:vlan(?:if|[-. ]?\d)|loopback|lo\d+$|lag[- ]?\d|trk\d+$|port-channel|po\d+$|ae\d+$|bridge-aggregation|route-aggregation|eth-trunk|bond\d+|null\d+|bridge[- ]?\d|tunnel\d*|irb\d*|bvi\d*|bdi\d*)/i.test(String(port.name||''))||/\.\d+$/.test(String(port.name||'')));
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

// A monitoring system can report an HA/management interface and a data interface
// for the same switch jack and firewall. Retain both observations for review, but
// draw the unambiguous data-port observation once. This never synthesizes a port.
export function reconcilePhysicalObservations(links,devices,warnings=new Set()){
 const get=id=>devices instanceof Map?devices.get(id):devices.find(d=>d.id===id),groups=new Map();
 const special=name=>/^(?:ha\d*|hasync|heartbeat|mgmt\d*|management\d*)$/i.test(name);
 const unknown=name=>/^(?:some interface|unknown|unspecified|n\/?a|-|\?)$/i.test(name);
 for(const link of links){
  if(link.physicalEvidence?.kind==='alternate-interface')delete link.physicalEvidence;
  for(const [local,lp,remote,rp] of [[link.a,link.ap,link.b,link.bp],[link.b,link.bp,link.a,link.ap]]){
   if(get(remote)?.kind!=='firewall'||!physicalLink(link,devices)||unknown(lp)||unknown(rp))continue;
   const key=JSON.stringify([local,String(lp).toLowerCase(),remote]);
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push({link,local,lp,remote,rp});
  }
 }
 for(const rows of groups.values()){
  const data=rows.filter(row=>!special(row.rp)),ports=[...new Set(data.map(row=>row.rp.toLowerCase()))];
  if(ports.length!==1)continue;
  const preferred=data[0];
  for(const row of rows.filter(row=>special(row.rp)&&row.link.status!=='confirmed')){
   row.link.physicalEvidence={kind:'alternate-interface',reason:'HA/management alternative to an observed data port on the same peer.',preferred:{device:row.remote,port:preferred.rp}};
   warnings.add((get(row.local)?.name||row.local)+' '+row.lp+': '+(get(row.remote)?.name||row.remote)+' '+row.rp+' is an alternate HA/management observation; drawing uses observed '+preferred.rp+'.');
  }
 }
}
