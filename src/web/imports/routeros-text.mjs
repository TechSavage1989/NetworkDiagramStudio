// RouterOS export reader. Only normalized topology/switching fields survive import.
import {routerosSnapshotModel} from './routeros-backup.mjs';
const unquote=value=>String(value||'').replace(/^"|"$/g,'').replace(/\\([0-9a-f]{2}|.)/gi,(_,v)=>v.length===2?String.fromCharCode(parseInt(v,16)):({n:' ',r:' ',t:' '}[v]??v));
const names=value=>String(value||'').split(',').map(v=>v.trim()).filter(Boolean);
const physical=name=>/^(?:ether\d+|sfp(?:-sfpplus)?\d+|qsfpplus\d+-[1-4])$/.test(name);
// Same verified default interface signatures as the retained native parser.
const models={'CRS326-24S+2Q+RM':[1,24,2],'CRS328-24P-4S+RM':[24,4,0],'CRS317-1G-16S+RM':[1,16,0],'CRS309-1G-8S+IN':[1,8,0],'CRS305-1G-4S+IN':[1,4,0],'CRS326-24G-2S+RM':[24,2,0],'CRS326-24G-2S+IN':[24,2,0]};
function vlanIds(value){const result=[];for(const part of names(value)){const m=/^(\d+)(?:-(\d+))?$/.exec(part),lo=Number(m?.[1]),hi=Number(m?.[2]||m?.[1]);if(!m||lo<1||hi>4094||hi<lo)throw Error('Invalid RouterOS VLAN range.');for(let n=lo;n<=hi;n++)result.push(n);}return [...new Set(result)].sort((a,b)=>a-b);}
export function parseRouterosText(text,filename='RouterOS export'){
 if(!/^#.*RouterOS\s+\d|^\/(?:system[ /]+identity|interface[ /]+(?:bridge|ethernet|bonding|vlan)|(?:ip|ipv6)[ /]+(?:address|route))(?:\s|$)/im.test(text))return null;
 const s={Binary:false,Hostname:filename.replace(/\.[^.]+$/,''),Firmware:/^#.*RouterOS\s+([\w.()-]+)/im.exec(text)?.[1]||'',Model:/^#\s*(?:model|board-name)\s*=\s*(.+)$/im.exec(text)?.[1]?.trim()||'',Interfaces:[],Bridges:[],BridgePorts:[],Vlans:[],Bonds:[],LogicalInterfaces:[],Addresses:[],Routes:[],Unsupported:[]};
 let section='';
 for(const raw of text.replace(/\r/g,'').replace(/\\\s*\n\s*/g,'').split('\n')){
  let line=raw.trim();if(!line||line.startsWith('#'))continue;
  if(line.startsWith('/')){const m=/^(.*?)\s+(add|set|remove|enable|disable|print|export|:)\b(.*)$/.exec(line);if(!m){section=line.replace(/^\//,'').replaceAll('/',' ').trim();continue;}section=m[1].replace(/^\//,'').replaceAll('/',' ').trim();line=m[2]+m[3];}
  if(!/^(add|set)\s/.test(line)){if(/^interface (bridge|ethernet|bonding)/.test(section))s.Unsupported.push('Unsupported RouterOS switching command. Supply a complete saved .rsc export.');continue;}
  const p=Object.create(null);for(const m of line.matchAll(/([A-Za-z][A-Za-z0-9-]*)=("(?:\\.|[^"\\])*"|[^\s\]]+)/g))p[m[1]]=unquote(m[2]);
  const disabled=p.disabled==='yes',dynamic=p.dynamic==='yes';
  if(section==='system identity')s.Hostname=p.name||s.Hostname;
  else if(section==='interface ethernet'){
   const original=p['default-name']||unquote(/^set\s+("(?:\\.|[^"\\])*"|[^\s\[]+)/.exec(line)?.[1]);
   if(!original){s.Unsupported.push('RouterOS Ethernet selector has no default-name. Export using normal or verbose RouterOS export.');continue;}
   s.Interfaces.push({Key:p.name||original,Name:p.name||original,DefaultName:original,Comment:p.comment||'',Disabled:disabled});
  }else if(section==='interface bridge'){
   if(!line.startsWith('add ')){s.Unsupported.push('RouterOS bridge set selectors require a complete export with bridge creation.');continue;}
   s.Bridges.push({Key:p.name,Name:p.name,Filtering:p['vlan-filtering']==='yes'});
  }else if(section==='interface bridge port')s.BridgePorts.push({Interface:p.interface,Bridge:p.bridge,Pvid:Number(p.pvid||1),Frames:p['frame-types']||'admit-all',Disabled:disabled,Dynamic:dynamic,TagStacking:p['tag-stacking']==='yes'});
  else if(section==='interface bridge vlan')s.Vlans.push({Bridge:p.bridge,Ids:vlanIds(p['vlan-ids']),Tagged:names(p.tagged),Untagged:names(p.untagged),Comment:p.comment||'',Disabled:disabled,Dynamic:dynamic});
  else if(section==='interface bonding')s.Bonds.push({Name:p.name,Slaves:names(p.slaves),Mode:p.mode||'balance-rr',Disabled:disabled});
  else if(section==='interface vlan'){
   const id=Number(p['vlan-id']);if(!Number.isInteger(id)||id<1||id>4094)s.Unsupported.push('Invalid RouterOS VLAN interface ID.');
   else s.LogicalInterfaces.push({Name:p.name,Parent:p.interface,Vlan:id,Disabled:disabled});
  }else if(section==='ip address'||section==='ipv6 address'){if(p.address&&p.interface)s.Addresses.push({Address:p.address,Interface:p.interface,Disabled:disabled,Dynamic:dynamic});}
  else if(section==='ip route'||section==='ipv6 route'){if(p.gateway||p.type==='blackhole'||p.blackhole==='yes')s.Routes.push({Destination:p['dst-address']||(section==='ipv6 route'?'::/0':'0.0.0.0/0'),Gateway:p.gateway||'blackhole',Interface:p.interface||'',Disabled:disabled,Dynamic:dynamic,Distance:Number(p.distance)||undefined,Table:p['routing-table']||p['routing-mark']||''});}
  else if(section.startsWith('interface ethernet switch'))s.Unsupported.push('Legacy RouterOS switch-chip VLAN syntax is not yet validated. Use bridge VLAN filtering configuration.');
  else if(/^interface bridge (filter|nat|mlag)$/.test(section))s.Unsupported.push('RouterOS bridge filter/NAT/MLAG rules need additional validation before diagram export.');
 }
 const profile=models[s.Model.toUpperCase()],defaults=profile?[...Array.from({length:profile[0]},(_,i)=>'ether'+(i+1)),...Array.from({length:profile[1]},(_,i)=>'sfp-sfpplus'+(i+1)),...Array.from({length:profile[2]},(_,q)=>Array.from({length:4},(_,l)=>`qsfpplus${q+1}-${l+1}`)).flat()]:[];
 if(profile&&s.Interfaces.some(row=>!defaults.includes(row.DefaultName)))s.Unsupported.push('RouterOS interface inventory is outside the selected model layout.');
 // Omitted settings on a verified model use native defaults. Without a model,
 // only explicitly referenced physical names are retained, never a port range.
 const refs=[...defaults,...s.BridgePorts.map(row=>row.Interface),...s.Vlans.flatMap(row=>[...row.Tagged,...row.Untagged]),...s.Bonds.flatMap(row=>row.Slaves),...s.Addresses.map(row=>row.Interface),...s.LogicalInterfaces.map(row=>row.Parent)];
 for(const name of refs)if(physical(name)&&!s.Interfaces.some(row=>row.Name===name||row.DefaultName===name))s.Interfaces.push({Key:name,Name:name,DefaultName:name,Comment:'',Disabled:false});
 return s;
}
export function routerosTextModel(text,filename){const snapshot=parseRouterosText(text,filename);return snapshot?routerosSnapshotModel(snapshot,filename):null;}
