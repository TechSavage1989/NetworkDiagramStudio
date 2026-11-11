import {actualAsset,addDevice,cableWeight,getAnchor,physicalPorts} from './scene.mjs';
import {shareGapLevels} from './routing.mjs';

// A family of sheets has one hardware width. Height comes from the complete
// artwork; page capacity may change the grouping, never an individual scale.
export const equipmentPadding=.6;
// Busy gaps grow by the painted widths of the actual departing cables. Values
// are fractions of hardware width, so every chassis keeps its native aspect
// ratio and only the empty space between adjacent members changes.
export function equipmentGapPlan(project,device,links,width,{padding=equipmentPadding,weight,clearance=2,side}={}){
 if(!canContinueEquipment(project,device))return {padding,memberGaps:{}};
 const panel=addDevice({items:[]},project,device,[0,0,width,1],'gap-measure',{fitWidth:true,padding}),regions=panel.panelRegions||[],gaps=new Map();
 for(const [index,link] of links.entries()){
  const ports=link.sw===device.id?[link.sp]:[...(link.a===device.id?[link.ap]:[]),...(link.b===device.id?[link.bp]:[])];
  for(const port of ports){const thickness=(typeof weight==='function'?weight(link):weight)||link.weight||cableWeight,anchor=getAnchor(panel,port,'top',index,{weight:thickness});if(!anchor.escapeRange)continue;
   const [lo,hi]=anchor.escapeRange,upper=regions.find(r=>Math.abs(panel.y+(r.y+r.h)*panel.h-lo)<.01),lower=regions.find(r=>Math.abs(panel.y+r.y*panel.h-hi)<.01);if(!upper?.memberId||!lower?.memberId||upper.memberId===lower.memberId)continue;
   // With known turn directions (side), opposite leads share levels.
   const key=upper.memberId+'/'+lower.memberId;if(!gaps.has(key))gaps.set(key,[]);gaps.get(key).push({thickness,x:anchor.x,side:typeof side==='function'?side(link,anchor):null});
  }
 }
 const minimum=.035*Math.max(.49,Math.min(1,padding))**2;
 return {padding,memberGaps:Object.fromEntries([...gaps].map(([key,entries])=>{const levels=shareGapLevels(entries).map(level=>Math.max(...level.map(v=>v.thickness)));return [key,Math.max(minimum,(levels.reduce((sum,w)=>sum+w,0)+clearance*(levels.length+1))/panel.w)];}))};
}
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
// One stack-member subset with the same identity, port membership and edit
// scope as a member continuation. Unknown-member (logical) ports stay with it.
const stackMemberOf=name=>String(name).match(/^(?:(?:GigabitEthernet|TenGigabitEthernet|Gi|Te|TwentyFiveGigE|HundredGigE|Ethernet|Eth))?(\d+)\//i)?.[1];
export function memberSubsetView(project,device,memberIds){
 if(!canContinueEquipment(project,device))return device;
 const wanted=new Set([...memberIds].map(String)),members=[...device.stackMembers].sort((a,b)=>Number(a.id)-Number(b.id)),stackMembers=members.filter(m=>wanted.has(String(m.id)));
 if(!stackMembers.length||stackMembers.length===members.length)return device;
 const known=new Set(members.map(m=>String(m.id))),physical=new Set(physicalPorts(device).map(p=>p.name));
 const ports=(device.ports||[]).filter(p=>!physical.has(p.name)||wanted.has(stackMemberOf(p.name))||!known.has(stackMemberOf(p.name)));
 return {...device,name:(device.name||device.id)+' (member'+(stackMembers.length>1?'s':'')+' '+stackMembers.map(m=>m.id).join(', ')+')',stackMembers,ports,stackContinuation:true,equipmentPart:stackMembers.map(m=>m.id).join(',')};
}
export function portStackMember(name){return stackMemberOf(name);}
export function equipmentScope(device){return device.id+(device.equipmentPart?'|members:'+device.equipmentPart:'');}
