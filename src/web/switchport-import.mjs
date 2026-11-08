import {parseConfig,mergeModels,findDeviceIdentity} from './imports/index.mjs';
import {importReportSupplementary,supplementaryPromptHostname} from './reports/supplementary.mjs';
import {normalizeSupplementarySources} from './reports/supplementary.mjs';

const value=(row,key)=>row?.[key]??row?.[key[0].toUpperCase()+key.slice(1)];
const cleanText=(s,limit=400)=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').slice(0,limit);
const lowerRows=rows=>(rows||[]).map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k[0].toLowerCase()+k.slice(1),v])));
export async function nativeImport(file){
 if(!globalThis.NDSDesktop?.report)return null;
 const data=await new Promise((yes,no)=>{const reader=new FileReader();reader.onload=()=>yes(reader.result.split(',')[1]);reader.onerror=()=>no(Error('Could not read '+file.name+'.'));reader.readAsDataURL(file);});
 return globalThis.NDSDesktop.report('import',{name:file.name,data});
}
function nativeDevice(item,{independent=true}={}){
 const input=item.device||{},composition=input.hardwareComposition||{},id=independent?'switchport:'+item.id:input.id;
 const d={...input,id,name:cleanText(input.name||item.name,180),kind:input.kind||'switch',fromConfig:true,ports:(input.ports||[]).map(port=>({...port,...(port.disabled!=null?{admin:port.disabled?'down':'up'}:{})})),vlans:input.vlans||[],routes:input.routes||[],stackMembers:input.stackMembers||composition.stackMembers||[],modules:input.modules||composition.modules||[],reportDetails:lowerRows(item.details||input.reportDetails),switchportInventory:item.inventory||input.switchportInventory,reportSupplementary:normalizeSupplementarySources(item.supplementary||[])};
 delete d.hardwareComposition;return d;
}
function palette(raw={}){
 const vlans={},aggregates={};
 for(const [key,color] of Object.entries(value(raw,'vlans')||{})){
  const id=/^vlan:(\d+)(?::|$)/i.exec(key)?.[1]||(/^\d+$/.test(key)?key:null);if(!id||+id<1||+id>4094||!/^#[0-9a-f]{6}$/i.test(color))throw Error('Invalid saved VLAN palette.');
  const canonical='vlan:'+Number(id);if(vlans[canonical]&&vlans[canonical]!==color.toLowerCase())throw Error('Conflicting saved colors for VLAN '+id+'. Choose one color in Switchport Diagram Builder and save the workspace again.');vlans[canonical]=color.toLowerCase();
 }
 for(const [key,color] of Object.entries(value(raw,'aggregates')||{})){const label=key.trim().normalize('NFC').toUpperCase();if(!label||!/^#[0-9a-f]{6}$/i.test(color))throw Error('Invalid saved LAG palette.');if(aggregates[label]&&aggregates[label]!==color.toLowerCase())throw Error('Conflicting saved LAG colors.');aggregates[label]=color.toLowerCase();}
 return {vlans,aggregates};
}
export async function importSwitchportWorkspace(file){
 if(file.size>100_000_000)throw Error('Choose a Switchport workspace under 100 MB.');
 const native=await nativeImport(file);
 if(native){const devices=native.items.map(item=>nativeDevice(item));return {model:{devices,links:[],warnings:native.warnings||[]},settings:{enabled:true,deviceIds:devices.map(d=>d.id),combined:true,outputLabel:native.outputLabel||file.name.replace(/\.spworkspace\.json$/i,''),title:native.showWorkspaceTitle?native.title||native.outputLabel:'',palette:palette(native.palette)},selectedId:native.selectedId?'switchport:'+native.selectedId:devices[0]?.id||null};}
 const doc=JSON.parse(await file.text());if(value(doc,'format')!=='SwitchportDiagramBuilder.Workspace'||value(doc,'version')!==1)throw Error('Choose a Switchport Diagram Builder workspace (version 1).');
 const items=value(doc,'items');if(!Array.isArray(items)||items.length>100)throw Error('A Switchport workspace supports up to 100 configurations.');
 const ids=new Set(),models=[];
 for(const item of items){const id=value(item,'id'),text=value(item,'text'),name=cleanText(value(item,'name'),200),details=lowerRows(value(item,'devices'));
  if(!/^[0-9a-f]{32}$/i.test(id)||ids.has(id)||typeof text!=='string'||!text.trim()||new TextEncoder().encode(text).length>20_000_000)throw Error('The workspace contains an invalid configuration item.');ids.add(id);
  const parsed=parseConfig(text,name||'Switchport configuration');if(!parsed.devices.length)throw Error((parsed.warnings||[])[0]||'A workspace configuration could not be read.');
  const remap=new Map(parsed.devices.map((d,n)=>[d.id,'switchport:'+id+(n?':'+n:'')]));
  for(const [index,d] of parsed.devices.entries()){
   d.id=remap.get(d.id);d.fromConfig=true;d.reportDetails=details;d.reportSourceName=name;
   const parents=details.filter(row=>!String(row.id).includes('/')),selected=parents.filter(row=>row.modelSelection);
   if(selected.length===1)d.model=selected[0].modelSelection;
   if(selected.length>1)d.stackMembers=selected.map(row=>({id:String(row.id),model:row.modelSelection}));
   const modules=parents.flatMap(row=>(row.moduleSelections||[]).map(m=>({member:selected.length>1?String(row.id):'',slot:cleanText(value(m,'slot'),24),model:cleanText(value(m,'sku'),120)})));
   if(modules.length)d.modules=modules;
   d.reportSupplementary=normalizeSupplementarySources(value(item,'supplementarySources')||[]);
  }
  parsed.links=parsed.links.map(l=>({...l,a:remap.get(l.a)||l.a,b:remap.get(l.b)||l.b}));models.push(parsed);
 }
 const selectedId=value(doc,'selectedId');if(selectedId!=null&&!ids.has(selectedId))throw Error('The saved selected configuration is not in this workspace.');
 const model=mergeModels(...models),outputLabel=cleanText(value(doc,'outputLabel')||file.name.replace(/\.spworkspace\.json$/i,''),100);
 return {model,settings:{enabled:true,deviceIds:model.devices.map(d=>d.id),combined:true,outputLabel,title:value(doc,'showWorkspaceTitle')?cleanText(file.name.replace(/\.spworkspace\.json$/i,''),180):'',showWorkspaceTitle:value(doc,'showWorkspaceTitle')===true,palette:palette(value(doc,'paletteOverrides'))},selectedId:selectedId?'switchport:'+selectedId:model.devices[0]?.id||null};
}
export async function enrichSwitchportSources(files,sources,existingDevices=[]){
 if(globalThis.NDSDesktop?.report)for(let i=0;i<files.length;i++){
  const source=sources[i];if(!source||source.kind!=='Configuration'||files[i].size>20_000_000)continue;
  try{
   const result=await nativeImport(files[i]);
   for(const item of result?.items||[]){const incoming=nativeDevice(item,{independent:false}),matches=source.model.devices.filter(d=>d.name.toLowerCase()===incoming.name.toLowerCase());
    if(matches.length===1){const d=matches[0];d.switchportInventory=item.inventory;d.reportDetails=lowerRows(item.details||d.reportDetails);d.reportSupplementary=item.supplementary||[];
     // The report parser can recover a supported configuration for which the
     // topology parser has no model. Existing network observations remain primary.
     if(!d.model&&incoming.model)d.model=incoming.model;if(!d.modules?.length&&incoming.modules?.length)d.modules=incoming.modules;if(!d.stackMembers?.length&&incoming.stackMembers?.length>1)d.stackMembers=incoming.stackMembers;
    }else if(!source.model.devices.length){incoming.id=incoming.name.toLowerCase();source.model.devices.push(incoming);source.model.warnings=(result.warnings||[]).map(w=>files[i].name+': '+w);}
   }
  }catch(error){source.model.warnings.push(files[i].name+': Switchport report import: '+error.message);}
 }
 // Inspect every primary input first, regardless of drop order. Attach each
 // observation to its own source model so Imported data toggles stay effective.
 const owners=mergeModels({devices:existingDevices,links:[],warnings:[]},...sources.filter(source=>source.kind==='Configuration').map(source=>source.model)).devices.filter(device=>device.fromConfig||device.switchportInventory);
 if(!owners.length)return;
 for(let index=0;index<files.length;index++){
  const input=sources[index],file=files[index];if(!input||input.reportSupplementaryImported||!(input.kind==='Show commands'||input.kind==='Auvik'&&/\.(xlsx|csv)$/i.test(file.name)))continue;
  try{
   let selected=owners;
   if(input.kind==='Show commands'){
    if(file.size>20_000_000)continue;
    const prompt=supplementaryPromptHostname(await file.text()),target=prompt?findDeviceIdentity(owners,prompt):input.targetId?findDeviceIdentity(owners,input.targetId):null;
    if(!target)continue;selected=[target];
   }
   const imported=await importReportSupplementary(file,selected);
   for(const {deviceId,source} of imported){
    const owner=selected.find(device=>device.id===deviceId);if(!owner)continue;
    let target=findDeviceIdentity(input.model.devices,owner.id)||findDeviceIdentity(input.model.devices,owner.name);
    if(!target){target={id:owner.id,name:owner.name,kind:'unknown',ports:[],vlans:[],routes:[]};input.model.devices.push(target);}
    const observations=target.reportSupplementary||=[];if(observations.length>=20)throw Error('Each device supports up to 20 supplementary sources. Remove an old source first.');
    observations.push(source);
   }
   input.reportSupplementaryImported=true;
  }catch(error){input.model.warnings.push(file.name+': Supplementary report observations: '+error.message);}
 }
}
