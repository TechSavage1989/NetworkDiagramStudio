import {cleanLabelBacking,LABEL_BACKING} from './label-backing-settings.mjs';
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
  const captions=global?check(identity,'Show cable type and speed on connection lines',layout.cableCaptions===true):null;
  if(captions)identity.append(el('p','The connection key already names each cable color, so this text is off unless chosen. A caption you moved or edited stays visible.','hint'));
  const backing=cleanLabelBacking(layout.labelBacking);
  const backingMode=global?field(identity,'Port/link label backing',backing.mode,[['white','White'],['transparent','Transparent']]):null;
  const backingPadding=global?numeric(identity,'Port/link label padding (px)',backing.padding,LABEL_BACKING.min,LABEL_BACKING.max):null;
  if(backingPadding){backingPadding.step=.5;backingPadding.disabled=backingMode.value==='transparent';backingMode.onchange=()=>{backingPadding.disabled=backingMode.value==='transparent';};identity.append(el('p','White backing hugs the lettering. Padding adds space on each side (default 0.5 px; 0 for none). Transparent leaves the cable visible behind text. Saved text positions and sizes stay unchanged.','hint'));}
  const hops=global?field(identity,'Line jumps',layout.hopStyle==='bundle'?'bundle':'single',[['single','One hop per crossed line'],['bundle','One bridge over close lines']]):null;
  const documentation=global?field(identity,'Document detail',layout.documentation==='full'?'full':'concise',[['concise','Concise - combine shared data and avoid repeated tables'],['full','Full reference - include separate VLAN membership matrices']]):null;
  if(global)identity.append(el('p','Port Inventory keeps complete physical port assignments. Concise pages share identical network definitions across devices and retain unique addresses, routes and logical interfaces. Custom reports and edited reference pages remain available.','hint'));
  // Network pages read the saved device order down each column, then across.
  const network=!global&&page?.coreDeviceIds&&!page.reportId,named=network&&page.corePageId?layout.corePages.find(p=>p.id===page.corePageId):null;
  const arrangement=global?field(identity,'Network page arrangement',layout.coreArrangement||'compact',CORE_ARRANGEMENT_CHOICES):named?field(identity,'Device arrangement',named.arrangement||'',[['','Use drawing default'],...CORE_ARRANGEMENT_CHOICES]):network?field(identity,'Device arrangement (all automatic network pages)',layout.coreArrangement||'compact',CORE_ARRANGEMENT_CHOICES):null;
  if(arrangement)identity.append(el('p','Compact packs devices into the least area. Every arrangement keeps the saved device order (Device order / Core pages), reading down each column and then across. Choosing a different arrangement replaces moved device positions on those pages; sizes, text and cable styles stay.','hint'));
  const inherited=!global&&check(identity,'Use drawing defaults',!['drawingScale','textScale','minimumTextPt','wirelessApScale','wirelessApPlacement','panel'].some(k=>own[k]!=null));
  const sizes=el('fieldset','','layout-card');body.append(sizes);sizes.append(el('legend','Size & text'));
  const grid=el('div','','layout-grid');sizes.append(grid);
  const drawing=numeric(grid,'Drawing scale (%)',Math.round(config.drawingScale*100),10,400),text=numeric(grid,'Text scale (%)',Math.round(config.textScale*100),10,400);
  const minimumText=numeric(grid,'Minimum paper text (pt)',config.minimumTextPt,0,18);minimumText.step=.5;
  const wirelessAp=numeric(grid,'Wireless APs and details (%)',Math.round(config.wirelessApScale*100),25,400);
  const wirelessPlacement=field(grid,'Wireless AP placement',config.wirelessApPlacement,[['rows','Preserve rows (default)'],['sides','Use side space']]);
  sizes.append(el('p','Use side space tries measured AP columns beside the switch when their routes stay clear and no more crossed. Authored positions and frozen layouts are preserved; constrained diagrams keep their rows.','hint'));
  const equipment=global?numeric(grid,'All device sizes (%)',Math.round(config.deviceScale*100),10,400):null;
  sizes.append(el('p','Text scale applies to this page or all pages through Drawing defaults. Minimum paper text defaults to 8 pt (0 disables it); it is measured on paper, not at screen zoom. Auto-fit enlarges the complete diagram only when needed, without breaking cable or label placement. If readable content cannot fit, choose larger paper or split the drawing. Explicit individual font sizes and saved page frames remain yours. Native artwork/report typography is preserved; enlarge its sheet if needed.','hint'));
  const panel=el('fieldset','','layout-card');panel.append(el('legend','Information panel'));body.append(panel);
  const settings=config.panel,show=check(panel,'Show information panel',settings.visible),panelGrid=el('div','','layout-grid');panel.append(panelGrid);
  const placement=field(panelGrid,'Panel position',settings.position,[['left','Left of drawing'],['right','Right of drawing'],['top','Above drawing'],['free','Custom position']]),width=numeric(panelGrid,'Panel width',settings.width,120,1000),scale=numeric(panelGrid,'Panel scale (%)',settings.scale*100,10,400),panelText=numeric(panelGrid,'Panel text scale (%)',settings.textScale*100,10,400);
  const paperWidth=numeric(panelGrid,'Panel width (% of paper; 0 = automatic)',settings.paperWidth,0,60);
  panel.append(el('p','On physical paper, automatic width follows the actual content. Set 10–60 percent to reserve a wider or narrower rail; text rewraps instead of shrinking. Panel width controls source drawing units on Dynamic pages. Reduce sections or choose larger paper if readable content overflows.','hint'));
  const position=el('div','','layout-grid');panel.append(position);const x=numeric(position,'Panel left',settings.x,-1e6,1e6),y=numeric(position,'Panel top',settings.y,-1e6,1e6);position.hidden=placement.value!=='free';placement.onchange=()=>position.hidden=placement.value!=='free';
  const moduleDetails=field(panel,'Port modules detail','summary',[['summary','Summarize each module type'],['full','List every device and connected port']]);moduleDetails.value=settings.modulesMode;
  const contentGrid=el('div','','layout-grid');panel.append(contentGrid);
  const vlanMode=field(contentGrid,'VLAN display',settings.vlanMode,[['summary','Unique VLANs on this page'],['devices','VLANs grouped by device']]);
  const addressMode=field(contentGrid,'Address details',settings.addressMode,[['all','IP and MAC addresses'],['ip','IP addresses only'],['mac','MAC addresses only']]);
  const portMode=field(contentGrid,'Port detail filter',settings.portMode,[['all','All recorded port details'],['vlans','Ports with VLAN assignments'],['described','Ports with descriptions']]);
  const rowLimit=field(contentGrid,'Rows per section',String(settings.rowLimit),[['20','20'],['40','40'],['80','80'],['120','120']]);
  const emptySections=field(contentGrid,'Sections without data',settings.emptySections,[['hide','Hide empty sections (default)'],['explain-opt-in','Show an explanation']]);
  panel.append(el('p','Automatic sections use only recorded information for devices on the page. Shared VLAN IDs appear once by default; all recorded names and addresses are retained. Missing data is never inferred. Row limits show a notice when more items exist.','hint'));
  const fields=el('div','','panel-section-editor');panel.append(fields);
  const builtin=new Map(panelFields),custom=new Map(settings.customSections.map(item=>[item.id,item.title])),sectionControls=[];
  const sectionOrder=[...new Set([...settings.sections,...panelFields.map(([id])=>id),...settings.customSections.map(s=>s.id)])];
  const makeSection=id=>{
   const title=custom.get(id)||builtin.get(id)||'Custom section';
   const card=el('section','','panel-section-row');card.dataset.sectionId=id;fields.append(card);
   const header=el('div','','panel-section-header');card.append(header);
   const toggle=check(header,'Show '+title,settings.sections.includes(id));
   const buttons=el('div','','actions');header.append(buttons);
   button(buttons,'Up',()=>{const above=card.previousElementSibling;if(above)fields.insertBefore(card,above);});
   button(buttons,'Down',()=>{const after=card.nextElementSibling;if(after)fields.insertBefore(after,card);});
   if(custom.has(id))button(buttons,'Remove',()=>{card.remove();});
   const heading=field(card,'Section heading',settings.sectionTitles[id]||title);heading.maxLength=80;
   const override=field(card,'Custom content (optional, one item per line)',settings.sectionContent[id]||'','multiline');override.rows=2;override.maxLength=16000;
   card.append(el('p','Leave custom content empty to use imported project details. This section is editable in the drawing after it is generated.','hint'));
   sectionControls.push({id,card,toggle,heading,override});
  };
  sectionOrder.forEach(makeSection);
  const newSection=el('div','','layout-card');panel.append(newSection);
  const customTitle=field(newSection,'New sidebar section','');customTitle.maxLength=80;
  button(newSection,'Add custom section',()=>{const title=customTitle.value.trim();if(!title)throw Error('Enter a section name.');const id='custom-'+crypto.randomUUID().slice(0,18);custom.set(id,title);settings.sections.push(id);makeSection(id);customTitle.value='';});
  const notes=field(panel,'Legacy notes text',settings.notes,'multiline');notes.rows=2;notes.maxLength=10000;
  panel.append(el('p','Enable or disable any section, change its heading, enter custom rows, and use Up or Down to choose the order. Custom content does not alter device configurations or original inventory.','hint'));
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
   const numericFields=(global||!inherited.checked?[drawing,text,minimumText,wirelessAp,equipment,...(show.checked?[width,paperWidth,scale,panelText,...(placement.value==='free'?[x,y]:[])]:[])]:[]).concat(backingPadding||[]).filter(Boolean);const invalid=numericFields.find(n=>!n.value||!Number.isFinite(+n.value)||+n.value<+n.min||+n.value>+n.max);if(invalid){invalid.focus();invalid.scrollIntoView({block:'center'});throw Error('Enter a value from '+invalid.min+' to '+invalid.max+' in the highlighted size or position field.');}
   if((global||!inherited.checked)&&show.checked&&+paperWidth.value>0&&+paperWidth.value<10)throw Error('Panel width must be 0 for automatic or 10–60 percent.');
   const next=global?layout.presentation.defaults:{...(name?.value.trim()?{name:name.value.trim()}:{}),...(!visible?.checked?{hidden:true}:{})};
   if(global||!inherited.checked)Object.assign(next,{drawingScale:+drawing.value/100,textScale:+text.value/100,minimumTextPt:+minimumText.value,wirelessApScale:+wirelessAp.value/100,wirelessApPlacement:wirelessPlacement.value,panel:{visible:show.checked,position:placement.value,width:+width.value,paperWidth:+paperWidth.value,scale:+scale.value/100,textScale:+panelText.value/100,x:+x.value,y:+y.value,sections:[...fields.children].filter(card=>sectionControls.find(c=>c.card===card)?.toggle.checked).map(card=>card.dataset.sectionId),
    customSections:sectionControls.filter(c=>c.card.isConnected&&c.id.startsWith('custom-')).map(c=>({id:c.id,title:c.heading.value.trim().slice(0,80)||'Custom section'})),
    sectionTitles:Object.fromEntries(sectionControls.filter(c=>c.card.isConnected).map(c=>[c.id,c.heading.value.trim().slice(0,80)]).filter(([,title])=>title)),
    sectionContent:Object.fromEntries(sectionControls.filter(c=>c.card.isConnected&&c.override.value.trim()).map(c=>[c.id,c.override.value.slice(0,16000)])),
    modulesMode:moduleDetails.value,vlanMode:vlanMode.value,addressMode:addressMode.value,portMode:portMode.value,rowLimit:+rowLimit.value,emptySections:emptySections.value,notes:notes.value}});
   if(global){layout.labelBacking={mode:backingMode.value,padding:+backingPadding.value};next.deviceScale=+equipment.value/100;layout.presentation.defaults=next;layout.documentation=documentation.value;layout.cableCaptions=captions.checked;if(hops.value==='bundle')layout.hopStyle='bundle';else delete layout.hopStyle;}else{if(page?.reportId&&!key.includes('|')&&definition){definition.name=next.name||definition.name;delete next.name;}layout.presentation.pages[key]=next;}
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
  const feedback=el('p','','layout-apply-feedback');feedback.setAttribute('role','alert');feedback.setAttribute('aria-live','assertive');feedback.tabIndex=-1;feedback.hidden=true;actions.before(feedback);
  button(actions,'Apply layout',()=>{try{store();const assigned=new Set([...layout.corePages,...layout.reportPages].flatMap(p=>p.devices));apply(layout,[...include].filter(id=>assigned.has(id)));close();}catch(error){feedback.textContent='Layout was not applied. '+error.message+' Your edits are still here; correct the setting and try again.';feedback.hidden=false;feedback.scrollIntoView({block:'nearest'});feedback.focus();}},'primary');button(actions,'Cancel',close);
  if(!global)button(actions,'Reset page layout',()=>{delete layout.presentation.pages[key];render();});
 }
 render();
}
