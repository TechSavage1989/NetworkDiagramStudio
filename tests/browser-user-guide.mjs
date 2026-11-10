// Actual local UI interactions, using only the fictional built-in sample.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/user-guide');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 const guide=page.locator('#user-guide'),dialog=page.locator('#dialog');
 await guide.click();await page.getByRole('heading',{name:'User guide',exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Information panel: size and contents',exact:true}).click();
 assert.equal(await dialog.locator('#guide-panel').getByRole('button',{name:'Open Pages & layout',exact:true}).isDisabled(),true,'help works before a project without enabling drawing actions');
 await dialog.getByLabel('Search the guide',{exact:true}).fill('nothing-matches');assert.match(await dialog.locator('.guide-result-count').textContent(),/No matching topics/);
 await dialog.getByLabel('Search the guide',{exact:true}).fill('calibration');assert.ok(await dialog.locator('#guide-calibration').count());
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 await page.getByRole('button',{name:'Open sample site',exact:true}).click();await page.waitForSelector('#canvas svg');
 const before=await page.locator('#canvas').innerHTML();
 await guide.click();await dialog.getByRole('button',{name:'Actual size and screen calibration',exact:true}).click();
 await page.screenshot({path:resolve(output,'user-guide.png')});
 await dialog.getByLabel('Close dialog',{exact:true}).click();assert.equal(await page.locator('#canvas').innerHTML(),before,'reading and closing help preserves the drawing');
 await guide.click();await dialog.getByRole('button',{name:'Information panel: size and contents',exact:true}).click();await dialog.locator('#guide-panel').getByRole('button',{name:'Open Pages & layout',exact:true}).click();
 await page.getByRole('heading',{name:'Pages & layout',exact:true}).waitFor();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('#canvas').innerHTML(),before,'opening then canceling settings from guide does not alter drawing');
 await page.setViewportSize({width:620,height:800});await guide.click();await dialog.getByLabel('Search the guide',{exact:true}).fill('panel');
 assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+2),true,'guide does not overflow narrow dialog horizontally');
 await page.screenshot({path:resolve(output,'user-guide-narrow.png')});await page.keyboard.press('Escape');
 await guide.click();assert.equal(await dialog.getByLabel('Search the guide',{exact:true}).inputValue(),'','reopening starts a clean guide search');await dialog.getByLabel('Close dialog',{exact:true}).click();
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
