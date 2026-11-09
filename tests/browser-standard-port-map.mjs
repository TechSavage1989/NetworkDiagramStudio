// Synthetic visual/export verification of standardized chassis/stack faces.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {standardizedMaps} from './fixtures/standard-port-maps.mjs';
import {svgPage} from '../src/web/diagram/scene.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/standard-port-map');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),scenes=standardizedMaps();
 for(const scene of scenes){
  const svg=svgPage(scene);await writeFile(resolve(output,scene.sourceDeviceIds[0]+'.svg'),svg);
  await page.setContent('<html><body style="margin:0">'+svg+'</body></html>');
  await page.screenshot({path:resolve(output,scene.sourceDeviceIds[0]+'.png'),fullPage:true});
  const faces=await page.locator('rect[data-drawing-key$="|face"]').evaluateAll(nodes=>nodes.map(node=>({w:+node.getAttribute('width'),h:+node.getAttribute('height')})));
  assert.equal(faces.length,scene.reportSockets.length);assert.ok(faces.every(face=>Math.abs(face.w-30)<1e-8));
  await page.pdf({path:resolve(output,scene.sourceDeviceIds[0]+'.pdf'),width:scene.width+'px',height:scene.height+'px',printBackground:true});
 }
 await writeFile(resolve(output,'result.json'),JSON.stringify({ok:true,pages:scenes.length,referenceSocketWidth:30,checks:['chassis/fixed/stack pixel geometry','all socket counts','SVG vectors','PDF export']},null,2));
}finally{await browser.close();}
