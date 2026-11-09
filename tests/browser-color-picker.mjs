// Exercise the real shared picker, including raster thickness rather than
// trusting a stroke-width attribute that could be scaled by its SVG viewBox.
// Uses the same Playwright/browser environment variables as the editor tests.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/color-picker');await mkdir(output,{recursive:true});
const [source,css]=await Promise.all([readFile(new URL('../src/web/color-picker.mjs',import.meta.url),'utf8'),readFile(new URL('../src/web/style.css',import.meta.url),'utf8')]);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1000,height:700},deviceScaleFactor:1}),errors=[],measurements=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.setContent('<style>'+css+'</style><main style="display:block;position:static;width:760px;padding:20px"><label for="width">Line width</label><input id="width" type="number" value="1" min="0.1" step="0.1"><div id="picker"></div><div id="text-picker"></div></main>');
 await page.addScriptTag({type:'module',content:source+'\nwindow.picker=colorPicker(document.querySelector("#picker"),{color:"#000000",width:1});window.unbind=window.picker.bindWidth(document.querySelector("#width"));colorPicker(document.querySelector("#text-picker"),{kind:"text",color:"#17364A"});'});
 await page.waitForFunction(()=>!!window.picker);
 const width=page.getByLabel('Line width',{exact:true}),sample=page.locator('#picker .line-preview svg');
 const paintedWidth=async()=>{
  const png=await sample.screenshot();
  return page.evaluate(async base64=>{const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const {data}=context.getImageData(Math.floor(image.width/2),0,1,image.height);let coverage=0;for(let i=0;i<data.length;i+=4)coverage+=(255-data[i])/255;return coverage;},png.toString('base64'));
 };
 for(const previewWidth of [104,60]){
  await page.locator('#picker .color-choice-row').evaluate((row,w)=>row.style.gridTemplateColumns='88px minmax(100px,1fr) '+w+'px',previewWidth);
  for(const value of [1,5,12.5]){
   await width.fill(String(value));
   const actual=await paintedWidth();measurements.push({previewWidth,value,painted:actual});
   assert.ok(Math.abs(actual-value)<.2,'A '+value+' px line paints '+actual+' px in a '+previewWidth+' px preview');
   assert.equal(await page.evaluate(()=>window.picker.width),value);
   assert.equal(await sample.getAttribute('aria-label'),'Line preview at 100%: '+value+' px');
  }
 }
 // A temporarily empty or invalid width keeps the last valid preview. Width
 // changes must also preserve a partially typed HEX value and its error.
 await width.fill('');assert.equal(await page.evaluate(()=>window.picker.width),12.5);
 await width.fill('-1');assert.equal(await page.evaluate(()=>window.picker.width),12.5);
 const hex=page.locator('#picker').getByLabel('HEX',{exact:true});await hex.fill('#12');await width.fill('3.5');
 assert.equal(await hex.inputValue(),'#12');assert.equal(await hex.getAttribute('aria-invalid'),'true');
 assert.equal(await page.evaluate(()=>window.picker.width),3.5);
 await hex.fill('#2468AC');await page.locator('#picker').getByLabel('Line opacity (%)',{exact:true}).fill('40');
 assert.equal(await sample.locator('path').getAttribute('stroke'),'#2468AC');assert.equal(await sample.locator('path').getAttribute('stroke-opacity'),'0.4');
 await width.fill('7');assert.equal(await sample.locator('path').getAttribute('stroke'),'#2468AC');assert.equal(await sample.locator('path').getAttribute('stroke-opacity'),'0.4');
 // Programmatic updates and unbinding are used when the selected object or
 // link class changes, without replacing the other draft controls.
 await page.evaluate(()=>{window.picker.width=2.25;window.unbind();});await width.fill('11');
 assert.equal(await page.evaluate(()=>window.picker.width),2.25);
 assert.equal(await page.locator('#text-picker .line-preview svg text').getAttribute('fill'),'#17364A');
 assert.equal(await page.locator('#text-picker .color-opacity').count(),0);
 assert.deepEqual(errors,[]);await page.screenshot({path:resolve(output,'line-preview.png')});
 await writeFile(resolve(output,'results.json'),JSON.stringify({measurements,errors},null,2));console.log(JSON.stringify({measurements,errors},null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});throw error;}finally{await browser.close();}
