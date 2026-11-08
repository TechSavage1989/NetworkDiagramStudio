import {cleanSwitchportSettings,reportRequest,buildReportPackage,inventoryForDevice,sharedReportPalette} from './reports/index.mjs';
import {exportPdf,exportPng} from './report-export.mjs';
import {zip} from './diagram/zip.mjs';
import {svgPage} from './diagram/scene.mjs';
import {pageFamily} from './page-options.mjs';
import {browserReportPackage} from './report-package.mjs';
import {importReportSupplementary} from './reports/supplementary.mjs';

const array=value=>Array.isArray(value)?value:value?[value]:[];
const filename=value=>String(value||'Report').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\.+$/,'').trim().slice(0,100)||'Report';
const readable=value=>typeof value==='string'?value:JSON.stringify(value,null,2);
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
export function reportTools({getProject,getPages,getActive,modal,el,field,button,actions,close,download,say,saveSettings,showPage,visio,editDevice,run=async action=>action()}){
 let latest=null,optionsDraft=null;
 const request=()=>reportRequest(getProject()),signature=()=>JSON.stringify(request());
 async function copyText(text){
  try{await navigator.clipboard.writeText(text);say('Report summary copied.');}
  catch{const body=modal('Report summary');const area=field(body,'Select and copy this summary',text,'multiline');area.readOnly=true;area.style.minHeight='320px';area.select();if(document.execCommand('copy')){say('Report summary copied.');close();}}
 }
 function options(){
  const draft=optionsDraft;optionsDraft=null;const project=getProject(),settings=cleanSwitchportSettings(draft?.settings||project.layout?.switchport),body=modal('Switchport reports','report-dialog'),devices=project.devices.filter(d=>!d.hidden&&['switch','firewall'].includes(d.kind));
  body.append(el('p','Build port charts, A4 sheets and technician inventories from the same devices and source evidence used in this drawing.','hint'));
  const updates=structuredClone(draft?.updates||{}),palette=structuredClone(settings.palette);
  const grid=el('div','','compact-fields');body.append(grid);const item=(title,value,options)=>{const cell=el('div','','compact-field');grid.append(cell);return field(cell,title,value,options);};
  const view=item('Preview',settings.reportType||'workspace',[['workspace','Shared A4 sheets'],['onePage','One A4 sheet per device'],['wall','Wall charts'],['booklet','A4 booklets with details']]),combined=item('Multi-device reports',settings.combined===false?'separate':'combined',[['combined','Include shared A4 sheets'],['separate','Separate device packages']]),title=item('Report title',settings.title||''),label=item('Export folder / file name',settings.outputLabel||project.name);
  title.maxLength=180;label.maxLength=100;
  let logo=settings.logoDataUrl||'';const logoRow=el('div','','report-logo-row'),logoInput=el('input');logoInput.type='file';logoInput.accept='.png,.jpg,.jpeg,.webp';const logoLabel=el('label','Report logo');logoInput.setAttribute('aria-label','Report logo');logoRow.append(logoLabel,logoInput);const logoPreview=el('img');logoPreview.alt='Report logo';logoPreview.hidden=!logo;logoPreview.src=logo;logoRow.append(logoPreview);body.append(logoRow);
  logoInput.onchange=async()=>{const file=logoInput.files[0];if(!file)return;try{if(!file.size||file.size>10_000_000)throw Error('Choose a PNG, JPEG or WebP logo under 10 MB.');const result=await new Promise((yes,no)=>{const r=new FileReader();r.onload=()=>yes(r.result);r.onerror=()=>no(Error('Could not read the logo.'));r.readAsDataURL(file);});if(!/^data:image\/(png|jpeg|webp);base64,/i.test(result))throw Error('Choose a PNG, JPEG or WebP logo.');const image=new Image();image.src=result;await image.decode();if(!image.width||!image.height||image.width*image.height>32_000_000)throw Error('Choose a logo under 32 million pixels.');const scale=Math.min(1,1024/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,0,0,canvas.width,canvas.height);logo=canvas.toDataURL('image/png');canvas.width=canvas.height=1;logoPreview.src=logo;logoPreview.hidden=false;}catch(error){say(error.message);logoInput.value='';}};
  button(logoRow,'Remove logo',()=>{logo='';logoPreview.hidden=true;logoPreview.removeAttribute('src');logoInput.value='';});
  const selected=new Set(settings.deviceIds.length?settings.deviceIds:devices.map(d=>d.id)),selection=el('div','','report-device-list'),head=el('div','','section-head');head.append(el('h3','Devices in this report'));const count=el('span','','hint');head.append(count);body.append(head);
  const checks=[];for(const d of devices){const row=el('div','','report-device-row'),pick=el('label'),input=el('input');input.type='checkbox';input.checked=selected.has(d.id);input.onchange=()=>{input.checked?selected.add(d.id):selected.delete(d.id);refreshCount();refreshPalette();};pick.append(input,el('span',d.name+' | '+(d.model||'Model unconfirmed')));row.append(pick);button(row,'Details',()=>{optionsDraft={settings:collect(settings.enabled),updates};editDevice(d,options);});selection.append(row);checks.push({input,id:d.id});}
  const refreshCount=()=>{count.textContent=checks.filter(v=>v.input.checked).length+' selected';};refreshCount();body.append(selection);
  const selectionActions=actions(body);button(selectionActions,'Select all',()=>{for(const row of checks){row.input.checked=true;selected.add(row.id);}refreshCount();refreshPalette();});button(selectionActions,'Clear',()=>{for(const row of checks){row.input.checked=false;selected.delete(row.id);}refreshCount();refreshPalette();});
  if(!devices.length)body.append(el('p','Import or add a switch or firewall to create a report.','hint'));
  const paletteSection=el('details'),paletteRows=el('div','','report-palette'),paletteError=el('p','','error');paletteSection.append(el('summary','VLAN and LAG colors'),el('p','VLAN colors are shared by VLAN ID. Use light fills to keep port symbols readable. Matching LAG names share a contrasting outline color.','hint'),paletteRows,paletteError);body.append(paletteSection);
  const paletteItems=()=>devices.filter(device=>selected.has(device.id)).map(device=>({id:device.id,inventory:inventoryForDevice({...device,...updates[device.id]})}));
  function refreshPalette(){
   paletteRows.replaceChildren();paletteError.textContent='';
   try{
    const items=paletteItems(),vlans=new Set(items.flatMap(item=>item.inventory.vlans.map(v=>v.id).concat(item.inventory.ports.flatMap(p=>[p.untaggedVlan,...p.taggedVlans,p.voiceVlan])))),lags=new Set(items.flatMap(item=>item.inventory.ports.map(p=>p.aggregate.trim().normalize('NFC').toUpperCase()).filter(Boolean)));
    const active=()=>({vlans:Object.fromEntries(Object.entries(palette.vlans).filter(([key])=>vlans.has(Number(key.replace(/^vlan:/,''))))),aggregates:Object.fromEntries(Object.entries(palette.aggregates).filter(([key])=>lags.has(key)))});
    const resolved=sharedReportPalette(items,active());
    for(const [kind,values] of [['vlans',resolved.vlans],['aggregates',resolved.aggregates]])for(const [identity,color] of Object.entries(values)){
     const key=kind==='vlans'?'vlan:'+identity:identity,row=el('label','','report-palette-row'),name=kind==='vlans'?'VLAN '+identity:'LAG / trunk '+identity;row.append(el('span',name));const input=el('input'),hex=el('input');input.type='color';input.value=color;input.setAttribute('aria-label',name+' color');hex.value=color;hex.maxLength=7;hex.setAttribute('aria-label',name+' HEX color');row.append(input,hex);paletteRows.append(row);
     const choose=value=>{const previous=palette[kind][key];try{if(!/^#[0-9a-f]{6}$/i.test(value))throw Error('Use a six-digit #RRGGBB color.');palette[kind][key]=value.toLowerCase();sharedReportPalette(items,active());input.value=hex.value=value.toLowerCase();hex.setCustomValidity('');paletteError.textContent='';}catch(error){if(previous===undefined)delete palette[kind][key];else palette[kind][key]=previous;input.value=previous||color;hex.value=value;hex.setCustomValidity(error.message);paletteError.textContent=error.message;}};
     input.oninput=()=>choose(input.value);hex.onchange=()=>choose(hex.value);
    }
   }catch(error){paletteError.textContent=error.message;}
  }
  button(actions(paletteSection),'Reset automatic colors',()=>{palette.vlans={};palette.aggregates={};for(const device of devices)if(device.switchportInventory){const inventory=structuredClone(device.switchportInventory);for(const key of ['vlanColorOverrides','aggregateColorOverrides','VlanColorOverrides','AggregateColorOverrides'])delete inventory[key];updates[device.id]={...updates[device.id],switchportInventory:inventory};}refreshPalette();});refreshPalette();
  const supplementary=el('details'),sourceRows=el('div','','report-source-list');supplementary.append(el('summary','Supplementary observations'),el('p','Add Auvik workbooks or command captures for the selected devices. Enable or disable each source independently. Observations remain separate from configured settings.','hint'),sourceRows);body.append(supplementary);
  function refreshSources(){sourceRows.replaceChildren();for(const device of devices){const sources=updates[device.id]?.reportSupplementary||device.reportSupplementary||[];for(const [index,source] of sources.entries()){const row=el('div','','report-source-row'),label=el('label'),check=el('input');check.type='checkbox';check.checked=source.enabled!==false;label.append(check,el('span',device.name+' | '+(source.name||source.Name||'Observation')+' ('+(source.observations||source.Observations||[]).length+')'));row.append(label);check.onchange=()=>{const next=structuredClone(updates[device.id]?.reportSupplementary||sources);next[index].enabled=check.checked;updates[device.id]={...updates[device.id],reportSupplementary:next};};button(row,'Remove',()=>{const next=structuredClone(updates[device.id]?.reportSupplementary||sources);next.splice(index,1);updates[device.id]={...updates[device.id],reportSupplementary:next};refreshSources();});sourceRows.append(row);}}}
  const sourceInput=el('input');sourceInput.type='file';sourceInput.multiple=true;sourceInput.accept='.xlsx,.csv,.txt,.log,.cli';sourceInput.setAttribute('aria-label','Add supplementary observations');supplementary.append(sourceInput);sourceInput.onchange=()=>run(async()=>{for(const file of sourceInput.files){const imported=await importReportSupplementary(file,devices.filter(device=>selected.has(device.id)));for(const {deviceId,source} of imported){const device=devices.find(d=>d.id===deviceId),sources=[...(updates[deviceId]?.reportSupplementary||device.reportSupplementary||[])];if(sources.length>=20)throw Error('Each device supports up to 20 supplementary sources. Remove an old source first.');sources.push({...source,enabled:true});updates[deviceId]={...updates[deviceId],reportSupplementary:sources};}}sourceInput.value='';refreshSources();say('Supplementary observations added to the report draft. Build reports to apply them.');});refreshSources();
  function collect(enabled=true){return {...settings,enabled,deviceIds:checks.filter(row=>row.input.checked).map(row=>row.id),reportType:view.value,combined:combined.value==='combined',title:title.value.trim(),showWorkspaceTitle:!!title.value.trim(),outputLabel:label.value.trim(),logoDataUrl:logo,palette};}
  const footer=actions(body),save=async()=>{const invalid=body.querySelector('input:invalid');if(invalid){invalid.reportValidity();throw Error('Correct the report options before building.');}const next=collect();if(!next.deviceIds.length)throw Error('Choose at least one device for the report.');saveSettings(next,updates);optionsDraft=null;close();showPage('switchports');say('Switchport reports built. Export a package for charts, PDF booklets and technician files.');};
  button(footer,'Build reports',save,'primary');button(footer,'Export package',async()=>{await save();await exportPackage();});if(settings.enabled)button(footer,'Hide report pages',()=>{saveSettings({...settings,enabled:false});optionsDraft=null;close();});button(footer,'Cancel',()=>{optionsDraft=null;close();});
 }
 async function exportPackage(){
  const project=getProject(),input=request();if(!input.items?.length)throw Error('Choose at least one switch or firewall in Switchport reports.');
  const accepted=signature();say('Building switchport report package...');await yieldFrame();
  if(globalThis.NDSDesktop?.report){
   const result=await globalThis.NDSDesktop.report('export',{request:input});if(result.cancelled){say('Report export cancelled.');return;}
   const completed=(result.items||[]).filter(item=>item.success),failed=(result.items||[]).filter(item=>!item.success),summary=result.summary||result.items.map(item=>item.name+': '+(item.success?'complete':item.error)).join('\n');
   if(completed.length)latest={signature:accepted,result,summary};
   exportMenu();
   if(!completed.length)throw Error('No report could be completed. Validation files were saved in '+result.outputDirectory+'. '+failed.map(item=>item.error).filter(Boolean).join(' '));
   say(completed.length+' report package(s) saved to '+result.outputDirectory+'.'+(failed.length?' '+failed.length+' device(s) need review; see their validation reports.':''));return;
  }
  const result=await browserReportPackage(project,{png:exportPng,pdf:exportPdf,progress:say});
  download(zip(result.parts,'application/zip'),filename(input.outputLabel||project.name)+'-switchport-reports.zip','application/zip');
  if(result.success)latest={signature:accepted,summary:result.summary,result:{files:Object.keys(result.parts)}};
  say(result.complete?'Switchport report package downloaded.':'Report files downloaded with validation notes. Some formats or devices need review.');
 }

 function exportMenu(){
  const project=getProject(),pages=getPages(),active=getActive(),body=modal('Export documentation','export-dialog');
  const scope=field(body,'Drawing pages','current',[['current','Current page'],['family','Current page group'],['all','All drawing pages']]);
  const selected=()=>scope.value==='all'?pages:scope.value==='family'?pages.filter(p=>(p.family||pageFamily(p.name))===(active?.family||pageFamily(active?.name||''))):active?[active]:[];
  const visual=el('div','','export-grid');body.append(visual);
  button(visual,'Visio drawing',()=>visio(selected()), 'primary');
  button(visual,'Vector PDF',async()=>{const chosen=selected();download(await exportPdf(chosen,{title:project.name}),filename(project.name)+(chosen.length===1?'-'+filename(chosen[0].displayName||chosen[0].name):'')+'.pdf','application/pdf');say('Vector PDF downloaded.');});
  button(visual,'PNG images - 300 dpi',async()=>{const chosen=selected();if(chosen.length===1)download(await exportPng(chosen[0]),filename(project.name)+'-'+filename(chosen[0].name)+'.png','image/png');else{const parts={};for(const [n,page] of chosen.entries()){say('Rendering image '+(n+1)+' of '+chosen.length+'...');parts[String(n+1).padStart(2,'0')+'-'+filename(page.name)+'.png']=await exportPng(page);await yieldFrame();}download(zip(parts,'application/zip'),filename(project.name)+'-images.zip','application/zip');}say('PNG export downloaded.');});
  button(visual,'SVG pages',()=>{const chosen=selected();if(chosen.length===1)download(chosen[0].svg||svgPage(chosen[0]),filename(project.name)+'-'+filename(chosen[0].name)+'.svg','image/svg+xml');else download(zip(Object.fromEntries(chosen.map((page,n)=>[String(n+1).padStart(2,'0')+'-'+filename(page.name)+'.svg',page.svg||svgPage(page)])),'application/zip'),filename(project.name)+'-svg.zip','application/zip');say('SVG export downloaded.');});
  body.append(el('h3','Switchport report package'),el('p','For each device: wall chart, A4 PNG, one-page PDF, booklet PDF, port CSV, inventory JSON, technician summary and validation report. Shared sheets use one VLAN and symbol key.','hint'));
  const reports=actions(body);button(reports,'Export switchport package',exportPackage,'primary');button(reports,'Report options',options);button(reports,'Copy report summary',()=>copyText(readable(buildReportPackage(project).summary)));
  if(latest){const stale=latest.signature!==signature(),card=el('section','','latest-report');card.append(el('h3','Latest export'),el('p',stale?'The project has changed since this export. Build a new package to include those changes.':'This export matches the current report settings.','hint'));
   if(latest.result.outputDirectory){card.append(el('p',latest.result.outputDirectory,'mono'));button(actions(card),'Open folder',()=>globalThis.NDSDesktop.report('open',{path:latest.result.outputDirectory}));const files=latest.result.files||[],pick=pattern=>files.map(f=>typeof f==='string'?f:f.path).find(p=>pattern.test(p));for(const [title,pattern] of [['Open chart',/wall-chart\.png$/i],['Open PDF',/(?:workspace-a4-diagrams|combined-diagrams|a4-booklet)\.pdf$/i]]){const path=pick(pattern);if(path)button(actions(card),title,()=>globalThis.NDSDesktop.report('open',{path}));}}
   button(actions(card),'Copy export summary',()=>copyText(readable(latest.summary)));body.append(card);
  }
 }
 return {options,exportMenu,exportPackage,reset(){latest=null;optionsDraft=null;}};
}
