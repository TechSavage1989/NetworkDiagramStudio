// XML stencils (VSX), templates (VTX), and drawings (VDX) use the older
// ShapeSheet element syntax. Normalize cached cells before using the renderer.
export function legacyShape(source){
 const doc=document.implementation.createDocument('http://schemas.microsoft.com/office/visio/2012/main','Shape',null);
 const make=(name,attrs={})=>{const e=doc.createElementNS(doc.documentElement.namespaceURI,name);for(const [k,v]of Object.entries(attrs))if(v!=null)e.setAttribute(k,v);return e;};
 const cell=e=>make('Cell',{N:e.localName,V:e.textContent.trim(),...(e.hasAttribute('F')?{F:e.getAttribute('F')}:{})});
 function convert(shape){
  const out=make('Shape');for(const a of shape.attributes)if(!a.name.startsWith('xmlns'))out.setAttribute(a.name,a.value);
  const groups=new Map();
  for(const e of shape.children){
   const n=e.localName;
   if(n==='Shapes'){const list=make('Shapes');for(const child of e.children)if(child.localName==='Shape')list.append(convert(child));out.append(list);}
   else if(n==='Text'||n==='ForeignData'){const copy=doc.importNode(e,true);out.append(copy);}
   else if(n==='Geom'){
    const section=make('Section',{N:'Geometry',IX:e.getAttribute('IX')||0});
    for(const row of e.children){
     if(!row.children.length)section.append(cell(row));
     else{const r=make('Row',{T:row.localName,IX:row.getAttribute('IX')||0,Del:row.getAttribute('Del')});for(const c of row.children)r.append(cell(c));section.append(r);}
    }out.append(section);
   }else if(['Connection','Control','Char','Para','User','Prop','Scratch'].includes(n)){
    const type={Char:'Character',Para:'Paragraph',Prop:'Property'}[n]||n;
    if(!groups.has(type)){const section=make('Section',{N:type});groups.set(type,section);out.append(section);}
    const row=make('Row',{IX:e.getAttribute('IX')||0,N:e.getAttribute('NameU')||e.getAttribute('Name')});for(const c of e.children)row.append(cell(c));groups.get(type).append(row);
   }else if(e.children.length){for(const c of e.children)if(!c.children.length)out.append(cell(c));}
   else if(!['Help','Hyperlink','Event','Data1','Data2','Data3'].includes(n))out.append(cell(e));
  }
  return out;
 }
 return convert(source);
}
