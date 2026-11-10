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
// Use the same checked glyph target as the native CDP helper, so both gates
// cover double-click recovery instead of invoking editor internals.
const nativeTargetSource=await readFile(new URL('./desktop/NativeSmoke.cs',import.meta.url),'utf8');
const nativeTargetScript=nativeTargetSource.match(/expression=\$\$"""([\s\S]*?)"""/)[1];
const doubleClickText=async selector=>{
 for(let click=1;click<=2;click++){
  const point=await page.evaluate(nativeTargetScript.replace('{{query}}',JSON.stringify(selector)));
  assert.ok(!point.error,'Text is genuinely pointer-reachable: '+JSON.stringify(point));
  await page.mouse.click(point.x,point.y,{clickCount:click});
 }
 await page.locator('[data-inline-editor] textarea').waitFor();
};
// Navigating to a different object is a real viewport operation. The selected
// saved title must already be visible (asserted below); a lower, unselected
// device can legitimately be outside a short canvas at the unchanged zoom.
const panToText=async selector=>{
 const zoom=await page.locator('#zoom-level').textContent();
 for(let attempt=0;attempt<8;attempt++){
  const step=await page.evaluate(selector=>{
   const node=document.querySelector(selector),canvas=document.querySelector('#canvas');if(!node||!canvas)throw Error('Missing navigation target');
   const b=node.getBoundingClientRect(),c=canvas.getBoundingClientRect(),left=Math.max(0,c.left)+30,right=Math.min(innerWidth,c.right)-30,top=Math.max(0,c.top)+30,bottom=Math.min(innerHeight,c.bottom)-30;
   if(b.left>=left&&b.right<=right&&b.top>=top&&b.bottom<=bottom)return null;
   if(right<=left||bottom<=top)throw Error('Canvas has no pointer navigation area');
   const x=(left+right)/2,y=(top+bottom)/2,dx=Math.max(-(right-left)/2,Math.min((right-left)/2,x-(b.left+b.right)/2)),dy=Math.max(-(bottom-top)/2,Math.min((bottom-top)/2,y-(b.top+b.bottom)/2));
   return {x,y,dx,dy};
  },selector);
  if(!step){assert.equal(await page.locator('#zoom-level').textContent(),zoom,'Navigation preserves the accepted zoom');return;}
  await page.mouse.move(step.x,step.y);await page.mouse.down({button:'middle'});await page.mouse.move(step.x+step.dx,step.y+step.dy,{steps:4});await page.mouse.up({button:'middle'});await settled();
 }
 throw Error('Could not pan to text using the visible canvas: '+selector);
};
try{
 await page.locator('#sample').click();await page.waitForSelector('#canvas svg');await page.locator('#edit-drawing').click();
 const text=page.locator('#canvas text[data-drawing-key]').filter({hasText:'Harbor Workshop'}).first();await text.click();
 assert.equal(await page.locator('#quick-text-tools').isVisible(),true);assert.equal(await page.locator('[data-transform]').count(),5);
 const key=await text.getAttribute('data-drawing-key');await page.locator('#quick-text-angle').fill('15');await page.locator('#quick-text-angle').press('Tab');
 await page.waitForFunction(key=>[...document.querySelectorAll('#canvas text')].find(n=>n.dataset.drawingKey===key)?.getAttribute('transform')?.includes('rotate(-15'),key);
 await page.locator('#quick-text-edit').click();await page.locator('[data-inline-editor] textarea').press('Control+a');assert.deepEqual(await page.locator('[data-inline-editor] textarea').evaluate(n=>[n.selectionStart,n.selectionEnd]),[0,await page.locator('[data-inline-editor] textarea').inputValue().then(v=>v.length)]);await page.locator('[data-inline-editor] textarea').fill('Fictional direct editing');await page.keyboard.press('Enter');
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

 // Empty space below a short information panel is available for placement.
 // The preview and committed move must agree, rather than snapping back to
 // the full-height divider when the mouse is released.
 await page.close();page=await freshPage();await page.locator('#sample').click();await page.waitForSelector('#canvas svg');
 if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();
 await page.locator('#zoom-fit').click();await settled();
 const placementStart=await bodyPoint('sw-1'),placementScale=await page.locator('#canvas svg').evaluate(svg=>svg.getScreenCTM().a),placementBefore=await deviceBoxes();
 await page.mouse.move(placementStart.x,placementStart.y);await page.mouse.down();await page.mouse.move(placementStart.x-392*placementScale,placementStart.y+30*placementScale,{steps:8});
 const previewBoxes=await deviceBoxes();await page.mouse.up();await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent.includes('Drawing items moved.'));
 const placementAfter=await deviceBoxes();assert.ok(Math.abs(placementAfter['sw-1'].x-previewBoxes['sw-1'].x)<1,'Committed position must match the visible drag preview');
 assert.ok(Math.abs(placementAfter['sw-1'].x-placementBefore['sw-1'].x+392*placementScale)<1,'Device can enter empty space below panel');
 const placementDownload=page.waitForEvent('download');await page.locator('#save').click();const placementFile=await placementDownload,placementPath=resolve(output,'placement.nds');await placementFile.saveAs(placementPath);
 const placementSaved=JSON.parse(await readFile(placementPath,'utf8'));assert.ok(Math.abs(placementSaved.project.layout.drawingEdits['Core Network|device|sw-1|body'].x-38)<1);
 await page.locator('#drawing-undo').click();await page.locator('#drawing-redo').click();assert.deepEqual(errors,[]);await page.screenshot({path:resolve(output,'empty-panel-space-placement.png')});

 // Repeated title edits must still be accessible after the accepted SVG is
 // replaced. Keep revision, Escape and detached-session recovery strict.
 await page.close();page=await freshPage();await page.setViewportSize({width:1024,height:720});await page.locator('#sample').click();await page.locator('#canvas svg').waitFor();
 const edgeTitle='#canvas text[data-drawing-key="Core Network|title|edge"]',switchTitle='#canvas text[data-drawing-key="Core Network|title|sw-1"]';
 for(const [previous,value] of [[null,'Native growing-canvas title'],['Native growing-canvas title','Native repaired title']]){
  await doubleClickText(edgeTitle);const editor=page.locator('[data-inline-editor] textarea');if(previous)assert.equal(await editor.inputValue(),previous);
  const zoom=await page.locator('#zoom-level').textContent();
  await editor.fill(value);await editor.press('Enter');await page.locator('[data-inline-editor]').waitFor({state:'detached'});assert.ok((await page.locator(edgeTitle).textContent()).includes(value));
  await settled();assert.equal(await page.locator('#zoom-level').textContent(),zoom,'Revealing the saved title must not refit or zoom the drawing');
  const visible=await page.evaluate(selector=>{const n=document.querySelector(selector),b=n.getBoundingClientRect(),canvas=document.querySelector('#canvas').getBoundingClientRect();return b.top>=canvas.top&&b.bottom<=canvas.bottom;},edgeTitle);assert.ok(visible,'The accepted title remains inside the visible canvas after re-layout');
 }
 for(const value of ['Do not keep this','Temporary draft to cancel']){
  await panToText(switchTitle);await doubleClickText(switchTitle);const editor=page.locator('[data-inline-editor] textarea');assert.equal(await editor.inputValue(),'SW-1');await editor.fill(value);await editor.press('Escape');await page.locator('[data-inline-editor]').waitFor({state:'detached'});assert.ok((await page.locator(switchTitle).textContent()).includes('SW-1'));
 }
 await page.locator('#page-options').click();assert.equal(await page.locator('#dialog-title').textContent(),'Page options');await page.locator('#close').click();
 await panToText(edgeTitle);await doubleClickText(edgeTitle);await page.locator('[data-inline-editor]').evaluate(node=>node.remove());await page.locator('#page-options').click();assert.equal(await page.locator('#dialog-title').textContent(),'Page options');await page.locator('#close').click();
 assert.deepEqual(errors,[]);await page.screenshot({path:resolve(output,'inline-title-recovery.png')});
 console.log('Direct controls, transform geometry, repeated real title double-clicks, Escape, detached-session recovery and persistence passed.');
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});throw error;}finally{await browser.close();}
