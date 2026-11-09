import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {labelBackingItems} from '../src/web/diagram/label-backings.mjs';
import {svgPage} from '../src/web/diagram/scene.mjs';
import {exportPdf} from '../src/web/report-export.mjs';
import {exportVisio} from '../src/web/diagram/visio.mjs';
import {unzip} from '../src/web/zip.mjs';
const require=createRequire(import.meta.url),jspdf=require('../src/web/vendor/jspdf.umd.min.js');
const path=(name,points,color,linkId)=>({type:'path',name,editKey:name,points,commands:points.map((p,n)=>[n?'L':'M',...p]),color,weight:8,linkId,linkType:'Fictional link'});
function fixture(rotated=false,late=false){
 const own=path('own',rotated?[[160,20],[160,200]]:[[20,110],[300,110]],'#164878',0);
 const other=path('other',rotated?[[20,60],[300,60]]:[[100,20],[100,200]],'#B03040',1);
 const text={type:'text',x:80,y:90,w:160,h:40,size:16,value:'1',color:'#000000',align:'center',background:'#FFFFFF',angle:rotated?Math.PI/2:0,linkId:0,relatedCableKey:'own',editKey:'caption'};
 const art={type:'rect',x:0,y:0,w:320,h:220,fill:'#AABBCD',stroke:'none',weight:1};
 return {name:'Backing regression',title:'Fictional label overlap',width:320,height:220,items:late?[art,own,text,other]:[art,own,other,text]};
}
const fills=items=>items.filter(i=>i.name==='Caption backing');
function contains(item,x,y){
 const points=item.commands.filter(c=>c.length===3).map(c=>c.slice(1));let sign=0;
 for(let n=0;n<points.length;n++){const a=points[n],b=points[(n+1)%points.length],cross=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(Math.abs(cross)<1e-8)continue;const next=Math.sign(cross);if(sign&&sign!==next)return false;sign=next;}
 return true;
}
test('backings leave unrelated thick strokes clear without changing scene, cable order, or caption text',()=>{
 for(const rotated of [false,true])for(const late of [false,true]){
  const page=fixture(rotated,late),before=JSON.stringify(page),items=labelBackingItems(page.items),backings=fills(items);
  assert.equal(JSON.stringify(page),before);assert.ok(backings.length>=2);
  assert.deepEqual(items.filter(i=>i.type==='path'),page.items.filter(i=>i.type==='path'));
  assert.equal(items.find(i=>i.editKey==='caption').background,undefined);
  assert.ok(!backings.some(i=>contains(i,...(rotated?[146,60]:[100,96]))));
  assert.ok(backings.some(i=>contains(i,...(rotated?[160,85]:[130,110]))),'own cable remains backed');
 }
});
test('backing clearance handles arcs, arbitrary rotation, missing associations and invisible paths',()=>{
 const page=fixture(),caption=page.items.at(-1),other=page.items[2];
 other.commands=[['M',100,20],['L',100,90],['A',112,102,100,114],['L',100,200]];
 for(const angle of [0,.3,Math.PI/2]){
  caption.angle=angle;const backings=fills(labelBackingItems(page.items));
  assert.ok(!backings.some(i=>contains(i,112,102)),'jump apex stays exposed');
 }
 caption.angle=0;other.opacity=0;assert.equal(fills(labelBackingItems(page.items)).length,1);
 delete caption.relatedCableKey;assert.equal(fills(labelBackingItems(page.items)).length,1,'link ID zero is a valid association');
 delete caption.linkId;assert.ok(!fills(labelBackingItems(page.items)).some(i=>contains(i,130,110)),'unknown ownership never hides a cable');
});
test('SVG and native Visio emit matching cutouts while native backing stays inside the editable text shape',async()=>{
 for(const rotated of [false,true]){
  const page=fixture(rotated),svg=svgPage(page),parts=await unzip(await exportVisio({},[page]).arrayBuffer()),xml=new TextDecoder().decode(parts.get('visio/pages/page1.xml'));
  const count=fills(labelBackingItems(page.items)).length;
  assert.equal((svg.match(/<title>Caption backing<\/title>/g)||[]).length,count);
  assert.equal((xml.match(/Name="Caption backing"/g)||[]).length,0,'native backing stays attached to the text shape');
  assert.equal((svg.match(/class="diagram-cable"/g)||[]).length,2,'no duplicate cable overlays');
  const shapes=xml.match(/<Shape\b[^>]*>[\s\S]*?<\/Shape>/g),caption=shapes.find(s=>s.includes('<Text>'));
  assert.match(caption,/<Cell N="FillPattern" V="1"\/>/);
  assert.equal((caption.match(/T="MoveTo"/g)||[]).length,count,'native text geometry has the same cutouts');
  const geometry=caption.match(/<Section N="Geometry"[^>]*>([\s\S]*?)<\/Section>/)[1],rows=[...geometry.matchAll(/<Row[^>]*>([\s\S]*?)<\/Row>/g)];
  const label=labelBackingItems(page.items,{nativeText:true}).find(i=>i.editKey==='caption');
  const expected=label.backingPieces.flatMap(({x,y,w,h})=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]);
  rows.forEach((row,n)=>{const x=Number(row[1].match(/N="X" V="([^"]+)"/)[1])*96,y=label.h-Number(row[1].match(/N="Y" V="([^"]+)"/)[1])*96;assert.ok(Math.abs(x-expected[n][0])<.001&&Math.abs(y-expected[n][1])<.001,'native backing geometry matches shared cutouts');});
  assert.match(caption,/<Cell N="HorzAlign" V="1"\/>/);
  assert.equal((xml.match(/NameU="Connector\./g)||[]).length,2);
 }
});
function shift(page){
 return {...page,originX:-20,originY:-30,items:page.items.map(i=>({...i,...(Number.isFinite(i.x)?{x:i.x-20,y:i.y-30}:{}),...(i.points?{points:i.points.map(([x,y])=>[x-20,y-30]),commands:i.commands.map(([op,...coords])=>[op,...coords.map((v,n)=>v-(n%2?30:20))])}:{})}))};
}
test('negative-origin native pages normalize backing cutouts and connectors together',async()=>{
 const page=fixture();page.items.at(-1).angle=.3;
 const xml=async p=>new TextDecoder().decode((await unzip(await exportVisio({},[p]).arrayBuffer())).get('visio/pages/page1.xml'));
 assert.equal(await xml(page),await xml(shift(page)));
});
function ppm(bytes){
 let offset=0;const token=()=>{while(bytes[offset]<=32)offset++;const start=offset;while(bytes[offset]>32)offset++;return bytes.subarray(start,offset).toString();};
 assert.equal(token(),'P6');const w=Number(token()),h=Number(token());assert.equal(token(),'255');offset++;assert.equal(bytes.length-offset,w*h*3);
 return (x,y)=>[...bytes.subarray(offset+(y*w+x)*3,offset+(y*w+x)*3+3)];
}
const available=name=>!spawnSync(name,['--version'],{encoding:'utf8'}).error;
for(const kind of ['PDF','SVG'])test('actual '+kind+' render keeps unrelated cables visible and own cable backed in either paint order',{skip:!available('pdftoppm')||(kind==='SVG'&&!available('inkscape'))?'Required external renderer unavailable':false},async()=>{
 const folder=mkdtempSync(join(tmpdir(),'nds-backing-'));
 try{for(const mode of ['horizontal','vertical','oblique','hop','negative','tight','roomy','transparent'])for(const late of [false,true]){
  const rotated=mode==='vertical';let page=fixture(rotated,late);const label=page.items.find(i=>i.type==='text'),other=page.items.find(i=>i.editKey==='other');
  if(mode==='oblique')label.angle=.3;
  if(mode==='hop')other.commands=[['M',100,20],['L',100,90],['A',112,102,100,114],['L',100,200]];
  if(mode==='negative')page=shift(page);
  if(['tight','roomy','transparent'].includes(mode)){label.labelRole='port';page.labelBacking={padding:mode==='tight'?.5:20,mode:mode==='transparent'?'transparent':'white'};}
  const source=join(folder,'page.pdf');
  if(kind==='SVG'){
   const svg=join(folder,'page.svg');writeFileSync(svg,svgPage(page));
   const run=spawnSync('inkscape',[svg,'--export-type=pdf','--export-filename='+source],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  }else{
   const previous=globalThis.jspdf;globalThis.jspdf=jspdf;try{writeFileSync(source,await exportPdf([page]));}finally{if(previous===undefined)delete globalThis.jspdf;else globalThis.jspdf=previous;}
  }
  const dest=join(folder,'render'),run=spawnSync('pdftoppm',['-r','96','-singlefile',source,dest],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const pixel=ppm(readFileSync(dest+'.ppm'));
  const near=(point,rgb)=>assert.ok(pixel(...point).every((v,n)=>Math.abs(v-rgb[n])<=2),kind+' '+point+': '+pixel(...point));
  near(rotated?[146,60]:mode==='hop'?[112,102]:mode==='oblique'?[100,120]:[100,96],[176,48,64]);
  if(mode==='hop')near([102,102],[170,187,205]);
  if(['tight','roomy','transparent'].includes(mode))near([140,110],mode==='roomy'?[255,255,255]:[22,72,120]);
  else near(rotated?[160,85]:[130,110],[255,255,255]);
  near([10,10],[170,187,205]);
  near(rotated?[160,25]:[25,110],[22,72,120]);
 }}finally{rmSync(folder,{recursive:true,force:true});}
});
