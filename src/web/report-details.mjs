// Device report details share the existing device editor and project history.
export function reportDetailFields(parent,device,{el,field,members=()=>device.stackMembers||[],modules=()=>device.modules||[]}={}){
 const section=el('details'),summary=el('summary','Serial numbers, asset tags and report notes'),list=el('div');section.append(summary,list);parent.append(section);
 const saved=new Map((device.reportDetails||[]).map(row=>{const value=Object.fromEntries(Object.entries(row).map(([key,v])=>[key[0].toLowerCase()+key.slice(1),v]));return [String(value.id),value];}));
 let rows=[];
 const collect=()=>{for(const row of rows)saved.set(row.id,{...saved.get(row.id),id:row.id,name:row.name.value.trim(),serialNumber:row.serialNumber.value.trim(),assetTag:row.assetTag.value.trim(),notes:row.notes.value.trim()});};
 const identities=()=>{
  const stack=members().filter(m=>m.id),base=stack.length?stack.map(m=>({id:String(m.id),label:'Member '+m.id,model:m.model})):[{id:'1',label:device.kind==='firewall'?'Firewall':modules().length?'Chassis':'Switch',model:device.model}];
  return [...base,...modules().filter(m=>m.slot).map(m=>({id:(m.member||'1')+'/'+String(m.slot).toUpperCase(),label:(stack.length?'Member '+m.member+' / ':'')+'Module '+m.slot,model:m.model}))];
 };
 function refresh(){collect();rows=[];list.replaceChildren();
  const known=identities(),ids=new Set(known.map(row=>row.id)),unassigned=[...saved.values()].filter(row=>!ids.has(row.id)).map(row=>({id:row.id,label:'Unassigned details '+row.id,model:row.model||row.modelSelection,unassigned:true}));
  for(const identity of [...known,...unassigned]){
   const stored=saved.get(identity.id)||{},box=el('div','','report-detail-row');box.append(el('h3',identity.label+(identity.model?' | '+identity.model:'')));if(identity.unassigned){box.append(el('p','This record no longer matches an installed member or module. Review the hardware selection or remove the unused details.','hint'));const remove=el('button','Remove unassigned details');remove.type='button';remove.onclick=()=>{collect();saved.delete(identity.id);rows=rows.filter(row=>row.id!==identity.id);refresh();};box.append(remove);}const grid=el('div','','compact-fields');box.append(grid);const row={id:identity.id};
   for(const [key,title,limit] of [['name','Display name',80],['serialNumber','Serial number',80],['assetTag','Asset tag',80],['notes','Notes',400]]){const cell=el('div','','compact-field'+(key==='notes'?' wide':''));grid.append(cell);row[key]=field(cell,title,stored[key]||'',key==='notes'?'multiline':null);row[key].maxLength=limit;}
   rows.push(row);list.append(box);
  }
 }
 section.ontoggle=()=>{if(section.open)refresh();};refresh();
 return Object.assign(()=>{collect();return [...saved.values()];},{refresh});
}
