// Genuine browser coverage with fictional sample data; physical accuracy still
// needs a human ruler/paper check on the user's own display.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/actual-size');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 await page.getByRole('button',{name:'Open sample site',exact:true}).click();await page.waitForSelector('#canvas svg');
 // The sample's port maps have physical Letter paper by default.
 const select=page.locator('#page-select');const choices=await select.locator('option').evaluateAll(xs=>xs.map(x=>({value:x.value,text:x.textContent})));
 const port=choices.find(x=>/port map/i.test(x.text));assert.ok(port,'fictional port-map sheet exists');await select.selectOption(port.value);
 await page.locator('#zoom-actual').click();await page.waitForSelector('#screen-calibration[open]');
 await page.locator('#calibration-reference').selectOption('215.9');await page.locator('#calibration-density').fill('4');
 assert.ok(Math.abs((await page.locator('#calibration-line').boundingBox()).width-863.6)<.1,'reference matches entered calibrated density');
 await page.screenshot({path:resolve(output,'calibration.png')});
 await page.locator('#calibration-density').fill('0');await page.locator('#calibration-save').click();assert.match(await page.locator('#calibration-error').textContent(),/between/);
 await page.locator('#calibration-density').fill('4');await page.locator('#calibration-save').click();
 assert.equal(await page.locator('#zoom-actual').getAttribute('aria-pressed'),'true');
 const scale=()=>page.locator('#canvas svg').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a);
 const before=await scale();
 const width=await page.locator('#canvas svg').evaluate(e=>e.viewBox.baseVal.width*new DOMMatrix(getComputedStyle(e).transform).a);
 assert.ok(Math.abs(width-279.4*4)<.1,'Letter landscape is 279.4mm wide at calibrated density');
 await page.setViewportSize({width:1024,height:720});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await scale(),before,'resize never fits a 1:1 sheet');
 await page.screenshot({path:resolve(output,'actual-size.png')});
 const canvas=await page.locator('#canvas').boundingBox();await page.locator('#canvas').focus();const panBefore=await page.locator('#canvas svg').evaluate(e=>getComputedStyle(e).transform);await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await page.keyboard.down('Space');await page.mouse.down();await page.mouse.move(canvas.x+canvas.width/2-50,canvas.y+canvas.height/2-30);await page.mouse.up();await page.keyboard.up('Space');assert.equal(await scale(),before,'panning preserves physical scale');assert.notEqual(await page.locator('#canvas svg').evaluate(e=>getComputedStyle(e).transform),panBefore,'Space drag actually pans the sheet');
 await page.locator('#zoom-in').click();assert.equal(await page.locator('#zoom-actual').getAttribute('aria-pressed'),'false');
 await page.locator('#zoom-actual').click();assert.equal(await scale(),before);
 await page.locator('#zoom-fit').click();assert.equal(await page.locator('#zoom-actual').getAttribute('aria-pressed'),'false');
 await page.locator('#screen-calibrate').click();await page.keyboard.press('Escape');await page.locator('#screen-calibration').waitFor({state:'detached'});
 await page.locator('#zoom-actual').click();assert.equal(await page.locator('#screen-calibration').count(),0,'saved calibration reused');
 await page.reload();await page.getByRole('button',{name:'Open sample site',exact:true}).click();await page.waitForSelector('#canvas svg');await page.locator('#page-select').selectOption(port.value);await page.locator('#zoom-actual').click();
 assert.equal(await page.locator('#screen-calibration').count(),0,'calibration persists through reload');assert.equal(await scale(),before);
 await page.evaluate(()=>{Object.defineProperty(window,'devicePixelRatio',{configurable:true,value:2.75});window.dispatchEvent(new Event('resize'));});
 assert.equal(await page.locator('#zoom-actual').getAttribute('aria-pressed'),'false');assert.match(await page.locator('#actual-size-status').textContent(),/changed/);
 await page.locator('#zoom-actual').click();await page.locator('#calibration-reset').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('nds.screen-calibration.v1')),null);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('PASS: calibration, physical paper scaling, persistence, reset, resize, zoom and display changes');
}finally{await browser.close();}
