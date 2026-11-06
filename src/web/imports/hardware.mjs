import {profiles} from './profiles.mjs';
import {firewallProfiles} from './firewall-profiles.mjs';
import {switchIdentities} from './switch-identities.mjs';

export const hardwareCatalog=[...profiles,...firewallProfiles];
const exact = new Map();
const normalize = x => String(x||'').trim().toUpperCase().replace(/[^A-Z0-9+]/g,'');
for(const [family,os,skus] of switchIdentities)for(const sku of skus.split(' ')){
  exact.set(normalize(sku),{kind:'switch',vendor:'HPE Aruba',model:sku,sku,family,os});
}
for(const p of hardwareCatalog) {
  const vendor=p.vendor==='HPE'?'HPE Aruba':p.vendor;
  const item={kind:p.kind,vendor,model:p.vendor==='Fortinet'?p.model:p.sku||p.model,sku:p.sku};
  for(const alias of [p.model,p.sku,p.source.split('/').at(-1).replace(/\.yaml$/,'')]){
    if(alias)exact.set(normalize(alias),item);
  }
}
export function identify(label='',description=''){
  const tokens = [label,...label.split(/[\s,;()]+/),...description.split(/[\s,;()]+/)];
  for(const item of tokens){
    const match=exact.get(normalize(item));if(match)return {...match};
  }
  const forti=/^(?:FortiGate\s*|FGT?-?)(\d+[A-Z](?:-[A-Z0-9]+)?)$/i.exec(label);
  if(forti)return {kind:'firewall',vendor:'Fortinet',model:'FortiGate '+forti[1].toUpperCase()};
  const vendor=/\b(?:Aruba|ProCurve|HP|HPE)\b/i.test(label)?'HPE Aruba':/\bCisco\b/i.test(label)?'Cisco':/\bArista\b/i.test(label)?'Arista':/\bJuniper\b/i.test(label)?'Juniper':'';
  return {kind:'unknown',vendor,model:label.trim()};
}

const indexedProfiles=new Map();
for(const p of hardwareCatalog)for(const key of [p.model,p.sku])if(key)indexedProfiles.set(normalize(key),p);
export function hardwareProfile(device) {
  return indexedProfiles.get(normalize(device.sku))??indexedProfiles.get(normalize(device.model));
}
export function portCapability(profile, name) {
  const canonical=n=>String(n).toLowerCase().replace(/^gigabitethernet/,'gi').replace(/^ethernet(?=\d)/,'eth');
  let key=canonical(name);
  if(profile?.kind==='ap')key=key.replace(/^eth(\d+)$/,'e$1');
  return profile?.interfaces.find(([n])=>canonical(n)===key)?.[1];
}
