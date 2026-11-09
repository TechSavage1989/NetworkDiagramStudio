// Synthetic direct-edit coverage for hosted Chromium/Edge.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/direct-transforms');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 await page.locator('#sample').click();await page.waitForSelector('#canvas svg');await page.locator('#edit-drawing').click();
 const text=page.locator('#canvas text[data-drawing-key]').filter({hasText:'Harbor Workshop'}).first();await text.click();
 assert.equal(await page.locator('#quick-text-tools').isVisible(),true);assert.equal(await page.locator('[data-transform]').count(),5);
 const key=await text.getAttribute('data-drawing-key');await page.locator('#quick-text-angle').fill('15');await page.locator('#quick-text-angle').press('Tab');
 await page.waitForFunction(key=>[...document.querySelectorAll('#canvas text')].find(n=>n.dataset.drawingKey===key)?.getAttribute('transform')?.includes('rotate(-15'),key);
 await page.locator('#quick-text-edit').click();await page.locator('[data-inline-editor] textarea').fill('Fictional direct editing');await page.keyboard.press('Enter');
 await page.waitForSelector('[data-inline-editor]',{state:'detached'});
 const handle=page.locator('[data-transform="se"]'),box=await handle.boundingBox();assert.ok(box);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+10,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();
 assert.equal(await page.locator('[data-transform]').count(),5);
 await page.locator('#quick-text-angle').fill('0');await page.locator('#quick-text-angle').press('Tab');
 const after=await page.locator('[data-transform="se"]').boundingBox();await page.mouse.move(after.x+after.width/2,after.y+after.height/2);await page.mouse.down();await page.mouse.move(after.x+after.width/2+35,after.y+after.height/2+8,{steps:5});await page.mouse.up();
 await page.screenshot({path:resolve(output,'direct-transforms.png')});
 const waiting=page.waitForEvent('download');await page.locator('#save').click();const file=await waiting,path=resolve(output,'direct.nds');await file.saveAs(path);
 const saved=JSON.parse(await readFile(path,'utf8'));assert.equal(saved.project.layout.drawingEdits[key].value,'Fictional direct editing');assert.equal(saved.project.layout.drawingEdits[key].angle,0);assert.ok(saved.project.layout.drawingEdits[key].w>0);
 await page.locator('#drawing-undo').click();await page.locator('#drawing-redo').click();assert.deepEqual(errors,[]);
 console.log('Direct text toolbar, arbitrary angle, inline content, transform cancel/resize, persistence and undo/redo passed.');
}finally{await browser.close();}
