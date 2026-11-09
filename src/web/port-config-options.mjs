import {linkSpeeds,customConnectionValue} from './connection-types.mjs';
export const portRoleOptions=['access','trunk','hybrid','uplink','downlink','routed','wan','lan','ap','wired','management','mirror','stack','disabled','unknown'];
export const portSpeedOptions=linkSpeeds.filter(([value])=>value&&value!==customConnectionValue).map(([value])=>value);
export function existingVlanOptions(project,device){
 const known=new Map();
 const add=(value,name='')=>{const id=Number(value);if(!Number.isInteger(id)||id<1||id>4094)return;const names=known.get(id)||new Set();if(name&&String(name)!==String(id))names.add(String(name));known.set(id,names);};
 for(const d of [...(project.devices||[]),device].filter(Boolean)){
  for(const vlan of d.vlans||[])add(vlan.id,vlan.name);
  for(const port of d.ports||[]){add(port.native);for(const id of Array.isArray(port.tagged)?port.tagged:[])add(id);}
 }
 return [...known].sort(([a],[b])=>a-b).map(([id,names])=>({id,label:String(id)+(names.size?' — '+[...names].sort().join(' / '):'')}));
}
export function portVlanIds(value,{single=false}={}){
 const input=String(value??'').trim();if(!input)return [];
 const parts=input.split(',').map(v=>v.trim());
 if((single&&parts.length!==1)||parts.some(id=>!/^\d+$/.test(id)||Number(id)<1||Number(id)>4094))throw Error('Enter VLAN IDs from 1 to 4094, separated by commas.');
 return [...new Set(parts.map(Number))];
}
