import {svgPage} from './diagram/scene.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Deliberately accept drawing pages, never the project or its retained evidence.
// Each page contributes its display name, its stable name (for off-page
// references) and its accepted SVG; everything the viewer shows comes from
// that SVG (device and cable endpoints, captions, link types and speeds).
export function exportInteractiveHtml(pages,{title='Network diagram'}={}){
 if(!pages?.length)throw Error('Choose at least one drawing page to export.');
 const data=JSON.stringify(pages.map(p=>({name:String(p.displayName||p.name||'Drawing'),key:String(p.name||p.displayName||'Drawing'),svg:p.svg||svgPage(p)}))).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(title)} · Diagram viewer</title><style>${viewerStyle}</style></head><body>
<header><div><h1>${escape(title)}</h1><p>NetworkDiagramStudio · Offline, read-only drawing</p></div><div class="tools" aria-label="View controls"><button id="back" disabled aria-label="Back to the previous selection" title="Back (Alt+Left)">← Back</button><button id="out" aria-label="Zoom out">−</button><output id="zoom" aria-live="polite"></output><button id="in" aria-label="Zoom in">+</button><button id="fit">Fit page</button></div></header>
<div class="workspace"><aside aria-label="Drawing pages"><label for="search">Find in drawing set</label><input id="search" type="search" placeholder="Device, port or label…" autocomplete="off"><p id="matches" role="status"></p><nav id="pages" aria-label="Pages"></nav><div id="results" aria-label="Search results"></div></aside><main><div id="stage" tabindex="0" role="region" aria-label="Diagram. Drag to pan, scroll to zoom. Plus and minus zoom, arrow keys pan, zero fits page."><div id="drawing"></div></div><footer><strong id="page-name"></strong><span id="inspection" role="status">Hover or focus for details · Click or Enter to pin · Escape to clear.</span><span>Drag to pan · Scroll to zoom · 0 fits · [ ] pages · / search · Alt+← back</span></footer></main><section id="details" aria-label="Details" aria-live="polite"></section></div>
<noscript>This offline viewer needs JavaScript enabled to display the drawings.</noscript><script id="drawing-data" type="application/json">${data}</script><script>(${viewer.toString()})();</script></body></html>`;
}
const viewerStyle=`*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#172b42;font:14px system-ui,-apple-system,Segoe UI,sans-serif;height:100dvh;display:flex;flex-direction:column}header{padding:16px 22px;background:#fff;border-bottom:1px solid #d7e0eb;display:flex;gap:16px;justify-content:space-between;align-items:center}h1{font-size:19px;margin:0;overflow-wrap:anywhere}p{margin:5px 0;color:#52647b}button,input{font:inherit;border:1px solid #b8c8da;border-radius:7px;background:#fff;color:inherit;padding:9px 12px}button{cursor:pointer}button:hover{background:#edf5ff}button:disabled{opacity:.45;cursor:default;background:#fff}button:focus-visible,input:focus-visible,#stage:focus-visible{outline:3px solid #3679ce;outline-offset:-3px}.tools{display:flex;gap:7px;align-items:center;flex-shrink:0}output{min-width:50px;text-align:center;font-variant-numeric:tabular-nums}.workspace{display:flex;flex:1;min-height:0}aside{width:260px;flex-shrink:0;background:#fff;border-right:1px solid #d7e0eb;padding:16px;overflow:auto}label{font-weight:600;display:block;margin-bottom:8px}input{width:100%}nav,#results{display:grid;gap:7px;margin-top:16px}nav button,#results button{text-align:left;overflow-wrap:anywhere}button[aria-current=page]{background:#e3effe;border-color:#2563aa;color:#164e91;font-weight:600}#results button{font-size:12px}#results .result-device{border-left:4px solid #2563aa}#matches{font-size:12px}main{flex:1;min-width:0;display:flex;flex-direction:column}#stage{flex:1;min-height:120px;overflow:hidden;position:relative;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}#stage:active{cursor:grabbing}#drawing{position:absolute;transform-origin:0 0;background:white;box-shadow:0 3px 18px #172b4224}#drawing.moving{will-change:transform}#drawing [data-inspect]{cursor:pointer}#drawing .viewer-related{outline:2px solid #0879c9;outline-offset:2px}#drawing .viewer-active{outline:3px solid #d16c00;outline-offset:3px}#drawing .diagram-cable.viewer-related,#drawing .diagram-cable.viewer-active{stroke:#0879c9;stroke-width:7}#drawing .diagram-cable.viewer-path{stroke:#d16c00;stroke-width:8}#drawing .viewer-path:not(.diagram-cable){outline:3px dashed #d16c00;outline-offset:3px}#drawing svg.viewer-dim .diagram-cable:not(.viewer-active):not(.viewer-related):not(.viewer-path),#drawing svg.viewer-dim [data-device-id]:not(.viewer-active):not(.viewer-related):not(.viewer-path),#drawing svg.viewer-dim [data-device-members]:not(.viewer-active):not(.viewer-related):not(.viewer-path){opacity:.22}#drawing svg{display:block;max-width:none;font-family:Calibri,Carlito,Arial,sans-serif}footer{height:88px;flex-shrink:0;overflow:auto;padding:10px 16px;background:#fff;border-top:1px solid #d7e0eb;display:flex;flex-wrap:wrap;gap:8px 20px;font-size:12px}#inspection{flex:1;min-width:150px;overflow-wrap:anywhere}footer>span:last-child{color:#52647b}#details{width:320px;flex-shrink:0;background:#fff;border-left:1px solid #d7e0eb;padding:16px;overflow:auto;overflow-wrap:anywhere;font-size:13px}#details h2{font-size:16px;margin:0 0 4px}#details h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#52647b;margin:16px 0 6px}#details ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}#details li{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;padding:6px 8px;border:1px solid #e1e8f0;border-radius:8px}#details li span{color:#52647b}#details li strong{font-weight:600}#details button{padding:4px 9px;font-size:12px}#details .link{border:0;background:none;padding:0;color:#1d5fa8;text-decoration:underline;font-size:13px}#details .kind{display:inline-block;background:#e9f0f7;border-radius:20px;padding:2px 9px;font-size:12px;color:#33506f}#details .actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}#details .check{display:flex;gap:6px;align-items:center;font-weight:400;margin:10px 0 0}#details .check input{width:auto}#details .muted{color:#52647b}#details .swatch{display:inline-block;width:22px;height:5px;border-radius:3px;margin-right:4px;vertical-align:middle}@media(max-width:1100px){#details{width:270px}}@media(max-width:700px){header{padding:10px;flex-wrap:wrap}h1{font-size:16px}.workspace{flex-direction:column}aside{width:100%;max-height:24vh;border-right:0;border-bottom:1px solid #d7e0eb;padding:10px}nav{display:flex;flex-wrap:wrap;margin-top:8px}nav button{padding:6px 9px}#results{margin-top:8px}footer>span:last-child{display:none}#details{width:100%;height:26vh;border-left:0;border-top:1px solid #d7e0eb}}`;

function viewer(){
 const $=id=>document.getElementById(id),data=JSON.parse($('drawing-data').textContent),stage=$('stage'),drawing=$('drawing'),details=$('details');
 // Parse only passive SVG. Do not trust imported markup, URL-bearing paint or event attributes.
 const tags=new Set('svg g defs clipPath mask path rect circle ellipse line polyline polygon text tspan title desc image linearGradient radialGradient stop'.split(' '));
 function clean(source){
  const root=new DOMParser().parseFromString(source,'image/svg+xml').documentElement;
  if(root.localName!=='svg')throw Error('Invalid drawing SVG');
  for(const node of [root,...root.querySelectorAll('*')]){
   if(!tags.has(node.localName)){node.remove();continue;}
   for(const attr of [...node.attributes]){
    const key=attr.localName,value=attr.value;
    if(/^on/i.test(key)||['style','tabindex','role','aria-label'].includes(key)||(/href$/i.test(key)&&!(node.localName==='image'&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(value)))||(/url\s*\(/i.test(value)&&!/^url\(#[a-z0-9_-]+\)$/i.test(value)))node.removeAttributeNode(attr);
   }
  }
  return root;
 }
 const hint='Hover or focus for details · Click or Enter to pin · Escape to clear.';
 const sheets=data.map(p=>({...p,node:null}));let active=0,scale=1,x=0,y=0,drag=null,frame=0,pinned=null,highlighted=[],current=null,dim=true,catalog=null;const trail=[];
 // Scene text includes a full-value title and painted tspans; never concatenate both.
 const label=node=>([...node.children].find(child=>child.localName==='title')?.textContent||node.textContent).trim();
 const titleOf=node=>([...node.children].find(c=>c.localName==='title')?.textContent||'').replace(/ \(schematic\)$/,'').trim();
 const owners=node=>node?.hasAttribute('data-device-id')?[node.getAttribute('data-device-id')]:(node?.getAttribute('data-device-members')||'').split(' ').filter(Boolean);
 const deviceNode=node=>node?.closest?.('[data-device-id],[data-device-members]')||null;
 function sheet(n){if(!sheets[n].node){sheets[n].node=clean(sheets[n].svg);prepare(sheets[n].node);}return sheets[n].node;}
 function prepare(svg){
  svg.devices=new Map();svg.memberCards=new Map();
  for(const node of svg.querySelectorAll('[data-device-id],[data-device-members]'))for(const id of owners(node)){if(node.hasAttribute('data-device-id'))svg.devices.set(id,node);else svg.memberCards.set(id,node);}
  svg.linksByDevice=new Map();svg.linksByPort=new Map();svg.labelsByLink=new Map();svg.links=[...svg.querySelectorAll('.diagram-cable')];svg.legend=new Map();
  for(const link of svg.links)for(const side of ['from','to']){const id=link.getAttribute('data-'+side+'-device');if(!id)continue;if(!svg.linksByDevice.has(id))svg.linksByDevice.set(id,[]);svg.linksByDevice.get(id).push(link);const key=id+'/'+link.getAttribute('data-'+side+'-port');if(!svg.linksByPort.has(key))svg.linksByPort.set(key,[]);svg.linksByPort.get(key).push(link);}
  for(const node of svg.querySelectorAll('[data-drawing-key]')){const parts=node.getAttribute('data-drawing-key').split('|'),i=parts.indexOf('port');if(i<0)continue;node.relatedLinks=(svg.linksByPort.get(parts[i+1])||[]).filter(link=>(svg.linksByPort.get(parts[i+2])||[]).includes(link));for(const link of node.relatedLinks){if(!svg.labelsByLink.has(link))svg.labelsByLink.set(link,[]);svg.labelsByLink.get(link).push(node);}}
  for(const node of svg.querySelectorAll('[data-device-id],[data-device-members],.diagram-cable,[data-port-name],text')){
   const title=[...node.children].find(c=>c.localName==='title')?.textContent||node.getAttribute('data-port-name')||node.textContent;
   if(!title?.trim())continue;node.dataset.inspect=title.trim();node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label',title.trim());
  }
  // Connection key entries highlight every cable of their type.
  for(const node of svg.querySelectorAll('.diagram-legend-line,.connection-legend-text')){const type=node.getAttribute('data-link-type');if(!type)continue;node.dataset.legend=type;if(!svg.legend.has(type))svg.legend.set(type,[]);svg.legend.get(type).push(node);if(!node.dataset.inspect){node.dataset.inspect='Connection type · '+type;node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label','Connection type '+type);}}
 }
 // Devices and cables across every page, built when first needed.
 function index(){
  if(catalog)return catalog;catalog={devices:new Map(),links:[]};
  sheets.forEach((p,n)=>{const svg=sheet(n);
   for(const node of svg.querySelectorAll('[data-device-id],[data-device-members]'))for(const id of owners(node)){
    if(/^(?:continuation|reference|module-legend)-/.test(id))continue;
    const entry=catalog.devices.get(id)||{id,name:'',kind:'',pages:new Set(),captions:new Set()};entry.pages.add(n);
    if(node.hasAttribute('data-device-id')){entry.name||=titleOf(node);entry.kind||=node.getAttribute('data-device-kind')||'';}
    catalog.devices.set(id,entry);
   }
   for(const text of svg.querySelectorAll('text[data-owner]')){const entry=catalog.devices.get(text.getAttribute('data-owner'));if(entry)entry.captions.add(label(text));}
   for(const node of svg.links)catalog.links.push({page:n,node,a:node.getAttribute('data-from-device')||'',ap:node.getAttribute('data-from-port')||'',b:node.getAttribute('data-to-device')||'',bp:node.getAttribute('data-to-port')||'',type:node.getAttribute('data-link-type')||'',speed:node.getAttribute('data-speed')||'',count:+node.getAttribute('data-link-count')||1});
  });
  for(const entry of catalog.devices.values()){entry.name||=entry.id;entry.captions.delete(entry.name);}
  return catalog;
 }
 const nameOf=id=>index().devices.get(id)?.name||id;
 const linkKey=l=>[l.a+'/'+l.ap,l.b+'/'+l.bp].sort().join('~');
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,action,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=action;return b;};

 function inspect(node,pin=false){
  if(pin)pinned=node;if(node===current&&!pin)return;current=node;
  for(const n of highlighted)n.classList.remove('viewer-active','viewer-related','viewer-path');highlighted=[];
  const svg=sheet(active);svg.classList.toggle('viewer-dim',!!(pinned&&dim&&node));
  if(!node){$('inspection').textContent=hint;if(pin||!pinned)overview();return;}
  if(node.dataset.legend){
   const links=svg.links.filter(l=>l.getAttribute('data-link-type')===node.dataset.legend);
   highlighted=[node,...(svg.legend.get(node.dataset.legend)||[]),...links];for(const n of highlighted)n.classList.add(n===node?'viewer-active':'viewer-related');
   $('inspection').textContent=node.dataset.inspect+' · '+links.length+' on this page';if(pin)typeDetails(node.dataset.legend,links);return;
  }
  const device=deviceNode(node),ids=owners(device),from=node.getAttribute('data-from-device'),to=node.getAttribute('data-to-device');
  const owner=node.getAttribute('data-owner'),cable=node.classList.contains('diagram-cable');
  const links=cable?[node]:(node.relatedLinks||(node.hasAttribute('data-port-name')?svg.linksByPort.get(ids[0]+'/'+node.getAttribute('data-port-name')):ids.length?ids.flatMap(id=>svg.linksByDevice.get(id)||[]):owner?svg.linksByDevice.get(owner):null)||[]);
  const related=new Set([...ids,from,to,owner].filter(Boolean));for(const link of links){related.add(link.getAttribute('data-from-device'));related.add(link.getAttribute('data-to-device'));}
  highlighted=[node,...links,...links.flatMap(link=>svg.labelsByLink.get(link)||[]),...[...related].map(id=>svg.devices.get(id)||svg.memberCards.get(id)).filter(Boolean)];
  for(const n of new Set(highlighted))n.classList.add(n===node?'viewer-active':'viewer-related');
  const port=node.getAttribute('data-port-name'),type=node.getAttribute('data-link-type');
  $('inspection').textContent=node.dataset.inspect+(port?' · Port '+port:'')+(type?' · '+type:'')+(links.length&&!cable?' · '+links.length+' connected link(s): '+links.slice(0,12).map(n=>n.dataset.inspect).join('; ')+(links.length>12?' · More links highlighted in drawing':''):'');
  if(!pin)return;
  const offPage=device?.getAttribute('data-offpage-device');
  if(offPage)return referenceDetails(device,offPage);
  if(cable)return linkDetails(node);
  if(ids.length)return deviceDetails(ids,device);
  if(owner)return deviceDetails([owner],svg.devices.get(owner)||null);
  details.replaceChildren(el('h2',node.dataset.inspect),el('p','Text on '+sheets[active].name+'.','muted'));
 }
 // The panel without a selection: what this page holds.
 function overview(){
  const svg=sheet(active),types=new Map();for(const l of svg.links){const t=l.getAttribute('data-link-type')||'Link';types.set(t,(types.get(t)||0)+1);}
  const devices=new Set([...svg.devices.keys()].filter(id=>!/^(?:continuation|reference|module-legend)-/.test(id)));
  details.replaceChildren(el('h2',sheets[active].name),el('p',devices.size+' devices · '+svg.links.length+' connections on this page','muted'));
  if(types.size){details.append(el('h3','Connection types'));const list=el('ul');for(const [type,count] of [...types].sort((a,b)=>b[1]-a[1])){const item=el('li');item.append(button(type,()=>{const key=(svg.legend.get(type)||[])[0];if(key)inspect(key,true);else typeDetails(type,svg.links.filter(l=>l.getAttribute('data-link-type')===type));},'link'),el('span',count+' on this page'));list.append(item);}details.append(list);}
  details.append(el('h3','How to use'),el('p','Click a device or cable to see its connections, jump to the device at the other end or to other pages that show it, and trace its path to the network edge. Click a connection type to highlight every cable of that type.','muted'));
 }
 function connectionsOf(ids){
  const set=new Set(ids),seen=new Map();
  for(const l of index().links){if(!set.has(l.a)&&!set.has(l.b))continue;const key=linkKey(l),prior=seen.get(key);if(!prior||prior.page!==active&&l.page===active)seen.set(key,l);}
  return [...seen.values()].map(l=>{const local=set.has(l.a)?'a':'b';return {...l,localPort:local==='a'?l.ap:l.bp,remote:local==='a'?l.b:l.a,remotePort:local==='a'?l.bp:l.ap};}).sort((p,q)=>String(p.localPort).localeCompare(String(q.localPort),undefined,{numeric:true})||nameOf(p.remote).localeCompare(nameOf(q.remote)));
 }
 function pagesList(pages,go){const list=el('ul');for(const n of [...pages].sort((a,b)=>a-b)){const item=el('li');item.append(button((n+1)+'. '+sheets[n].name,()=>go(n),n===active?'':'link'));if(n===active)item.append(el('span','this page'));list.append(item);}return list;}
 function deviceDetails(ids,node){
  const cat=index(),entries=ids.map(id=>cat.devices.get(id)).filter(Boolean),name=node?titleOf(node)||entries[0]?.name:entries[0]?.name||ids[0];
  details.replaceChildren(el('h2',name));
  const kind=node?.getAttribute('data-device-kind')||entries[0]?.kind;if(kind)details.append(el('span',kind.replace(/-/g,' '),'kind'));
  const all=[...new Set(entries.flatMap(e=>[...e.captions]))].filter(c=>c!==name),captions=all.filter(c=>!all.some(o=>o!==c&&o.includes(c)));for(const caption of captions.slice(0,8))details.append(el('p',caption,'muted'));
  if(ids.length>1){details.append(el('h3',ids.length+' devices'));const list=el('ul');for(const id of ids){const item=el('li');item.append(button(nameOf(id),()=>go(id),'link'));list.append(item);}details.append(list);}
  const links=connectionsOf(ids);
  details.append(el('h3',links.length?'Connections ('+links.length+')':'No recorded connections'));
  if(links.length){const list=el('ul');for(const l of links.slice(0,200)){const item=el('li');
   if(l.localPort)item.append(el('strong',l.localPort));item.append(el('span','→'),button(nameOf(l.remote),()=>go(l.remote),'link'));if(l.remotePort)item.append(el('strong',l.remotePort));
   const facts=[l.count>1?l.count+' links':'',l.type,l.speed].filter(Boolean).join(' · ');if(facts)item.append(el('span',facts));
   item.append(button(l.page===active?'Show':'Page '+(l.page+1),()=>showLink(l)));list.append(item);}details.append(list);if(links.length>200)details.append(el('p','First 200 connections listed.','muted'));}
  const pages=new Set(entries.flatMap(e=>[...e.pages]));if(pages.size){details.append(el('h3','Shown on'));details.append(pagesList(pages,n=>go(ids[0],n)));}
  const actions=el('div',null,'actions');actions.append(button('Path to the network edge',()=>trace(ids)));details.append(actions);dimToggle();
  remember(ids[0]);
 }
 function linkDetails(node){
  const l={a:node.getAttribute('data-from-device')||'',ap:node.getAttribute('data-from-port')||'',b:node.getAttribute('data-to-device')||'',bp:node.getAttribute('data-to-port')||''},type=node.getAttribute('data-link-type'),speed=node.getAttribute('data-speed'),count=+node.getAttribute('data-link-count')||1;
  details.replaceChildren(el('h2',node.dataset.inspect));
  const facts=[count>1?count+' links':'',type,speed].filter(Boolean).join(' · ');if(facts)details.append(el('p',facts,'muted'));
  details.append(el('h3','Ends'));const list=el('ul');for(const [id,port] of [[l.a,l.ap],[l.b,l.bp]]){if(!id)continue;const item=el('li');item.append(button(nameOf(id),()=>go(id),'link'));if(port)item.append(el('strong',port));list.append(item);}details.append(list);
  const key=linkKey(l),pages=new Set(index().links.filter(x=>linkKey(x)===key).map(x=>x.page));
  if(pages.size){details.append(el('h3','Shown on'));details.append(pagesList(pages,n=>{const match=index().links.find(x=>x.page===n&&linkKey(x)===key);if(match)showLink(match);}));}
  dimToggle();
 }
 function typeDetails(type,links){
  details.replaceChildren(el('h2',type),el('p',links.length+' connection'+(links.length===1?'':'s')+' on this page','muted'));
  const list=el('ul');for(const node of links.slice(0,200)){const item=el('li');item.append(button(node.dataset.inspect||'Connection',()=>{inspect(node,true);center(node);},'link'));const speed=node.getAttribute('data-speed');if(speed)item.append(el('span',speed));list.append(item);}details.append(list);dimToggle();
 }
 function referenceDetails(node,remote){
  const target=node.getAttribute('data-offpage-page'),n=sheets.findIndex(p=>p.key===target||p.name===target);
  details.replaceChildren(el('h2',node.dataset.inspect),el('p','This cable continues on '+(n>=0?sheets[n].name:target||'another page')+'.','muted'));
  const actions=el('div',null,'actions');actions.append(button('Go to '+nameOf(remote),()=>go(remote,n>=0?n:undefined)));details.append(actions);
 }
 function dimToggle(){const row=el('label',null,'check'),box=el('input');box.type='checkbox';box.checked=dim;box.id='dim';box.onchange=()=>{dim=box.checked;sheet(active).classList.toggle('viewer-dim',!!(pinned&&dim));};row.append(box,document.createTextNode('Dim everything else'));details.append(row);}
 // Shortest path over this page's cables to a firewall, router, WAN handoff or cloud service.
 function trace(ids){
  const svg=sheet(active),edge=id=>{const node=svg.devices.get(id)||svg.memberCards.get(id),kind=node?.getAttribute('data-device-kind')||'';return /^(?:firewall|router|handoff|cloud)$/.test(kind)||/^handoff:/.test(id);};
  const start=new Set(ids),prev=new Map(ids.map(id=>[id,null])),queue=[...ids];let found=null;
  while(queue.length&&!found){const id=queue.shift();if(!start.has(id)&&edge(id)){found=id;break;}for(const link of svg.linksByDevice.get(id)||[]){const other=link.getAttribute('data-from-device')===id?link.getAttribute('data-to-device'):link.getAttribute('data-from-device');if(other&&!prev.has(other)){prev.set(other,{id,link});queue.push(other);}}}
  for(const n of highlighted)n.classList.remove('viewer-path');
  const note=el('p',null,'muted');
  if(!found){note.textContent=ids.some(edge)?'This device is at the network edge.':'No path to a firewall, router or WAN handoff on this page.';details.querySelector('.actions')?.after(note);return;}
  const steps=[];for(let at=found;prev.get(at);at=prev.get(at).id){const step=prev.get(at);steps.unshift(step);}
  const nodes=[...steps.map(s=>s.link),...[found,...steps.map(s=>s.id)].map(id=>svg.devices.get(id)||svg.memberCards.get(id)).filter(Boolean)];
  for(const n of nodes){n.classList.add('viewer-path');highlighted.push(n);}
  note.textContent='Path to the edge: '+[steps[0].id,...steps.slice(1).map(s=>s.id),found].map(nameOf).join(' → ')+' ('+steps.length+' hop'+(steps.length===1?'':'s')+')';
  details.querySelector('.actions')?.after(note);
 }
 function center(node){try{const b=node.getBBox(),m=node.getCTM(),point=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);scale=Math.min(4,Math.max(scale,1));x=stage.clientWidth/2-point.x*scale;y=stage.clientHeight/2-point.y*scale;paint();}catch{/* No geometry to center on. */}}
 // Navigation keeps a trail for Back and a link in the address (#page=…&device=…).
 function snapshot(){return {page:active,pinned:pinned?(pinned.classList.contains('diagram-cable')?{link:[pinned.getAttribute('data-from-device'),pinned.getAttribute('data-from-port'),pinned.getAttribute('data-to-device'),pinned.getAttribute('data-to-port')]}:{device:owners(deviceNode(pinned))[0]||pinned.getAttribute('data-owner')}):null,scale,x,y};}
 function record(){trail.push(snapshot());if(trail.length>50)trail.shift();$('back').disabled=false;}
 function go(id,page,{track=true}={}){
  const cat=index(),entry=cat.devices.get(id),pages=entry?[...entry.pages]:[];const n=page!=null&&pages.includes(page)?page:pages.includes(active)?active:pages[0];if(n==null)return;
  if(track)record();if(n!==active)show(n);const svg=sheet(n),node=svg.devices.get(id)||svg.memberCards.get(id);if(node){inspect(node,true);center(node);}
 }
 function showLink(l,{track=true}={}){if(track)record();if(l.page!==active)show(l.page);inspect(l.node,true);center(l.node);}
 function back(){const s=trail.pop();$('back').disabled=!trail.length;if(!s)return;if(s.page!==active)show(s.page);if(s.pinned?.device)go(s.pinned.device,s.page,{track:false});else if(s.pinned?.link){const [a,ap,b,bp]=s.pinned.link,match=index().links.find(l=>l.page===s.page&&l.a===a&&l.ap===ap&&l.b===b&&l.bp===bp);if(match)showLink(match,{track:false});}else{pinned=null;inspect(null);}scale=s.scale;x=s.x;y=s.y;paint();}
 function remember(id){try{history.replaceState(null,'','#page='+(active+1)+(id?'&device='+encodeURIComponent(id):''));}catch{/* Some viewers forbid address changes. */}}
 function target(n){return n?.closest?.('[data-inspect]')||null;}
 const entries=sheets.map((p,n)=>{const b=button((n+1)+'. '+p.name,()=>{record();show(n);});$('pages').append(b);return b;});
 // While the view pans (drag or arrow keys), the drawing is its own compositor
 // layer, so the browser moves one finished picture instead of repainting every
 // shape each frame. Shortly after it stops, the layer is dropped and the drawing
 // repaints once, which keeps hover highlights cheap. Zooming does not use the
 // layer: a scale change repaints the drawing anyway (SVG text is laid out at
 // the screen scale), and the layer would only raster more of it.
 let still=0,shown='';
 function moving(){drawing.classList.add('moving');clearTimeout(still);still=setTimeout(()=>{if(drag?.moved)return moving();drawing.classList.remove('moving');},200);}
 function paint(motion=false){if(motion)moving();if(frame)return;frame=requestAnimationFrame(()=>{frame=0;drawing.style.transform=`translate(${x}px,${y}px) scale(${scale})`;const text=Math.round(scale*100)+'%';if(text!==shown)$('zoom').textContent=shown=text;});}
 function fit(){const b=sheet(active).viewBox.baseVal;scale=Math.max(.005,Math.min(8,(stage.clientWidth-32)/b.width,(stage.clientHeight-32)/b.height));x=(stage.clientWidth-b.width*scale)/2;y=(stage.clientHeight-b.height*scale)/2;paint();}
 function show(n){pinned=null;inspect(null);active=n;const svg=sheet(n),b=svg.viewBox.baseVal;svg.setAttribute('role','group');svg.setAttribute('aria-label',sheets[n].name);svg.setAttribute('width',b.width);svg.setAttribute('height',b.height);drawing.replaceChildren(svg);entries.forEach((entry,i)=>i===n?entry.setAttribute('aria-current','page'):entry.removeAttribute('aria-current'));$('page-name').textContent=(n+1)+' / '+sheets.length+' · '+sheets[n].name;$('inspection').textContent=hint;overview();remember();fit();}
 function zoom(factor,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const next=Math.max(.005,Math.min(16,scale*factor));x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;scale=next;paint();}
 $('in').onclick=()=>zoom(1.25);$('out').onclick=()=>zoom(.8);$('fit').onclick=fit;$('back').onclick=back;
 // Zoom by how far the wheel or touchpad moved: a mouse notch is about 15%, a
 // touchpad's many small events zoom smoothly instead of 12% each, and a
 // touchpad pinch (reported with Ctrl) is more sensitive. At most 2x per event.
 const wheelZoom=e=>2**Math.max(-1,Math.min(1,-e.deltaY*(e.deltaMode===1?.05:e.deltaMode?1:.002)*(e.ctrlKey?10:1)));
 stage.addEventListener('wheel',e=>{e.preventDefault();const b=stage.getBoundingClientRect();zoom(wheelZoom(e),e.clientX-b.left,e.clientY-b.top);},{passive:false});
 stage.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();stage.focus({preventScroll:true});drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,x,y,target:e.target};stage.setPointerCapture(e.pointerId);};
 stage.onpointermove=e=>{if(!drag&&!pinned)inspect(target(e.target));if(drag?.id===e.pointerId){drag.moved=true;x=drag.x+e.clientX-drag.sx;y=drag.y+e.clientY-drag.sy;paint(true);}};
 stage.onpointerup=e=>{if(drag?.id!==e.pointerId)return;const d=drag;drag=null;if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<5){const node=target(d.target);if(node&&node!==pinned)record();inspect(node,true);}};
 stage.onpointerleave=()=>{if(!pinned)inspect(null);};
 stage.addEventListener('focusin',e=>{const node=target(e.target);if(node&&!pinned)inspect(node);});
 stage.onpointercancel=()=>{drag=null;};stage.onlostpointercapture=()=>{drag=null;};
 stage.onkeydown=e=>{if(e.key==='Escape'){pinned=null;inspect(null,true);}else if(e.key==='Enter'||e.key===' '){const node=target(e.target);if(node&&node!==pinned)record();inspect(node,true);}else if(e.key==='+'||e.key==='=')zoom(1.25);else if(e.key==='-')zoom(.8);else if(e.key==='0')fit();else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&!e.altKey){x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;paint(true);}else return;e.preventDefault();};
 // Page and history shortcuts work anywhere outside the search box.
 document.addEventListener('keydown',e=>{if(e.target===$('search'))return;if(e.altKey&&e.key==='ArrowLeft'){back();e.preventDefault();}else if(e.key==='['&&active>0){record();show(active-1);}else if(e.key===']'&&active<sheets.length-1){record();show(active+1);}else if(e.key==='/'){$('search').focus();e.preventDefault();}});
 let textIndex;const searchIndex=()=>textIndex??=sheets.flatMap((p,page)=>[...sheet(page).querySelectorAll('text,title')].filter(n=>label(n)).map(node=>({page,node,text:label(node)})));
 $('search').oninput=()=>{
  const query=$('search').value.trim().toLocaleLowerCase();$('results').replaceChildren();if(!query){$('matches').textContent='';return;}
  // Devices first (they open their details), then any text in the drawings.
  const devices=[...index().devices.values()].filter(d=>d.name.toLocaleLowerCase().includes(query)&&d.name.toLocaleLowerCase()!==query||d.name.toLocaleLowerCase()===query).slice(0,20);
  for(const d of devices){const b=button('Device · '+d.name+' · '+[...d.pages].map(n=>n+1).join(', '),()=>{go(d.id);stage.focus({preventScroll:true});},'result-device');b.title='Open '+d.name;$('results').append(b);}
  const seen=new Set(),found=searchIndex().filter(i=>{const key=i.page+'|'+i.text;if(seen.has(key)||!i.text.toLocaleLowerCase().includes(query))return false;seen.add(key);return true;});
  $('matches').textContent=found.length+' matches'+(found.length>100?' · first 100 shown':'')+(devices.length?' · '+devices.length+' device'+(devices.length===1?'':'s'):'');
  for(const hit of found.slice(0,100))$('results').append(button(sheets[hit.page].name+' · '+hit.text,()=>{record();show(hit.page);$('inspection').textContent=hit.text;const node=hit.node.localName==='title'?hit.node.parentElement:hit.node;try{const b=node.getBBox(),m=node.getCTM(),point=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);scale=Math.min(4,Math.max(scale,1.5));x=stage.clientWidth/2-point.x*scale;y=stage.clientHeight/2-point.y*scale;paint();}catch{/* A page title has no geometric target. */}stage.focus({preventScroll:true});}));
 };
 new ResizeObserver(()=>fit()).observe(stage);
 // A link such as #page=3&device=sw-1 opens that page and device.
 function open(first){const link=new URLSearchParams(location.hash.slice(1)),page=Math.min(sheets.length,Math.max(1,parseInt(link.get('page'),10)||1))-1;if(first||page!==active)show(page);if(link.get('device'))go(link.get('device'),page,{track:!first});}
 open(true);addEventListener('hashchange',()=>open(false));
}
