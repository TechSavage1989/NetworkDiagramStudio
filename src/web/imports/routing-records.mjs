import {cidr} from './model.mjs';
const tokens=text=>[...String(text).matchAll(/"([^"\r\n]*)"|'([^'\r\n]*)'|(\S+)/g)].map(m=>m[1]??m[2]??m[3]);
const clean=value=>String(value??'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,4096);
function ip(value){
 const s=String(value||'');if(/^\d+(?:\.\d+){3}$/.test(s)&&s.split('.').every(v=>+v<=255))return s.split('.').map(Number).join('.');
 if(/^[\da-f:.]+$/i.test(s)&&s.includes(':'))try{return new URL('http://['+s+']/').hostname.slice(1,-1).toLowerCase();}catch{}
 return '';
}
function prefix(value){
 if(value==='default')return '0.0.0.0/0';const match=/^([^/]+)\/(\d+)$/.exec(String(value)),address=ip(match?.[1]),count=Number(match?.[2]);
 if(!match||!address||count>(address.includes(':')?128:32))return '';
 return address+'/'+count;
}
function addressToken(value){const match=/^([^%]+)(?:%([^%\s]+))?$/.exec(String(value));const address=ip(match?.[1]);return address?address+(match[2]?'%'+match[2]:''):'';}
const interfaceToken=value=>/^(?:(?:gi|gigabitethernet|te|tengigabitethernet|fa|fastethernet|eth|ethernet|ether|vlan|vlan-interface|port-channel|po|lag|trk|loopback|lo|null|discard|bridge-aggregation)\d+(?:[./:]\d+)*|\d+(?:\/\d+){1,2}|(?:ge|xe|et)-\d+(?:\/\d+){1,2}(?:\.\d+)?)$/i.test(value);
function destinationFrom(parts){
 let destination=parts.shift();if(destination==='default')return '0.0.0.0/0';
 if(ip(destination)&&!destination.includes(':')){
  if(/^\d+$/.test(parts[0]||'')&&Number(parts[0])<=32)destination+='/'+Number(parts.shift());
  else if(ip(parts[0])&&!parts[0].includes(':')){const mask=parts.shift(),binary=mask.split('.').map(v=>(+v).toString(2).padStart(8,'0')).join('');if(!/^1*0*$/.test(binary))return '';destination=cidr(destination,mask);}
 }
 return prefix(destination);
}
export function parseConfiguredRoute(value){
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const r={...value};
  // The native bridge's raw reference envelope has only a destination field.
  // Do not discard qualifiers from an arbitrary structured record.
  if(Object.keys(r).every(key=>key==='destination')&&typeof r.destination==='string'&&!prefix(r.destination))return parseConfiguredRoute(r.destination);
  const destination=prefix(r.destination);if(!destination||r.type==='configured-reference')return null;
  return {...r,destination,nextHop:r.nextHop?addressToken(r.nextHop)||clean(r.nextHop):'',interface:clean(r.interface||''),type:r.type||'static'};
 }
 if(typeof value!=='string'||value.length>4000)return null;
 let text=clean(value).replace(/^(?:ip(?:v6)? route(?:-static)?|route-static)\s+/i,'');if(!text)return null;
 const forti=/^Static route\s+[^:]+:\s+(.+?)(?:\s+via\s+(\S+))?(?:\s+on\s+(\S+))?$/i.exec(text);
 if(forti){const parts=tokens(forti[1]),destination=destinationFrom(parts);if(!destination||parts.length||forti[2]&&!addressToken(forti[2]))return null;return {type:'static',nextHop:forti[2]?addressToken(forti[2]):'',interface:forti[3]||'',destination};}
 const parts=tokens(text),route={type:'static',nextHop:'',interface:''};
 if(['vrf','vpn-instance'].includes(parts[0]?.toLowerCase())){parts.shift();route.vrf=parts.shift();if(!route.vrf)return null;}
 route.destination=destinationFrom(parts);if(!route.destination)return null;
 const options=[];
 while(parts.length){const part=parts.shift(),lower=part.toLowerCase();
  if(addressToken(part)&&!route.nextHop){route.nextHop=addressToken(part);continue;}
  if(/^\d+$/.test(part)&&!route.distance&&(route.nextHop||route.interface)){route.distance=String(Number(part));continue;}
  if(['preference','distance','metric'].includes(lower)&&/^\d+$/.test(parts[0]||'')){const key=lower==='preference'?'distance':lower;if(Object.hasOwn(route,key))return null;route[key]=String(Number(parts.shift()));continue;}
  if(['tag','name','track','description','vrf','vpn-instance'].includes(lower)&&parts.length){const key=lower==='vpn-instance'?'vrf':lower;if(Object.hasOwn(route,key))return null;route[key]=parts.shift();continue;}
  if(['permanent','global','reject','blackhole'].includes(lower)){options.push(lower);continue;}
  if(!route.interface&&interfaceToken(part)){route.interface=part;continue;}
  return null; // Unknown suffix is not a fictional interface or a proven match.
 }
 if(!route.nextHop&&!route.interface&&!options.some(v=>v==='reject'||v==='blackhole'))return null;
 if(options.length)route.options=[...new Set(options)].sort();return route;
}
export function configuredRouteKey(value){
 const row=parseConfiguredRoute(value);if(!row)return null;
 const allowed=new Set(['destination','nextHop','interface','type','distance','vrf','tag','name','track','description','options','metric','vdom','context','status','source','sourceName','configured','protocol']);
 if(Object.keys(row).some(key=>!allowed.has(key))||!['static','configured'].includes(row.type))return null;
 if(row.nextHop&&!addressToken(row.nextHop))return null;
 if(row.options!=null&&(!Array.isArray(row.options)||row.options.some(v=>typeof v!=='string')))return null;
 if(!row.nextHop&&!row.interface&&!row.options?.some(v=>v==='reject'||v==='blackhole'))return null;
 const iface=(interfaceToken(row.interface)?clean(row.interface).toLowerCase():clean(row.interface)).replace(/^vlan(?:-interface)?\s*/,'vlan').replace(/^gigabitethernet(?=\d)/,'gi').replace(/^tengigabitethernet(?=\d)/,'te').replace(/^fastethernet(?=\d)/,'fa').replace(/^port-channel(?=\d)/,'po');
 const fields={destination:row.destination,nextHop:row.nextHop||'',interface:iface};
 for(const field of ['distance','vrf','tag','name','track','description','metric','vdom','context','status','protocol','source'])if(row[field]!=null&&row[field]!=='')fields[field]=String(row[field]);
 if(row.options?.length)fields.options=[...new Set(row.options)].sort();return JSON.stringify(fields);
}
export function reconcileConfiguredRoutes(browser=[],native=[]){
 const routes=browser.map(row=>structuredClone(row)),keys=new Set(routes.map(configuredRouteKey).filter(Boolean));let unresolved=0,added=0;
 const opaqueText=row=>typeof row==='string'?clean(row):row?.type==='configured-reference'||Object.keys(row||{}).every(key=>key==='destination')?clean(row.destination):'';
 for(const row of native){const parsed=parseConfiguredRoute(row),key=configuredRouteKey(row);
  if(key&&keys.has(key))continue;
  if(key){routes.push(parsed);keys.add(key);added++;continue;}
  if(row==null)continue;
  const text=opaqueText(row);if(!routes.some(existing=>JSON.stringify(existing)===JSON.stringify(row)||text&&opaqueText(existing)===text)){routes.push(typeof row==='string'?{destination:clean(row),type:'configured-reference'}:structuredClone(row));added++;}
  unresolved++;
 }
 // Unknown browser semantics also prevent a completeness/equivalence claim.
 unresolved+=browser.filter(row=>!configuredRouteKey(row)).length;
 return {routes,unresolved,added};
}
export function configuredAddress(value){
 const list=tokens(clean(value)),first=list.shift();if(!first)return null;
 let address=first;if(ip(first)&&!first.includes(':')){if(/^\d+$/.test(list[0]||'')&&Number(list[0])<=32)address+='/'+Number(list.shift());else if(ip(list[0]))address=cidr(first,list.shift());}
 if(!prefix(address))return null;return [prefix(address),...list].join(' ');
}
export function configuredRouteText(value){
 if(typeof value==='string')return clean(value);if(!value||typeof value!=='object')return '';
 const order=['destination','nextHop','interface','distance','metric','vrf','vdom','context','type','status','protocol','tag','name','track','description','options'];
 const keys=[...order.filter(key=>Object.hasOwn(value,key)),...Object.keys(value).filter(key=>!order.includes(key)).sort()];
 const render=v=>typeof v==='object'?JSON.stringify(v):String(v);
 return keys.filter(key=>value[key]!=null&&value[key]!=='').map(key=>key+': '+clean(render(value[key]))).join(' | ');
}
