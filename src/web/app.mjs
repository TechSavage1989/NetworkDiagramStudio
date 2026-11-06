import {importFiles,mergeModels,deviceId} from './imports/index.mjs';
import {matchesHardware,modelKey} from './hardware-match.mjs';
import {buildPages,exportVisio,exportStencil} from './diagram/index.mjs';
import {openVisioCatalog,loadImageStencil} from './stencils.mjs';
import {sampleSite} from './sample.mjs';
import {orderedDevices,moveDevice,moveStep,cleanLayout} from './layout.mjs';
import {categories,readSources,ensureEvidence,captureEdits,composeEvidence} from './evidence.mjs';

const $=id=>document.getElementById(id);
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const emptyProject=()=>({name:'Untitled site',devices:[],links:[],warnings:[],stencils:{},optics:{},layout:{order:[],corePages:[],coreExclude:[],includeAPs:false}});
let project=emptyProject(),pages=[],active=0,dirty=false,working=false,evidenceSnapshot=null;
const snapshot=()=>JSON.parse(JSON.stringify({devices:project.devices,links:project.links,warnings:project.warnings}));
const modelKinds=['switch','firewall','ap','unknown'];
const validMedia=['unknown','copper','SR','LR','DAC','fiber'];
const object=x=>x && typeof x==='object'&&!Array.isArray(x);
const safeKey=s=>typeof s==='string'&&s.length>0&&s.length<=300&&!['__proto__','constructor','prototype'].includes(s);
const say=message=>{$('feedback').textContent=message;};
function download(content,name,mime='application/json'){
  const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type:mime}));
  const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);
}
const slug=s=>String(s||'Network').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,90)||'Network';
function busy(on){working=on;window.NDSDesktop?.setBusy(on);for(const id of ['new','import','paste','open','export','add-device','hardware','sample','print','svg'])if($(id))$(id).disabled=on||(['export','print','svg'].includes(id)&&!pages.length);}
async function task(action){if(working)return;busy(true);try{await action();}catch(e){say(e?.message||'The operation failed.');if($('dialog').open){let node=$('dialog-body').querySelector('.error');if(!node){node=el('p','','error');$('dialog-body').prepend(node);}node.textContent=e?.message||'The operation failed.';}}finally{busy(false);}}
function checkDiscard(){return !dirty||confirm('Discard the changes to this project?');}
function close(){if($('dialog').open)$('dialog').close();}
function modal(title){$('dialog-title').textContent=title;const body=$('dialog-body');body.replaceChildren();if(!$('dialog').open)$('dialog').showModal();return body;}
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
function perform(){captureEdits(project,evidenceSnapshot);if(project.evidence)evidenceSnapshot=snapshot();dirty=true;draw();}
function scoped(){
 const devices=project.devices.filter(d=>!d.hidden);const ids=new Set(devices.map(d=>d.id));
 const links=[],excludedPeerPorts=[];
 for(const l of project.links){
   const a=ids.has(l.a),b=ids.has(l.b);
   if(a&&b)links.push(l);
   else if(a)excludedPeerPorts.push([l.a,l.ap]);
   else if(b)excludedPeerPorts.push([l.b,l.bp]);
 }
 return {...project,devices,links,excludedPeerPorts};
}
const matchName=d=>[d.name,d.model,d.vendor,d.kind,d.ip].some(v=>String(v||'').toLowerCase().includes($('filter').value.trim().toLowerCase()));
function deviceList(){
 const panel=$('devices');panel.replaceChildren();let count=0;
 for(const d of orderedDevices(project).filter(matchName)){if(count++>=350)break;const row=el('div','','device-row'),include=el('input');include.type='checkbox';include.checked=!d.hidden;include.setAttribute('aria-label','Include '+d.name);
 include.onchange=()=>{d.scopeOverride=include.checked;d.hidden=!include.checked;perform();};const b=el('button',d.name);b.title='Edit '+d.name;b.append(el('small',[d.kind,d.model||d.vendor||'Model unspecified'].join('  /  ')));b.onclick=()=>editDevice(d);row.append(include,b);addOrderControls(row,d);panel.append(row);}
 if(!count)panel.append(el('p',project.devices.length?'No matching devices.':'No devices imported.','placeholder'));
 if(count>350)panel.append(el('p','Filter to view more devices.','placeholder'));
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
function arrange(){
 const body=modal('Device order and core pages');project.layout||=cleanLayout({},project.devices.map(d=>d.id));const layout=project.layout;
 const check=el('input');check.type='checkbox';check.checked=layout.includeAPs===true;check.id='core-aps';const title=el('label','Include access points on automatic core pages');title.htmlFor=check.id;line(body,check,title);
 check.onchange=()=>{layout.includeAPs=check.checked;perform();};
 const bar=actions(body);button(bar,'Add core page',()=>{layout.corePages||=[];layout.corePages.push({id:crypto.randomUUID(),name:'Core Network '+(layout.corePages.length+1),devices:[]});perform();arrange();});
 button(bar,'Use automatic pages',()=>{layout.corePages=[];layout.coreExclude=[];perform();arrange();});
 for(const page of layout.corePages||[]){const row=line(body);const input=el('input');input.value=page.name;input.setAttribute('aria-label','Core page name');row.append(input);input.onchange=()=>{page.name=input.value.trim()||'Core Network';perform();arrange();};button(row,'Remove',()=>{layout.corePages=layout.corePages.filter(x=>x!==page);perform();arrange();});}
 body.append(el('h3','Devices'));
 for(const d of orderedDevices(project).filter(d=>!d.hidden)){
  const row=el('div','','arrange-row');const text=el('div',d.name,'arrange-name');text.append(el('small',d.model||d.kind));row.append(text);
  const select=el('select');select.setAttribute('aria-label','Core page for '+d.name);
  const options=[['auto','Automatic'],['exclude','Exclude from core'],...(layout.corePages||[]).map(p=>[p.id,p.name])];
  for(const [value,label] of options){const o=el('option',label);o.value=value;select.append(o);}
  select.value=(layout.coreExclude||[]).includes(d.id)?'exclude':layout.corePages?.find(p=>p.devices.includes(d.id))?.id||'auto';
  select.onchange=()=>{for(const p of layout.corePages||[])p.devices=p.devices.filter(id=>id!==d.id);layout.coreExclude=(layout.coreExclude||[]).filter(id=>id!==d.id);if(select.value==='exclude')layout.coreExclude.push(d.id);else layout.corePages?.find(p=>p.id===select.value)?.devices.push(d.id);perform();};
  row.append(select);addOrderControls(row,d,arrange);body.append(row);
 }
}
function rebuildEvidence(){composeEvidence(project);initialScope();for(const s of Object.values(project.stencils))assignMatching(s);evidenceSnapshot=snapshot();dirty=true;draw();}
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
function draw(){
 $('site').value=project.name;$('heading').textContent=project.name;deviceList();
 const subset=scoped();const live=subset.devices.length>0;
 $('link-count').textContent='('+project.links.length+')';$('stats').textContent=subset.devices.length+' of '+project.devices.length+' devices   /   '+subset.links.length+' links';
 $('art-count').textContent=Object.keys(project.stencils).length+' local hardware shapes';
 const tabs=$('tabs');tabs.replaceChildren();const canvas=$('canvas');
 try{pages=live?buildPages(subset):[];}catch(e){pages=[];say('Diagram could not be built: '+e.message);}
 $('warnings').hidden=!project.warnings.length;$('warnings').textContent='Review '+project.warnings.length+' import '+(project.warnings.length===1?'note':'notes');
 active=Math.max(0,Math.min(active,pages.length-1));
 pages.forEach((page,i)=>{const b=el('button',page.name);b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===active));b.classList.toggle('active',i===active);b.onclick=()=>{active=i;draw();};tabs.append(b);});
 if(pages.length){const svg=new DOMParser().parseFromString(pages[active].svg,'image/svg+xml').documentElement;
  if(svg.localName!=='svg'){canvas.replaceChildren(el('p','Preview could not be rendered.'));}else canvas.replaceChildren(document.importNode(svg,true));}
 else if(!canvas.querySelector('#welcome')){const welcome=el('div');welcome.id='welcome';welcome.append(el('p','NEW DRAWING','eyebrow'),el('h2','Build a site diagram'),el('p','Import device files or open the editable sample.'));button(welcome,'Open sample site',sample);canvas.replaceChildren(welcome);}
 for(const id of ['export','print','svg'])$(id).disabled=!pages.length||working;
}
function cleanStencil(s){
 if(!object(s)||!safeKey(s.id)||typeof s.name!=='string'||!/^data:image\/(png|jpeg);base64,[0-9a-z+/]+=*$/i.test(s.dataUrl)||s.dataUrl.length>20e6||!(s.width>0&&s.height>0))throw Error('Invalid hardware shape.');
 const anchors=Object.create(null);for(const [k,v] of Object.entries(s.anchors||{})){if(safeKey(k)&&Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='number'&&n>=0&&n<=1))anchors[k]=v;}
 return {id:s.id,name:s.name.slice(0,200),models:Array.isArray(s.models)?s.models.filter(x=>typeof x==='string'&&x.length<=200):[],view:s.view==='rear'?'rear':'front',width:Number(s.width),height:Number(s.height),anchors,dataUrl:s.dataUrl};
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
 captureEdits(project,evidenceSnapshot);const inputs=await readSources(list);ensureEvidence(project).sources.push(...inputs);
 active=0;close();rebuildEvidence();say('Imported '+list.length+' file(s). Review categories under Imported data.');
}
function newProject(){if(!checkDiscard())return;project=emptyProject();evidenceSnapshot=null;active=0;dirty=false;$('filter').value='';say('');draw();}
function sample(){if(!checkDiscard())return;project=sampleSite();evidenceSnapshot=null;active=0;dirty=false;$('filter').value='';say('Fictional sample project opened.');draw();}
function editDevice(current){
 const d=current||{name:'',kind:'switch',vendor:'',model:'',ip:'',ports:[],vlans:[],routes:[]},body=modal(current?'Device details':'Add device');
 const name=field(body,'Device name',d.name);const kind=field(body,'Device type',d.kind,modelKinds),vendor=field(body,'Vendor',d.vendor),model=field(body,'Model',d.model),ip=field(body,'Management IP',d.ip);
 const options=[['','Schematic front'],...Object.values(project.stencils).filter(a=>a.view!=='rear').map(s=>[s.id,s.name])];
 const shape=field(body,'Front-panel stencil',d.stencilId||'',options);
 const scale=field(body,'Core faceplate scale (%)',Math.round((d.scale||1)*100));scale.type='number';scale.min=30;scale.max=100;scale.step=5;
 let ports,vlans,routes,bridges;
 const details=el('details');details.append(el('summary','Edit ports, VLANs and routing'));body.append(details);
 ports=field(details,'Ports (JSON array)',JSON.stringify(d.ports||[],null,2),'multiline');vlans=field(details,'VLANs',JSON.stringify(d.vlans||[],null,2),'multiline');
 routes=field(details,'Routes',JSON.stringify(d.routes||[],null,2),'multiline');bridges=field(details,'Virtual wire pairs / bridges',JSON.stringify(d.bridges||[],null,2),'multiline');
 const a=actions(body);button(a,'Save device',()=>{
  const n=name.value.trim();if(!n)throw Error('Enter a device name.');
  const id=d.id||deviceId(n);if(!safeKey(id)||project.devices.some(old=>old!==current&&deviceId(old.name)===deviceId(n)))throw Error('Use a unique device name.');
  let data;try{data=[ports,vlans,routes,bridges].map(input=>JSON.parse(input.value));}catch{throw Error('Port, VLAN and route data must be valid JSON.');}
  if(data.some(arr=>!Array.isArray(arr)||arr.some(x=>!object(x)))||data[0].some(p=>typeof p.name!=='string'||!p.name.trim()))throw Error('Use arrays of objects. Each port needs a name.');
  if(!(Number(scale.value)>=30&&Number(scale.value)<=100))throw Error('Use a faceplate scale from 30 to 100 percent.');
  Object.assign(d,{id,name:n,kind:kind.value,vendor:vendor.value.trim(),model:model.value.trim(),ip:ip.value.trim(),stencilId:shape.value,scale:Number(scale.value)/100,ports:data[0],vlans:data[1],routes:data[2],bridges:data[3]});
  if(!current){d.scopeOverride=true;project.devices.push(d);}
  const key=modelKey(d.vendor,d.model);if(key&&shape.value){for(const s of Object.values(project.stencils))s.models=(s.models||[]).filter(k=>k!==key);project.stencils[shape.value].models.push(key);assignMatching(project.stencils[shape.value]);}
  close();perform();say('Device saved.');
 },'primary');
 if(current)button(a,'Remove device',()=>{if(!confirm('Remove '+d.name+' and its connections?'))return;project.devices=project.devices.filter(n=>n!==d);project.links=project.links.filter(l=>l.a!==d.id&&l.b!==d.id);close();perform();});
}
function reviewLinks(){
 const body=modal('Connections');const accounts=new Map(project.devices.map(d=>[d.id,d.name]));button(body,'Add connection',()=>editLink());
 if(!project.links.length)body.append(el('p','No links imported. Add a connection using the local and remote interface names.','hint'));
 project.links.forEach((l,i)=>{const text=el('div');text.append(el('strong',(accounts.get(l.a)||l.a)+' '+l.ap+'  /  '+(accounts.get(l.b)||l.b)+' '+l.bp),el('div',[l.media||'Media unspecified',l.speed,l.status].filter(Boolean).join('  |  '),'asset-info'));const row=line(body,text);button(row,'Edit',()=>editLink(i));});
}
function editLink(i=-1){
 if(project.devices.length<2){say('Add or import at least two devices first.');return;}
 const l=project.links[i]||{},body=modal(i<0?'Add connection':'Edit connection'),opts=project.devices.map(d=>[d.id,d.name]);
 const a=field(body,'First device',l.a||opts[0][0],opts),ap=field(body,'First port',l.ap||''),b=field(body,'Second device',l.b||opts[1][0],opts),bp=field(body,'Second port',l.bp||'');
 function suggest(dev,input){
  const list=el('datalist');list.id='ports-'+input.id;body.append(list);input.setAttribute('list',list.id);
  const update=()=>{list.replaceChildren(...(project.devices.find(d=>d.id===dev.value)?.ports||[]).slice(0,1500).map(p=>{const o=el('option');o.value=p.name;return o;}));};dev.onchange=update;update();
 }suggest(a,ap);suggest(b,bp);
 const media=field(body,'Media',l.media||'unknown',Array.from(new Set([...validMedia,l.media].filter(Boolean)))),speed=field(body,'Link speed',l.speed||''),status=field(body,'Status',l.status||'confirmed',Array.from(new Set(['confirmed','inferred','unverified',l.status].filter(Boolean))));
 const bar=actions(body);button(bar,'Save connection',()=>{
  if(a.value===b.value||!ap.value.trim()||!bp.value.trim())throw Error('Select distinct devices and enter both interface names.');
  const ends=[a.value+'|'+ap.value.trim().toLowerCase(),b.value+'|'+bp.value.trim().toLowerCase()];
  if(project.links.some((x,j)=>j!==i&&[x.a+'|'+x.ap.toLowerCase(),x.b+'|'+x.bp.toLowerCase()].some(k=>ends.includes(k))))throw Error('This port is already connected. Review or remove the conflicting connection first.');
  const link={...l,a:a.value,ap:ap.value.trim(),b:b.value,bp:bp.value.trim(),media:media.value,speed:speed.value.trim(),status:status.value};
  if(i<0)project.links.push(link);else project.links[i]=link;for(const [id,pn] of [[link.a,link.ap],[link.b,link.bp]]){const d=project.devices.find(x=>x.id===id);if(!d.ports.some(p=>p.name===pn))d.ports.push({name:pn});}
  perform();say('Connection saved.');reviewLinks();
 },'primary');if(i>=0)button(bar,'Remove connection',()=>{project.links.splice(i,1);perform();reviewLinks();});
}
function editAnchors(shape){
 const body=modal(shape.name);
 const port=field(body,'Interface name',''),known=field(body,'Mapped ports','',[['','Select a port'],...Object.keys(shape.anchors).map(k=>[k,k])]);
 const map=el('div','','anchor-map');map.style.maxWidth=shape.width/shape.height<3?'340px':'100%';
 const image=el('img');image.src=shape.dataUrl;image.alt=shape.name;map.append(image);body.append(map);
 const coordinates=el('div','','form-grid');body.append(coordinates);const x=field(coordinates,'Horizontal position (%)',''),y=field(coordinates,'Vertical position (%)','');for(const input of [x,y]){input.type='number';input.min=0;input.max=100;input.step=.01;}
 const count=el('p',Object.keys(shape.anchors).length+' mapped ports','asset-info');body.append(count);
 function markers(){for(const n of map.querySelectorAll('.anchor-dot'))n.remove();for(const [key,[px,py]] of Object.entries(shape.anchors)){const dot=el('button','','anchor-dot');dot.style.left=px*100+'%';dot.style.top=py*100+'%';dot.title=key;dot.setAttribute('aria-label','Mapped port '+key);dot.onclick=()=>{port.value=key;known.value=key;x.value=(px*100).toFixed(2);y.value=(py*100).toFixed(2);};map.append(dot);}}
 function savePoint(){const k=port.value.trim(),px=Number(x.value)/100,py=Number(y.value)/100;if(!safeKey(k)||!x.value||!y.value||![px,py].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('Enter a port and positions from 0 to 100 percent.');shape.anchors[k]=[px,py];dirty=true;count.textContent=k+' mapped. '+Object.keys(shape.anchors).length+' port positions.';markers();draw();}
 known.onchange=()=>{const key=known.value;if(!key)return;port.value=key;x.value=(shape.anchors[key][0]*100).toFixed(2);y.value=(shape.anchors[key][1]*100).toFixed(2);};
 image.onclick=e=>{const r=image.getBoundingClientRect();x.value=((e.clientX-r.left)/r.width*100).toFixed(2);y.value=((e.clientY-r.top)/r.height*100).toFixed(2);try{savePoint();}catch(error){count.textContent=error.message;}};
 const controls=actions(body);button(controls,'Save port position',savePoint);button(controls,'Remove port position',()=>{delete shape.anchors[port.value.trim()];markers();dirty=true;draw();});markers();
 const row=actions(body);button(row,'Done',hardware);
}
function assignMatching(shape){
 for(const d of project.devices){if(!d.stencilId&&matchesHardware(shape,d))d.stencilId=shape.id;}
}
function hardware(){
 const body=modal('Hardware library');body.append(el('p','Import local Visio .vssx or .vsdx masters, a PNG or JPEG faceplate, or a saved hardware pack.','hint'));
 const bar=actions(body);button(bar,'Import shapes',()=>$('art-file').click(),'primary');button(bar,'Save hardware pack',()=>download(JSON.stringify({format:'NDS-hardware',schema:1,stencils:Object.values(project.stencils),optics:project.optics}),'NetworkDiagramStudio-hardware.json'));
 if(pages.length)button(bar,'Export Visio stencil',async()=>download(await exportStencil(scoped(),pages),slug(project.name)+'-hardware.vssx'));
 const shapes=Object.values(project.stencils);
 for(const shape of shapes){const info=el('div');info.append(el('strong',shape.name),el('div',shape.view+'  |  '+Object.keys(shape.anchors).length+' mapped ports','asset-info'));const row=line(body,info);button(row,'Map ports',()=>editAnchors(shape));}
 if(shapes.length){body.append(el('h3','Core uplink module shapes'));
  for(const [k,label] of [['sr','Switch SR optic'],['fg_sr','Firewall SR optic'],['lr','LR optic'],['dac','DAC cable end']]){
   const sel=field(body,label,project.optics[k]||'',[['','Schematic module'],...shapes.map(s=>[s.id,s.name])]);sel.onchange=()=>{project.optics[k]=sel.value;perform();};
  }
  body.append(el('p','Assign a front panel in Device details.','hint'));}
}
async function importArt(files){
 for(const f of files){
  if(f.size>160*1024*1024)throw Error('Stencil file exceeds 160 MB.');
  if(/\.vss$/i.test(f.name))throw Error('Save the legacy stencil as .vssx in desktop Visio or run scripts/convert-stencil.ps1 from the source package.');
  if(/\.json$/i.test(f.name)){
   const pack=JSON.parse(await f.text());if(pack.format!=='NDS-hardware'||pack.schema!==1||!Array.isArray(pack.stencils))throw Error('Invalid hardware pack.');
   const shapes=pack.stencils.map(cleanStencil);for(const s of shapes){project.stencils[s.id]=s;assignMatching(s);}for(const [k,id] of Object.entries(pack.optics||{}))if(['sr','fg_sr','lr','dac'].includes(k)&&project.stencils[id])project.optics[k]=id;
  }else if(/\.(vsdx|vssx)$/i.test(f.name)){
   const cat=await openVisioCatalog(f);
   if(!cat.items.length)throw Error('No masters in '+f.name);
   const selection=await new Promise(resolve=>{
    const body=modal('Choose Visio masters');body.append(el('p','Select the device and module views to import.','hint'));
    const sel=el('select');sel.multiple=true;sel.size=Math.min(14,cat.items.length);sel.setAttribute('aria-label','Visio masters');for(const item of cat.items){const op=el('option',item.name);op.value=item.key;sel.append(op);}body.append(sel);
    const a=actions(body),ok=el('button','Import selected','primary');const end=()=>{resolve([]);};$('dialog').addEventListener('close',end,{once:true});ok.onclick=()=>{$('dialog').removeEventListener('close',end);resolve([...sel.selectedOptions].map(x=>x.value));};a.append(ok);
   });
   let failed=[];for(const key of selection){try{const shape=await cat.load(key);project.stencils[shape.id]=shape;assignMatching(shape);}catch(e){failed.push((cat.items.find(i=>i.key===key)?.name||key)+': '+e.message);}}
   if(failed.length)project.warnings.push(...failed);
  }else{const s=await loadImageStencil(f);project.stencils[s.id]=s;assignMatching(s);}
 }
 perform();hardware();say('Hardware library updated.');
}
$('site').oninput=()=>{project.name=$('site').value;perform();};
$('filter').oninput=deviceList;$('close').onclick=close;
$('matches').onclick=()=>{if(!$('filter').value.trim()){say('Enter a device name or model filter first.');return;}for(const d of project.devices){d.scopeOverride=matchName(d);d.hidden=!d.scopeOverride;}perform();};
$('all').onclick=()=>{for(const d of project.devices){d.scopeOverride=true;d.hidden=false;}perform();};
$('new').onclick=newProject;$('auto-scope').onclick=()=>{for(const d of project.devices)delete d.scopeOverride;initialScope();perform();};
$('sample').onclick=sample;$('hardware').onclick=hardware;$('review-links').onclick=reviewLinks;
$('arrange').onclick=arrange;$('evidence').onclick=evidence;
$('add-link').onclick=()=>editLink();$('add-device').onclick=()=>editDevice();
$('warnings').onclick=()=>{const b=modal('Import review');const ul=el('ul');for(const w of project.warnings)ul.append(el('li',warningText(w)));b.append(ul);};
$('open').onclick=()=>$('project-file').click();$('save').onclick=()=>{download(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}),slug(project.name)+'.nds.json');dirty=false;say('Project downloaded.');};
$('import').onclick=()=>$('data-files').click();
$('paste').onclick=()=>{const b=modal('Paste configuration / commands');const n=field(b,'Device name or filename hint','device.cfg');const t=field(b,'Configuration or show-command output','','multiline');button(actions(b),'Import text',()=>ingest([new File([t.value],n.value||'device.cfg',{type:'text/plain'})]),'primary');};
$('data-files').onchange=e=>{const fs=Array.from(e.target.files);e.target.value='';task(()=>ingest(fs));};
$('project-file').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f||!checkDiscard())return;task(async()=>{if(f.size>160*1024*1024)throw Error('Project exceeds 160 MB.');const p=loadProject(JSON.parse(await f.text()));project=p;evidenceSnapshot=project.evidence?snapshot():null;active=0;dirty=false;draw();say('Project opened.');});};
$('art-file').onchange=e=>{const fs=Array.from(e.target.files);e.target.value='';if(fs.length)task(()=>importArt(fs));};
$('svg').onclick=()=>download(pages[active].svg,slug(project.name)+'-'+slug(pages[active].name)+'.svg','image/svg+xml');
$('export').onclick=()=>task(async()=>{download(await exportVisio(scoped(),pages),slug(project.name)+'.vsdx');say('Editable Visio drawing exported.');});
$('print').onclick=()=>{
 const container=$('print-set');container.replaceChildren();
 for(const page of pages){const sheet=el('section');sheet.append(document.importNode(new DOMParser().parseFromString(page.svg,'image/svg+xml').documentElement,true));container.append(sheet);}
 if(window.NDSDesktop)window.NDSDesktop.print();else window.print();
};
window.addEventListener('afterprint',()=>$('print-set').replaceChildren());
for(const ev of ['dragover','drop'])document.addEventListener(ev,e=>{if(![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();$('drop').classList.toggle('dragover',ev==='dragover');if(ev==='drop'){const fs=Array.from(e.dataTransfer.files);if(fs.length)task(()=>ingest(fs));}});
document.addEventListener('dragleave',()=> $('drop').classList.remove('dragover'));
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
draw();window.NDSDesktop?.ready();
