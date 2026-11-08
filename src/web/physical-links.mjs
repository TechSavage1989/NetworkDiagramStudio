// Logical neighbor observations remain in inventory/review, but are not cables.
const virtual=new Set(['virtual','logical','loopback','aggregate','link aggregation','vlan','softwareloopback','l3ipvlans','tunnel','hard-switch','switch','vap-switch','vdom-link','redundant']);
export function logicalPort(port={}){
 return Boolean(port.parent||port.members?.length||virtual.has(String(port.type||'').toLowerCase())||virtual.has(String(port.configuredType||'').toLowerCase())||/^(?:vlan(?:if|[-. ]?\d)|loopback|lo\d+$|lag[- ]?\d|trk\d+$|port-channel|po\d+$|ae\d+$|bridge-aggregation|route-aggregation|eth-trunk|bond\d+|null\d+|bridge[- ]?\d|tunnel\d*|irb\d*|bvi\d*|bdi\d*)/i.test(String(port.name||''))||/\.\d+$/.test(String(port.name||'')));
}
export function physicalLink(link,devices){
 return [[link.a,link.ap],[link.b,link.bp]].every(([id,name])=>{
  const device=devices instanceof Map?devices.get(id):devices.find(d=>d.id===id);
  const port=device?.ports?.find(p=>String(p.name).toLowerCase()===String(name).toLowerCase());
  return !logicalPort(port||{name});
 });
}
export const physicalInventory=db=>({...db,links:db.links.filter(link=>physicalLink(link,db.devices))});
