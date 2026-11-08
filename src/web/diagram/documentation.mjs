import {logicalPort} from '../physical-links.mjs';
import {logicalHash,logicalDevicePrefix} from './logical.mjs';
import {portRanges} from '../port-table.mjs';

const NAME='VLANs and Routing';
const list=value=>Array.isArray(value)?value:[];
const supplied=value=>value!==undefined&&value!==null&&value!==''&&(!Array.isArray(value)||value.length>0);
const title=key=>({ip:'IP',ips:'IP addresses',vlan:'VLAN',native:'Native VLAN',nativeTagged:'Native VLAN tagged',tagged:'Tagged VLANs',allowedExcept:'Except VLANs',voice:'Voice VLAN',lag:'LAG',vdom:'VDOM',l3:'Layer 3 interface',nextHop:'Next hop',addressObject:'Address object',configuredType:'Configured type'}[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase()));
function display(value){
 if(Array.isArray(value))return value.map(display).filter(Boolean).join(', ');
 if(value&&typeof value==='object')return Object.entries(value).filter(([,v])=>supplied(v)).map(([k,v])=>title(k)+': '+display(v)).join('; ');
 return supplied(value)?String(value):'';
}
function vlanMembership(value){
 if(!Array.isArray(value)||value.some(id=>!Number.isInteger(+id)||+id<1))return display(value);
 const ids=[...new Set(value.map(Number))].sort((a,b)=>a-b),ranges=[];
 for(let i=0;i<ids.length;i++){let end=i;while(end+1<ids.length&&ids[end+1]===ids[end]+1)end++;ranges.push(ids[i]===ids[end]?String(ids[i]):ids[i]+'-'+ids[end]);i=end;}
 return ranges.join(', ');
}
const extras=(record,handled)=>Object.entries(record||{}).filter(([key,value])=>!handled.includes(key)&&supplied(value)).map(([key,value])=>title(key)+': '+(['tagged','allowedExcept','reportedVlans'].includes(key)?vlanMembership(value):key==='members'&&Array.isArray(value)?portRanges(value.map(display)):display(value)));
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])])):value;
const fingerprint=(type,record)=>JSON.stringify([type,canonical(record)]);
const pick=(record,names)=>{const key=names.find(key=>supplied(record?.[key]));return {key,value:key?display(record[key]):''};};
export function interfaceAddresses(record={}){
 return [...new Set([record.ip,record.address,...list(record.ips)].flatMap(value=>Array.isArray(value)?value:[value]).map(display).filter(Boolean))];
}
export function documentationMode(project){return project.layout?.documentation==='full'?'full':'concise';}
export function savedReportLayout(project,family){
 const pattern=family==='trunk'?/(?:^|\|)Trunk VLANs(?:\b|\|)/:family==='ports'?/(?:^|\|)(?:MDF Port Map|Port Inventory)(?:\b|\|)/:/(?:^|\|)VLANs and Routing(?:\b|\|)/;
 return Object.keys(project.layout?.drawingEdits||{}).some(key=>pattern.test(key))||Object.keys(project.layout?.presentation?.pages||{}).some(key=>pattern.test(key))||Boolean(project.layout?.pageSetup?.overrides?.[family]);
}
export function includeTrunkReference(project){
 return documentationMode(project)==='full'||savedReportLayout(project,'trunk');
}
function deviceRecords(device,project){
 const rows=[];
 const add=(type,source,values)=>rows.push({type,source,fingerprint:fingerprint(type,source),values});
 for(const vlan of list(device.vlans)){
  const interfaces=list(vlan.interfaces),common=extras(vlan,['id','name','ip','address','ips','interfaces']);
  if(!interfaces.length)add('vlan',vlan,['VLAN '+display(vlan.id),display(vlan.name),interfaceAddresses(vlan).join(', '),common.join(' | ')]);
  else{
   const used=new Set(interfaces.flatMap(iface=>interfaceAddresses(iface))),remaining=interfaceAddresses(vlan).filter(ip=>!used.has(ip));
   interfaces.forEach((iface,index)=>{
    const addresses=interfaceAddresses(iface),details=[display(iface.parent),...extras(iface,['name','parent','ip','address','ips']),...(index===0?common:[])].filter(Boolean);
    // A VLAN may contain more than one routed interface. Keep every distinct
    // address, including a separate VLAN-level address, without repeating it
    // on each subinterface.
    if(index===0&&remaining.length)details.push('VLAN address: '+remaining.join(', '));
    add('vlan-interface',{vlan,interface:index},['VLAN '+display(vlan.id),[display(vlan.name),display(iface.name)].filter(Boolean).join(' / '),addresses.join(', '),details.join(' | ')]);
   });
  }
 }
 for(const bridge of list(device.bridges))add('bridge',bridge,['Bridge',display(bridge.name),display(bridge.type),[display(bridge.members),...extras(bridge,['name','type','members'])].filter(Boolean).join(' | ')]);
 for(const route of list(device.routes)){
  if(typeof route==='string'){add('route',route,['Route',route,'','']);continue;}
  const destination=pick(route,['destination','prefix','network','dst','subnet']),hop=pick(route,['nextHop','gateway','via','next_hop']),egress=pick(route,['interface','outInterface','port','device']);
  add('route',route,['Route',destination.value,hop.value,[egress.value,...extras(route,[destination.key,hop.key,egress.key])].filter(Boolean).join(' | ')]);
 }
 for(const port of list(device.ports)){
  if(!port?.name)continue;
  const addresses=interfaceAddresses(port),logical=logicalPort(port);
  // Physical switch assignments and all their addresses belong to Port
  // Inventory. Logical interfaces and network configuration on other
  // device types have no inventory row and belong in this catalogue. A
  // standalone link-state observation is already part of the topology.
  if(!logical&&device.kind==='switch')continue;
  if(!logical&&!addresses.length&&!['native','tagged','allowedExcept','voice','vlan','members','lag'].some(key=>supplied(port[key])))continue;
  if(!Object.entries(port).some(([key,value])=>key!=='name'&&supplied(value)))continue;
  const covered=list(device.vlans).some(vlan=>list(vlan.interfaces).some(iface=>String(iface.name)===String(port.name)&&String(iface.parent||'')===String(port.parent||'')&&addresses.every(ip=>interfaceAddresses(iface).includes(ip))&&(!port.vlan||String(port.vlan)===String(vlan.id))&&(!port.role||/^(?:vlan|vlan subinterface|subinterface)$/i.test(port.role))&&Object.keys(port).every(key=>['name','parent','ip','address','ips','role','vlan'].includes(key))));
  if(covered)continue;
  add('interface',port,['Interface',display(port.name),addresses.join(', '),[port.parent?'Parent: '+display(port.parent):'',...extras(port,['name','ip','address','ips','parent'])].filter(Boolean).join(' | ')]);
  if(documentationMode(project)==='concise'&&!project._reportPrefix&&!Object.entries(project.layout?.presentation?.pages||{}).some(([name,settings])=>/^VLANs and Routing/.test(name)&&settings.hidden)){
   const owned=new Set(list(device.vlans).flatMap(vlan=>list(vlan.interfaces).filter(iface=>String(iface.name)===String(port.name)&&String(iface.parent||'')===String(port.parent||'')).flatMap(iface=>interfaceAddresses(iface))));
   rows.at(-1).addresses=addresses.filter(address=>!owned.has(address));
  }
 }
 return rows;
}
export function documentationSections(project,devices){
 const records=[...devices].map(device=>{
  const prefix=logicalDevicePrefix(project,device.id),seen=new Map(),rows=deviceRecords(device,project);
  for(const row of rows){const identity=JSON.stringify(row.values.slice(0,2)),count=seen.get(identity)||0;seen.set(identity,count+1);row.key=prefix+'|record|'+logicalHash(identity)+'|'+count;if(row.type==='interface')row.inventoryKey=inventoryPrefix(project,[device.id])+'|record|'+logicalHash(identity)+'|'+count;}
  return {id:device.id,name:device.name||device.id,sourceDeviceIds:[device.id],keyPrefix:prefix,records:rows};
 }).filter(section=>section.records.length);
 const finish=section=>({...section,rows:section.records.map(row=>row.values),recordKeys:section.records.map(row=>row.key)});
 const edits=Object.keys(project.layout?.drawingEdits||{}),full=documentationMode(project)==='full',legacy=edits.some(key=>/^VLANs and Routing(?: \d+)?\|text\|/.test(key)),groups=new Map();
 if(full&&!edits.some(key=>key.includes(NAME+'|shared|')||key.startsWith(inventoryBase(project)+'|scope|')))return partitionInventory(project,records).map(finish);
 for(const section of records){
  // Old device-specific edits retain their original scope and keys. Shared
  // rows use their own scope, so editing one cannot silently change a
  // previously customized device record.
  section.locked=legacy||edits.some(key=>key.startsWith(section.keyPrefix+'|')||key.startsWith(inventoryPrefix(project,[section.id])+'|'));
  if(section.locked)continue;
  for(const row of section.records){if(!groups.has(row.fingerprint))groups.set(row.fingerprint,[]);groups.get(row.fingerprint).push({section,row});}
 }
 const shared=new Map(),taken=new Set();
 for(const [identity,entries] of groups){
  const sources=[...new Map(entries.map(entry=>[entry.section.id,entry.section])).values()].sort((a,b)=>String(a.id).localeCompare(String(b.id),'en',{numeric:true}));
  if(sources.length<2)continue;
  const ids=sources.map(section=>section.id),scope=JSON.stringify(ids),prefix=(project._reportPrefix?project._reportPrefix+'|':'')+NAME+'|shared|'+logicalHash(scope);
  if(full&&!edits.some(key=>key.startsWith(prefix+'|')||key.startsWith(inventoryPrefix(project,ids)+'|')))continue;
  if(!shared.has(scope))shared.set(scope,{id:ids[0],name:'Shared: '+sources.map(section=>section.name).join(', '),sourceDeviceIds:ids,keyPrefix:prefix,shared:true,records:[]});
  const representative=entries.find(entry=>entry.section.id===ids[0]).row;
  shared.get(scope).records.push({...representative,key:prefix+'|record|'+logicalHash(identity)});
  entries.forEach(entry=>taken.add(entry.row));
 }
 const sections=[...shared.values(),...records.map(section=>({...section,records:section.records.filter(row=>!taken.has(row))})).filter(section=>section.records.length)];
 return partitionInventory(project,sections).map(finish);
}

export const logicalInventoryName='Port Inventory - Interfaces';
export const logicalInventoryColumns=[['Interface',112],['Type',124],['State / admin',88],['Speed',80],['IP / MAC address',160],['VLAN membership',240],['Details / members',324]];
function inventoryBase(project){return (project._reportPrefix?project._reportPrefix+'|':'')+logicalInventoryName;}
function inventoryPrefix(project,ids){return inventoryBase(project)+'|scope|'+logicalHash(JSON.stringify(ids.slice().sort()));}
function partitionInventory(project,sections){
 const output=[];
 for(const section of sections){
  const inventory=[],network=[];
  for(const record of section.records){
   if(record.type!=='interface'){network.push(record);continue;}
   const port=record.source,vlanKeys=['native','nativeTagged','tagged','allowedExcept','voice','reportedVlans','vlan'];
   const vlans=[supplied(port.native)?'Native '+display(port.native)+(supplied(port.nativeTagged)?port.nativeTagged?' (tagged)':' (untagged)':''):'',supplied(port.tagged)?'Tagged '+vlanMembership(port.tagged):'',supplied(port.allowedExcept)?'Except '+vlanMembership(port.allowedExcept):'',supplied(port.voice)?'Voice '+display(port.voice):'',supplied(port.reportedVlans)?'Observed '+vlanMembership(port.reportedVlans):'',supplied(port.vlan)?'VLAN '+display(port.vlan):''].filter(Boolean),details=extras(port,['name','type','state','admin','speed','mac','ip','address','ips',...vlanKeys]);
   const state=port.state&&port.admin?display(port.state)+' / '+display(port.admin):port.state?'Link '+display(port.state):port.admin?'Admin '+display(port.admin):'',speed=typeof port.speed==='number'&&port.speed>=1e6?port.speed>=1e9?port.speed/1e9+' Gbps':port.speed/1e6+' Mbps':display(port.speed);
   inventory.push({...record,values:[display(port.name),display(port.type),state,speed,[...(record.addresses??interfaceAddresses(port)),display(port.mac)].filter(Boolean).join('\n'),vlans.join(' | '),details.join(' | ')]});
  }
  if(network.length)output.push({...section,records:network});
  if(inventory.length){
   const prefix=inventoryPrefix(project,section.sourceDeviceIds);
   const notes=[];
   // Repeated complete membership/configuration values get a local key.
   // Each row still names its interface and every unique value appears in
   // full above the table, including on continuation sheets.
   for(const [column,caption] of [[5,'VLAN profile'],[6,'Detail profile']]){
    const counts=new Map();for(const record of inventory){const text=record.values[column];if(text)counts.set(text,(counts.get(text)||0)+1);}
    let number=0;for(const [text,count] of counts){if(count<3||text.length<36)continue;const label=caption+' '+(++number);notes.push({key:'profile|'+column+'|'+logicalHash(text),value:label+': '+text});for(const record of inventory)if(record.values[column]===text)record.values[column]=label;}
   }
   // Cell keys follow the named source interface, not observed state, speed or
   // address values. A shared row retains its stable representative's key;
   // customizing it keeps that device separate on the next rebuild.
   output.push({...section,keyPrefix:prefix,inventory:true,notes,records:inventory.map(record=>({...record,key:record.inventoryKey}))});
  }
 }
 return output;
}
