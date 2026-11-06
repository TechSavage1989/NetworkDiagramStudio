import {importFiles,mergeModels} from './imports/index.mjs';
import {isOperational} from './imports/operational.mjs';

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
function selected(source){
 if(!source.enabled)return {devices:[],links:[],warnings:[]};
 const c=new Set(source.categories||categories),m=copy(source.model),first=m.devices[0]?.id;
 if(source.targetId&&first){
  for(const d of m.devices)if(d.id===first){d.id=source.targetId;d.name=source.targetName||source.targetId;}
  for(const l of m.links){if(l.a===first)l.a=source.targetId;if(l.b===first)l.b=source.targetId;}
 }
 const used=new Set(c.has('links')?m.links.flatMap(l=>[l.a,l.b]):[]);
 m.devices=m.devices.map(d=>{
  const v={id:d.id,name:d.name,kind:'unknown',ports:[],vlans:[],routes:[]};
  if(c.has('identity'))for(const [k,x] of Object.entries(d))if(!['ports','vlans','routes','bridges'].includes(k))v[k]=x;
  for(const k of ['ports','vlans','routes','bridges'])if(c.has(k))v[k]=d[k]||[];
  return v;
 }).filter(d=>used.has(d.id)||c.has('identity')||['ports','vlans','routes','bridges'].some(k=>d[k]?.length));
 if(!c.has('links'))m.links=[];
 return m;
}
// Store user changes by property and keyed row. Removing a source therefore
// removes its observations without removing subsequent manual corrections.
function difference(before,after,type='root'){
 if(JSON.stringify(before)===JSON.stringify(after))return null;
 if(Array.isArray(before)&&Array.isArray(after)&&['devices','ports','vlans','links'].includes(type)){
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
function patch(value,change,type='root'){
 if(change?.remove)return undefined;
 if(Object.hasOwn(change||{},'set'))return copy(change.set);
 if(change?.rows){
  const rows=new Map((value||[]).map(v=>[recordKey(v,type),v]));
  for(const [k,p] of Object.entries(change.rows)){if(!rows.has(k)&&!Object.hasOwn(p,'set'))continue;const v=patch(rows.get(k),p);if(v===undefined)rows.delete(k);else rows.set(k,v);}return [...rows.values()];
 }
 const out={...(value||{})};for(const [k,p] of Object.entries(change?.fields||{})){const v=patch(out[k],p,k);if(v===undefined)delete out[k];else out[k]=v;}return out;
}
export function captureEdits(p,snapshot){
 if(!snapshot||!p.evidence)return;
 const delta=difference(snapshot,model(p));if(delta)p.evidence.edits=combine(p.evidence.edits,delta);
}
export function composeEvidence(p){
 const e=ensureEvidence(p);
 const sources=e.sources.filter(s=>s.enabled).sort((a,b)=>(a.kind==='Configuration'?0:1)-(b.kind==='Configuration'?0:1));
 const result=mergeModels(e.base,...sources.map(selected));
 // Operational speed/state/media are current observations, not intended settings.
 for(const s of sources.filter(s=>s.kind==='Show commands'&&(s.categories||categories).includes('ports'))){
  const data=selected(s);
  for(const d of data.devices){const target=result.devices.find(v=>v.id===d.id);if(!target)continue;
   for(const port of d.ports){const q=target.ports.find(v=>v.name.toLowerCase()===port.name.toLowerCase());if(q)for(const k of ['state','speed','media'])if(port[k])q[k]=port[k];}
  }
 }
 // Re-evaluate link metadata against observations after all selected inputs.
 for(const l of result.links)for(const [id,name] of [[l.a,l.ap],[l.b,l.bp]]){
  const port=result.devices.find(d=>d.id===id)?.ports.find(p=>p.name.toLowerCase()===name.toLowerCase());
  if(port?.speed&&!l.speed)l.speed=port.speed;
  if(port?.media&&(!l.media||l.media==='unknown'))l.media=port.media;
 }
 const edited=patch(result,e.edits);Object.assign(p,edited);
 return model(p);
}
