import {cleanPresentation,presentation,panelFields,displayPageName} from './presentation.mjs';
import {CORE_ARRANGEMENT_CHOICES,arrangeCoreLayout} from './core-arrangement.mjs';

export function pageLayoutEditor({project,pages,selected,modal,field,button,apply,close}){
 const layout=structuredClone(project.layout||{});layout.presentation=cleanPresentation(layout.presentation);layout.corePages||=[];layout.reportPages||=[];
 let key=selected||'*',store=()=>{};const include=new Set();
 const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
 const check=(parent,title,checked)=>{const label=el('label','','layout-check'),input=el('input');input.type='checkbox';input.checked=checked;input.setAttribute('aria-label',title);label.append(input,document.createTextNode(title));parent.append(label);return input;};
 const numeric=(parent,title,value,min,max)=>{const n=field(parent,title,value);n.type='number';n.min=min;n.max=max;n.step=1;return n;};
 const entries=()=>{
  const list=pages.slice();
  for(const p of layout.corePages)if(!list.some(v=>v.corePageId===p.id))list.push({name:p.name,displayName:p.name,corePageId:p.id,coreDeviceIds:p.devices});
  for(const p of layout.reportPages)if(!list.some(v=>v.reportId===p.id))list.push({name:'report:'+p.id,displayName:p.name,reportId:p.id,sourceDeviceIds:p.devices});
  return list;
 };
 function render(){
  const body=modal('Pages & layout','page-layout-dialog'),page=entries().find(p=>p.name===key),global=key==='*',config=presentation({layout},key),own=layout.presentation.pages[key]||{};
  body.append(el('p','Choose a page to rename it, select its devices, or customize its layout. Drawing defaults apply wherever a page has no override.','hint'));
  const navigation=el('nav','','layout-sections');navigation.setAttribute('aria-label','Layout sections');body.append(navigation);
  const target=field(body,'Edit page',key,[['*','Drawing defaults — all pages'],...entries().map(p=>[p.name,displayPageName({layout},p)])]);
  target.onchange=()=>{try{store();key=target.value;render();}catch(error){target.value=key;target.setCustomValidity(error.message);target.reportValidity();target.setCustomValidity('');}};
  const identity=el('div','','layout-card');body.append(identity);
  let name,visible;if(!global){name=field(identity,'Page name',displayPageName({layout},page||{name:key}));name.maxLength=80;visible=check(identity,'Show this page',!own.hidden);}
  else identity.append(el('h3','Drawing defaults'));
  const documentation=global?field(identity,'Document detail',layout.documentation==='full'?'full':'concise',[['concise','Concise - combine shared data and avoid repeated tables'],['full','Full reference - include separate VLAN membership matrices']]):null;
  if(global)identity.append(el('p','Port Inventory keeps complete physical port assignments. Concise pages share identical network definitions across devices and retain unique addresses, routes and logical interfaces. Custom reports and edited reference pages remain available.','hint'));
  // Network pages read the saved device order down each column, then across.
  const network=!global&&page?.coreDeviceIds&&!page.reportId,named=network&&page.corePageId?layout.corePages.find(p=>p.id===page.corePageId):null;
  const arrangement=global?field(identity,'Network page arrangement',layout.coreArrangement||'compact',CORE_ARRANGEMENT_CHOICES):named?field(identity,'Device arrangement',named.arrangement||'',[['','Use drawing default'],...CORE_ARRANGEMENT_CHOICES]):network?field(identity,'Device arrangement (all automatic network pages)',layout.coreArrangement||'compact',CORE_ARRANGEMENT_CHOICES):null;
  if(arrangement)identity.append(el('p','Compact packs devices into the least area. Every arrangement keeps the saved device order (Device order / Core pages), reading down each column and then across. Choosing a different arrangement replaces moved device positions on those pages; sizes, text and cable styles stay.','hint'));
  const inherited=!global&&check(identity,'Use drawing defaults',!['drawingScale','textScale','panel'].some(k=>own[k]!=null));
  const sizes=el('fieldset','','layout-card');body.append(sizes);sizes.append(el('legend','Size & text'));
  const grid=el('div','','layout-grid');sizes.append(grid);
  const drawing=numeric(grid,'Drawing scale (%)',Math.round(config.drawingScale*100),10,400),text=numeric(grid,'Text scale (%)',Math.round(config.textScale*100),10,400);
  const equipment=global?numeric(grid,'All device sizes (%)',Math.round(config.deviceScale*100),10,400):null;
  sizes.append(el('p','Drawing scale changes the whole page. Text scale changes lettering. Open a device or drawing object to set its individual size.','hint'));
  const panel=el('fieldset','','layout-card');panel.append(el('legend','Information panel'));body.append(panel);
  const settings=config.panel,show=check(panel,'Show information panel',settings.visible),panelGrid=el('div','','layout-grid');panel.append(panelGrid);
  const placement=field(panelGrid,'Panel position',settings.position,[['left','Left of drawing'],['right','Right of drawing'],['top','Above drawing'],['free','Custom position']]),width=numeric(panelGrid,'Panel width',settings.width,120,1000),scale=numeric(panelGrid,'Panel scale (%)',settings.scale*100,10,400),panelText=numeric(panelGrid,'Panel text scale (%)',settings.textScale*100,10,400);
  const position=el('div','','layout-grid');panel.append(position);const x=numeric(position,'Panel left',settings.x,-1e6,1e6),y=numeric(position,'Panel top',settings.y,-1e6,1e6);position.hidden=placement.value!=='free';placement.onchange=()=>position.hidden=placement.value!=='free';
  const fields=el('div','','layout-fields');panel.append(fields);const choices=panelFields.map(([id,title])=>[id,check(fields,title,settings.sections.includes(id))]);
  const notes=field(panel,'Custom notes',settings.notes,'multiline');notes.rows=3;notes.maxLength=10000;
  panel.append(el('p','Choose only the details you want. Panel content uses the devices on this page. Port locations and cable connections stay attached when sizes change.','hint'));
  const updateInheritance=()=>{sizes.disabled=panel.disabled=!!inherited?.checked;};if(inherited)inherited.onchange=updateInheritance;updateInheritance();
  let deviceChecks=[],definition=page?.reportId?layout.reportPages.find(p=>p.id===page.reportId):page?.corePageId?layout.corePages.find(p=>p.id===page.corePageId):null;
  if(!global&&(page?.coreDeviceIds||page?.reportId)){
   const card=el('section','','layout-card');body.insertBefore(card,sizes);card.append(el('h3',page.reportId?'Devices in this report':'Devices on this network page'));
   const search=field(card,'Find devices','');search.type='search';const list=el('div','','layout-device-list');card.append(list);const assigned=new Set(definition?.devices||page.coreDeviceIds||[]);
   deviceChecks=project.devices.map(d=>{const checked=check(list,d.name+(d.model?' · '+d.model:'')+(d.hidden?' (excluded from drawing)':''),assigned.has(d.id));checked.dataset.deviceId=d.id;checked.onchange=()=>{if(d.hidden&&checked.checked)include.add(d.id);};return [d.id,checked];});
   const selectActions=el('div','','actions');card.append(selectActions);button(selectActions,'Select all',()=>{for(const [id,input] of deviceChecks){input.checked=true;include.add(id);}});button(selectActions,'Clear selection',()=>{for(const [,input] of deviceChecks)input.checked=false;});
   search.oninput=()=>{for(const [,input] of deviceChecks)input.parentElement.hidden=!input.parentElement.textContent.toLowerCase().includes(search.value.toLowerCase());};
   card.append(el('p',page.reportId?'This selection applies to every continued sheet in this report.':'Devices may appear on more than one named network page. Connections to devices on other pages keep their page references.','hint'));
  }
  const creation=el('details','','layout-card');body.append(creation);creation.append(el('summary','Add a page'));
  const kind=field(creation,'New page type','core',[['core','Network diagram'],['ports','Port map'],['wireless','Wireless connections'],['logical','VLANs and routing'],['trunk','Trunk VLANs']]),newName=field(creation,'New page name','');
  for(const [title,target] of [['Page / devices',identity],['Sizes & text',sizes],['Panel details',panel],['New page',creation]])button(navigation,title,()=>{if(target===creation)creation.open=true;target.scrollIntoView({block:'start'});});
  button(creation,'Add page',()=>{store();const title=newName.value.trim();if(!title)throw Error('Enter a name for the new page.');if(entries().some(p=>displayPageName({layout},p)===title))throw Error('Choose a different page name.');const id=crypto.randomUUID();if(kind.value==='core'){key='network:'+id;layout.corePages.push({id,name:key,devices:[],showReferences:true});layout.presentation.pages[key]={name:title};}else{layout.reportPages.push({id,name:title,family:kind.value,devices:[]});key='report:'+id;}render();});
  store=()=>{
   const numericFields=[drawing,text,equipment,width,scale,panelText,x,y].filter(Boolean);if(numericFields.some(n=>!n.value||!Number.isFinite(+n.value)||+n.value<+n.min||+n.value>+n.max))throw Error('Enter sizes within the ranges shown.');
   const next=global?layout.presentation.defaults:{...(name?.value.trim()?{name:name.value.trim()}:{}),...(!visible?.checked?{hidden:true}:{})};
   if(global||!inherited.checked)Object.assign(next,{drawingScale:+drawing.value/100,textScale:+text.value/100,panel:{visible:show.checked,position:placement.value,width:+width.value,scale:+scale.value/100,textScale:+panelText.value/100,x:+x.value,y:+y.value,sections:choices.filter(([,input])=>input.checked).map(([id])=>id),notes:notes.value}});
   if(global){next.deviceScale=+equipment.value/100;layout.presentation.defaults=next;layout.documentation=documentation.value;}else{if(page?.reportId&&!key.includes('|')&&definition){definition.name=next.name||definition.name;delete next.name;}layout.presentation.pages[key]=next;}
   if(deviceChecks.length){const chosen=deviceChecks.filter(([,input])=>input.checked).map(([id])=>id);
    if(!page.reportId)layout.coreExclude=(layout.coreExclude||[]).filter(id=>!chosen.includes(id));
    if(definition)definition.devices=chosen;else if(JSON.stringify(chosen)!==JSON.stringify(page.coreDeviceIds)){definition={id:crypto.randomUUID(),name:page.name,devices:chosen,showReferences:true};layout.corePages.push(definition);}
   }
   // Last, because it returns fresh page definitions for the whole layout.
   if(arrangement){
    const before=named?named.arrangement||'':layout.coreArrangement||'compact',value=arrangement.value;
    if(value!==before)Object.assign(layout,arrangeCoreLayout({...project,layout},pages,named?{mode:value||null,corePageId:named.id}:{mode:value,scope:'global'}));
    if(definition)definition=layout.corePages.find(p=>p.id===definition.id)||definition;
   }
  };
  const actions=el('div','','actions layout-footer');body.append(actions);
  button(actions,'Apply layout',()=>{store();const assigned=new Set([...layout.corePages,...layout.reportPages].flatMap(p=>p.devices));apply(layout,[...include].filter(id=>assigned.has(id)));close();},'primary');button(actions,'Cancel',close);
  if(!global)button(actions,'Reset page layout',()=>{delete layout.presentation.pages[key];render();});
 }
 render();
}
