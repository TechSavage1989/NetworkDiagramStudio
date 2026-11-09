// Saved-command semantics ported from the retained SwitchportReports/Engine/
// ComwareParser.cs. Catalogue geometry retains its source and layout references.
import {device, empty, ensurePort, ensureVlan, cidr} from './model.mjs';
import {parseConfiguredRoute} from './routing-records.mjs';
import {switchportCatalog} from '../reports/catalog-data.mjs';
import {normalizeReportInventory} from '../reports/model.mjs';

const physical='(?:GigabitEthernet|Ten-GigabitEthernet|Twenty-FiveGigE|FortyGigE|HundredGigE|FourHundredGigE)\\d+/\\d+/\\d+';
const models=switchportCatalog.models.filter(model=>model.os==='Comware');
const safe=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,4000);
const unique=values=>[...new Set(values)];
const productCodes=text=>unique([...String(text).split('\n').filter(line=>/^\s*(?:[;!#]|(?:product|model|chassis|system\s+model)\b)/i.test(line)).join('\n').matchAll(/\b(?:J(?:[A-Z]\d{3}|\d{4})|[RS]\d[A-Z]\d{2})[A-Z]\b/gi)].map(match=>match[0].toUpperCase()));
export function isComwareConfiguration(text){
 return /\bComware\b/i.test(text)||/^\s*version\s+[5-9]\.\d+/im.test(text)&&new RegExp('^\\s*interface\\s+'+physical,'im').test(text)||/^\s*sysname\s+/im.test(text)&&(/^\s*(?:irf(?:-port)?\s|interface\s+Bridge-Aggregation|port\s+hybrid\s+vlan)/im.test(text)||productCodes(text).some(code=>models.some(model=>model.sku===code)));
}
export function parseComware(source,filename='configuration.cfg'){
 if(!isComwareConfiguration(source))return null;
 const text=String(source).replace(/\r/g,''),out=empty();
 const value=pattern=>safe(pattern.exec(text)?.[1]);
 const d=device(value(/^\s*sysname\s+(.+)$/im)||filename.replace(/\.[^.]+$/,''),{kind:'switch',vendor:'HPE',os:'Comware',firmware:value(/^\s*version\s+(.+)$/im),fromConfig:true});
 const inv=normalizeReportInventory({hostname:d.name,vendor:d.vendor,os:d.os,firmware:d.firmware,topology:'Fixed'});
 const block=message=>{if(!inv.blockers.includes(message))inv.blockers.push(message);};
 const declared=new Map([...text.matchAll(/^\s*[#!;]\s*member\s+(\d+)\s+(?:model|type)\s+([A-Z0-9]+)\s*$/gim)].map(m=>[m[1],m[2].toUpperCase()]));
 const members=unique([...text.matchAll(new RegExp('^\\s*interface\\s+(?:range\\s+)?('+physical+')','gim'))].map(m=>m[1].match(/(\d+)\/\d+\/\d+$/)[1]));
 if(!declared.size){const codes=productCodes(text),found=models.find(model=>model.sku===codes[0]);if(codes.length===1&&found&&members.length<=1)declared.set(members[0]||'1',found.sku);else block('Comware configuration does not establish a verified model for every member. Select the exact SKU, or enter member=SKU pairs from chassis labels.');}
 const irf=unique([...text.matchAll(/^\s*irf\s+member\s+(\d+)\b/gim)].map(m=>m[1]).concat(members));
 for(const id of irf)if(!declared.has(id))block('No verified hardware model for Comware member '+id+'.');
 if(declared.size>1||/^\s*irf-port\s+/im.test(text))inv.topology='IRF';
 d.stackMembers=[];d.hardwareSources=[];
 for(const [id,sku] of [...declared].sort((a,b)=>+a[0]-+b[0])){
  const model=models.find(model=>model.sku===sku);if(!model||+id<1||+id>16){block('Unsupported Comware hardware/member assignment: '+id+'='+sku);continue;}
  d.stackMembers.push({id,model:sku});d.hardwareSources.push({member:id,sku,source:model.source,layoutSource:model.layoutSource,sourceCommit:switchportCatalog.sourceCommit});
  const template=normalizeReportInventory(model.inventory),rename=name=>name.replace(/\d+\/(\d+\/\d+)$/,id+'/$1'),groupMap=new Map();
  for(const group of template.groups){const name=inv.topology==='IRF'?'Member '+id:group.id;groupMap.set(group.id,name);inv.groups.push({...group,id:name,device:id,prefix:id+'/0/'});}
  for(const p of template.ports)inv.ports.push({...p,id:rename(p.id),group:groupMap.get(p.group),relatedInterfaces:p.relatedInterfaces.map(rename)});
  for(const row of template.devices)inv.devices.push({...row,id,model:sku});
 }
 if(d.stackMembers.length===1)d.model=d.stackMembers[0].model;
 const hardwareBlockers=new Set(inv.blockers);
 const states=new Map(),aggregates=new Map();
 const state=(name,aggregate=false)=>{const map=aggregate?aggregates:states,key=name.toLowerCase();if(!map.has(key))map.set(key,{p:ensurePort(d,name),untagged:new Set(),permitted:new Set(),pvid:null,all:false,hasPermitted:false,configured:false});return map.get(key);};
 const resolve=spec=>{
  const m=new RegExp('^('+physical+')(?:\\s+to\\s+('+physical+'))?$','i').exec(spec.trim());
  if(!m){block('Unsupported Comware physical interface or breakout syntax.');return [];}
  let names=[m[1]];
  if(m[2]){const a=/^(.*\/)(\d+)$/.exec(m[1]),b=/^(.*\/)(\d+)$/.exec(m[2]);if(a[1].toLowerCase()!==b[1].toLowerCase()||+b[2]<+a[2]||+b[2]-+a[2]>2000){block('Invalid Comware physical interface range.');return [];}names=Array.from({length:+b[2]-+a[2]+1},(_,i)=>a[1]+(+a[2]+i));}
  return names.map(name=>{if(inv.ports.length&&!inv.ports.some(p=>p.id.toLowerCase()===name.toLowerCase()))block('Configured Comware interface is outside the selected hardware inventory: '+name);return state(name);});
 };
 const vlanList=list=>{
  const tokens=list.trim().split(/[\s,]+/),result=[];
  for(let i=0;i<tokens.length;i++){const first=Number(tokens[i]);if(!/^\d+$/.test(tokens[i])||first<1||first>4094){block('Unrecognized or out-of-range Comware VLAN list.');return [];}
   let last=first;if(/^to$/i.test(tokens[i+1]||'')){last=Number(tokens[i+2]);if(!/^\d+$/.test(tokens[i+2]||'')||last<first||last>4094){block('Invalid Comware VLAN range.');return [];}i+=2;}for(let id=first;id<=last;id++)result.push(id);
  }for(const id of result)ensureVlan(d,id);return unique(result).sort((a,b)=>a-b);
 };
 let current=[],currentVlans=[],svi='',irfContext=false;
 const note=(s,message)=>{s.p.notes=unique([...(s.p.notes||[]),message]);};
 for(const raw of text.split('\n')){
  const line=raw.trim();let m;if(!line)continue;
  if(/^(?:#|quit|return)$/i.test(line)){current=[];currentVlans=[];svi='';irfContext=false;continue;}
  if(/^[#!;]/.test(line)||/\b(password|passwd|secret|community|private-key|credential|token|cipher|certificate)\b/i.test(line))continue;
  if((m=/^vlan\s+(.+)$/i.exec(line))){currentVlans=vlanList(m[1]);current=[];svi='';irfContext=false;continue;}
  if((m=/^interface\s+(Bridge-Aggregation|Route-Aggregation)\s*(\d+)$/i.exec(line))){const s=state((/^Route/i.test(m[1])?'RAGG':'BAGG')+m[2],true);s.p.type='aggregate';if(/^Route/i.test(m[1])){s.p.role='Routed';s.p.nativeState='None';}current=[s];currentVlans=[];svi='';irfContext=false;continue;}
  if((m=/^interface\s+Vlan-interface\s*(\d+)$/i.exec(line))){svi='Vlan-interface'+m[1];current=[];currentVlans=[];irfContext=false;continue;}
  if((m=/^interface\s+(?:range\s+)?(.+)$/i.exec(line))){currentVlans=[];svi='';irfContext=false;current=/^(?:LoopBack|NULL|M-GigabitEthernet|Tunnel|Vsi-interface)/i.test(m[1])?[]:resolve(m[1]);continue;}
  if(/^irf-port\s+\d+\/\d+$/i.test(line)){irfContext=true;current=[];currentVlans=[];svi='';continue;}
  if(irfContext&&(m=/^port\s+group\s+interface\s+(.+)$/i.exec(line))){for(const s of resolve(m[1])){s.p.stackLink=true;s.p.role='Stack/IRF';note(s,'Configured IRF link; verify live adjacency.');}continue;}
  if(/^port-group\s+/i.test(line)){block('Comware port-group configuration must be exported as resolved per-interface commands.');current=[];continue;}
  if(currentVlans.length){if((m=/^(?:name|description)\s+(.+)$/i.exec(line)))for(const id of currentVlans)ensureVlan(d,id).name=safe(m[1]);continue;}
  if(svi&&(m=/^ip(v6)? address\s+(.+)$/i.exec(line))){inv.svis.push({interface:svi,address:safe(m[2])});const v=ensureVlan(d,+svi.replace(/\D/g,''));v.addresses=unique([...(v.addresses||[]),safe(m[2])]);const parts=m[2].split(/\s+/);if(!m[1]&&!v.ip)v.ip=cidr(parts[0],parts[1]);continue;}
  if((m=/^ip route-static\s+(.+)$/i.exec(line))){const route=safe(m[1]);inv.routes.push(route);const normalized=route.replace(/^(?:(vpn-instance\s+\S+\s+))?(\d+(?:\.\d+){3})\s+(\d{1,2})(?=\s|$)/i,(_,vrf,ip,bits)=>(vrf||'')+ip+'/'+bits);d.routes.push(parseConfiguredRoute(normalized)||{destination:route,type:'configured-reference'});continue;}
  if(!current.length)continue;
  if((m=/^description\s+(.+)$/i.exec(line))){for(const s of current)s.p.description=safe(m[1]);continue;}
  if(/^(?:undo )?shutdown$/i.test(line)){for(const s of current)s.p.admin=/^undo/i.test(line)?'up':'down';continue;}
  if((m=/^port link-type\s+(access|trunk|hybrid)$/i.exec(line))){for(const s of current)s.p.role=m[1].toUpperCase();continue;}
  if((m=/^port access vlan\s+(\d+)$/i.exec(line))){const ids=vlanList(m[1]);for(const s of current){s.configured=true;s.untagged=new Set(ids);s.p.role='Access';}continue;}
  if((m=/^port (?:trunk|hybrid) pvid vlan\s+(\d+)$/i.exec(line))){const ids=vlanList(m[1]);if(ids.length===1)for(const s of current){s.configured=true;s.pvid=ids[0];s.p.pvid=ids[0];note(s,'Configured ingress PVID: '+ids[0]);}continue;}
  if((m=/^(undo )?port trunk permit vlan\s+(.+)$/i.exec(line))){const remove=!!m[1],all=/^all$/i.test(m[2]),ids=all?[]:vlanList(m[2]);for(const s of current){s.hasPermitted=s.configured=true;if(all){s.all=!remove;if(remove)s.permitted.clear();}else if(remove){if(s.all)block('Comware all-VLAN trunk with explicit exclusions cannot be rendered as a complete fixed-size dot set.');for(const id of ids)s.permitted.delete(id);}else for(const id of ids)s.permitted.add(id);}continue;}
  if((m=/^(undo )?port hybrid vlan\s+(.+?)\s+(tagged|untagged)$/i.exec(line))){const ids=vlanList(m[2]);for(const s of current){s.configured=true;const set=/^tagged$/i.test(m[3])?s.permitted:s.untagged;for(const id of ids)if(m[1])set.delete(id);else set.add(id);}continue;}
  if((m=/^undo port hybrid vlan\s+(.+)$/i.exec(line))){const ids=vlanList(m[1]);for(const s of current){s.configured=true;for(const id of ids){s.permitted.delete(id);s.untagged.delete(id);}}continue;}
  if((m=/^(?:voice-vlan|voice vlan)\s+(\d+)\s+enable$/i.exec(line))){const ids=vlanList(m[1]);if(ids.length===1)for(const s of current){s.p.voice=ids[0];note(s,'Voice VLAN configured; OUI admission/live membership is not established by the saved configuration.');}continue;}
  if((m=/^port link-aggregation group\s+(\d+)$/i.exec(line))){for(const s of current){if(s.p.lag)block('Comware physical interface assigned to more than one aggregate.');s.p.lag='BAGG'+m[1];}continue;}
  if((m=/^link-aggregation mode\s+(dynamic|static)$/i.exec(line))){for(const s of current){s.p.aggregationMode=m[1].toLowerCase();note(s,'Aggregation mode: '+(/^dynamic$/i.test(m[1])?'LACP dynamic':'Static'));}continue;}
  if((m=/^speed\s+(.+)$/i.exec(line))){for(const s of current)s.p.configuredSpeed=safe(m[1]);continue;}
  if(/^port link-mode route$/i.test(line)){for(const s of current){s.p.role='Routed';s.p.nativeState='None';}continue;}
  if((m=/^ip(v6)? address\s+(.+)$/i.exec(line))){for(const s of current){const address=safe(m[2]);s.p.addresses=unique([...(s.p.addresses||[]),address]);note(s,'Address: '+address);if(!m[1]&&!s.p.ip){const parts=m[2].split(/\s+/);s.p.ip=cidr(parts[0],parts[1]);}}continue;}
  if(/^(?:undo )?(?:port (?:access|trunk|hybrid).*vlan|voice-vlan\s+\d|voice vlan\s+\d)/i.test(line))block('Unrecognized Comware VLAN syntax on a physical or aggregate interface.');
 }
 function finish(s){
  const p=s.p;p.configurationResolved=true;if(s.untagged.size>1){block('Multiple explicit untagged VLANs cannot be represented by one native fill on '+p.name);p.native=null;p.nativeState='Unknown';p.tagged=[...s.permitted].sort((a,b)=>a-b);return;}
  let native=[...s.untagged][0]??null;if(/^trunk$/i.test(p.role||'')&&s.pvid&&(s.all||s.permitted.has(s.pvid)))native=s.pvid;
  p.native=native;p.nativeState=native?'Known':s.hasPermitted&&s.pvid?'None':p.nativeState||'Unknown';p.tagged=[...s.permitted].filter(id=>id!==native).sort((a,b)=>a-b);
  if(s.all){p.taggedVlanPolicy='All';note(s,'Tagged VLANs: all allowed by configuration; actual active VLANs require confirmation.');}
 }
 for(const s of aggregates.values())finish(s);
 for(const s of states.values()){
  if(!s.p.lag){finish(s);continue;}
  const a=aggregates.get(s.p.lag.toLowerCase());if(!a){block('Comware aggregate has no explicit configuration: '+s.p.lag);continue;}
  if(s.configured)note(s,'Member VLAN shadow configuration replaced by the explicit aggregate configuration.');
  for(const key of ['native','nativeState','tagged','taggedVlanPolicy','voice','role','pvid','aggregationMode']){delete s.p[key];if(Object.hasOwn(a.p,key))s.p[key]=structuredClone(a.p[key]);}
  for(const n of a.p.notes||[])note(s,n);if(a.p.description)note(s,'Aggregate description: '+a.p.description);
  if(s.p.stackLink)block('Comware interface is both an IRF link and an Ethernet aggregate member: '+s.p.name);
 }
 for(const a of aggregates.values())if(![...states.values()].some(s=>s.p.lag===a.p.name))block('Comware aggregate has no physical members: '+a.p.name);
 inv.assumptions.push('Comware VLAN, voice, bridge-aggregation and configured IRF fields are parsed from saved commands. Omitted defaults, dynamic admission, live links and connected devices remain unconfirmed.','Hardware positions and media follow the selected source-referenced catalogue profile. Optical capability does not identify an installed transceiver.');
 d.switchportInventory=inv;d.reportBlockers=inv.blockers.filter(message=>!hardwareBlockers.has(message)&&!message.startsWith('Configured Comware interface is outside the selected hardware inventory:'));out.warnings.push(...inv.blockers.map(message=>filename+': '+message));out.devices.push(d);return out;
}
