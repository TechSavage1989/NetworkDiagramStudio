import {normalizeMac} from '../device-details.mjs';
import {device,deviceId,empty,ensurePort,ensureVlan,portName,mergeModels} from './model.mjs';
import {identify} from './hardware.mjs';

// Operational captures are evidence only. No supplied command is executed.
const prompt=/^\s*([\w.:-]+)(?:\s*\([^\r\n]*\))?\s*[#>]\s*((?:show|get|diagnose|display)\s+.+)$/im;
const iface=/^(?:\d+(?:\/\d+){1,3}|(?:Gi|Te|Fa|Eth|Ethernet|GigabitEthernet|TenGigabitEthernet|ge-|xe-|et-|ether|port|x|wan|lan|mgmt|ha)[\w./:-]*\d[\w./:-]*)$/i;
export function isOperational(text){return [...String(text).matchAll(new RegExp(prompt.source,'gim'))].some(m=>!/^show (?:running|startup|full-configuration)/i.test(m[2]))||/^\s*(?:show (?!running|startup|full-configuration)|get (?:system|hardware|router)|diagnose hardware|display (?:interface|lldp|version))\S*(?:\s|$)/im.test(text);}
function speed(raw){
 const s=String(raw||'').replace(/^a-/i,'').replace(/[,()]/g,'').trim();
 const m=/^(\d+(?:\.\d+)?)\s*(T|G|M|K)?(?:\s*(?:bits?\/?s|bps|b\/s|b\/sec))?$/i.exec(s);
 if(!m||!+m[1])return '';
 return +m[1]+' '+(m[2]?m[2].toUpperCase():'M')+'bps';
}
export function parseOperational(text,filename='show-commands.txt'){
 const out=empty(),s=String(text).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\r/g,'');
 const captures=new Map();let host='';
 for(const line of s.split('\n')){const m=prompt.exec(line);if(m)host=m[1];if(host){if(!captures.has(host))captures.set(host,[]);captures.get(host).push(line);}}
 if(captures.size>1)return mergeModels([...captures].map(([name,lines])=>parseOperational(lines.join('\n'),name+'.txt')));
 const name=prompt.exec(s)?.[1]||/^\s*(?:Hostname|hostname|System Name)\s*[:=]\s*(\S+)/im.exec(s)?.[1]||filename.replace(/\.[^.]+$/,'');
 const d=device(name,{operational:true});out.devices.push(d);
 let local='',peer='',remote='',peerIP='',peerKind='unknown',peerMac='',p=null,command='',saw=false,pendingRoute='',neighborColumns=null;
 const peerRecords=[];
 function neighbor(){
  if(local&&peer&&remote){peerRecords.push({local,peer,remote,ip:peerIP,kind:peerKind,mac:peerMac});saw=true;}
  local='';peer='';remote='';peerIP='';peerKind='unknown';peerMac='';
 }
 for(const raw of s.split('\n')){
  const line=raw.trim();let m;
  if((m=prompt.exec(raw))||/^(show|get|diagnose|display)\s+/i.test(line)){
   neighbor();command=(m?.[2]||line).toLowerCase();p=null;neighborColumns=null;
   const port=/(?:interfaces?|nic|transceiver)\s+([\w./:-]+)(?:\s|$)/i.exec(command)?.[1];
   if(port&&iface.test(port)){local=portName(port);p=ensurePort(d,local);}
   continue;
  }
  if(/^-{4,}$/.test(line)){neighbor();continue;}
  if(/\b(?:lldp|cdp)\b/.test(command)&&(m=/^Chassis(?:[ -]ID)?\s*:\s*(.+)$/i.exec(line))){peerMac=normalizeMac(m[1]);continue;}
  if(/\b(?:lldp|cdp)\b/.test(command)){
   const cols=line.split(/\s{2,}/),normalized=cols.map(c=>c.toLowerCase().replace(/[ -]/g,''));
   if(normalized.some(c=>/^(?:localintf|localport|localinterface)$/.test(c))&&normalized.some(c=>/^(?:systemname|sysname|deviceid)$/.test(c)))neighborColumns=normalized;
   else if(neighborColumns&&cols.length>=neighborColumns.length){
    const at=pattern=>neighborColumns.findIndex(v=>pattern.test(v)),local=cols[at(/^(?:localintf|localport|localinterface)$/)],peer=cols[at(/^(?:systemname|sysname|deviceid)$/)],remote=cols[at(/^portid$/)];
    if(local&&peer&&remote&&iface.test(local)){peerRecords.push({local:portName(local),peer,remote:portName(remote),kind:'unknown'});saw=true;}
   }
  }
  if((m=/^(?:Model(?: name)?|Product(?: name)?|Platform)\s*[:=]\s*(.+)$/i.exec(line))){const spec=identify(m[1]);if(spec.model){Object.assign(d,spec);saw=true;}}
  if(!/\b(?:lldp|cdp|arp|mac.address-table)\b/.test(command)){
   const rawMac=/^(?:Base (?:ethernet )?MAC(?: address)?|System MAC(?: address)?|MAC address)\s*[:=]\s*(\S+)/i.exec(line)?.[1];
   const own=normalizeMac(rawMac);if(own){(p||d).mac=own;saw=true;}
   const physical=normalizeMac(/(?:Current_HWaddr|Current address|Hardware address)\s*[:=]\s*(\S+)/i.exec(line)?.[1]||/\baddress is\s+([\da-f:.\-]+)/i.exec(line)?.[1]);if(p&&physical){p.mac=physical;saw=true;}
  }
  if(/\broute\b/.test(command)){
   if((m=/^(?:[A-Z*+>]+(?:\s+[A-Z*+>]+)*\s+)?(\d+\.\d+\.\d+\.\d+\/\d+)\s+(.*)$/i.exec(line))){
    pendingRoute=m[1];const rest=m[2],via=/\bvia\s+(\d+\.\d+\.\d+\.\d+)(?:,\s*([\w./:-]+))?/i.exec(rest),direct=/directly connected,\s*([\w./:-]+)/i.exec(rest),columns=/^(\d+\.\d+\.\d+\.\d+)\s+([\w./:-]+)/.exec(rest);
    if(via||direct||columns){d.routes.push({destination:pendingRoute,nextHop:via?.[1]||columns?.[1]||'',interface:via?.[2]||direct?.[1]||columns?.[2]||'',type:'observed'});pendingRoute='';saw=true;}
   }else if(pendingRoute&&(m=/^>?\s*to\s+(\d+\.\d+\.\d+\.\d+)\s+via\s+([\w./:-]+)/i.exec(line))){d.routes.push({destination:pendingRoute,nextHop:m[1],interface:m[2],type:'observed'});pendingRoute='';saw=true;}
  }
  if(/\bvlans?\b/.test(command)&&(m=/^(\d{1,4})\s+(\S+)\s+(?:active|static|port-based|up)\b/i.exec(line))){const v=ensureVlan(d,m[1]);if(v.id){v.name=m[2];saw=true;}}
  if((m=/^(?:Local (?:Port|Intf|Interface)(?:\s+(?:ID|Id))?|Interface)\s*:\s*([^,]+)(?:,\s*Port ID \(outgoing port\):\s*(.+))?$/i.exec(line))){
   if(local&&peer&&remote)neighbor();local=portName(m[1]);p=ensurePort(d,local);if(m[2])remote=portName(m[2]);continue;
  }
  if((m=/^(?:System[ -]Name|SysName|Device ID)\s*:\s*(.+)$/i.exec(line))){if(peer&&local&&remote)neighbor();peer=m[1].trim();continue;}
  if((m=/^(?:Port[ -](?:id|ID)|PortId|Port ID \(outgoing port\))\s*:\s*(.+)$/i.exec(line))){remote=portName(m[1]);continue;}
  if((m=/^(?:Management Address|Management Address\(es\)|IP(?:v4)? address)\s*:\s*(\d+\.\d+\.\d+\.\d+)/i.exec(line))){peerIP=m[1];continue;}
  if(/(?:System Capabilities|Enabled Capabilities|Capabilities)\s*:/i.test(line)){
   if(/\bwlan|wireless|access point/i.test(line))peerKind='ap';else if(/bridge|switch/i.test(line))peerKind='switch';
  }
  if((m=/^([\w./:-]+)\s+is\s+(?:administratively\s+)?(up|down)(?:,.*)?$/i.exec(line))&&iface.test(m[1])){p=ensurePort(d,m[1]);p.state=m[2].toLowerCase();saw=true;}
  if((m=/^Physical interface:\s*([^,]+),.*Physical link is\s+(Up|Down)/i.exec(line))){p=ensurePort(d,m[1]);p.state=m[2].toLowerCase();saw=true;}
  if((m=/^(?:name|interface)\s*[:=]\s*([\w./:-]+)$/i.exec(line))&&iface.test(m[1])){p=ensurePort(d,m[1]);local=p.name;}
  if(p){
   if((m=/^(?:Link(?: State)?|Status|link_status)\s*[:=]\s*(up|down|connected|notconnect|1|0)\b/i.exec(line))){p.state=/^(up|connected|1)$/i.test(m[1])?'up':'down';saw=true;}
   if((m=/(?:^|\b)(?:Speed|BW|link_speed)\s*[:=]?\s*(\d+(?:\.\d+)?\s*[TGKM]?(?:\s*(?:bits?\/?s|bps|b\/s|b\/sec))?)/i.exec(line))){const v=speed(m[1]);if(v){p.speed=v;saw=true;}}
   const media=/\b(?:\d+G(?:BASE)?[- ](?:SR\d?|LR\d?|ER\d?|T)|DAC|direct.attach(?: copper)?|twinax)\b/i.exec(line)?.[0];
   if(media&&/transceiver|optic|sfp|type|media|description/i.test(line+' '+command)){p.media=/DAC|direct.attach|twinax/i.test(media)?'DAC':media.toUpperCase();saw=true;}
  }
  // Common IOS, AOS-CX, Junos and PAN-OS interface-status rows.
  const tokens=line.split(/\s+/);const first=tokens[0];
  if(iface.test(first||'')&&tokens.length>=3){
   const stateIndex=tokens.findIndex((v,i)=>i>0&&/^(connected|notconnect|disabled|up|down|err-disabled)$/i.test(v));
   const combined=tokens.find(v=>/^\d+\/(?:full|half)\/(?:up|down)$/i.test(v));
   if(stateIndex>0||combined){
    const q=ensurePort(d,first);q.state=combined?combined.split('/').at(-1):/^(up|connected)$/i.test(tokens[stateIndex])?'up':'down';
    const v=combined?speed(combined.split('/')[0]):tokens.slice(stateIndex+1).map((v,i,a)=>/^\d+$/.test(v)&&/^[TGKM]?bps$/i.test(a[i+1]||'')?speed(v+' '+a[i+1]):/^(?:a-)?\d+(?:\.\d+)?[TGKM]$/i.test(v)?speed(v):'').find(Boolean);
    if(v)q.speed=v;
    if(!q.speed&&/interfaces? status/.test(command)){const at=tokens.findIndex(v=>/^(a-)?(full|half|auto)$/i.test(v));if(at>=0)q.speed=speed(tokens[at+1]);}
    saw=true;
   }
  }
 }
 neighbor();
 const peers=new Map();
 for(const n of peerRecords){
  const id=deviceId(n.peer);if(!peers.has(id))peers.set(id,device(n.peer,{kind:n.kind,...(n.ip?{ip:n.ip}:{}),...(n.mac?{mac:n.mac}:{})}));
  ensurePort(d,n.local);ensurePort(peers.get(id),n.remote);
  out.links.push({a:d.id,ap:n.local,b:id,bp:n.remote,media:'unknown',status:'observed'});
 }
 out.devices.push(...peers.values());
 if(!saw)out.warnings.push(filename+': no supported operational fields found. Use interface status, detailed LLDP/CDP, or transceiver output with a device prompt.');
 return out;
}
