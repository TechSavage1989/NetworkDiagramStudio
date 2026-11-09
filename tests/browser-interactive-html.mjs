import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rotationProject} from './fixtures/device-rotation.mjs';
import {exportInteractiveHtml} from '../src/web/interactive-html.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/interactive-html');await mkdir(output,{recursive:true});
const fixture=resolve(output,'fictional.nds.json');await writeFile(fixture,JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:rotationProject()}));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);await page.locator('#project-file').setInputFiles(fixture);await page.locator('#canvas svg').waitFor();
 await page.locator('#export-menu').click();const exportDialog=page.getByRole('dialog',{name:'Export documentation',exact:true});await exportDialog.waitFor();
 // The project also has a Drawing pages landmark. Target the named form control in this dialog.
 const scope=exportDialog.getByRole('combobox',{name:'Drawing pages',exact:true});assert.equal(await scope.count(),1);await scope.selectOption('all');
 const pending=page.waitForEvent('download');await exportDialog.getByRole('button',{name:'Interactive HTML',exact:true}).click();const download=await pending,path=resolve(output,'fictional-viewer.html');await download.saveAs(path);
 const content=await readFile(path,'utf8');assert.ok(!content.includes('"rawConfig"'));
 const viewer=await browser.newPage({viewport:{width:1366,height:900}}),requests=[];viewer.on('pageerror',e=>errors.push(e.message));viewer.on('request',r=>{if(!/^(?:file|data):/.test(r.url()))requests.push(r.url());});
 const settle=()=>viewer.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 await viewer.goto(pathToFileURL(path).href);await viewer.locator('#drawing svg').waitFor();await settle();assert.ok(await viewer.locator('#drawing path').count()>0);assert.ok(await viewer.locator('#pages button').count()>1);
 const original=await viewer.locator('#zoom').textContent();await viewer.getByRole('button',{name:'Zoom in',exact:true}).click();assert.notEqual(await viewer.locator('#zoom').textContent(),original);
 await viewer.locator('#pages button').nth(1).click();assert.equal(await viewer.locator('#pages button').nth(1).getAttribute('aria-current'),'page');await viewer.locator('#pages button').first().click();
 const text='Fictional rotation lab';await viewer.locator('#search').fill(text);assert.ok(await viewer.locator('#results button').count()>0);
 for(const result of await viewer.locator('#results button').allTextContents())assert.equal(result.split(text).length-1,1,'A search result must show each full label once, not title + tspans');
 await viewer.locator('#results button').first().click();assert.equal(await viewer.locator('#inspection').textContent(),text);
 await viewer.locator('#search').fill('NO_MATCH_123456789');assert.equal(await viewer.locator('#matches').textContent(),'0 matches');await viewer.locator('#search').fill('');await viewer.getByRole('button',{name:'Fit page',exact:true}).click();await settle();
 const before=await viewer.locator('#drawing').getAttribute('style'),box=await viewer.locator('#drawing text').first().boundingBox();await viewer.mouse.move(box.x+box.width/2,box.y+box.height/2);await viewer.mouse.down();await viewer.mouse.move(box.x+box.width/2+90,box.y+box.height/2+45,{steps:5});await viewer.mouse.up();assert.notEqual(await viewer.locator('#drawing').getAttribute('style'),before);assert.equal(await viewer.evaluate(()=>getSelection().toString()),'','Panning from SVG text must not create a native text selection');await viewer.locator('#stage').press('0');await settle();assert.equal(await viewer.evaluate(()=>getSelection().toString()),'');
 await viewer.screenshot({path:resolve(output,'interactive-html.png')});await viewer.setViewportSize({width:390,height:844});await settle();assert.ok(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Malicious imported markup stays inert; embedded raster images and port metadata survive.
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=';
 const hostile=exportInteractiveHtml([{name:'</script><script>window.pwned=1</script>',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" onload="window.pwned=1"><script>window.pwned=1</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">bad</div></foreignObject><image href="https://example.com/track.png"/><image href="${image}" width="20" height="20"/><rect data-port-name="Gi1/1" x="30" y="30" width="30" height="30" fill="blue"/><text x="10" y="80">Safe label</text></svg>`}]);
 const attack=resolve(output,'inert.html');await writeFile(attack,hostile);await viewer.goto(pathToFileURL(attack).href);await viewer.locator('#drawing svg').waitFor();assert.equal(await viewer.evaluate(()=>window.pwned),undefined);assert.equal(await viewer.locator('#drawing script,#drawing foreignObject,[onload]').count(),0);assert.equal(await viewer.locator('#drawing image[href]').count(),1);assert.equal(await viewer.locator('[data-port-name="Gi1/1"]').count(),1);
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);console.log('Downloaded offline HTML: pages, search, zoom, pan, responsive rendering, safe SVG, embedded image and zero network requests passed.');
}finally{await browser.close();}
