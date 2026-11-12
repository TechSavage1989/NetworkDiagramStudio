// Real-browser coverage for the page bar's paper lock and All pages box, the
// Paper & print wireless section, and the Global text styles highlight.
// Fictional built-in sample only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/paper-controls');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[],result={};page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const feedback=pattern=>page.waitForFunction(source=>new RegExp(source,'i').test(document.querySelector('#feedback').textContent),pattern.source);
const lock=page.locator('#active-page-lock'),all=page.locator('#active-page-all'),dialog=page.locator('#dialog');
const choose=async name=>{const value=await page.locator('#page-select option').evaluateAll((options,name)=>options.find(o=>o.textContent.startsWith(name))?.value,name);assert.ok(value!=null,name);await page.locator('#page-select').selectOption(value);await page.waitForTimeout(150);};
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 await page.getByRole('button',{name:'Open sample site',exact:true}).click();await page.waitForSelector('#canvas svg');
 await choose('Core Network');
 // A paper size enables the lock; Dynamic has nothing to lock.
 await page.locator('#active-page-paper').selectOption('letter');await feedback(/Paper updated/);
 assert.equal(await lock.isEnabled(),true);assert.equal(await lock.getAttribute('aria-pressed'),'false');
 // Without All pages the lock is page-only.
 await lock.click();await feedback(/Page locked for/);assert.equal(await lock.getAttribute('aria-pressed'),'true');assert.equal((await lock.textContent()).trim(),'Locked');
 await choose('VLANs and Routing');assert.equal(await lock.getAttribute('aria-pressed'),'false','other pages keep their own setting');
 // With All pages the change is global.
 await all.check();await page.locator('#active-page-orientation').evaluate(e=>e.disabled)||await page.locator('#active-page-paper').selectOption('a4');
 await page.locator('#active-page-paper').selectOption('a4');await feedback(/on every page/);
 await lock.click();await feedback(/Page locked on every page/);
 for(const name of ['Core Network','VLANs and Routing']){await choose(name);assert.equal(await page.locator('#active-page-paper').inputValue(),'a4',name+' takes the global paper');assert.equal(await lock.getAttribute('aria-pressed'),'true',name+' is locked');}
 // A later page-only change overrides the global setting for that page.
 await all.uncheck();await lock.click();await feedback(/Page unlocked for/);await choose('Core Network');assert.equal(await lock.getAttribute('aria-pressed'),'true');
 await page.screenshot({path:resolve(output,'page-bar.png'),clip:{x:0,y:0,width:1500,height:160}});
 // Paper & print: one general Paper layout, wireless choices in their own section.
 await page.locator('#page-options').click();await page.getByRole('heading',{name:'Paper & print',exact:true}).waitFor();
 const layouts=await dialog.getByLabel('Paper layout',{exact:true}).locator('option').allTextContents();
 assert.equal(layouts.length,2);assert.ok(layouts.every(text=>!/wireless/i.test(text)),'Paper layout options are general');
 await dialog.locator('.wireless-paper-options summary').click();assert.equal(await dialog.getByLabel('Wireless layout',{exact:true}).inputValue(),'adaptive');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click().catch(()=>dialog.getByLabel('Close dialog',{exact:true}).click());await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 // Global text styles highlight the category being edited on the preview.
 await choose('Core Network');await page.locator('#global-text-styles').click();await page.getByRole('heading',{name:'Global text styles',exact:true}).waitFor();
 await dialog.locator('summary',{hasText:'Port and interface labels'}).click();
 await page.waitForFunction(()=>/Highlighted: \d+/.test(document.querySelector('.settings-preview-highlight')?.textContent||''));
 result.highlight=await dialog.locator('.settings-preview-highlight').textContent();
 const lit=await dialog.locator('.settings-preview-stage text[data-preview-highlight]').count();assert.ok(lit>0,'port labels glow on the preview');
 const fill=await dialog.locator('.settings-preview-stage text[data-preview-highlight]').first().evaluate(n=>getComputedStyle(n).fill);assert.match(fill,/rgb\(194, 65, 12\)/);
 await dialog.locator('summary',{hasText:'Device names'}).click();await page.waitForFunction(()=>/device names/.test(document.querySelector('.settings-preview-highlight')?.textContent||''));
 await page.screenshot({path:resolve(output,'text-style-highlight.png')});
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.deepEqual(errors,[]);result.ok=true;
}catch(error){result.failure=error.message;await page.screenshot({path:resolve(output,'failure.png')});throw error;}
finally{result.errors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
