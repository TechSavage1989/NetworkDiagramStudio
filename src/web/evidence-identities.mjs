import {findDeviceIdentity} from './imports/identity.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
const cableKey=link=>[link.a+'/'+link.ap,link.b+'/'+link.bp].sort().join('|');
const pathHash=value=>{let hash=0;for(const c of JSON.stringify([value]))hash=Math.imul(hash,31)+c.charCodeAt(0)|0;return String(hash);};
const logicalHash=value=>{let hash=14695981039346656037n;for(const c of value)hash=BigInt.asUintN(64,(hash^BigInt(c.codePointAt(0)))*1099511628211n);return hash.toString(36);};

// Saved drawing keys are references, not new evidence. Resolve only aliases
// already accepted by the selected sources, and keep original keys so disabling
// a source or reopening an older project never destroys its saved layout.
export function migrateIdentityReferences(project,before,identities){
 const layout=project.layout;if(!layout)return;
 const active=new Set(project.devices.map(d=>d.id)),previous=new Set(before.devices.map(d=>d.id)),aliases=new Map();
 for(const d of identities)for(const alias of [d.id,...(d.identityAliases||[])]){
  const old=String(alias).toLowerCase();if(old!==d.id&&!active.has(old))aliases.set(old,d.id);
 }
 for(const d of before.devices){const target=findDeviceIdentity(identities,d.id);if(target&&target.id!==d.id&&!active.has(d.id))aliases.set(d.id,target.id);}
 if(!aliases.size)return;
 const changes=[...aliases].sort(([a],[b])=>b.length-a.length),resolve=id=>aliases.get(id)||id;
 const token=value=>{
  if(aliases.has(value))return resolve(value);
  for(const [old,next] of changes)if(value.startsWith('handoff:'+old+'/'))return 'handoff:'+next+value.slice(8+old.length);
  return value;
 };
 const list=values=>[...new Set(values.map(token))];
 for(const key of ['order','coreExclude','suppressedHandoffs'])if(Array.isArray(layout[key]))layout[key]=list(layout[key]);
 for(const group of [...(layout.corePages||[]),...(layout.reportPages||[])])if(Array.isArray(group.devices))group.devices=list(group.devices);
 for(const stack of layout.deviceStacks||[])for(const member of stack.members||[])member.deviceId=resolve(member.deviceId);
 if(Array.isArray(layout.switchport?.deviceIds))layout.switchport.deviceIds=list(layout.switchport.deviceIds);
 const replacing=new Set(changes.filter(([old,next])=>previous.has(old)&&!previous.has(next)).map(([old])=>old));
 const linkKeys=new Map(),pathKeys=new Map(),pathOverwrite=new Set(),oldNames=new Map(before.devices.map(d=>[d.id,d.name||d.id])),names=new Map(project.devices.map(d=>[d.id,d.name||d.id]));
 for(const link of before.links){
  const next={...link,a:token(link.a),b:token(link.b)},old=cableKey(link),key=cableKey(next);if(old!==key)linkKeys.set(old,key);
  const oldTitle=(oldNames.get(link.a)||link.a)+' '+link.ap+' / '+(oldNames.get(link.b)||link.b)+' '+link.bp;
  const title=(names.get(next.a)||oldNames.get(link.a)||link.a)+' '+link.ap+' / '+(names.get(next.b)||oldNames.get(link.b)||link.b)+' '+link.bp;
  if(oldTitle!==title){pathKeys.set(pathHash(oldTitle),pathHash(title));if(replacing.has(link.a)||replacing.has(link.b))pathOverwrite.add(pathHash(oldTitle));}
 }
 const key=original=>{
  let value=original;
  for(const [old,next] of linkKeys)value=value.split(old).join(next);
  for(const [old,next] of pathKeys)value=value.split('|path|'+old+'|').join('|path|'+next+'|');
  for(const [old,next] of changes)value=value.split('|device|'+logicalHash(old)+'|').join('|device|'+logicalHash(next)+'|');
  return value.split('|').map((part,i)=>i===0?part:part.includes(',')?part.split(',').map(token).join(','):token(part)).join('|');
 };
 for(const group of layout.corePages||[])if(Array.isArray(group.hiddenReferences))group.hiddenReferences=group.hiddenReferences.map(value=>linkKeys.get(value)||value);
 const overwrite=key=>[...replacing].some(id=>key.includes('|device|'+logicalHash(id)+'|')||key.split('|').slice(1).some(part=>part===id||part.split(',').includes(id)||part.startsWith('handoff:'+id+'/')||part.startsWith(id+'/')))||[...pathOverwrite].some(hash=>key.includes('|path|'+hash+'|'));
 for(const property of ['drawingEdits']){
  const entries=layout[property];if(!entries)continue;
  for(const [old,value] of Object.entries(entries)){
   const next=key(old);if(next!==old&&(!Object.hasOwn(entries,next)||overwrite(old)))entries[next]=copy(value);
  }
 }
 const pages=layout.presentation?.pages;
 if(pages)for(const [old,value] of Object.entries(pages)){const next=key(old);if(next!==old&&(!Object.hasOwn(pages,next)||overwrite(old)))pages[next]=copy(value);}
}
