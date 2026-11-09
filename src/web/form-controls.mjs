// Enhance the existing controls without replacing their IDs, labels, native
// values, parent containers or event handlers. Dynamic dialogs use the same UI.
const textTypes=new Set(['text','search','email','url','tel','password','number']);
const eligible=input=>input.localName==='textarea'||input.localName==='input'&&textTypes.has(input.type);
const labelFor=input=>input.getAttribute('aria-label')||[...input.labels||[]].map(label=>label.textContent.trim()).join(' ')||input.placeholder||'field';

export function installFormControls(doc=document){
 const win=doc.defaultView,records=new Map(),parents=new Map(),listeners=[];let frame=0,serial=0,active=null;
 const on=(node,event,fn,options)=>{node.addEventListener(event,fn,options);listeners.push(()=>node.removeEventListener(event,fn,options));};
 const make=(tag,cls)=>{const node=doc.createElement(tag);node.className=cls;return node;};
 const resize=new win.ResizeObserver(()=>schedule());
 const schedule=()=>{if(!frame)frame=win.requestAnimationFrame(refresh);};
 function watchParent(record,parent){
  if(record.parent===parent)return;
  if(record.parent){const count=parents.get(record.parent)-1;if(count)parents.set(record.parent,count);else{resize.unobserve(record.parent);parents.delete(record.parent);}}
  record.parent=parent;if(parent){parents.set(parent,(parents.get(parent)||0)+1);resize.observe(parent);}
 }
 function button(input,cls,title){const node=make('button',cls);node.type='button';node.setAttribute('aria-label',title);node.title=title;node.addEventListener('pointerdown',event=>event.preventDefault());return node;}
 function dispatch(input){input.dispatchEvent(new win.Event('input',{bubbles:true}));input.dispatchEvent(new win.Event('change',{bubbles:true}));}
 function dismiss(){if(!active)return;const record=active;active=null;record.popup.hidden=true;if(typeof record.popup.hidePopover==='function'&&record.popup.matches(':popover-open'))record.popup.hidePopover();record.input.setAttribute('aria-expanded','false');record.input.removeAttribute('aria-activedescendant');}
 function placePopup(record){
  const box=record.input.getBoundingClientRect(),popup=record.popup,spaceBelow=win.innerHeight-box.bottom-8,spaceAbove=box.top-8,height=Math.min(320,Math.max(spaceBelow,spaceAbove));
  if(!box.width||!box.height){dismiss();return;}
  const width=Math.min(win.innerWidth-16,Math.max(box.width,280));
  Object.assign(popup.style,{width:width+'px',maxHeight:height+'px',left:Math.max(8,Math.min(box.left,win.innerWidth-width-8))+'px',top:'0px'});
  const actual=Math.min(height,popup.scrollHeight+2),top=spaceBelow>=Math.min(actual,180)||spaceBelow>=spaceAbove?box.bottom+4:box.top-actual-4;
  popup.style.top=Math.max(8,top)+'px';
 }
 function activate(record,index){
  record.index=index;const items=record.popup.querySelectorAll('[role=option]');
  for(const [i,item] of [...items].entries())item.setAttribute('aria-selected',String(i===index));
  const selected=items[index];if(!selected){record.input.removeAttribute('aria-activedescendant');return;}
  record.input.setAttribute('aria-activedescendant',selected.id);
  // Scroll the list itself, never scroll the diagram canvas or dialog to focus.
  const top=selected.offsetTop,bottom=top+selected.offsetHeight;
  if(top<record.popup.scrollTop)record.popup.scrollTop=top;
  else if(bottom>record.popup.scrollTop+record.popup.clientHeight)record.popup.scrollTop=bottom-record.popup.clientHeight;
 }
 function choose(record,index){
  const choice=record.matches[index];if(!choice)return;
  record.input.value=choice.value;record.input.focus({preventScroll:true});dispatch(record.input);dismiss();schedule();
 }
 function openSuggestions(record){
  if(!record.listId||record.input.matches(':disabled')||record.input.readOnly)return;
  if(active&&active!==record)dismiss();
  const list=doc.getElementById(record.listId);if(!list||list.localName!=='datalist'){dismiss();return;}
  const terms=record.input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),all=[...list.options].filter(option=>!option.disabled&&option.value).map(option=>({value:option.value,label:option.label===option.value?'':option.label}));
  const matches=all.filter(option=>terms.every(term=>(option.value+' '+option.label).toLocaleLowerCase().includes(term)));
  record.matches=matches.slice(0,100);record.index=-1;record.popup.replaceChildren();
  for(const [index,option] of record.matches.entries()){
   const item=make('div','nds-suggestion');item.id=record.popup.id+'-'+index;item.setAttribute('role','option');item.setAttribute('aria-selected','false');
   const value=make('span','nds-suggestion-value');value.textContent=option.value;item.append(value);
   if(option.label){const description=make('span','nds-suggestion-description');description.textContent=option.label;item.append(description);}
   item.addEventListener('pointerdown',event=>event.preventDefault());item.addEventListener('click',()=>choose(record,index));item.addEventListener('pointermove',()=>activate(record,index));record.popup.append(item);
  }
  if(!matches.length||matches.length>100){const hint=make('div','nds-suggestions-hint');hint.textContent=!matches.length?'No matching suggestions. You can enter a custom value.':'Showing 100 of '+matches.length+' matches. Type more to narrow the list.';record.popup.append(hint);}
  record.input.removeAttribute('aria-activedescendant');record.input.setAttribute('aria-expanded','true');record.popup.setAttribute('aria-label',labelFor(record.input)+' suggestions');record.popup.hidden=false;active=record;
  if(typeof record.popup.showPopover==='function'&&!record.popup.matches(':popover-open'))record.popup.showPopover();placePopup(record);
 }
 function suggestions(record,id){
  record.listId=id;record.input.removeAttribute('list');record.input.dataset.suggestionList=id;
  if(record.popup)return;
  const popup=record.popup=make('div','nds-suggestions');popup.id='nds-suggestions-'+(++serial);popup.hidden=true;popup.setAttribute('role','listbox');popup.setAttribute('popover','manual');(record.input.closest('dialog')||doc.body).append(popup);
  const input=record.input;input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',popup.id);input.setAttribute('autocomplete','off');input.classList.add('nds-combobox');
  const toggle=record.toggle=button(input,'nds-suggestion-toggle','Show '+labelFor(input)+' suggestions');toggle.tabIndex=-1;record.clear.after(toggle);
  toggle.addEventListener('click',()=>{if(active===record)dismiss();else{input.focus({preventScroll:true});openSuggestions(record);}});
  input.addEventListener('input',()=>openSuggestions(record));input.addEventListener('focus',()=>openSuggestions(record));input.addEventListener('click',()=>openSuggestions(record));
  input.addEventListener('keydown',event=>{
   if(event.isComposing)return;
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();event.stopPropagation();if(active!==record)openSuggestions(record);if(active!==record||!record.matches?.length)return;
    activate(record,(record.index+(event.key==='ArrowDown'?1:record.index<0?0:-1)+record.matches.length)%record.matches.length);
   }else if(event.key==='Enter'&&active===record&&record.index>=0){event.preventDefault();event.stopPropagation();choose(record,record.index);}
   else if(event.key==='Escape'&&active===record){event.preventDefault();event.stopPropagation();dismiss();}
   else if(event.key==='Tab')dismiss();
  });
 }
 function enhance(input){
  if(!eligible(input))return;
  let record=records.get(input);
  if(!record){
   const clear=button(input,'nds-input-clear','Clear '+labelFor(input));record={input,clear,parent:null,popup:null,toggle:null};records.set(input,record);input.classList.add('nds-clearable');input.after(clear);resize.observe(input);
   clear.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();if(input.matches(':disabled')||input.readOnly)return;
    input.focus({preventScroll:true});input.value='';dispatch(input);dismiss();schedule();
   });
  }
  const list=input.getAttribute('list');if(list)suggestions(record,list);
 }
 function scan(node){if(node.nodeType!==1&&node!==doc)return;if(node.nodeType===1&&node.matches('input,textarea'))enhance(node);for(const input of node.querySelectorAll('input,textarea'))enhance(input);}
 function refresh(){
  frame=0;
  for(const [input,record] of records){
   if(!input.isConnected||!eligible(input)){if(active===record)dismiss();record.clear.remove();record.toggle?.remove();record.popup?.remove();resize.unobserve(input);watchParent(record,null);input.classList.remove('nds-clearable','nds-combobox');records.delete(input);continue;}
   const parent=input.parentElement;
   if(parent!==record.parent||record.clear.parentElement!==parent){watchParent(record,parent);if(win.getComputedStyle(parent).position==='static')parent.classList.add('nds-control-host');input.after(record.clear);if(record.toggle)record.clear.after(record.toggle);}
   const hidden=input.hidden||input.matches(':disabled')||input.readOnly||!input.getClientRects().length;
   if(record.clear.hidden!==hidden)record.clear.hidden=hidden;
   if(record.toggle&&record.toggle.hidden!==hidden)record.toggle.hidden=hidden;
   if(hidden)continue;
   const disabled=input.value==='';if(record.clear.disabled!==disabled)record.clear.disabled=disabled;
   const title='Clear '+labelFor(input);if(record.clear.title!==title){record.clear.title=title;record.clear.setAttribute('aria-label',title);}
   const numeric=input.type==='number',top=input.offsetTop+(input.localName==='textarea'?4:Math.max(0,(input.offsetHeight-22)/2)),end=record.toggle?29:numeric?20:4;
   record.clear.style.left=(input.offsetLeft+input.offsetWidth-end-22)+'px';record.clear.style.top=top+'px';
   if(record.toggle){record.toggle.style.left=(input.offsetLeft+input.offsetWidth-27)+'px';record.toggle.style.top=(input.offsetTop+Math.max(0,(input.offsetHeight-24)/2))+'px';}
  }
  if(active){if(!active.input.isConnected||active.input.hidden||active.input.matches(':disabled')||active.input.readOnly)dismiss();else placePopup(active);}
 }
 const observer=new win.MutationObserver(changes=>{for(const change of changes){if(change.type==='childList')for(const node of change.addedNodes)scan(node);else if(change.target.matches?.('input,textarea'))enhance(change.target);}schedule();});
 observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['type','list','disabled','readonly','hidden','value','id','aria-label']});
 for(const event of ['input','change','focusin','pointerup'])on(doc,event,schedule);
 on(doc,'pointerdown',event=>{if(active&&event.target!==active.input&&event.target!==active.clear&&event.target!==active.toggle&&!active.popup.contains(event.target))dismiss();},true);
 on(doc,'focusin',event=>{if(active&&event.target!==active.input&&event.target!==active.clear&&!active.popup.contains(event.target))dismiss();});
 on(doc,'scroll',()=>{if(active)placePopup(active);},true);on(win,'resize',schedule);on(doc,'close',dismiss,true);
 scan(doc);schedule();
 return {refresh(){scan(doc);schedule();},destroy(){dismiss();observer.disconnect();resize.disconnect();win.cancelAnimationFrame(frame);listeners.forEach(remove=>remove());for(const record of records.values()){record.clear.remove();record.toggle?.remove();record.popup?.remove();}records.clear();}};
}
