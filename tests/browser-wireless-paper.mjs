// Real-browser regression for wireless paper: choosing Letter with the normal
// page-size control on a dense, fictional two-stack site must give a few
// readable sheets (not one AP per page), survive undo/redo and save/reopen,
// print every sheet on Letter, and let a locked page take a manual off-page move.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {wirelessTwoStackSite} from './fixtures/wireless-two-stack.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/wireless-paper');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[],result={};
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
const open=async(name,project)=>{const file=resolve(output,name);await writeFile(file,JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}));await page.locator('#project-file').setInputFiles(file);await page.waitForFunction(()=>/opened|loaded/i.test(document.querySelector('#feedback')?.textContent||''),null,{timeout:120000});await page.waitForSelector('#canvas svg');};
const wirelessGroup=()=>page.locator('#page-families .page-group').filter({hasText:/Wireless connections/i}).first();
const wirelessCount=async()=>Number((await wirelessGroup().locator('summary').textContent()).match(/\((\d+)\)/)?.[1]||0);
const goTo=async name=>{const value=await page.locator('#page-select option').evaluateAll((options,name)=>options.find(o=>o.textContent.trim().startsWith(name))?.value,name);assert.ok(value!=null,name+' is listed');await page.locator('#page-select').selectOption(value);await page.waitForFunction(name=>document.querySelector('#canvas svg')?.getAttribute('aria-label')?.startsWith(name),name);};
// Printed point size of the smallest AP caption on the visible sheet.
const apPoints=()=>page.locator('#canvas svg').evaluate(svg=>{const width=Number(svg.getAttribute('viewBox').split(/\s+/)[2]),paper=Number(svg.dataset.paperWidth||0),texts=[...svg.querySelectorAll('text[data-drawing-key]')].filter(t=>/^Wireless Connections\|(title|register|detail|model|mac)\|/.test(t.dataset.drawingKey));return {count:texts.length,min:Math.min(...texts.map(t=>Number(t.getAttribute('font-size')))),width,paper};});
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 await open('two-stack-dynamic.nds.json',wirelessTwoStackSite());
 result.dynamicSheets=await wirelessCount();assert.equal(result.dynamicSheets,2,'dynamic paper: one sheet per stack');
 await goTo('Wireless Connections 1');
 // The normal quick page-size control, as a user would choose Letter.
 const started=Date.now();await page.locator('#active-page-paper').selectOption('letter');
 await page.waitForFunction(()=>document.getElementById('active-page-paper').value==='letter'&&/Wireless connections \((\d+)\)/i.test(document.querySelector('#page-families')?.textContent||'')&&!/Wireless connections \(2\)/i.test(document.querySelector('#page-families').textContent),null,{timeout:180000});
 result.letterSeconds=(Date.now()-started)/1000;result.letterSheets=await wirelessCount();
 assert.ok(result.letterSheets>=2&&result.letterSheets<=4,'Letter gives a few readable sheets, not '+result.letterSheets);
 for(let n=1;n<=result.letterSheets;n++){
  await goTo('Wireless Connections '+n);const m=await apPoints();assert.ok(m.count>=20,'sheet '+n+' carries its AP cards');
  // Every sheet is Letter landscape (11 in = 1056 physical px wide).
  const pt=m.min*1056/m.width*.75;(result.apPoints||=[]).push(Number(pt.toFixed(2)));assert.ok(pt>=7.95,'sheet '+n+' AP text prints at '+pt.toFixed(2)+' pt');
  await page.locator('#zoom-fit').click();await page.screenshot({path:resolve(output,'letter-sheet-'+n+'.png')});
 }
 // Continuation sheets show the Letter paper they inherit from the plan.
 result.continuationPaper=await page.locator('#active-page-paper').inputValue();
 // One undo returns to the dynamic layout; redo restores the Letter plan.
 await goTo('Wireless Connections 1');await page.locator('#canvas').click({position:{x:8,y:8}});await page.keyboard.press('Control+z');
 await page.waitForFunction(()=>document.getElementById('active-page-paper').value==='dynamic',null,{timeout:180000});assert.equal(await wirelessCount(),2,'undo restores the dynamic sheets');
 await page.keyboard.press('Control+Shift+Z');await page.waitForFunction(()=>document.getElementById('active-page-paper').value==='letter',null,{timeout:180000});assert.equal(await wirelessCount(),result.letterSheets,'redo restores the Letter plan');
 // Save and reopen keep the same plan.
 const waiting=page.waitForEvent('download');await page.locator('#save').click();const saved=resolve(output,'two-stack-letter.nds.json');await (await waiting).saveAs(saved);
 const reopened=JSON.parse(await readFile(saved,'utf8')).project;await open('two-stack-letter-reopened.nds.json',reopened);assert.equal(await wirelessCount(),result.letterSheets,'reopened project keeps its sheets');
 // Print: every wireless sheet is a Letter page in the print set.
 await page.evaluate(()=>{window.print=()=>{};});await page.locator('#print').click();
 result.printSheets=await page.locator('#print-set > section').evaluateAll(sections=>sections.filter(s=>/^Wireless Connections/.test(s.querySelector('svg')?.getAttribute('aria-label')||'')).length);assert.equal(result.printSheets,result.letterSheets);
 const pageCss=await page.locator('#print-page-sizes').textContent();assert.ok(/size:279\.4000mm 215\.9000mm/.test(pageCss),'Letter page boxes are printed');
 await page.pdf({path:resolve(output,'two-stack-letter.pdf'),preferCSSPageSize:true,printBackground:true});
 // A locked Letter page still accepts a deliberate move past its edge.
 const locked=wirelessTwoStackSite({preset:'letter',fit:'adaptive',locked:true});await open('two-stack-locked.nds.json',locked);await goTo('Wireless Connections 1');
 await page.locator('#edit-drawing').click();const ap=page.locator('#canvas svg [data-drawing-key*="|device|ap2-16|"]').first();
 // Start on verified AP artwork after the edit toolbars' layout has settled, so
 // the press grabs the AP rather than starting a box selection on the background.
 const start=await page.evaluate(async()=>{await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));const group=document.querySelector('#canvas svg [data-device-id="ap2-16"]')||document.querySelector('#canvas svg [data-drawing-key*="|device|ap2-16|"]'),b=group.getBoundingClientRect();for(const fx of [.5,.35,.65,.2,.8])for(const fy of [.5,.35,.65,.2,.8]){const x=b.x+b.width*fx,y=b.y+b.height*fy,hit=document.elementFromPoint(x,y);if(hit&&group.contains(hit)&&!hit.closest('text'))return {x,y};}return {error:'No visible AP artwork',bounds:{x:b.x,y:b.y,w:b.width,h:b.height},hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.outerHTML.slice(0,160)};});
 assert.ok(!start.error,'AP drag start: '+JSON.stringify(start));const box=await ap.boundingBox(),canvas=await page.locator('#canvas').boundingBox();
 await page.mouse.move(start.x,start.y);await page.mouse.down();for(let i=1;i<=12;i++)await page.mouse.move(start.x+i*((canvas.x+canvas.width-4-start.x)/12),start.y);await page.mouse.up();
 await page.waitForFunction(()=>/moved/i.test(document.querySelector('#feedback').textContent),null,{timeout:120000});
 const moved=await ap.boundingBox(),sheet=await page.locator('#canvas svg > rect').first().boundingBox();result.offPage=moved.x+moved.width>sheet.x+sheet.width;assert.ok(moved.x>box.x+20,'the locked page accepted the manual move');
 await page.screenshot({path:resolve(output,'locked-manual-move.png')});
 assert.deepEqual(errors,[]);result.errors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error(error);console.error('Browser errors:',errors);console.error('Status:',await page.locator('#feedback').textContent());process.exitCode=1;}finally{await browser.close();}
