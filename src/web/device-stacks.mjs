// Explicit associations between existing devices, separate from imported
// stackMembers (the hardware inside one source record) and drawing groups.
const list=value=>Array.isArray(value)?value:[];
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=300&&!['__proto__','constructor','prototype'].includes(id);
export function cleanDeviceStacks(raw,ids){
 const known=ids?new Set(ids):null,used=new Set(),keys=new Set(),out=[];
 for(const stack of list(raw).slice(0,1000)){
  if(!stack||!validId(stack.id)||keys.has(stack.id)||typeof stack.name!=='string'||!stack.name.trim())continue;
  const numbers=new Set(),devices=new Set(),members=[];
  for(const member of list(stack.members).slice(0,256)){
   if(!member||!validId(member.deviceId)||known&&!known.has(member.deviceId)||used.has(member.deviceId)||devices.has(member.deviceId)||!Number.isInteger(member.number)||member.number<1||member.number>256||numbers.has(member.number))continue;
   numbers.add(member.number);devices.add(member.deviceId);members.push({deviceId:member.deviceId,number:member.number});
  }
  // A remaining singleton is retained after removal or evidence filtering.
  if(!members.length)continue;
  keys.add(stack.id);for(const id of devices)used.add(id);
  out.push({id:stack.id,name:stack.name.trim().slice(0,80),members:members.sort((a,b)=>a.number-b.number)});
 }
 return out;
}
export function deviceStack(project,id){
 for(const stack of cleanDeviceStacks(project.layout?.deviceStacks)){
  const member=stack.members.find(member=>member.deviceId===id);if(member)return {stack,member};
 }
 return null;
}
export function stackCaption(project,id){const found=deviceStack(project,id);return found?found.stack.name+' · member '+found.member.number:'';}
export function saveDeviceStack(project,draft){
 const stacks=cleanDeviceStacks(project.layout?.deviceStacks),existing=stacks.find(stack=>stack.id===draft.id);
 if(!validId(draft.id))throw Error('Invalid stack identity.');
 const name=String(draft.name||'').trim();if(!name||name.length>80)throw Error('Enter a stack name of 1 to 80 characters.');
 const known=new Set(project.devices.map(device=>device.id)),members=list(draft.members),seen=new Set(),numbers=new Set();
 if(!members.length)throw Error('Add at least one existing device, or dissolve this stack.');
 if(!existing&&members.length<2)throw Error('Choose at least two devices to create a stack.');
 for(const member of members){
  // Disabled source members already in this stack remain editable without
  // resurrecting their devices or allowing arbitrary unknown references.
  if(!known.has(member.deviceId)&&!existing?.members.some(old=>old.deviceId===member.deviceId))throw Error('Choose an existing device for every member.');
  if(seen.has(member.deviceId))throw Error('A device can only be listed once in a stack.');seen.add(member.deviceId);
  if(!Number.isInteger(member.number)||member.number<1||member.number>256||numbers.has(member.number))throw Error('Use unique member numbers from 1 to 256.');numbers.add(member.number);
  if(stacks.some(stack=>stack.id!==draft.id&&stack.members.some(old=>old.deviceId===member.deviceId)))throw Error('Remove this device from its other stack first.');
 }
 const next={id:draft.id,name,members:members.map(member=>({deviceId:member.deviceId,number:member.number})).sort((a,b)=>a.number-b.number)};
 return {...project.layout,deviceStacks:[...stacks.filter(stack=>stack.id!==draft.id),next]};
}
export function dissolveDeviceStack(project,id){return {...project.layout,deviceStacks:cleanDeviceStacks(project.layout?.deviceStacks).filter(stack=>stack.id!==id)};}
