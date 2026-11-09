import {physicalLink} from './physical-links.mjs';
import {installFormControls} from './form-controls.mjs';
import {connectionLayoutEditor} from './connection-layout-ui.mjs';
import {automaticDeviceGap} from './compact-layout.mjs';
import {importSwitchportWorkspace,enrichSwitchportSources} from './switchport-import.mjs';
import {reportDetailFields} from './report-details.mjs';
import {reportTools} from './report-ui.mjs';
import {switchportCatalog} from './reports/catalog-data.mjs';
import {pageLayoutEditor} from './page-layout-ui.mjs';
import {arrangeCoreLayout,pageArrangement} from './core-arrangement.mjs';
import {displayPageName,unpresentPatch,cleanPresentation,presentation} from './presentation.mjs';
import {withoutDevices} from './device-actions.mjs';
import {desktopUpdates} from './desktop-updates.mjs';
import {deviceMacs,inputMacAddresses} from './device-details.mjs';
import {inlineTextEditor} from './inline-text.mjs';
import {ProjectHistory} from './history.mjs';
import {cleanSnap,snapPoint,snapBoxes,boxSelected,dragAxis} from './snapping.mjs';
import {diagramViewport} from './viewport.mjs';
import {arrangeAnchors,arrangeBoxes} from './arrange.mjs';
import {filterStencilMasters} from './stencil-search.mjs';
import {drawingObjects,drawingBounds,moveDrawingItems,movementOffsets,placeDrawingDevices,scaleDrawingItems,cleanDrawingEdits} from './drawing-edits.mjs';
import {addCableBends,moveCablePoint,removeCablePoint,validCable} from './cable-edit.mjs';
import {cableControls} from './cable-controls.mjs';
import {movementStep,selectedInBox,moveAnchors} from './point-tools.mjs';
import {colorPicker} from './color-picker.mjs';
import {changeLinkStyle,linkDefaults} from './link-styles.mjs';
import {legendConnections,commonConnectionDetails,changeLegendConnections} from './legend-connections.mjs';
import {cleanPageNumbers,pageNumber,cleanPageSetup,cleanPaper,paperSizes,pageFamilies,pageFamily,pageGeometry,printPageStyles,paperDimensions} from './page-options.mjs';
import {connectionPorts,prepareConnection,sameConnection} from './connection-edit.mjs';
import {cableTypes,linkSpeeds,connectionValue,connectionChoices,cleanConnectionDetails,customConnectionValue,connectionMediaInfo} from './connection-types.mjs';
import {deviceKinds,deviceKindOptions,deviceKindLabel} from './device-types.mjs';
import {hardwareComposition} from './hardware-composition.mjs';
import {intersects,pathCrossesText} from './diagram/labels.mjs';
import {relatedConnectionItems,nearestOnCable,positionOnCable,describeCableEnds,labelPositionRelativeToCable} from './connection-selection.mjs';
import {importFiles,mergeModels,deviceId,hardwareCatalog,findDeviceIdentity} from './imports/index.mjs';
import {endpointHardwareCatalog,matchEndpointHardware} from './imports/hardware.mjs';
import {matchesHardware,modelKey} from './hardware-match.mjs';
import {buildPages,exportVisio,exportStencil} from './diagram/index.mjs';
import {openVisioCatalog,loadImageStencil} from './stencils.mjs';
import {stencilFiles,visioFile,filePath,droppedFiles} from './stencil-files.mjs';
import {cleanNativeArt} from './native-art.mjs';
import {sampleSite} from './sample.mjs';
import {coreLinkKey,orderedDevices,moveDevice,moveStep,cleanLayout} from './layout.mjs';
import {categories,readSources,ensureEvidence,captureEdits,composeEvidence,reopenEvidence} from './evidence.mjs';

// Keep browser navigation/debug actions out of the drawing workspace.
installFormControls();
document.addEventListener('contextmenu',handleEditorContextMenu);
const $=id=>document.getElementById(id);
const viewport=diagramViewport($('canvas'),{out:$('zoom-out'),inside:$('zoom-in'),fit:$('zoom-fit'),percent:$('zoom-level'),canSelectCable:()=>editDrawing&&drawingReady&&!besidePick&&!inlineSession&&!$('dialog').open,canHighlightCable:()=>drawingReady&&!besidePick&&!inlineSession&&!$('dialog').open,onDevice:id=>{const d=project.devices.find(d=>d.id===id);if(d)task(()=>deviceStencil(d));},onShape:(key,id,e,target)=>{
 if(editDrawing){
  if(snapLabelPick){snapSelectedLabelAtClick(key,e);return true;}
  if(besidePick){pickBesideReference(key);return true;}
  const socket=target.closest('[data-port-name]'),owner=socket?.closest('[data-device-id]');
  if(socket&&owner){
   const related=relatedConnectionItems(pages[active],{sourceId:owner.getAttribute('data-device-id'),portName:socket.getAttribute('data-port-name')});
   if(related.paths.length){selectDrawingItem(related.paths[0].editKey);return true;}
  }
  if(cableControlClick(key,e,target))return true;
  selectDrawingItem(key,e.shiftKey||e.ctrlKey||e.metaKey);return true;
 }
 return false;
},onBeforeInteraction:commitInlineEdit,onMoveStart:startDrawingMove,onBoxStart:startDrawingBox,onBackground:e=>{if(editDrawing&&!besidePick&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){drawingSelection.clear();syncDrawingSelection();}},onEdit:(key,e,target=e.target)=>{if(!besidePick&&!target.closest('.cable-controls'))editOnDoubleClick(key);}});
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const emptyProject=()=>({name:'Untitled site',devices:[],links:[],warnings:[],stencils:{},optics:{},layout:{order:[],corePages:[],coreExclude:[],includeAPs:false}});
let discoveredStencils=[],stencilResults=[],stencilDevice=null,modalGeneration=0;const stencilIndexes=new Map(),openCatalogs=new Map();
let project=emptyProject(),pages=[],active=0,dirty=false,working=false,evidenceSnapshot=null,editDrawing=false,drawingReady=false,displayedProject=null;
const pageCache=new Map(),buildDrawing=(source=scoped(),options={})=>buildPages(source,{...options,cache:pageCache});
const drawingSelection=new Set(),projectHistory=new ProjectHistory(project);
let modalHistoryScope=null,modalHistoryRefresh=null,inlineCancel=null,inlineSession=null;
let cablePoint=-1,snapLabelPick=null,contextMenu=null;
const snapshot=()=>JSON.parse(JSON.stringify({devices:project.devices,links:project.links,warnings:project.warnings}));
const modelKinds=deviceKinds;
const object=x=>x && typeof x==='object'&&!Array.isArray(x);
const safeKey=s=>typeof s==='string'&&s.length>0&&s.length<=300&&!['__proto__','constructor','prototype'].includes(s);
const say=message=>{$('feedback').textContent=message;$('feedback').title=message;};
const reports=reportTools({getProject:()=>scoped(),getPages:()=>pages,getActive:()=>pages[active],modal,el,field,button,actions,close,download,say,editDevice,run:task,
 saveSettings(settings,updates={}){const before={layout:project.layout,devices:project.devices};project.layout={...before.layout,switchport:settings};project.devices=project.devices.map(device=>updates[device.id]?{...device,...updates[device.id]}:device);try{const prepared=validateDrawing();perform('reports',prepared);}catch(error){Object.assign(project,before);throw error;}},
 showPage(family){const index=pages.findIndex(page=>familyOf(page)===family);if(index>=0){active=index;draw(pages);}},
 async visio(selected=pages){download(await exportVisio(scoped(),selected),slug(project.name)+'.vsdx');say('Editable Visio drawing exported.');}});
desktopUpdates({help:$('desktop-help'),modal});
function download(content,name,mime='application/json'){
  const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type:mime}));
  const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);
}
const slug=s=>String(s||'Network').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,90)||'Network';
function busy(on){working=on;window.NDSDesktop?.setBusy(on);for(const id of ['new','import','paste','open','export','export-menu','switchport-reports','drawing-organize','add-device','hardware','sample','print','svg'])if($(id))$(id).disabled=on||(['export','export-menu','print','svg'].includes(id)&&(!pages.length||!drawingReady))||(id==='drawing-organize'&&!pages[active]?.items.some(i=>i.type==='path'));
 // The Arrange control depends on the active page; recompute it after busy work.
 if($('drawing-arrange'))$('drawing-arrange').disabled=on||!(pages[active]?.coreDeviceIds&&pages[active]?.dynamic);}
async function task(action){if(working)return;busy(true);try{await action();}catch(e){say(e?.message||'The operation failed.');if($('dialog').open){let node=$('dialog-body').querySelector('.error');if(!node){node=el('p','','error');$('dialog-body').prepend(node);}node.textContent=e?.message||'The operation failed.';}}finally{busy(false);}}
function checkDiscard(){return !dirty||confirm('Discard the changes to this project?');}
function close(){modalHistoryScope=null;modalHistoryRefresh=null;modalGeneration++;if($('dialog').open)$('dialog').close();}
function commitInlineEdit(){if(!inlineSession)return true;if(!inlineSession.connected){inlineSession.cancel();return true;}return inlineSession.save();}
function modal(title,className=''){cancelBesidePick();if(!commitInlineEdit())throw Error('Finish editing the diagram text first.');modalHistoryScope=null;modalHistoryRefresh=null;modalGeneration++;$('dialog').className=className;$('dialog-title').textContent=title;const body=$('dialog-body');body.className='';body.replaceChildren();if(!$('dialog').open)$('dialog').showModal();return body;}
function button(parent,label,fn,cls=''){const b=el('button',label,cls);b.type='button';b.onclick=()=>task(fn);parent.append(b);return b;}
function line(parent,...nodes){const row=el('div','','itemrow');row.append(...nodes);parent.append(row);return row;}
function actions(parent){const n=el('div','','actions');parent.append(n);return n;}
let fieldCount=0;
function field(parent,labelText,value='',opts=null){
 const label=el('label',labelText);let input;
 if(Array.isArray(opts)){input=el('select');for(const o of opts){const [val,name]=Array.isArray(o)?o:[o,o];const n=el('option',String(name));n.value=val;input.append(n);}input.value=value;}
 else{input=el(opts==='multiline'?'textarea':'input');input.value=value??'';if(opts==='multiline')input.className='mono';}
 input.id='setting-'+(++fieldCount);label.htmlFor=input.id;parent.append(label,input);return input;
}
function perform(scope='project',prepared){captureEdits(project,evidenceSnapshot);if(project.evidence)evidenceSnapshot=snapshot();projectHistory.record(project,scope);dirty=projectHistory.dirty;draw(prepared);}
function resetDrawingHistory(){inlineCancel?.();drawingSelection.clear();projectHistory.reset(project);cablePoint=-1;snapLabelPick=null;pageCache.clear();reports.reset();}
function syncDrawingSelection(){
 const svg=$('canvas').querySelector('svg');if(svg)for(const n of svg.querySelectorAll('.diagram-selection,.cable-controls'))n.remove();
 const objects=pages[active]?drawingObjects(pages[active]):[],known=new Set(objects.map(o=>o.editKey));for(const key of drawingSelection)if(!known.has(key))drawingSelection.delete(key);
 if(svg){
  for(const element of svg.querySelectorAll('.linked-association'))element.classList.remove('linked-association');
  for(const element of svg.querySelectorAll('circle.linked-port-marker'))element.remove();
  const current=pages[active],paths=new Map(),labels=new Map(),points=new Map();
  for(const key of drawingSelection){
   const found=relatedConnectionItems(current,{key});
   for(const p of found.paths)paths.set(p.editKey,p);
   for(const label of found.labels)labels.set(label.editKey,label);
   for(const end of found.endpoints)points.set(end.x+','+end.y,end);
  }
  const associated=new Set([...paths.keys(),...labels.keys()]);
  if(associated.size)for(const element of svg.querySelectorAll('[data-drawing-key]'))if(associated.has(element.getAttribute('data-drawing-key')))element.classList.add('linked-association');
  for(const end of points.values()){
   const marker=document.createElementNS('http://www.w3.org/2000/svg','circle');
   marker.setAttribute('class','linked-port-marker');marker.setAttribute('cx',String(end.x));marker.setAttribute('cy',String(end.y));
   marker.setAttribute('r','8');svg.append(marker);
  }
 }

 if(svg&&editDrawing)for(const item of objects.filter(o=>drawingSelection.has(o.editKey))){const b=drawingBounds(item);if(!b)continue;const mark=document.createElementNS('http://www.w3.org/2000/svg','rect');mark.setAttribute('class','diagram-selection');for(const [k,v] of Object.entries({x:b.x-3,y:b.y-3,width:Math.max(6,b.w)+6,height:Math.max(6,b.h)+6}))mark.setAttribute(k,String(v));svg.append(mark);}
 $('drawing-tools').hidden=!editDrawing;$('drawing-selection').textContent=drawingSelection.size+' selected';$('drawing-properties').disabled=drawingSelection.size!==1;$('drawing-clear').disabled=!drawingSelection.size;$('drawing-organize').disabled=working||!pages[active]?.items.some(i=>i.type==='path');const arrangeable=!!pages[active]?.coreDeviceIds&&!!pages[active]?.dynamic;$('drawing-arrange').disabled=working||!arrangeable;$('drawing-arrange').parentElement.title=arrangeable?'Re-arrange the devices on this network page. The saved device order is kept: down each column, then across.':'Arrangements apply to network diagram pages that use Dynamic / Fit all paper.';if(pages[active]?.coreDeviceIds)$('drawing-arrange').value=pageArrangement(project,pages[active]);
 for(const b of $('drawing-tools').querySelectorAll('[data-align]'))b.disabled=drawingSelection.size<(b.dataset.align.startsWith('space')?3:2);$('drawing-undo').disabled=!projectHistory.canUndo();$('drawing-redo').disabled=!projectHistory.canRedo();$('drawing-undo-all').disabled=!projectHistory.canUndo();const snap=cleanSnap(project.layout?.snapping);$('drawing-snap').textContent='Snapping: '+(snap.enabled?'on':'off');$('drawing-snap').setAttribute('aria-pressed',String(snap.enabled));
 $('drawing-snap-label').disabled=!editDrawing||!selectedConnectionLabel();
 const selectedDevices=selectedDrawingDevices();syncBesideTools();$('drawing-page').disabled=!selectedDevices.length;$('drawing-smaller').disabled=$('drawing-larger').disabled=!objects.some(o=>drawingSelection.has(o.editKey)&&o.type!=='path');
 const cable=selectedCable();$('cable-tools').hidden=!editDrawing||!cable;$('cable-edit-points').disabled=!cable;$('cable-endpoints').disabled=!cable?.sourceLink;$('cable-remove-point').disabled=!cable||cablePoint<1;
 if(cable&&svg&&editDrawing){if(cablePoint>=cable.points.length-1)cablePoint=-1;cableControls(svg,cable,cablePoint);$('cable-point-info').textContent=cablePoint>0?'Bend '+cablePoint+' selected':'Drag a square to move a bend. Click + to add bends.';$('cable-remove-point').disabled=cablePoint<1;}
 else $('cable-point-info').textContent='Move near a cable to highlight it, then click to select.';
 viewport.syncCableInteraction();
}
function selectDrawingItem(key,additive=false){cablePoint=-1;if(!additive)drawingSelection.clear();if(additive&&drawingSelection.has(key))drawingSelection.delete(key);else drawingSelection.add(key);syncDrawingSelection();}
function selectedCable(){return drawingSelection.size===1?pages[active]?.items.find(i=>i.type==='path'&&drawingSelection.has(i.editKey)):null;}
function selectedConnectionLabel(){
 return drawingSelection.size===1?pages[active]?.items.find(item=>item.labelRole&&item.relatedCableKey&&drawingSelection.has(item.editKey)):null;
}
function saveSnappedLabel(key,point,{rotation='auto',placement='on'}={}){
 const label=pages[active]?.items.find(item=>item.editKey===key&&item.labelRole),cable=label&&pages[active].items.find(item=>item.editKey===label.relatedCableKey&&item.type==='path');
 if(!label||!cable||!point)throw Error('Select a label associated with a visible cable.');
 const radians=rotation==='auto'?point.angle:Number(rotation)*Math.PI/180;
 const aligned=labelPositionRelativeToCable(point,{placement,width:label.w,height:label.h,rotation:radians});
 const patch=unpresentPatch(label,{x:aligned.x-label.w/2,y:aligned.y-label.h/2,angle:radians});
 patch.rotationMode=rotation==='auto'?'auto':'fixed';
 patch.cableSide=['above','below'].includes(placement)?placement:'on';
 if(Number.isFinite(point.ratio))patch.cableFraction=point.ratio;
 setDrawingEdits({...project.layout?.drawingEdits,[key]:{...project.layout?.drawingEdits?.[key],...patch}});
 say('Connection label aligned '+(placement==='on'?'on':placement)+' its cable. Its relative position is saved.');
}
function snapSelectedLabelAtClick(key,event){
 const labelKey=snapLabelPick?.key||snapLabelPick,rotation=snapLabelPick?.rotation||'auto',placement=snapLabelPick?.placement||'on',label=pages[active]?.items.find(item=>item.editKey===labelKey),cable=pages[active]?.items.find(item=>item.editKey===label?.relatedCableKey);
 if(!label||!cable){snapLabelPick=null;return;}
 if(key!==cable.editKey){say('Click a position on the highlighted connection cable. Escape cancels.');return;}
 const svg=$('canvas').querySelector('svg'),position=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse()),point=nearestOnCable(cable.points,{x:position.x,y:position.y});
 snapLabelPick=null;if(point)task(()=>saveSnappedLabel(labelKey,point,{rotation,placement}));
}
function snapSelectedLabelDialog(){
 const label=selectedConnectionLabel();if(!label)throw Error('Select a connection label first.');
 const cable=pages[active].items.find(item=>item.editKey===label.relatedCableKey);
 if(!cable)throw Error('The associated connection is not visible on this page.');
 const ends=describeCableEnds(cable,project.devices),body=modal('Align label to connection');
 body.append(el('p','Start and end follow the actual drawn cable, with device names and physical ports identified below. The position remains attached to the cable if routing changes.','hint'));
 const position=field(body,'Position on line','0.5',[
  ['0.1','Near '+ends.start+' (10%)'],['0.25','Toward '+ends.start+' (25%)'],
  ['0.5','Center of cable (50%)'],['0.75','Toward '+ends.end+' (75%)'],
  ['0.9','Near '+ends.end+' (90%)']
 ]);
 const placement=field(body,'Position relative to line',project.layout?.drawingEdits?.[label.editKey]?.cableSide||'on',[
  ['above','Above line (left of a vertical link)'],['on','On line (centered in a break)'],['below','Below line (right of a vertical link)']
 ]);
 const rotation=field(body,'Label orientation','auto',[['auto','Automatically follow the cable'],['0','Horizontal (0 degrees)'],['90','Vertical (90 degrees)'],['180','Reverse horizontal (180 degrees)'],['-90','Reverse vertical (-90 degrees)']]);
 const actionBar=actions(body);
 button(actionBar,'Align label',()=>{const point=positionOnCable(cable.points,Number(position.value));if(!point)throw Error('The cable has no usable segment.');saveSnappedLabel(label.editKey,point,{rotation:rotation.value,placement:placement.value});close();},'primary');
 button(actionBar,'Pick point on the cable',()=>{snapLabelPick={key:label.editKey,rotation:rotation.value,placement:placement.value};close();say('Click the desired position on the highlighted cable. Escape cancels.');},'');
}
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&snapLabelPick){snapLabelPick=null;say('Label alignment cancelled.');}},true);

function rotateConnectionLabel(key,angle){
 const label=pages[active]?.items.find(i=>i.editKey===key&&i.labelRole);
 if(!label)throw Error('Select a connection label to rotate.');
 const patch={...project.layout?.drawingEdits?.[key],angle:angle*Math.PI/180,rotationMode:'fixed'};
 setDrawingEdits({...project.layout?.drawingEdits,[key]:patch});say('Label rotation saved.');
}
function dismissEditorContextMenu(){contextMenu?.remove();contextMenu=null;}
function showEditorContextMenu(event,options){
 dismissEditorContextMenu();
 const menu=el('div','','editor-context-menu');menu.setAttribute('role','menu');menu.setAttribute('aria-label','Drawing editing options');
 for(const [caption,action] of options){
  if(action==null){menu.append(el('div',caption,'editor-context-heading'));continue;}
  const b=el('button',caption);b.type='button';b.setAttribute('role','menuitem');
  b.onclick=e=>{e.stopPropagation();dismissEditorContextMenu();task(action);};menu.append(b);
 }
 document.body.append(menu);contextMenu=menu;
 menu.style.left=Math.max(8,Math.min(event.clientX,window.innerWidth-menu.offsetWidth-12))+'px';
 menu.style.top=Math.max(8,Math.min(event.clientY,window.innerHeight-menu.offsetHeight-12))+'px';
 menu.querySelector('button')?.focus({preventScroll:true});
 event.preventDefault();
}
document.addEventListener('pointerdown',event=>{if(contextMenu&&!contextMenu.contains(event.target))dismissEditorContextMenu();},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&contextMenu){dismissEditorContextMenu();event.preventDefault();}},true);
function handleEditorContextMenu(event){
 const target=event.target;if(target.closest('input,textarea,select,[data-inline-editor]'))return;
 const tab=target.closest('#tabs button[role="tab"]');
 if(tab){
  const visible=pages.filter(page=>familyOf(page)===familyOf(pages[active])),index=[...$('tabs').querySelectorAll('button[role="tab"]')].indexOf(tab),page=visible[index];
  if(page)showEditorContextMenu(event,[['Page: '+(page.displayName||page.name),null],['Rename page',()=>renamePageTab(page,tab)],['Page options',pageOptions],['Pages & layout',()=>layoutOptions(page.name)]]);
  return;
 }
 if(!target.closest('#canvas')||!pages[active])return;
 const key=target.closest('[data-drawing-key]')?.getAttribute('data-drawing-key');
 const socket=target.closest('[data-port-name]'),owner=socket?.closest('[data-device-id]');
 const page=pages[active],item=drawingObjects(page).find(item=>item.editKey===key),actions=[];
 if(!editDrawing)actions.push(['Enable Edit drawing',()=>$('edit-drawing').click()]);
 if(item&&editDrawing){
  actions.push([item.type==='path'?'Connection':item.labelRole?'Connection label':item.type==='device'?'Device':'Drawing object',null]);
  actions.push(['Edit properties',()=>{selectDrawingItem(item.editKey);editDrawingObject(item.editKey);}],['Select object',()=>selectDrawingItem(item.editKey)]);
  if(item.labelRole&&item.relatedCableKey){
   actions.push(['Snap label to associated line',()=>{selectDrawingItem(item.editKey);snapSelectedLabelDialog();}]);
   for(const [degrees,title] of [[0,'Horizontal'],[90,'Vertical'],[180,'Reverse horizontal'],[-90,'Reverse vertical']])actions.push(['Rotate: '+title,()=>rotateConnectionLabel(item.editKey,degrees)]);
   actions.push(['Reset automatic label placement',()=>{const edits={...project.layout?.drawingEdits};delete edits[item.editKey];setDrawingEdits(edits);say('Automatic label placement restored.');}]);
  }
  if(item.type==='path'){
   actions.push(['Edit cable bends',()=>editCablePoints(item)]);
   if(item.sourceLink)actions.push(['Connect endpoints',()=>connectSelectedCable(item)]);
   actions.push(['Organize connections',()=>$('drawing-organize').click()]);
  }
  if(item.type==='device'){
   const d=project.devices.find(d=>d.id===item.sourceId);
   if(d)actions.push(['Edit device details',()=>editDevice(d)],['Find hardware stencil',()=>deviceStencil(d)]);
  }
 }else if(socket&&owner&&editDrawing){
  const sourceId=owner.getAttribute('data-device-id'),portName=socket.getAttribute('data-port-name');
  const related=relatedConnectionItems(page,{sourceId,portName});
  actions.push(['Port '+portName,null]);
  if(related.paths.length)actions.push(['Highlight connected cable',()=>selectDrawingItem(related.paths[0].editKey)]);
  const d=project.devices.find(d=>d.id===sourceId);
  if(d)actions.push(['Edit device and port details',()=>editDevice(d)]);
 }
 if(!item&&!socket)actions.push(['Page',null]);
 actions.push(['Fit drawing to viewport',()=>viewport.fit()],['Page options',pageOptions],['Pages & layout',()=>layoutOptions(page.name)]);
 showEditorContextMenu(event,actions);
}
function changeCablePoints(item,points){if(!validCable(points))throw Error('Cable segments must be horizontal or vertical, with at most 200 points.');setDrawingEdits({...project.layout?.drawingEdits,[item.editKey]:{...project.layout?.drawingEdits?.[item.editKey],...unpresentPatch(item,{points})}});}
function cableControlClick(key,event,target=event.target){
 const add=target.closest('[data-cable-segment]'),point=target.closest('[data-cable-point]');if(!add&&!point)return false;
 const item=pages[active]?.items.find(i=>i.editKey===key&&i.type==='path');if(!item)return false;drawingSelection.clear();drawingSelection.add(key);
 if(add){cablePoint=-1;task(()=>{changeCablePoints(item,addCableBends(item.points,+add.dataset.cableSegment));say('Bend points added. Drag a square to adjust the route.');if(event.type==='keydown')$('canvas').focus({preventScroll:true});});}
 else{cablePoint=+point.dataset.cablePoint;syncDrawingSelection();if(event.type==='keydown')$('canvas').querySelector('.cable-controls [data-cable-point="'+cablePoint+'"]')?.focus({preventScroll:true});}return true;
}
function connectSelectedCable(item=selectedCable()){if(item?.sourceLink)editLink(project.links.findIndex(l=>sameConnection(l,item.sourceLink)),item);}
function removeSelectedCablePoint(){const item=selectedCable();if(!item||cablePoint<1)return;const points=removeCablePoint(item.points,cablePoint);cablePoint=-1;changeCablePoints(item,points);say('Bend removed and adjacent segments straightened.');}
// Connector text with a white background sits on its own cable by design (only
// that cable's jumps must stay clear), and its consecutive parts may touch.
const ownCaption=(path,label)=>label.background&&path.linkId!=null&&path.linkId===label.linkId,sameCaption=(a,b)=>a.background&&b.background&&a.linkId!=null&&a.linkId===b.linkId&&a.labelRole===b.labelRole;
function validateDrawing(){const rebuilt=buildDrawing();for(const p of rebuilt.filter(p=>p.coreDeviceIds)){const texts=p.items.filter(i=>i.type==='text'),paths=p.items.filter(i=>i.type==='path');for(const a of texts.filter(i=>i.labelRole))if(texts.some(b=>a!==b&&!sameCaption(a,b)&&intersects(a,b,0))||paths.some(r=>ownCaption(r,a)?(r.hops||[]).some(hop=>intersects(hop,a,1)):pathCrossesText(r,a,1)))throw Error('This change overlaps a link label. Move the object or cable clear of the label.');}return rebuilt;}
function setDrawingEdits(next){
 project.layout||={};const previous=project.layout;project.layout={...previous,drawingEdits:cleanDrawingEdits(next)};
 const format=pages[active]?.portMap?.presentation;if(format&&(!previous.portMap?.presentation||previous.portMap.presentation==='auto'))project.layout.portMap={...previous.portMap,presentation:format};
 // Validation has not changed the displayed SVG. Keep its editor and draft
 // attached when rejecting an edit, rather than leaving an invisible input lock.
 let prepared;try{prepared=validateDrawing();}catch(error){project.layout=previous;throw error;}
 perform('drawing',prepared);
}
function setLinkStyle(type,change,extraEdits={}){
 project.layout||={};const before=project.layout,source={...project,layout:{...before,drawingEdits:cleanDrawingEdits({...before.drawingEdits,...extraEdits})}},stylePages=buildDrawing(scoped(),{includeHidden:true}),next=changeLinkStyle(source,stylePages,type,change);project.layout={...before,...next};
 let prepared;try{prepared=validateDrawing();}catch(error){project.layout=before;throw error;}perform('link-style',prepared);
}
function setLegendStyle(type,details,style,extraEdits={}){
 const before=project,stylePages=buildDrawing(scoped(),{includeHidden:true}),next=changeLegendConnections(project,stylePages,type,details,style,extraEdits,source=>buildPages(scoped(source),{includeHidden:true}));
 project=next;let prepared;try{prepared=validateDrawing();}catch(error){project=before;throw error;}perform('link-style',prepared);
}
function legendFields(body,type){
 const records=legendConnections(project,pages,type);if(!records.length)return null;
 body.append(el('p',records.length+' associated connection'+(records.length===1?'':'s')+' across the drawing. Choose a cable type and speed or enter custom values.','hint'));
 return connectionFields(body,commonConnectionDetails(records),{mixed:true});
}
function editableText(item){return item.legendFullText!=null&&project.layout?.drawingEdits?.[item.editKey]?.value==null?item.legendFullText:item.value;}
function saveTextEdit(item,value,color){
 const patch={...project.layout?.drawingEdits?.[item.editKey],color};if(!item.legendEntry)patch.value=value;
 if(item.legendEntry&&item.linkType&&value!==editableText(item)){delete patch.value;setLinkStyle(item.linkType,{[item.legendDescription?'description':'title']:value},{[item.editKey]:patch});}
 else setDrawingEdits({...project.layout?.drawingEdits,[item.editKey]:patch});
}
function editOnDoubleClick(key){
 const item=pages[active]&&drawingObjects(pages[active]).find(i=>i.editKey===key);if(!item)return;
 if(!commitInlineEdit())return;viewport.preserve();editDrawing=true;$('edit-drawing').setAttribute('aria-pressed','true');$('canvas').classList.add('editing');selectDrawingItem(key);
 if(['text','arttext'].includes(item.type)){
  const box=drawingBounds(item),svg=$('canvas').querySelector('svg'),size=item.type==='arttext'&&item.normalized?item.size*item.parent.w:item.size;
  inlineSession=inlineTextEditor(svg,{box,value:editableText(item),size,bold:item.bold,color:item.color,align:item.align,onMore:()=>task(()=>editDrawingObject(key)),onSave(value,color){const text=item.type==='arttext'?value:value.replace(/[\r\n]+/g,' ');if(text===editableText(item)&&color===item.color)return;saveTextEdit(item,text,color);say('Diagram text saved.');},onClose(){inlineSession=null;inlineCancel=null;$('canvas').focus({preventScroll:true});}});inlineCancel=()=>inlineSession?.cancel();
 }else task(()=>editDrawingObject(key));
}
document.addEventListener('pointerdown',event=>{if(inlineSession&&!event.target.closest('[data-inline-editor]')&&!commitInlineEdit()){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&inlineSession){inlineSession.cancel();event.preventDefault();event.stopImmediatePropagation();say('Text edit cancelled.');}},true);
function startDrawingBox(event,start){
 if(besidePick)return null;
 if(!editDrawing||!pages[active])return null;const svg=$('canvas').querySelector('svg'),baseline=new Set(drawingSelection),rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('class','diagram-marquee');svg.append(rect);
 const objects=drawingObjects(pages[active]).filter(o=>event.altKey?o.parent||o.type!=='device':!o.parent).map(drawingBounds).filter(Boolean);
 function update(end){for(const [k,v] of Object.entries({x:Math.min(start[0],end[0]),y:Math.min(start[1],end[1]),width:Math.abs(end[0]-start[0]),height:Math.abs(end[1]-start[1])}))rect.setAttribute(k,v);
  const inside=boxSelected(objects,start,end);drawingSelection.clear();if(event.shiftKey||event.ctrlKey||event.metaKey)for(const key of baseline)drawingSelection.add(key);for(const key of inside)if((event.ctrlKey||event.metaKey)&&baseline.has(key))drawingSelection.delete(key);else drawingSelection.add(key);cablePoint=-1;syncDrawingSelection();
 }return {preview:update,commit(end){update(end);rect.remove();},cancel(){rect.remove();}};
}
function snapTargets(page,excluded){
 const s=cleanSnap(project.layout?.snapping),targets=[];
 for(const item of drawingObjects(page)){if(excluded.has(item.editKey)||item.parent&&excluded.has(item.parent.editKey))continue;
  if(item.type==='path'){if(s.cablePoints)for(const [x,y] of item.points)targets.push({axis:0,value:x},{axis:1,value:y});continue;}
  if(item.parent||item.type==='device'&&!s.deviceEdges||item.type!=='device'&&!s.objectEdges)continue;const b=drawingBounds(item);if(b)for(const axis of [0,1])for(const value of axis?[b.y,b.y+b.h/2,b.y+b.h]:[b.x,b.x+b.w/2,b.x+b.w])targets.push({axis,value});
 }return targets;
}
function showSnapGuides(guides=[]){const svg=$('canvas').querySelector('svg');if(!svg)return;svg.querySelectorAll('.snap-guide').forEach(n=>n.remove());for(const guide of guides){const n=document.createElementNS('http://www.w3.org/2000/svg','line');n.setAttribute('class','snap-guide');for(const [key,value] of Object.entries(guide.axis===0?{x1:guide.value,x2:guide.value,y1:145,y2:(pages[active]?.height||975)-69}:{x1:36,x2:(pages[active]?.width||1200)-36,y1:guide.value,y2:guide.value}))n.setAttribute(key,value);svg.append(n);}}
// Snapping on/off is one click; the grid and alignment choices are separate.
function toggleSnapping(){
 const s=cleanSnap(project.layout?.snapping);project.layout||={};project.layout.snapping=cleanSnap({...s,enabled:!s.enabled});perform('snapping');say('Snapping '+(project.layout.snapping.enabled?'on':'off')+'.');
}
function snapOptions(){
 const body=modal('Snap options'),s=cleanSnap(project.layout?.snapping),fields={};
 body.append(el('p','Snapping is turned on or off with the Snapping button. These options apply while it is on.','hint'));
 for(const [key,name] of [['grid','Snap to grid'],['guides','Automatic alignment guides'],['deviceEdges','Align with device edges and centers'],['objectEdges','Align with text and other object edges'],['cablePoints','Align with other cable bend points']]){const row=el('label','','check-option'),input=el('input');input.type='checkbox';input.checked=s[key];input.setAttribute('aria-label',name);row.append(input,document.createTextNode(name));body.append(row);fields[key]=input;}
 const grid=el('div','','form-grid');body.append(grid);for(const [key,name] of [['gridSize','Grid spacing (page units)'],['distance','Alignment snap distance (page units)'],['nudge','Arrow-key step (page units)']]){const input=field(grid,name,s[key]);input.type='number';input.step=key==='nudge'?.1:1;input.min=key==='nudge'?.1:1;input.max=key==='nudge'?20:key==='distance'?24:100;fields[key]=input;}
 body.append(el('p','Hold Shift while dragging any item or bend to lock horizontal or vertical movement. Snapping affects dragging. Press Alt after starting a drag to bypass snapping. Arrow keys use the configured step; Shift multiplies it by 10 and Ctrl divides it by 10. Endpoint ports remain attached. Alignment buttons apply the action you select.','hint'));
 button(actions(body),'Save snapping options',()=>{for(const key of ['gridSize','distance','nudge'])if(fields[key].value===''||!Number.isFinite(+fields[key].value)||+fields[key].value<+fields[key].min||+fields[key].value>+fields[key].max)throw Error('Use grid spacing 1-100, snap distance 1-24, and an arrow-key step of 0.1-20.');project.layout||={};project.layout.snapping=cleanSnap({...cleanSnap(project.layout.snapping),...Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.type==='checkbox'?input.checked:+input.value]))});perform('snapping');close();say('Snap options saved.');},'primary');
}
$('drawing-snap').onclick=()=>task(toggleSnapping);$('drawing-snap-options').onclick=()=>task(snapOptions);
// Re-arranging keeps the saved device order and is one undoable action.
$('drawing-arrange').onchange=()=>task(()=>{
 const page=pages[active],mode=$('drawing-arrange').value;if(!page?.coreDeviceIds)return;
 const previous=project;project={...project,layout:cleanLayout(arrangeCoreLayout(project,pages,{mode,corePageId:page.corePageId}),project.devices.map(d=>d.id))};
 // Validate through the page cache and reuse that build for the redraw.
 let prepared;try{prepared=buildDrawing();}catch(error){project=previous;$('drawing-arrange').value=pageArrangement(project,page);throw error;}
 drawingSelection.clear();perform('arrange',prepared);viewport.fit();
 const now=pages.find(p=>p.name===page.name);say(now?.arrangementFallback?'That arrangement could not fit the cables here, so this page uses a compact arrangement instead. Undo is available.':'Devices re-arranged in their saved order. Undo is available.');
});
function startDrawingMove(key,event){
 if(besidePick)return null;
 if(!editDrawing||!pages[active])return null;const page=pages[active],settings=cleanSnap(project.layout?.snapping),control=event.target.closest('[data-cable-point],[data-cable-segment]'),axisFor=dragAxis();
 if(control){if(control.hasAttribute('data-cable-segment'))return {preview(){},commit(){},cancel(){}};
  const item=page.items.find(i=>i.editKey===key),index=+control.dataset.cablePoint,svg=$('canvas').querySelector('svg'),merge=8/(svg.getScreenCTM()?.a||1),path=[...svg.children].find(n=>n.matches('path.diagram-cable')&&n.getAttribute('data-drawing-key')===key),before=path.getAttribute('d'),targets=snapTargets(page,new Set([key]));
  if(settings.cablePoints)for(const [i,p] of item.points.entries())if(i!==index)targets.push({axis:0,value:p[0]},{axis:1,value:p[1]});drawingSelection.clear();drawingSelection.add(key);cablePoint=index;
  const geometry=(dx,dy,e)=>{const axis=axisFor(dx,dy,e?.shiftKey),snapped=snapPoint([item.points[index][0]+(axis===1?0:dx),item.points[index][1]+(axis===0?0:dy)],settings,targets,e?.altKey,axis);return {...snapped,points:moveCablePoint(item.points,index,...snapped.point,{merge})};};
  const restore=()=>{path.setAttribute('d',before);showSnapGuides();};
  return {preview(dx,dy,e){const next=geometry(dx,dy,e);path.setAttribute('d',next.points.map((p,i)=>(i?'L ':'M ')+p.join(' ')).join(' '));svg.querySelector('.cable-controls')?.remove();cableControls(svg,{...item,points:next.points},next.points.findIndex(p=>p[0]===next.point[0]&&p[1]===next.point[1]));showSnapGuides(next.guides);},commit(dx,dy,e){restore();task(()=>{cablePoint=-1;changeCablePoints(item,geometry(dx,dy,e).points);say('Cable bend moved.');});},cancel(){restore();syncDrawingSelection();}};
 }
 const keys=drawingSelection.has(key)?new Set(drawingSelection):new Set(event.shiftKey||event.ctrlKey||event.metaKey?[...drawingSelection,key]:[key]),
  // WAN cards and cables with saved bends that follow the selection move too.
  moving=new Set(movementOffsets(page,project.layout?.drawingEdits,new Map([...keys].map(k=>[k,[1,1]]))).keys()),
  boxes=drawingObjects(page).filter(o=>moving.has(o.editKey)&&!moving.has(o.parent?.editKey)&&!(o.type==='path'&&!keys.has(o.editKey))).map(drawingBounds).filter(Boolean),targets=snapTargets(page,moving),elements=[...$('canvas').querySelectorAll('[data-drawing-key]')].filter(n=>!n.closest('.cable-controls')&&moving.has(n.getAttribute('data-drawing-key'))&&!moving.has(n.parentElement.closest('[data-drawing-key]')?.getAttribute('data-drawing-key'))),original=new Map(elements.map(n=>[n,{transform:n.getAttribute('transform'),d:n.getAttribute('d')}]));let started=false;
 const restore=()=>{for(const [n,s] of original){if(s.transform==null)n.removeAttribute('transform');else n.setAttribute('transform',s.transform);if(s.d)n.setAttribute('d',s.d);}showSnapGuides();};
 const geometry=(dx,dy,e)=>{const axis=axisFor(dx,dy,e?.shiftKey);return snapBoxes(boxes,[axis===1?0:dx,axis===0?0:dy],settings,targets,e?.altKey,axis);};
 return {preview(dx,dy,e){const next=geometry(dx,dy,e),[x,y]=next.delta;if(!started){drawingSelection.clear();for(const k of keys)drawingSelection.add(k);syncDrawingSelection();started=true;}
  const edits=moveDrawingItems(page,project.layout?.drawingEdits,new Map([...keys].map(k=>[k,[x,y]])));
  for(const [n,s] of original){const patch=edits[n.getAttribute('data-drawing-key')];if(s.d&&patch?.points)n.setAttribute('d',patch.points.map((p,i)=>(i?'L ':'M ')+p.join(' ')).join(' '));else n.setAttribute('transform','translate('+x+' '+y+') '+(s.transform||''));}
  for(const n of $('canvas').querySelectorAll('.diagram-selection'))n.setAttribute('transform','translate('+x+' '+y+')');$('canvas').querySelector('.cable-controls')?.setAttribute('visibility','hidden');showSnapGuides(next.guides);
 },commit(dx,dy,e){const next=geometry(dx,dy,e);restore();task(()=>{
    const label=keys.size===1?page.items.find(item=>item.editKey===[...keys][0]&&item.labelRole&&item.relatedCableKey):null;
    const cable=label&&page.items.find(item=>item.editKey===label.relatedCableKey&&item.type==='path');
    if(label&&cable){
      const center={x:label.x+label.w/2+next.delta[0],y:label.y+label.h/2+next.delta[1]};
      const hit=nearestOnCable(cable.points,center);
      if(hit&&Math.hypot(hit.x-center.x,hit.y-center.y)<=Math.max(14,label.h/2+8)){
       saveSnappedLabel(label.editKey,hit);say('Label centered and oriented on the connection line. Rotation remains editable.');return;
      }
    }
    setDrawingEdits(moveDrawingItems(page,project.layout?.drawingEdits,new Map([...keys].map(k=>[k,next.delta])),{preventSidebarOverlap:true}));
    say('Drawing items moved.');
   });},cancel(){restore();syncDrawingSelection();}};
}
$('drawing-snap-label').onclick=()=>task(snapSelectedLabelDialog);
$('drawing-properties').onclick=()=>task(()=>editDrawingObject([...drawingSelection][0]));$('drawing-clear').onclick=()=>{cancelBesidePick();drawingSelection.clear();syncDrawingSelection();};
$('drawing-organize').onclick=()=>task(()=>connectionLayoutEditor({project:scoped(),page:pages[active],pages,buildPages:source=>buildPages(source,{cache:pageCache}),modal,el,button,actions,run:task,close,apply(result){const before=project.layout;project.layout={...before,lineSpacing:result.lineSpacing||before?.lineSpacing||{}};try{setDrawingEdits(result.edits);}catch(error){project.layout=before;throw error;}viewport.fit();say((result.spacing?'Lines evenly spaced. ':'Connections organized. ')+'Undo restores the previous layout.');}}));
function selectedDrawingDevices(){return pages[active]?.items.filter(i=>i.type==='device'&&i.kind!=='plug'&&drawingSelection.has(i.editKey)&&project.devices.some(d=>d.id===i.sourceId))||[];}
// Devices and generated WAN/ISP/egress cards can be placed beside another object.
const placeable=item=>item?.type==='device'&&item.kind!=='plug'&&(project.devices.some(d=>d.id===item.sourceId)||item.kind==='handoff'&&!!item.ownerKey);
function selectedPlaceable(){return pages[active]?.items.filter(i=>placeable(i)&&drawingSelection.has(i.editKey))||[];}
function resizeSelection(factor){if(!drawingObjects(pages[active]).some(i=>drawingSelection.has(i.editKey)&&i.type!=='path'))throw Error('Select a device, text or another object to resize. Cables follow their connected devices.');setDrawingEdits(scaleDrawingItems(pages[active],project.layout?.drawingEdits,drawingSelection,factor));say('Selected items resized. Connections remain attached.');}
$('drawing-smaller').onclick=()=>task(()=>resizeSelection(.9));$('drawing-larger').onclick=()=>task(()=>resizeSelection(1.1));
$('drawing-size').onclick=()=>task(()=>{
 const body=modal('Resize items'),scope=field(body,'Resize',drawingSelection.size?'selected':'page',[['selected','Selected items'],['page','Everything on this page'],['drawing','Everything on all pages']]),percent=field(body,'Size (% of current size)',100);percent.type='number';percent.min=10;percent.max=400;
 const bar=actions(body);button(bar,'Smaller −10%',()=>percent.value=Math.max(10,Math.round(+percent.value*.9)));button(bar,'Larger +10%',()=>percent.value=Math.min(400,Math.round(+percent.value*1.1)));
 body.append(el('p','100% keeps the current size. Device ports and connections stay attached. Use Undo to restore the previous size.','hint'));
 button(actions(body),'Apply size',()=>{const factor=+percent.value/100;if(!Number.isFinite(factor)||factor<.1||factor>4)throw Error('Choose a size from 10 to 400 percent.');
  if(scope.value==='selected'){if(!drawingSelection.size)throw Error('Select an item first.');resizeSelection(factor);}
  else {const before=project.layout,next=structuredClone(before||{}),config=cleanPresentation(next.presentation),targets=scope.value==='page'?[config.pages[pages[active].name]={...config.pages[pages[active].name],drawingScale:presentation(project,pages[active]).drawingScale}]:[config.defaults,...Object.values(config.pages).filter(p=>Number.isFinite(p.drawingScale))];
   for(const target of targets){const value=target.drawingScale*factor;if(value<.1||value>4)throw Error('The resulting drawing size must stay between 10% and 400%.');target.drawingScale=value;}next.presentation=config;project.layout=next;try{validateDrawing();}catch(error){project.layout=before;throw error;}perform('drawing');viewport.fit();say('Drawing resized.');}
  close();
 },'primary');
});
let besidePick=null;
function syncBesideTools(){
 $('drawing-beside').hidden=!editDrawing;
 const devices=pages[active]?.items.filter(i=>i.type==='device'&&i.kind!=='plug')||[],chosen=selectedPlaceable(),available=devices.some(i=>!chosen.includes(i))&&(chosen.length||devices.length>1);
 for(const button of $('drawing-beside').querySelectorAll('[data-place]')){button.disabled=!available;button.setAttribute('aria-pressed',String(besidePick?.side===button.dataset.place));}
 $('placement-cancel').disabled=!besidePick;$('placement-spacing').disabled=!!besidePick;
 $('placement-status').textContent=besidePick?(besidePick.chosen.length?'Click the reference device.':'Click the device to move, then the reference device.'):chosen.length?'Choose a side, then click the reference device.':'Choose a side, then click the device to move.';
}
function cancelBesidePick(){
 if(!besidePick)return;
 besidePick=null;
 $('canvas').classList.remove('picking-reference');
 syncBesideTools();
}
function pickBesideReference(key){
 const {page,chosen,side,spacing}=besidePick;
 const reference=page.items.find(item=>item.editKey===key&&item.type==='device'&&item.kind!=='plug');
 if(!chosen.length){
  if(!placeable(reference)){say('Click the device or WAN card you want to move, or press Esc to cancel.');return;}
  besidePick.chosen=[reference];drawingSelection.clear();drawingSelection.add(reference.editKey);syncDrawingSelection();
  say('Click the reference device to place '+reference.name+' '+side+' it. Press Esc to cancel.');return;
 }
 if(!reference||chosen.includes(reference)){
  say('Click a different device on the drawing, or press Esc to cancel.');
  return;
 }
 cancelBesidePick();
 task(()=>{
  viewport.preserve();
  const gap=automaticDeviceGap(page,[...chosen,reference],side),attempts=spacing==='auto'?[gap,gap+24,gap+56]:[spacing];let failure;
  for(const amount of attempts){try{setDrawingEdits(placeDrawingDevices(page,project.layout?.drawingEdits,chosen.map(i=>i.editKey),reference.editKey,side,amount));failure=null;break;}catch(error){failure=error;if(error.code!=='CORE_LAYOUT_CAPACITY')break;}}
  if(failure){if(failure.code==='CORE_LAYOUT_CAPACITY'&&!failure.owner)throw Error('The connections or labels need more room here. Choose Extra room or another side.');throw failure;}
  say('Devices placed '+side+' '+reference.name+'. Connections rerouted.');
 });
}
for(const button of $('drawing-beside').querySelectorAll('[data-place]'))button.onclick=()=>task(()=>{
 if(!commitInlineEdit())return;
 cancelBesidePick();
 const page=pages[active],chosen=selectedPlaceable();
 if(!page||!page.items.some(item=>item.type==='device'&&item.kind!=='plug'&&!chosen.includes(item)))throw Error('This page needs another device to place beside.');
 besidePick={page,chosen,side:button.dataset.place,spacing:$('placement-spacing').value};
 viewport.preserve();$('canvas').classList.add('picking-reference');$('canvas').focus({preventScroll:true});syncBesideTools();
 say(chosen.length?'Click the reference device to place '+chosen.map(device=>device.name).join(', ')+' '+besidePick.side+' it. Press Esc to cancel.':'Click the device to move, then click the reference device. Press Esc to cancel.');
});
$('placement-cancel').onclick=()=>{cancelBesidePick();say('Placement cancelled.');};
$('drawing-page').onclick=()=>task(()=>{
 const chosen=selectedDrawingDevices(),ids=new Set(chosen.map(d=>d.sourceId)),body=modal('Move devices to page'),choices=corePageChoices().filter(([id])=>!['exclude','auto'].includes(id));
 const target=field(body,'Destination page','new',choices),name=field(body,'New page name','Network page');name.maxLength=80;const update=()=>name.hidden=name.previousElementSibling.hidden=target.value!=='new';target.onchange=update;update();
 body.append(el('p',chosen.map(d=>d.name).join(', '),'hint'));const references=field(body,'Connections to other pages','show',[['show','Show off-page device indicators'],['hide','Hide off-page indicators']]);
 button(actions(body),'Move devices',()=>{
  const previous=project.layout,next=structuredClone(previous||{});next.corePages||=[];let choice=target.value;
  if(choice==='new'){choice=crypto.randomUUID();next.corePages.push({id:choice,name:name.value.trim()||'Network page',devices:[],showReferences:references.value==='show'});}
  else if(choice.startsWith('@core:')){const rendered=pages.filter(p=>p.coreDeviceIds)[+choice.slice(6)],members=rendered.coreDeviceIds.filter(id=>!ids.has(id));choice=crypto.randomUUID();for(const page of next.corePages)page.devices=page.devices.filter(id=>!members.includes(id));next.corePages.push({id:choice,name:rendered.name,devices:members,showReferences:references.value==='show'});}
  for(const id of ids)assignCorePage(next,project.devices.find(d=>d.id===id),choice);
  next.corePages.find(p=>p.id===choice).showReferences=references.value==='show';project.layout=next;
  try{validateDrawing();}catch(error){project.layout=previous;throw error;}perform('drawing');close();const index=pages.findIndex(p=>p.corePageId===choice);if(index>=0){active=index;draw();}say('Devices moved. Off-page indicators identify their connected devices and pages.');
 },'primary');
});
$('cable-remove-point').onclick=()=>task(removeSelectedCablePoint);
$('cable-endpoints').onclick=()=>task(()=>connectSelectedCable());
$('cable-edit-points').onclick=()=>task(()=>editCablePoints(selectedCable()));
for(const button of $('drawing-tools').querySelectorAll('[data-align]'))button.onclick=()=>task(()=>{const page=pages[active],objects=drawingObjects(page).filter(o=>drawingSelection.has(o.editKey)&&!drawingSelection.has(o.parent?.editKey)),boxes=objects.map(drawingBounds).filter(Boolean);setDrawingEdits(moveDrawingItems(page,project.layout?.drawingEdits,arrangeBoxes(boxes,button.dataset.align)));say('Selected drawing items arranged.');});
function drawingHistory(redo=false,all=false,scope=modalHistoryScope){
 const previous=project,next=projectHistory.travel(project,{redo,all,scope,validate(state){project=state;try{validateDrawing();}finally{project=previous;}}});if(next===previous)return;
 inlineCancel?.();project=next;evidenceSnapshot=project.evidence?snapshot():null;dirty=projectHistory.dirty;draw();modalHistoryRefresh?.();say(all?'All available changes undone.':redo?'Change redone.':'Change undone.');
}
$('drawing-undo').onclick=()=>task(()=>drawingHistory());$('drawing-redo').onclick=()=>task(()=>drawingHistory(true));$('drawing-undo-all').onclick=()=>task(()=>drawingHistory(false,true));
function nudgeSelection(event){
 if(!pages[active]||!drawingSelection.size)return;const amount=movementStep(event,cleanSnap(project.layout?.snapping).nudge),dx=event.key==='ArrowRight'?amount:event.key==='ArrowLeft'?-amount:0,dy=event.key==='ArrowDown'?amount:event.key==='ArrowUp'?-amount:0,item=selectedCable();
 if(item&&cablePoint>0){const p=item.points[cablePoint],x=p[0]+dx,y=p[1]+dy,next=moveCablePoint(item.points,cablePoint,x,y,{merge:0});cablePoint=next.findIndex(p=>p[0]===x&&p[1]===y);changeCablePoints(item,next);}
 else setDrawingEdits(moveDrawingItems(pages[active],project.layout?.drawingEdits,new Map([...drawingSelection].map(key=>[key,[dx,dy]]))));
 $('canvas').focus({preventScroll:true});say('Selected items nudged.');
}
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){if($('dialog').open&&!modalHistoryScope)return;event.preventDefault();task(()=>drawingHistory(event.shiftKey));return;}
 if(besidePick&&event.key==='Escape'){cancelBesidePick();say('Placement cancelled.');return;}
 if(!editDrawing||!$('canvas').contains(event.target))return;
 if(event.key==='Escape'){drawingSelection.clear();syncDrawingSelection();}
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();task(()=>nudgeSelection(event));}
 if(['Delete','Backspace'].includes(event.key)&&cablePoint>0){event.preventDefault();task(removeSelectedCablePoint);}
 if((event.key==='Enter'||event.key===' ')&&event.target.closest('[data-cable-point],[data-cable-segment]')){event.preventDefault();cableControlClick(event.target.closest('[data-drawing-key]').dataset.drawingKey,event);}
});
function scoped(source=project){
 const devices=source.devices.filter(d=>!d.hidden);const ids=new Set(devices.map(d=>d.id));
 const links=[],excludedPeerPorts=[];
 for(const l of source.links){
   const a=ids.has(l.a),b=ids.has(l.b);
   if(a&&b)links.push(l);
   else if(a)excludedPeerPorts.push([l.a,l.ap]);
   else if(b)excludedPeerPorts.push([l.b,l.bp]);
 }
 return {...source,devices,links,excludedPeerPorts};
}
const matchName=d=>[d.name,d.model,d.vendor,d.kind,deviceKindLabel(d.kind),d.technology,d.ip].some(v=>String(v||'').toLowerCase().includes($('filter').value.trim().toLowerCase()));
function removeDevices(ids){
 if(!commitInlineEdit())return;
 const before=project,next=withoutDevices(project,ids),count=before.devices.length-next.devices.length;if(!count)return;
 project=next;try{validateDrawing();}catch(error){project=before;throw error;}
 perform('devices');say(count===1?'Device and its connections deleted. Select Undo to restore.':count+' devices and their connections cleared. Select Undo to restore.');
}
function clearDevices(){
 const count=project.devices.length;if(!count)return;
 const body=modal('Clear all devices?');body.append(el('p','Delete all '+count+' devices and their connections, including devices hidden by the search or excluded from the drawing? Hardware in your library is retained. You can undo this action.'));
 const bar=actions(body);button(bar,'Clear all '+count+' devices',()=>{removeDevices(project.devices.map(d=>d.id));close();},'danger');button(bar,'Cancel',close);
}
$('clear-devices').onclick=()=>task(clearDevices);
$('undo-devices').onclick=()=>task(()=>drawingHistory());
function deviceList(){
 const panel=$('devices');panel.replaceChildren();const matching=orderedDevices(project).filter(matchName);
 $('device-count').textContent=matching.length+' of '+project.devices.length+' devices';$('clear-devices').disabled=!project.devices.length;$('undo-devices').disabled=!projectHistory.canUndo();
 for(const d of matching){const row=el('div','','device-row'),include=el('input');include.type='checkbox';include.checked=!d.hidden;include.setAttribute('aria-label','Include '+d.name);include.title='Show '+d.name+' in the drawing';row.classList.toggle('excluded',!!d.hidden);
 include.onchange=()=>{d.scopeOverride=include.checked;d.hidden=!include.checked;perform();};
 const b=el('button',d.name,'device-details');b.type='button';b.title='Edit '+d.name;b.append(el('small',[deviceKindLabel(d.kind),d.model||d.vendor||'Model unspecified'].join(' / ')));if(d.ip)b.append(el('small',d.ip));b.onclick=()=>task(()=>editDevice(d));row.append(include,b);
 const del=button(row,'Delete',()=>removeDevices([d.id]),'delete-device');del.title='Delete '+d.name+' and its connections';del.setAttribute('aria-label','Delete '+d.name);addOrderControls(row,d);panel.append(row);}
 if(!matching.length)panel.append(el('p',project.devices.length?'No matches. Try a device name, model, type or IP address.':'No devices yet. Add a device or import your configurations.','placeholder'));
}
function addOrderControls(row,d,after=()=>{}){
 const order=orderedDevices(project),i=order.findIndex(x=>x.id===d.id),bar=el('div','','order-buttons');
 for(const [label,step,disabled] of [['Up',-1,i===0],['Down',1,i===order.length-1]]){
  const b=el('button',label);b.type='button';b.disabled=disabled;b.setAttribute('aria-label',label+' '+d.name);
  b.onclick=()=>{moveStep(project,d.id,step);perform();after();};bar.append(b);
 }
 row.append(bar);row.draggable=true;row.dataset.deviceId=d.id;
 row.ondragstart=e=>{e.dataTransfer.setData('application/x-nds-device',d.id);e.dataTransfer.effectAllowed='move';};
 row.ondragover=e=>{if([...e.dataTransfer.types].includes('application/x-nds-device')){e.preventDefault();e.stopPropagation();row.classList.add('order-target');}};
 row.ondragleave=()=>row.classList.remove('order-target');
 row.ondrop=e=>{const id=e.dataTransfer.getData('application/x-nds-device');if(!id)return;e.preventDefault();e.stopPropagation();row.classList.remove('order-target');if(id!==d.id&&project.devices.some(x=>x.id===id)){moveDevice(project,id,d.id);perform();after();}};
}
function portMapOptions(){
 const body=modal('Port map options');project.layout||={};const current=project.layout.portMap||{},filter=field(body,'Port details to show',current.detailFilter||'all',[['all','All physical port records'],['assigned','Hide ports without assignment details'],['connected','Only ports with a peer or description']]),group=field(body,'Port table rows',current.groupConsecutive===false?'each':'group',[['group','Group matching port assignments'],['each','One row per interface']]);
 const style=field(body,'Port map style',current.mapStyle==='faceplate'?'faceplate':'switchport',[['switchport','Switchport builder sheet in device colors - fits Letter'],['faceplate','Realistic device faceplate artwork']]);
 const format=field(body,'Report layout',current.presentation||(current.repeatFaceplate?'combined':'auto'),[['auto','Automatic - combine where readable'],['separate','Separate port maps and inventory'],['combined','Combined map and inventory']]);
 const density=field(body,'Port table layout',current.density||'compact',[['compact','Compact - fewer pages'],['expanded','Expanded - more space per record']]),repeat=field(body,'Faceplate on continued pages',current.repeatFaceplate?'repeat':'first',[['first','First page only'],['repeat','Repeat on every page']]);
 const showRepeat=()=>{repeat.hidden=repeat.previousElementSibling.hidden=format.value!=='combined';};format.onchange=showRepeat;showRepeat();
 body.append(el('p','Compact grouped tables combine switches in an assignment matrix. Expanded tables show more space per record. Assignment details include a peer, description, role, VLAN configuration, LAG or IP address. A port number, capacity or up/down state alone does not count. The faceplate retains every physical port.','hint'));
 button(actions(body),'Apply port map options',()=>{project.layout.portMap={...(style.value==='faceplate'?{mapStyle:'faceplate'}:{}),presentation:format.value,density:density.value,repeatFaceplate:repeat.value==='repeat',detailFilter:filter.value,groupConsecutive:group.value==='group'};perform();close();say('Port map table options saved.');},'primary');
}
$('port-map-options').onclick=()=>task(portMapOptions);
function linkCaptionFields(body,type,{collapsible=false}={}){
 let defaults={},currentType=type;
 const current=project.layout?.linkStyles?.[type]||{},section=el(collapsible?'details':'div','','link-caption-fields');body.append(section);
 if(collapsible){section.append(el('summary','Titles and descriptions'));section.open=!!(current.description||current.lineDescription||current.title&&current.title!==type||current.lineTitle&&current.lineTitle!==type);}
 const grid=el('div','','compact-fields');section.append(grid);const inputs={};
 for(const [key,name] of [['title','Legend title'],['lineTitle','Line title'],['description','Legend description'],['lineDescription','Line description']]){const cell=el('div','','compact-field');grid.append(cell);defaults[key]=current[key]??(key==='title'||key==='lineTitle'?type:'');inputs[key]=field(cell,name,defaults[key]);inputs[key].maxLength=key==='title'||key==='lineTitle'?160:240;}
 return {get value(){return Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value]));},retarget(type){if(type===currentType)return;const next=project.layout?.linkStyles?.[type]||{};for(const [key,input] of Object.entries(inputs)){const value=next[key]??(key==='title'||key==='lineTitle'?type:'');if(input.value===defaults[key])input.value=value;defaults[key]=value;}currentType=type;}};
}
function lineWidthValue(input){const value=Number(input.value);if(input.value.trim()===''||!Number.isFinite(value)||value<=0||value>12000)throw Error('Line width must be greater than 0 and no more than 12000.');return value;}
function linkStyleOptions(selected){
 const used=new Map();for(const p of pages)for(const line of p.items.filter(i=>i.type==='path'))if(!used.has(line.linkType))used.set(line.linkType,line);
 const types=[...new Set([...used.keys(),...linkDefaults.map(([type])=>type)])],type=types.includes(selected)?selected:types[0],line=used.get(type),current=project.layout?.linkStyles?.[type]||{},body=modal('Link styles','compact-color-dialog');
 const choice=field(body,'Link type',type,types.map(t=>[t,t+(used.has(t)?'':' (unused)')]));choice.onchange=()=>linkStyleOptions(choice.value);
 const details=legendFields(body,type);
 const captions=linkCaptionFields(body,type),widths=[...new Set(pages.flatMap(page=>page.items.filter(item=>item.type==='path'&&item.linkType===type).map(item=>unpresentPatch(item,{weight:item.weight}).weight)))],initialWidth=widths.length>1?'':String(widths[0]??current.weight??4),width=field(body,'Line width',initialWidth);width.type='number';width.step=.1;width.min=.1;width.max=12000;if(widths.length>1)width.placeholder='Mixed - keep existing';
 body.append(el('p','Applies to matching lines and legends throughout the drawing.','hint'));
 const fallback=linkDefaults.find(([t])=>t===type)?.[1]||'#707A83',picker=colorPicker(body,{color:current.color||line?.color||fallback,opacity:current.opacity??line?.opacity??1,width:widths[0]??current.weight??4,used:pages.flatMap(p=>p.items.filter(i=>i.type==='path').map(i=>i.color))});picker.bindWidth(width);
 const bar=actions(body);button(bar,'Save link style',()=>{const weight=width.value!==initialWidth?{weight:lineWidthValue(width)}:{};setLegendStyle(type,details?.value||{},{...captions.value,color:picker.value,opacity:picker.opacity,...weight});picker.remember();close();say('Link style and matching legend entries saved.');},'primary');
 button(bar,'Reset link style',()=>{setLinkStyle(type,{title:type,description:'',lineTitle:type,lineDescription:'',color:fallback,opacity:1,weight:4});close();});button(bar,'Cancel',close);
}
$('link-styles').onclick=()=>task(()=>linkStyleOptions());
function layoutOptions(selected=pages[active]?.name){
 pageLayoutEditor({project,pages:buildPages(scoped(),{includeHidden:true}),selected,modal,field,button,close,apply(layout,include=[]){
  const previous=project;project={...project,devices:project.devices.map(d=>include.includes(d.id)?{...d,hidden:false,scopeOverride:true}:d),layout:cleanLayout(layout,project.devices.map(d=>d.id))};
  let prepared;try{prepared=buildDrawing();}catch(error){project=previous;throw error;}
  perform('page-layout',prepared);viewport.fit();say('Page names, device selections and layout saved. Undo is available.');
 }});
}
$('page-layout').onclick=()=>task(()=>layoutOptions());
function pageOptions(){
 const p=cleanPageNumbers(project.layout?.pageNumbers),setup=cleanPageSetup(project.layout?.pageSetup),body=modal('Page options');
 body.append(el('p','Change the visible page proportions for all drawings, a page group or one page. Existing diagram objects keep their positions and proportions, and a complete switch stack remains one page.','hint'));
 const target=field(body,'Apply visible page proportions to','page',[['page','Individual page'],['group','Page group'],['all','All pages (drawing default)']]);
 const groupRow=el('div'),pageRow=el('div');body.append(groupRow,pageRow);
 const group=field(groupRow,'Page group',familyOf(pages[active]),pageFamilies),page=field(pageRow,'Individual page',String(active),pages.map((item,i)=>[String(i),(item.displayName||item.name)+'  ('+(pageFamilies.find(([id])=>id===familyOf(item))?.[1]||familyOf(item))+')']));
 const paperRow=el('div','','form-columns');body.append(paperRow);
 const preset=field(paperRow,'Visible page proportions','dynamic',[['inherit','Inherit drawing default / page group'],['dynamic','Dynamic / Fit all'],...paperSizes.filter(([id])=>id!=='original')]);
 const orientation=field(paperRow,'Page orientation','landscape',[['landscape','Landscape'],['portrait','Portrait']]);
 const custom=el('div','','form-columns');body.append(custom);
 const width=field(custom,'Page width (mm)',297),height=field(custom,'Page height (mm)',420);
 for(const input of [width,height]){input.type='number';input.min=148;input.max=1500;input.step=.1;}
 const preview=el('p','','page-size-preview');body.append(preview);
 const visible=setup.visible,fitMode=field(body,'Content fit mode',visible.fitMode||'optimize',[['optimize','Auto-fit and optimize content'],['preserve','Preserve existing layout']]);
 body.append(el('p','Auto-fit uses the available page area, and network and wireless diagrams may choose better arrangements. Manually positioned devices and labels retain their saved positions. Preserve layout changes the page boundary without resizing or repacking content.','hint'));
 let selectedScope=target.value,selectedGroup=group.value,selectedPage=pages[active]?.name||'';
 const lookup=()=>selectedScope==='all'?visible.default:selectedScope==='group'?visible.groups[selectedGroup]:visible.pages[selectedPage];
 function store(){
  const inherit=preset.value==='inherit',value=cleanPaper({preset:preset.value,orientation:orientation.value,widthMm:+width.value,heightMm:+height.value});
  if(selectedScope==='all')visible.default=value;
  else if(selectedScope==='group'){if(inherit)delete visible.groups[selectedGroup];else visible.groups[selectedGroup]=value;}
  else if(selectedPage){if(inherit)delete visible.pages[selectedPage];else visible.pages[selectedPage]=value;}
 }
 function update(){
  const inherited=preset.value==='inherit';
  custom.hidden=preset.value!=='custom';orientation.disabled=inherited||preset.value==='dynamic';
  const paper=inherited?(selectedScope==='page'?visible.groups[familyOf(pages[Number(page.value)])]||visible.default:visible.default):cleanPaper({preset:preset.value,orientation:orientation.value,widthMm:+width.value,heightMm:+height.value});
  const shape=paperDimensions(paper);
  preview.textContent=shape?'Visible page: '+shape.widthMm.toFixed(1)+' x '+shape.heightMm.toFixed(1)+' mm proportions ('+paper.orientation+'). All existing content fits on one page without being rearranged.':'Dynamic / Fit all: keep the visible page tightly fitted around the complete drawing.';
 }
 function load(){
  groupRow.hidden=selectedScope!=='group';pageRow.hidden=selectedScope!=='page';
  const paper=lookup(),inherit=!paper&&selectedScope!=='all';
  preset.value=inherit?'inherit':(paper?.preset||'dynamic');orientation.value=paper?.orientation||'landscape';width.value=paper?.widthMm||297;height.value=paper?.heightMm||420;
  if(selectedScope==='all')preset.querySelector('option[value="inherit"]').disabled=true;
  else preset.querySelector('option[value="inherit"]').disabled=false;
  update();
 }
 target.onchange=()=>{store();selectedScope=target.value;load();};
 group.onchange=()=>{store();selectedGroup=group.value;load();};
 page.onchange=()=>{store();selectedPage=pages[Number(page.value)]?.name||'';load();};
 for(const input of [preset,orientation,width,height])input.oninput=update;
 load();
 const printing=el('details');printing.append(el('summary','Printing'));body.append(printing);
 const printSize=field(printing,'Print paper',setup.printPaper?.preset||'drawing',[['drawing','Match visible drawing page'],...paperSizes.filter(([id])=>id!=='original')]);
 const printOrientation=field(printing,'Print orientation',setup.printPaper?.orientation||'landscape',[['landscape','Landscape'],['portrait','Portrait']]);
 const printCustom=el('div','','form-columns');printing.append(printCustom);
 const printWidth=field(printCustom,'Print width (mm)',setup.printPaper?.widthMm||297),printHeight=field(printCustom,'Print height (mm)',setup.printPaper?.heightMm||420);
 for(const input of [printWidth,printHeight]){input.type='number';input.min=148;input.max=1500;input.step=.1;}
 function updatePrint(){printCustom.hidden=printSize.value!=='custom';printOrientation.disabled=printSize.value==='drawing';}
 printSize.onchange=updatePrint;updatePrint();
 printing.append(el('p','By default, print paper matches each visible page. Choose a separate output size here without changing the displayed drawing.','hint'));
 const numbering=el('details');numbering.append(el('summary','Page numbering'));body.append(numbering);
 const row=el('label','','check-option'),show=el('input');show.type='checkbox';show.checked=p.show;show.setAttribute('aria-label','Show page numbers');row.append(show,document.createTextNode('Show page numbers'));numbering.append(row);
 const numberRow=el('div','','form-columns');numbering.append(numberRow);
 const first=field(numberRow,'First page number',p.start),pad=field(numberRow,'Page number digits',p.pad,[[1,'1 - no padding'],[2,'01 - two digits'],[3,'001 - three digits']]),format=field(numbering,'Page number format',p.format);
 first.type='number';first.min=0;first.max=9999;first.step=1;format.maxLength=100;
 numbering.append(el('p','Available fields: {page}, {last}, {total}.','hint'));
 button(actions(body),'Save page options',()=>{
  if(preset.value==='custom'&&[width,height].some(input=>!input.value||!Number.isFinite(+input.value)||+input.value<148||+input.value>1500))throw Error('Enter custom visible page dimensions from 148 to 1500 mm.');
  if(printSize.value==='custom'&&[printWidth,printHeight].some(input=>!input.value||!Number.isFinite(+input.value)||+input.value<148||+input.value>1500))throw Error('Enter print dimensions from 148 to 1500 mm.');
  if(first.value===''||!Number.isInteger(+first.value)||+first.value<0||+first.value>9999)throw Error('Use a first page number from 0 to 9999.');
  if(show.checked&&!format.value.trim())throw Error('Enter a page number format.');
  store();visible.fitMode=fitMode.value;
  setup.printPaper=printSize.value==='drawing'?null:cleanPaper({preset:printSize.value,orientation:printOrientation.value,widthMm:+printWidth.value,heightMm:+printHeight.value});
  const before=project.layout;project.layout={...before,pageSetup:cleanPageSetup(setup),pageNumbers:cleanPageNumbers({show:show.checked,start:+first.value,pad:+pad.value,format:format.value})};
  let prepared;try{prepared=buildDrawing();}catch(error){project.layout=before;throw error;}
  perform('page-options',prepared);close();viewport.fit();say('Visible page proportions, print settings and page numbering saved. Diagram arrangement preserved.');
 },'primary');
}
$('page-options').onclick=()=>task(pageOptions);
function corePageChoices(){
 const named=(project.layout?.corePages||[]).map(page=>[page.id,displayPageName(project,page)]);
 const automatic=pages.filter(page=>page.coreDeviceIds).map((page,index)=>['@core:'+index,displayPageName(project,page)+' (current layout)']);
 return [['auto','Automatic'],['exclude','Exclude from core'],...named,...automatic,['new','New dedicated page']];
}
function assignedCorePage(id){
 return (project.layout?.coreExclude||[]).includes(id)?'exclude':project.layout?.corePages?.find(page=>page.devices.includes(id))?.id||'auto';
}
function assignCorePage(layout,device,choice){
 layout.corePages||=[];layout.coreExclude||=[];
 for(const page of layout.corePages)page.devices=page.devices.filter(id=>id!==device.id);
 layout.coreExclude=layout.coreExclude.filter(id=>id!==device.id);
 if(choice==='exclude'){layout.coreExclude.push(device.id);return;}
 if(choice==='auto')return;
 if(choice==='new'){
  layout.corePages.push({id:crypto.randomUUID(),name:device.name.slice(0,80),devices:[device.id],showReferences:true});
  return;
 }
 if(choice.startsWith('@core:')){
  const page=pages.filter(page=>page.coreDeviceIds)[Number(choice.slice(6))];
  if(!page)throw Error('The selected core page is no longer available.');
  const members=new Set([...page.coreDeviceIds,device.id]),source=layout.corePages.find(p=>p.id===page.corePageId);
  for(const existing of layout.corePages)existing.devices=existing.devices.filter(id=>!members.has(id));
  layout.corePages.push({id:crypto.randomUUID(),name:page.name,devices:[...members],showReferences:source?.showReferences!==false,hiddenReferences:[...(source?.hiddenReferences||[])]});
  return;
 }
 const target=layout.corePages.find(page=>page.id===choice);
 if(!target)throw Error('The selected core page is no longer available.');
 target.devices.push(device.id);
}
function changeCoreLayout(update){
 const previous=project.layout,next=structuredClone(previous||{});
 update(next);
 project.layout=next;
 let prepared;try{prepared=buildDrawing();}catch(error){project.layout=previous;throw error;}
 perform('project',prepared);arrange();
}
function arrange(){
 const body=modal('Device order and core pages');project.layout||=cleanLayout({},project.devices.map(d=>d.id));const layout=project.layout;
 const check=el('input');check.type='checkbox';check.checked=layout.includeAPs===true;check.id='core-aps';const title=el('label','Include access points on automatic core pages');title.htmlFor=check.id;line(body,check,title);
 check.onchange=()=>{layout.includeAPs=check.checked;perform();};
 const bar=actions(body);button(bar,'Add core page',()=>{layout.corePages||=[];layout.corePages.push({id:crypto.randomUUID(),name:'Core Network '+(layout.corePages.length+1),devices:[]});perform();arrange();});
 button(bar,'Use automatic pages',()=>{layout.corePages=[];layout.coreExclude=[];perform();arrange();});
 for(const page of layout.corePages||[]){
  const row=line(body);row.classList.add('core-page-settings');const nameCell=el('div'),referenceCell=el('div');row.append(nameCell,referenceCell);const input=field(nameCell,'Page name',displayPageName(project,page));input.setAttribute('aria-label','Core page name');
  input.onchange=()=>task(()=>changeCoreLayout(next=>{next.presentation||={defaults:{},pages:{}};next.presentation.pages||={};next.presentation.pages[page.name]={...next.presentation.pages[page.name],name:input.value.trim()||'Core Network'};}));
  const references=field(referenceCell,'Off-page connections',page.showReferences===false?'hide':'show',[['show','Show references'],['hide','Hide references']]);references.setAttribute('aria-label','Off-page connections for '+page.name);
  references.onchange=()=>task(()=>{try{changeCoreLayout(next=>{next.corePages.find(p=>p.id===page.id).showReferences=references.value==='show';});}catch(error){references.value=page.showReferences===false?'hide':'show';throw error;}});
  const members=new Set(page.devices),connections=project.links.filter(link=>members.has(link.a)!==members.has(link.b));
  if(connections.length){
   const detail=el('details');detail.append(el('summary','Choose off-page connections ('+connections.length+')'));body.append(detail);
   const names=new Map(project.devices.map(device=>[device.id,device.name]));
   for(const link of connections){
    const key=coreLinkKey(link),checked=!(page.hiddenReferences||[]).includes(key),toggle=el('input');
    toggle.type='checkbox';toggle.id='setting-'+(++fieldCount);toggle.checked=checked;toggle.disabled=page.showReferences===false;
    const caption=el('label',names.get(link.a)+' '+link.ap+' / '+names.get(link.b)+' '+link.bp);caption.htmlFor=toggle.id;line(detail,toggle,caption);
    toggle.onchange=()=>task(()=>{try{changeCoreLayout(next=>{
     const target=next.corePages.find(p=>p.id===page.id),hidden=new Set(target.hiddenReferences||[]);
     if(toggle.checked)hidden.delete(key);else hidden.add(key);
     target.hiddenReferences=[...hidden];
    });}catch(error){toggle.checked=checked;throw error;}});
   }
  }
  button(row,'Remove',()=>changeCoreLayout(next=>{next.corePages=next.corePages.filter(p=>p.id!==page.id);}));
 }
 body.append(el('h3','Devices'));
 for(const d of orderedDevices(project).filter(d=>!d.hidden)){
  const row=el('div','','arrange-row');const text=el('div',d.name,'arrange-name');text.append(el('small',d.model||d.kind));row.append(text);
  const select=el('select');select.setAttribute('aria-label','Core page for '+d.name);
  const options=corePageChoices();
  for(const [value,label] of options){const o=el('option',label);o.value=value;select.append(o);}
  select.value=assignedCorePage(d.id);
  select.onchange=()=>task(()=>{try{changeCoreLayout(next=>assignCorePage(next,d,select.value));}catch(error){select.value=assignedCorePage(d.id);throw error;}});
  row.append(select);addOrderControls(row,d,arrange);body.append(row);
 }
}
function rebuildEvidence(){composeEvidence(project);initialScope();for(const s of Object.values(project.stencils))assignMatching(s);evidenceSnapshot=snapshot();projectHistory.record(project,'imports');dirty=projectHistory.dirty;draw();}
function evidence(){
 const body=modal('Imported data');const sources=project.evidence?.sources||[];
 button(body,'Import files',()=>$('data-files').click(),'primary');
 if(!sources.length)body.append(el('p','Import Auvik reports, configurations or show-command captures to select the data used in this project.','hint'));
 for(const source of sources){
  const section=el('section','','source-card');const enabled=el('input');enabled.type='checkbox';enabled.checked=source.enabled;enabled.setAttribute('aria-label','Use '+source.name);
  const name=el('strong',source.name),row=line(section,enabled,name,el('span',source.kind,'asset-info'));
  enabled.onchange=()=>{source.enabled=enabled.checked;rebuildEvidence();evidence();};
  const cats=el('div','','category-options');
  for(const category of categories){const label=el('label'),input=el('input');input.type='checkbox';input.checked=(source.categories||categories).includes(category);input.setAttribute('aria-label',source.name+' '+category);label.append(input,document.createTextNode(category[0].toUpperCase()+category.slice(1)));cats.append(label);
   input.onchange=()=>{source.categories=(source.categories||categories).filter(c=>c!==category);if(input.checked)source.categories.push(category);rebuildEvidence();};}
  section.append(cats);
  if(source.kind==='Show commands'){
   const first=source.model.devices[0],target=field(section,'Apply local observations to',source.targetId||'',[['','Detected: '+(first?.name||'Unknown')],...project.devices.filter(d=>d.kind!=='ap').map(d=>[d.id,d.name])]);
   target.onchange=()=>{source.targetId=target.value;source.targetName=project.devices.find(d=>d.id===target.value)?.name;rebuildEvidence();};
  }
  const count=source.model.devices.length+' devices / '+source.model.links.length+' links';section.append(el('p',count,'asset-info'));
  for(const warning of source.model.warnings||[])section.append(el('p',warningText(warning),'hint'));
  button(section,'Remove import',()=>{project.evidence.sources=sources.filter(s=>s!==source);rebuildEvidence();evidence();});body.append(section);
 }
}
const warningText=x=>typeof x==='string'?x:(x?.message||x?.text||'Review imported evidence.');
function familyOf(page){return page?.family||pageFamily(page?.title||page?.name||'');}
// A single open group menu may be dismissed by an outside click or Escape.
// The handlers are installed once even though the navigation tabs are rebuilt.
function closePageGroupMenus(except=null){
 for(const menu of $('page-families').querySelectorAll('details.page-group[open]'))if(menu!==except)menu.open=false;
}
document.addEventListener('pointerdown',event=>{
 if(!event.target.closest('#page-families details.page-group'))closePageGroupMenus();
},true);
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 const opened=$('page-families').querySelector('details.page-group[open]');
 if(!opened)return;
 const focus=opened.querySelector('summary');closePageGroupMenus();focus?.focus();event.preventDefault();
},true);
let pageTabClickTimer=null;
function renamePageTab(page,button){
 if(!commitInlineEdit())return;
 clearTimeout(pageTabClickTimer);
 const previous=page.displayName||page.name,input=el('input');
 input.className='page-tab-rename';input.value=previous;input.maxLength=80;input.setAttribute('aria-label','Rename page '+previous);
 button.replaceChildren(input);button.title='Enter saves. Escape cancels.';
 let finished=false;
 const cancel=()=>{if(finished)return;finished=true;button.replaceChildren(previous);};
 const commit=()=>{
  if(finished)return;
  const name=input.value.trim();
  if(!name||name.length>80){input.setCustomValidity('Enter a page name up to 80 characters.');input.reportValidity();return;}
  if(pages.some(other=>other.name!==page.name&&(other.displayName||other.name).toLowerCase()===name.toLowerCase())){input.setCustomValidity('Another page already has that name.');input.reportValidity();return;}
  if(name===previous){cancel();return;}
  const before=project.layout,layout=structuredClone(before||{});
  layout.presentation||={defaults:{},pages:{}};layout.presentation.pages||={};
  layout.presentation.pages[page.name]={...layout.presentation.pages[page.name],name};
  project.layout=cleanLayout(layout,project.devices.map(device=>device.id));
  try{const prepared=buildDrawing();finished=true;perform('page-rename',prepared);say('Page renamed to '+name+'. Tab, page selector and drawing heading updated.');}
  catch(error){project.layout=before;cancel();say('Page rename failed: '+error.message);}
 };
 input.addEventListener('click',event=>event.stopPropagation());
 input.addEventListener('dblclick',event=>event.stopPropagation());
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit();}else if(event.key==='Escape'){event.preventDefault();cancel();}});
 input.addEventListener('blur',commit);
 input.focus({preventScroll:true});input.select();
}
function pageNavigation(){
 const navigation=$('page-navigation'),families=$('page-families'),picker=$('page-select');
 navigation.hidden=!pages.length;families.replaceChildren();picker.replaceChildren();
 const current=familyOf(pages[active]),labels=[...pageFamilies,['switchports','Switchport reports']],groups=[...new Set(pages.map(familyOf))];
 for(const group of groups){
  const entries=pages.map((page,index)=>({page,index})).filter(({page})=>familyOf(page)===group);
  const title=labels.find(([id])=>id===group)?.[1]||group;
  const menu=el('details','','page-group'),summary=el('summary',title+' ('+entries.length+')');
  summary.classList.toggle('active',group===current);
  summary.setAttribute('aria-label','Choose '+title+' page');
  const list=el('div','','page-group-menu');list.setAttribute('role','menu');list.setAttribute('aria-label',title+' pages');
  for(const {page,index} of entries){
   const item=el('button',page.displayName||page.name);
   item.type='button';item.setAttribute('role','menuitemradio');
   item.setAttribute('aria-checked',String(index===active));
   item.classList.toggle('active',index===active);
   item.onclick=()=>{if(!commitInlineEdit())return;menu.open=false;active=index;draw(pages);};
   list.append(item);
  }
  menu.addEventListener('toggle',()=>{if(menu.open)closePageGroupMenus(menu);});
  menu.append(summary,list);families.append(menu);
  const options=el('optgroup');options.label=title;
  for(const {page,index} of entries){const option=el('option',page.displayName||page.name);option.value=index;options.append(option);}
  picker.append(options);
 }
 picker.value=String(active);
 picker.onchange=()=>{if(!commitInlineEdit()){picker.value=String(active);return;}active=Number(picker.value);draw(pages);};
 $('page-position').textContent=pages.length?(active+1)+' / '+pages.length:'';
}
function draw(prepared){
 cancelBesidePick();
 $('site').value=project.name;$('heading').textContent=project.name;deviceList();
 const subset=scoped();const live=subset.devices.length>0;
 $('link-count').textContent='('+project.links.length+')';$('stats').textContent=subset.devices.length+' of '+project.devices.length+' devices   /   '+subset.links.length+' links';
 $('art-count').textContent=Object.keys(project.stencils).length+' local hardware shapes';$('hardware').title='Local stencil library: '+$('art-count').textContent;
 const tabs=$('tabs'),canvas=$('canvas');
 if(!tabs.dataset.wheelNavigation){tabs.dataset.wheelNavigation='1';tabs.addEventListener('wheel',event=>{if(tabs.scrollWidth>tabs.clientWidth&&Math.abs(event.deltaY)>Math.abs(event.deltaX)){tabs.scrollLeft+=event.deltaY;event.preventDefault();}},{passive:false});}
 const previousTabScroll=tabs.scrollLeft;
 try{const rebuilt=prepared||(live?buildDrawing(subset):[]);pages=rebuilt;drawingReady=pages.length>0;displayedProject=project;}catch(e){drawingReady=false;for(const id of ['export','export-menu','print','svg'])$(id).disabled=true;say('Diagram could not be rebuilt: '+e.message+(displayedProject===project&&pages.length?' The last valid drawing is retained. Undo the last change or correct its settings.':''));if(displayedProject===project&&pages.length){syncDrawingSelection();return;}pages=[];viewport.clear();canvas.replaceChildren(el('p','The drawing needs a layout correction. '+e.message,'error'));tabs.replaceChildren();pageNavigation();return;}
 tabs.replaceChildren();
 $('warnings').hidden=!project.warnings.length;$('warnings').textContent='Review '+project.warnings.length+' import '+(project.warnings.length===1?'note':'notes');
 active=Math.max(0,Math.min(active,pages.length-1));
 pageNavigation();
 pages.forEach((page,i)=>{if(familyOf(page)!==familyOf(pages[active]))return;
 const b=el('button',page.displayName||page.name);
 b.title='Double-click to rename this page. Use Pages & layout for additional settings.';
 b.ondblclick=event=>{event.preventDefault();clearTimeout(pageTabClickTimer);renamePageTab(page,b);};
 b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===active));b.classList.toggle('active',i===active);
 b.onclick=event=>{if(event.target.matches('.page-tab-rename')||event.detail>1)return;if(!commitInlineEdit())return;clearTimeout(pageTabClickTimer);if(i===active)return;pageTabClickTimer=setTimeout(()=>{active=i;draw(pages);},230);};
 tabs.append(b);
});
 tabs.scrollLeft=previousTabScroll;
 const selectedTab=tabs.querySelector('button.active');
 if(selectedTab){const left=selectedTab.offsetLeft-tabs.offsetLeft,right=left+selectedTab.offsetWidth;if(left<tabs.scrollLeft)tabs.scrollLeft=left;else if(right>tabs.scrollLeft+tabs.clientWidth)tabs.scrollLeft=right-tabs.clientWidth;}
 if(pages.length){const svg=new DOMParser().parseFromString(pages[active].svg,'image/svg+xml').documentElement;
  if(svg.localName!=='svg'){canvas.replaceChildren(el('p','Preview could not be rendered.'));}else viewport.show(pages[active].name,document.importNode(svg,true),pages[active]);}
 else if(!canvas.querySelector('#welcome')){viewport.clear();const welcome=el('div');welcome.id='welcome';welcome.append(el('p','NEW DRAWING','eyebrow'),el('h2','Build a site diagram'),el('p','Import device files or open the editable sample.'));button(welcome,'Open sample site',sample);canvas.replaceChildren(welcome);}
 for(const id of ['export','export-menu','print','svg'])$(id).disabled=!pages.length||working;
 $('port-map-options').hidden=!pages[active]?.portMap;syncDrawingSelection();
}
function cleanStencil(s){
 if(!object(s)||!safeKey(s.id)||typeof s.name!=='string'||!/^data:image\/(png|jpeg);base64,[0-9a-z+/]+=*$/i.test(s.dataUrl)||s.dataUrl.length>20e6||!(s.width>0&&s.height>0))throw Error('Invalid hardware shape.');
 const anchors=Object.create(null);for(const [k,v] of Object.entries(s.anchors||{})){if(safeKey(k)&&Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='number'&&n>=0&&n<=1))anchors[k]=v;}
 return {id:s.id,name:s.name.slice(0,200),models:Array.isArray(s.models)?s.models.filter(x=>typeof x==='string'&&x.length<=200):[],view:s.view==='rear'?'rear':'front',width:Number(s.width),height:Number(s.height),anchors,dataUrl:s.dataUrl,...(s.native?{native:cleanNativeArt(s.native)}:{})};
}
function loadProject(doc){
 if(doc?.format!=='NetworkDiagramStudio'||doc.schema!==1||!object(doc.project))throw Error('Choose a NetworkDiagramStudio project (schema 1).');
 const p=doc.project;if(/"(?:__proto__|constructor|prototype)"\s*:/.test(JSON.stringify(p)))throw Error('Invalid project property.');if(!Array.isArray(p.devices)||p.devices.length>2500||!Array.isArray(p.links)||p.links.length>25000)throw Error('Invalid project inventory.');
 const ids=new Set();
 for(const d of p.devices){if(!safeKey(d.id)||ids.has(d.id)||typeof d.name!=='string'||!modelKinds.includes(d.kind)||!Array.isArray(d.ports)||d.ports.length>12000||d.ports.some(x=>!object(x)||typeof x.name!=='string')||['vlans','routes','bridges'].some(k=>d[k]!=null&&!Array.isArray(d[k])))throw Error('Invalid device or duplicate ID.');ids.add(d.id);}
 for(const l of p.links)if(!ids.has(l.a)||!ids.has(l.b)||typeof l.ap!=='string'||typeof l.bp!=='string')throw Error('A connection has an invalid endpoint.');
 const shapes=Object.create(null);for(const s of Object.values(p.stencils||{})){const a=cleanStencil(s);shapes[a.id]=a;}
 if(p.evidence&&(!object(p.evidence.base)||!Array.isArray(p.evidence.sources)||p.evidence.sources.length>1000||p.evidence.sources.some(s=>!object(s.model)||!Array.isArray(s.model.devices)||!Array.isArray(s.model.links)||s.model.devices.length>2500||s.model.links.length>25000)))throw Error('Invalid imported-data records.');
 const knownIds=[...p.devices,...(p.evidence?.base.devices||[]),...(p.evidence?.sources||[]).flatMap(s=>s.model.devices)].map(d=>d.id);
 return {...emptyProject(),name:String(p.name||'Untitled site').slice(0,120),devices:p.devices,links:p.links,stencils:shapes,optics:object(p.optics)?p.optics:{},warnings:Array.isArray(p.warnings)?p.warnings.map(warningText):[],layout:cleanLayout(p.layout,knownIds),...(p.evidence?{evidence:p.evidence}:{})};
}
function initialScope(){
 const config=new Set(project.devices.filter(d=>d.fromConfig).map(d=>d.id));
 const kinds=new Map(project.devices.map(d=>[d.id,d.kind])),keep=new Set(config);
 for(const l of project.links){if(config.has(l.a)&&kinds.get(l.b)==='ap')keep.add(l.b);if(config.has(l.b)&&kinds.get(l.a)==='ap')keep.add(l.a);}
 for(const d of project.devices)d.hidden=typeof d.scopeOverride==='boolean'?!d.scopeOverride:config.size>0&&!keep.has(d.id);
}
async function ingest(files){
 const list=Array.from(files);if(!list.length)return;
 if(list.some(f=>f.size>160*1024*1024)||list.reduce((s,f)=>s+f.size,0)>300*1024*1024)throw Error('Choose a smaller batch (160 MB per file, 300 MB total).');
 say('Importing '+list.length+' file(s)…');await new Promise(r=>setTimeout(r,0));
 const workspaces=list.filter(file=>/\.spworkspace\.json$/i.test(file.name)),ordinary=list.filter(file=>!workspaces.includes(file)),inputs=await readSources(ordinary);
 await enrichSwitchportSources(ordinary,inputs,project.devices);
 const importedWorkspaces=[];for(const file of workspaces){const imported=await importSwitchportWorkspace(file);inputs.push({id:'input-'+crypto.randomUUID(),name:file.name,kind:'Configuration',enabled:true,categories:[...categories],model:imported.model});importedWorkspaces.push(imported);}
 captureEdits(project,evidenceSnapshot);
 for(const imported of importedWorkspaces){project.layout||={};project.layout.switchport={...project.layout.switchport,...imported.settings,deviceIds:[...new Set([...(project.layout.switchport?.deviceIds||[]),...imported.settings.deviceIds])]};}
 ensureEvidence(project).sources.push(...inputs);
 active=0;close();rebuildEvidence();say('Imported '+list.length+' file(s). Review categories under Imported data.');
}
function newProject(){if(!checkDiscard())return;viewport.reset();project=emptyProject();resetDrawingHistory();evidenceSnapshot=null;active=0;dirty=false;$('filter').value='';say('');draw();}
function sample(){if(!checkDiscard())return;viewport.reset();project=sampleSite();resetDrawingHistory();evidenceSnapshot=null;active=0;dirty=false;$('filter').value='';say('Fictional sample project opened.');draw();}
function devicePortFields(parent,device){
 const section=el('details'),list=el('div'),rows=[];
 section.append(el('summary','Edit ports'),el('p','Add an interface by name, or expand a port to edit its details. Use commas to separate tagged VLAN IDs.','hint'),list);
 parent.append(section);
 const normalize=name=>String(name??'').trim().toLowerCase();
 const connected=new Set(project.links.flatMap(link=>[
  ...(link.a===device.id?[normalize(link.ap)]:[]),
  ...(link.b===device.id?[normalize(link.bp)]:[])
 ]));
 function add(port,isNew=false){
  const box=el('details','','device-port'),title=el('summary'),grid=el('div','','compact-fields');
  const linked=connected.has(normalize(port.name));
  box.open=isNew;
  box.append(title,grid);list.append(box);
  const fields={};
  for(const [key,label] of [['name','Port name'],['description','Description'],['role','Role (e.g. access or trunk)'],['speed','Link speed (e.g. 1 Gbps)'],['native','Native VLAN'],['tagged','Tagged VLANs'],['mac','MAC address(es)']]){
   const cell=el('div','','compact-field');grid.append(cell);
   const value=key==='mac'?deviceMacs(port).join(', '):Array.isArray(port[key])?port[key].join(', '):port[key]??'';
   const input=field(cell,label,value);
   fields[key]={input,initial:input.value};
  }
  const name=fields.name.input;
  name.readOnly=linked;
  const refresh=()=>title.textContent=(name.value.trim()||'New port')+(fields.description.input.value.trim()?' | '+fields.description.input.value.trim():'');
  name.oninput=fields.description.input.oninput=refresh;refresh();
  const row={port,fields,box,isNew};rows.push(row);
  if(linked)box.append(el('p','Edit or remove the connection before renaming or removing this port.','hint'));
  else button(actions(box),'Remove port',()=>{rows.splice(rows.indexOf(row),1);box.remove();});
  if(isNew)name.focus();
 }
 for(const port of device.ports||[])add(port);
 button(actions(section),'Add port',()=>add({},true));
 return ()=>{
  const names=new Set();
  return rows.map(({port,fields,box,isNew})=>{
   const next={...port};
   try{
    for(const [key,{input,initial}] of Object.entries(fields)){
     if(input.value===initial&&!isNew)continue;
     const value=input.value.trim();
     if(key==='mac'){next.mac=inputMacAddresses(value);for(const alias of ['macs','macAddress','macAddresses','mac_address','mac_address(es)'])delete next[alias];continue;}
     if(!value){delete next[key];continue;}
     if(key==='native'||key==='tagged'){
      const ids=value.split(',').map(id=>id.trim());
      if((key==='native'&&ids.length!==1)||ids.some(id=>!/^\d+$/.test(id)||Number(id)<1||Number(id)>4094))throw Error('Enter VLAN IDs from 1 to 4094.');
      next[key]=key==='native'?Number(ids[0]):[...new Set(ids.map(Number))];
     }else next[key]=value;
    }
    const name=normalize(next.name);
    if(!name)throw Error('Enter a name for each port.');
    if(names.has(name))throw Error('Port names must be unique: '+next.name);
    names.add(name);
    return next;
   }catch(error){box.open=true;throw error;}
  });
 };
}
function editDevice(current,afterSave){
 const d=current||{name:'',kind:'switch',vendor:'',model:'',ip:'',ports:[],vlans:[],routes:[]},body=modal(current?'Device details':'Add device');
 const name=field(body,'Device name',d.name);const kind=field(body,'Device type',d.kind,deviceKindOptions),vendor=field(body,'Vendor',d.vendor),model=field(body,'Model',d.model),ip=field(body,'Management IP',d.ip),addresses=deviceMacs(d);
 let addressFields=body;if(addresses.length>1){addressFields=el('details');addressFields.append(el('summary','MAC addresses ('+addresses.length+')'));body.append(addressFields);addressFields.append(el('p','The diagram shows a count for multiple addresses. Review or edit the full list here.','hint'));}
 const mac=field(addressFields,'MAC address(es)',addresses.join(addresses.length>1?'\n':', '),addresses.length>1?'multiline':null);if(addresses.length>1)mac.rows=5;
 const models=el('datalist');models.id='known-hardware-models';const suggestions=new Map([...hardwareCatalog,...switchportCatalog.models.map(entry=>({sku:entry.sku,model:entry.name,vendor:entry.os})),...switchportCatalog.additionalModels.map(entry=>({sku:entry.sku,model:entry.name,vendor:entry.os})),...switchportCatalog.modules.map(entry=>({sku:entry.sku,model:entry.name,vendor:''})),...endpointHardwareCatalog.flatMap(entry=>entry.aliases.map(model=>({model,vendor:entry.vendor})))].map(entry=>[entry.sku||entry.model,entry]));for(const p of suggestions.values()){const o=el('option');o.value=p.sku||p.model;o.label=p.vendor+' '+p.model;models.append(o);}body.append(models);model.setAttribute('list',models.id);
 const platform=field(body,'Platform / technology',d.technology||''),platforms=el('datalist');platforms.id='known-device-platforms';for(const technology of [...new Set(endpointHardwareCatalog.map(entry=>entry.technology).filter(value=>value!=='Physical server'))]){const option=el('option');option.value=technology;platforms.append(option);}body.append(platforms);platform.setAttribute('list',platforms.id);
 const knowledge=el('p','','hint');body.insertBefore(knowledge,ip.previousElementSibling);let kindEdited=false;kind.onchange=()=>kindEdited=true;
 function hardwareKnowledge(fill=false){const known=matchEndpointHardware(model.value,vendor.value);const inferred=d.hardwareEvidence?.model===model.value.trim()?d.hardwareEvidence:null;knowledge.hidden=!known&&!inferred;knowledge.textContent=known?known.family+'. '+known.moduleGuidance:inferred?'Shared family layout: '+inferred.basis+'. Exact SKU is unconfirmed. Select the model from its hardware label when available.':'';if(known&&fill){if(!kindEdited&&(!current||kind.value==='unknown'))kind.value=known.kind;if(!vendor.value.trim())vendor.value=known.vendor;if(!platform.value.trim())platform.value=known.technology;}}
 model.onchange=()=>hardwareKnowledge(true);vendor.onchange=()=>hardwareKnowledge(false);hardwareKnowledge();
 const options=[['','Schematic front'],...Object.values(project.stencils).filter(a=>a.view!=='rear').map(s=>[s.id,s.name])];
 const shape=field(body,'Front-panel stencil',d.stencilId||'',options);
 const scale=field(body,'Device scale (%)',Math.round((d.scale||1)*100));scale.type='number';scale.min=10;scale.max=400;scale.step=5;
 const hardware=el('details');hardware.append(el('summary','Stack members and installed modules'));body.append(hardware);
 hardware.append(el('p','Confirm each member model and installed card. For 2920 rear bays A/B use J9731A (SFP+) or J9732A (copper). For Cisco network modules use slot NM. For 3560-E X2-1/X2-2 slots use CVR-X2-SFP or the installed X2 transceiver model. Leave unknown cards unassigned.','hint'));
 const memberRows=[],moduleRows=[],memberList=el('div'),moduleList=el('div');hardware.append(memberList);
 const hardwareRow=(parent,rows,values,columns)=>{
  const box=el('div','','hardware-row'),row={box};
  for(const [key,title] of columns){const cell=el('div','','hardware-field');box.append(cell);row[key]=field(cell,title,values[key]||'');if(key==='model')row[key].setAttribute('list',models.id);}
  button(box,'Remove',()=>{row.removed=true;box.remove();});parent.append(box);rows.push(row);
 };
 const memberRow=m=>hardwareRow(memberList,memberRows,m,[['id','Member number'],['model','Member model']]);
 for(const m of d.stackMembers||[])memberRow(m);button(hardware,'Add stack member',()=>memberRow({}));hardware.append(moduleList);
 const moduleRow=m=>hardwareRow(moduleList,moduleRows,m,[['member','Module member (blank for chassis)'],['slot','Module slot'],['model','Module model']]);
 for(const m of d.modules||[])moduleRow(m);button(hardware,'Add module',()=>moduleRow({}));
 const reportDetails=reportDetailFields(body,d,{el,field,members:()=>memberRows.filter(r=>!r.removed).map(r=>({id:r.id.value,model:r.model.value})),modules:()=>moduleRows.filter(r=>!r.removed).map(r=>({member:r.member.value,slot:r.slot.value,model:r.model.value}))});
 if(current&&project.evidence)button(hardware,'Use imported hardware',()=>{
  const original={evidence:structuredClone(project.evidence),devices:[],links:[],warnings:[]};original.evidence.edits={};composeEvidence(original);const imported=findDeviceIdentity(original.devices,d.id);
  if(!imported)throw Error('No enabled source contains hardware details for this device.');
  reportDetails();model.value=imported.model||'';vendor.value=imported.vendor||vendor.value;memberRows.splice(0);moduleRows.splice(0);memberList.replaceChildren();moduleList.replaceChildren();for(const member of imported.stackMembers||[])memberRow(member);for(const module of imported.modules||[])moduleRow(module);hardwareKnowledge();reportDetails.refresh();say('Imported hardware restored in this draft. Save device to apply it.');
 });
 const pageChoice=field(body,'Core page',assignedCorePage(d.id),corePageChoices());
 const readPorts=devicePortFields(body,d);
 let vlans,routes,bridges;
 const details=el('details');details.append(el('summary','Advanced VLANs and routing'));body.append(details);
 vlans=field(details,'VLANs',JSON.stringify(d.vlans||[],null,2),'multiline');
 routes=field(details,'Routes',JSON.stringify(d.routes||[],null,2),'multiline');bridges=field(details,'Virtual wire pairs / bridges',JSON.stringify(d.bridges||[],null,2),'multiline');
 const a=actions(body);button(a,'Save device',()=>{
  const n=name.value.trim();if(!n)throw Error('Enter a device name.');
  const id=d.id||deviceId(n);if(!safeKey(id)||(!current||n!==d.name)&&project.devices.some(old=>old!==current&&deviceId(old.name)===deviceId(n)))throw Error('Use a unique device name.');
  let data;try{data=[vlans,routes,bridges].map(input=>JSON.parse(input.value));}catch{throw Error('VLAN, route and bridge data must be valid JSON.');}
  if(data.some(arr=>!Array.isArray(arr)||arr.some(x=>!object(x))))throw Error('Use arrays of objects for VLANs, routes and bridges.');
  if(!(Number(scale.value)>=10&&Number(scale.value)<=400))throw Error('Use a device scale from 10 to 400 percent.');
  const composition=hardwareComposition(memberRows.filter(r=>!r.removed).map(r=>({id:r.id.value,model:r.model.value})),moduleRows.filter(r=>!r.removed).map(r=>({member:r.member.value,slot:r.slot.value,model:r.model.value})));
  const macValue=inputMacAddresses(mac.value);
  const next={...d,...composition,id,name:n,kind:kind.value,vendor:vendor.value.trim(),model:model.value.trim(),technology:platform.value.trim(),ip:ip.value.trim(),mac:macValue,stencilId:shape.value,scale:Number(scale.value)/100,reportDetails:reportDetails(),ports:readPorts(),vlans:data[0],routes:data[1],bridges:data[2]};for(const alias of ['macs','macAddress','macAddresses','mac_address','mac_address(es)'])delete next[alias];if(model.value.trim()!==d.model){delete next.sku;delete next.hardwareEvidence;delete next.hardwareFamily;delete next.family;}const known=matchEndpointHardware(next.model,next.vendor);if(known){next.hardwareFamily=known.id;next.family=known.family;}if(!current)next.scopeOverride=true;
  const before={devices:project.devices,stencils:project.stencils,layout:project.layout};
  try{project.devices=project.devices.map(old=>old===current?next:{...old});if(!current)project.devices.push(next);project.stencils=Object.fromEntries(Object.entries(project.stencils).map(([id,s])=>[id,{...s,models:[...(s.models||[])]}]));
   const key=modelKey(next.vendor,next.model);if(key&&shape.value){for(const s of Object.values(project.stencils))s.models=s.models.filter(k=>k!==key);project.stencils[shape.value].models.push(key);assignMatching(project.stencils[shape.value]);}
   if(pageChoice.value!==assignedCorePage(d.id)){project.layout=structuredClone(project.layout||{});assignCorePage(project.layout,next,pageChoice.value);}
   const prepared=validateDrawing();perform('devices',prepared);close();say('Device saved.');afterSave?.();
  }catch(error){Object.assign(project,before);throw error;}
 },'primary');
 if(current)button(a,'Remove device',()=>{removeDevices([d.id]);close();});
}
function reviewLinks(){
 const body=modal('Connections');const accounts=new Map(project.devices.map(d=>[d.id,d.name]));button(body,'Add connection',()=>editLink());
 if(!project.links.length)body.append(el('p','No links imported. Add a connection using the local and remote interface names.','hint'));
 project.links.forEach((l,i)=>{const text=el('div');text.append(el('strong',(accounts.get(l.a)||l.a)+' '+l.ap+'  /  '+(accounts.get(l.b)||l.b)+' '+l.bp),el('div',[l.media||'Media unspecified',l.speed,l.status,l.physicalEvidence?.kind==='alternate-interface'?'Alternate observation: '+l.physicalEvidence.reason:!physicalLink(l,project.devices)?'Logical observation - retained in data tables':'' ].filter(Boolean).join('  |  '),'asset-info'));const row=line(body,text);button(row,'Edit',()=>editLink(i));});
}
function connectionFields(parent,link,{onMediaChange,mixed=false}={}){
 const keep='__keep_connection_value__',choices=(catalog,value)=>mixed&&value===null?[[keep,'Mixed - keep existing'],...connectionChoices(catalog,'')]:connectionChoices(catalog,value),initial=(catalog,value)=>mixed&&value===null?keep:connectionValue(catalog,value);
 const grid=el('div','','compact-fields');parent.append(grid);const cell=(title,value,options)=>{const box=el('div','','compact-field');grid.append(box);return {box,input:field(box,title,value,options)};};
 const media=cell('Cable type',initial(cableTypes,link.media),choices(cableTypes,link.media)),speed=cell('Link speed',initial(linkSpeeds,link.speed),choices(linkSpeeds,link.speed));
 const mediaCustom=cell('Custom cable type',link.media||''),speedCustom=cell('Custom link speed',link.speed||'');mediaCustom.input.maxLength=160;speedCustom.input.maxLength=80;
 function refresh(){mediaCustom.box.hidden=media.input.value!==customConnectionValue;speedCustom.box.hidden=speed.input.value!==customConnectionValue;try{onMediaChange?.(cleanConnectionDetails({media:media.input.value,mediaCustom:mediaCustom.input.value,speed:''}).media);}catch{}}
 media.input.onchange=refresh;mediaCustom.input.oninput=refresh;speed.input.onchange=refresh;refresh();
 return {get value(){const value=cleanConnectionDetails({media:media.input.value===keep?'unknown':media.input.value,mediaCustom:mediaCustom.input.value,speed:speed.input.value===keep?'':speed.input.value,speedCustom:speedCustom.input.value});if(media.input.value===keep)delete value.media;if(speed.input.value===keep)delete value.speed;return value;}};
}
function drawingConnection(item){return project.links.find(link=>sameConnection(link,item.sourceLink))||item.sourceLink||{};}
function connectionType(link){const ap=[link.a,link.b].some(id=>project.devices.find(d=>d.id===id)?.kind==='ap');return connectionMediaInfo(link.media,ap);}
function saveConnection(index,link,{drawing=null,patch=null,style=null}={}){
 const old=project.links[index]||drawing?.sourceLink||{},before={devices:project.devices,links:project.links,layout:project.layout},sameEnds=sameConnection(old,link),oldPaths=pages.flatMap(page=>page.items.filter(item=>item.type==='path'&&sameConnection(item.sourceLink,old)).map(item=>({page:page.title,key:item.editKey,patch:project.layout?.drawingEdits?.[item.editKey],selected:item.editKey===drawing?.editKey}))),oldType=connectionType(old).name;
 try{Object.assign(project,prepareConnection(project,link,index,drawing?.generatedDevice));const edits=cleanDrawingEdits(project.layout?.drawingEdits);for(const old of oldPaths)delete edits[old.key];project.layout={...project.layout,drawingEdits:edits};
  const rebuilt=buildPages(scoped());let selectedType=null;
  for(const page of rebuilt)for(const path of page.items.filter(item=>item.type==='path'&&sameConnection(item.sourceLink,link))){const previous=oldPaths.find(old=>old.page===page.title)||oldPaths[0],next={...(previous?.patch||{})};if(!sameEnds)delete next.points;if(path.linkType!==oldType){delete next.color;delete next.opacity;}if(previous?.selected&&patch)Object.assign(next,patch);if(Object.keys(next).length)edits[path.editKey]=next;if(previous?.selected)selectedType=path.linkType;}
  if(style){const type=selectedType||connectionType(link).name;project.layout={...project.layout,...changeLinkStyle(project,rebuilt,type,style)};}
  const prepared=validateDrawing();perform('connection',prepared);
 }catch(error){Object.assign(project,before);throw error;}
}
function editLink(i=-1,drawing=null){
 if(project.devices.length<2){say('Add or import at least two devices first.');return;}
 const l=project.links[i]||drawing?.sourceLink||{},devices=[...project.devices];if(drawing?.generatedDevice&&!devices.some(d=>d.id===drawing.generatedDevice.id))devices.push(drawing.generatedDevice);
 const body=modal(i<0&&!drawing?'Add connection':'Configure connection','compact-color-dialog'),opts=devices.map(d=>[d.id,d.name]),grid=el('div','','compact-fields');body.append(grid);
 const property=(title,value,options)=>{const cell=el('div','','compact-field');grid.append(cell);return field(cell,title,value,options);};
 const a=property('First device',l.a||opts[0][0],opts),b=property('Second device',l.b||opts[1][0],opts),ap=property('First port','',[]),bp=property('Second port','',[]),apCustom=property('First custom port',''),bpCustom=property('Second custom port','');
 function choices(dev,input,custom,initial){
  const device=devices.find(d=>d.id===dev.value),ports=connectionPorts(project,device);if(initial&&!ports.some(p=>p.name===initial))ports.unshift({name:initial});
  input.replaceChildren(...ports.map(p=>{const option=el('option',p.name+(p.description?' - '+p.description:''));option.value=p.name;return option;}));const option=el('option','Custom port');option.value='__custom_port__';input.append(option);input.value=initial||ports[0]?.name||'__custom_port__';custom.value='';custom.parentElement.hidden=input.value!=='__custom_port__';input.onchange=()=>custom.parentElement.hidden=input.value!=='__custom_port__';
 }
 choices(a,ap,apCustom,l.ap);choices(b,bp,bpCustom,l.bp);a.onchange=()=>choices(a,ap,apCustom,'');b.onchange=()=>choices(b,bp,bpCustom,'');
 body.append(el('p','Choose a mapped socket or enter a custom interface name. Unmapped ports attach at the device boundary. Endpoint changes recalculate the route.','hint'));
 const details=connectionFields(body,l),status=field(body,'Status',l.status||'confirmed',Array.from(new Set(['confirmed','inferred','unverified',l.status].filter(Boolean))));
 const bar=actions(body);button(bar,'Save connection',()=>{const link={...l,...details.value,a:a.value,ap:(ap.value==='__custom_port__'?apCustom.value:ap.value).trim(),b:b.value,bp:(bp.value==='__custom_port__'?bpCustom.value:bp.value).trim(),status:status.value};saveConnection(i,link,{drawing});say('Connection type, speed and endpoints saved.');close();},'primary');
 if(i>=0)button(bar,'Remove connection',()=>{project.links=project.links.filter((_,index)=>index!==i);perform();reviewLinks();});
}
function editAnchors(shape){
 const body=modal(shape.name),port=field(body,'Interface name',''),known=field(body,'Mapped ports','',[]);
 const tools=el('div','','port-zoom-tools');body.append(tools);let zoom=1,space=false,gesture=null,place=false;
 const view=el('div','','anchor-viewport');view.tabIndex=0;view.setAttribute('aria-label','Port mapping canvas');view.setAttribute('role','group');
 const map=el('div','','anchor-map'),image=el('img');image.src=shape.dataUrl;image.alt=shape.name;image.draggable=false;map.append(image);view.append(map);body.append(view);
 const coordinates=el('div','','form-grid');body.append(coordinates);const x=field(coordinates,'Horizontal position (%)',''),y=field(coordinates,'Vertical position (%)','');for(const input of [x,y]){input.type='number';input.min=0;input.max=100;input.step=.001;}
 const count=el('p','','asset-info');count.setAttribute('role','status');body.append(count);
 const selection=field(body,'Ports to align','',[]);selection.multiple=true;selection.size=7;const selected=new Set(),portScope='ports:'+shape.id;modalHistoryScope=portScope;
 body.append(el('p','Drag a box over ports to select them. Shift adds to the selection; Ctrl toggles ports. Drag a selected port to move the group. Arrow keys move 1 screen pixel; Shift moves 10 and Ctrl moves 0.1. Scroll to zoom. Hold Space or the middle mouse button to pan. Choose Place port to map a new socket.','hint'));
 function current(key){if(!shape.anchors[key])return;port.value=key;known.value=key;x.value=(shape.anchors[key][0]*100).toFixed(3);y.value=(shape.anchors[key][1]*100).toFixed(3);}
 function markers(){for(const n of map.querySelectorAll('.anchor-dot'))n.remove();for(const [key,[px,py]] of Object.entries(shape.anchors)){const dot=el('button','','anchor-dot'+(selected.has(key)?' selected':''));dot.type='button';dot.dataset.port=key;dot.style.left=px*100+'%';dot.style.top=py*100+'%';dot.title=key;dot.setAttribute('aria-label','Mapped port '+key);dot.setAttribute('aria-pressed',String(selected.has(key)));dot.onclick=e=>e.preventDefault();map.append(dot);}}
 function refresh(){
  if(!project.stencils[shape.id]){hardware();return;}shape=project.stencils[shape.id];
  known.replaceChildren(...[['','Select a port'],...Object.keys(shape.anchors).map(k=>[k,k])].map(([value,name])=>{const o=el('option',name);o.value=value;return o;}));known.value=port.value;
  selection.replaceChildren(...Object.entries(shape.anchors).map(([k,p])=>{const o=el('option',k+'  ('+(p[0]*100).toFixed(2)+'%, '+(p[1]*100).toFixed(2)+'%)');o.value=k;o.selected=selected.has(k);return o;}));markers();count.textContent=selected.size+' selected / '+Object.keys(shape.anchors).length+' mapped ports.';
 }
 function changed(message){perform(portScope);refresh();if(shape.anchors[port.value])current(port.value);count.textContent=message+' '+count.textContent;}
 modalHistoryRefresh=refresh;
 selection.onchange=()=>{selected.clear();for(const o of selection.selectedOptions)selected.add(o.value);if(selected.size)current([...selected][0]);markers();count.textContent=selected.size+' selected / '+Object.keys(shape.anchors).length+' mapped ports.';};
 function size(){const base=Math.max(20,Math.min(view.clientWidth-22,(view.clientHeight-22)*shape.width/shape.height));map.style.width=base*zoom+'px';level.textContent=Math.round(zoom*100)+'%';}
 function scale(factor,cx,cy){const r=view.getBoundingClientRect(),old=image.getBoundingClientRect();cx??=r.left+r.width/2;cy??=r.top+r.height/2;const px=(cx-old.left)/old.width,py=(cy-old.top)/old.height;zoom=Math.max(.5,Math.min(16,zoom*factor));size();const next=image.getBoundingClientRect();view.scrollLeft+=next.left+px*next.width-cx;view.scrollTop+=next.top+py*next.height-cy;}
 button(tools,'-',()=>scale(1/1.25)).setAttribute('aria-label','Zoom port mapper out');const level=el('span','100%');level.setAttribute('aria-label','Port mapping zoom');tools.append(level);button(tools,'+',()=>scale(1.25)).setAttribute('aria-label','Zoom port mapper in');button(tools,'Fit device',()=>{zoom=1;size();view.scrollLeft=0;view.scrollTop=0;});
 const mode=button(tools,'Place port',()=>{place=!place;mode.setAttribute('aria-pressed',String(place));view.classList.toggle('placing',place);});mode.setAttribute('aria-pressed','false');
 image.onload=()=>size();requestAnimationFrame(size);
 view.addEventListener('wheel',e=>{e.preventDefault();scale(Math.exp(-e.deltaY*.0015),e.clientX,e.clientY);},{passive:false});
 const position=e=>{const r=image.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];};
 view.onpointerdown=e=>{
  if(![0,1].includes(e.button))return;view.focus({preventScroll:true});e.preventDefault();const dot=e.target.closest('.anchor-dot'),key=dot?.dataset.port;
  const kind=e.button===1||space?'pan':key?'port':place?'place':'box';
  gesture={kind,id:e.pointerId,start:[e.clientX,e.clientY],point:position(e),scroll:[view.scrollLeft,view.scrollTop],before:JSON.parse(JSON.stringify(shape.anchors)),selected:new Set(selected),key,moved:false,add:e.shiftKey,toggle:e.ctrlKey||e.metaKey};
  if(kind==='port'){if(!selected.has(key)){if(!gesture.add&&!gesture.toggle)selected.clear();selected.add(key);}current(key);markers();}
  if(kind==='box'){const box=el('div','','port-selection-box');map.append(box);gesture.box=box;}
  view.setPointerCapture(e.pointerId);
 };
 view.onpointermove=e=>{
  const g=gesture;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.start[0],dy=e.clientY-g.start[1];if(!g.moved&&Math.hypot(dx,dy)>3){g.moved=true;}
  if(g.kind==='pan'){view.scrollLeft=g.scroll[0]-dx;view.scrollTop=g.scroll[1]-dy;return;}if(!g.moved)return;
  if(g.kind==='port'){const r=image.getBoundingClientRect();shape.anchors=moveAnchors(g.before,[...selected],dx/r.width,dy/r.height);markers();current(g.key);}
  if(g.kind==='box'){const p=position(e),a=g.point,b=g.box;b.style.left=Math.min(a[0],p[0])*100+'%';b.style.top=Math.min(a[1],p[1])*100+'%';b.style.width=Math.abs(p[0]-a[0])*100+'%';b.style.height=Math.abs(p[1]-a[1])*100+'%';const inside=selectedInBox(shape.anchors,a,p);selected.clear();if(g.add||g.toggle)for(const k of g.selected)selected.add(k);for(const k of inside)if(g.toggle&&g.selected.has(k))selected.delete(k);else selected.add(k);markers();count.textContent=selected.size+' ports selected.';}
 };
 view.onpointerup=e=>{
  const g=gesture;if(!g||g.id!==e.pointerId)return;gesture=null;if(view.hasPointerCapture(e.pointerId))view.releasePointerCapture(e.pointerId);g.box?.remove();
  if(g.kind==='port'&&g.moved){changed('Ports moved.');return;}
  if(g.kind==='port'){if(g.toggle&&g.selected.has(g.key))selected.delete(g.key);else if(!g.add&&!g.toggle){selected.clear();selected.add(g.key);}current(g.key);}
  if(g.kind==='box'&&!g.moved&&!g.add&&!g.toggle)selected.clear();
  if(g.kind==='place'&&!g.moved){const p=position(e);x.value=(p[0]*100).toFixed(3);y.value=(p[1]*100).toFixed(3);task(savePoint);}
  if(selected.size)current([...selected][0]);refresh();
 };
 view.onpointercancel=()=>{const g=gesture;if(!g)return;gesture=null;g.box?.remove();if(g.kind==='port'&&g.moved){shape.anchors=g.before;}selected.clear();for(const k of g.selected)selected.add(k);refresh();};
 view.onkeydown=e=>{
  if(e.key===' '){space=true;e.preventDefault();return;}if(e.key==='Escape'){selected.clear();refresh();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();for(const k of Object.keys(shape.anchors))selected.add(k);refresh();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();task(()=>drawingHistory(e.shiftKey,false,portScope));return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(!selected.size)return;const step=movementStep(e),r=image.getBoundingClientRect();shape.anchors=moveAnchors(shape.anchors,[...selected],(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)/r.width,(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)/r.height);changed('Ports nudged.');}
 };
 view.onkeyup=e=>{if(e.key===' ')space=false;};view.onblur=()=>space=false;
 function savePoint(){const k=port.value.trim(),px=Number(x.value)/100,py=Number(y.value)/100;if(!safeKey(k)||!x.value||!y.value||![px,py].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('Enter a port and positions from 0 to 100 percent.');shape.anchors[k]=[px,py];selected.add(k);changed(k+' mapped.');}
 known.onchange=()=>{const key=known.value;if(!key)return;selected.clear();selected.add(key);current(key);refresh();};
 const align=actions(body);for(const [name,action] of [['Align row','row'],['Align column','column'],['Equal horizontal spacing','space-x'],['Equal vertical spacing','space-y']])button(align,name,()=>{const next=arrangeAnchors(shape.anchors,[...selected],action,port.value);shape.anchors=next;changed('Port positions arranged.');});
 button(align,'Select all ports',()=>{for(const k of Object.keys(shape.anchors))selected.add(k);refresh();});button(align,'Clear selection',()=>{selected.clear();refresh();});button(align,'Undo port change',()=>drawingHistory(false,false,portScope));button(align,'Redo port change',()=>drawingHistory(true,false,portScope));button(align,'Undo all port changes',()=>drawingHistory(false,true,portScope));
 const controls=actions(body);button(controls,'Save port position',savePoint);button(controls,'Remove port position',()=>{delete shape.anchors[port.value.trim()];selected.delete(port.value.trim());changed('Port removed.');});refresh();button(actions(body),'Done',hardware);
}
function assignMatching(shape){
 for(const d of project.devices){if(!d.stencilId&&matchesHardware(shape,d))d.stencilId=shape.id;}
}
async function stencilCatalog(file){
 const path=filePath(file);if(openCatalogs.has(path)){const cached=openCatalogs.get(path);if(cached.size===file.size&&cached.modified===file.lastModified){openCatalogs.delete(path);openCatalogs.set(path,cached);return cached.cat;}openCatalogs.delete(path);stencilIndexes.delete(path);}
 const cat=await openVisioCatalog(file);stencilIndexes.set(path,cat.items.map(i=>({...i})));openCatalogs.set(path,{cat,size:file.size,modified:file.lastModified});while(openCatalogs.size>(file.size>20*1024*1024?1:3))openCatalogs.delete(openCatalogs.keys().next().value);return cat;
}
async function deviceStencil(device){
 stencilDevice=device.id;const body=modal('Stencil for '+device.name),generation=modalGeneration;body.append(el('p',[device.vendor,device.model,device.sku].filter(Boolean).join('  |  '),'hint'));
 const query=field(body,'Search stencil names or model',device.sku||device.model||'');query.type='search';
 body.append(el('p','Searches local stencil files you have selected. Vendor search matches vendor names in file or folder paths; it does not search the internet.','hint'));
 const status=el('p','','hint'),results=el('div');status.setAttribute('role','status');body.append(status,results);
 const bar=actions(body);button(bar,'Import stencil folder',()=>$('art-folder').click());button(bar,'Import shapes',()=>$('art-file').click());button(bar,'Device details',()=>editDevice(device));
 const match=name=>{const norm=v=>String(v).toUpperCase().replace(/[^A-Z0-9]/g,'');const q=norm(query.value);return !q||norm(name).includes(q)||matchesHardware({name,view:'front'},device)&&q===norm(device.sku||device.model);};
 function assign(shape){const s=cleanStencil(shape);project.stencils[s.id]=s;device.stencilId=s.id;const key=modelKey(device.vendor,device.model);if(key&&!s.models.includes(key))s.models.push(key);assignMatching(s);perform();close();say('Assigned '+s.name+' to '+device.name+'.');}
 function render(){results.replaceChildren();let count=0;
  for(const s of Object.values(project.stencils).filter(s=>s.view!=='rear'&&match(s.name))){const info=el('div');info.append(el('strong',s.name),el('div','Loaded hardware','asset-info'));const row=line(results,info);button(row,'Preview / assign',()=>preview(s));count++;}
  outer:for(const file of discoveredStencils)for(const item of stencilIndexes.get(filePath(file))||[]){if(count>=120)break outer;if(!match(item.name)||/\b(rear|back)\b/i.test(item.name))continue;const info=el('div');info.append(el('strong',item.name),el('div',filePath(file),'asset-info'));const row=line(results,info);button(row,'Preview / assign',async()=>{status.textContent='Loading '+item.name;const cat=await stencilCatalog(file),s=await cat.load(item.key);preview(s);});count++;}
  if(!count)results.append(el('p',discoveredStencils.length?'No matching master is indexed. Search all selected folders or change the model search.':'No stencil folder is selected. Use Import stencil folder or Import shapes to load local files.','hint'));
 }
 function preview(shape){const p=modal('Assign '+shape.name);const img=el('img');img.className='panel-img';img.src=shape.dataUrl;img.alt=shape.name;p.append(img,el('p',Object.keys(shape.anchors).length+' mapped ports','hint'));button(actions(p),'Assign to '+device.name,()=>assign(shape),'primary');button(actions(p),'Back to search',()=>deviceStencil(device));}
 query.oninput=render;
 async function index(all=false){if(!discoveredStencils.length){status.textContent='No local stencil files to search. Choose Import stencil folder first. This search does not search the internet.';return;}const vendor=(device.vendor||'').toLowerCase(),terms=/aruba|hpe|hp/.test(vendor)?['aruba','hpe']:vendor.includes('forti')?['forti']:vendor?vendor.split(/\s+/):[];
  const files=all?discoveredStencils:discoveredStencils.filter(f=>terms.some(t=>filePath(f).toLowerCase().includes(t)));
  if(!files.length){status.textContent='No selected stencil filenames match '+(device.vendor||'this device vendor')+'. Use Search all selected folders to search every local stencil.';return;}
  let indexed=0;for(const file of files){if(!$('dialog').open||modalGeneration!==generation)return;status.textContent='Searching '+(++indexed)+' / '+files.length+': '+filePath(file);await new Promise(r=>setTimeout(r,0));try{if(!stencilIndexes.has(filePath(file)))await stencilCatalog(file);}catch(e){stencilResults.push({path:filePath(file),message:e.message});}if(modalGeneration!==generation)return;render();}
  status.textContent='Searched '+files.length+' stencil files. '+stencilResults.length+' import results available under Hardware.';
 }
 button(bar,'Search selected vendor files',()=>index(false),'primary');button(bar,'Search all selected folders',()=>index(true));render();
 if(discoveredStencils.length)await index(false);
}
function editCablePoints(item){
 if(!item)return;let points=item.points.map(p=>[...p]);const body=modal('Edit cable bend points');body.append(el('p','Port endpoints stay attached. Moving a bend adjusts adjacent segments to keep the cable horizontal and vertical.','hint'));
 const area=el('div');body.append(area);
 function render(){
  area.replaceChildren();const table=el('table','','bend-table'),head=el('tr');for(const name of ['Point','X','Y','Action'])head.append(el('th',name));table.append(head);
  points.forEach((p,i)=>{const row=el('tr'),end=i===0||i===points.length-1;row.append(el('th',end?(i===0?'Start port':'End port'):'Bend '+i));
   const inputs=p.map((v,axis)=>{const td=el('td'),n=el('input');n.type='number';n.step=1;n.value=Math.round(v*100)/100;n.disabled=end;n.setAttribute('aria-label',(end?(i===0?'Start port':'End port'):'Bend '+i)+' '+(axis?'Y':'X'));td.append(n);row.append(td);return n;});
   if(!end)for(const n of inputs)n.onchange=()=>task(()=>{if(inputs.some(n=>n.value===''))throw Error('Enter both bend coordinates.');points=moveCablePoint(points,i,+inputs[0].value,+inputs[1].value,{merge:0});render();});
   const td=el('td');if(!end)button(td,'Remove',()=>{points=removeCablePoint(points,i);render();});else td.textContent='Attached';row.append(td);table.append(row);
  });area.append(table);
  const grid=el('div','','form-grid');area.append(grid);const segment=field(grid,'Segment to add bends',0,points.slice(1).map((p,i)=>[i,'Segment '+(i+1)+' ('+Math.round(points[i][0])+', '+Math.round(points[i][1])+' to '+Math.round(p[0])+', '+Math.round(p[1])+')'])),offset=field(grid,'Bend offset (page units)',20);offset.type='number';offset.step=1;
  button(actions(area),'Add bends',()=>{if(offset.value===''||!Number.isFinite(+offset.value)||+offset.value===0)throw Error('Use a nonzero bend offset.');points=addCableBends(points,+segment.value,+offset.value);render();});
 }
 render();const bar=actions(body);button(bar,'Save bend points',()=>{cablePoint=-1;changeCablePoints(item,points);close();say('Cable bend points saved.');},'primary');button(bar,'Cancel',close);
}
function editDrawingObject(key){
 const page=pages[active];if(!page)return;const objects=drawingObjects(page),item=objects.find(i=>i.editKey===key)||objects[0];if(!item)return;
 const linkedSwatch=item.legendEntry&&item.type==='rect',hasPicker=['path','text','arttext'].includes(item.type)||linkedSwatch,body=modal('Edit drawing object',hasPicker?'compact-color-dialog':''),options=objects.map((i,n)=>[i.editKey,(i.parent?'Panel detail: ':'')+(i.value||i.name||i.type+' '+(n+1)).slice(0,100)]);
 const select=field(body,'Drawing object',item.editKey,options);select.onchange=()=>editDrawingObject(select.value);
 const normalized=item.normalized,factor=normalized?100:1,grid=el('div','',hasPicker?'compact-fields':'form-grid');body.append(grid);const inputs={};
 const property=(where,name,value,opts)=>{if(!hasPicker)return field(where,name,value,opts);const cell=el('div','','compact-field');where.append(cell);return field(cell,name,value,opts);};
 for(const k of ['path','vector'].includes(item.type)||linkedSwatch?[]:item.type==='arttext'?['w']:['w','h']){inputs[k]=property(grid,({w:'Width',h:'Height'})[k]+(normalized?' (%)':''),Math.round(item[k]*factor*1000)/1000);inputs[k].type='number';inputs[k].step=normalized?.1:1;}
 if(['text','arttext'].includes(item.type)){inputs.value=field(body,'Text',editableText(item),'multiline');inputs.value.rows=2;const style=el('div','','compact-fields compact-text-style');body.append(style);inputs.size=property(style,item.type==='arttext'?'Font size (% of panel width)':'Font size',item.type==='arttext'?item.size*100:item.size);inputs.size.type='number';inputs.bold=property(style,'Weight',item.bold?'true':'false',[['false','Regular'],['true','Bold']]);inputs.align=property(style,'Alignment',item.align||'left',['left','center','right']);}
 else inputs.name=property(hasPicker?grid:body,'Object name',item.name||'');
 const labelRotation=item.labelRole&&item.relatedCableKey?field(body,'Connection label rotation',project.layout?.drawingEdits?.[item.editKey]?.rotationMode==='fixed'?String(Math.round((project.layout.drawingEdits[item.editKey].angle||0)*180/Math.PI)):'auto',[['auto','Follow cable automatically'],['0','Horizontal (0 degrees)'],['90','Vertical (90 degrees)'],['180','Reverse horizontal (180 degrees)'],['-90','Reverse vertical (-90 degrees)']]):null;
 const initialWeight=linkedSwatch?item.sampleWeight??item.h:item.weight||1;
 if(['rect','path','vector'].includes(item.type)){inputs.weight=property(hasPicker?grid:body,'Line width',initialWeight);inputs.weight.type='number';inputs.weight.step=.1;inputs.weight.min=.1;inputs.weight.max=12000;}
 let picker=null,captions=null,currentType=item.linkType;
 const connection=item.type==='path'&&item.sourceLink?drawingConnection(item):null,details=connection?connectionFields(body,connection,{onMediaChange(media){const info=connectionType({...connection,media});if(info.name===currentType)return;currentType=info.name;captions?.retarget(info.name);if(picker){const style=project.layout?.linkStyles?.[info.name],existing=pages.flatMap(page=>page.items).find(path=>path.type==='path'&&path.linkType===info.name);picker.value=style?.color||existing?.color||info.color;picker.opacity=style?.opacity??existing?.opacity??1;}}}):null;
 const legendDetails=linkedSwatch?legendFields(body,item.linkType):null;
 if(item.type==='path'||linkedSwatch)captions=linkCaptionFields(body,item.linkType,{collapsible:true});
 for(const k of ['rect','vector'].includes(item.type)&&!linkedSwatch?['fill','stroke']:[]){inputs[k]=property(hasPicker?grid:body,k[0].toUpperCase()+k.slice(1),item[k]||'#17364A');}
 picker=hasPicker?colorPicker(body,{kind:item.type==='path'||linkedSwatch?'line':'text',color:linkedSwatch?item.fill:item.color,opacity:item.opacity??1,width:initialWeight,used:page.items.flatMap(i=>[i.color,i.fill,i.stroke])}):null;
 if(picker&&inputs.weight)picker.bindWidth(inputs.weight);
 if(item.type==='path')body.append(el('p','Cable type, speed and width apply to this connection. Color, opacity and titles are shared with its link type.','hint'));
 if(item.type==='vector')inputs.commands=field(body,'Vector commands (JSON, normalized coordinates)',JSON.stringify(item.commands),'multiline');
 if(item.type==='path'){const bar=actions(body);button(bar,'Edit bend points',()=>editCablePoints(item));if(item.sourceLink)button(bar,'Connect endpoints',()=>connectSelectedCable(item));}
 const scaleObject=item.type!=='path'&&!linkedSwatch?field(body,'Scale this object (%)',100):null;if(scaleObject){scaleObject.type='number';scaleObject.min=10;scaleObject.max=400;}
 const bar=actions(body);button(bar,'Save object',()=>{
  const change={};for(const [k,input] of Object.entries(inputs)){if(['w','h','size','weight'].includes(k)){const n=(k==='weight'?lineWidthValue(input):Number(input.value))/(normalized&&(['w','h'].includes(k)||item.type==='arttext'&&k==='size')?100:1);if(!Number.isFinite(n)||n<=0)throw Error('Use a valid positive size.');change[k]=n;}else if(k==='commands'){try{change.commands=JSON.parse(input.value);}catch{throw Error('Vector commands must be a JSON array.');}}else if(k==='bold')change[k]=input.value==='true';else if(!['fill','stroke','color'].includes(k)||input.value!==item[k])change[k]=input.value;}
  if(labelRotation){change.rotationMode=labelRotation.value==='auto'?'auto':'fixed';if(change.rotationMode==='fixed')change.angle=Number(labelRotation.value)*Math.PI/180;}
  if(picker){change[linkedSwatch?'fill':'color']=picker.value;if(item.type==='path'||linkedSwatch)change.opacity=picker.opacity;}
  if(scaleObject){const factor=Number(scaleObject.value)/100;if(!Number.isFinite(factor)||factor<.1||factor>4)throw Error('Use an object scale from 10 to 400 percent.');for(const k of ['w','h','size'])if(Number.isFinite(change[k]))change[k]*=factor;if(item.type==='vector'&&Array.isArray(change.commands)){const bounds=drawingBounds(item),x=(bounds.x-item.parent.x)/item.parent.w,y=(bounds.y-item.parent.y)/item.parent.h;change.commands=change.commands.map(c=>c.length===3?[c[0],x+(c[1]-x)*factor,y+(c[2]-y)*factor]:c);}}
  Object.assign(change,unpresentPatch(item,change));
  const clean=cleanDrawingEdits({[item.editKey]:change})[item.editKey];if(!clean||Object.keys(clean).length!==Object.keys(change).length)throw Error('Use hex colors, valid text settings, and finite dimensions.');
  if(item.type==='path'||linkedSwatch){const style={...captions.value,color:picker.value,opacity:picker.opacity},patch={...project.layout?.drawingEdits?.[item.editKey],...clean};for(const key of ['color','fill','opacity'])delete patch[key];if(linkedSwatch){if(inputs.name.value===item.name&&item.name===item.linkType+' color key')delete patch.name;if(Number(inputs.weight.value)!==initialWeight)style.weight=lineWidthValue(inputs.weight)/(presentation(project,page).drawingScale||1);delete patch.weight;delete patch.h;delete patch.stroke;setLegendStyle(item.linkType,legendDetails?.value||{},style,{[item.editKey]:patch});}else{const selected=details?.value,changed=selected&&(selected.media!==String(connection.media||'unknown').trim()||selected.speed!==String(connection.speed||'').trim());if(changed)saveConnection(project.links.findIndex(link=>sameConnection(link,item.sourceLink)),{...connection,...selected},{drawing:item,patch,style});else setLinkStyle(item.linkType,style,{[item.editKey]:patch});}}
  else if(item.legendEntry&&item.linkType&&clean.value!==editableText(item)){const patch={...project.layout?.drawingEdits?.[item.editKey],...clean};delete patch.value;setLinkStyle(item.linkType,{[item.legendDescription?'description':'title']:clean.value},{[item.editKey]:patch});}
  else if(item.legendEntry&&item.linkType){const patch={...project.layout?.drawingEdits?.[item.editKey],...clean};if(project.layout?.drawingEdits?.[item.editKey]?.value==null)delete patch.value;setDrawingEdits({...project.layout?.drawingEdits,[item.editKey]:patch});}
  else setDrawingEdits({...project.layout?.drawingEdits,[item.editKey]:{...project.layout?.drawingEdits?.[item.editKey],...clean}});picker?.remember();close();say('Drawing object saved.');
 },'primary');
 button(bar,'Cancel',close);
 button(bar,'Reset object',()=>{const next={...project.layout?.drawingEdits};delete next[item.editKey];if(item.legacyEditKey)delete next[item.legacyEditKey];setDrawingEdits(next);close();});
 if(item.type!=='device'&&item.type!=='path')button(bar,'Hide object',()=>{setDrawingEdits({...project.layout?.drawingEdits,[item.editKey]:item.type==='vector'?{commands:[]}:item.type==='arttext'?{value:''}:{hidden:true}});close();});
 if(item.type==='device'){const device=project.devices.find(d=>d.id===item.sourceId);if(device){button(bar,'Device details',()=>editDevice(device));button(bar,'Find stencil',()=>deviceStencil(device));if(item.asset)button(bar,'Map ports',()=>editAnchors(project.stencils[device.stencilId]));}if(item.asset)body.append(el('p',item.asset.native?'Vector details remain independently editable in the Visio export.':'This stencil contains a picture. Its image can be replaced and resized; map its ports under Map ports.','hint'));}
 button(bar,'Reset page edits',()=>{const next={...project.layout?.drawingEdits},prefix=page.name+'|',scope=(page.editScope||page.name)+'|';for(const k of Object.keys(next))if(k.startsWith(prefix)||k.startsWith(scope))delete next[k];for(const o of objects)if(o.legacyEditKey)delete next[o.legacyEditKey];setDrawingEdits(next);close();});
}
$('edit-drawing').onclick=()=>{cancelBesidePick();editDrawing=!editDrawing;$('edit-drawing').setAttribute('aria-pressed',String(editDrawing));$('canvas').classList.toggle('editing',editDrawing);syncDrawingSelection();say(editDrawing?'Drag items to move. Move near a cable to highlight it, then click to select. Use Organize connections to preview a tidier layout. Shift-click selects multiple items. Double-click or Edit selected to change text and style. Alt-drag a panel detail to move it independently. Hold Space to pan.':'Click a device to find its stencil. Drag to pan; scroll to zoom.');};
function hardware(){stencilDevice=null;
 const body=modal('Hardware library');body.append(el('p','Import Visio stencils, drawing or template masters, images, or a hardware pack. Folder import searches every subfolder. Legacy picture masters open locally; other legacy artwork can use installed desktop Visio in the Windows app.','hint'));
 const bar=actions(body);button(bar,'Import shapes',()=>$('art-file').click(),'primary');button(bar,'Import stencil folder',()=>$('art-folder').click());if(discoveredStencils.length)button(bar,'Browse found stencils ('+discoveredStencils.length+')',browseStencils);button(bar,'Save hardware pack',()=>download(JSON.stringify({format:'NDS-hardware',schema:1,stencils:Object.values(project.stencils),optics:project.optics}),'NetworkDiagramStudio-hardware.json'));
 if(pages.length&&drawingReady)button(bar,'Export Visio stencil',async()=>download(await exportStencil(scoped(),pages),slug(project.name)+'-hardware.vssx'));
 if(stencilResults.length)button(bar,'Import results ('+stencilResults.length+')',importResults);
 const shapes=Object.values(project.stencils);
 for(const shape of shapes){const info=el('div');info.append(el('strong',shape.name),el('div',shape.view+'  |  '+Object.keys(shape.anchors).length+' mapped ports','asset-info'));const row=line(body,info);button(row,'Map ports',()=>editAnchors(shape));}
 if(shapes.length){body.append(el('h3','Core uplink module shapes'));
  for(const [k,label] of [['sr','Switch SR optic'],['fg_sr','Firewall SR optic'],['lr','LR optic'],['dac','DAC cable end']]){
   const sel=field(body,label,project.optics[k]||'',[['','Schematic module'],...shapes.map(s=>[s.id,s.name])]);sel.onchange=()=>{project.optics[k]=sel.value;perform();};
  }
  body.append(el('p','Assign a front panel in Device details.','hint'));}
}
function importResults(){const body=modal('Import results');for(const r of stencilResults.slice(-50))body.append(el('p',r.path+': '+r.message,'error'));button(actions(body),'Back to hardware',hardware);}
async function importArt(files){
 const before=Object.keys(project.stencils).length,errorsBefore=stencilResults.length;
 for(const f of files){
  if(f.size>160*1024*1024)throw Error('Stencil file exceeds 160 MB.');
  if(/\.json$/i.test(f.name)){
   const pack=JSON.parse(await f.text());if(pack.format!=='NDS-hardware'||pack.schema!==1||!Array.isArray(pack.stencils))throw Error('Invalid hardware pack.');
   const shapes=pack.stencils.map(cleanStencil);for(const s of shapes){project.stencils[s.id]=s;assignMatching(s);}for(const [k,id] of Object.entries(pack.optics||{}))if(['sr','fg_sr','lr','dac'].includes(k)&&project.stencils[id])project.optics[k]=id;
  }else if(visioFile(f.name)){
   const cat=await stencilCatalog(f);
   if(!cat.items.length)throw Error('No masters in '+f.name);
   const selection=await new Promise(resolve=>{
    const body=modal('Choose Visio masters');body.append(el('p','Select the device and module views to import.','hint'));
    const query=field(body,'Search masters','');query.type='search';query.placeholder='Model, SKU, or master name';const info=el('p','','hint'),sel=el('select'),selected=new Set();sel.multiple=true;sel.size=Math.min(14,cat.items.length);sel.setAttribute('aria-label','Visio masters');body.append(info,sel);
    const a=actions(body),all=el('button','Select all shown'),clear=el('button','Clear selection'),ok=el('button','Import selected','primary');
    function count(){info.textContent=sel.options.length+' of '+cat.items.length+' masters shown. '+selected.size+' selected.';ok.disabled=!selected.size;}
    function render(){sel.replaceChildren(...filterStencilMasters(cat.items,query.value).map(item=>{const op=el('option',item.name);op.value=item.key;op.selected=selected.has(item.key);return op;}));count();}
    sel.onchange=()=>{for(const op of sel.options){if(op.selected)selected.add(op.value);else selected.delete(op.value);}count();};query.oninput=render;all.onclick=()=>{for(const o of sel.options)selected.add(o.value);render();};clear.onclick=()=>{selected.clear();render();};a.append(all,clear);const end=()=>{resolve([]);};$('dialog').addEventListener('close',end,{once:true});ok.onclick=()=>{$('dialog').removeEventListener('close',end);resolve([...selected]);};a.append(ok);render();query.focus();
   });
   let failed=[];for(const key of selection){try{const shape=await cat.load(key);project.stencils[shape.id]=shape;assignMatching(shape);}catch(e){failed.push((cat.items.find(i=>i.key===key)?.name||key)+': '+e.message);}}
   if(failed.length){project.warnings.push(...failed);stencilResults.push({path:filePath(f),message:failed.join(' / ')});}
  }else{const s=await loadImageStencil(f);project.stencils[s.id]=s;assignMatching(s);}
 }
 const target=project.devices.find(d=>d.id===stencilDevice);perform();const added=Object.keys(project.stencils).length-before;if(stencilResults.length>errorsBefore&&!added)importResults();else if(target)await deviceStencil(target);else hardware();say(added+' hardware shapes added.'+(stencilResults.length>errorsBefore?' Review the import results.':''));
}
$('site').oninput=()=>{project.name=$('site').value;perform();};
$('filter').oninput=deviceList;$('close').onclick=close;
$('matches').onclick=()=>{if(!$('filter').value.trim()){say('Enter a device name or model filter first.');return;}for(const d of project.devices){d.scopeOverride=matchName(d);d.hidden=!d.scopeOverride;}perform();};
$('all').onclick=()=>{for(const d of project.devices){d.scopeOverride=true;d.hidden=false;}perform();};
$('new').onclick=newProject;$('auto-scope').onclick=()=>{for(const d of project.devices)delete d.scopeOverride;initialScope();perform();};
$('switchport-reports').onclick=()=>task(reports.options);$('export-menu').onclick=()=>task(reports.exportMenu);
$('sample').onclick=sample;$('hardware').onclick=hardware;$('review-links').onclick=reviewLinks;
$('arrange').onclick=arrange;$('evidence').onclick=evidence;
$('add-link').onclick=()=>editLink();$('add-device').onclick=()=>editDevice();
$('warnings').onclick=()=>{const b=modal('Import review');const ul=el('ul');for(const w of project.warnings)ul.append(el('li',warningText(w)));b.append(ul);};
$('open').onclick=()=>$('project-file').click();$('save').onclick=()=>{download(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}),slug(project.name)+'.nds.json');projectHistory.markSaved();dirty=false;say('Project downloaded.');};
$('import').onclick=()=>$('data-files').click();
$('paste').onclick=()=>{const b=modal('Paste configuration / commands');const n=field(b,'Device name or filename hint','device.cfg');const t=field(b,'Configuration or show-command output','','multiline');button(actions(b),'Import text',()=>ingest([new File([t.value],n.value||'device.cfg',{type:'text/plain'})]),'primary');};
$('data-files').onchange=e=>{const fs=Array.from(e.target.files);e.target.value='';task(()=>ingest(fs));};
$('project-file').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f||!checkDiscard())return;task(async()=>{if(f.size>160*1024*1024)throw Error('Project exceeds 160 MB.');let p,reportFocus=null;if(/\.spworkspace\.json$/i.test(f.name)){const imported=await importSwitchportWorkspace(f);reportFocus=imported.selectedId||'';p={...emptyProject(),...imported.model,name:imported.settings.outputLabel||'Switchport workspace',layout:{...emptyProject().layout,switchport:imported.settings}};}else p=loadProject(JSON.parse(await f.text()));viewport.reset();project=p;if(project.evidence){reopenEvidence(project);initialScope();for(const shape of Object.values(project.stencils))assignMatching(shape);}evidenceSnapshot=project.evidence?snapshot():null;resetDrawingHistory();active=0;dirty=false;draw();if(reportFocus!==null){const reportIndex=pages.findIndex(page=>familyOf(page)==='switchports'&&(!reportFocus||page.sourceDeviceIds?.includes(reportFocus)));if(reportIndex>=0){active=reportIndex;draw(pages);}}say('Project opened.');});};
function discoverStencils(files){
 const found=stencilFiles(files),known=new Set(discoveredStencils.map(f=>filePath(f)+'|'+f.size+'|'+f.lastModified));
 for(const f of found){const key=filePath(f)+'|'+f.size+'|'+f.lastModified;if(!known.has(key)){discoveredStencils=discoveredStencils.filter(old=>filePath(old)!==filePath(f));stencilIndexes.delete(filePath(f));openCatalogs.delete(filePath(f));discoveredStencils.push(f);known.add(key);}}
 discoveredStencils.sort((a,b)=>filePath(a).localeCompare(filePath(b),'en',{numeric:true}));
 say('Found '+found.length+' Visio files in the selected folder and subfolders.');const target=project.devices.find(d=>d.id===stencilDevice);return target?deviceStencil(target):browseStencils();
}
function browseStencils(){
 const body=modal('Stencil folders');body.append(el('p',discoveredStencils.length+' Visio files found. Choose a file, then select the hardware masters to include.','hint'));
 const search=field(body,'Search folders and stencil filenames','');search.type='search';const listing=el('div');body.append(listing);
 const render=()=>{listing.replaceChildren();const matches=discoveredStencils.filter(f=>filePath(f).toLowerCase().includes(search.value.toLowerCase()));
  for(const f of matches.slice(0,150)){const row=line(listing,el('div',filePath(f)));button(row,'Choose masters',async()=>{try{await importArt([f]);}catch(e){stencilResults.push({path:filePath(f),message:e.message});browseStencils();}});}
  if(matches.length>150)listing.append(el('p','Showing 150 of '+matches.length+' files. Refine the search to see more.','hint'));
  if(!matches.length)listing.append(el('p','No matching Visio files.','hint'));
 };search.oninput=render;render();
 if(stencilResults.length){body.append(el('h3','Import results'));for(const r of stencilResults.slice(-50))body.append(el('p',r.path+': '+r.message,'error'));}
 button(actions(body),'Back to hardware',hardware);
}
$('art-folder').onchange=e=>{const fs=Array.from(e.target.files);e.target.value='';if(fs.length)task(()=>discoverStencils(fs));};
$('art-file').onchange=e=>{const fs=Array.from(e.target.files);e.target.value='';if(fs.length)task(()=>importArt(fs));};
$('svg').onclick=()=>download(pages[active].svg,slug(project.name)+'-'+slug(pages[active].name)+'.svg','image/svg+xml');
$('export').onclick=()=>task(async()=>{download(await exportVisio(scoped(),pages),slug(project.name)+'.vsdx');say('Editable Visio drawing exported.');});
$('print').onclick=()=>{
 const container=$('print-set');container.replaceChildren();let style=$('print-page-sizes');if(!style){style=el('style');style.id='print-page-sizes';document.head.append(style);}style.textContent=printPageStyles(pages);
 for(const page of pages){const sheet=el('section');sheet.append(document.importNode(new DOMParser().parseFromString(page.svg,'image/svg+xml').documentElement,true));container.append(sheet);}
 if(window.NDSDesktop)window.NDSDesktop.print();else window.print();
};
window.addEventListener('afterprint',()=>$('print-set').replaceChildren());
for(const ev of ['dragover','drop'])document.addEventListener(ev,e=>{
 if(![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();$('drop').classList.toggle('dragover',ev==='dragover');
 if(ev==='drop'){const items=Array.from(e.dataTransfer.items),fallback=Array.from(e.dataTransfer.files);task(async()=>{const files=await droppedFiles(items,fallback),art=files.filter(f=>visioFile(f.name)),data=files.filter(f=>!visioFile(f.name)&&/\.(txt|cfg|conf|config|log|rsc|cli|xml|exp|backup|csv|xlsx|spworkspace\.json)$/i.test(f.name));if(data.length)await ingest(data);if(art.length)discoverStencils(art);else if(!data.length)say('No supported site data or Visio stencils were found.');});}
});
document.addEventListener('dragleave',()=> $('drop').classList.remove('dragover'));
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
draw();window.NDSDesktop?.ready();
