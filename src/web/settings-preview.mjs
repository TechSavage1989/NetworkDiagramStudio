import {createActualSizeView} from './actual-size.mjs';
let previewSerial=0;
const previewPreferences={live:true,controlsWidth:400};
// Preview work is isolated from the project/history. Late results cannot paint
// after a newer draft, a dialog replacement or cancellation.
export function previewQueue({read,build,publish,state=()=>{},delay=300,schedule=setTimeout,cancel=clearTimeout,now=()=>performance.now(),slowAfter=750}){
 let generation=0,timer=null,disposed=false,adaptiveDelay=delay;
 const request=(wait=adaptiveDelay,{manual=false}={})=>{
  if(disposed)return;const current=++generation;if(timer!=null)cancel(timer);state('pending');
  timer=schedule(async()=>{timer=null;const started=now();try{const draft=read();const result=await build(draft);if(!disposed&&current===generation){publish(result);const slow=now()-started>=slowAfter;adaptiveDelay=slow?Math.min(2000,Math.max(delay,now()-started)):delay;state(slow?'slow':'ready');}}catch(error){if(!disposed&&current===generation){const slow=now()-started>=slowAfter;if(slow)adaptiveDelay=Math.min(2000,Math.max(delay,now()-started));state('error',error);}}},wait);
 };
 return {request,resume(){},pause(){generation++;if(timer!=null)cancel(timer);timer=null;},dispose(){disposed=true;generation++;if(timer!=null)cancel(timer);timer=null;}};
}

export function isolatedPreview(source,configure,build){const draft=structuredClone(source);configure(draft);return build(draft);}

// Screen-only navigation never mutates page geometry. Unlike scroll offsets,
// translations allow panning a fitted/smaller page in every direction.
export function previewZoomAt(view,factor,x,y){
 const scale=Math.max(.0001,Math.min(16,view.scale*factor));
 return {...view,mode:'custom',scale,x:x-(x-view.x)*scale/view.scale,y:y-(y-view.y)*scale/view.scale};
}
export function previewPanelLimits(available,stacked=false,minimumPreview=0,dividerSize=10){
 const min=stacked?150:280,preview=Math.max(stacked?220:320,minimumPreview);
 return {min,max:Math.max(min,Math.min(stacked?available*.6:720,available-preview-dividerSize))};
}
export function settingsPreview(body,{read,build,initialPages=[],selectedName='',viewState={},preferences=previewPreferences}){
 const dialog=body.closest('dialog'),el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
 dialog.classList.add('settings-preview-dialog');
 const controls=el('section','','settings-preview-controls');controls.setAttribute('aria-label','Settings controls');controls.append(...body.childNodes);
 const view=el('section','','settings-preview-view');view.setAttribute('aria-label','Live diagram preview');
 const toolbar=el('div','','settings-preview-toolbar'),liveLabel=el('label','Live preview'),live=el('input');live.type='checkbox';live.checked=viewState.live??preferences.live;liveLabel.prepend(live);toolbar.append(liveLabel);
 const action=(title,fn)=>{const b=el('button',title);b.type='button';b.onclick=fn;toolbar.append(b);return b;};
 action('Update preview',()=>queue.request(0,{manual:true}));
 const pagesLabel=el('label','Preview page'),picker=el('select');picker.setAttribute('aria-label','Preview page');pagesLabel.append(picker);toolbar.append(pagesLabel);
 const status=el('p','Current drawing. Changes are previewed, not saved.','settings-preview-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.state='ready';
 const viewport=el('div','','settings-preview-viewport');viewport.setAttribute('aria-label','Read-only preview. Drag or middle-drag to pan. Scroll to zoom.');viewport.tabIndex=0;
 const stage=el('div','','settings-preview-stage');viewport.append(stage);
 const zoomLabel=el('span','','settings-preview-zoom');let name=viewState.pageName||selectedName,currentPage=initialPages.find(p=>p.name===name)||initialPages[0],svg=null,rendered=initialPages,disposed=false,actualView,initializing=true,restoreActual=viewState.mode==='actual';
 if(!viewState.mode)Object.assign(viewState,{mode:'fit',scale:1,x:0,y:0});
 const paint=()=>{if(disposed||!svg)return;stage.style.transform='translate('+viewState.x+'px,'+viewState.y+'px) scale('+viewState.scale+')';zoomLabel.textContent=(viewState.scale<.01?(viewState.scale*100).toFixed(2):Math.round(viewState.scale*100))+'%';actualView?.refresh();};
 const fit=()=>{if(disposed||!svg)return;restoreActual=false;const box=svg.viewBox.baseVal,scale=Math.max(.0001,Math.min(16,Math.min((viewport.clientWidth-20)/box.width,(viewport.clientHeight-20)/box.height)));Object.assign(viewState,{mode:'fit',scale,x:(viewport.clientWidth-box.width*scale)/2,y:(viewport.clientHeight-box.height*scale)/2});paint();};
 const zoom=(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2)=>{if(!svg)return;restoreActual=false;Object.assign(viewState,previewZoomAt(viewState,factor,x,y));paint();};
 action('−',()=>zoom(1/1.25)).setAttribute('aria-label','Preview zoom out');
 action('Fit preview',fit);
 action('+',()=>zoom(1.25)).setAttribute('aria-label','Preview zoom in');toolbar.append(zoomLabel);
 const actual=action('Actual size',()=>{}),calibrate=action('Calibrate screen',()=>{}),actualStatus=el('p','','settings-preview-actual');actualStatus.setAttribute('role','status');
 const divider=el('div','','settings-preview-divider');divider.tabIndex=0;divider.setAttribute('role','separator');divider.title='Drag to resize settings. Arrow keys resize; Home/End use minimum/maximum.';
 const stacked=()=>matchMedia('(max-width:800px)').matches;
 const limits=()=>{const vertical=stacked();let minimumPreview=0;if(vertical){const css=getComputedStyle(view);minimumPreview=180+parseFloat(css.paddingTop)+parseFloat(css.paddingBottom);for(const node of view.children){if(node===viewport)continue;const style=getComputedStyle(node);if(style.display!=='none')minimumPreview+=node.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);}}return previewPanelLimits(vertical?body.clientHeight:body.clientWidth,vertical,minimumPreview,vertical?divider.offsetHeight:divider.offsetWidth);};
 const setControlsWidth=()=>{const vertical=stacked(),{min,max}=limits(),key=vertical?'controlsHeight':'controlsWidth',preferred=viewState[key]??preferences[key]??(vertical?body.clientHeight*.4:400),value=Math.max(min,Math.min(max,preferred));controls.style.width=vertical?'100%':value+'px';controls.style.height=vertical?value+'px':'';divider.setAttribute('aria-orientation',vertical?'horizontal':'vertical');divider.setAttribute('aria-label',vertical?'Resize settings height':'Resize settings sidebar');divider.setAttribute('aria-valuemin',min);divider.setAttribute('aria-valuemax',max);divider.setAttribute('aria-valuenow',Math.round(value));divider.setAttribute('aria-valuetext',Math.round(value)+' pixels');};
 const resizeControls=value=>{const {min,max}=limits(),key=stacked()?'controlsHeight':'controlsWidth';viewState[key]=preferences[key]=Math.max(min,Math.min(max,value));setControlsWidth();};
 let resizing=null;
 const endResize=event=>{if(!resizing||event&&event.pointerId!==resizing.id)return;const id=resizing.id;resizing=null;divider.classList.remove('resizing');if(divider.hasPointerCapture(id))divider.releasePointerCapture(id);};
 divider.onpointerdown=event=>{if(event.button!==0)return;const vertical=stacked(),rect=controls.getBoundingClientRect();resizing={id:event.pointerId,vertical,start:vertical?event.clientY:event.clientX,size:vertical?rect.height:rect.width};divider.focus({preventScroll:true});divider.setPointerCapture(event.pointerId);divider.classList.add('resizing');event.preventDefault();};
 divider.onpointermove=event=>{if(!resizing||event.pointerId!==resizing.id)return;if(stacked()!==resizing.vertical){endResize();return;}resizeControls(resizing.size+(resizing.vertical?event.clientY:event.clientX)-resizing.start);event.preventDefault();};
 divider.onpointerup=divider.onpointercancel=endResize;divider.onlostpointercapture=()=>{resizing=null;divider.classList.remove('resizing');};
 divider.onkeydown=event=>{const vertical=stacked(),negative=vertical?'ArrowUp':'ArrowLeft',positive=vertical?'ArrowDown':'ArrowRight';if(![negative,positive,'Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const {min,max}=limits(),current=Number(divider.getAttribute('aria-valuenow'));resizeControls(event.key==='Home'?min:event.key==='End'?max:current+(event.key===negative?-1:1)*(event.shiftKey?40:10));};
 view.append(toolbar,status,actualStatus,viewport,el('p','Read-only preview. Drag to pan; wheel or +/− to zoom; 0 fits. Actual size uses your screen calibration. Apply saves once; Cancel or Close discards the draft.','hint'));
 body.replaceChildren(controls,divider,view);
 actualView=createActualSizeView({button:actual,calibrate,status:actualStatus,getPage:()=>currentPage,isActive:()=>viewState.mode==='actual',leave:()=>{if(viewState.mode==='actual')viewState.mode='custom';},setScale:(scale,preserve)=>{if(!svg)return;const box=svg.viewBox.baseVal;Object.assign(viewState,{mode:'actual',scale,x:preserve?viewState.x:20+(box.x-(currentPage.originX||0))*scale,y:preserve?viewState.y:20+(box.y-(currentPage.originY||0))*scale});paint();}});
 const display=()=>{const previous=currentPage,oldSvg=svg;currentPage=rendered.find(p=>p.name===name)||rendered[0];stage.replaceChildren();svg=null;if(currentPage){name=viewState.pageName=currentPage.name;picker.value=name;stage.innerHTML=currentPage.svg;svg=stage.querySelector('svg');if(svg){const prefix='settings-preview-'+(++previewSerial)+'-',ids=new Map([...svg.querySelectorAll('[id]')].map(node=>[node.id,prefix+node.id]));for(const node of [svg,...svg.querySelectorAll('*')])for(const attr of [...node.attributes]){if(attr.name==='id'&&ids.has(attr.value))node.setAttribute(attr.name,ids.get(attr.value));else if(/href$/.test(attr.name)&&attr.value.startsWith('#')&&ids.has(attr.value.slice(1)))node.setAttribute(attr.name,'#'+ids.get(attr.value.slice(1)));else if(attr.value.includes('url(#'))node.setAttribute(attr.name,attr.value.replace(/url\(#([^)]*)\)/g,(all,id)=>ids.has(id)?'url(#'+ids.get(id)+')':all));}svg.setAttribute('aria-label','Preview diagram');const box=svg.viewBox.baseVal;stage.style.width=box.width+'px';stage.style.height=box.height+'px';if(previous?.name===currentPage.name&&oldSvg&&viewState.mode!=='fit'){viewState.x+=(box.x-oldSvg.viewBox.baseVal.x)*viewState.scale;viewState.y+=(box.y-oldSvg.viewBox.baseVal.y)*viewState.scale;}if(viewState.mode==='actual'){actualView.refresh();if(viewState.mode==='actual')actualView.activate({preserve:true});else paint();}else if(viewState.mode==='fit')fit();else paint();}}else{stage.textContent='No visible pages for these settings.';stage.style.width='auto';stage.style.height='auto';stage.style.transform='none';}actualView.refresh();};
 const publish=result=>{rendered=result.pages||result;const oldName=name;picker.replaceChildren(...rendered.map(p=>{const option=el('option',p.displayName||p.name);option.value=p.name;return option;}));if(result.selectedName&&rendered.some(p=>p.name===result.selectedName))name=result.selectedName;else name=oldName;const restore=!initializing&&restoreActual;if(!initializing)restoreActual=false;display();if(restore&&viewState.mode!=='actual')actualView.activate({preserve:true,prompt:false});};
 const queue=previewQueue({read,build,publish,state(kind,error){if(kind==='ready'||kind==='slow')controls.querySelector('.dialog-task-error')?.remove();status.dataset.state=kind;status.textContent=kind==='slow'?(live.checked?'Preview updated. Live preview stays on; slower drawings wait longer between edits.':'Preview updated. Live preview remains paused.'):kind==='pending'?'Updating preview… Your project is unchanged.':kind==='error'?'Not previewed: '+error.message+' The last valid preview is retained.':'Preview only — not saved.'+(currentPage?.pageOverflow?' Off-page content may be clipped in print/export.':'');}});
 const changed=event=>{if(event.type==='click'&&!event.target.closest('button'))return;if(live.checked)queue.request();else{status.dataset.state='paused';status.textContent='Preview paused. Use Update preview to see these changes.';}};
 for(const type of ['input','change','click'])controls.addEventListener(type,changed);
 live.onchange=()=>{viewState.live=preferences.live=live.checked;if(live.checked){queue.resume();queue.request(0);}else{queue.pause();status.dataset.state='paused';status.textContent='Live preview paused. Use Update preview when ready.';}};
 picker.onchange=()=>{restoreActual=false;name=picker.value;display();};
 let drag=null;viewport.onpointerdown=event=>{if(!svg||![0,1].includes(event.button))return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewState.x,top:viewState.y,mode:viewState.mode};viewport.focus({preventScroll:true});viewport.setPointerCapture(event.pointerId);event.preventDefault();};
 viewport.onpointermove=event=>{if(drag&&event.pointerId===drag.id){viewState.x=drag.left+event.clientX-drag.x;viewState.y=drag.top+event.clientY-drag.y;if(viewState.mode==='fit')viewState.mode='custom';paint();}};
 const release=event=>{if(!drag||event.pointerId!==drag.id)return;if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);drag=null;};viewport.onpointerup=viewport.onpointercancel=release;
 viewport.addEventListener('wheel',event=>{event.preventDefault();const box=viewport.getBoundingClientRect();zoom(Math.exp(-event.deltaY*.0015),event.clientX-box.left,event.clientY-box.top);},{passive:false});
 viewport.addEventListener('keydown',event=>{if(['+','=','-','0',' '].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='0')fit();else if(event.key!==' ')zoom(event.key==='-'?1/1.25:1.25);}});
 viewport.addEventListener('dragstart',event=>event.preventDefault());
 const observer=new ResizeObserver(()=>{setControlsWidth();if(viewState.mode==='fit')fit();else paint();});observer.observe(viewport);observer.observe(body);
 const dispose=()=>{if(disposed)return;disposed=true;endResize();queue.dispose();actualView.dispose();observer.disconnect();for(const type of ['input','change','click'])controls.removeEventListener(type,changed);dialog.removeEventListener('close',dispose);};
 dialog.addEventListener('close',dispose);publish(initialPages);initializing=false;requestAnimationFrame(()=>{if(!disposed){setControlsWidth();if(viewState.mode==='fit')fit();}});
 return {dispose,request:()=>{if(live.checked)queue.request(0);},controls,view};
}
