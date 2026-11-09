// Run with the existing Playwright installation. NDS_PDF_RENDERER may point to
// pdftoppm to additionally inspect real printed PDF pixels at 384 dpi.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {bridge,svgPage} from '../src/web/diagram/scene.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'dist/qa-transparent-hops');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const colors={left:[176,196,213],right:[211,182,170],under:[84,109,121],over:[24,91,104]},samples=[['left clearance',147,120,'left'],['right clearance',160,120,'right'],['jump crest',154,120,'over'],['underpass inside jump',180,120,'under'],['continuous underpass',142,120,'under'],['continuous jumping cable',180,40,'over']];
const fixture=(dataUrl=null,offset=0)=>({name:'Crossing',title:'Fictional cable crossing',width:360,height:220,originX:-20,originY:-30,items:[
 {type:'device',editKey:'artwork',name:'Fictional two-tone panel',x:-20,y:-30,w:360,h:220,asset:dataUrl?{dataUrl}:null,children:[
  {type:'rect',x:0,y:0,w:1,h:1,fill:'#B0C4D5',stroke:'none',weight:0},
  {type:'rect',x:160/360,y:0,w:200/360,h:1,fill:'#D3B6AA',stroke:'none',weight:0}
 ]},
 {type:'path',editKey:'under',name:'Underpassing cable',points:[[0,90],[320,90]],color:'#546D79',weight:12},
 {type:'path',editKey:'over',name:'Jumping cable',points:[[160+offset,-10],[160+offset,170]],color:'#185B68',weight:12}
]});
async function pixels(bytes,scale=4){return page.evaluate(async({data,scale,samples})=>{
 const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);
 return samples.map(([name,x,y,color])=>({name,color,rgb:[...context.getImageData(Math.floor(x*scale+scale/2),Math.floor(y*scale+scale/2),1,1).data].slice(0,3)}));
},{data:bytes.toString('base64'),scale,samples});}
function check(values){for(const value of values)assert.deepEqual(value.rgb,colors[value.color],value.name+' must retain the actual artwork or cable color');}
const result={};
try{
 const raster=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=360;c.height=220;const g=c.getContext('2d');g.fillStyle='#B0C4D5';g.fillRect(0,0,360,220);g.fillStyle='#D3B6AA';g.fillRect(160,0,200,220);return c.toDataURL();});
 for(const [name,data] of [['native',null],['raster',raster]]){
  const scene=fixture(data);bridge(scene);const svg=svgPage(scene);
  await page.setContent('<style>body{margin:0}svg{display:block;width:1440px;height:880px}</style>'+svg);
  const png=await page.locator('svg').screenshot({path:resolve(output,name+'-hop-clearance.png')});const values=await pixels(png);check(values);result[name]=values;
  await writeFile(resolve(output,name+'-hop-clearance.svg'),svg);
 }
 // Printed pages share one DOM. A different same-named scene must not reuse
 // the first scene's masks; inspect the second page before and after printing.
 const first=fixture(null,30),second=fixture(raster);bridge(first);bridge(second);
 await page.setContent('<style>body{margin:0}svg{display:block;width:360px;height:220px;break-after:page}svg:last-child{break-after:auto}@page{size:360px 220px;margin:0}</style>'+svgPage(first)+svgPage(second));
 const inline=await page.locator('svg').nth(1).screenshot({scale:'css'});check(await pixels(inline,1));result.multiPageInline=true;
 const pdfPath=resolve(output,'hop-clearance.pdf');await page.pdf({path:pdfPath,preferCSSPageSize:true,printBackground:true});result.pdfCreated=true;
 if(process.env.NDS_PDF_RENDERER){
  const stem=resolve(output,'printed-hop');execFileSync(process.env.NDS_PDF_RENDERER,['-f','2','-singlefile','-r','384','-png',pdfPath,stem],{stdio:'pipe'});
  const values=await pixels(await readFile(stem+'.png'));check(values);result.pdfPixels=values;
 }
 assert.deepEqual(errors,[]);result.errors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});throw error;}finally{await browser.close();}
