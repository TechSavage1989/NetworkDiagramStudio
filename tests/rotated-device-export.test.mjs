import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {inflateSync} from 'node:zlib';
import {exportPdf} from '../src/web/report-export.mjs';
import {exportVisio,exportStencil} from '../src/web/diagram/visio.mjs';
import {unzip} from '../src/web/zip.mjs';
const require=createRequire(import.meta.url),jspdf=require('../src/web/vendor/jspdf.umd.min.js');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAABCAIAAACDoBMqAAAAE0lEQVR4nGPYcOQqHF3etgoZAQAc4hQk8w4kMAAAAABJRU5ErkJggg==';
const point=(g,u,v)=>{const dx=(u-.5)*g.w,dy=(v-.5)*g.h,c=Math.cos(g.angle||0),s=Math.sin(g.angle||0);return [g.x+g.w/2+dx*c+dy*s,g.y+g.h/2-dx*s+dy*c];};
function device(kind,angle=.63){
 const d={type:'device',key:kind,editKey:kind,masterKey:kind,name:kind,kind:'switch',model:'Fictional',x:60,y:60,w:180,h:70,angle,ports:{port:[.25,.3]},children:[]};
 if(kind==='native')d.asset={name:'Fictional vector panel',native:{paths:[{commands:[['M',0,0],['L',.5,0],['L',.5,1],['L',0,1],['Z']],fill:'#B0C4D5',stroke:'none',weight:.001}],texts:[{x:.75,y:.5,w:.4,size:.06,text:'Rotated',color:'#16364A',angle:.2,align:'center'}]}};
 else if(kind==='raster')d.asset={name:'Fictional raster panel',dataUrl:png};
 else d.children=[{type:'rect',x:0,y:0,w:.45,h:1,fill:'#B0C4D5',stroke:'none'},{type:'ellipse',x:.55,y:0,w:.45,h:1,fill:'#D3B6AA',stroke:'none'},{type:'text',x:.05,y:.1,w:.3,h:.25,size:8,value:'Child',color:'#16364A',angle:-.2}];
 return d;
}
const page=items=>({name:'Fictional rotated export',title:'Fictional rotated export',width:340,height:240,originX:-20,originY:-30,items});
async function pdfFor(p){const previous=globalThis.jspdf;globalThis.jspdf=jspdf;try{return await exportPdf([p]);}finally{if(previous===undefined)delete globalThis.jspdf;else globalThis.jspdf=previous;}}
function streams(bytes){const buffer=Buffer.from(bytes),text=buffer.toString('latin1'),out=[];for(const match of text.matchAll(/<<[^>]*\/Length\s+(\d+)[^>]*>>\s*stream\r?\n/g)){const start=match.index+match[0].length,data=buffer.subarray(start,start+Number(match[1]));out.push((/\/FlateDecode/.test(match[0])?inflateSync(data):data).toString('latin1'));}return out.join('\n');}
const renderer=process.env.NDS_PDF_RENDERER||'pdftoppm',missing=spawnSync(renderer,['-v']).error?.code==='ENOENT';
function raster(pdfBytes){
 const dir=mkdtempSync(join(tmpdir(),'nds-rotated-export-'));
 try{writeFileSync(join(dir,'test.pdf'),pdfBytes);const run=spawnSync(renderer,['-r','384','-singlefile',join(dir,'test.pdf'),join(dir,'test')],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const bytes=readFileSync(join(dir,'test.ppm'));let offset=0;
 const token=()=>{while(bytes[offset]<=32)offset++;const start=offset;while(bytes[offset]>32)offset++;return bytes.subarray(start,offset).toString();};assert.equal(token(),'P6');const w=+token(),h=+token();assert.equal(token(),'255');offset++;assert.equal(bytes.length-offset,w*h*3);return (x,y)=>{const at=offset+(Math.floor(y*4)*w+Math.floor(x*4))*3;return [...bytes.subarray(at,at+3)];};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
const close=(a,b,label)=>assert.ok(a.every((v,n)=>Math.abs(v-b[n])<=2),label+': '+a+' vs '+b);

test('arbitrarily rotated native, raster and generic devices retain painted geometry in vector PDF',{skip:missing?'Poppler unavailable':false},async()=>{
 for(const kind of ['native','raster','generic'])for(const angle of [.63,-1.13,Math.PI/2]){
  const d=device(kind,angle),p=page([d]),before=JSON.stringify(p),bytes=await pdfFor(p),pixel=raster(bytes);
  assert.equal(JSON.stringify(p),before,'export never mutates accepted drawing');
  const sample=(u,v)=>{const [x,y]=point(d,u,v);return pixel(x-p.originX,y-p.originY);};
  close(sample(.2,.7),[176,196,213],kind+' left artwork at '+angle);
  if(kind!=='native')close(sample(.77,.6),[211,182,170],kind+' right artwork at '+angle);
  close(sample(-.12,.5),[255,255,255],kind+' outside rotated outline');
  if(kind==='native')assert.doesNotMatch(Buffer.from(bytes).toString('latin1'),/\/Subtype\s*\/Image/,'native artwork remains vector');
 }
});

test('PDF combines native text angle and parent rotation without transforming later page items',async()=>{
 const d=device('native'),plain={type:'text',x:10,y:180,w:100,h:20,value:'Independent',size:12,color:'#16364A'},p=page([d,plain]),content=streams(await pdfFor(p));
 const matrices=[...content.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) Tm/g)].map(m=>m.slice(1).map(Number));
 const a=.83;assert.ok(matrices.some(m=>Math.abs(m[0]-Math.cos(a))<1e-8&&Math.abs(m[1]-Math.sin(a))<1e-8),'native text local and parent angles compose');
 assert.match(content,/22\.5 [\d.]+ Td/,'independent text retains its original X plus negative-origin normalization');
});

test('native Visio rotates only device instances, preserving child coordinates and normalized port glue',async()=>{
 for(const kind of ['native','raster','generic']){
  const d=device(kind),[x,y]=point(d,.25,.3),p=page([d,{type:'path',points:[[x,y],[300,180]],from:{device:kind,port:'port',x,y},color:'#16364A',weight:4,linkType:'Ethernet'}]);
  const zip=await unzip(await exportVisio({},[p]).arrayBuffer()),decode=path=>new TextDecoder().decode(zip.get(path)),xml=decode('visio/pages/page1.xml'),group=xml.match(/<Shape ID="1"[^>]*Type="Group"[\s\S]*?<Shapes>/)[0];
  assert.match(group,/<Cell N="Angle" V="0.63"\/>/);assert.match(group,/<Cell N="Width" V="1.875"\/>/);assert.match(group,/<Cell N="X" V="0.46875" F="Width\*0.25"\/>/);assert.match(group,/<Cell N="Y" V="0.51042" F="Height\*0.7"\/>/);
  assert.match(xml,/F="PAR\(PNT\(Sheet\.1!Connections.X1,Sheet\.1!Connections.Y1\)\)"/);assert.match(xml,/ToSheet="1" ToCell="Connections.X1"/);
  const begin=+xml.match(/<Cell N="BeginX" V="([^"]+)"/)[1];assert.ok(Math.abs(begin-(x+20)/96)<.000006);
  assert.match(decode('visio/masters/master1.xml'),/<Cell N="Angle" V="0"\/>/);
  if(kind==='native')assert.match(xml,/<Cell N="Angle" V="0.2"\/>/,'native text keeps relative angle');
  if(kind==='generic')assert.match(xml,/<Cell N="Angle" V="-0.2"\/>/,'generic text keeps relative angle');
  const stencil=await unzip(await exportStencil({},[p]).arrayBuffer());assert.match(new TextDecoder().decode(stencil.get('visio/masters/master1.xml')),/<Cell N="Angle" V="0"\/>/);
 }
});

test('Visio hosted symbols follow a rotated host connection rather than its unrotated box',async()=>{
 const host=device('generic'),[x,y]=point(host,.25,.3),plug={...device('plug',0),kind:'plug',children:[],x:x-5,y:y-5,w:10,h:10,host:{device:host.key,port:'port'}};
 const zip=await unzip(await exportVisio({},[page([host,plug])]).arrayBuffer()),xml=new TextDecoder().decode(zip.get('visio/pages/page1.xml'));
 assert.match(xml,/F="Sheet\.1!PinX\+\(Sheet\.1!Connections.X1-Sheet\.1!LocPinX\)\*COS\(Sheet\.1!Angle\)-\(Sheet\.1!Connections.Y1-Sheet\.1!LocPinY\)\*SIN\(Sheet\.1!Angle\)"/);
});


test('top-level mapped port rectangles and ellipses retain their own angle in PDF and Visio',async()=>{
 for(const type of ['rect','ellipse']){
  const shape={type,x:70,y:80,w:100,h:40,angle:.63,fill:'#B0C4D5',stroke:'none'},p=page([shape]);
  const zip=await unzip(await exportVisio({},[p]).arrayBuffer()),xml=new TextDecoder().decode(zip.get('visio/pages/page1.xml'));
  assert.match(xml,/<Cell N="Angle" V="0.63"\/>/);
  const content=streams(await pdfFor(p));assert.ok(content.includes(Math.cos(.63).toString()),'PDF emits matching rotation matrix');
  if(!missing){const pixel=raster(await pdfFor(p)),[x,y]=point(shape,.2,.5);close(pixel(x-p.originX,y-p.originY),[176,196,213],type+' painted rotated center');}
 }
});
