// Real Edge interaction smoke for bidirectional network connection selection.
// All site data are the built-in fictional Harbor Workshop sample.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/linked-labels');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 await page.locator('#sample').click();
 await page.waitForSelector('#canvas svg path.diagram-cable',{state:'attached'});
 await page.locator('#edit-drawing').click();
 const label=page.locator('#canvas svg text[data-drawing-key*="|port|"]').first();
 assert.ok(await label.count()>0,'sample includes port connection labels');
 await label.click({force:true});
 assert.ok(await page.locator('#canvas svg path.diagram-cable.linked-association').count()>0,'selecting a label highlights its cable');
 assert.ok(await page.locator('#canvas svg circle.linked-port-marker').count()>=2,'selected cable shows actual endpoints');
 const labelButton=page.locator('#drawing-snap-label');
 assert.ok(await labelButton.isEnabled(),'selected label offers cable alignment');
 await page.screenshot({path:resolve(output,'linked-selection.png')});
 await labelButton.click();
 assert.equal(await page.locator('#dialog-title').textContent(),'Align label to connection');
 assert.ok(await page.locator('#dialog').getByLabel('Position on line',{exact:true}).count());
 await page.locator('#close').click();
 const linkedStroke=page.locator('#canvas svg path.diagram-cable.linked-association').first();
 const linkPoint=await linkedStroke.evaluate(node=>{const point=node.getPointAtLength(node.getTotalLength()*.45),screen=point.matrixTransform(node.getScreenCTM());return {x:screen.x,y:screen.y};});
 await page.mouse.click(linkPoint.x,linkPoint.y);
 assert.ok(await page.locator('#canvas svg text.linked-association').count()>0,'selecting a cable highlights its labels');
 const link=await page.evaluate(async()=>{const {sampleSite}=await import('nds/sample.mjs');return sampleSite().links.find(l=>l.b==='sw-1')||sampleSite().links[0];});
 const endpoint=page.locator('#canvas svg g[data-device-id="'+link.b+'"] [data-port-name="'+link.bp+'"]').first();
 if(await endpoint.count()){
  await endpoint.click({force:true});
  assert.ok(await page.locator('#canvas svg path.diagram-cable.linked-association').count()>0,'clicking connected socket highlights its cable');
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'results.json'),JSON.stringify({labelCable:true,endpoints:true,cableLabels:true,snapDialog:true,errors},null,2));
 console.log('PASS connection, socket, label highlighting and snap dialog.');
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error('Browser errors:',errors);throw error;}finally{await browser.close();}
