// Port map device details, edited by double-clicking a device on a port map
// page. These are the Switchport builder's device identity fields (name,
// serial number, asset tag and notes per switch, stack member or module, plus
// a model chosen from the hardware database), together with the device's name,
// model, management IP and MAC address. Everything is stored on the device
// record, never as drawing text, so every page and export shows the same values.
import {hardwareComposition} from './hardware-composition.mjs';
import {deviceMacs,inputMacAddresses} from './device-details.mjs';

const text=value=>typeof value==='string'?value.trim():value==null?'':String(value).trim();
const lower=row=>Object.fromEntries(Object.entries(row||{}).map(([key,value])=>[key[0].toLowerCase()+key.slice(1),value]));
export const PORT_MAP_DETAIL_LIMITS={name:80,serialNumber:80,assetTag:80,notes:400};

// The identities a device's port map draws: one per stack member (or the
// single switch), then one per installed module, matching report-details.mjs
// and the Switchport builder's DeviceIdentities.Describe.
export function portMapIdentities(device){
 const members=(device?.stackMembers||[]).filter(member=>text(member.id));
 const base=members.length?members.map(member=>({id:String(member.id),kind:'member',member:String(member.id),label:'Member '+member.id,model:text(member.model)})):[{id:'1',kind:'device',member:'1',label:device?.kind==='firewall'?'Firewall':(device?.modules||[]).length?'Chassis':'Switch',model:text(device?.model)}];
 const modules=(device?.modules||[]).filter(module=>text(module.slot)).map(module=>{const member=text(module.member)||'1',slot=text(module.slot).toUpperCase();return {id:member+'/'+slot,kind:'module',member,slot,label:(members.length?'Member '+member+' / ':'')+'Module '+slot,model:text(module.model)};});
 return [...base,...modules];
}

// The identity a port map panel belongs to. Panels carry the report group's
// member and slot; anything unknown falls back to the first identity.
export function portMapIdentity(device,{member,slot,identity}={}){
 const all=portMapIdentities(device),wanted=text(identity)||(text(slot)?(text(member)||'1')+'/'+text(slot).toUpperCase():text(member));
 return all.find(row=>row.id.toLowerCase()===wanted.toLowerCase())||all.find(row=>row.kind!=='module'&&row.member===text(member))||all[0];
}

// Current values for the dialog.
export function portMapDetailsDraft(device,target){
 const identity=portMapIdentity(device,target),saved=(device?.reportDetails||[]).map(lower).find(row=>String(row.id).toLowerCase()===identity.id.toLowerCase())||{};
 return {identity,name:text(device?.name),model:text(device?.model),ip:text(device?.ip),mac:deviceMacs(device).join(', '),hardwareModel:identity.kind==='device'?'':identity.model,
  displayName:text(saved.name),serialNumber:text(saved.serialNumber),assetTag:text(saved.assetTag),notes:text(saved.notes)};
}

// A validated copy of the device with the dialog's values. Throws a readable
// error for an invalid value; the caller records one history action.
export function applyPortMapDetails(device,target,values,{nameTaken=()=>false}={}){
 const identity=portMapIdentity(device,target),next=structuredClone(device),name=text(values.name);
 if(!name)throw Error('Enter a device name.');
 if(name.length>180)throw Error('Use a device name of 180 characters or fewer.');
 if(name!==device.name&&nameTaken(name))throw Error('Use a unique device name.');
 for(const [key,limit] of Object.entries(PORT_MAP_DETAIL_LIMITS)){const field=key==='name'?'displayName':key;if(text(values[field]).length>limit)throw Error((key==='name'?'Display name':key==='serialNumber'?'Serial number':key==='assetTag'?'Asset tag':'Notes')+' must be '+limit+' characters or fewer.');}
 if(text(values.ip).length>120)throw Error('Use a management IP of 120 characters or fewer.');
 next.name=name;next.ip=text(values.ip);
 const mac=inputMacAddresses(values.mac??'');for(const alias of ['macs','macAddress','macAddresses','mac_address','mac_address(es)'])delete next[alias];next.mac=mac;
 const model=text(values.model);if(model!==text(device.model)){next.model=model;delete next.sku;delete next.hardwareEvidence;delete next.hardwareFamily;delete next.family;}
 // A member or module model is part of the confirmed hardware composition.
 const hardware=text(values.hardwareModel);
 if(identity.kind!=='device'&&hardware&&hardware!==identity.model){
  const members=(device.stackMembers||[]).map(member=>({id:member.id,model:identity.kind==='member'&&String(member.id)===identity.member?hardware:member.model}));
  const modules=(device.modules||[]).map(module=>({member:module.member,slot:module.slot,model:identity.kind==='module'&&(text(module.member)||'1')===identity.member&&text(module.slot).toUpperCase()===identity.slot?hardware:module.model}));
  Object.assign(next,hardwareComposition(members,modules));
 }
 const rows=(device.reportDetails||[]).map(lower).filter(row=>String(row.id).toLowerCase()!==identity.id.toLowerCase());
 const row={...((device.reportDetails||[]).map(lower).find(row=>String(row.id).toLowerCase()===identity.id.toLowerCase())||{}),id:identity.id,name:text(values.displayName),serialNumber:text(values.serialNumber),assetTag:text(values.assetTag),notes:text(values.notes)};
 next.reportDetails=[...rows,row].filter(row=>row.name||row.serialNumber||row.assetTag||row.notes||row.modelSelection||(row.moduleSelections||[]).length);
 if(!next.reportDetails.length&&!device.reportDetails)delete next.reportDetails;
 return next;
}

// Where a double-click on a port map page points: a builder panel (or its
// heading) or a faceplate device. Returns null for anything else.
export function portMapTarget(page,item){
 if(!page||!item)return null;
 const map=page.switchportReport||page.portMap||page.family==='ports';
 if(!map)return null;
 if(item.reportPanel&&item.sourceId)return {device:item.sourceId,member:item.reportMember,slot:item.reportSlot,identity:item.reportIdentity};
 if(item.type==='device'&&item.sourceId&&item.kind!=='plug')return {device:item.sourceId,member:item.equipmentPart};
 return null;
}
