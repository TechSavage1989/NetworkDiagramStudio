// Capture the real offline application with its built-in fictional sample.
// Outputs remain QA artifacts until reviewed and copied into docs/images.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sampleSite} from '../src/web/sample.mjs';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/documentation');await mkdir(output,{recursive:true});
const url=process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href;
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
const sample=sampleSite(),devices=new Map(sample.devices.map(device=>[device.id,device]));
const results={source:'Built-in fictional Harbor Workshop sample',captures:{},dialogBounds:{}};
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());

const settle=()=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
const ready=async()=>{await page.locator('#canvas > svg').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#save').disabled);await settle();};
const fit=async()=>{await page.locator('#zoom-fit').click();await settle();};
const field=name=>page.locator('#dialog').getByLabel(name,{exact:true});
async function capture(name,details={}){
 await page.mouse.move(8,page.viewportSize().height-8);await settle();
 await page.screenshot({path:resolve(output,name+'.png')});
 results.captures[name]={viewport:page.viewportSize(),page:await page.locator('#page-select').evaluate(select=>select.selectedOptions[0]?.textContent),...details};
}
async function choosePage(group,match=null){
 const options=await page.locator('#page-select option').evaluateAll(options=>options.map(option=>({value:option.value,label:option.textContent,group:option.parentElement.label})));
 const option=options.find(option=>option.group===group&&(!match||match.test(option.label)));assert.ok(option,'Sample page exists in '+group);
 await page.locator('#page-select').selectOption(option.value);await ready();await fit();return option;
}
async function measureDialog(name){
 await settle();
 results.dialogBounds[name]=await page.locator('#dialog').evaluate(dialog=>{
  const body=dialog.querySelector('#dialog-body'),box=element=>{const rect=element.getBoundingClientRect();return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height};},bounds=box(dialog);
  const visible=element=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.display!=='none';};
  const controls=[...dialog.querySelectorAll('input,select,textarea,button,summary')].filter(visible).map(element=>({name:element.getAttribute('aria-label')||element.labels?.[0]?.textContent.trim()||element.textContent.trim()||element.type,...box(element)}));
  const outside=controls.filter(rect=>rect.left<Math.max(0,bounds.left)-1||rect.top<Math.max(0,bounds.top)-1||rect.right>Math.min(innerWidth,bounds.right)+1||rect.bottom>Math.min(innerHeight,bounds.bottom)+1);
  const scroll=[dialog,body].map(element=>({element:element.id,scrollTop:element.scrollTop,scrollLeft:element.scrollLeft,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,clientWidth:element.clientWidth,scrollWidth:element.scrollWidth}));
  const requiresScroll=scroll.some(value=>value.scrollHeight>value.clientHeight+2||value.scrollWidth>value.clientWidth+2||value.scrollTop!==0||value.scrollLeft!==0);
  const save=controls.find(control=>control.name==='Save object');
  return {viewport:{width:innerWidth,height:innerHeight},dialog:bounds,scroll,controls,outside,save,requiresScroll,fits:bounds.left>=-1&&bounds.top>=-1&&bounds.right<=innerWidth+1&&bounds.bottom<=innerHeight+1&&!requiresScroll&&!outside.length&&!!save};
 });
}

try{
 await page.goto(url);await page.locator('#sample').click();await ready();await fit();
 await capture('hero',{site:sample.name,devices:sample.devices.length,connections:sample.links.length});

 await choosePage('Port maps',/^SW-1 \/ Port map$/);
 assert.match(await page.locator('#canvas svg').textContent(),/SW-1/);
 await capture('port-map',{device:'SW-1',ports:devices.get('sw-1').ports.length,style:'Switchport builder sheet'});

 await choosePage('Wireless connections');
 const wirelessIds=await page.locator('#canvas svg [data-device-id]').evaluateAll(elements=>[...new Set(elements.map(element=>element.getAttribute('data-device-id')))]);
 const wirelessDevices=wirelessIds.map(id=>devices.get(id)).filter(Boolean),accessPoints=wirelessDevices.filter(device=>device.kind==='ap'),switches=wirelessDevices.filter(device=>device.kind==='switch');
 assert.ok(accessPoints.length>0&&switches.length>0,'Wireless capture contains real sample equipment');
 await capture('compact-wireless',{switches:switches.map(device=>device.name),accessPointCount:accessPoints.length,accessPoints:accessPoints.map(device=>device.name),connections:await page.locator('#canvas path.diagram-cable').count()});

 await choosePage('Core network');if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();await settle();await fit();
 await page.locator('#drawing-organize').click();await page.getByRole('button',{name:'Analyze connections',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.organize-results').hidden&&!document.querySelector('.organize-check input').disabled,null,{timeout:60000});
 assert.equal(await page.locator('.organize-metrics tbody tr').count(),4);
 await page.getByRole('button',{name:'Proposed',exact:true}).click();
 await capture('organize-connections',{status:await page.locator('.organize-status').textContent(),metrics:await page.locator('.organize-metrics tbody tr').evaluateAll(rows=>rows.map(row=>[...row.children].map(cell=>cell.textContent)))});
 await page.locator('#close').click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);

 // Measure before any click can scroll a save action into view. The default
 // key, line and text forms must fit the smallest documented desktop viewport.
 await page.setViewportSize({width:1366,height:768});await settle();await fit();
 const cableKey=await page.locator('#canvas path.diagram-cable').first().getAttribute('data-drawing-key'),textKey=await page.locator('#canvas text[data-drawing-key]').first().getAttribute('data-drawing-key');
 assert.ok(cableKey&&textKey);
 const legend=page.locator('#canvas rect.diagram-legend-line[data-link-type="SR fiber"]');
 const point=await legend.evaluate(element=>{const box=element.getBoundingClientRect();return {x:box.x+box.width/2,y:box.y+box.height/2};});
 await page.mouse.dblclick(point.x,point.y);await page.waitForFunction(()=>document.querySelector('#dialog').open);
 await measureDialog('legend');await capture('legend-connections',{captionFieldsExpanded:false});
 await page.locator('#dialog .link-caption-fields summary').click();await capture('legend-captions',{captionFieldsExpanded:true});

 await field('Drawing object').selectOption(cableKey);await measureDialog('line');await capture('line-properties');
 await field('Drawing object').selectOption(textKey);await measureDialog('text');await capture('text-properties');
 await page.locator('#dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 assert.deepEqual(errors,[]);
 for(const [name,bounds] of Object.entries(results.dialogBounds))assert.equal(bounds.fits,true,name+' default controls and Save object must fit at 1366 x 768 without scrolling; see results.json');
}catch(error){
 results.failure=error.message;await page.screenshot({path:resolve(output,'failure.png')});throw error;
}finally{
 results.errors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
}
