// Real-browser coverage for the site map: the page follows the network page,
// Site map options change what the cards show and how access points are
// grouped as one Undo step, and a card moves in Edit drawing with its
// connections. Fictional data only.
// Use the same browser/output environment variables as browser-cable-proximity.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fictionalCampus} from './fixtures/site-map-campus.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),output=resolve(process.env.NDS_QA_OUTPUT||'qa-output/site-map');await mkdir(output,{recursive:true});
const url=process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href;
const fixture=resolve(output,'site-map-campus.nds.json');await writeFile(fixture,JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:fictionalCampus()}));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
const feedback=pattern=>page.waitForFunction(source=>new RegExp(source,'i').test(document.querySelector('#feedback').textContent),pattern.source);
const field=label=>page.locator('#dialog').getByLabel(label,{exact:true});
const apCards=()=>page.locator('#canvas svg g[data-drawing-key^="Site Map|node|"]').evaluateAll(nodes=>nodes.filter(n=>/^Site Map\|node\|(?:device:ap|group:aps)[^|]*$/.test(n.getAttribute('data-drawing-key'))).length);
try{
 await page.goto(url);await page.locator('#project-file').setInputFiles(fixture);await page.waitForSelector('#canvas svg');
 const options=await page.locator('#page-select option').evaluateAll(options=>options.map(option=>({value:option.value,label:option.textContent})));
 const index=options.findIndex(option=>/^Site Map$/.test(option.label.trim()));assert.ok(index>0,'the site map is listed after the network page');assert.match(options[index-1].label,/Core Network/);
 assert.equal(await page.locator('#site-map-options').isHidden(),true,'Site map options only on the site map');
 await page.locator('#page-select').selectOption(options[index].value);await page.waitForFunction(()=>!!document.querySelector('#canvas svg [data-drawing-key="Site Map|node|device:core1"]'));
 assert.equal(await page.locator('#site-map-options').isVisible(),true);
 assert.ok(await page.locator('#page-families').textContent().then(t=>/Site map/i.test(t)),'its own page group');
 const grouped=await apCards();assert.equal(grouped,8,'one access point card per access switch');
 await page.screenshot({path:resolve(output,'site-map.png')});
 // Options: each access point, left to right, without IP addresses.
 await page.locator('#site-map-options').click();await page.waitForFunction(()=>document.querySelector('#dialog').open);
 assert.equal((await page.locator('#dialog-title').textContent()).trim(),'Site map options');
 await field('Access points').selectOption('each');await field('Direction').selectOption('right');await field('Management IP').uncheck();
 await page.getByRole('button',{name:'Apply site map options',exact:true}).click();await feedback(/Site map options saved/);
 await page.waitForFunction(()=>[...document.querySelectorAll('#canvas svg g[data-drawing-key^="Site Map|node|device:ap"]')].length>8);
 assert.ok(await apCards()>grouped);assert.equal(await page.locator('#canvas svg text[data-drawing-key$="|detail|ip"]').count(),0,'no IP lines');
 await page.screenshot({path:resolve(output,'site-map-each.png')});
 // One Undo step restores the previous options.
 await page.keyboard.press('Control+z');await page.waitForFunction(()=>![...document.querySelectorAll('#canvas svg g[data-drawing-key^="Site Map|node|device:ap"]')].length);
 assert.equal(await apCards(),grouped);assert.ok(await page.locator('#canvas svg text[data-drawing-key$="|detail|ip"]').count()>0);
 // Edit drawing: a card moves with arrow nudges, and its connections follow.
 if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();const core=page.locator('#canvas svg g[data-drawing-key="Site Map|node|device:nas"]');
 const before=await core.boundingBox();await page.mouse.click(before.x+4,before.y+before.height-4);
 for(let i=0;i<4;i++)await page.keyboard.press('Shift+ArrowRight');
 await page.waitForFunction(x=>{const n=document.querySelector('#canvas svg g[data-drawing-key="Site Map|node|device:nas"]');return n&&n.getBoundingClientRect().x>x+2;},before.x);
 const line=await page.locator('#canvas svg path.diagram-cable[data-drawing-key="Site Map|line|device:core1~device:nas"]').boundingBox();const after=await core.boundingBox();
 assert.ok(line&&line.x+line.width>=after.x-2,'the connection still reaches the moved card');
 // Each nudge is one Undo step.
 for(let i=0;i<4;i++){await page.keyboard.press('Control+z');await page.waitForTimeout(150);}await page.waitForFunction(x=>Math.abs(document.querySelector('#canvas svg g[data-drawing-key="Site Map|node|device:nas"]').getBoundingClientRect().x-x)<1,before.x);
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'result.json'),JSON.stringify({ok:true,checks:['page order and group','options dialog','each access point','left to right','detail toggles','Undo','card nudge with connections']},null,2));
 console.log('Site map browser checks passed.');
}finally{await browser.close();}
