import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rotationProject} from './fixtures/device-rotation.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/device-rotation');await mkdir(output,{recursive:true});
const fixture=resolve(output,'rotation.nds.json');await writeFile(fixture,JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:rotationProject()}));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const device=()=>page.locator('#canvas g[data-device-id="a"][data-drawing-key$="|body"]');
const settle=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);await page.locator('#project-file').setInputFiles(fixture);await device().waitFor();await page.locator('#edit-drawing').click();await page.locator('#zoom-fit').click();await settle();
 const at=await device().evaluate(g=>{const b=g.querySelector('path').getBoundingClientRect();return {x:b.x+b.width*.1,y:b.y+b.height*.8};});await page.mouse.click(at.x,at.y);
 assert.equal(await page.locator('#device-transform-tools').isVisible(),true);assert.equal(await page.locator('#quick-text-tools').isVisible(),false);assert.equal(await page.locator('[data-transform="rotate"]').count(),1);
 await page.locator('#device-angle').fill('30');await page.locator('#device-angle').press('Tab');await page.waitForFunction(()=>document.querySelector('#canvas g[data-device-id="a"][data-drawing-key$="|body"]')?.getAttribute('transform')?.includes('rotate(-30'));
 const glued=await page.evaluate(()=>{const g=document.querySelector('#canvas g[data-device-id="a"][data-drawing-key$="|body"]'),b=g.querySelector('path').getBBox(),anchor=new DOMPoint(b.x+b.width*.25,b.y+b.height*.5).matrixTransform(g.transform.baseVal.consolidate().matrix),line=document.querySelector('#canvas path.diagram-cable'),end=line.getPointAtLength(0);return Math.hypot(anchor.x-end.x,anchor.y-end.y);});assert.ok(glued<.03,'The cable remains on the rotated physical socket');
 await page.locator('#drawing-undo').click();assert.equal(await device().getAttribute('transform'),null);await page.locator('#drawing-redo').click();assert.match(await device().getAttribute('transform'),/rotate\(-30 /);
 const handle=page.locator('[data-transform="rotate"]');await settle();const point=await handle.evaluate(n=>{const b=n.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;if(document.elementFromPoint(x,y)!==n)throw Error('Rotation handle is not reachable');return {x,y};});
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+20,point.y+10,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();assert.match(await device().getAttribute('transform'),/rotate\(-30 /);
 await page.locator('#device-angle').fill('90');await page.locator('#device-angle').press('Tab');await page.waitForFunction(()=>document.querySelector('#device-angle').value==='90'&&document.querySelector('#canvas g[data-device-id="a"][data-drawing-key$="|body"]')?.getAttribute('transform')?.includes('rotate(-90'));
 await page.screenshot({path:resolve(output,'device-rotation.png')});
 const wait=page.waitForEvent('download');await page.locator('#save').click();const download=await wait,saved=resolve(output,'rotated.nds.json');await download.saveAs(saved);const doc=JSON.parse(await readFile(saved,'utf8'));assert.ok(Object.values(doc.project.layout.drawingEdits).some(p=>Math.abs(p.angle-Math.PI/2)<1e-9));
 await page.locator('#project-file').setInputFiles(saved);await device().waitFor();assert.match(await device().getAttribute('transform'),/rotate\(-90 /);assert.deepEqual(errors,[]);
 console.log('Device numeric rotation, glued physical port, Undo/Redo, gesture cancellation, save/reopen and screenshot passed.');
}finally{await browser.close();}
