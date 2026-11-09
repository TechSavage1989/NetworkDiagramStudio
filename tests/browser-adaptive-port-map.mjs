// Actual built-app page controls and export validation, with fictional data only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {adaptiveProject} from './fixtures/adaptive-port-maps.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/adaptive-port-map');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 for(const members of [5,8]){
  const project=adaptiveProject('a4','landscape',members);
  await page.locator('#project-file').setInputFiles({name:'fictional.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}))});
  await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent?.includes('Project opened'));
  const picker=page.locator('#page-select'),choice=await picker.locator('option').evaluateAll(options=>options.find(o=>o.textContent.includes('LAB-')&&!o.textContent.includes('Inventory'))?.value);
  assert.ok(choice!=null,'map available in page picker');await picker.selectOption(choice);
  await page.waitForFunction(()=>document.querySelector('#canvas svg [data-drawing-key*="|group|"]'));
  const dimensions=()=>page.locator('#canvas svg').evaluate(svg=>[svg.viewBox.baseVal.width,svg.viewBox.baseVal.height]);
  const original=await dimensions();assert.ok(Math.abs(original[0]/original[1]-297/210)<1e-6);
  const bodies=await page.locator('#canvas svg [data-drawing-key$="|body"][data-drawing-key*="|group|"]').evaluateAll(elements=>elements.map(e=>({x:Number(e.getAttribute('x')),y:Number(e.getAttribute('y'))})));
  assert.equal(bodies.length,members);assert.equal(new Set(bodies.map(b=>Math.round(b.x))).size,1);
  await page.screenshot({path:resolve(output,'adaptive-'+members+'-a4.png')});
  await page.locator('#page-options').click();const dialog=page.locator('#dialog');
  await dialog.getByLabel('Visible page proportions',{exact:true}).selectOption('letter');
  await dialog.getByLabel('Page orientation',{exact:true}).selectOption('landscape');
  await dialog.getByRole('button',{name:'Save page options'}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
  const letter=await dimensions();assert.ok(Math.abs(letter[0]/letter[1]-11/8.5)<1e-6);assert.notDeepEqual(letter,original);
  await page.screenshot({path:resolve(output,'adaptive-'+members+'-letter.png')});
  // Native browser undo restores the accepted paper, and redo reapplies it.
  await page.keyboard.press('Control+z');await page.waitForFunction(()=>{const b=document.querySelector('#canvas svg').viewBox.baseVal;return Math.abs(b.width/b.height-297/210)<1e-6;});
  await page.keyboard.press('Control+Shift+z');await page.waitForFunction(()=>{const b=document.querySelector('#canvas svg').viewBox.baseVal;return Math.abs(b.width/b.height-11/8.5)<1e-6;});
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'result.json'),JSON.stringify({ok:true,checks:['five/eight-member A4','Letter reflow','one-column order','Undo/redo','built offline app']},null,2));
}finally{await browser.close();}
