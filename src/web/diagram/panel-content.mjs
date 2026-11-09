import {deviceDetails,macCaption} from '../device-details.mjs';

// Information panel data is derived only from the current project's declared
// devices and connections. A missing record is never guessed or synthesized.
const text=value=>typeof value==='string'?value.trim():value==null?'':String(value);
const name=d=>text(d?.name)||text(d?.id)||'Device';
const portLabel=p=>text(p?.name);
const rows=(value,max=80)=>[...new Set(value.filter(Boolean))].slice(0,max);
const devicePorts=d=>Array.isArray(d?.ports)?d.ports:[];
const connected=(project,devices)=>{const ids=new Set(devices.map(d=>d.id));return (project.links||[]).filter(link=>ids.has(link.a)||ids.has(link.b));};
const describePort=(d,p)=>[name(d),portLabel(p)].join(' ');
const cap=(array,limit=12)=>array.length<=limit?array.join(', '):array.slice(0,limit).join(', ')+', and '+(array.length-limit)+' more';
export function automaticPanelContent(project,devices){
 const byId=new Map((project.devices||[]).map(d=>[d.id,d])),links=connected(project,devices);
 const vlans=rows(devices.flatMap(d=>(d.vlans||[]).map(v=>[name(d),'VLAN '+text(v.id),text(v.name),text(v.ip||v.address)].filter(Boolean).join(' · '))));
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
  const mac=macCaption(d,undefined,{full:true});
  return [name(d),...new Set([d.ip,...(d.ips||[])].filter(Boolean)).values(),mac].filter(Boolean).join(' · ');
 }).filter(value=>value.includes(' · '));
 const models=devices.map(d=>[name(d),deviceDetails(d)].filter(Boolean).join(' · '));
 const routes=devices.flatMap(d=>(d.routes||[]).map(r=>name(d)+' · '+(typeof r==='string'?r:[r.destination||r.prefix||r.network,r.gateway||r.nextHop,r.interface].map(text).filter(Boolean).join(' · '))));
 const ports=devices.flatMap(d=>devicePorts(d).filter(p=>p.description||p.native!=null||p.tagged?.length).map(p=>[describePort(d,p),text(p.description),p.native!=null?'Native VLAN '+text(p.native):'',p.tagged?.length?'Tagged '+p.tagged.join(', '):'',text(p.speed),text(p.state)].filter(Boolean).join(' · ')));
 return {vlans, lags:rows(groups),apPorts,vsfPorts,uplinks,optics,status,addresses:rows(addresses),models:rows(models),routes:rows(routes),ports:rows(ports)};
}
export function panelRows(id,auto,options){
 if(Object.hasOwn(options.sectionContent||{},id)&&options.sectionContent[id].trim())return rows(options.sectionContent[id].split(/\r?\n/).map(text),180);
 if(id==='notes')return text(options.notes)?[text(options.notes)]:[];
 return rows(auto[id]||[],120);
}
