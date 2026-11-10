import {deviceDetails,macCaption} from '../device-details.mjs';

// Information panel data is derived only from the current project's declared
// devices and connections. A missing record is never guessed or synthesized.
const text=value=>typeof value==='string'?value.trim():value==null?'':String(value);
const name=d=>text(d?.name)||text(d?.id)||'Device';
const portLabel=p=>text(p?.name);
const rows=(value,max=Infinity)=>[...new Set(value.filter(Boolean))].slice(0,max);
const devicePorts=d=>Array.isArray(d?.ports)?d.ports:[];
const connected=(project,devices)=>{const ids=new Set(devices.map(d=>d.id));return (project.links||[]).filter(link=>ids.has(link.a)||ids.has(link.b));};
const describePort=(d,p)=>[name(d),portLabel(p)].join(' ');
const cap=(array,limit=12)=>array.length<=limit?array.join(', '):array.slice(0,limit).join(', ')+', and '+(array.length-limit)+' more';
export function automaticPanelContent(project,devices,options={}){
 const byId=new Map((project.devices||[]).map(d=>[d.id,d])),links=connected(project,devices);
 const vlanRecords=devices.flatMap(d=>(d.vlans||[]).map(v=>({device:name(d),id:text(v.id),name:text(v.name),addresses:rows([v.ip,v.address,...(v.addresses||[])].map(text))}))).filter(v=>v.id);
 const vlanSummary=new Map();
 for(const v of vlanRecords){if(!vlanSummary.has(v.id))vlanSummary.set(v.id,{names:[],addresses:[]});const group=vlanSummary.get(v.id);group.names.push(v.name);group.addresses.push(...v.addresses);}
 const vlans=options.vlanMode==='devices'?rows(vlanRecords.map(v=>[v.device,'VLAN '+v.id,v.name,...v.addresses].filter(Boolean).join(' · '))):[...vlanSummary].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true})).map(([id,v])=>['VLAN '+id,rows(v.names).join(' / '),rows(v.addresses).join(', ')].filter(Boolean).join(' · '));
 const groups=[];
 for(const d of devices){
  const map=new Map();for(const p of devicePorts(d)){
   const group=text(p.lag||p.aggregate||p.portChannel||p.channelGroup||p.lacpGroup);
   if(!group)continue;
   if(!map.has(group))map.set(group,[]);
   map.get(group).push(portLabel(p));
  }
  for(const [group,members] of map)groups.push(name(d)+' · '+(/^(?:lag|po|port-channel)/i.test(group)?group:'LAG '+group)+' · '+cap(members));
  for(const entry of d.lags||[]){const id=text(entry.name||entry.id||entry.group);if(id&&!map.has(id))groups.push(name(d)+' · '+id+(entry.mode?' · '+text(entry.mode):''));}
 }
 const apPorts=rows(links.flatMap(link=>{
  const a=byId.get(link.a),b=byId.get(link.b);
  if(a?.kind!=='ap'&&b?.kind!=='ap')return [];
  return [(a?.kind==='ap'?[name(b),text(link.bp),'to',name(a),text(link.ap)]:[name(a),text(link.ap),'to',name(b),text(link.bp)]).filter(Boolean).join(' ')];
 }));
 const vsfPorts=rows(devices.flatMap(d=>{
  const members=(d.stackMembers||[]).map(member=>'Member '+text(member.id||member.number)+(member.model?' · '+text(member.model):''));
  const ports=devicePorts(d).filter(p=>/vsf|stack(?:ing)?/i.test([p.role,p.type,p.description,p.purpose].map(text).join(' '))).map(p=>[name(d),portLabel(p),text(p.role||p.description)].filter(Boolean).join(' · '));
  return members.length?[[name(d),'Stack: '+members.length+' members'].join(' · '),...ports]:ports;
 }));
 const uplinks=rows([...links.flatMap(link=>{
  const a=byId.get(link.a),b=byId.get(link.b);
  if(!a||!b||!['switch','firewall','router'].includes(a.kind)&&!['switch','firewall','router'].includes(b.kind))return [];
  if(a.kind==='ap'||b.kind==='ap')return [];
  return [[name(a),text(link.ap),'to',name(b),text(link.bp)].filter(Boolean).join(' ')];
 }),...devices.flatMap(d=>devicePorts(d).filter(p=>/uplink|trunk|wan/i.test([p.role,p.description,p.purpose].map(text).join(' '))).map(p=>[name(d),portLabel(p),text(p.description||p.role)].filter(Boolean).join(' · ')))]);
 const optics=rows(devices.flatMap(d=>devicePorts(d).filter(p=>p.optic||p.transceiver||p.sfp||p.gbic).map(p=>[describePort(d,p),text(p.optic||p.transceiver||p.sfp||p.gbic)].filter(Boolean).join(' · '))));
 const status=devices.map(d=>{const ports=devicePorts(d),up=ports.filter(p=>/^(?:up|connected|online|active)$/i.test(text(p.state))).length,down=ports.filter(p=>/^(?:down|disabled|offline|disconnected)$/i.test(text(p.state))).length;return ports.length?name(d)+' · '+up+' up, '+down+' down, '+(ports.length-up-down)+' unknown ('+ports.length+' ports)':'';}).filter(Boolean);
 const addresses=devices.map(d=>{
  // Keep the complete, sourced address inventory (including interface MACs).
  // A summarized count here silently discards information engineers need.
  const mac=options.addressMode==='ip'?'':macCaption(d,undefined,{full:true});
  return [name(d),...new Set((options.addressMode==='mac'?[]:[d.ip,...(d.ips||[])]).filter(Boolean)).values(),mac].filter(Boolean).join(' · ');
 }).filter(value=>value.includes(' · '));
 const models=devices.map(d=>{const details=deviceDetails(d,project);return details?[name(d),details].join(' · '):'';}).filter(Boolean);
 const routes=devices.flatMap(d=>(d.routes||[]).map(r=>typeof r==='string'?text(r):[r?.destination||r?.prefix||r?.network,r?.gateway||r?.nextHop,r?.interface].map(text).filter(Boolean).join(' · ')).filter(Boolean).map(r=>name(d)+' · '+r));
 const ports=devices.flatMap(d=>devicePorts(d).filter(p=>options.portMode==='described'?p.description:options.portMode==='vlans'?p.native!=null||p.tagged?.length:p.description||p.native!=null||p.tagged?.length||p.speed||p.state).map(p=>[describePort(d,p),text(p.description),p.native!=null?'Native VLAN '+text(p.native):'',p.tagged?.length?'Tagged '+p.tagged.join(', '):'',text(p.speed),text(p.state)].filter(Boolean).join(' · ')));
 return {vlans, lags:rows(groups),apPorts,vsfPorts,uplinks,optics,status,addresses:rows(addresses),models:rows(models),routes:rows(routes),ports:rows(ports)};
}
export const panelEmptyMessages={connections:'No connection types on this page.',modules:'No port module details recorded for this page.',vlans:'No VLAN definitions recorded for these devices.',lags:'No link aggregation groups recorded for these devices.',apPorts:'No wireless AP links recorded for these devices.',vsfPorts:'No stacking members or ports recorded for these devices.',uplinks:'No uplinks or trunk links recorded for these devices.',optics:'No transceiver details recorded for these devices.',status:'No port status inventory recorded for these devices.',addresses:'No matching device addresses recorded.',models:'No model details recorded for these devices.',routes:'No routes recorded for these devices.',ports:'No ports match the selected detail filter.',notes:'No notes entered.'};
export function panelRows(id,auto,options){
 let content;
 if(Object.hasOwn(options.sectionContent||{},id)&&options.sectionContent[id].trim())content=rows(options.sectionContent[id].split(/\r?\n/).map(text));
 else if(id==='notes')content=text(options.notes)?[text(options.notes)]:[];
 else content=rows(auto[id]||[]);
 if(!content.length)return options.emptySections==='explain-opt-in'?[panelEmptyMessages[id]||'No custom content entered.']:[];
 const limit=options.rowLimit||80;
 return content.length>limit?[...content.slice(0,limit),`${content.length-limit} more items. Increase Rows per section in Pages & layout to show more.`]:content;
}
