// Exercise the real enhanced controls in the built offline app. The native
// input/select elements remain the source of values, validation and events.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),output=resolve(process.env.NDS_QA_OUTPUT||'qa-output/form-controls');await mkdir(output,{recursive:true});
const url=process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href;
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],result={};page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
const nextFrame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
try{
 await page.goto(url);await page.waitForSelector('#site.nds-clearable');
 await page.locator('#filter').fill('No matching device');await page.getByRole('button',{name:'Clear Filter devices',exact:true}).click();assert.equal(await page.locator('#filter').inputValue(),'');assert.equal(await page.locator('#filter').evaluate(n=>n===document.activeElement),true);
 await page.locator('#add-device').click();const name=page.getByLabel('Device name',{exact:true}),model=page.getByLabel('Model',{exact:true});await name.fill('LAB-ACCESS');
 await name.evaluate(input=>{window.formControlEvents={input:0,change:0};input.addEventListener('input',()=>window.formControlEvents.input++);input.addEventListener('change',()=>window.formControlEvents.change++);});
 await page.getByRole('button',{name:'Clear Device name',exact:true}).click();assert.equal(await name.inputValue(),'');assert.equal(await name.evaluate(input=>input===document.activeElement),true);assert.deepEqual(await page.evaluate(()=>window.formControlEvents),{input:1,change:1});result.clearEvents=true;
 // Sibling and container contracts used by hidden-field and endpoint logic.
 assert.equal(await name.evaluate(input=>input.previousElementSibling.localName),'label');assert.equal(await name.evaluate(input=>input.parentElement.id),'dialog-body');
 await name.fill('LAB-ACCESS');await model.fill('R8N85');await page.waitForSelector('.nds-suggestions:not([hidden])');const popup=page.locator('.nds-suggestions:not([hidden])');assert.ok(await popup.getByRole('option').count()>0);assert.equal(await popup.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');assert.ok(await popup.locator('.nds-suggestion-description').count()>0);
 await page.screenshot({path:resolve(output,'form-controls.png')});
 const first=await popup.locator('.nds-suggestion-value').first().textContent();await model.press('ArrowDown');assert.equal(await model.getAttribute('aria-activedescendant'),await popup.getByRole('option').first().getAttribute('id'));await model.press('Enter');assert.equal(await model.inputValue(),first);assert.equal(await model.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#dialog').evaluate(n=>n.open),true);result.keyboardChoice=true;
 await model.fill('R8N85');const clicked=await page.locator('.nds-suggestions:not([hidden]) .nds-suggestion-value').last().textContent();await page.locator('.nds-suggestions:not([hidden]) [role=option]').last().click();assert.equal(await model.inputValue(),clicked);assert.equal(await model.getAttribute('aria-expanded'),'false');result.pointerChoice=true;
 await model.fill('LAB-CUSTOM-UNLISTED');await model.press('Escape');assert.equal(await model.inputValue(),'LAB-CUSTOM-UNLISTED');assert.equal(await page.locator('#dialog').evaluate(n=>n.open),true);assert.equal(await model.getAttribute('aria-expanded'),'false');result.customValueAndEscape=true;
 // Use the native select API, and keyboard input, after enhancement.
 const kind=page.getByLabel('Device type',{exact:true}),choices=await kind.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value));await kind.selectOption(choices[1]);assert.equal(await kind.inputValue(),choices[1]);await kind.focus();await kind.press('ArrowDown');await kind.press('Enter');await kind.press('Tab');result.nativeSelection=true;
 // Newly added member rows use the same catalog and clear action.
 await page.getByText('Stack members and installed modules',{exact:true}).click();await page.getByRole('button',{name:'Add stack member',exact:true}).click();const member=page.getByLabel('Member model',{exact:true});await member.fill('R8N85');assert.equal(await member.getAttribute('role'),'combobox');await page.getByRole('button',{name:'Clear Member model',exact:true}).click();assert.equal(await member.inputValue(),'');result.dynamicMember=true;
 // A disabled or read-only field has no active clear control. Numeric entries
 // retain the native input and keep the button inside the same field border.
 const scale=page.getByLabel('Device scale (%)',{exact:true});await scale.scrollIntoViewIfNeeded();await nextFrame();const clearScale=page.getByRole('button',{name:'Clear Device scale (%)',exact:true});const sb=await scale.boundingBox(),cb=await clearScale.boundingBox();assert.ok(cb.x>=sb.x&&cb.x+cb.width<=sb.x+sb.width&&cb.y>=sb.y&&cb.y+cb.height<=sb.y+sb.height);
 await scale.evaluate(n=>n.readOnly=true);await nextFrame();assert.equal(await clearScale.isVisible(),false);await scale.evaluate(n=>{n.readOnly=false;n.disabled=true;});await nextFrame();assert.equal(await clearScale.isVisible(),false);await scale.evaluate(n=>n.disabled=false);await nextFrame();assert.equal(await clearScale.isVisible(),true);result.numericAndProtectedFields=true;
 await page.getByText('Advanced VLANs and routing',{exact:true}).click();const vlans=page.getByLabel('VLANs',{exact:true});await vlans.fill('[{"id":10}]');await page.getByRole('button',{name:'Clear VLANs',exact:true}).click();assert.equal(await vlans.inputValue(),'');assert.equal(await vlans.evaluate(n=>n===document.activeElement),true);result.multilineClear=true;
 // All editable visible text boxes in this large form have one clear control.
 const coverage=await page.locator('#dialog input,#dialog textarea').evaluateAll(inputs=>inputs.filter(input=>input.localName==='textarea'||['text','search','email','url','tel','password','number'].includes(input.type)).filter(input=>input.getClientRects().length&&!input.matches(':disabled')&&!input.readOnly).every(input=>input.nextElementSibling?.classList.contains('nds-input-clear')));assert.equal(coverage,true);result.textboxCoverage=true;
 await page.locator('#close').click();await nextFrame();assert.equal(await page.locator('.nds-suggestions:not([hidden])').count(),0);assert.deepEqual(errors,[]);result.errors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error(error);console.error('Browser errors:',errors);process.exitCode=1;}finally{await browser.close();}
