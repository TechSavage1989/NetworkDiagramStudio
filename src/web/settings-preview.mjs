let previewSerial=0;
// Preview work is isolated from the project/history. Late results cannot paint
// after a newer draft, a dialog replacement or cancellation.
export function previewQueue({read,build,publish,state=()=>{},delay=300,schedule=setTimeout,cancel=clearTimeout,now=()=>performance.now(),slowAfter=750}){
 let generation=0,timer=null,disposed=false,autoPaused=false;
 const request=(wait=delay,{manual=false}={})=>{
  if(disposed||autoPaused&&!manual)return;const current=++generation;if(timer!=null)cancel(timer);state('pending');
  timer=schedule(async()=>{timer=null;const started=now();try{const draft=read();const result=await build(draft);if(!disposed&&current===generation){publish(result);if(now()-started>=slowAfter&&!manual){autoPaused=true;state('slow');}else state('ready');}}catch(error){if(!disposed&&current===generation){const paused=!manual&&now()-started>=slowAfter;if(paused)autoPaused=true;state('error',error,{paused});}}},wait);
 };
 return {request,resume(){autoPaused=false;},pause(){generation++;if(timer!=null)cancel(timer);timer=null;},dispose(){disposed=true;generation++;if(timer!=null)cancel(timer);timer=null;}};
}
export function isolatedPreview(source,configure,build){const draft=structuredClone(source);configure(draft);return build(draft);}

export function settingsPreview(body,{read,build,initialPages=[],selectedName='',viewState={}}){
 const dialog=body.closest('dialog'),el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
 dialog.classList.add('settings-preview-dialog');
 const controls=el('section','','settings-preview-controls');controls.setAttribute('aria-label','Settings controls');controls.append(...body.childNodes);
 const view=el('section','','settings-preview-view');view.setAttribute('aria-label','Live diagram preview');
 const toolbar=el('div','','settings-preview-toolbar'),liveLabel=el('label','Live preview'),live=el('input');live.type='checkbox';live.checked=viewState.live!==false;liveLabel.prepend(live);toolbar.append(liveLabel);
 const action=(title,fn)=>{const b=el('button',title);b.type='button';b.onclick=fn;toolbar.append(b);return b;};
 const update=action('Update preview',()=>queue.request(0,{manual:true}));
 const pagesLabel=el('label','Preview page'),picker=el('select');picker.setAttribute('aria-label','Preview page');pagesLabel.append(picker);toolbar.append(pagesLabel);
 const status=el('p','Current drawing. Changes are previewed, not saved.','settings-preview-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.state='ready';
 const viewport=el('div','','settings-preview-viewport');viewport.setAttribute('aria-label','Read-only preview: drag to pan');viewport.tabIndex=0;
 const stage=el('div','','settings-preview-stage');viewport.append(stage);
 const zoomLabel=el('span','','settings-preview-zoom');let zoom=viewState.zoom||1,currentPage=null,rendered=initialPages,name=selectedName,disposed=false;
 const fit=()=>{if(disposed||!currentPage)return;viewState.zoom=zoom;const width=currentPage.width||1200,height=currentPage.height||800,ratio=Math.min(Math.max(1,viewport.clientWidth-20)/width,Math.max(1,viewport.clientHeight-20)/height),w=Math.max(1,width*ratio*zoom),h=Math.max(1,height*ratio*zoom);stage.style.width=w+'px';stage.style.height=h+'px';zoomLabel.textContent=Math.round(zoom*100)+'% of fit';};
 action('−',()=>{zoom=Math.max(.25,zoom/1.25);fit();}).setAttribute('aria-label','Preview zoom out');
 action('Fit preview',()=>{zoom=1;fit();viewport.scrollTo(0,0);});
 action('+',()=>{zoom=Math.min(16,zoom*1.25);fit();}).setAttribute('aria-label','Preview zoom in');toolbar.append(zoomLabel);
 const widthLabel=el('label','Controls width','settings-preview-width'),width=el('input');width.type='range';width.min=280;width.max=720;width.value=400;width.step=20;width.setAttribute('aria-label','Settings controls width');width.oninput=()=>controls.style.width=width.value+'px';widthLabel.append(width);toolbar.append(widthLabel);
 view.append(toolbar,status,viewport,el('p','Read-only preview. Drag to pan; zoom stays set as you change settings. This is not calibrated Actual size. Apply saves once; Cancel or Close discards the draft.','hint'));
 body.replaceChildren(controls,view);
 const display=()=>{const oldX=viewState.left||0,oldY=viewState.top||0;currentPage=rendered.find(p=>p.name===name)||rendered[0];stage.replaceChildren();if(currentPage){name=currentPage.name;picker.value=name;stage.innerHTML=currentPage.svg;const svg=stage.querySelector('svg');if(svg){const prefix='settings-preview-'+(++previewSerial)+'-',ids=new Map([...svg.querySelectorAll('[id]')].map(node=>[node.id,prefix+node.id]));for(const node of [svg,...svg.querySelectorAll('*')])for(const attr of [...node.attributes]){if(attr.name==='id'&&ids.has(attr.value))node.setAttribute(attr.name,ids.get(attr.value));else if(/href$/.test(attr.name)&&attr.value.startsWith('#')&&ids.has(attr.value.slice(1)))node.setAttribute(attr.name,'#'+ids.get(attr.value.slice(1)));else if(attr.value.includes('url(#'))node.setAttribute(attr.name,attr.value.replace(/url\(#([^)]*)\)/g,(all,id)=>ids.has(id)?'url(#'+ids.get(id)+')':all));}svg.setAttribute('aria-label','Preview diagram');}fit();viewport.scrollTo(oldX,oldY);}else{stage.textContent='No visible pages for these settings.';stage.style.width='100%';stage.style.height='100%';}};
 const publish=result=>{rendered=result.pages||result;const oldName=name;picker.replaceChildren(...rendered.map(p=>{const option=el('option',p.displayName||p.name);option.value=p.name;return option;}));if(result.selectedName&&rendered.some(p=>p.name===result.selectedName))name=result.selectedName;else name=oldName;display();};
 const queue=previewQueue({read,build,publish,state(kind,error,{paused=false}={}){if(kind==='slow'||paused){live.checked=false;viewState.live=false;}status.dataset.state=kind;status.textContent=kind==='slow'?'Preview updated. Automatic updates paused because this drawing takes time to rebuild. Use Update preview, or re-enable Live preview to try again.':kind==='pending'?'Updating preview… Your project is unchanged.':kind==='error'?'Not previewed: '+error.message+' The last valid preview is retained.'+(paused?' Automatic updates paused because this drawing takes time to rebuild. Use Update preview to retry, or re-enable Live preview.':''):'Preview only — not saved.'+(currentPage?.pageOverflow?' Off-page content may be clipped in print/export.':'');}});
 const changed=event=>{if(event.type==='click'&&!event.target.closest('button'))return;if(live.checked)queue.request();else{status.dataset.state='paused';status.textContent='Preview paused. Use Update preview to see these changes.';}};
 for(const type of ['input','change','click'])controls.addEventListener(type,changed);
 live.onchange=()=>{viewState.live=live.checked;if(live.checked){queue.resume();queue.request(0);}else{queue.pause();status.dataset.state='paused';status.textContent='Live preview paused. Use Update preview when ready.';}};
 picker.onchange=()=>{name=picker.value;display();};
 let drag=null;viewport.onpointerdown=event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(event.pointerId);event.preventDefault();};
 viewport.onpointermove=event=>{if(drag)viewport.scrollTo(drag.left+drag.x-event.clientX,drag.top+drag.y-event.clientY);};viewport.onpointerup=viewport.onpointercancel=()=>{drag=null;};
 viewport.addEventListener('scroll',()=>{viewState.left=viewport.scrollLeft;viewState.top=viewport.scrollTop;});
 const observer=new ResizeObserver(fit);observer.observe(viewport);
 const dispose=()=>{if(disposed)return;disposed=true;queue.dispose();observer.disconnect();for(const type of ['input','change','click'])controls.removeEventListener(type,changed);dialog.removeEventListener('close',dispose);};
 dialog.addEventListener('close',dispose);publish(initialPages);requestAnimationFrame(fit);
 return {dispose,request:()=>{if(live.checked)queue.request(0);},controls,view};
}
