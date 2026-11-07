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
export function macCaption(device,port){
 const direct=deviceMacs(device);if(direct.length)return 'MAC '+direct.join(', ');
 const ports=(device?.ports||[]).filter(p=>port==null||text(p.name).toLowerCase()===text(port).toLowerCase());
 return ports.flatMap(p=>{const values=deviceMacs(p);return values.length?['MAC '+(port==null?p.name+' ':'')+values.join(', ')]:[];}).join(' | ');
}
export function deviceDetails(device){
 const platform=text(device?.technology),model=deviceModel(device);
 return [model,platform&&platform.toLowerCase()!==text(device?.model).toLowerCase()?platform:'',text(device?.ip),macCaption(device)].filter(Boolean).join('  |  ');
}
