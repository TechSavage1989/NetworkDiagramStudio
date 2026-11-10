import {paperDimensions,cleanPageSetup,pageFamily,pageGeometry} from './page-options.mjs';

export const calibrationKey='nds.screen-calibration.v1';
const calibrationEvent='nds-screen-calibration-changed';
export function screenSignature(win){
 return {dpr:win.devicePixelRatio||1,width:win.screen?.width||0,height:win.screen?.height||0,depth:win.screen?.colorDepth||0,zoom:win.visualViewport?.scale||1};
}
export function validCalibration(value){
 return value?.version===1&&Number.isFinite(value.pxPerMm)&&value.pxPerMm>=1&&value.pxPerMm<=16&&value.signature&&['dpr','width','height','depth','zoom'].every(k=>Number.isFinite(value.signature[k]));
}
export function calibrationMatches(value,signature){return validCalibration(value)&&Object.keys(signature).every(k=>value.signature[k]===signature[k]);}
// Explicit Dynamic page/group choices must not become physical merely because
// the builder labels its grown canvas with generated custom-paper dimensions.
export function actualSizePaper(project,page){
 const family=page?.family||pageFamily(page?.name||''),setup=cleanPageSetup(project?.layout?.pageSetup);
 if(family==='switchports'&&page?.switchportReport)return page.visiblePaper||page.paper;
 const choice=setup.visible.pages[page?.name]||setup.visible.groups[family];
 if(choice?.preset==='dynamic')return choice;
 if(page?.visiblePaper)return page.visiblePaper;
 const geometry=pageGeometry(project,family);
 const expected=paperDimensions(geometry.paper),rendered=paperDimensions(page?.paper);
 // Preferred Letter is only a starting size for a growing builder canvas.
 // It is physical only if the completed sheet still matches that size.
 return !geometry.dynamic&&expected&&rendered&&Math.abs(expected.widthMm-rendered.widthMm)<.01&&Math.abs(expected.heightMm-rendered.heightMm)<.01?page.paper:{preset:'dynamic'};
}
// Use the physical sheet, not the editor's expanded off-page viewBox.
export function actualSizeScale(page,pxPerMm){
 const dimensions=paperDimensions(page&&Object.hasOwn(page,'actualSizePaper')?page.actualSizePaper:page?.visiblePaper||(!page?.dynamic?page?.paper:null));
 if(!dimensions||!Number.isFinite(page?.width)||page.width<=0||!Number.isFinite(pxPerMm)||pxPerMm<=0)return null;
 return dimensions.widthMm*pxPerMm/page.width;
}

export function createActualSizeView({button,calibrate,status,getPage,setScale,isActive,leave}){
 let calibration=null,sessionOnly=false,disposed=false,ownedDialog=null;
 const listeners=[];
 const listen=(target,type,fn,options)=>{target?.addEventListener(type,fn,options);listeners.push(()=>target?.removeEventListener?.(type,fn,options));};
 const announce=()=>window.dispatchEvent(new CustomEvent(calibrationEvent,{detail:{calibration,sessionOnly}}));
 try{const saved=JSON.parse(localStorage.getItem(calibrationKey));if(validCalibration(saved))calibration=saved;}catch{}
 const signature=()=>screenSignature(window);
 function refresh(){
  const page=getPage(),supported=actualSizeScale(page,1)!==null,valid=calibrationMatches(calibration,signature());
  button.disabled=!supported;
  button.title=supported?'Show the selected physical paper at calibrated real-life size':'Choose a physical paper size in Page options first';
  if(isActive()&&(!valid||!supported))leave();
  button.setAttribute('aria-pressed',String(isActive()&&valid));
  status.textContent=calibration&&!valid?'Screen scale changed. Recalibrate before using Actual size.':isActive()?'Actual size 1:1 · Pan to inspect. Verify with paper on this screen.' :'';
  if(sessionOnly)status.textContent+=' Calibration is for this session only; browser storage is unavailable.';
 }
 function activate({preserve=false,prompt=true}={}){if(disposed||actualSizeScale(getPage(),1)===null)return;if(!calibrationMatches(calibration,signature())){if(prompt)open();return;}setScale(actualSizeScale(getPage(),calibration.pxPerMm),preserve);refresh();}
 function open(){
  if(disposed||document.getElementById('screen-calibration'))return;
  const dialog=document.createElement('dialog');dialog.id='screen-calibration';dialog.setAttribute('aria-labelledby','screen-calibration-title');
  dialog.innerHTML='<div class="modalhead"><h2 id="screen-calibration-title">Calibrate actual size</h2><button type="button" data-close>Close</button></div><p>Screen resolution alone cannot tell us physical size. Hold a ruler, a standard card, or a sheet of paper against this screen and adjust the line until its endpoints match.</p><label>Reference <select id="calibration-reference"><option value="100">Ruler: 100 mm</option><option value="85.6">Standard card: 85.60 mm wide</option><option value="210">A4 paper: short edge, 210 mm</option><option value="215.9">Letter paper: short edge, 215.9 mm</option></select></label><div class="calibration-scroll"><div id="calibration-line" aria-label="Physical reference line"></div></div><label>Adjust reference length <input id="calibration-slider" type="range" min="1" max="16" step="0.01"></label><label>Screen pixels per millimeter <input id="calibration-density" type="number" min="1" max="16" step="0.01"></label><p>Match both endpoints, without bending the paper or pressing on the display. If the line does not fit, use the 100 mm ruler reference instead.</p><p>Calibration is local to this browser and screen setup. Recheck after moving to another monitor or changing browser zoom, OS scaling or resolution. Some display changes cannot be detected. Check both paper edges in Actual size; printer scaling must be 100% for a matching print.</p><p id="calibration-error" role="alert"></p><div class="dialog-actions"><button type="button" id="calibration-reset">Reset calibration</button><button type="button" id="calibration-save">Save and show actual size</button></div>';
  document.body.append(dialog);ownedDialog=dialog;
  // Keep drawing-level shortcuts out of this local settings dialog.
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  const reference=dialog.querySelector('#calibration-reference'),density=dialog.querySelector('#calibration-density'),line=dialog.querySelector('#calibration-line'),error=dialog.querySelector('#calibration-error'),openedSignature=signature();
  density.value=String(calibrationMatches(calibration,openedSignature)?calibration.pxPerMm:96/25.4);
  const slider=dialog.querySelector('#calibration-slider');
  const draw=()=>{line.style.width=(Number(reference.value)*Number(density.value))+'px';slider.value=density.value;};reference.onchange=draw;density.oninput=draw;slider.oninput=()=>{density.value=slider.value;draw();};draw();
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();ownedDialog=null;},{once:true});
  dialog.querySelector('#calibration-reset').onclick=()=>{calibration=null;sessionOnly=false;try{localStorage.removeItem(calibrationKey);}catch{}announce();leave();refresh();density.value=String(96/25.4);draw();error.textContent='Calibration reset. Match the reference again before saving.';};
  dialog.querySelector('#calibration-save').onclick=()=>{
   const next={version:1,pxPerMm:Number(density.value),signature:signature()};
   if(!validCalibration(next)){error.textContent='Enter a screen density between 1 and 16 pixels per millimeter.';return;}
   if(!Object.keys(openedSignature).every(k=>openedSignature[k]===next.signature[k])){error.textContent='Screen scale changed while calibrating. Close and reopen calibration, then match the reference again.';return;}
   calibration=next;sessionOnly=false;try{localStorage.setItem(calibrationKey,JSON.stringify(next));}catch{sessionOnly=true;}
   announce();dialog.close();activate();refresh();
  };
  dialog.showModal();
 }
 button.onclick=activate;calibrate.onclick=open;
 listen(window,'resize',refresh);listen(window,'focus',refresh);listen(window.visualViewport,'resize',refresh);
 // DPR may change when crossing displays without changing the browser window size.
 let dprQuery=null,dprListener=null;
 function watchDpr(){if(disposed)return;if(dprQuery)dprQuery.removeEventListener?.('change',dprListener);dprQuery=window.matchMedia?.('(resolution: '+(window.devicePixelRatio||1)+'dppx)');dprListener=()=>{refresh();watchDpr();};dprQuery?.addEventListener('change',dprListener,{once:true});}watchDpr();
 listen(window,'storage',event=>{if(event.key!==calibrationKey&&event.key!==null)return;try{const saved=JSON.parse(localStorage.getItem(calibrationKey));calibration=validCalibration(saved)?saved:null;}catch{calibration=null;}if(isActive())leave();refresh();});
 // Settings previews and the main drawing share the same calibration instantly,
 // including storage-unavailable sessions (storage events do not fire locally).
 listen(window,calibrationEvent,event=>{calibration=event.detail.calibration;sessionOnly=event.detail.sessionOnly;if(isActive())leave();refresh();});
 refresh();return {refresh,activate,dispose(){if(disposed)return;disposed=true;for(const remove of listeners)remove();dprQuery?.removeEventListener?.('change',dprListener);ownedDialog?.close();button.onclick=null;calibrate.onclick=null;}};
}
