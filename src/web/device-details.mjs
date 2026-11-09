import {stackCaption} from './device-stacks.mjs';
// Display only supplied hardware identities and addresses. Interface MACs are
// kept with their interface; learned/forwarding-table peers are not identities.
const text=value=>typeof value==='string'?value.trim():'';
export function normalizeMac(value){
 const raw=text(value);
 if(!/^(?:[\da-f]{12}|[\da-f]{16}|(?:[\da-f]{2}:){5}[\da-f]{2}|(?:[\da-f]{2}:){7}[\da-f]{2}|(?:[\da-f]{2}-){5}[\da-f]{2}|(?:[\da-f]{2}-){7}[\da-f]{2}|(?:[\da-f]{4}\.){2}[\da-f]{4}|(?:[\da-f]{4}\.){3}[\da-f]{4})$/i.test(raw))return '';
 return raw.replace(/[:.\-]/g,'').toUpperCase().match(/../g).join(':');
}
export function macAddresses(value){
 const parts=Array.isArray(value)?value.flatMap(macAddresses):text(value).split(/[,;\s]+/).map(normalizeMac).filter(Boolean);
 return [...new Set(parts)];
}
export function inputMacAddresses(value){
 const parts=text(value).split(/[,;\s]+/).filter(Boolean);
 if(parts.some(part=>!normalizeMac(part)))throw Error('Enter MAC addresses as 00:11:22:33:44:55, 00-11-22-33-44-55, or 0011.2233.4455. Separate multiple addresses with commas.');
 return macAddresses(value).join(', ');
}
export function deviceMacs(device){return [...new Set(['mac','macs','macAddress','macAddresses','mac_address','mac_address(es)'].flatMap(key=>macAddresses(device?.[key])))];}
export function deviceModel(device){
 const vendor=text(device?.vendor),model=text(device?.model);
 return [vendor&&(!model||!model.toLowerCase().includes(vendor.toLowerCase()))?vendor:'',model].filter(Boolean).join(' | ');
}
// counts:false leaves out summaries such as "417 MAC addresses" (drawing captions
// show a single identifying address only).
export function macCaption(device,port,{full=false,counts=true}={}){
 const caption=(values,prefix='MAC ')=>full||values.length===1?prefix+values.join(', '):counts?values.length+' MAC addresses':'';
 const direct=deviceMacs(device);if(direct.length)return caption(direct);
 const ports=(device?.ports||[]).filter(p=>port==null||text(p.name).toLowerCase()===text(port).toLowerCase());
 const known=ports.map(p=>({port:p,values:deviceMacs(p)})).filter(p=>p.values.length);
 // Inventory reports may aggregate hundreds of local interface addresses.
 // Keep all records, without treating the first as a primary device identity.
 if(!full&&known.length>1){if(!counts)return '';const count=new Set(known.flatMap(p=>p.values)).size;return count+' interface MAC address'+(count===1?'':'es');}
 return known.map(p=>caption(p.values,'MAC '+(port==null?p.port.name+' ':''))).filter(Boolean).join(' | ');
}
// Device captions carry model, platform and address. MAC addresses stay in the
// device editor and the full-list information panel, not under every device.
export function deviceDetails(device,project){
 const platform=text(device?.technology),model=deviceModel(device);
 return [project?stackCaption(project,device.id):'',model,platform&&platform.toLowerCase()!==text(device?.model).toLowerCase()?platform:'',text(device?.ip)].filter(Boolean).join('  |  ');
}
