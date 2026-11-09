import {importFiles,mergeModels,findDeviceIdentity} from './imports/index.mjs';
import {isOperational} from './imports/operational.mjs';
import {migrateIdentityReferences} from './evidence-identities.mjs';

export const categories=['identity','ports','links','vlans','routes','bridges'];
const copy=x=>JSON.parse(JSON.stringify(x));
const recordKey=(v,type)=>type==='links'?JSON.stringify([v.a+'|'+v.ap.toLowerCase(),v.b+'|'+v.bp.toLowerCase()].sort()):String(v.id??v.name);
const model=p=>copy({devices:p.devices||[],links:p.links||[],warnings:p.warnings||[]});
export function ensureEvidence(p){
 if(!p.evidence)p.evidence={base:model(p),sources:[],edits:{}};
 return p.evidence;
}
export async function readSources(files){
 const out=[];
 for(const file of files){
  const kind=/\.(xlsx|csv)$/i.test(file.name)?'Auvik':isOperational(await file.text())?'Show commands':'Configuration';
  const data=await importFiles([file]);
  out.push({id:'input-'+crypto.randomUUID(),name:file.name,kind,enabled:true,categories:[...categories],model:data});
 }
 return out;
}
const reportField=(row,name)=>Object.keys(row||{}).find(key=>key.toLowerCase()===name.toLowerCase())||name;
const reportGet=(row,name)=>row?.[reportField(row,name)];
const reportSet=(row,name,value)=>{row[reportField(row,name)]=value;};
// Report metadata is carried with identity, but its evidence still belongs to
// the same selectable categories as the editor. Operate on selected()'s clone.
function selectReportEvidence(device,input,chosen){
 const inv=device.switchportInventory;
 if(inv){
  if(!categories.every(category=>chosen.has(category)))reportSet(inv,'assumptions',[]);
  if(!chosen.has('ports')){
   for(const field of ['ports','logicalInterfaces'])reportSet(inv,field,(reportGet(inv,field)||[]).map(port=>{
    const keep={};for(const name of ['id','group','number','displayNumber','relatedInterfaces','media'])if(reportGet(port,name)!==undefined)reportSet(keep,reportField(port,name),reportGet(port,name));
    reportSet(keep,reportField(port,'notes'),[]);
    return keep;
   }));
   reportSet(inv,'mirrors',[]);
  }
  if(!chosen.has('vlans')){reportSet(inv,'vlans',[]);reportSet(inv,'svis',[]);}
  if(!chosen.has('routes'))reportSet(inv,'routes',[]);
  // Management mixes interface addresses and gateway statements, so require
  // both owners rather than misclassifying an opaque retained string.
  if(!chosen.has('ports')||!chosen.has('routes'))reportSet(inv,'management',[]);
 }
 if(!chosen.has('ports'))delete device.mirrors;
 if(!chosen.has('ports')||!chosen.has('routes'))delete device.management;
 const allowed=observation=>{
  const category=String(reportGet(observation,'category')||'').toLowerCase(),field=String(reportGet(observation,'field')||'').toLowerCase();
  if(category==='route')return chosen.has('routes');
  if(category==='neighbor')return chosen.has('links');
  if(['interface','ip interface','dhcp','dhcp relay','arp','mac table'].includes(category))return chosen.has('ports');
  if(category==='device')return chosen.has(field==='connected to'?'links':field==='ip addresses'?'ports':'identity');
  if(category==='reference'){
   if(/lldp|cdp|neighbor/.test(field))return chosen.has('links');
   if(/route|routing/.test(field))return chosen.has('routes');
   if(/interface|dhcp|relay|arp|mac.address|auvik configuration/.test(field))return chosen.has('ports');
   if(/vlan/.test(field))return chosen.has('vlans');
  }
  // Unclassified records can mix categories. Keep only with all enabled.
  return categories.every(category=>chosen.has(category));
 };
 for(const field of ['reportSupplementary','switchportSupplementary','supplementarySources'])if(input[field])device[field]=input[field].map(source=>{
  reportSet(source,'observations',(reportGet(source,'observations')||[]).filter(allowed));return source;
 }).filter(source=>reportGet(source,'observations').length);
}
function selected(source){
 if(!source.enabled)return {devices:[],links:[],warnings:[]};
 const c=new Set(source.categories||categories),m=copy(source.model),first=m.devices[0]?.id;
 if(source.targetId&&first){
  for(const d of m.devices)if(d.id===first){d.id=source.targetId;d.name=source.targetName||source.targetId;d.identityLocked=true;}
  for(const l of m.links){if(l.a===first)l.a=source.targetId;if(l.b===first)l.b=source.targetId;}
 }
 const used=new Set(c.has('links')?m.links.flatMap(l=>[l.a,l.b]):[]);
 m.devices=m.devices.map(d=>{
  const v={id:d.id,name:d.name,kind:'unknown',ports:[],vlans:[],routes:[]};
  if(c.has('identity'))for(const [k,x] of Object.entries(d))if(!['ports','vlans','routes','bridges'].includes(k))v[k]=x;
  for(const k of ['ports','vlans','routes','bridges'])if(c.has(k))v[k]=d[k]||[];
  selectReportEvidence(v,d,c);
  return v;
 }).filter(d=>used.has(d.id)||c.has('identity')||['ports','vlans','routes','bridges','reportSupplementary','switchportSupplementary','supplementarySources'].some(k=>d[k]?.length));
 if(!c.has('links'))m.links=[];
 return m;
}
// Store user changes by property and keyed row. Removing a source therefore
// removes its observations without removing subsequent manual corrections.
function difference(before,after,type='root'){
 if(JSON.stringify(before)===JSON.stringify(after))return null;
  if(Array.isArray(before)&&Array.isArray(after)&&['devices','ports','vlans','links','reportSupplementary'].includes(type)){
  const a=new Map(before.map(v=>[recordKey(v,type),v])),b=new Map(after.map(v=>[recordKey(v,type),v]));const rows={};
  for(const k of new Set([...a.keys(),...b.keys()])){
   const v=!b.has(k)?{remove:true}:!a.has(k)?{set:b.get(k)}:difference(a.get(k),b.get(k));if(v)rows[k]=v;
  }
  return {rows};
 }
 if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after)){
  const fields={};for(const k of new Set([...Object.keys(before),...Object.keys(after)])){
   const v=!Object.hasOwn(after,k)?{remove:true}:difference(before[k],after[k],k);if(v)fields[k]=v;
  }return {fields};
 }
 return {set:copy(after)};
}
function combine(a,b){
 if(!a||b.set!==undefined||b.remove)return b;
 if(a.set!==undefined||a.remove)return {set:patch(a.set,b)};
 const key=b.rows?'rows':'fields',out={...a,[key]:{...(a[key]||{})}};
 for(const [k,v] of Object.entries(b[key]||{}))out[key][k]=combine(out[key][k],v);
 return out;
}
function patch(value,change,type='root',identities=[]){
 if(change?.remove)return undefined;
 if(Object.hasOwn(change||{},'set'))return copy(change.set);
 if(change?.rows){
  const rows=new Map((value||[]).map(v=>[recordKey(v,type),v]));
  for(const [original,p] of Object.entries(change.rows)){
   let k=original;
   if(!rows.has(k)&&type==='devices')k=findDeviceIdentity(identities,k)?.id||k;
   if(!rows.has(k)&&type==='links')try{k=JSON.stringify(JSON.parse(k).map(endpoint=>{const at=endpoint.lastIndexOf('|'),id=endpoint.slice(0,at);return (findDeviceIdentity(identities,id)?.id||id)+endpoint.slice(at);}).sort());}catch{}
   if(!rows.has(k)&&!Object.hasOwn(p,'set'))continue;
   const v=patch(rows.get(k),p,'root',identities);if(v===undefined)rows.delete(k);else {if(type==='devices'&&k!==original)v.id=k;rows.set(k,v);}
  }return [...rows.values()];
 }
 const out={...(value||{})};for(const [k,p] of Object.entries(change?.fields||{})){const v=patch(out[k],p,k,identities);if(v===undefined)delete out[k];else out[k]=v;}return out;
}
// Remember only accepted identity relationships for keyed manual edits. This is
// separate from active observations: disabling a source still removes its fields
// and links, while a correction follows the remaining name of the same device.
function patchIdentities(e,result){
 const norm=value=>String(value).toLowerCase(),groups=e.identityGroups||[];
 for(const d of result.devices)if(d.identityAliases?.length){
  const group=[...new Set([d.id,...d.identityAliases].map(norm))].sort();
  if(!groups.some(v=>JSON.stringify(v)===JSON.stringify(group)))groups.push(group);
 }
 if(groups.length)e.identityGroups=groups;
 const identities=result.devices.map(d=>({...d,identityAliases:[...(d.identityAliases||[])]}));
 for(const group of groups){
  const matches=identities.filter(d=>group.includes(norm(d.id))||d.identityAliases.some(alias=>group.includes(norm(alias))));
  if(matches.length===1)matches[0].identityAliases=[...new Set([...matches[0].identityAliases,...group])];
 }
 return identities;
}
export function captureEdits(p,snapshot){
 if(!snapshot||!p.evidence)return;
 const delta=difference(snapshot,model(p));if(delta)p.evidence.edits=combine(p.evidence.edits,delta);
}
export function composeEvidence(p){
 const before={devices:(p.devices||[]).map(d=>({id:d.id,name:d.name})),links:(p.links||[]).map(({a,ap,b,bp})=>({a,ap,b,bp}))};
 const e=ensureEvidence(p);
 const sources=e.sources.filter(s=>s.enabled).sort((a,b)=>(a.kind==='Configuration'?0:1)-(b.kind==='Configuration'?0:1));
 const result=mergeModels(e.base,...sources.map(selected));
 // Operational speed/state/media are current observations, not intended settings.
 for(const s of sources.filter(s=>s.kind==='Show commands'&&(s.categories||categories).includes('ports'))){
  const data=selected(s);
  for(const d of data.devices){const target=findDeviceIdentity(result.devices,d.id);if(!target)continue;
   for(const port of d.ports){const q=target.ports.find(v=>v.name.toLowerCase()===port.name.toLowerCase());if(q)for(const k of ['state','speed','media'])if(port[k])q[k]=port[k];}
  }
 }
 // Re-evaluate link metadata against observations after all selected inputs.
 for(const l of result.links)for(const [id,name] of [[l.a,l.ap],[l.b,l.bp]]){
  const port=result.devices.find(d=>d.id===id)?.ports.find(p=>p.name.toLowerCase()===name.toLowerCase());
  if(port?.speed&&!l.speed)l.speed=port.speed;
  if(port?.media&&(!l.media||l.media==='unknown'))l.media=port.media;
 }
 const identities=patchIdentities(e,result),edited=patch(result,e.edits,'root',identities);
 for(const link of edited.links)for(const end of ['a','b'])link[end]=findDeviceIdentity(identities,link[end])?.id||link[end];
 Object.assign(p,edited);
 migrateIdentityReferences(p,before,identities);
 return model(p);
}

// Imported projects retain normalized source models. Reopening can therefore
// apply improved reconciliation without reimporting files or reviving disabled
// sources. A project without that provenance keeps its explicit manual model.
export function reopenEvidence(project){
 if(project.evidence)composeEvidence(project);
 return project;
}
