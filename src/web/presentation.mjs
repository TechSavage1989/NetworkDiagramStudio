const safe=k=>typeof k==='string'&&k.length<=300&&!['__proto__','constructor','prototype'].includes(k);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const number=(n,min,max,fallback)=>Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
export const panelFields=[['connections','Connection types'],['modules','Port modules / GBICs'],['vlans','VLANs'],['lags','LAGs / LACP / port groups'],['apPorts','Wireless AP uplinks'],['vsfPorts','VSF / stacking ports'],['uplinks','Uplinks and trunk links'],['optics','Transceivers / optics'],['status','Link status summary'],['addresses','Device addresses (full list)'],['models','Device models'],['routes','Routes'],['ports','Port and VLAN details'],['notes','Custom notes']];
function sectionId(id){return typeof id==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);}
export function cleanPanel(raw={}){
 raw=object(raw);
 const customSections=(Array.isArray(raw.customSections)?raw.customSections:[]).filter(item=>item&&sectionId(item.id)&&item.id.startsWith('custom-')).slice(0,24).map(item=>({id:item.id,title:String(item.title||'Custom section').trim().slice(0,80)}));
 const ids=new Set([...panelFields.map(([id])=>id),...customSections.map(section=>section.id)]),selections=Array.isArray(raw.sections)?raw.sections:['connections','modules'];
 const sections=[...new Set(selections)].filter(id=>ids.has(id));
 const titles=Object.fromEntries(Object.entries(object(raw.sectionTitles)).filter(([id,value])=>ids.has(id)&&typeof value==='string').slice(0,80).map(([id,value])=>[id,value.trim().slice(0,80)]));
 const content=Object.fromEntries(Object.entries(object(raw.sectionContent)).filter(([id,value])=>ids.has(id)&&typeof value==='string').slice(0,80).map(([id,value])=>[id,value.slice(0,16000)]));
 return {visible:raw.visible!==false,position:['left','right','top','free'].includes(raw.position)?raw.position:'left',width:number(raw.width,120,1000,244),scale:number(raw.scale,.1,4,1),textScale:number(raw.textScale,.1,4,1),x:number(raw.x,-1e6,1e6,38),y:number(raw.y,-1e6,1e6,147),sections,notes:String(raw.notes||'').slice(0,10000),customSections,sectionTitles:titles,sectionContent:content,modulesMode:raw.modulesMode==='full'?'full':'summary',vlanMode:raw.vlanMode==='devices'?'devices':'summary',addressMode:['ip','mac'].includes(raw.addressMode)?raw.addressMode:'all',portMode:['vlans','described'].includes(raw.portMode)?raw.portMode:'all',rowLimit:[20,40,80,120].includes(raw.rowLimit)?raw.rowLimit:80,emptySections:raw.emptySections==='hide'?'hide':'explain'};
}
function settings(raw={},defaults=false){raw=object(raw);const out={};for(const k of ['drawingScale','textScale','deviceScale'])if(defaults||Number.isFinite(raw[k]))out[k]=number(raw[k],.1,4,1);if(defaults||raw.panel)out.panel=cleanPanel(raw.panel);if(typeof raw.name==='string')out.name=raw.name.trim().slice(0,80);if(raw.hidden===true)out.hidden=true;return out;}
export function cleanPresentation(raw={}){raw=object(raw);return {defaults:settings(raw.defaults,true),pages:Object.fromEntries(Object.entries(object(raw.pages)).filter(([k])=>safe(k)).slice(0,500).map(([k,v])=>[k,settings(v)]))};}
export function presentation(project,page){const p=cleanPresentation(project?.layout?.presentation),key=page?.name||page;return {...p.defaults,...p.pages[String(key).split('|')[0]],...p.pages[key]};}
export function displayPageName(project,page){return presentation(project,page).name||page.displayName||page.name;}
export function deviceScale(project,device){return cleanPresentation(project?.layout?.presentation).defaults.deviceScale*number(device.scale,.1,4,1);}
export function cleanReportPages(raw,ids=[]){const known=new Set(ids),seen=new Set();return (Array.isArray(raw)?raw:[]).filter(p=>p&&safe(p.id)&&!seen.has(p.id)&&seen.add(p.id)&&['ports','wireless','logical','trunk'].includes(p.family)).slice(0,100).map(p=>({id:p.id,name:String(p.name||'Report').slice(0,80),family:p.family,devices:[...new Set((Array.isArray(p.devices)?p.devices:[]).filter(id=>known.has(id)))]}));}

// Uniform drawing transforms are applied to scene copies, never saved patches.
// Every editable object carries the inverse needed by drag/property tools.
export function unpresentPatch(item,patch){
 const p=item?.presentation;if(!p)return {...patch};const out={...patch},s=item.normalized?1:p.scale;
 for(const k of ['x','y'])if(Number.isFinite(out[k]))out[k]=(out[k]-(item.normalized?0:p[k]||0))/s;
 for(const k of ['w','h','weight'])if(Number.isFinite(out[k]))out[k]/=s;
 if(Number.isFinite(out.size))out.size/=p.fontScale||s;
 if(out.points)out.points=out.points.map(([x,y])=>[(x-(p.x||0))/s,(y-(p.y||0))/s]);
 return out;
}
export function scalePage(page,project){
 const config=presentation(project,page),s=config.drawingScale||1;
 for(const item of page.items){
  const panel=item._panelTransform,spacing=item._textSpacing||1;item.presentation={scale:s*(panel?.scale||spacing),x:s*(panel?.x||0),y:s*(panel?.y||item._textShiftY||0),fontScale:s*(panel?.scale||1)};
  for(const k of ['x','y','w','h','weight','sampleWeight'])if(Number.isFinite(item[k]))item[k]*=s;
  if(item.points)item.points=item.points.map(p=>p.map(v=>v*s));
  if(item.commands)item.commands=item.commands.map(([op,...v])=>[op,...v.map(n=>n*s)]);
  if(item.hops)item.hops=item.hops.map(b=>Object.fromEntries(Object.entries(b).map(([k,v])=>[k,v*s])));
  for(const k of ['from','to'])if(item[k])item[k]={...item[k],x:item[k].x*s,y:item[k].y*s};
  if(item.type==='text')item.size*=s;
  if(item.type==='device'){
   for(const child of item.children){if(child.type==='text')child.size*=s;child.presentation={scale:1,fontScale:s*(panel?.scale||1)};}
   if(s!==1)item.masterKey+=':drawing-scale:'+s;
  }
 }
 for(const k of ['width','height','originX','originY','widthMm','heightMm'])if(Number.isFinite(page[k]))page[k]*=s;
 return page;
}
export function scaleText(page,project){
 const factor=presentation(project,page).textScale||1,edits=project.layout?.drawingEdits||{};
 const change=(item,normalized=false)=>{
  if(item.type!=='text'||item._textFactor!=null)return;
  const f=Number.isFinite(edits[item.editKey]?.size)?1:factor;item._textFactor=f;
  const spacing=(/^(?:VLANs and Routing|Trunk VLANs)$/.test(page.title)||item.tableContent)&&item.y>=138&&!item.pageFrame&&!item.pageTitle&&!item.panelGroup?factor:f;
  if(f===1&&spacing===1)return;item.size*=f;item.w*=spacing;item.h*=spacing;
 };
 for(const item of page.items){change(item);if(item.type==='device'&&!item._textDone){item._textDone=true;
  for(const child of item.children)change(child,true);
  if(item.asset?.native&&factor!==1){item.asset={...item.asset,native:{...item.asset.native,texts:item.asset.native.texts.map((t,i)=>Number.isFinite(edits[item.editKey+'|arttext|'+i]?.size)?{...t}:{...t,size:t.size*factor,w:t.w*factor})}};}
  if(factor!==1)item.masterKey+=':text-scale:'+factor;
 }}
 // Table-only sheets expand their cells and row spacing with the lettering.
 // Hardware pages retain the chosen hardware size and editable positions.
 if(!page._textSpaced&&(/^(?:VLANs and Routing|Trunk VLANs)$/.test(page.title)||page.portMap)){
  page._textSpaced=true;
  for(const item of page.items){if(item.panelGroup||item.pageFrame||item.pageTitle)continue;
   if(item.y<138||page.portMap&&!item.tableContent)continue;item._textSpacing=factor;item._textShiftY=item.tableContent?(page.tableTop||0)*(1-factor):0;item.x*=factor;item.y=item.y*factor+item._textShiftY;
   if(item.type!=='text'){item.w*=factor;item.h*=factor;}
  }
 }
 return page;
}
