import {profiles} from './profiles.mjs';
import {firewallProfiles} from './firewall-profiles.mjs';
import {switchIdentities} from './switch-identities.mjs';
import {faceplates} from './faceplates.mjs';
import {matchEndpointHardware} from './endpoint-hardware.mjs';
export {endpointHardwareCatalog,matchEndpointHardware} from './endpoint-hardware.mjs';

function physicalInterfaces(p){
  const records=p.sockets?p.sockets.map(s=>[(p.naming==='cx'&&/^\d+$/.test(s[0])?'1/1/':'')+s[0],s[3]]):p.banks.filter(b=>!b.optional).flatMap(b=>b.names.map(n=>[n,b.form])),groups=new Map();
  for(const [name,form] of records){if(!groups.has(name))groups.set(name,new Set());groups.get(name).add(form);}
  return [...groups].map(([name,forms])=>[name,forms.size>1?'shared '+[...forms].join('/'):[...forms][0]]);
}
const physicalProfiles=faceplates.flatMap(p=>p.models.map(model=>({model:p.vendor==='Fortinet'?model.replace('FG-','FortiGate '):model,sku:p.familyOnly?'':model,familyOnly:!!p.familyOnly,vendor:p.vendor,kind:/Fortinet|SonicWall|Sophos|Palo Alto|Netgate|Deciso/.test(p.vendor)||/^(?:SRX|ASA|FPR|Firepower)/i.test(model)?'firewall':'switch',source:p.source,interfaces:physicalInterfaces(p)})));
// Manufacturer guides correct imported capability records without rewriting their snapshot.
const correctedFirewalls=firewallProfiles.map(p=>p.sku==='PA-415'?{...p,manufacturerReference:'https://docs.paloaltonetworks.com/hardware/pa-400-hardware-reference/pa-400-firewall-overview/pa-400-front-panel',interfaces:p.interfaces.map(([name,form])=>[name,['management','ethernet1/1'].includes(name)?'shared RJ45/SFP':form])}:p.sku==='ASA5505'?{...p,manufacturerReference:'https://andovercg.com/datasheets/cisco-asa5505guide-ASA5505HIG.pdf',interfaces:p.interfaces.filter(([name])=>name!=='Ethernet1/0')}:p.sku==='NSA3700'?{...p,manufacturerReference:'https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp4162.pdf',interfaces:p.interfaces.map(([name,form])=>[name,/^X2[4-7]$/.test(name)?'5gbase-x-sfpp':form])}:p);
export const hardwareCatalog=[...physicalProfiles.filter(p=>![...profiles,...correctedFirewalls].some(q=>(p.sku&&q.sku===p.sku)||q.model===p.model)),...profiles,...correctedFirewalls];
const exact = new Map();
const normalize = x => String(x||'').trim().toUpperCase().replace(/[^A-Z0-9+]/g,'');
for(const [family,os,skus] of switchIdentities)for(const sku of skus.split(' ')){
  exact.set(normalize(sku),{kind:'switch',vendor:'HPE Aruba',model:sku,sku,family,os});
}
for(const p of hardwareCatalog) {
  const vendor=p.vendor==='HPE'?'HPE Aruba':p.vendor;
  const item={kind:p.kind,vendor,model:p.vendor==='Fortinet'?p.model:p.sku||p.model,sku:p.sku};
  for(const alias of [p.model,p.sku,/\.yaml$/.test(p.source)?p.source.split('/').at(-1).replace(/\.yaml$/,''):'']){
    if(alias)exact.set(normalize(alias),item);
  }
}
exact.set('FG2H0G',{kind:'firewall',vendor:'Fortinet',model:'FortiGate 200G',sku:'FG-200G'});
exact.set('FG2H1G',{kind:'firewall',vendor:'Fortinet',model:'FortiGate 201G',sku:'FG-201G'});
export function identify(label='',description=''){
  const tokens = [label,...label.split(/[\s,;()]+/),...description.split(/[\s,;()]+/)];
  for(const item of tokens){
    const match=exact.get(normalize(item));if(match)return {...match};
  }
  const forti=/^(?:FortiGate\s*|FGT?-?)(\d+[A-Z](?:-[A-Z0-9]+)?)$/i.exec(label);
  if(forti)return {kind:'firewall',vendor:'Fortinet',model:'FortiGate '+forti[1].toUpperCase()};
  const endpoint=matchEndpointHardware(label,description);
  if(endpoint)return {kind:endpoint.kind,vendor:endpoint.vendor,model:label.trim()||endpoint.family,family:endpoint.family,technology:endpoint.technology,hardwareFamily:endpoint.id};
  const vendor=/\b(?:Aruba|ProCurve|HP|HPE)\b/i.test(label)?'HPE Aruba':/\bCisco\b/i.test(label)?'Cisco':/\bArista\b/i.test(label)?'Arista':/\bJuniper\b/i.test(label)?'Juniper':'';
  return {kind:'unknown',vendor,model:label.trim()};
}

const indexedProfiles=new Map();
for(const p of hardwareCatalog)for(const key of [p.model,p.sku])if(key)indexedProfiles.set(normalize(key),p);
const sharedCapabilities=new Map(physicalProfiles.map(p=>[normalize(p.sku),p.interfaces.filter(([,form])=>form.startsWith('shared '))]));
export function hardwareProfile(device) {
  let p=indexedProfiles.get(normalize(device.sku))??indexedProfiles.get(normalize(device.model));
  const shared=p&&sharedCapabilities.get(normalize(p.sku));
  if(shared?.length)p={...p,interfaces:p.interfaces.map(([name,form])=>[name,shared.find(([n])=>n.toLowerCase()===name.toLowerCase())?.[1]||form])};
  if(p&&/^FG9[01]G$/.test(normalize(p.sku))&&(device.ports||[]).some(o=>/^x[12]$/i.test(o.name)&&!o.parent))
    return {...p,interfaces:p.interfaces.map(([name,form])=>[name.replace(/^wan([12])$/,'x$1'),form])};
  return p;
}
export function portCapability(profile, name) {
  const canonical=n=>String(n).toLowerCase().replace(/^gigabitethernet/,'gi').replace(/^ethernet(?=\d)/,'eth');
  let key=canonical(name);
  if(profile?.kind==='ap')key=key.replace(/^eth(\d+)$/,'e$1');
  return profile?.interfaces.find(([n])=>canonical(n)===key)?.[1];
}
