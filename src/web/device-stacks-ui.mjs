import {deviceStack,saveDeviceStack,dissolveDeviceStack} from './device-stacks.mjs';
export function editDeviceStack(project,device,{el,field,button,actions,modal,close,save}){
 const existing=deviceStack(project,device.id)?.stack,body=modal('Configure device stack'),draft=existing||{id:'stack-'+crypto.randomUUID(),name:device.name+' stack',members:[{deviceId:device.id,number:1}]};
 body.append(el('p','Associate existing devices as numbered stack members. Each device keeps its own ports, connections, hardware and source evidence. This does not create stack cables or combine chassis artwork.','hint'));
 const name=field(body,'Stack name',draft.name),rows=[],list=el('div');body.append(list);
 const choices=project.devices.filter(d=>!deviceStack(project,d.id)||deviceStack(project,d.id).stack.id===draft.id).map(d=>[d.id,d.name]);
 function add(member={deviceId:'',number:Math.max(0,...rows.map(row=>Number(row.number.value)||0))+1}){
  const box=el('div','','hardware-row'),options=[['','Choose device'],...choices];if(member.deviceId&&!options.some(([id])=>id===member.deviceId))options.push([member.deviceId,member.deviceId+' (source disabled)']);
  list.append(box);const deviceField=el('div','','hardware-field'),numberField=el('div','','hardware-field');box.append(deviceField,numberField);const selector=field(deviceField,'Stack device',member.deviceId,options),number=field(numberField,'Stack member number',member.number);number.type='number';number.min=1;number.max=256;number.step=1;
  const row={box,selector,number};rows.push(row);button(box,'Remove member',()=>{rows.splice(rows.indexOf(row),1);box.remove();});
 }
 draft.members.forEach(add);button(actions(body),'Add existing device',()=>add());
 body.append(el('p','Member numbers define stack order. Removing a member or dissolving the stack leaves every device and connection intact. Save applies all changes together; Cancel discards the draft.','hint'));
 const bar=actions(body);button(bar,'Save stack',()=>{save(saveDeviceStack(project,{id:draft.id,name:name.value,members:rows.map(row=>({deviceId:row.selector.value,number:Number(row.number.value)}))}));close();},'primary');
 if(existing)button(bar,'Dissolve stack',()=>{save(dissolveDeviceStack(project,existing.id));close();});button(bar,'Cancel',close);
}
