import {cleanSwitchportSettings,reportRequest,inventoryForDevice,normalizeReportInventory,validateInventory,inventoryCsv,technicianSummary,reportFolder,reportText} from './model.mjs';
import {sharedReportPalette} from './palette.mjs';
import {reportDiagram,workspaceDiagrams,inventoryPages,blockedReport,validateReportScene,ReportCapacityError,numberReportPages} from './scene.mjs';
import {reportPageLabel,reportFileStem} from './paper.mjs';
export {cleanSwitchportSettings,reportRequest,inventoryForDevice,normalizeReportInventory,validateInventory,inventoryCsv,technicianSummary,reportFolder,reportModelChoice} from './model.mjs';
export {sharedReportPalette,aggregateKey,validateVlanColor,nativeFill,markerVlans,vlanIds,colorDifference} from './palette.mjs';
export {ReportCapacityError,validateReportScene} from './scene.mjs';

const rows=value=>Array.isArray(value)?value:[];
const get=(object,key)=>object?.[key]??Object.entries(object||{}).find(([name])=>name.toLowerCase()===key.toLowerCase())?.[1];
const key=value=>String(value??'').toLowerCase().replace(/[\s-]/g,'').replace(/^gigabitethernet(?=\d)/,'gi').replace(/^tengigabitethernet(?=\d)/,'te').replace(/^ethernet(?=\d)/,'eth');
function applyObservations(inventory,sources){
 if(sources.length>20)throw Error('A report supports at most 20 supplementary sources per device.');
 for(const source of sources){const observations=rows(get(source,'observations'));if(observations.length>5000)throw Error('A supplementary source exceeds 5,000 observations.');
  for(const port of inventory.ports){
   const matching=observations.filter(row=>key(get(row,'interface'))===key(port.id)),field=(category,name)=>matching.find(row=>get(row,'category')===category&&get(row,'field')===name),neighbor=field('Neighbor','Connected device'),state=field('Interface','Operational status'),speed=field('Interface','Speed');
   if(neighbor&&port.connectedDevice==='Unknown/Confirm before use')port.connectedDevice='Observed: '+reportText(get(neighbor,'value'));
   if(state&&port.liveState==='Unknown/Confirm before use')port.liveState='Observed: '+reportText(get(state,'value'));
   if(speed&&port.speed==='Not specified')port.speed='Observed: '+reportText(get(speed,'value'));
   for(const row of matching.filter(row=>['Neighbor','DHCP relay','IP interface'].includes(get(row,'category'))).slice(0,4))port.notes.push('Supplementary ('+reportText(get(source,'name'))+'): '+reportText(get(row,'field'))+': '+reportText(get(row,'value')));
  }
  inventory.assumptions.push('Supplementary observations from '+reportText(get(source,'name'))+' ('+reportText(get(source,'kind'))+', '+observations.length+' records) are snapshots, not authoritative configuration or physical connectivity.');
 }
}
function prepare(project,selectedIds){
 const request=reportRequest(project,selectedIds),folders=new Map(),items=request.items.map(input=>{
  let inventory,validation;try{inventory=inventoryForDevice(input.device);applyObservations(inventory,input.supplementary);validation=validateInventory(inventory);}catch(error){inventory=normalizeReportInventory({hostname:input.device.name||input.name,blockers:[error.message]});validation=validateInventory(inventory);}
  const stem=reportFolder(inventory.hostname||input.name),seen=folders.get(stem)||0;folders.set(stem,seen+1);
  return {...input,inventory,validation,folder:stem+(seen?' ('+(seen+1)+')':'')};
 });
 const palette=sharedReportPalette(items,request.palette);for(const item of items){item.inventory.vlanColorOverrides=Object.fromEntries(Object.entries(palette.vlans).filter(([id])=>item.inventory.vlans.some(vlan=>vlan.id===+id)||item.inventory.ports.some(port=>port.untaggedVlan===+id||port.voiceVlan===+id||port.taggedVlans.includes(+id))));item.inventory.aggregateColorOverrides=Object.fromEntries(item.inventory.ports.filter(port=>port.aggregate).map(port=>[port.aggregate,palette.aggregates[port.aggregate.trim().normalize('NFC').toUpperCase()]]));item.validation.warnings.push(...palette.warnings);}
 return {request,items,palette};
}
function assertScenes(pages){for(const page of pages){const errors=validateReportScene(page);if(errors.length)throw new ReportCapacityError(errors.join(' '),{page:page.name});}return pages;}
function diagramPages(item,palette,request){
 const wall=[],onePage=[];let capacityError='';
 if(!item.validation.ok)return {wall,onePage,diagrams:[],capacityError:item.validation.errors.join(' ')};
 try{wall.push(...assertScenes([reportDiagram(item,palette,request,{wall:true})]));}catch(error){item.validation.errors.push(error.message);item.validation.ok=false;return {wall,onePage,diagrams:[],capacityError:error.message};}
 try{onePage.push(...assertScenes([reportDiagram(item,palette,request)]));}catch(error){capacityError=error.message;}
 let diagrams=onePage;
 if(!diagrams.length)try{diagrams=assertScenes(workspaceDiagrams([item],palette,{...request,title:item.inventory.hostname}));}catch(error){capacityError+=' '+error.message;diagrams=[blockedReport(item,palette,request,[error.message])];}
 return {wall,onePage,diagrams,capacityError};
}
function validationText(item,palette,pages,capacityError=''){
 const size=reportPageLabel(item.paper),v=item.validation,out=['VALIDATION REPORT','RENDER_BLOCKED='+(!v.ok?'TRUE':'FALSE'),'A4_ONE_PAGE_BLOCKED='+(size==='A4 landscape'&&capacityError?'TRUE':'FALSE'),'ONE_PAGE_BLOCKED='+(capacityError?'TRUE':'FALSE'),'Expected interface count: '+v.expectedInterfaces,'Generated interface count: '+v.generatedInterfaces,'Confirmed physical interfaces: '+v.physicalInterfaces,'Configured alternatives: '+v.configuredAlternatives,'Count delta: '+(v.generatedInterfaces-v.expectedInterfaces),'CSV data row count: '+item.inventory.ports.length,'Paper: '+size,'Geometry: confirmed hardware banks, module/member identities, socket rows and complete values are retained.','Port numbers are outside sockets, using one readable role size. Native VLAN fills, tagged circles, voice diamonds, LAG outlines, stack links and administrative markers remain editable.','Page, text, marker and socket checks: '+(v.ok?'PASS':'BLOCKED'),'Booklet pages: '+pages.length,'VLAN palette: one color per VLAN ID across the selected workspace. LAG colors use trimmed, case-insensitive labels.'];
 if(palette.minimumVlanDifference!=null)out.push('Closest VLAN color CIEDE2000 difference: '+palette.minimumVlanDifference.toFixed(3));
 for(const [id,color] of Object.entries(item.inventory.vlanColorOverrides||{}))out.push('VLAN '+id+': '+color);for(const [name,color] of Object.entries(item.inventory.aggregateColorOverrides||{}))out.push('Outline '+name+': '+color);
 if(capacityError)out.push('PAPER CAPACITY: '+capacityError);for(const warning of v.warnings)out.push('NOTE: '+warning);for(const error of v.errors)out.push('BLOCKER: '+error);return out.join('\n')+'\n';
}
export function buildReportPackage(project,selectedIds){
 const prepared=prepare(project,selectedIds),{request,palette}=prepared;
 const sheetStem=reportFileStem(request.paper);
 const items=prepared.items.map(item=>{
  const charts=diagramPages(item,palette,request);let details=[];try{details=assertScenes(inventoryPages(item,palette,request));}catch(error){item.validation.errors.push(error.message);item.validation.ok=false;}
  const booklet=numberReportPages([...(charts.diagrams.length?charts.diagrams:[blockedReport(item,palette,request,item.validation.errors)]),...details]),pages={wall:charts.wall,onePage:charts.onePage,booklet};
  return {...item,pages,...pages,capacityError:charts.capacityError,csv:inventoryCsv(item.inventory),summary:technicianSummary(item.inventory,item.supplementary),validationText:validationText({...item,paper:request.paper},palette,booklet,charts.capacityError),inventoryJson:JSON.stringify(item.inventory,null,2),filenames:['wall-chart.png',sheetStem+'-one-page.png',sheetStem+'-one-page.pdf',sheetStem+'-booklet.pdf','port-map.csv','inventory.json','technician-summary.txt','validation-report.txt']};
 });
 let shared=[],combinedError='';if(request.combined&&items.some(item=>item.validation.ok))try{shared=assertScenes(workspaceDiagrams(items,palette,request));}catch(error){combinedError=error.message;}
 const details=items.flatMap(item=>item.pages.booklet.filter(page=>!['onePage','workspace','validation'].includes(page.role))),combined={pages:shared,diagrams:shared,booklet:numberReportPages([...shared,...details]),validation:{ok:!combinedError,errors:combinedError?[combinedError]:[],warnings:[...palette.warnings]},validationText:combinedError?'RENDER_BLOCKED=TRUE\n'+combinedError+'\n':'RENDER_BLOCKED=FALSE\nShared '+reportPageLabel(request.paper)+' sheets retain complete configuration blocks where they fit, then continue at module/member boundaries.\n'+palette.warnings.join('\n')+'\n'};
 return {items,combined,palette,request,outputLabel:request.outputLabel,title:request.title,summary:items.map(item=>item.summary).join('\n'),validation:{ok:items.every(item=>item.validation.ok)&&!combinedError,errors:[...items.flatMap(item=>item.validation.errors),...(combinedError?[combinedError]:[])]}};
}
// Port maps in the drawing set use the switchport builder's sheet for each
// switch whose hardware it confirms, on the requested paper; a switch it
// cannot draw keeps the faceplate port map.
export function portMapSheets(project,devices,paper,artwork=new Map()){
 const ids=devices.map(device=>device.id),sheets=new Map();if(!ids.length)return sheets;
 let prepared;try{prepared=prepare({...project,layout:{...project.layout,switchport:{...(project.layout?.switchport||{}),enabled:true,deviceIds:ids}}},ids);}catch{return sheets;}
 const {items,palette}=prepared,request={...prepared.request,paper,fill:!!paper?.fill,dynamicCanvas:true};
 for(const item of items){
  if(!item.validation.ok)continue;
  // Port maps paint the builder sheet in the device's core-diagram colors.
  if(artwork.get(item.id))item.artwork=artwork.get(item.id);
  let pages=null;try{pages=assertScenes([reportDiagram(item,palette,request)]);}catch{try{pages=assertScenes(workspaceDiagrams([item],palette,{...request,title:item.inventory.hostname}));}catch{pages=null;}}
  if(pages?.length){for(const page of pages)page.printPaper=project.layout?.pageSetup?.printPaper||null;sheets.set(item.id,pages);}
 }
 return sheets;
}
export function buildSwitchportReports(project){
 const settings=cleanSwitchportSettings(project.layout?.switchport);if(!settings.enabled)return [];
 const {items,palette,request}=prepare(project);if(!items.length)return [];
 const pages=[];
 if(settings.reportType==='workspace'&&settings.combined){
  try{pages.push(...assertScenes(workspaceDiagrams(items,palette,request)));}catch(error){const owner=items.find(item=>item.id===error.deviceId)||items[0];pages.push(blockedReport(owner,palette,request,[error.message]));}
  for(const item of items.filter(item=>!item.validation.ok))pages.push(blockedReport(item,palette,request,item.validation.errors));
 }else for(const item of items){
  if(!item.validation.ok){pages.push(blockedReport(item,palette,request,item.validation.errors));if(settings.reportType==='booklet')pages.push(...assertScenes(inventoryPages(item,palette,request)));continue;}
  if(settings.reportType==='booklet'){const charts=diagramPages(item,palette,request);pages.push(...charts.diagrams,...assertScenes(inventoryPages(item,palette,request)));}
  else try{pages.push(...assertScenes([reportDiagram(item,palette,request,{wall:settings.reportType==='wall'})]));}catch(error){pages.push(blockedReport(item,palette,request,[error.message]));}
 }
 return settings.reportType==='booklet'?numberReportPages(pages):pages;
}
