import {actualAsset,addDevice,physicalPorts} from './scene.mjs';

// A family of sheets has one hardware width. Height comes from the complete
// artwork; page capacity may change the grouping, never an individual scale.
export const equipmentPadding=.6;
export function equipmentSize(project,device,width){
 const g=addDevice({items:[]},project,device,[0,0,width,1],'measure',{fitWidth:true,padding:equipmentPadding});
 return {w:g.w,h:g.h};
}
export function canContinueEquipment(project,device){return !actualAsset(project,device)&&device.stackMembers?.length>1;}
export function equipmentViews(project,device,width,height){
 if(!canContinueEquipment(project,device)||equipmentSize(project,device,width).h<=height)return [device];
 const members=[...device.stackMembers].sort((a,b)=>Number(a.id)-Number(b.id)),parts=[];let current=[];
 for(const member of members){const next=[...current,member];if(current.length&&equipmentSize(project,{...device,stackMembers:next,stackContinuation:true},width).h>height){parts.push(current);current=[];}current.push(member);}
 if(current.length)parts.push(current);if(parts.length===1)return [device];
 const known=new Set(members.map(m=>String(m.id))),physical=new Set(physicalPorts(device).map(p=>p.name));
 return parts.map((stackMembers,index)=>{const ids=new Set(stackMembers.map(m=>String(m.id))),memberOf=name=>String(name).match(/^(?:(?:GigabitEthernet|TenGigabitEthernet|Gi|Te|TwentyFiveGigE|HundredGigE|Ethernet|Eth))?(\d+)\//i)?.[1];
  const ports=(device.ports||[]).filter(p=>!physical.has(p.name)||ids.has(memberOf(p.name))||index===0&&!known.has(memberOf(p.name)));
  return {...device,name:(device.name||device.id)+' (member'+(stackMembers.length>1?'s':'')+' '+stackMembers.map(m=>m.id).join(', ')+')',stackMembers,ports,stackContinuation:true,equipmentPart:stackMembers.map(m=>m.id).join(',')};
 });
}
export function equipmentScope(device){return device.id+(device.equipmentPart?'|members:'+device.equipmentPart:'');}
