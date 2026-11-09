import {svgPage} from './diagram/scene.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Deliberately accept drawing pages, never the project or its retained evidence.
export function exportInteractiveHtml(pages,{title='Network diagram'}={}){
 if(!pages?.length)throw Error('Choose at least one drawing page to export.');
 const data=JSON.stringify(pages.map(p=>({name:String(p.displayName||p.name||'Drawing'),svg:p.svg||svgPage(p)}))).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(title)} · Diagram viewer</title><style>${viewerStyle}</style></head><body>
<header><div><h1>${escape(title)}</h1><p>NetworkDiagramStudio · Offline, read-only drawing</p></div><div class="tools" aria-label="View controls"><button id="out" aria-label="Zoom out">−</button><output id="zoom" aria-live="polite"></output><button id="in" aria-label="Zoom in">+</button><button id="fit">Fit page</button></div></header>
<div class="workspace"><aside aria-label="Drawing pages"><label for="search">Find in drawing set</label><input id="search" type="search" placeholder="Device, port or label…" autocomplete="off"><p id="matches" role="status"></p><nav id="pages" aria-label="Pages"></nav><div id="results" aria-label="Search results"></div></aside><main><div id="stage" tabindex="0" role="region" aria-label="Diagram. Drag to pan, scroll to zoom. Plus and minus zoom, arrow keys pan, zero fits page."><div id="drawing"></div></div><footer><strong id="page-name"></strong><span id="inspection" role="status">Click an object to inspect its label.</span><span>Drag to pan · Scroll to zoom · 0 to fit</span></footer></main></div>
<noscript>This offline viewer needs JavaScript enabled to display the drawings.</noscript><script id="drawing-data" type="application/json">${data}</script><script>(${viewer.toString()})();</script></body></html>`;
}
const viewerStyle=`*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#172b42;font:14px system-ui,-apple-system,Segoe UI,sans-serif;height:100dvh;display:flex;flex-direction:column}header{padding:16px 22px;background:#fff;border-bottom:1px solid #d7e0eb;display:flex;gap:16px;justify-content:space-between;align-items:center}h1{font-size:19px;margin:0;overflow-wrap:anywhere}p{margin:5px 0;color:#52647b}button,input{font:inherit;border:1px solid #b8c8da;border-radius:7px;background:#fff;color:inherit;padding:9px 12px}button{cursor:pointer}button:hover{background:#edf5ff}button:focus-visible,input:focus-visible,#stage:focus-visible{outline:3px solid #3679ce;outline-offset:-3px}.tools{display:flex;gap:7px;align-items:center;flex-shrink:0}output{min-width:50px;text-align:center;font-variant-numeric:tabular-nums}.workspace{display:flex;flex:1;min-height:0}aside{width:260px;flex-shrink:0;background:#fff;border-right:1px solid #d7e0eb;padding:16px;overflow:auto}label{font-weight:600;display:block;margin-bottom:8px}input{width:100%}nav,#results{display:grid;gap:7px;margin-top:16px}nav button,#results button{text-align:left;overflow-wrap:anywhere}button[aria-current=page]{background:#e3effe;border-color:#2563aa;color:#164e91;font-weight:600}#results button{font-size:12px}#matches{font-size:12px}main{flex:1;min-width:0;display:flex;flex-direction:column}#stage{flex:1;min-height:120px;overflow:hidden;position:relative;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}#stage:active{cursor:grabbing}#drawing{position:absolute;transform-origin:0 0;background:white;box-shadow:0 3px 18px #172b4224}#drawing svg{display:block;max-width:none;font-family:Calibri,Carlito,Arial,sans-serif}footer{padding:10px 16px;background:#fff;border-top:1px solid #d7e0eb;display:flex;flex-wrap:wrap;gap:8px 20px;font-size:12px}#inspection{flex:1;min-width:150px;overflow-wrap:anywhere}footer>span:last-child{color:#52647b}@media(max-width:700px){header{padding:10px;flex-wrap:wrap}h1{font-size:16px}.workspace{flex-direction:column}aside{width:100%;max-height:28vh;border-right:0;border-bottom:1px solid #d7e0eb;padding:10px}nav{display:flex;flex-wrap:wrap;margin-top:8px}nav button{padding:6px 9px}#results{margin-top:8px}footer>span:last-child{display:none}}`;

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
 const sheets=data.map(p=>({...p,node:clean(p.svg)}));let active=0,scale=1,x=0,y=0,drag=null;
 const button=(text,action)=>{const b=document.createElement('button');b.textContent=text;b.onclick=action;return b;};
 const entries=sheets.map((p,n)=>{const b=button((n+1)+'. '+p.name,()=>show(n));$('pages').append(b);return b;});
 function paint(){drawing.style.transform=`translate(${x}px,${y}px) scale(${scale})`;$('zoom').textContent=Math.round(scale*100)+'%';}
 function fit(){const b=sheets[active].node.viewBox.baseVal;scale=Math.max(.005,Math.min(8,(stage.clientWidth-32)/b.width,(stage.clientHeight-32)/b.height));x=(stage.clientWidth-b.width*scale)/2;y=(stage.clientHeight-b.height*scale)/2;paint();}
 function show(n){active=n;const svg=sheets[n].node,b=svg.viewBox.baseVal;svg.setAttribute('role','img');svg.setAttribute('aria-label',sheets[n].name);svg.setAttribute('width',b.width);svg.setAttribute('height',b.height);drawing.replaceChildren(svg);entries.forEach((entry,i)=>i===n?entry.setAttribute('aria-current','page'):entry.removeAttribute('aria-current'));$('page-name').textContent=(n+1)+' / '+sheets.length+' · '+sheets[n].name;$('inspection').textContent='Click an object to inspect its label.';fit();}
 function zoom(factor,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const next=Math.max(.005,Math.min(16,scale*factor));x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;scale=next;paint();}
 $('in').onclick=()=>zoom(1.25);$('out').onclick=()=>zoom(.8);$('fit').onclick=fit;
 stage.addEventListener('wheel',e=>{e.preventDefault();const b=stage.getBoundingClientRect();zoom(e.deltaY<0?1.12:1/1.12,e.clientX-b.left,e.clientY-b.top);},{passive:false});
 stage.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();stage.focus({preventScroll:true});drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,x,y,target:e.target};stage.setPointerCapture(e.pointerId);};
 stage.onpointermove=e=>{if(drag?.id===e.pointerId){x=drag.x+e.clientX-drag.sx;y=drag.y+e.clientY-drag.sy;paint();}};
 stage.onpointerup=e=>{if(drag?.id!==e.pointerId)return;const d=drag;drag=null;if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<5){let n=d.target;while(n&&n!==drawing){const title=[...n.children].find(c=>c.localName==='title')?.textContent;const value=title||(n.localName==='text'?n.textContent:'');if(value){$('inspection').textContent=value;break;}n=n.parentElement;}}};
 stage.onpointercancel=()=>{drag=null;};stage.onlostpointercapture=()=>{drag=null;};
 stage.onkeydown=e=>{if(e.key==='+'||e.key==='=')zoom(1.25);else if(e.key==='-')zoom(.8);else if(e.key==='0')fit();else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;paint();}else return;e.preventDefault();};
 // Scene text includes a full-value title and painted tspans; never concatenate both.
 const label=node=>([...node.children].find(child=>child.localName==='title')?.textContent||node.textContent).trim();
 const index=sheets.flatMap((p,page)=>[...p.node.querySelectorAll('text,title')].filter(n=>label(n)).map(node=>({page,node,text:label(node)})));
 $('search').oninput=()=>{const query=$('search').value.trim().toLocaleLowerCase();$('results').replaceChildren();if(!query){$('matches').textContent='';return;}const seen=new Set(),found=index.filter(i=>{const key=i.page+'|'+i.text;if(seen.has(key)||!i.text.toLocaleLowerCase().includes(query))return false;seen.add(key);return true;});$('matches').textContent=found.length+' matches'+(found.length>100?' · first 100 shown':'');for(const hit of found.slice(0,100))$('results').append(button(sheets[hit.page].name+' · '+hit.text,()=>{show(hit.page);$('inspection').textContent=hit.text;const target=hit.node.localName==='title'?hit.node.parentElement:hit.node;try{const b=target.getBBox(),m=target.getCTM(),point=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);scale=Math.min(4,Math.max(scale,1.5));x=stage.clientWidth/2-point.x*scale;y=stage.clientHeight/2-point.y*scale;paint();}catch{/* A page title has no geometric target. */}stage.focus({preventScroll:true});}));};
 new ResizeObserver(()=>fit()).observe(stage);show(0);
}
