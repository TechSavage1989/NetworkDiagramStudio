// Synthetic direct-edit coverage for hosted Chromium/Edge.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/direct-transforms');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const errors=[];
const freshPage=async()=>{const p=await browser.newPage({viewport:{width:1500,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('dialog',dialog=>dialog.accept());await p.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);return p;};
let page=await freshPage();
const settled=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
try{
 await page.locator('#sample').click();await page.waitForSelector('#canvas svg');await page.locator('#edit-drawing').click();
 const text=page.locator('#canvas text[data-drawing-key]').filter({hasText:'Harbor Workshop'}).first();await text.click();
 assert.equal(await page.locator('#quick-text-tools').isVisible(),true);assert.equal(await page.locator('[data-transform]').count(),5);
 const key=await text.getAttribute('data-drawing-key');await page.locator('#quick-text-angle').fill('15');await page.locator('#quick-text-angle').press('Tab');
 await page.waitForFunction(key=>[...document.querySelectorAll('#canvas text')].find(n=>n.dataset.drawingKey===key)?.getAttribute('transform')?.includes('rotate(-15'),key);
 await page.locator('#quick-text-edit').click();await page.locator('[data-inline-editor] textarea').fill('Fictional direct editing');await page.keyboard.press('Enter');
 await page.waitForSelector('[data-inline-editor]',{state:'detached'});
 const handle=page.locator('[data-transform="se"]');
 const handlePoint=async()=>{await page.waitForFunction(()=>{const n=document.querySelector('[data-transform="se"]');if(!n)return false;const b=n.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===n;});const b=await handle.boundingBox();assert.ok(b);return {x:b.x+b.width/2,y:b.y+b.height/2};};
 const start=await handlePoint(),box={x:start.x,y:start.y,width:0,height:0};
 assert.ok(await page.locator('#quick-text-tools').evaluate(n=>n.getBoundingClientRect().height<70),'Text tools must remain compact');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+10,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();
 assert.equal(await page.locator('[data-transform]').count(),5);
 await page.locator('#quick-text-angle').fill('0');await page.locator('#quick-text-angle').press('Tab');
 const point=await handlePoint(),after={x:point.x,y:point.y,width:0,height:0};await page.mouse.move(after.x+after.width/2,after.y+after.height/2);await page.mouse.down();await page.mouse.move(after.x+after.width/2+35,after.y+after.height/2+8,{steps:5});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent.includes('Item resized.'));
 await page.screenshot({path:resolve(output,'direct-transforms.png')});
 const waiting=page.waitForEvent('download');await page.locator('#save').click();const file=await waiting,path=resolve(output,'direct.nds');await file.saveAs(path);
 const saved=JSON.parse(await readFile(path,'utf8'));assert.equal(saved.project.layout.drawingEdits[key].value,'Fictional direct editing');assert.equal(saved.project.layout.drawingEdits[key].angle,0);assert.ok(saved.project.layout.drawingEdits[key].w>0);
 await page.locator('#drawing-undo').click();await page.locator('#drawing-redo').click();assert.deepEqual(errors,[]);
 // A device move must use body artwork: corners are now resize controls,
 // and native text is independently selectable without Alt. A new isolated
 // context resets onboarding and project storage without assuming reload does.
 await page.close();page=await freshPage();
 await page.locator('#sample').click();await page.waitForSelector('#canvas svg');
 if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();
 await page.locator('#zoom-fit').click();await settled();
 const bodyPoint=async id=>page.locator(`#canvas g[data-device-id="${id}"][data-drawing-key$="|body"]`).evaluate(group=>{const b=group.getBoundingClientRect();for(const fx of [.12,.2,.35,.65,.8,.9])for(const fy of [.15,.35,.5,.7,.85]){const x=b.x+b.width*fx,y=b.y+b.height*fy,target=document.elementFromPoint(x,y);if(target&&group.contains(target)&&!target.closest('text,[data-port-name],.transform-controls,.cable-controls')&&target.closest('[data-device-id]')===group)return {x,y};}throw Error('No unobstructed device body point for '+group.dataset.deviceId);});
 let point1=await bodyPoint('sw-1');await page.mouse.click(point1.x,point1.y);const point2=await bodyPoint('sw-2');await page.keyboard.down('Shift');await page.mouse.click(point2.x,point2.y);await page.keyboard.up('Shift');
 assert.equal(await page.locator('#drawing-selection').textContent(),'2 selected');
 const deviceBoxes=()=>page.locator('#canvas g[data-device-id][data-drawing-key$="|body"]').evaluateAll(nodes=>Object.fromEntries(nodes.filter(n=>['sw-1','sw-2'].includes(n.dataset.deviceId)).map(n=>{const b=n.getBoundingClientRect();return [n.dataset.deviceId,{x:b.x,y:b.y,w:b.width}];})));
 await settled();const before=await deviceBoxes();point1=await bodyPoint('sw-1');await page.keyboard.down('Shift');await page.mouse.move(point1.x,point1.y);await page.mouse.down();await page.mouse.move(point1.x+30,point1.y+4);await page.mouse.move(point1.x+60,point1.y+25);await page.mouse.up();await page.keyboard.up('Shift');
 await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent.includes('Drawing items moved.'));
 const moved=await deviceBoxes();for(const id of ['sw-1','sw-2']){assert.ok(moved[id].x-before[id].x>50,id+' moves with the selection');assert.ok(Math.abs(moved[id].y-before[id].y)<.5,id+' keeps the locked vertical coordinate');assert.ok(Math.abs(moved[id].w-before[id].w)<.1,id+' moves rather than resizing');}
 assert.equal(await page.locator('#drawing-selection').textContent(),'2 selected');assert.deepEqual(errors,[]);
 console.log('Direct text toolbar, arbitrary angle, inline content, transform cancel/resize, persistence and undo/redo passed.');
}finally{await browser.close();}
