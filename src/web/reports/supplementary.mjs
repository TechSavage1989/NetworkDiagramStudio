// Browser port of SwitchPort Diagram Builder 1.18.5 SupplementaryData.
// Evidence stays independently selectable. It cannot configure hardware, VLANs,
// aggregation, administrative state, or physical connectivity.
import {workbookTables,readCSV} from '../imports/tables.mjs';

export const supplementaryLimits=Object.freeze({sources:20,observations:5000,textBytes:20_000_000,workbookBytes:25_000_000});
export const supplementarySheets=Object.freeze(['Devices','Network Elements','Interfaces','Routes','ARP Entries','Forwarding Database (FDB)']);
const sensitive=/\b(passw(?:or)?d|secret|credential|private.key|token|psk|encrypted|authorization|api.key|snmp.community|community.string|shared.secret|enable.secret|private.pem)\b/i;
const ipAddress=/\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/;
const get=(object,key)=>object?.[key]??object?.[key[0].toUpperCase()+key.slice(1)];
const id=()=>globalThis.crypto.randomUUID().replace(/-/g,'');
const host=value=>String(value??'').trim().replace(/\.+$/,'').toUpperCase();
export const supplementaryHostKey=value=>host(value).split('.')[0];
export function supplementaryClean(value,max=240){
 const text=String(value??'').trim().replace(/[\x00-\x08\x0a-\x1f\x7f-\x9f]/g,'');
 return sensitive.test(text)?'[REDACTED]':text.length<=max?text:text.slice(0,max)+'...';
}
export function supplementaryInterfaceKey(value){
 return String(value??'').trim().toLowerCase().replace(/[ -]/g,'')
  .replace(/^(?:gigabitethernet|gigeth|gig|gi)(?=\d)/,'gi')
  .replace(/^(?:tengigabitethernet|tengigeth|tengige|te)(?=\d)/,'te')
  .replace(/^(?:twentyfivegige|twentyfivegigabitethernet|twentyfiveg)(?=\d)/,'twentyfiveg')
  .replace(/^(?:fastethernet|fa)(?=\d)/,'fa').replace(/^(?:ethernet|eth)(?=\d)/,'eth');
}
export function supplementaryPromptHostname(text){
 const matches=[...String(text).matchAll(/^\s*([\w.-]{1,180})[#>$]\s*(?:show|display|get|diagnose)\s+/gim)].map(match=>match[1]);
 return new Set(matches.map(name=>name.toUpperCase())).size===1?matches[0]:'';
}
export function looksLikeSupplementaryText(text){
 return /^\s*(?:[\w.-]+[#>$]\s*)?(?:show|display|get|diagnose)\s+(?!running-config\b|startup-config\b|current-configuration\b|configuration\b)(?:ip|ipv6|interfaces?|ports?|lldp|cdp|mac|dhcp|arp|routes?|routing|router|switch|system|version|inventory|vlan|neighbors?|ethernet|firewall)\b/im.test(text)||
  /^[\w./-]+\s+is\s+(?:administratively down|up|down),?\s+line protocol is\s+(?:up|down)\b/im.test(text)||
  (/^\s*Local (?:Intf|Interface|Port)\s*:/im.test(text)&&/^\s*(?:System Name|Device ID|Port id)\s*:/im.test(text));
}
function source(name,kind,device){return {id:id(),name:supplementaryClean(name,180),kind,device:supplementaryClean(device,180),observations:[]};}
function add(output,category,port,field,value){
 const safe=supplementaryClean(value);if(!safe||safe==='0'||safe.toLowerCase()==='no data available.')return;
 if(output.observations.length>=supplementaryLimits.observations)throw Error('Supplementary source exceeds 5,000 observations. Split the report by device or section.');
 output.observations.push({category:supplementaryClean(category,37),interface:supplementaryClean(port,97),field:supplementaryClean(field,77),value:safe});
}
export function supplementaryFromText(text,name,device){
 if(typeof text!=='string'||!text.trim())throw Error('Supplementary command output is empty.');
 if(new TextEncoder().encode(text).length>supplementaryLimits.textBytes||text.includes('\0'))throw Error('Command output exceeds 20 MB or contains binary data.');
 const output=source(name,'Command output',device);let command='Unlabeled output',local='',remote='',remotePort='',referenceLines=0;
 const flushNeighbor=()=>{if(local&&remote)add(output,'Neighbor',local,'Connected device',remote+(remotePort?' / '+remotePort:''));remote='';remotePort='';};
 for(const raw of text.split('\n')){
  const line=raw.trim();if(!line){flushNeighbor();continue;}
  const prompt=/^(?:[\w.-]+[#>$]\s*)?(?:show|display|get|diagnose)\s+(.+)$/i.exec(line);
  if(prompt){flushNeighbor();command=supplementaryClean(prompt[1],80);local='';continue;}
  const header=/^([\w./-]+)\s+is\s+(administratively down|up|down)\b/i.exec(line);
  if(header){flushNeighbor();local=header[1];add(output,'Interface',local,'Operational status',header[2]);}
  const brief=/^((?:Gi|Te|Fa|Eth|GigabitEthernet|TenGigabitEthernet|FastEthernet)[\w./-]+)\s+((?:\d{1,3}\.){3}\d{1,3}|unassigned)\s+\S+\s+\S+\s+(up|down|administratively down)\s+(up|down)$/i.exec(line);
  if(brief&&/interface/i.test(command)){add(output,'IP interface',brief[1],'Address',brief[2]);add(output,'Interface',brief[1],'Operational status',brief[3]+' / '+brief[4]);}
  if(/(?:lldp|cdp).*neighbor/i.test(command)){
   const neighbor=/^(\S+)\s+((?:Gi|Te|Fa|Eth|Po|GigabitEthernet|TenGigabitEthernet)[\w./-]+)\s+\d+\s+.+?\s+((?:Gi|Te|Fa|Eth|Po|GigabitEthernet|TenGigabitEthernet)[\w./-]+)$/i.exec(line);
   if(neighbor)add(output,'Neighbor',neighbor[2],'Connected device',neighbor[1]+' / '+neighbor[3]);
  }
  const localMatch=/^(?:Local (?:Intf|Interface|Port)|Interface)\s*:\s*([\w./-]+)/i.exec(line);
  if(localMatch){if(!remote)flushNeighbor();local=localMatch[1];}
  const remoteMatch=/^(?:System Name|Device ID|Neighbor)\s*:\s*(.+)$/i.exec(line);if(remoteMatch)remote=remoteMatch[1].trim();
  const remotePortMatch=/^(?:Port [iI][dD]|Port ID \(outgoing port\)|Remote Port)\s*:\s*(.+)$/.exec(line);if(remotePortMatch)remotePort=remotePortMatch[1].trim();
  const cdpPair=/^Interface:\s*([\w./-]+).*?Port ID \(outgoing port\):\s*([\w./-]+)/i.exec(line);if(cdpPair){local=cdpPair[1];remotePort=cdpPair[2];flushNeighbor();}
  const address=/^(?:Internet address is|IP(?:v4)? Address\s*[:=]|ip address)\s+(.+)$/i.exec(line);if(address&&ipAddress.test(address[1]))add(output,'IP interface',local,'Address',address[1]);
  const relay=/\b(?:ip helper-address|dhcp-relay(?:\s+address|\s+server)?|relay-to|relay address|dhcp-relay-ip)\s*[:=]?\s*((?:\d{1,3}\.){3}\d{1,3})/i.exec(line);if(relay)add(output,'DHCP relay',local,'Relay target',relay[1]);
  if(/dhcp/i.test(command)&&/\b(?:pool|scope|lease|server|relay|excluded-address|range)\b/i.test(line))add(output,'DHCP',local,command,line);
  const route=/((?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}|default)\b.*?\b(?:via|gateway|next.hop)\s+((?:\d{1,3}\.){3}\d{1,3})/i.exec(line);
  if(route&&(/route|routing/i.test(command)||/^\s*[A-Z* ]{1,5}(?:\s+|[0-9])/.test(line)))add(output,'Route','',route[1],'Next hop '+route[2]+' | '+line);
  const connected=/^[CL]\*?\s+((?:\d{1,3}\.){3}\d{1,3}\/\d{1,2})\s+is\s+directly\s+connected,?\s*(\S+)?/i.exec(line);if(connected&&/route|routing/i.test(command))add(output,'Route',connected[2]||'',connected[1],'Directly connected');
  if(/lldp|cdp|neighbor|interface|route|dhcp|relay|arp|mac.address|vlan/i.test(command)&&referenceLines<400&&line.length>3){add(output,'Reference',local,command,line);referenceLines++;}
 }
 flushNeighbor();
 if(!output.observations.length)throw Error('No supported supplementary data was found. Include the show/display command header or a recognized interface, route, DHCP or neighbor entry.');
 return output;
}

function headerRows(table){
 const name=supplementarySheets.find(name=>name.toLowerCase()===String(table.name).toLowerCase());if(!name||table.rows.length<3)return null;
 const headers=new Map();for(const [index,value] of table.rows[1].entries()){const key=String(value??'').trim().toLowerCase();if(!key)continue;if(headers.has(key))throw Error('Auvik worksheet contains duplicate headers: '+name+'.');headers.set(key,index);}
 const value=(row,key)=>supplementaryClean(row[headers.get(key.toLowerCase())]??'');
 return {name,rows:table.rows.slice(2),value,owner:row=>value(row,name==='Interfaces'?'Parent Device':'Device Name')};
}
// Full identities take priority. A short hostname can join one unique FQDN;
// it cannot combine two independently named sites or duplicate workspace items.
function ownerMatcher(devices,observedNames=[]){
 const exact=new Map(),short=new Map(),observed=new Map();
 for(const d of devices){const name=host(d.name),key=supplementaryHostKey(name);if(!exact.has(name))exact.set(name,[]);exact.get(name).push(d);if(!short.has(key))short.set(key,[]);short.get(key).push(d);}
 for(const value of observedNames){const name=host(value);if(!name.includes('.'))continue;const key=supplementaryHostKey(name);if(!observed.has(key))observed.set(key,new Set());observed.get(key).add(name);}
 return value=>{
  const name=host(value);if(!name||name==='UNKNOWN')return null;
  const matches=exact.get(name)||[];if(matches.length===1)return matches[0];
  const candidates=short.get(supplementaryHostKey(name))||[];
  if(matches.length>1||candidates.length>1)throw Error('Supplementary owner "'+supplementaryClean(value,90)+'" matches more than one selected device. Select its exact device and import again.');
  if(!candidates.length)return null;
  const candidate=candidates[0],target=host(candidate.name);if(name.includes('.')&&target.includes('.'))return null;
  if((observed.get(supplementaryHostKey(name))?.size||0)>1)throw Error('The workbook contains multiple fully qualified names for "'+supplementaryClean(value,90)+'". Use exact device hostnames before importing.');
  return candidate;
 };
}
function selectedDevices(devices){
 if(!Array.isArray(devices)||!devices.length||devices.length>100)throw Error('Select the device or devices to which this evidence belongs.');
 const ids=new Set();for(const d of devices){if(!d||!d.id||ids.has(d.id)||!host(d.name)||host(d.name)==='UNKNOWN')throw Error('Selected devices need unique identities and known names before importing evidence.');ids.add(d.id);}
 return devices;
}
export function supplementaryFromTables(tables,name,devices){
 selectedDevices(devices);const parsed=tables.map(headerRows).filter(Boolean),match=ownerMatcher(devices,parsed.flatMap(table=>table.rows.map(table.owner))),outputs=new Map();
 for(const table of parsed)for(const row of table.rows){
  const device=match(table.owner(row));if(!device)continue;
  if(!outputs.has(device.id))outputs.set(device.id,source(name,'Auvik workbook',device.name));
  const output=outputs.get(device.id),get=key=>table.value(row,key),iface=get(table.name==='Interfaces'?'Interface Name':table.name==='Routes'?'Gateway Interface':'Interface');
  if(table.name==='Interfaces'){
   for(const [field,column] of [['Admin status','Admin Status'],['Operational status','Oper Status'],['Speed','Negotiated Speed'],['MAC','MAC Address'],['Type','Type']])add(output,'Interface',iface,field,get(column));
   add(output,'Neighbor',iface,'Connected device',get('Connected To'));add(output,'Reference',iface,'Auvik configuration details',get('Configuration Details'));
  }else if(table.name==='Routes')add(output,'Route',iface,get('Destination'),'Next hop: '+get('Next Hop')+' | Metric: '+get('Metric'));
  else if(table.name==='ARP Entries')add(output,'ARP',iface,get('IP Address'),get('Hardware (MAC) Address'));
  else if(table.name==='Forwarding Database (FDB)')add(output,'MAC table',iface,get('Destination MAC Address'),'VLAN: '+get('VLAN'));
  else for(const [field,column] of [['Model','Make & Model'],['IP addresses','IP Address(es)'],['Connected to','Connected To'],['Software version','Software Version']])add(output,'Device','',field,get(column));
 }
 return [...outputs].filter(([,source])=>source.observations.length).map(([deviceId,source])=>({deviceId,source}));
}
export function normalizeSupplementarySources(sources){
 if(!Array.isArray(sources)||sources.length>supplementaryLimits.sources)throw Error('A configuration supports up to 20 supplementary sources.');
 const ids=new Set();return sources.map(input=>{
  const sourceId=get(input,'id'),observations=get(input,'observations');
  if(typeof sourceId!=='string'||!/^[0-9a-f]{32}$/i.test(sourceId)||ids.has(sourceId)||!Array.isArray(observations)||observations.length>supplementaryLimits.observations)throw Error('Supplementary source metadata is invalid.');
  ids.add(sourceId);
  const text=(row,key,max)=>{const value=get(row,key);if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0a-\x1f\x7f-\x9f]/.test(value))throw Error('Supplementary observation data is invalid.');return supplementaryClean(value,max);};
  return {id:sourceId,name:text(input,'name',200),kind:text(input,'kind',200),device:text(input,'device',200),...(get(input,'enabled')===false?{enabled:false}:{}),observations:observations.map(row=>({category:text(row,'category',40),interface:text(row,'interface',100),field:text(row,'field',80),value:text(row,'value',260)}))};
 });
}
async function base64(file){
 const bytes=new Uint8Array(await file.arrayBuffer()),chunks=[];for(let offset=0;offset<bytes.length;offset+=16384)chunks.push(String.fromCharCode(...bytes.subarray(offset,offset+16384)));return btoa(chunks.join(''));
}
export async function importReportSupplementary(file,devices){
 selectedDevices(devices);const workbook=/\.xlsx$/i.test(file.name||''),limit=workbook?supplementaryLimits.workbookBytes:supplementaryLimits.textBytes;
 if(file.size>limit)throw Error(workbook?'Choose an Auvik .xlsx report smaller than 25 MB.':'Command output exceeds the 20 MB limit.');
 if(/\.csv$/i.test(file.name||'')){
  const rows=readCSV(await file.text());let found;
  for(let index=0;index<Math.min(32,rows.length);index++){
   const headers=rows[index].map(value=>String(value??'').trim().toLowerCase().replace(/^\uFEFF/,'')),has=value=>headers.includes(value);
   const name=has('parent device')&&has('interface name')?'Interfaces':has('device name')&&has('destination')&&has('next hop')?'Routes':has('device name')&&has('hardware (mac) address')?'ARP Entries':has('device name')&&has('destination mac address')?'Forwarding Database (FDB)':has('device name')&&has('make & model')?'Devices':'';
   if(name){found={name,rows:[[],rows[index],...rows.slice(index+1)]};break;}
  }
  if(!found)throw Error('No supported Auvik supplementary columns were found in this CSV.');
  const outputs=supplementaryFromTables([found],file.name,devices);if(!outputs.length)throw Error('No Auvik rows matched the selected device names.');for(const {source} of outputs)source.kind='Auvik CSV';return outputs;
 }
 if(globalThis.NDSDesktop?.report){
  const result=await globalThis.NDSDesktop.report('supplementary',{name:file.name,data:await base64(file),deviceNames:devices.map(d=>d.name)}),match=ownerMatcher(devices),outputs=[];
  for(const [key,value] of Object.entries(result?.sources||{})){
   const normalized=normalizeSupplementarySources([value])[0],device=match(normalized.device||key);
   if(!device)throw Error('Supplementary evidence returned an unknown device owner.');
   outputs.push({deviceId:device.id,source:normalized});
  }
  if(!outputs.length)throw Error('No Auvik rows matched the selected device names. Check the workbook or select the matching devices.');
  return outputs;
 }
 if(workbook){
  const tables=await workbookTables(file,supplementarySheets,{maxBytes:120_000_000,maxEntries:400,maxPartBytes:30_000_000,maxRows:100_000,maxColumns:16});
  const outputs=supplementaryFromTables(tables,file.name,devices);if(!outputs.length)throw Error('No Auvik rows matched the selected device names. Check the workbook or select the matching devices.');return outputs;
 }
 const bytes=new Uint8Array(await file.arrayBuffer());let text;
 if(bytes[0]===255&&bytes[1]===254)text=new TextDecoder('utf-16le',{fatal:true}).decode(bytes.subarray(2));
 else if(bytes[0]===254&&bytes[1]===255)text=new TextDecoder('utf-16be',{fatal:true}).decode(bytes.subarray(2));
 else text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const prompt=supplementaryPromptHostname(text),matched=prompt?ownerMatcher(devices)(prompt):null,device=matched||(devices.length===1?devices[0]:null);
 if(!device)throw Error('Select one device when the capture has no unambiguous command-prompt hostname.');
 return [{deviceId:device.id,source:supplementaryFromText(text,file.name,device.name)}];
}
export function supplementaryCsv(sources){
 const csv=value=>{let safe=supplementaryClean(value,1000).replace(/"/g,'""');if(/^[=+@-]/.test(safe))safe="'"+safe;return '"'+safe+'"';};
 const output=['Source,Type,Device,Category,Interface,Field,Observed value'];
 for(const source of normalizeSupplementarySources(sources).filter(source=>source.enabled!==false))for(const row of source.observations)output.push([source.name,source.kind,source.device,row.category,row.interface,row.field,row.value].map(csv).join(','));
 return '\uFEFF'+output.join('\r\n')+'\r\n';
}
