// Native Visio 2003-2010 picture-master reader adapted from the owner's Configuration Inspector.
// Source: TechSavage1989/Configuration-Inspector webview/stencils.js, commit 675a806eeb893a55b2272be9fb7e914bac06ee03.
// Binary format reference: Document Liberation Project libvisio.
const u16=(b,o)=>b[o]|(b[o+1]<<8);
const u32=(b,o)=>(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;
function frameOf(w,h,pics,conns){let x0=0,y0=0,x1=w,y1=h;if(pics.length){x0=Infinity;y0=Infinity;x1=-Infinity;y1=-Infinity;for(const p of pics){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x+p.w);y1=Math.max(y1,p.y+p.h);}}return {x:x0,y:y0,w:Math.max(.01,x1-x0),h:Math.max(.01,y1-y0)};}
 function cfbStream(b,wanted){
  if(b.length<512||b.length>160*1024*1024)throw Error('Invalid legacy stencil size.');
  if([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].some((v,i)=>b[i]!==v))throw Error('This file is not a legacy Visio compound document.');
  var ss=1<<u16(b,30),fat=[],difat=[],i,v,sec=function(n){return ss*(n+1);};
  if(ss!==512&&ss!==4096)throw new Error('The stencil file is damaged.');
  for(i=0;i<109;i++){v=u32(b,76+i*4);if(v<0xfffffffa)difat.push(v);}
  var d=u32(b,68);for(var k=0;k<u32(b,72)&&d<0xfffffffa&&sec(d)+ss<=b.length;k++){for(i=0;i<ss/4-1;i++){v=u32(b,sec(d)+i*4);if(v<0xfffffffa)difat.push(v);}d=u32(b,sec(d)+ss-4);}
  difat.forEach(function(x){if(sec(x)+ss>b.length)throw Error('Invalid legacy allocation table.');for(var j=0;j<ss/4;j++)fat.push(u32(b,sec(x)+j*4));});
  function read(start,size,partial=false){if(size>160*1024*1024)throw Error('Legacy stream exceeds 160 MB.');var out=new Uint8Array(size),pos=0,n=start,seen=new Set();while(n<0xfffffffa&&pos<size){if(seen.has(n))throw Error('Cyclic legacy allocation chain.');seen.add(n);var at=sec(n),len=Math.min(ss,size-pos);if(at+len>b.length||n>=fat.length)throw Error('Truncated legacy allocation chain.');out.set(b.subarray(at,at+len),pos);pos+=len;n=fat[n];}if(pos<size&&!partial)throw Error('Truncated legacy stream.');return out;}
  var dir=read(u32(b,48),ss*256,true);
  for(var o=0;o+128<=dir.length;o+=128){var nl=u16(dir,o+64);if(nl<2||nl>64)continue;var name='';for(i=0;i<nl/2-1;i++)name+=String.fromCharCode(u16(dir,o+i*2));if(name===wanted&&dir[o+66]===2){var size=u32(dir,o+120);if(size<u32(b,56))throw new Error('The stencil file is damaged.');return read(u32(dir,o+116),size);}}
  return null;
 }
 function lz(t){var out=new Uint8Array(Math.min(64*1024*1024,Math.max(16,t.length*8))),n=0,buf=new Uint8Array(4096),pos=0,o=0;
  function put(x){if(n>=64*1024*1024)throw Error('Legacy master stream exceeds 64 MB.');if(n>=out.length){var bigger=new Uint8Array(out.length*2);bigger.set(out);out=bigger;}out[n++]=x;}
  while(o<t.length){var flag=t[o++];if(o>t.length-1)break;for(var bit=0,mask=1;bit<8&&o<t.length;bit++,mask<<=1){
   if(flag&mask){buf[pos&4095]=t[o++];put(buf[pos&4095]);pos++;}
   else{if(o>t.length-2)break;var a1=t[o++],a2=t[o++],len=(a2&15)+3,p=((a2&0xf0)<<4)|a1;p=p>4078?p-4078:p+18;for(var j=0;j<len;j++){buf[(pos+j)&4095]=buf[(p+j)&4095];put(buf[(pos+j)&4095]);}pos+=len;}}}
  return out.subarray(0,n);}
 function f64(b,o){return o+8<=b.length?new DataView(b.buffer,b.byteOffset+o,8).getFloat64(0,true):0;}
 var CHUNK_TRAILER8=[0x71,0x70,0x6b,0x6a,0x69,0x66,0x65,0x2c],CHUNK_TRAILER4=[0x64,0x65,0x66,0x69,0x6a,0x6b,0x6f,0x71,0x92,0xa9,0xb4,0xb6,0xb9,0xc7],CHUNK_NONE=[0x1f,0xc9,0x2d,0xd1];
 function eachChunk(d,cb){var o=0;while(o<d.length){while(o<d.length&&!d[o])o++;if(o+19>d.length)break;var type=u32(d,o),list=u32(d,o+8),len=u32(d,o+12),level=u16(d,o+16),unk=d[o+18],tr=0;
   if(list!==0||CHUNK_TRAILER8.indexOf(type)>=0)tr+=8;if(list!==0||(level===2&&unk===0x55)||(level===2&&unk===0x54&&type===0xaa)||(level===3&&unk!==0x50&&unk!==0x54))tr+=4;
   if(CHUNK_TRAILER4.indexOf(type)>=0&&tr!==12&&tr!==4)tr+=4;if(CHUNK_NONE.indexOf(type)>=0)tr=0;var start=o+19;if(len>d.length-start)break;cb(type,d.subarray(start,start+len));o=start+len+tr;}}
export function readBinaryVisio(bytes,fileName){
  var V=cfbStream(bytes,'VisioDocument');if(!V||V.length<0x40)throw new Error((fileName||'This file')+' is not a Visio stencil.');
  if(V[0x1a]<11){var old=new Error((fileName||'This file')+' was saved by Visio 2002 or earlier.');old.legacy=true;throw old;}
  function ptr(d,o){return {type:u32(d,o),offset:u32(d,o+8),length:u32(d,o+12),format:u16(d,o+16)};}
  var strings={},pageNames=null,pages={},seen=new Set(),budget=200000,expanded=0;
  function shapeOf(page,id){return page.shapes[id]||(page.shapes[id]={id:id,parent:0,conns:[],pics:[]});}
  function chunk(page,shape,type,d){
   if(type===0x47||type===0x48||type===0x4e){if(d.length>=14)shape.parent=u32(d,10);shape.kind=type;}
   else if(type===0x9b)shape.xf={pinX:f64(d,1),pinY:f64(d,10),w:f64(d,19),h:f64(d,28),locX:f64(d,37),locY:f64(d,46),angle:f64(d,55)};
   else if(type===0x99)shape.conns.push({x:f64(d,1),y:f64(d,10)});
   else if(type===0x98){var ft=u16(d,36),map=u16(d,38);shape.ftype={x:f64(d,1),y:f64(d,10),w:f64(d,19),h:f64(d,28),type:map===8?4:ft,format:d.length>=53?u32(d,49):0};}
   else if(type===0x89)(shape.geometryFlags||=[]).push(d[0]);
   else if(type===0x0e&&d.subarray(8).some(v=>v!==0))shape.hasText=true;
   else if(type===0xa4)shape.hideText=!!(d[0]&0x20);
   else if(type===0x0c)shape.data=d;}
  function walk(p,ctx){if((ctx.depth||0)>64)throw Error('Legacy stencil nesting is excessive.');if(budget--<=0)throw Error('Legacy stencil has too many streams.');if(p.offset+p.length>V.length)throw Error('Legacy stencil stream is truncated.');var raw=V.subarray(p.offset,p.offset+p.length),comp=(p.format&2)===2,d=comp?lz(raw):raw,shift=comp?4:0,kind=p.format>>4;
   expanded+=d.length;if(expanded>512*1024*1024)throw Error('Legacy stencil exceeds the expanded stream limit.');var c=Object.assign({},ctx);
   if(p.type===0x1d)c.stencils=true;else if(p.type===0x1e&&ctx.stencils){c.page=pages[p.idx]||(pages[p.idx]={idx:p.idx,shapes:{}});c.shape=null;}
   else if(c.page&&(p.type===0x47||p.type===0x48||p.type===0x4e))c.shape=shapeOf(c.page,p.idx);
   if(p.type===0x33&&d.length>shift+4){var str='';for(var o=shift+4;o+1<d.length;o+=2){var ch=u16(d,o);if(!ch)break;str+=String.fromCharCode(ch);}strings[p.idx]=str;}
   if(p.type===0xc9&&ctx.stencilsList){var cnt=u32(d,shift),m={};for(var r=0,q=shift+4;r<cnt&&q+13<=d.length;r++,q+=13)m[u32(d,q+8)]=u32(d,q);pageNames=m;}
   if(kind===4||kind===5||kind===0){if(c.shape&&d.length>shift)chunk(c.page,c.shape,p.type,d.subarray(shift));}
   else if((kind===0xd||kind===0xc||kind===8)&&c.shape)eachChunk(d,function(t,cd){chunk(c.page,c.shape,t,cd);});
   if(kind===5&&p.type!==0x16&&!seen.has(p.offset)){seen.add(p.offset);var off=u32(d,shift);if(off+shift+8>d.length)return;var count=u32(d,off+shift),at=off+shift+8;
    for(var i=0;i<count&&at+18<=d.length;i++,at+=18){var x=ptr(d,at);x.idx=i;if(x.type)walk(x,Object.assign({},c,{stencilsList:p.type===0x1d,depth:(c.depth||0)+1}));}}}
  walk(ptr(V,0x24),{});
  var masters=[],media=0;
  Object.keys(pages).forEach(function(k){var page=pages[k],name=pageNames&&strings[pageNames[k]]||'Master '+k,shapes=page.shapes,top=Object.values(shapes).find(function(x){return x.parent===0&&x.xf;});
   if(!top||/^dynamic connector$/i.test(name))return;
   function origin(sh){var x=0,y=0,guard=0;while(sh&&sh!==top&&guard++<20){if(!sh.xf)return null;x+=sh.xf.pinX-sh.xf.locX;y+=sh.xf.pinY-sh.xf.locY;sh=shapes[sh.parent];}return sh===top?{x:x,y:y}:null;}
   var pics=[];Object.values(shapes).forEach(function(sh){if(!sh.data||!sh.ftype)return;var o=sh===top?{x:0,y:0}:origin(sh);if(!o)return;var f=sh.ftype,ext=picture(sh.data,f.type,f.format);if(!ext)return;
    pics.push({x:o.x+f.x,y:o.y+f.y,w:f.w||(sh.xf&&sh.xf.w),h:f.h||(sh.xf&&sh.xf.h),ext:ext.ext,data:ext.data});});
   var w=top.xf.w,h=top.xf.h,frame=frameOf(w,h,pics,top.conns),id=String(masters.length+2),rels={},mfiles={},picXML=pics.map(function(pc,i){var rid='rId'+(i+1),path='visio/media/vss'+(++media)+'.'+pc.ext;rels[rid]={type:'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',target:'../media/vss'+media+'.'+pc.ext};mfiles[path]=pc.data;var x=pc.x-frame.x,y=pc.y-frame.y;
     return '<Shape ID="'+(i+6)+'" Type="Foreign" LineStyle="0" FillStyle="0" TextStyle="0">'+xc('PinX',x+pc.w/2)+xc('PinY',y+pc.h/2)+xc('Width',pc.w)+xc('Height',pc.h)+xc('LocPinX',pc.w/2)+xc('LocPinY',pc.h/2)+xc('ImgOffsetX',0)+xc('ImgOffsetY',0)+xc('ImgWidth',pc.w)+xc('ImgHeight',pc.h)+'<ForeignData ForeignType="'+(pc.ext==='emf'?'EnhMetaFile':pc.ext==='wmf'?'MetaFile':'Bitmap')+'"'+(/^(png|jpg|gif|tif)$/.test(pc.ext)?' CompressionType="'+{png:'PNG',jpg:'JPEG',gif:'GIF',tif:'TIFF'}[pc.ext]+'"':'')+'><Rel r:id="'+rid+'"/></ForeignData></Shape>';}).join('');
   var conns=Object.values(shapes).flatMap(function(sh){var o=sh===top?{x:0,y:0}:origin(sh);return o?sh.conns.map(function(c){return {x:o.x+c.x-frame.x,y:o.y+c.y-frame.y};}):[];}),fw=frame.w,fh=frame.h;
   var xml='<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<MasterContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve"><Shapes><Shape ID="5" NameU="'+escX(name)+'" Name="'+escX(name)+'" Type="Group" LineStyle="0" FillStyle="0" TextStyle="0">'+xc('PinX',fw/2)+xc('PinY',fh/2)+xc('Width',fw)+xc('Height',fh)+xc('LocPinX',fw/2)+xc('LocPinY',fh/2)+
    (conns.length?'<Section N="Connection">'+conns.map(function(c,i){return '<Row T="Connection" IX="'+i+'">'+xc('X',c.x)+xc('Y',c.y)+'</Row>';}).join('')+'</Section>':'')+(picXML?'<Shapes>'+picXML+'</Shapes>':'')+'</Shape></Shapes></MasterContents>';
   var element='<Master ID="'+id+'" NameU="'+escX(name)+'" Name="'+escX(name)+'" IconSize="1" AlignName="2" MatchByName="0" IconUpdate="1" PatternFlags="0" Hidden="0" MasterType="2"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">'+xc('PageWidth',fw)+xc('PageHeight',fh)+'</PageSheet><Rel r:id="rId1"/></Master>';
   var part=((name.match(/^([A-Z0-9][A-Z0-9-]{3,14})(?=[\s/(]|$)/)||[])[1]||'');if(!/\d/.test(part))part='';
   masters.push({needsConversion:Object.values(shapes).some(sh=>(!sh.ftype&&((sh.hasText&&!sh.hideText)||sh.geometryFlags?.some(flags=>!(flags&4)&&(flags&3)!==3)))||Math.abs(sh.xf?.angle||0)>1e-8),cells:{PinX:fw/2,PinY:fh/2,LocPinX:fw/2,LocPinY:fh/2},type:'Group',file:fileName||'stencil',id:id,name:name,element:element,xml:xml,rels:rels,media:mfiles,props:{},part:part,product:'',manufacturer:'',shapeW:fw,shapeH:fh,w:fw,h:fh,x0:0,y0:0,oneD:false,connections:conns,
    pictures:pics.map(function(pc){return {x:pc.x-frame.x,y:pc.y-frame.y,w:pc.w,h:pc.h,ext:pc.ext,data:pc.data};})});});
  if(!masters.length)throw new Error((fileName||'This file')+' contains no master shapes.');
  return {file:fileName||'stencil',masters:masters,styles:'',legacy:true};
 }
 function xc(n,v){return '<Cell N="'+n+'" V="'+(Math.round(v*1e6)/1e6)+'"/>';}
 function escX(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 // A foreign data blob as a picture: EMF/WMF metafiles and bitmaps (a raw DIB gets a
 // BMP file header).
 function picture(d,type,format){
  if(type===0||type===4){if(d.length>0x2c&&d[0x28]===0x20&&d[0x29]===0x45&&d[0x2a]===0x4d&&d[0x2b]===0x46)return {ext:'emf',data:d};return {ext:'wmf',data:d};}
  if(type===1){var ext={1:'jpg',2:'gif',3:'tif',4:'png'}[format];if(ext)return {ext:ext,data:d};
   if(d.length<40)return null;var head=u32(d,0),bits=u16(d,14),colors=u32(d,32)||(bits<=8?1<<bits:0),offset=14+head+colors*4+((u32(d,16)===3&&head===40)?12:0),file=new Uint8Array(14+d.length);
   file[0]=0x42;file[1]=0x4d;var dv=new DataView(file.buffer);dv.setUint32(2,file.length,true);dv.setUint32(10,offset,true);file.set(d,14);return {ext:'bmp',data:file};}
  return null;
 }
