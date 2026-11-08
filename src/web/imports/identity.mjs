const id=value=>String(value||'').trim().toLowerCase();
const hostname=value=>{
 const name=id(value).replace(/\.$/,'');
 if(!/^[a-z0-9_][a-z0-9_.-]*$/.test(name)||/^\d+(?:\.\d+){3}$/.test(name)||name.includes('..'))return '';
 return name;
};
const known=value=>value&&value!=='unknown';

// Hostnames are contextual aliases, not a global ID normalization. In particular,
// two domains and two explicitly configured identities must remain distinguishable.
export function identityPlan(models,warnings=new Set()){
 const records=new Map(),aliases=new Map();
 for(const model of models)for(const device of model.devices||[]){
  if(!device.id||!device.name)continue;
  const key=id(device.id);if(!records.has(key))records.set(key,[]);records.get(key).push(device);
 }
 for(const key of records.keys())aliases.set(key,key);
 const claims=new Map();
 for(const [key,rows] of records)for(const row of rows)for(const alias of row.identityAliases||[]){
  const name=id(alias);if(!name||name===key)continue;
  if(!claims.has(name))claims.set(name,new Set());claims.get(name).add(key);
 }
 for(const [name,owners] of claims){
  if(owners.size!==1||records.get(name)?.some(d=>d.fromConfig||d.identityLocked))continue;
  aliases.set(name,[...owners][0]);
 }
 const groups=new Map();
 for(const [key,rows] of records)for(const row of rows){
  if(id(row.name)!==key||row.identityLocked)continue;
  for(const label of [row.name,...(row.identityAliases||[])]){
   const name=hostname(label);if(!name)continue;
   const stem=name.split('.')[0];if(!groups.has(stem))groups.set(stem,{ids:new Set(),names:new Set()});
   const group=groups.get(stem);group.ids.add(aliases.get(key)||key);group.names.add(name);
  }
 }
 for(const [stem,group] of groups){
  const ids=[...group.ids],domains=[...group.names].filter(n=>n.includes('.'));
  if(ids.length<2||!group.names.has(stem))continue;
  if(domains.length>1){warnings.add('Hostname '+stem+' has multiple fully qualified names. Devices remain separate; review source identities.');continue;}
  if(domains.length!==1)continue;
  const all=ids.flatMap(key=>records.get(key)||[]),configured=ids.filter(key=>records.get(key)?.some(d=>d.fromConfig));
  if(configured.length>1||all.some(d=>d.identityLocked)||new Set(all.map(d=>d.kind).filter(known)).size>1)continue;
  const canonical=configured[0]||ids.find(key=>hostname(records.get(key)?.[0].name)===stem);
  if(!canonical)continue;
  for(const [alias,target] of aliases)if(ids.includes(target))aliases.set(alias,canonical);
 }
 const names=new Map();
 for(const [key,rows] of records){
  const canonical=aliases.get(key)||key;
  if(!names.has(canonical))names.set(canonical,new Set());
  for(const row of rows)for(const name of [row.name,...(row.identityAliases||[])])names.get(canonical).add(name);
 }
 return {id:value=>aliases.get(id(value))||id(value),name:key=>(records.get(key)||[]).find(d=>d.fromConfig)?.name||records.get(key)?.[0].name,aliases:key=>[...(names.get(key)||[])]};
}

export function findDeviceIdentity(devices,value){
 const rows=devices instanceof Map?[...devices.values()]:devices||[],key=id(value);
 const exact=rows.find(d=>id(d.id)===key);if(exact)return exact;
 const matches=rows.filter(d=>(d.identityAliases||[]).some(alias=>id(alias)===key));
 return matches.length===1?matches[0]:undefined;
}
