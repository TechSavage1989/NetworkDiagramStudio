import { unzip } from './zip.mjs';
import {drawEmf} from './emf-canvas.mjs';

const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const text=new TextDecoder();
const children=(e,tag)=>Array.from(e?.children??[]).filter(n=>n.localName===tag);
function xml(data){
  if (!data || data.length>16*1024*1024) throw Error('Missing or oversized Visio XML part.');
  const s=text.decode(data);
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) throw Error('Unsupported XML declaration in stencil.');
  const d=new DOMParser().parseFromString(s,'application/xml');
  if(d.getElementsByTagName('parsererror').length) throw Error('Invalid Visio XML.');
  return d.documentElement;
}
function resolve(owner,part){
  if(!part || /[\\?#:]|^\/\//.test(part)) throw Error('Unsupported external stencil reference.');
  const parts=part.startsWith('/')?[]:owner.split('/').slice(0,-1);
  for(const n of part.split('/')) {
    if(n==='..') { if(!parts.length)throw Error('Invalid package path.'); parts.pop(); }
    else if(n && n!=='.') parts.push(n);
  }
  return parts.join('/');
}
function rels(zip,part){
  const path=part.split('/');const name=path.pop();
  const content=zip.get([...path,'_rels',name+'.rels'].join('/'));
  if(!content)return new Map();
  return new Map(children(xml(content),'Relationship').filter(e=>e.getAttribute('TargetMode')!=='External').map(e=>[e.getAttribute('Id'),resolve(part,e.getAttribute('Target'))]));
}
function cellValues(shape) {return Object.fromEntries(children(shape,'Cell').map(e=>[e.getAttribute('N'),e.getAttribute('V')]));}
function imageFromURL(url){
  return new Promise((yes,no)=>{const i=new Image();i.onload=()=>yes(i);i.onerror=()=>no(Error('Unsupported stencil artwork. Use a front-view PNG instead.'));i.src=url;});
}
function emfImage(bytes){
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<88||bytes.length>12*1024*1024||d.getUint32(40,true)!==0x464d4520)throw Error('Invalid EMF header.');
  let offset=0,count=0;
  while(offset+8<=bytes.length){
    const size=d.getUint32(offset+4,true);
    if(size<8||size%4||offset+size>bytes.length||++count>120000)throw Error('Unsupported EMF record.');
    offset+=size;
  }
  const w=d.getInt32(16,true)-d.getInt32(8,true)+1,h=d.getInt32(20,true)-d.getInt32(12,true)+1;
  if(w<1||h<1||w>1000000||h>1000000||!globalThis.EMFJS)throw Error('No compatible EMF renderer.');
  globalThis.EMFJS.loggingEnabled(false);
  const renderer=new globalThis.EMFJS.Renderer(bytes.slice().buffer);
  const svg=renderer.render({width:String(w),height:String(h),wExt:w,hExt:h,xExt:w,yExt:h,mapMode:8});
  for(const el of svg.querySelectorAll('*'))for(const attr of el.attributes){
    if(attr.localName==='href' && !/^(#|data:image\/(jpeg|png|bmp);base64,)/i.test(attr.value))throw Error('External image in stencil.');
  }
  return new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});
}
async function decodeArt(bytes,path){
  const ext=path.split('.').pop().toLowerCase();
  const type={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',bmp:'image/bmp',gif:'image/gif'}[ext];
  if(!type && ext!=='emf')throw Error('Unsupported picture format: '+ext);
  if(ext==='emf'){try{return drawEmf(bytes);}catch{/* Fall back for other GDI dialects. */}}
  const url=URL.createObjectURL(type?new Blob([bytes],{type}):emfImage(bytes));
  try{return await imageFromURL(url);}finally{URL.revokeObjectURL(url);}
}
function newId(){return 'art-'+crypto.randomUUID();}
export async function loadImageStencil(file){
  if(file.size>12*1024*1024)throw Error('Image is over 12 MB.');
  const i=await decodeArt(new Uint8Array(await file.arrayBuffer()),file.name);
  const scale=Math.min(1,3000/Math.max(i.width,i.height));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(i.width*scale));c.height=Math.max(1,Math.round(i.height*scale));
  c.getContext('2d').drawImage(i,0,0,c.width,c.height);
  return {id:newId(),name:file.name.replace(/\.[^.]+$/,''),view:'front',width:c.width,height:c.height,dataUrl:c.toDataURL('image/png'),anchors:{}};
}
function namedAnchors(master,name,bounds){
  const sections=children(master,'Section');
  const rows=n=>children(sections.find(s=>s.getAttribute('N')===n),'Row');
  const ports=rows('Connection'),controls=rows('Control'), out={};
  const seen=new Map();
  const add=(k,v)=>{if(k){const pts=seen.get(k)??[];pts.push(v);seen.set(k,pts);}};
  for(const row of ports){
    if(row.getAttribute('Del')==='1')continue;
    const i=Number(row.getAttribute('IX')),r=cellValues(row);
    const x=(Number(r.X)-bounds.x)/bounds.w,y=1-(Number(r.Y)-bounds.y)/bounds.h;
    if(!Number.isFinite(x+y)||x<0||x>1||y<0||y>1)continue;
    const coord=[x,y], prompt=r.Prompt||cellValues(controls.find(c=>c.getAttribute('N')==='Row_'+(i+1))).Prompt||'';
    if(/JL675A/i.test(name) && ports.length>=60){
      if(i>=12&&i<60)add('1/1/'+(i-11),coord);
      else if([1,4,7,10].includes(i))add('1/1/'+(49+(i-1)/3),coord);
    } else if(/10GE SFP(?:\+| Plus) Slot/i.test(prompt) && /#\d+/.test(prompt))add('x'+prompt.match(/#(\d+)/)[1],coord);
    else if(/Gigabit Ethernet Port|SFP Slot/i.test(prompt) && /#\d+/.test(prompt))add('port'+prompt.match(/#(\d+)/)[1],coord);
    else if(/^(HA Port|Management Port|Console Port|USB)#/i.test(prompt))add(({ 'ha port':'ha', 'management port':'mgmt','console port':'console','usb':'usb'})[prompt.split('#')[0].toLowerCase()],coord);
    else if(ports.length===1&&/SFP|transceiver|module|DAC/i.test(name))add('cable',coord);
    else {
      // Application-authored and manufacturer stencils may keep the interface
      // name in either the row name or the literal connection-point prompt.
      const key=(row.getAttribute('N')||prompt).trim();
      if(/^(?:[a-z][\w.:/-]{0,59}|\d+(?:\/\d+)*)$/i.test(key))add(key,coord);
    }
  }
  for(const [k,pts] of seen)out[k]=[0,1].map(axis=>pts.reduce((t,p)=>t+p[axis],0)/pts.length);
  if(/(?:FG-|FortiGate\s*)120(?:G|\/121G)/i.test(name)&&bounds.w/bounds.h>9)out.x3=[.695625,.345439];
  return out;
}
export async function openVisioCatalog(file){
  const zip=await unzip(file), index='visio/masters/masters.xml';
  if(!zip.has(index))throw Error('This document has no reusable Visio masters.');
  const refs=rels(zip,index);
  const items=children(xml(zip.get(index)),'Master').map(m=>({
    key:m.getAttribute('ID'),name:m.getAttribute('Name')||m.getAttribute('NameU')||'Unnamed master',
    path:refs.get(children(m,'Rel')[0]?.getAttributeNS(REL,'id'))})).filter(m=>m.path);
  return {items,async load(key){
    const item=items.find(m=>m.key===key);if(!item)throw Error('Choose a master.');
    const doc=xml(zip.get(item.path));const root=children(children(doc,'Shapes')[0],'Shape')[0];
    if(!root)throw Error('Empty master.');
    const pictureRefs=rels(zip,item.path),pictures=[];
    function walk(shape,ox,oy,depth){
      if(depth>24)throw Error('Stencil group is too deeply nested.');
      const c=cellValues(shape),w=Number(c.Width)||0,h=Number(c.Height)||0;
      const x=ox+(Number(c.PinX)||0)-Number(c.LocPinX??w/2), y=oy+(Number(c.PinY)||0)-Number(c.LocPinY??h/2);
      const fd=children(shape,'ForeignData')[0],relation=fd&&children(fd,'Rel')[0];
      const path=relation&&pictureRefs.get(relation.getAttributeNS(REL,'id'));
      if(path && w>0 && h>0)pictures.push({path,x:depth?x:0,y:depth?y:0,w,h});
      for(const s of children(children(shape,'Shapes')[0],'Shape'))walk(s,depth?x:0,depth?y:0,depth+1);
    }
    walk(root,0,0,0);
    if(!pictures.length||pictures.length>64)throw Error('No supported front-panel picture in this master. Import a PNG or JPEG faceplate for this model.');
    const x=Math.min(...pictures.map(p=>p.x)),y=Math.min(...pictures.map(p=>p.y));
    const w=Math.max(...pictures.map(p=>p.x+p.w))-x,h=Math.max(...pictures.map(p=>p.y+p.h))-y;
    const scale=2400/Math.max(w,h),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext('2d');
    for(const p of pictures){const bytes=zip.get(p.path);if(!bytes)throw Error('Picture missing from stencil.');
      const img=await decodeArt(bytes,p.path);ctx.drawImage(img,(p.x-x)*scale,(y+h-p.y-p.h)*scale,p.w*scale,p.h*scale);}
    return {id:newId(),name:item.name,view:/\b(back|rear)\b/i.test(item.name)?'rear':'front',dataUrl:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,anchors:namedAnchors(root,item.name,{x,y,w,h})};
  }};
}
