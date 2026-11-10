// Real built-editor settings, using only the fictional sample.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/settings-preview');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const dialog=page.locator('#dialog'),preview=dialog.locator('.settings-preview-stage'),status=dialog.locator('.settings-preview-status');
const ready=async()=>{
 // Let the input debounce run before reading its status. Slow scenes safely
 // pause automatic updates; manual refresh remains the supported workflow.
 await page.waitForTimeout(350);
 if(!await dialog.getByLabel('Live preview',{exact:true}).isChecked())await dialog.getByRole('button',{name:'Update preview',exact:true}).click();
 await page.waitForFunction(()=>['ready','slow'].includes(document.querySelector('.settings-preview-status')?.dataset.state));
 if(await status.getAttribute('data-state')==='slow'){assert.equal(await dialog.getByLabel('Live preview',{exact:true}).isChecked(),false);assert.match(await status.textContent(),/Automatic updates paused.*Update preview/);}
};
const canvas=()=>page.locator('#canvas').innerHTML();
const openStyles=async()=>{await page.locator('#global-text-styles').click();await preview.locator('svg').waitFor();await dialog.locator('.text-style-section').first().locator('summary').click();return dialog.locator('.text-style-section').first().getByLabel('Font size (%)',{exact:true});};
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 await page.getByRole('button',{name:'Open sample site',exact:true}).click();await page.locator('#canvas svg').waitFor();const original=await canvas();
 let font=await openStyles(),initial=await preview.innerHTML();const initialFont=Number(await preview.locator('text[data-drawing-key*="|title|edge"]').first().getAttribute('font-size'));await font.fill('150');await ready();assert.notEqual(await preview.innerHTML(),initial);assert.ok(Number(await preview.locator('text[data-drawing-key*="|title|edge"]').first().getAttribute('font-size'))>initialFont,'actual diagram lettering changes before Apply');assert.equal(await canvas(),original,'draft style must not mutate the authoritative drawing');
 await dialog.getByRole('button',{name:'Preview zoom in',exact:true}).click();const zoom=await dialog.locator('.settings-preview-zoom').textContent();
 await font.fill('175');await ready();assert.equal(await dialog.locator('.settings-preview-zoom').textContent(),zoom,'zoom survives a new preview');
 const viewport=dialog.locator('.settings-preview-viewport'),box=await viewport.boundingBox();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.35,box.y+box.height*.4);await page.mouse.up();assert.ok(await viewport.evaluate(n=>n.scrollLeft>0||n.scrollTop>0),'read-only preview can be panned');
 assert.equal(await preview.evaluate(node=>[...node.querySelectorAll('[id]')].every(n=>document.querySelectorAll('[id="'+CSS.escape(n.id)+'"]').length===1)),true,'preview mask and clip IDs do not alias the original drawing');
 await dialog.getByLabel('Live preview',{exact:true}).uncheck();const paused=await preview.innerHTML();await font.fill('160');await page.waitForTimeout(400);assert.equal(await preview.innerHTML(),paused,'paused preview does not rebuild');await dialog.getByRole('button',{name:'Update preview',exact:true}).click();await ready();assert.notEqual(await preview.innerHTML(),paused);await dialog.getByLabel('Live preview',{exact:true}).check();await ready();
 const valid=await preview.innerHTML();await font.fill('999');if(!await dialog.getByLabel('Live preview',{exact:true}).isChecked())await dialog.getByRole('button',{name:'Update preview',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.settings-preview-status')?.dataset.state==='error');assert.equal(await preview.innerHTML(),valid,'invalid draft retains last valid preview');assert.equal(await canvas(),original);
 await dialog.getByRole('button',{name:'Apply all text styles',exact:true}).click();assert.equal(await dialog.evaluate(n=>n.open),true,'failed Apply leaves controls open');assert.match(await dialog.locator('.dialog-task-error').textContent(),/font sizes/);
 await font.fill('140');await ready();await page.screenshot({path:resolve(output,'settings-preview-text.png')});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await canvas(),original);
 font=await openStyles();assert.equal(await font.inputValue(),'100');await font.fill('150');await dialog.getByRole('button',{name:'Apply all text styles',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);const applied=await canvas();assert.notEqual(applied,original);await page.keyboard.press('Control+z');assert.equal(await canvas(),original,'one Undo restores all applied styles');await page.keyboard.press('Control+Shift+z');assert.equal(await canvas(),applied);await page.keyboard.press('Control+z');
 font=await openStyles();await font.fill('180');await page.keyboard.press('Escape');await page.waitForTimeout(450);assert.equal(await canvas(),original,'closing with queued work discards it');
 await page.locator('#page-options').click();await dialog.getByLabel('Visible page proportions',{exact:true}).selectOption('letter');await ready();assert.equal(await canvas(),original);await page.screenshot({path:resolve(output,'settings-preview-paper.png')});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await canvas(),original);
 await page.locator('#page-layout').click();await dialog.getByLabel('Edit page',{exact:true}).selectOption('*');await ready();await dialog.getByLabel('Text scale (%)',{exact:true}).fill('110');await ready();assert.equal(await canvas(),original);await dialog.getByRole('button',{name:'Preview zoom in',exact:true}).click();const layoutZoom=await dialog.locator('.settings-preview-zoom').textContent();await dialog.getByLabel('Edit page',{exact:true}).selectOption({index:1});await ready();assert.equal(await dialog.locator('.settings-preview-zoom').textContent(),layoutZoom,'view survives layout-scope rerender');
 const bounds=await dialog.evaluate(n=>{const a=n.querySelector('.settings-preview-controls').getBoundingClientRect(),b=n.querySelector('.settings-preview-view').getBoundingClientRect();return {controlsRight:a.right,previewLeft:b.left};});assert.ok(bounds.controlsRight<=bounds.previewLeft+1,'controls do not cover preview');
 await page.setViewportSize({width:620,height:900});await page.waitForTimeout(100);assert.equal(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+2),true);await page.screenshot({path:resolve(output,'settings-preview-narrow.png')});await dialog.getByLabel('Close dialog',{exact:true}).click();assert.equal(await canvas(),original);
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
