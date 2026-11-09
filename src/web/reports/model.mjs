import {configuredAddress,configuredRouteText} from '../imports/routing-records.mjs';
import {switchportCatalog} from './catalog-data.mjs';
import {deviceFaceplate,faceplateProfile} from '../diagram/faceplate.mjs';
import {physicalPorts} from '../diagram/scene.mjs';
import {aggregateKey,vlanIds,sharedReportPalette} from './palette.mjs';
import {cleanSwitchportSettings,reportText} from './settings.mjs';
export {cleanSwitchportSettings,reportText} from './settings.mjs';

const rows=value=>Array.isArray(value)?value:[];
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const get=(object,key,fallback)=>object?.[key]??Object.entries(object||{}).find(([name])=>name.toLowerCase()===key.toLowerCase())?.[1]??fallback;
const number=value=>Number.isInteger(Number(value))?Number(value):null;
const vlan=value=>{const n=number(value);return n>=1&&n<=4094?n:null;};
const key=value=>String(value??'').toLowerCase().replace(/[\s-]/g,'').replace(/^(gigabitethernet|gigeth|gig)(?=\d)/,'gi').replace(/^(tengigabitethernet|tengigeth|tengige)(?=\d)/,'te').replace(/^(twentyfivegigabitethernet|twentyfivegige|twe)(?=\d)/,'twentyfiveg').replace(/^(fortygigabitethernet|fortygige|fo)(?=\d)/,'fortyg').replace(/^(hundredgigabitethernet|hundredgige|hu)(?=\d)/,'hundredg').replace(/^fastethernet(?=\d)/,'fa').replace(/^ethernet(?=\d)/,'eth').replace(/^vlaninterface(?=\d)/,'vlan');
const sku=value=>String(value??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const clone=value=>JSON.parse(JSON.stringify(value));
const unique=values=>[...new Set(values)];
export function reportFolder(value){
 let name=reportText(value,1000).replace(/[<>:"/\\|?*]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'Unknown-Switch';if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name))name='Switch_'+name;return name;
}
function selectedDevices(project,selectedIds){
 const settings=cleanSwitchportSettings(project.layout?.switchport),selected=selectedIds??(settings.deviceIds.length?settings.deviceIds:null),ids=selected?new Set(selected):null;
 const devices=rows(project.devices).filter(device=>ids?ids.has(device.id):device.include!==false&&(['switch','firewall'].includes(device.kind)||device.switchportInventory));if(devices.length>100)throw Error('Select up to 100 devices for one switchport report package.');return devices;
}
export function reportRequest(project,selectedIds){
 const settings=cleanSwitchportSettings(project.layout?.switchport),selected=selectedDevices(project,selectedIds);let workspace;try{workspace=selectedDevices(project);}catch(error){if(selectedIds==null)throw error;workspace=selected;}
 const context=[...new Map([...workspace,...selected].map(device=>[device.id,device])).values()].map(device=>{try{return {id:device.id,inventory:inventoryForDevice(device)};}catch(error){return {id:device.id,inventory:normalizeReportInventory({blockers:[error.message]})};}}),resolved=sharedReportPalette(context,settings.palette),selectedSet=new Set(selected.map(device=>device.id)),inventories=context.filter(item=>selectedSet.has(item.id)),ids=new Set(inventories.flatMap(item=>vlanIds(item.inventory))),lags=new Set(inventories.flatMap(item=>item.inventory.ports.map(port=>aggregateKey(port.aggregate)).filter(Boolean)));
 const palette={vlans:Object.fromEntries(Object.entries(resolved.overrides.vlans).filter(([key])=>ids.has(+key.slice(5)))),aggregates:Object.fromEntries(Object.entries(resolved.aggregates).filter(([key])=>lags.has(key)))};
 return {items:selected.map(device=>({id:device.id,name:device.reportSourceName||device.name||device.id,device:clone(device),...(device.switchportInventory?{inventory:clone(device.switchportInventory)}:{}),details:clone(device.reportDetails||[]),supplementary:clone(rows(device.reportSupplementary||device.switchportSupplementary||device.supplementarySources).filter(source=>source.enabled!==false))})),outputLabel:settings.outputLabel,title:settings.showWorkspaceTitle?settings.title||project.name||settings.outputLabel:'',combined:settings.combined,logoDataUrl:settings.logoDataUrl,paper:settings.paper,palette};
}
function normalizePort(raw={}){
 return {id:reportText(get(raw,'id',''),200),group:reportText(get(raw,'group',''),300),number:number(get(raw,'number',0))||0,description:reportText(get(raw,'description','')),displayNumber:reportText(get(raw,'displayNumber',''),200),relatedInterfaces:rows(get(raw,'relatedInterfaces',[])).map(value=>reportText(value,200)),taggedVlanPolicy:get(raw,'taggedVlanPolicy',null),media:reportText(get(raw,'media','Unknown'),100),mode:reportText(get(raw,'mode','Unknown'),100),untaggedVlan:vlan(get(raw,'untaggedVlan',null)),untaggedState:reportText(get(raw,'untaggedState','Unknown'),40),taggedVlans:unique(rows(get(raw,'taggedVlans',[])).map(vlan).filter(Boolean)).sort((a,b)=>a-b),voiceVlan:vlan(get(raw,'voiceVlan',null)),aggregate:reportText(get(raw,'aggregate',''),160),connectedDevice:reportText(get(raw,'connectedDevice','Unknown/Confirm before use')),usage:reportText(get(raw,'usage','Unknown/Confirm before use')),disabled:typeof get(raw,'disabled')==='boolean'?get(raw,'disabled'):null,liveState:reportText(get(raw,'liveState','Unknown/Confirm before use'),200),stackLink:get(raw,'stackLink',false)===true,speed:reportText(get(raw,'speed','Not specified'),100),notes:rows(get(raw,'notes',[])).map(value=>reportText(value))};
}
function normalizeGroup(raw={}){
 const group={};for(const name of ['id','product','prefix','device','slot','opticalSide','opticalType'])group[name]=reportText(get(raw,name,name==='device'?'1':''),300);
 for(const name of ['copper','optical'])group[name]=Math.max(0,number(get(raw,name,0))||0);
 for(const name of ['opticalOnly','blankLeft','rear','configuredInterfaces'])group[name]=get(raw,name,false)===true;
 group.socketLayout=rows(get(raw,'socketLayout',[])).map(socket=>({number:number(get(socket,'number')),column:Number(get(socket,'column')),row:Number(get(socket,'row')),media:reportText(get(socket,'media','Unknown'),100),interfaceKind:reportText(get(socket,'interfaceKind',''),100),suffix:reportText(get(socket,'suffix',''),20)}));return group;
}
function normalizeDetail(raw={}){const detail={};for(const name of ['id','label','model','detectedModel','modelSelection','kind','parentId','groupId','name','serialNumber','assetTag','notes'])detail[name]=reportText(get(raw,name,''),name==='notes'?20000:400);detail.moduleSelections=rows(get(raw,'moduleSelections',[])).map(row=>({slot:reportText(get(row,'slot',''),24),sku:reportText(get(row,'sku',''),100)}));return detail;}
export function normalizeReportInventory(raw={}){
 const inv={schema:'1.4'};for(const name of ['hostname','vendor','os','firmware','topology','chassisModel','reportModel'])inv[name]=reportText(get(raw,name,['hostname','vendor','os','firmware','topology'].includes(name)?'Unknown':''),400);
 inv.chassisSlots=number(get(raw,'chassisSlots',0))||0;inv.flexibleUplinks=get(raw,'flexibleUplinks',false)===true;
 inv.groups=rows(get(raw,'groups',[])).map(normalizeGroup);inv.ports=rows(get(raw,'ports',[])).map(normalizePort);inv.logicalInterfaces=rows(get(raw,'logicalInterfaces',[])).map(normalizePort);inv.devices=rows(get(raw,'devices',[])).map(normalizeDetail);
 inv.vlans=rows(get(raw,'vlans',[])).map(row=>({id:vlan(get(row,'id')),name:reportText(get(row,'name','')),voice:get(row,'voice',false)===true})).filter(row=>row.id);
 inv.svis=rows(get(raw,'svis',[])).map(row=>({interface:reportText(get(row,'interface','')),address:reportText(get(row,'address',''))}));
 for(const name of ['routes','management','mirrors','assumptions','blockers'])inv[name]=rows(get(raw,name,[])).map(value=>reportText(value));
 inv.moduleInventory=clone(get(raw,'moduleInventory',[]));inv.vlanColorOverrides={...get(raw,'vlanColorOverrides',{})};inv.aggregateColorOverrides={...get(raw,'aggregateColorOverrides',{})};return inv;
}
function resetPort(raw){return normalizePort({id:raw.id,group:raw.group,number:raw.number,displayNumber:raw.displayNumber,relatedInterfaces:raw.relatedInterfaces,media:raw.media,notes:raw.notes.filter(note=>/socket|dual.personality|configured alternative/i.test(note))});}
export function reportModelChoice(model){
 const all=[...(switchportCatalog.models||[]),...(switchportCatalog.additionalModels||[])],wanted=sku(model);
 return all.find(item=>sku(item.sku)===wanted)||all.filter(item=>wanted.includes(sku(item.sku))).sort((a,b)=>b.sku.length-a.sku.length)[0]||null;
}
function renumber(inv,member,stack){
 const groups=new Map(),rename=name=>stack?name.replace(/^((?:Gi|Te|Fa|Eth|Ethernet|GigabitEthernet|TenGigabitEthernet|TwentyFiveGigE|HundredGigE)?)(\d+)(\/)/i,'$1'+member+'$3')===name?(name.includes('/')?name:member+'/'+name):name.replace(/^((?:Gi|Te|Fa|Eth|Ethernet|GigabitEthernet|TenGigabitEthernet|TwentyFiveGigE|HundredGigE)?)(\d+)(\/)/i,'$1'+member+'$3'):name;
 for(const group of inv.groups){const before=group.id;group.id=stack?'Member '+member+(group.slot?' / Module '+group.slot:group.rear?' / Rear':''):group.id;group.device=member;group.prefix=stack?rename(group.prefix||''):group.prefix;groups.set(before,group.id);}
 for(const port of [...inv.ports,...inv.logicalInterfaces]){port.group=groups.get(port.group)||port.group;port.id=rename(port.id);port.relatedInterfaces=port.relatedInterfaces.map(rename);}
 for(const detail of inv.devices){detail.id=detail.parentId?member+'/'+detail.id.split('/').at(-1):member;detail.parentId=detail.parentId?member:'';detail.groupId=groups.get(detail.groupId)||detail.groupId;}
 return inv;
}
function nativeTemplate(device){
 const composition=device.hardwareComposition||{},memberRows=own(composition,'stackMembers')?rows(composition.stackMembers):rows(device.stackMembers),members=memberRows.length?memberRows:[{id:'1',model:device.model||device.sku}],modules=own(composition,'modules')?rows(composition.modules):rows(device.modules),stack=members.length>1;
 const combined=normalizeReportInventory({hostname:device.name,topology:stack?'Stack/member inventory':'Fixed'});
 for(const member of members){
  const choice=reportModelChoice(member.model),template=choice?.inventory;if(!template)return null;
  let inv=normalizeReportInventory(template);const memberId=String(member.id||'1');
  for(const module of modules.filter(module=>String(module.member||'1')===memberId)){
   const slot=String(module.slot).toUpperCase(),option=rows(choice.slots).find(row=>String(get(row,'slot','')).toUpperCase()===slot),choices=rows(get(option,'options',get(option,'choices',get(option,'modules',[])))),selected=choices.find(row=>sku(get(row,'sku',''))===sku(module.model));
   if(!option||!selected){inv.blockers.push('Module '+module.model+' is not a confirmed compatible choice for '+member.model+' slot '+slot+'.');continue;}
   const layout=switchportCatalog.moduleLayouts?.[get(selected,'layoutKey','')]||get(selected,'inventory',null),fragment=layout?normalizeReportInventory(get(layout,'inventory',layout)):null;
   if(fragment){
    const ids=new Set(fragment.groups.map(group=>group.id)),remove=new Set(inv.groups.filter(group=>group.slot===slot||ids.has(group.id)).map(group=>group.id));
    inv.groups=inv.groups.filter(group=>!remove.has(group.id));inv.ports=inv.ports.filter(port=>!remove.has(port.group));inv.groups.push(...fragment.groups);inv.ports.push(...fragment.ports);inv.devices.push(...fragment.devices.filter(detail=>!inv.devices.some(existing=>existing.id===detail.id)));inv.moduleInventory.push(...fragment.moduleInventory);
   }else{
    const card=rows(switchportCatalog.modules).find(row=>sku(row.sku)===sku(module.model)),sockets=rows(card?.sockets||card?.socketLayout||card?.geometry?.sockets).map(row=>({number:get(row,'number'),column:get(row,'column'),row:get(row,'row'),media:get(row,'media','RJ-45'),suffix:get(row,'suffix','')}));
    if(!sockets.length){inv.blockers.push('The selected module '+module.model+' in slot '+slot+' has no verified browser report geometry.');continue;}
    const id='Module '+slot,expected=Math.max(...sockets.map(row=>row.number)),optical=unique(sockets.filter(row=>!/RJ|copper/i.test(row.media)).map(row=>row.number)).length,group=normalizeGroup({id,product:module.model,device:'1',slot,prefix:slot,copper:expected-optical,optical,socketLayout:sockets});
    inv.groups=inv.groups.filter(existing=>existing.slot!==slot);inv.ports=inv.ports.filter(port=>inv.groups.some(group=>group.id===port.group));inv.groups.push(group);inv.ports.push(...Array.from({length:expected},(_,index)=>normalizePort({id:slot+(index+1),number:index+1,group:id,media:sockets.find(socket=>socket.number===index+1)?.media})));inv.devices.push(normalizeDetail({id:'1/'+slot,label:'Module '+slot,model:module.model,kind:'Module',parentId:'1',groupId:id}));
   }
  }
  inv=renumber(inv,memberId,stack);combined.groups.push(...inv.groups);combined.ports.push(...inv.ports.map(resetPort));combined.logicalInterfaces.push(...inv.logicalInterfaces.map(resetPort));combined.devices.push(...inv.devices);combined.blockers.push(...inv.blockers);combined.assumptions.push(...inv.assumptions);
  for(const name of ['vendor','os','chassisModel','reportModel'])if(inv[name]&&inv[name]!=='Unknown')combined[name]=combined[name]&&combined[name]!=='Unknown'&&combined[name]!==inv[name]?unique(combined[name].split(' / ').concat(inv[name])).join(' / '):inv[name];combined.chassisSlots=Math.max(combined.chassisSlots,inv.chassisSlots);combined.flexibleUplinks||=inv.flexibleUplinks;if(!stack)combined.topology=inv.topology;
 }
 return combined;
}
function faceplateTemplate(device){
 const composition=device.hardwareComposition||{},resolved={...device,stackMembers:composition.stackMembers||device.stackMembers,modules:composition.modules||device.modules},panel=deviceFaceplate(resolved);
 if(!panel?.verified||!panel.sockets?.length)return null;
 const inv=normalizeReportInventory({hostname:device.name,vendor:device.vendor,os:device.os,topology:panel.moduleChannel?'Modular':resolved.stackMembers?.length>1?'Stack/member inventory':'Fixed',chassisModel:panel.moduleChannel?device.model:'',chassisSlots:panel.moduleChannel?panel.regions.filter(region=>/^[A-L]$/.test(region.id)).length:0}),observed=physicalPorts(device),byGroup=new Map();
 for(const socket of panel.sockets.filter(socket=>socket.primary)){
  const member=resolved.stackMembers?.length>1?String(socket.name).match(/^(\d+)\//)?.[1]||'1':'1',slot=String(socket.name).match(/(?:^|\/)([A-L])\d+$/)?.[1]||'',id=slot?'Module '+(member==='1'&&!resolved.stackMembers?.length?'':member+'/')+slot:resolved.stackMembers?.length>1?'Member '+member:'Switch';
  const names=Object.entries(panel.ports).filter(([,point])=>Math.abs(point[0]-socket.x)<1e-7&&Math.abs(point[1]-socket.y)<1e-7).map(([name])=>name),input=observed.find(port=>names.some(name=>key(name)===key(port.name))),profile=faceplateProfile(resolved),name=input?.name||(profile?.naming==='cx'&&!String(socket.name).includes('/')?'1/1/'+socket.name:socket.name);
  if(!byGroup.has(id))byGroup.set(id,[]);byGroup.get(id).push({...socket,id:name,member,slot});
 }
 for(const [id,sockets] of byGroup){
  const {member,slot}=sockets[0],model=slot?resolved.modules?.find(module=>module.slot===slot&&String(module.member||'1')===member)?.model:resolved.stackMembers?.find(row=>String(row.id)===member)?.model||device.model,ys=unique(sockets.map(socket=>socket.y)).sort((a,b)=>a-b),rowYs=[];
  const threshold=(ys.at(-1)-ys[0])*.08;for(const y of ys)if(!rowYs.some(value=>Math.abs(value-y)<=threshold))rowYs.push(y);
  const xs=unique(sockets.map(socket=>socket.x)).sort((a,b)=>a-b),pitch=Math.min(...xs.slice(1).map((x,index)=>x-xs[index]).filter(value=>value>.00001)),left=xs[0],layout=sockets.map((socket,index)=>({number:index+1,column:Number.isFinite(pitch)?(socket.x-left)/pitch:0,row:rowYs.reduce((nearest,y,index)=>Math.abs(y-socket.y)<Math.abs(rowYs[nearest]-socket.y)?index:nearest,0),media:socket.form,suffix:''}));
  const optical=sockets.filter(socket=>!/RJ|copper/i.test(socket.form)).length;inv.groups.push(normalizeGroup({id,product:model,device:member,slot,copper:sockets.length-optical,optical,socketLayout:layout}));inv.ports.push(...sockets.map((socket,index)=>normalizePort({id:socket.id,group:id,number:index+1,media:socket.form})));
 }
 inv.assumptions.push('Report banks use the verified NetworkDiagramStudio hardware layout. Empty configuration fields remain unknown.');return inv;
}
function parseVlans(value){
 const result=new Set();for(const item of Array.isArray(value)?value:[value])for(const token of String(item??'').split(/[,;\s]+/).filter(Boolean)){if(/^all$/i.test(token))continue;const match=/^(\d+)(?:-(\d+))?$/.exec(token);if(!match)throw Error('Invalid report VLAN value: '+token);const first=vlan(match[1]),last=vlan(match[2]||match[1]);if(first==null||last==null||last<first)throw Error('VLAN IDs must be from 1 to 4094.');for(let id=first;id<=last;id++)result.add(id);}return [...result].sort((a,b)=>a-b);
}
function describeDevices(inv){
 const devices=[];for(const member of unique(inv.groups.map(group=>group.device))){const groups=inv.groups.filter(group=>group.device===member),parent=groups.find(group=>!group.slot),kind=parent?'Switch':'Chassis';devices.push(normalizeDetail({id:member,label:kind+(unique(inv.groups.map(group=>group.device)).length>1?' / Member '+member:''),kind,model:parent?.product||inv.chassisModel}));for(const group of groups.filter(group=>group.slot))devices.push(normalizeDetail({id:member+'/'+group.slot,label:'Module '+group.slot,kind:'Module',parentId:member,groupId:group.id,model:group.product}));}return devices;
}
function reconcileRetainedHardware(inv,device){
 const composition=device.hardwareComposition||{},memberFields=own(composition,'stackMembers')||own(device,'stackMembers'),moduleFields=own(composition,'modules')||own(device,'modules'),memberRows=own(composition,'stackMembers')?rows(composition.stackMembers):rows(device.stackMembers),moduleRows=own(composition,'modules')?rows(composition.modules):rows(device.modules);
 const base=[...new Map(inv.groups.filter(group=>!group.slot&&!group.configuredInterfaces).map(group=>[group.device,group.product])).entries()],parents=base.length?base:inv.devices.filter(detail=>!detail.parentId&&detail.kind!=='Unassigned').map(detail=>[detail.id,inv.chassisModel||detail.model]),sameModel=(a,b)=>!!sku(a)&&!!sku(b)&&(sku(a).includes(sku(b))||sku(b).includes(sku(a))),signature=values=>values.sort().join('|');
 const wantedModel=device.model||device.sku,modelChanged=wantedModel&&!parents.some(([,model])=>sameModel(wantedModel,model)),desiredMembers=memberRows.length?memberRows:[{id:'1',model:wantedModel}],membersChanged=memberFields&&(desiredMembers.length!==parents.length||desiredMembers.some(member=>!parents.some(([id,model])=>id===String(member.id)&&sameModel(model,member.model))));
 const currentModules=unique([...inv.groups.filter(group=>group.slot&&!group.configuredInterfaces).map(group=>group.device+'/'+group.slot+'/'+sku(group.product)),...rows(inv.moduleInventory).map(row=>String(get(row,'device','1'))+'/'+get(row,'slot','')+'/'+sku(get(row,'sku','')))]),modulesChanged=moduleFields&&signature(currentModules)!==signature(moduleRows.map(row=>String(row.member||'1')+'/'+row.slot+'/'+sku(row.model)));
 if(!modelChanged&&!membersChanged&&!modulesChanged)return inv;
 const fresh=nativeTemplate(device)||faceplateTemplate(device);if(!fresh){inv.blockers.push('The explicit hardware selection has no verified report geometry. Review the model and installed modules.');inv.groups=[];inv.ports=[];return inv;}
 const matched=new Set();fresh.ports=fresh.ports.map(port=>{const old=inv.ports.find(candidate=>key(candidate.id)===key(port.id)||candidate.relatedInterfaces.some(alias=>key(alias)===key(port.id)));if(!old)return port;matched.add(old);return {...old,id:port.id,group:port.group,number:port.number,displayNumber:port.displayNumber||old.displayNumber,media:port.media};});
 const retainedDetails=inv.devices;fresh.devices=fresh.devices.map(detail=>{const old=retainedDetails.find(row=>row.id===detail.id);return old?{...old,...detail,...Object.fromEntries(['name','serialNumber','assetTag','notes','modelSelection','moduleSelections'].map(field=>[field,old[field]]))}:detail;});
 for(const old of retainedDetails.filter(row=>!fresh.devices.some(detail=>detail.id===row.id))){fresh.devices.push({...old,label:'Unassigned details / '+old.id,kind:'Unassigned'});fresh.assumptions.push('Saved details for '+old.id+' are unassigned to the current hardware and retained for review.');}
 return {...inv,...Object.fromEntries(['groups','ports','devices','chassisModel','chassisSlots','flexibleUplinks','topology','moduleInventory'].map(field=>[field,fresh[field]])),logicalInterfaces:[...inv.logicalInterfaces,...inv.ports.filter(port=>!matched.has(port)&&!fresh.ports.some(current=>key(current.id)===key(port.id))).map(port=>({...port,group:'Unplaced interfaces'}))],assumptions:unique([...inv.assumptions,...fresh.assumptions]),blockers:unique([...fresh.blockers])};
}
export function inventoryForDevice(device){
 const inv=device.switchportInventory?reconcileRetainedHardware(normalizeReportInventory(device.switchportInventory),device):nativeTemplate(device)||faceplateTemplate(device)||normalizeReportInventory({blockers:['Confirm a supported model and installed modules before drawing physical report sockets.']});
 // Retained inventories may contain the last report's snapshot annotations.
 // Remove those derived values before the currently enabled sources reapply.
 for(const port of [...inv.ports,...inv.logicalInterfaces]){if(/^Observed:/i.test(port.liveState))port.liveState='Unknown/Confirm before use';if(/^Observed:/i.test(port.connectedDevice))port.connectedDevice='Unknown/Confirm before use';if(/^Observed:/i.test(port.speed))port.speed='Not specified';port.notes=port.notes.filter(note=>!/^Supplementary \(/i.test(note));}
 inv.assumptions=inv.assumptions.filter(note=>!/^Supplementary observations from /i.test(note)&&!/^SVI .*: the browser address differs from retained native addresses\. Both are retained; review primary, secondary and IPv6 addresses before use\.$/.test(note));
 inv.hostname=reportText(device.name||inv.hostname,400);for(const name of ['vendor','os','firmware','reportModel'])if(device[name])inv[name]=reportText(device[name],400);
 if(own(device,'vlans')){const retained=inv.vlans;inv.vlans=rows(device.vlans).map(row=>({id:vlan(row.id),name:reportText(row.name),voice:own(row,'voice')?row.voice===true:retained.find(previous=>previous.id===vlan(row.id))?.voice===true})).filter(row=>row.id);}
 for(const field of ['blockers','assumptions'])inv[field]=unique([...inv[field],...rows(device[field==='blockers'?'reportBlockers':'reportAssumptions']).map(value=>reportText(value))]);
 for(const field of ['management','mirrors'])if(own(device,field))inv[field]=rows(device[field]).map(value=>reportText(value));
 // Browser records retain one address per VLAN. Supplement the native list
 // without discarding its IPv6 or secondary addresses.
 for(const row of rows(device.vlans).filter(row=>Array.isArray(row.addresses))){const id=key('vlan '+row.id);inv.svis=inv.svis.filter(svi=>key(svi.interface)!==id);for(const address of row.addresses)inv.svis.push({interface:'vlan '+row.id,address:configuredAddress(address)||reportText(address)});}
 const configuredSvis=rows(device.vlans).filter(row=>row.ip&&!Array.isArray(row.addresses)).map(row=>({interface:'vlan '+row.id,address:configuredAddress(row.ip)||reportText(row.ip)}));
 for(const svi of configuredSvis){
  const retained=inv.svis.filter(row=>key(row.interface)===key(svi.interface));
  if(retained.some(row=>row.address===svi.address))continue;
  if(retained.length)inv.assumptions.push('SVI '+reportText(svi.interface,200)+': the browser address differs from retained native addresses. Both are retained; review primary, secondary and IPv6 addresses before use.');
  inv.svis.push(svi);
 }
 for(const input of rows(device.ports)){
  const name=String(input.name||input.id||''),aliases=new Set([name,...rows(input.relatedInterfaces)].map(key)),targets=[...inv.ports,...inv.logicalInterfaces].filter(port=>[port.id,...port.relatedInterfaces].some(alias=>aliases.has(key(alias))));
  if(!targets.length){const record=normalizePort({id:name,group:'Logical interfaces'});inv.logicalInterfaces.push(record);targets.push(record);}
  for(const port of targets){
   if(port.id!==name&&rows(input.relatedInterfaces).some(alias=>key(alias)===key(port.id))){port.relatedInterfaces=unique([...port.relatedInterfaces,port.id]);port.id=name;}
   if(input.configurationResolved){port.configurationResolved=true;port.untaggedVlan=null;port.untaggedState='Unknown';port.taggedVlans=[];port.taggedVlanPolicy=null;port.voiceVlan=null;}
   for(const [field,target] of [['description','description'],['role','mode'],['speed','speed'],['connectedDevice','connectedDevice'],['usage','usage'],['lag','aggregate']])if(own(input,field)&&!(['speed','connectedDevice'].includes(field)&&/^Observed:/i.test(input[field])))port[target]=reportText(input[field]||(['description','aggregate'].includes(target)?'':'Unknown'));
   if(own(input,'native')){port.untaggedVlan=vlan(input.native);port.untaggedState=port.untaggedVlan!=null?'Known':/^none$/i.test(input.nativeState||'')||input.nativeTagged?'None':'Unknown';}
   if(own(input,'nativeState')&&!port.untaggedVlan)port.untaggedState=/^none$/i.test(input.nativeState)?'None':'Unknown';
   if(input.nativeTagged&&vlan(input.native)){port.untaggedVlan=null;port.untaggedState='None';}
   if(own(input,'tagged')){port.taggedVlans=parseVlans(input.tagged);port.taggedVlanPolicy=rows(input.tagged).some(value=>/^all$/i.test(value))||/^all$/i.test(input.tagged)?'All':null;if(port.taggedVlanPolicy)port.taggedVlans=inv.vlans.map(vlan=>vlan.id);}
   if(own(input,'taggedVlanPolicy'))port.taggedVlanPolicy=input.taggedVlanPolicy?reportText(input.taggedVlanPolicy):null;
   if(rows(input.allowedExcept).length){const excluded=parseVlans(input.allowedExcept);port.taggedVlanPolicy='All except '+excluded.join(', ');port.taggedVlans=inv.vlans.map(vlan=>vlan.id).filter(id=>!excluded.includes(id));}
   if(input.nativeTagged&&vlan(input.native)&&!own(input,'tagged')&&!own(input,'allowedExcept')&&!port.taggedVlans.includes(vlan(input.native)))port.taggedVlans.push(vlan(input.native));
   if(input.configuredSpeed)port.speed=reportText(input.configuredSpeed,100);
   if(own(input,'voice'))port.voiceVlan=vlan(input.voice);if(own(input,'disabled'))port.disabled=typeof input.disabled==='boolean'?input.disabled:null;else if(input.adminState||input.admin){const admin=reportText(input.adminState||input.admin,50);port.disabled=/^(down|disable|disabled|shutdown)$/i.test(admin)?true:/^(up|enable|enabled)$/i.test(admin)?false:null;}
   if(own(input,'state')&&!/^Observed:/i.test(input.state))port.liveState=reportText(input.state||'Unknown/Confirm before use');if(own(input,'stackLink'))port.stackLink=input.stackLink===true;
   if(own(input,'notes'))port.notes=unique([...port.notes,...rows(input.notes).map(note=>reportText(note)).filter(note=>!/^Supplementary \(/i.test(note))]);if(own(input,'relatedInterfaces'))port.relatedInterfaces=unique([...port.relatedInterfaces,...rows(input.relatedInterfaces).map(String)]);
   for(const address of [input.ip,input.address,...rows(input.addresses)].filter(Boolean)){const note='Address: '+reportText(address);if(!port.notes.includes(note))port.notes.push(note);}
  }
 }
 const lagIdentity=value=>key(value).replace(/^(lag|trk|portchannel|po|bond|bridgeaggregation|ae)/,'');for(const port of inv.ports.filter(port=>port.aggregate&&!port.configurationResolved)){const leader=inv.logicalInterfaces.find(candidate=>lagIdentity(candidate.id)===lagIdentity(port.aggregate));if(!leader)continue;if(!port.untaggedVlan&&port.untaggedState==='Unknown'){port.untaggedVlan=leader.untaggedVlan;port.untaggedState=leader.untaggedState;}if(!port.taggedVlans.length&&!port.taggedVlanPolicy){port.taggedVlans=[...leader.taggedVlans];port.taggedVlanPolicy=leader.taggedVlanPolicy;}port.voiceVlan??=leader.voiceVlan;}
 if(own(device,'routes'))inv.routes=rows(device.routes).map(configuredRouteText);
 const described=describeDevices(inv);if(!described.length&&inv.chassisSlots)described.push(normalizeDetail({id:'1',label:'Chassis',kind:'Chassis',model:device.model||inv.chassisModel}));for(const detail of described)if(!inv.devices.some(row=>row.id===detail.id))inv.devices.push(detail);const details=rows(device.reportDetails).map(normalizeDetail);
 for(const detail of details){const found=inv.devices.find(row=>key(row.id)===key(detail.id));if(!found){inv.assumptions.push('Saved details for '+detail.id+' are unassigned to the current hardware and retained for review.');inv.devices.push({...detail,label:'Unassigned details / '+detail.id,kind:'Unassigned'});continue;}for(const field of ['name','serialNumber','assetTag','notes','modelSelection'])found[field]=detail[field];found.moduleSelections=detail.moduleSelections;}
 if(!details.length&&inv.devices.filter(row=>!row.parentId).length===1){const parent=inv.devices.find(row=>!row.parentId);for(const field of ['serialNumber','assetTag','notes'])if(device[field])parent[field]=reportText(device[field]);}
 inv.assumptions=unique(inv.assumptions);inv.blockers=unique(inv.blockers);return inv;
}
export function validateInventory(inv){
 const errors=[...inv.blockers];if(inv.groups.length>48||inv.ports.length>2000||inv.logicalInterfaces.length>10000)errors.push('The inventory exceeds the supported report capacity.');
 if(new Set(inv.groups.map(group=>group.id)).size!==inv.groups.length)errors.push('Hardware group identities are duplicated.');
 if(new Set(inv.ports.map(port=>key(port.id))).size!==inv.ports.length)errors.push('Physical interface identities are duplicated.');
 for(const group of inv.groups){
  const expected=group.copper+group.optical,ports=inv.ports.filter(port=>port.group===group.id),sockets=group.socketLayout;
  if(ports.length!==expected||new Set(ports.map(port=>port.number)).size!==expected)errors.push(group.id+': the interface count differs from the confirmed hardware inventory.');
  if(!group.configuredInterfaces&&(!sockets.length||unique(sockets.map(socket=>socket.number)).length!==expected))errors.push(group.id+': physical socket coordinates are incomplete.');
  if(sockets.some(socket=>!Number.isFinite(socket.column)||socket.column<0||socket.column>10000||!Number.isInteger(socket.row)||socket.row<0||socket.row>15||socket.number<1||socket.number>expected))errors.push(group.id+': a physical socket coordinate is invalid.');
  if(new Set(sockets.map(socket=>socket.number+'|'+socket.suffix)).size!==sockets.length)errors.push(group.id+': a physical socket identity is duplicated.');
 }
 if(inv.ports.some(port=>!inv.groups.some(group=>group.id===port.group)))errors.push('A physical interface has no hardware group.');
 return {ok:errors.length===0,errors:unique(errors),warnings:[...inv.assumptions],physicalInterfaces:inv.ports.filter(port=>!inv.groups.find(group=>group.id===port.group)?.configuredInterfaces).length,configuredAlternatives:inv.ports.filter(port=>inv.groups.find(group=>group.id===port.group)?.configuredInterfaces).length,expectedInterfaces:inv.groups.reduce((sum,group)=>sum+group.copper+group.optical,0),generatedInterfaces:inv.ports.length};
}
export const csvHeaders=['Port','Description','Mode','Untagged VLAN','Untagged VLAN Name','Tagged VLANs','Voice VLAN','Trunk/LAG','Connected Device','Media','Configured Speed','Admin State','Ingress PVID','Configured Addresses','Aggregation Mode','Device ID','Device Name','Serial Number','Asset Tag','Device Details','Module ID','Module Name','Module Serial Number','Module Asset Tag','Module Details','Device Model','Module Model','Logical interfaces','Inventory basis'];
export const taggedText=port=>port.taggedVlanPolicy||port.taggedVlans.join(', ');
export function inventoryCsv(inv){
 const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
 const data=inv.ports.map(port=>{const group=inv.groups.find(group=>group.id===port.group),parent=inv.devices.find(row=>row.id===group?.device),moduleId=group?.slot?group.device+'/'+group.slot:'',module=inv.devices.find(row=>row.id===moduleId),notes=prefix=>unique(port.notes.filter(note=>note.startsWith(prefix)).map(note=>note.slice(prefix.length))).join(';');return [port.id,port.description,port.mode,port.untaggedVlan??port.untaggedState,inv.vlans.find(row=>row.id===port.untaggedVlan)?.name||'',taggedText(port),port.voiceVlan,port.aggregate,port.connectedDevice==='Unknown/Confirm before use'?'':port.connectedDevice,port.media,port.speed,port.disabled===true?'Disabled':port.disabled===false?'Enabled':'Unknown',notes('Configured ingress PVID: '),notes('Address: '),notes('Aggregation mode: '),group?.device,parent?.name,parent?.serialNumber,parent?.assetTag,parent?.notes,moduleId,module?.name,module?.serialNumber,module?.assetTag,module?.notes,parent?.model,module?.model,port.relatedInterfaces.join(';'),group?.configuredInterfaces?'Configured alternatives; installed sockets unconfirmed':'Confirmed physical ports'];});
 return '\uFEFF'+[csvHeaders,...data].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
}
export function technicianSummary(inv,supplementary=[]){
 const out=['NETWORK SUMMARY','Device: '+inv.hostname,'Platform: '+inv.os,'Firmware: '+inv.firmware,'Topology: '+inv.topology,'Model: '+(inv.reportModel||inv.chassisModel||unique(inv.groups.map(group=>group.product)).join(' / ')),'Inventory: '+inv.ports.length+' interfaces across '+inv.groups.length+' groups','Stack links: '+inv.ports.filter(port=>port.stackLink).length,'Aggregations: '+unique(inv.ports.map(port=>aggregateKey(port.aggregate)).filter(Boolean)).length];
 const section=(name,values)=>{if(values.length)out.push('',name.toUpperCase(),...values);};
 section('Device details',inv.devices.map(row=>[row.label,row.model,row.name,row.serialNumber?'S/N '+row.serialNumber:'',row.assetTag?'Asset '+row.assetTag:'',row.notes].filter(Boolean).join(' | ')));
 section('Inventory',inv.groups.map(group=>[group.id,group.product,(group.copper+group.optical)+(group.configuredInterfaces?' configured alternatives; installed sockets unconfirmed':' physical interfaces')].filter(Boolean).join(' | ')));section('VLANs',vlanIds(inv).map(id=>'VLAN '+id+' '+inv.vlans.filter(row=>row.id===id).map(row=>row.name+(row.voice?' (Voice)':'')).join(' / ')));section('Layer 3 interfaces',inv.svis.map(row=>row.interface+' | '+row.address));section('Routes',inv.routes);section('Management',inv.management);section('Mirrors',inv.mirrors);section('Assumptions',inv.assumptions);section('Validation blockers',inv.blockers);
 section('Supplementary observations',supplementary.flatMap(source=>rows(get(source,'observations',[])).map(row=>[get(source,'name',''),get(row,'category',''),get(row,'interface',''),get(row,'field',''),get(row,'value','')].map(value=>reportText(value)).join(' | '))));
 return out.join('\n')+'\n';
}
