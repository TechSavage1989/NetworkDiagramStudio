// Actual built-app page controls and export validation, with fictional data only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {adaptiveProject} from './fixtures/adaptive-port-maps.mjs';
import {standardMapDevices} from './fixtures/standard-port-maps.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/adaptive-port-map');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 for(const members of [5,8,'chassis']){
  const project=adaptiveProject('a4','landscape',members==='chassis'?5:members);
  if(members==='chassis')project.devices=[standardMapDevices()[0]];
  await page.locator('#project-file').setInputFiles({name:'fictional.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}))});
  await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent?.includes('Project opened'));
  const picker=page.locator('#page-select'),choice=await picker.locator('option').evaluateAll(options=>options.find(o=>o.textContent.includes('LAB-')&&!o.textContent.includes('Inventory'))?.value);
  assert.ok(choice!=null,'map available in page picker');await picker.selectOption(choice);
  await page.waitForFunction(()=>document.querySelector('#canvas svg [data-drawing-key*="|group|"]'));
  const dimensions=()=>page.locator('#canvas svg').evaluate(svg=>[svg.viewBox.baseVal.width,svg.viewBox.baseVal.height]);
  const original=await dimensions();assert.ok(Math.abs(original[0]/original[1]-297/210)<1e-6);
  const bodies=await page.locator('#canvas svg [data-drawing-key$="|body"][data-drawing-key*="|group|"]').evaluateAll(elements=>elements.map(e=>({x:Number(e.getAttribute('x')),y:Number(e.getAttribute('y')),w:Number(e.getAttribute('width'))})));
  assert.equal(bodies.length,members==='chassis'?6:members);assert.equal(new Set(bodies.map(b=>Math.round(b.x))).size,members==='chassis'?2:1);
  if(members!==8){const left=Math.min(...bodies.map(b=>b.x)),right=Math.max(...bodies.map(b=>b.x+b.w));assert.ok((right-left)/original[0]>.94,'use spare page width for the bank');}
  await page.screenshot({path:resolve(output,'adaptive-'+members+'-a4.png')});
  await page.locator('#page-options').click();const dialog=page.locator('#dialog');
  await dialog.getByLabel('Visible page proportions',{exact:true}).selectOption('letter');
  await dialog.getByLabel('Page orientation',{exact:true}).selectOption('landscape');
  await dialog.getByRole('button',{name:'Apply paper settings'}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
  const letter=await dimensions();assert.ok(Math.abs(letter[0]/letter[1]-11/8.5)<1e-6);assert.notDeepEqual(letter,original);
  await page.screenshot({path:resolve(output,'adaptive-'+members+'-letter.png')});
  // Native browser undo restores the accepted paper, and redo reapplies it.
  await page.keyboard.press('Control+z');await page.waitForFunction(()=>{const b=document.querySelector('#canvas svg').viewBox.baseVal;return Math.abs(b.width/b.height-297/210)<1e-6;});
  await page.keyboard.press('Control+Shift+z');await page.waitForFunction(()=>{const b=document.querySelector('#canvas svg').viewBox.baseVal;return Math.abs(b.width/b.height-11/8.5)<1e-6;});
  // Locking fixes the sheet, not a second blank border around a measured map.
  await page.locator('#page-options').click();
  await dialog.getByLabel('Lock physical page size',{exact:true}).check();
  await dialog.getByRole('button',{name:'Apply paper settings'}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
  const edgeHeader=await page.locator('#canvas svg').evaluate(svg=>{
   const b=svg.viewBox.baseVal;
   return [...svg.querySelectorAll('rect')].some(r=>Math.abs(+r.getAttribute('x')-b.x)<.01&&Math.abs(+r.getAttribute('y')-b.y)<.01&&Math.abs(+r.getAttribute('width')-b.width)<.01&&r.getAttribute('fill')==='#203746');
  });
  assert.ok(edgeHeader,'locked Auto-fit header should reach both paper edges');
  await page.screenshot({path:resolve(output,'adaptive-'+members+'-letter-locked.png')});
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'result.json'),JSON.stringify({ok:true,checks:['five/eight-member and chassis A4','slim gutters and enlarged banks','Letter reflow','locked full-width header','one-column order','Undo/redo','built offline app']},null,2));
}finally{await browser.close();}
