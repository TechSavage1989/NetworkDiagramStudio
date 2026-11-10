import {svgPage} from './diagram/scene.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Deliberately accept drawing pages, never the project or its retained evidence.
export function exportInteractiveHtml(pages,{title='Network diagram'}={}){
 if(!pages?.length)throw Error('Choose at least one drawing page to export.');
 const data=JSON.stringify(pages.map(p=>({name:String(p.displayName||p.name||'Drawing'),svg:p.svg||svgPage(p)}))).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(title)} · Diagram viewer</title><style>${viewerStyle}</style></head><body>
<header><div><h1>${escape(title)}</h1><p>NetworkDiagramStudio · Offline, read-only drawing</p></div><div class="tools" aria-label="View controls"><button id="out" aria-label="Zoom out">−</button><output id="zoom" aria-live="polite"></output><button id="in" aria-label="Zoom in">+</button><button id="fit">Fit page</button></div></header>
<div class="workspace"><aside aria-label="Drawing pages"><label for="search">Find in drawing set</label><input id="search" type="search" placeholder="Device, port or label…" autocomplete="off"><p id="matches" role="status"></p><nav id="pages" aria-label="Pages"></nav><div id="results" aria-label="Search results"></div></aside><main><div id="stage" tabindex="0" role="region" aria-label="Diagram. Drag to pan, scroll to zoom. Plus and minus zoom, arrow keys pan, zero fits page."><div id="drawing"></div></div><footer><strong id="page-name"></strong><span id="inspection" role="status">Hover or focus for details · Click or Enter to pin · Escape to clear.</span><span>Drag to pan · Scroll to zoom · 0 to fit</span></footer></main></div>
<noscript>This offline viewer needs JavaScript enabled to display the drawings.</noscript><script id="drawing-data" type="application/json">${data}</script><script>(${viewer.toString()})();</script></body></html>`;
}
const viewerStyle=`*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#172b42;font:14px system-ui,-apple-system,Segoe UI,sans-serif;height:100dvh;display:flex;flex-direction:column}header{padding:16px 22px;background:#fff;border-bottom:1px solid #d7e0eb;display:flex;gap:16px;justify-content:space-between;align-items:center}h1{font-size:19px;margin:0;overflow-wrap:anywhere}p{margin:5px 0;color:#52647b}button,input{font:inherit;border:1px solid #b8c8da;border-radius:7px;background:#fff;color:inherit;padding:9px 12px}button{cursor:pointer}button:hover{background:#edf5ff}button:focus-visible,input:focus-visible,#stage:focus-visible{outline:3px solid #3679ce;outline-offset:-3px}.tools{display:flex;gap:7px;align-items:center;flex-shrink:0}output{min-width:50px;text-align:center;font-variant-numeric:tabular-nums}.workspace{display:flex;flex:1;min-height:0}aside{width:260px;flex-shrink:0;background:#fff;border-right:1px solid #d7e0eb;padding:16px;overflow:auto}label{font-weight:600;display:block;margin-bottom:8px}input{width:100%}nav,#results{display:grid;gap:7px;margin-top:16px}nav button,#results button{text-align:left;overflow-wrap:anywhere}button[aria-current=page]{background:#e3effe;border-color:#2563aa;color:#164e91;font-weight:600}#results button{font-size:12px}#matches{font-size:12px}main{flex:1;min-width:0;display:flex;flex-direction:column}#stage{flex:1;min-height:120px;overflow:hidden;position:relative;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}#stage:active{cursor:grabbing}#drawing{position:absolute;transform-origin:0 0;background:white;box-shadow:0 3px 18px #172b4224}#drawing [data-inspect]{cursor:pointer}#drawing .viewer-related{outline:2px solid #0879c9;outline-offset:2px}#drawing .viewer-active{outline:3px solid #d16c00;outline-offset:3px}#drawing .diagram-cable.viewer-related,#drawing .diagram-cable.viewer-active{stroke:#0879c9;stroke-width:7}#drawing svg{display:block;max-width:none;font-family:Calibri,Carlito,Arial,sans-serif}footer{height:88px;flex-shrink:0;overflow:auto;padding:10px 16px;background:#fff;border-top:1px solid #d7e0eb;display:flex;flex-wrap:wrap;gap:8px 20px;font-size:12px}#inspection{flex:1;min-width:150px;overflow-wrap:anywhere}footer>span:last-child{color:#52647b}@media(max-width:700px){header{padding:10px;flex-wrap:wrap}h1{font-size:16px}.workspace{flex-direction:column}aside{width:100%;max-height:28vh;border-right:0;border-bottom:1px solid #d7e0eb;padding:10px}nav{display:flex;flex-wrap:wrap;margin-top:8px}nav button{padding:6px 9px}#results{margin-top:8px}footer>span:last-child{display:none}}`;

function viewer(){
 const $=id=>document.getElementById(id),data=JSON.parse($('drawing-data').textContent),stage=$('stage'),drawing=$('drawing');
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
 const sheets=data.map(p=>({...p,node:null}));let active=0,scale=1,x=0,y=0,drag=null,frame=0,pinned=null,highlighted=[],current=null;
 function sheet(n){if(!sheets[n].node){sheets[n].node=clean(sheets[n].svg);prepare(sheets[n].node);}return sheets[n].node;}
 function prepare(svg){
  svg.devices=new Map([...svg.querySelectorAll('[data-device-id]')].map(n=>[n.getAttribute('data-device-id'),n]));svg.linksByDevice=new Map();svg.linksByPort=new Map();svg.labelsByLink=new Map();svg.links=[...svg.querySelectorAll('.diagram-cable')];
  for(const link of svg.links)for(const side of ['from','to']){const id=link.getAttribute('data-'+side+'-device');if(!id)continue;if(!svg.linksByDevice.has(id))svg.linksByDevice.set(id,[]);svg.linksByDevice.get(id).push(link);const key=id+'/'+link.getAttribute('data-'+side+'-port');if(!svg.linksByPort.has(key))svg.linksByPort.set(key,[]);svg.linksByPort.get(key).push(link);}
  for(const node of svg.querySelectorAll('[data-drawing-key]')){const parts=node.getAttribute('data-drawing-key').split('|'),i=parts.indexOf('port');if(i<0)continue;node.relatedLinks=(svg.linksByPort.get(parts[i+1])||[]).filter(link=>(svg.linksByPort.get(parts[i+2])||[]).includes(link));for(const link of node.relatedLinks){if(!svg.labelsByLink.has(link))svg.labelsByLink.set(link,[]);svg.labelsByLink.get(link).push(node);}}
  for(const node of svg.querySelectorAll('[data-device-id],.diagram-cable,[data-port-name],text')){
   const title=[...node.children].find(c=>c.localName==='title')?.textContent||node.getAttribute('data-port-name')||node.textContent;
   if(!title?.trim())continue;node.dataset.inspect=title.trim();node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label',title.trim());
  }
 }
 function inspect(node,pin=false){
  if(pin)pinned=node;if(node===current)return;current=node;
  for(const n of highlighted)n.classList.remove('viewer-active','viewer-related');highlighted=[];
  if(!node){$('inspection').textContent='Hover or focus for details · Click or Enter to pin · Escape to clear.';return;}
  const svg=sheet(active),id=node.closest('[data-device-id]')?.getAttribute('data-device-id'),from=node.getAttribute('data-from-device'),to=node.getAttribute('data-to-device');
  const links=node.classList.contains('diagram-cable')?[node]:(node.relatedLinks||(node.hasAttribute('data-port-name')?svg.linksByPort.get(id+'/'+node.getAttribute('data-port-name')):svg.linksByDevice.get(id))||[]);
  const ids=new Set([id,from,to].filter(Boolean));for(const link of links){ids.add(link.getAttribute('data-from-device'));ids.add(link.getAttribute('data-to-device'));}
  highlighted=[node,...links,...links.flatMap(link=>svg.labelsByLink.get(link)||[]),...[...ids].map(id=>svg.devices.get(id)).filter(Boolean)];
  for(const n of highlighted)n.classList.add(n===node?'viewer-active':'viewer-related');
  const port=node.getAttribute('data-port-name'),type=node.getAttribute('data-link-type');
  $('inspection').textContent=node.dataset.inspect+(port?' · Port '+port:'')+(type?' · '+type:'')+(links.length&&!node.classList.contains('diagram-cable')?' · '+links.length+' connected link(s): '+links.slice(0,12).map(n=>n.dataset.inspect).join('; ')+(links.length>12?' · More links highlighted in drawing':''):'');
 }
 function target(n){return n?.closest?.('[data-inspect]')||null;}
 const button=(text,action)=>{const b=document.createElement('button');b.textContent=text;b.onclick=action;return b;};
 const entries=sheets.map((p,n)=>{const b=button((n+1)+'. '+p.name,()=>show(n));$('pages').append(b);return b;});
 function paint(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;drawing.style.transform=`translate(${x}px,${y}px) scale(${scale})`;$('zoom').textContent=Math.round(scale*100)+'%';});}
 function fit(){const b=sheet(active).viewBox.baseVal;scale=Math.max(.005,Math.min(8,(stage.clientWidth-32)/b.width,(stage.clientHeight-32)/b.height));x=(stage.clientWidth-b.width*scale)/2;y=(stage.clientHeight-b.height*scale)/2;paint();}
 function show(n){inspect(null);pinned=null;active=n;const svg=sheet(n),b=svg.viewBox.baseVal;svg.setAttribute('role','group');svg.setAttribute('aria-label',sheets[n].name);svg.setAttribute('width',b.width);svg.setAttribute('height',b.height);drawing.replaceChildren(svg);entries.forEach((entry,i)=>i===n?entry.setAttribute('aria-current','page'):entry.removeAttribute('aria-current'));$('page-name').textContent=(n+1)+' / '+sheets.length+' · '+sheets[n].name;$('inspection').textContent='Hover or focus for details · Click or Enter to pin · Escape to clear.';fit();}
 function zoom(factor,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const next=Math.max(.005,Math.min(16,scale*factor));x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;scale=next;paint();}
 $('in').onclick=()=>zoom(1.25);$('out').onclick=()=>zoom(.8);$('fit').onclick=fit;
 stage.addEventListener('wheel',e=>{e.preventDefault();const b=stage.getBoundingClientRect();zoom(e.deltaY<0?1.12:1/1.12,e.clientX-b.left,e.clientY-b.top);},{passive:false});
 stage.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();stage.focus({preventScroll:true});drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,x,y,target:e.target};stage.setPointerCapture(e.pointerId);};
 stage.onpointermove=e=>{if(!drag&&!pinned)inspect(target(e.target));if(drag?.id===e.pointerId){x=drag.x+e.clientX-drag.sx;y=drag.y+e.clientY-drag.sy;paint();}};
 stage.onpointerup=e=>{if(drag?.id!==e.pointerId)return;const d=drag;drag=null;if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<5){inspect(target(d.target),true);}};
 stage.onpointerleave=()=>{if(!pinned)inspect(null);};
 stage.onfocusin=e=>{if(!pinned)inspect(target(e.target));};
 stage.onpointercancel=()=>{drag=null;};stage.onlostpointercapture=()=>{drag=null;};
 stage.onkeydown=e=>{if(e.key==='Escape'){pinned=null;inspect(null);}else if(e.key==='Enter'||e.key===' '){inspect(target(e.target),true);}else if(e.key==='+'||e.key==='=')zoom(1.25);else if(e.key==='-')zoom(.8);else if(e.key==='0')fit();else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;paint();}else return;e.preventDefault();};
 // Scene text includes a full-value title and painted tspans; never concatenate both.
 const label=node=>([...node.children].find(child=>child.localName==='title')?.textContent||node.textContent).trim();
 let index;const searchIndex=()=>index??=sheets.flatMap((p,page)=>[...sheet(page).querySelectorAll('text,title')].filter(n=>label(n)).map(node=>({page,node,text:label(node)})));
 $('search').oninput=()=>{const query=$('search').value.trim().toLocaleLowerCase();$('results').replaceChildren();if(!query){$('matches').textContent='';return;}const seen=new Set(),found=searchIndex().filter(i=>{const key=i.page+'|'+i.text;if(seen.has(key)||!i.text.toLocaleLowerCase().includes(query))return false;seen.add(key);return true;});$('matches').textContent=found.length+' matches'+(found.length>100?' · first 100 shown':'');for(const hit of found.slice(0,100))$('results').append(button(sheets[hit.page].name+' · '+hit.text,()=>{show(hit.page);$('inspection').textContent=hit.text;const target=hit.node.localName==='title'?hit.node.parentElement:hit.node;try{const b=target.getBBox(),m=target.getCTM(),point=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);scale=Math.min(4,Math.max(scale,1.5));x=stage.clientWidth/2-point.x*scale;y=stage.clientHeight/2-point.y*scale;paint();}catch{/* A page title has no geometric target. */}stage.focus({preventScroll:true});}));};
 new ResizeObserver(()=>fit()).observe(stage);show(0);
}
