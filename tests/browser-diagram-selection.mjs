// Shared actual-keyboard/gesture checks, called by the hosted panel-content gate.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildPages} from '../src/web/diagram/index.mjs';
import {diagramContentKeys} from '../src/web/drawing-selection.mjs';

export async function checkDiagramSelection(page,output,open){
 const save=async name=>{const wait=page.waitForEvent('download');await page.locator('#save').click();const path=resolve(output,name+'.nds.json');await (await wait).saveAs(path);return JSON.parse(await readFile(path,'utf8')).project;};
 const state=project=>({edits:project.layout?.drawingEdits||{},groups:project.layout?.drawingGroups||[]});
 const selectAll=async modifier=>{await page.locator('#canvas').focus();await page.keyboard.press(modifier+'+a');};
 const settled=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();
 // Deliberate transforms must change the size relative to selected paper,
 // not merely update source coordinates that Auto-fit then normalizes away.
 await page.locator('#page-options').click();let paperDialog=page.locator('#dialog');
 await paperDialog.getByLabel('Visible page proportions',{exact:true}).selectOption('letter');
 assert.equal(await paperDialog.getByLabel('Lock physical page size',{exact:true}).isChecked(),false);
 await paperDialog.getByRole('button',{name:'Save page options',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 const original=await save('selection-before'),scene=buildPages(original)[0],expected=[...diagramContentKeys(scene)].sort();
 assert.ok(scene.items.some(i=>i.panelGroup),'Fixture must contain panel content');
 await selectAll('Control');assert.equal(await page.locator('#drawing-selection').textContent(),expected.length+' selected');
 await page.locator('#drawing-clear').click();await page.keyboard.press('Control+a');assert.equal(await page.locator('#drawing-selection').textContent(),expected.length+' selected','Drawing toolbar focus retains diagram select-all');
 await page.locator('#drawing-clear').click();await selectAll('Meta');assert.equal(await page.locator('#drawing-selection').textContent(),expected.length+' selected');
 assert.equal(await page.locator('[data-transform]').count(),5);
 await page.locator('#drawing-group').click();const grouped=await save('selection-grouped');
 // Membership comparison must not reorder the baseline used by exact history checks.
 const originalGroups=structuredClone(grouped.layout.drawingGroups);
 assert.deepEqual([...grouped.layout.drawingGroups.at(-1).keys].sort(),expected,'Group must contain only this page’s whole diagram objects');
 assert.deepEqual(grouped.layout.drawingGroups,originalGroups,'Membership assertion preserves saved group order');
 const cycle=async(name,action)=>{
  const before=await save(name+'-before');await action();const after=await save(name+'-after');assert.notDeepEqual(state(after),state(before),name+' must change saved geometry');
  await page.locator('#drawing-undo').click();assert.deepEqual(state(await save(name+'-undo')),state(before),name+' Undo');
  await page.locator('#drawing-redo').click();assert.deepEqual(state(await save(name+'-redo')),state(after),name+' Redo');
  const rebuilt=buildPages(after)[0];
  if(['all-smaller','all-larger'].includes(name)){
   const previous=buildPages(before)[0],body=previous.items.find(i=>i.type==='device'&&!i.panelGroup&&i.kind!=='plug'),changed=rebuilt.items.find(i=>i.editKey===body.editKey),factor=name==='all-smaller'?.9:1.1;
   assert.ok(Math.abs((changed.w/rebuilt.width)/(body.w/previous.width)-factor)<1e-6,'visible size relative to paper follows the requested transform');
  }
  for(const cable of rebuilt.items.filter(i=>i.type==='path'&&i.from&&i.to)){assert.deepEqual(cable.points[0],[cable.from.x,cable.from.y]);assert.deepEqual(cable.points.at(-1),[cable.to.x,cable.to.y]);}
  assert.deepEqual(after.layout.drawingGroups,grouped.layout.drawingGroups);return after;
 };
 await cycle('all-smaller',()=>page.locator('#drawing-smaller').click());
 await cycle('all-larger',()=>page.locator('#drawing-larger').click());
 const dragHandle=async(handle,dx,dy)=>{
  await page.locator('#zoom-fit').click();await settled();const target=page.locator('[data-transform="'+handle+'"]');
  const point=await target.evaluate(node=>{const b=node.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;if(document.elementFromPoint(x,y)!==node)throw Error('Transform handle is obstructed');return {x,y};});
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+dx,point.y+dy,{steps:8});await page.mouse.up();
 };
 await cycle('all-handle-scale',()=>dragHandle('se',-25,-15));
 await cycle('all-rotate',()=>dragHandle('rotate',12,0));
 const final=await cycle('all-move',async()=>{await page.locator('#canvas').focus();await page.keyboard.press('ArrowRight');});
 const finalPath=resolve(output,'all-move-redo.nds.json');await open(finalPath);
 assert.deepEqual(state(await save('selection-reopened')),state(final),'Saved transforms survive reopen');
 // Chrome cannot start a diagram selection or a native text-selection drag.
 if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();
 assert.equal(await page.locator('#drawing-selection').textContent(),'0 selected','Reopening restores geometry without restoring a transient selection');
 assert.equal(await page.locator('#drawing-clear').isDisabled(),true,'Clear selection stays disabled for the empty reopened selection');
 await page.locator('#site').focus();await page.keyboard.press('Control+a');
 assert.deepEqual(await page.locator('#site').evaluate(n=>[n.selectionStart,n.selectionEnd]),[0,await page.locator('#site').inputValue().then(v=>v.length)]);
 assert.equal(await page.locator('#drawing-selection').textContent(),'0 selected');
 await page.locator('#paste').click();const input=page.locator('#dialog textarea').first();await input.fill('Fictional editable text');await input.press('Control+a');
 assert.deepEqual(await input.evaluate(n=>[n.selectionStart,n.selectionEnd]),[0,(await input.inputValue()).length]);await page.locator('#close').click();
 await page.evaluate(()=>getSelection().removeAllRanges());const canvas=await page.locator('#canvas').boundingBox(),toolbar=await page.locator('.stagebar').boundingBox();
 await page.mouse.move(canvas.x+canvas.width-12,canvas.y+canvas.height-12);await page.mouse.down();await page.mouse.move(toolbar.x+100,toolbar.y+10,{steps:8});await page.mouse.up();
 assert.equal(await page.evaluate(()=>getSelection().toString()),'');
 for(const selector of ['.appbar','.project-sidebar','.pages-sidebar','.stagebar','#drawing-tools'])assert.equal(await page.locator(selector).evaluate(n=>getComputedStyle(n).userSelect),'none');
 // Contenteditable descendants retain their native select-all, too.
 await page.evaluate(()=>{const field=document.createElement('div');field.contentEditable='true';field.id='selection-editable-test';field.textContent='Editable caption';document.querySelector('#canvas').append(field);field.focus();});
 const selectedBefore=await page.locator('#drawing-selection').textContent();await page.keyboard.press('Control+a');
 assert.equal(await page.evaluate(()=>getSelection().toString()),'Editable caption');assert.equal(await page.locator('#drawing-selection').textContent(),selectedBefore);
 await page.locator('#selection-editable-test').evaluate(n=>n.remove());
 await page.screenshot({path:resolve(output,'diagram-selection.png')});
 // Page locks preserve paper dimensions and fitted scale, not an editing boundary.
 const locked=structuredClone(original);locked.layout||={};locked.layout.pageSetup={visible:{default:{preset:'a3',locked:true}}};locked.layout.pageSetup.visible.lockFrames=Object.fromEntries(buildPages(locked).filter(p=>p.pageLockFrame).map(p=>[p.name,p.pageLockFrame]));
 await open({name:'locked-selection.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:locked}))});
 if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();
 await selectAll('Control');await page.locator('#drawing-group').click();const lockedBefore=await save('locked-before');
 const pageFrame=()=>page.locator('#canvas svg').evaluate(svg=>{const b=svg.viewBox.baseVal;return [b.x,b.y,b.width,b.height];}),frame=await pageFrame();
 await page.locator('#drawing-size').click();await page.getByLabel('Size (% of current size)',{exact:true}).fill('400');await page.getByRole('button',{name:'Apply size',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#dialog').open);await page.locator('#page-overflow-notice').waitFor({state:'visible'});assert.match(await page.locator('#page-overflow-notice').textContent(),/Print\/PDF.*clip/);
 assert.equal(await page.locator('#canvas svg').evaluate(n=>getComputedStyle(n).overflow),'visible');
 const oversized=await save('locked-oversized');assert.notDeepEqual(state(oversized),state(lockedBefore));assert.deepEqual(await pageFrame(),frame);
 assert.deepEqual(oversized.layout.pageSetup.visible.lockFrames,lockedBefore.layout.pageSetup.visible.lockFrames);
 await page.locator('#drawing-undo').click();assert.deepEqual(state(await save('locked-undo')),state(lockedBefore));assert.deepEqual(await pageFrame(),frame);
 await page.locator('#drawing-redo').click();assert.deepEqual(state(await save('locked-redo')),state(oversized));assert.deepEqual(await pageFrame(),frame);
 await open(resolve(output,'locked-redo.nds.json'));assert.deepEqual(state(await save('locked-reopened')),state(oversized));assert.deepEqual(await pageFrame(),frame);await page.locator('#page-overflow-notice').waitFor({state:'visible'});
 // Regression: selecting captions together with devices must not pin those
 // generated captions onto obsolete routes. Exercise the ungrouped model-size
 // command and a much larger group shrink, not just +/-10% happy paths.
 for(const groupedResize of [false,true]){
  await open({name:'caption-resize.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:original}))});
  if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();
  await selectAll('Control');if(groupedResize)await page.locator('#drawing-group').click();
  const before=await save('caption-resize-before');
  await page.locator('#drawing-size').click();await page.getByLabel('Size (% of current size)',{exact:true}).fill(groupedResize?'50':'200');await page.getByRole('button',{name:'Apply size',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#dialog').open);
  assert.doesNotMatch(await page.locator('#feedback').textContent(),/overlaps a link label/);
  const after=await save('caption-resize-after');assert.notDeepEqual(state(after),state(before));
  for(const caption of scene.items.filter(i=>i.labelRole)){
   const patch=after.layout.drawingEdits[caption.editKey];assert.equal(patch?.x,undefined,'Bulk resize retains automatic caption placement');assert.equal(patch?.y,undefined);
  }
  await page.locator('#drawing-undo').click();assert.deepEqual(state(await save('caption-resize-undo')),state(before));
  await page.locator('#drawing-redo').click();assert.deepEqual(state(await save('caption-resize-redo')),state(after));
  await open(resolve(output,'caption-resize-redo.nds.json'));assert.deepEqual(state(await save('caption-resize-reopened')),state(after));
 }
}
