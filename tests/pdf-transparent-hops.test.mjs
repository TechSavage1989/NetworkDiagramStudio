import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {inflateSync} from 'node:zlib';
import {exportPdf} from '../src/web/report-export.mjs';
import {bridge} from '../src/web/diagram/scene.mjs';

const require=createRequire(import.meta.url),jspdf=require('../src/web/vendor/jspdf.umd.min.js');
const line=(name,points,color,weight=12)=>({type:'path',name,editKey:name,points,color,weight});
const fixture=()=>({name:'PDF crossing',title:'Fictional PDF cable crossing',originX:-20,originY:-30,width:360,height:220,items:[
 {type:'device',x:-20,y:-30,w:360,h:220,asset:{native:{paths:[
  {commands:[['M',0,0],['L',160/360,0],['L',160/360,1],['L',0,1],['Z']],fill:'#B0C4D5',stroke:'none',weight:.001},
  {commands:[['M',160/360,0],['L',1,0],['L',1,1],['L',160/360,1],['Z']],fill:'#D3B6AA',stroke:'none',weight:.001}
 ],texts:[]}}},
 line('under',[[0,90],[320,90]],'#546D79'),line('over',[[160,-10],[160,170]],'#185B68')
]});
async function pdfFor(page){const previous=globalThis.jspdf;globalThis.jspdf=jspdf;try{return await exportPdf([page]);}finally{if(previous===undefined)delete globalThis.jspdf;else globalThis.jspdf=previous;}}
function streams(bytes){
 const buffer=Buffer.from(bytes),text=buffer.toString('latin1'),result=[];
 for(const match of text.matchAll(/<<[^>]*\/Length\s+(\d+)[^>]*>>\s*stream\r?\n/g)){
  const start=match.index+match[0].length,data=buffer.subarray(start,start+Number(match[1]));result.push((/\/FlateDecode/.test(match[0])?inflateSync(data):data).toString('latin1'));
 }
 return result.join('\n');
}
const renderer=process.env.NDS_PDF_RENDERER||'pdftoppm',rendererProbe=spawnSync(renderer,['-v'],{encoding:'utf8'}),rendererMissing=rendererProbe.error?.code==='ENOENT';
function ppm(bytes){
 let offset=0;
 const token=()=>{while(offset<bytes.length){if(bytes[offset]===35){while(offset<bytes.length&&bytes[offset]!==10)offset++;}else if(bytes[offset]<=32)offset++;else break;}const start=offset;while(offset<bytes.length&&bytes[offset]>32&&bytes[offset]!==35)offset++;return bytes.subarray(start,offset).toString('ascii');};
 assert.equal(token(),'P6');const width=Number(token()),height=Number(token());assert.equal(token(),'255');
 // Consume the header delimiter only. A leading image byte can itself be
 // whitespace, so skipping arbitrary whitespace here would shift all pixels.
 assert.ok(bytes[offset]<=32);if(bytes[offset++]===13&&bytes[offset]===10)offset++;
 assert.equal(bytes.length-offset,width*height*3);
 return {width,height,pixel(x,y){assert.ok(x>=0&&x<width&&y>=0&&y<height);const at=offset+(Math.floor(y)*width+Math.floor(x))*3;return [...bytes.subarray(at,at+3)];}};
}
function raster(bytes){
 const folder=mkdtempSync(join(tmpdir(),'nds-pdf-hop-'));
 try{const source=join(folder,'crossing.pdf'),destination=join(folder,'crossing');writeFileSync(source,bytes);const run=spawnSync(renderer,['-r','384','-f','1','-l','1','-singlefile',source,destination],{encoding:'utf8'});assert.equal(run.status,0,run.error?.message||run.stderr||run.stdout);return ppm(readFileSync(destination+'.ppm'));}
 finally{rmSync(folder,{recursive:true,force:true});}
}
const pixel=(image,x,y)=>image.pixel(Math.round(x*4),Math.round(y*4));
function reference(image,x,y,expected,label){
 const actual=pixel(image,x,y),rgb=expected.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16));
 // jsPDF quantizes vector colors when writing their PDF components. Verify
 // the reference has the intended color, then compare clearance pixels to
 // that same PDF's unoccluded fill exactly, without a transparency tolerance.
 assert.ok(actual.every((value,i)=>Math.abs(value-rgb[i])<=2),label+': expected '+expected+', got '+actual.join(','));return actual;
}
function at(image,x,y,expected,label){assert.deepEqual(pixel(image,x,y),expected,label);}
function references(image){return {left:reference(image,40,40,'#B0C4D5','left background'),right:reference(image,220,40,'#D3B6AA','right background'),under:reference(image,40,120,'#546D79','straight lower cable'),over:reference(image,180,40,'#185B68','straight jump-owning cable')};}

test('vector PDF clips other cables at jumps without painting white over native artwork',async()=>{
 const page=fixture();bridge(page);const before=JSON.stringify(page),bytes=await pdfFor(page),content=streams(bytes),pdf=Buffer.from(bytes).toString('latin1');
 assert.equal(JSON.stringify(page),before,'PDF export leaves the accepted scene unchanged');
 assert.match(content,/(?:^|\n)W\*\s+n(?:\s|$)/,'clearance uses an unpainted exclusion clip');
 assert.doesNotMatch(content,/(?:^|\n)(?:1(?:\.0*)? G|1(?:\.0*)? 1(?:\.0*)? 1(?:\.0*)? RG)(?:\s|$)/,'no white stroke erases the artwork');
 assert.equal((content.match(/(?:^|\n)S(?:\s|$)/g)||[]).length,2,'both cables remain vector strokes, without halo strokes');
 assert.ok((content.match(/(?:^|\n)f(?:\s|$)/g)||[]).length>=2,'both native artwork fills remain vector paths');assert.doesNotMatch(pdf,/\/Subtype\s*\/Image/);
 assert.match(content,/(?:^|\n)9(?:\.0*)? w(?:\s|$)/,'12 scene pixels retain a 9 point stroke');assert.match(content,/(?:^|\n)1 j(?:\s|$)/,'cables have round joins');assert.match(content,/(?:^|\n)0 J(?:\s|$)/,'cables have butt caps');
 assert.ok(content.split(/\r?\n/).filter(line=>/\sc\s*$/.test(line)).length>=2,'jump arcs retain vector curve geometry');
});

test('an invisible hop does not add a PDF clearance clip',async()=>{
 const page=fixture();bridge(page);page.items.at(-1).opacity=0;assert.doesNotMatch(streams(await pdfFor(page)),/(?:^|\n)W\*(?:\s|$)/);
});

test('rendered PDF gaps reveal both artwork colors and retain the crest and underlying cable in either draw order',{skip:rendererMissing?'Poppler pdftoppm is unavailable; vector PDF checks still run':false},async()=>{
 for(const early of [false,true]){const page=fixture();bridge(page);if(early)[page.items[1],page.items[2]]=[page.items[2],page.items[1]];
  const image=raster(await pdfFor(page)),ref=references(image);assert.equal(image.width,1440);assert.equal(image.height,880);
  at(image,147,120,ref.left,'left clearance exactly matches left native fill');at(image,161,115,ref.right,'right clearance exactly matches right native fill');
  at(image,154,120,ref.over,'jump crest remains painted');at(image,180,120,ref.under,'line inside the jump remains painted');at(image,142,120,ref.under,'line outside the clearance remains painted');
 }
 const invisible=fixture();bridge(invisible);invisible.items.at(-1).opacity=0;const image=raster(await pdfFor(invisible));at(image,147,120,reference(image,40,120,'#546D79','lower cable'),'invisible jump leaves the underlying cable intact');at(image,180,40,reference(image,220,40,'#D3B6AA','right background'),'invisible jump reveals its exact native background');
});

test('rendered tiny adjacent PDF hops do not reopen overlapping exclusion bands',{skip:rendererMissing?'Poppler pdftoppm is unavailable; vector PDF checks still run':false},async()=>{
 const page=fixture();page.items.splice(2,0,line('nearby',[[0,100],[320,100]],'#546D79'));bridge(page);const owner=page.items.at(-1);assert.equal(owner.commands.filter(command=>command[0]==='A').length,2);
 const image=raster(await pdfFor(page)),ref=references(image);at(image,168.5,120,ref.right,'tight first hop reveals the exact background beyond its crest');at(image,168.5,130,ref.right,'tight second hop reveals the exact background beyond its crest');at(image,175.5,120,ref.over,'first tiny crest remains painted');at(image,175.5,130,ref.over,'second tiny crest remains painted');
});

test('rendered PDF clearance preserves the exact pixels of raster-backed artwork',{skip:rendererMissing?'Poppler pdftoppm is unavailable; vector PDF checks still run':false},async()=>{
 const page=fixture();
 // Authored 9x1 RGB fixture: four left-color pixels, five right-color pixels.
 // Stretching it to the panel gives the same 160/360 split as the vector art.
 page.items[0].asset={dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAABCAIAAACDoBMqAAAAE0lEQVR4nGPYcOQqHF3etgoZAQAc4hQk8w4kMAAAAABJRU5ErkJggg=='};
 bridge(page);const bytes=await pdfFor(page),image=raster(bytes),ref=references(image);assert.match(Buffer.from(bytes).toString('latin1'),/\/Subtype\s*\/Image/);
 assert.deepEqual(ref.left,[176,196,213]);assert.deepEqual(ref.right,[211,182,170]);
 at(image,147,120,ref.left,'left raster pixels survive the clearance exactly');at(image,161,115,ref.right,'right raster pixels survive the clearance exactly');at(image,154,120,ref.over,'raster background does not replace the vector crest');at(image,180,120,ref.under,'lower vector cable remains visible over raster artwork');
});

test('very flat PDF bundle clearance has no antialias seams between adjacent clipping pieces',{skip:rendererMissing?'Poppler pdftoppm is unavailable; vector PDF checks still run':false},async()=>{
 const page=fixture();page.items=[page.items[0],line('flat owner',[[0,90],[320,90]],'#185B68',4),...[80,100,120,140,160].map(x=>line('under '+x,[[x,-10],[x,170]],'#546D79',6))];bridge(page,{style:'bundle'});
 assert.equal(page.items[1].commands.filter(command=>command[0]==='A').length,1);
 const image=raster(await pdfFor(page)),background=reference(image,40,40,'#B0C4D5','unoccluded native background');
 // These 18 exact pixels exposed a real seam when neighboring exclusion
 // pieces merely touched. Their sampled bands must overlap before clipping.
 for(let x=99;x<=101;x+=.25)for(const y of [117,117.25])at(image,x,y,background,'flat clearance seam at '+x+', '+y);
 at(image,140,110,reference(image,40,120,'#185B68','straight owner'),'flat bundle crest remains painted');at(image,100,140,reference(image,100,40,'#546D79','straight lower cable'),'lower cable outside flat clearance remains painted');
});
