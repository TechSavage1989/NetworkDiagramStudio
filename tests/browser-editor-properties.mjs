// Run against the built offline app. Every fixture and capture is fictional.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/editor-properties');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],results={};page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
const field=name=>page.locator('#dialog').getByLabel(name,{exact:true});
const ready=()=>page.waitForFunction(()=>!document.querySelector('#dialog').open&&!document.querySelector('#save').disabled);
const fresh=async()=>{await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);await page.locator('#sample').click();await page.waitForSelector('#canvas svg .diagram-cable',{state:'attached'});await page.locator('#canvas svg').waitFor();};
const objectField=()=>field('Drawing object');
const downloadProject=async name=>{const waiting=page.waitForEvent('download');await page.locator('#save').click();const download=await waiting,path=resolve(output,name);await download.saveAs(path);return {path,doc:JSON.parse(await readFile(path,'utf8'))};};
const pointer=async locator=>{const box=await locator.boundingBox();assert.ok(box);return {x:box.x+box.width/2,y:box.y+box.height/2};};
try{
 await fresh();await page.screenshot({path:resolve(output,'hero.png')});
 // A legend key highlights and double-clicks even before Edit drawing is on.
 const legend=page.locator('#canvas rect.diagram-legend-line[data-link-type="SR fiber"]'),legendKey=await legend.getAttribute('data-drawing-key'),at=await pointer(legend);
 await page.mouse.move(at.x,at.y);await page.waitForFunction(key=>document.querySelector('rect.diagram-legend-line.cable-hover')?.getAttribute('data-drawing-key')===key,legendKey);
 assert.equal(await legend.getAttribute('tabindex'),null);assert.equal(await page.locator('#edit-drawing').getAttribute('aria-pressed'),'false');
 await page.mouse.dblclick(at.x,at.y);await page.waitForFunction(()=>document.querySelector('#dialog').open);assert.equal(await page.locator('#edit-drawing').getAttribute('aria-pressed'),'true');assert.equal(await objectField().inputValue(),legendKey);
 assert.equal(await page.locator('#dialog-body label').filter({hasText:/^(Left|Top)( \(|$)/}).count(),0);
 assert.equal(await field('Stroke').count(),0);assert.equal(await page.getByRole('button',{name:'Configure link type, speed and captions',exact:true}).count(),0);
 assert.equal(Number(await field('Line width').inputValue()),4);
 await field('Line width').fill('7');assert.equal(await page.locator('#dialog .line-preview path').getAttribute('stroke-width'),'7');
 await field('Cable type').selectOption('AOC');await field('Link speed').selectOption('25 Gbps');
 await page.locator('#dialog .link-caption-fields summary').click();await field('Legend title').fill('Building uplinks');await field('Line title').fill('Uplink');await field('Line description').fill('Lab link');await field('HEX').fill('#815AC0');
 await page.screenshot({path:resolve(output,'legend-connections.png')});
 await page.getByRole('button',{name:'Save object',exact:true}).click();await ready();
 const changed=page.locator('#canvas rect.diagram-legend-line[data-link-type="AOC"]');await changed.waitFor();assert.equal(Number(await changed.getAttribute('height')),7);assert.equal(await changed.getAttribute('fill'),'#815AC0');assert.equal(await changed.locator('title').textContent(),'AOC color key');
 const saved=await downloadProject('editor-properties.nds'),connection=saved.doc.project.links.find(link=>link.a==='edge'&&link.b==='sw-1');assert.equal(connection.media,'AOC');assert.equal(connection.speed,'25 Gbps');assert.equal(saved.doc.project.layout.linkStyles.AOC.weight,7);
 assert.ok(await page.locator('#canvas text').filter({hasText:'Uplink'}).count());assert.ok(await page.locator('#canvas text').filter({hasText:'Lab link'}).count());
 results.legend={hover:true,doubleClickEntersEdit:true,actualWidth:true,metadataAndCaptionsSavedTogether:true};
 await page.locator('#drawing-undo').click();await page.waitForSelector('#canvas rect.diagram-legend-line[data-link-type="SR fiber"]');assert.equal(await page.locator('#canvas rect.diagram-legend-line[data-link-type="AOC"]').count(),0);
 await page.locator('#drawing-redo').click();await changed.waitFor();assert.equal(Number(await changed.getAttribute('height')),7);
 await page.locator('#project-file').setInputFiles(saved.path);await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent==='Project opened.');await changed.waitFor();assert.equal(Number(await changed.getAttribute('height')),7);
 const reopened=await downloadProject('reopened.nds');
 results.undoRedoReopen=true;
 // Reopen the original cable through the displayed path; there is only one
 // type/speed editor and its Cancel action does not mutate any saved setting.
 const cable=page.locator('#canvas path.diagram-cable[stroke="#815AC0"]');assert.equal(await cable.count(),1);await cable.waitFor({state:'attached'});const cableKey=await cable.getAttribute('data-drawing-key');
 // Legend double-click opens the same object selector without depending on a
 // thin path being unobscured by its own caption. The selected cable is real.
 const nextPoint=await pointer(changed);await page.mouse.dblclick(nextPoint.x,nextPoint.y);await page.waitForFunction(()=>document.querySelector('#dialog').open);await objectField().selectOption(cableKey);
 assert.equal(await field('Cable type').inputValue(),'AOC');assert.equal(await field('Link speed').inputValue(),'25 Gbps');assert.equal(Number(await field('Line width').inputValue()),7);
 await field('Line width').fill('5');assert.equal(await page.locator('#dialog .line-preview path').getAttribute('stroke-width'),'5');await field('Link speed').selectOption('10 Gbps');
 await page.screenshot({path:resolve(output,'connection-properties.png')});await page.locator('#dialog').getByRole('button',{name:'Cancel',exact:true}).click();await ready();
 const cancelled=await downloadProject('cancelled.nds');assert.deepEqual(cancelled.doc.project,reopened.doc.project);results.cancelPreservesProject=true;
 // Double-click a grouped device in view mode and keep it selected for mouse
 // or arrow-key movement after closing properties, without coordinate fields.
 await fresh();const device=page.locator('#canvas g[data-device-id="sw-1"][data-drawing-key$="|body"]'),devicePoint=await device.evaluate(group=>{const box=group.getBoundingClientRect();for(const fx of [.02,.1,.95,.5])for(const fy of [.3,.6,.8]){const x=box.x+box.width*fx,y=box.y+box.height*fy,target=document.elementFromPoint(x,y);if(target&&group.contains(target)&&!target.closest('text'))return {x,y};}return null;});assert.ok(devicePoint);await page.mouse.dblclick(devicePoint.x,devicePoint.y);await page.waitForFunction(()=>document.querySelector('#dialog').open);
 assert.equal(await page.locator('#edit-drawing').getAttribute('aria-pressed'),'true');assert.equal(await objectField().inputValue(),await device.getAttribute('data-drawing-key'));assert.equal(await page.locator('#dialog-body label').filter({hasText:/^(Left|Top)( \(|$)/}).count(),0);
 await page.locator('#dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('#drawing-selection').textContent(),'1 selected');results.deviceDoubleClick=true;
 // An ordinary line's double-click also enters Edit drawing in view mode.
 await fresh();const target=await page.evaluate(async()=>{const {cableGeometry}=await import('nds/cable-proximity.mjs');const svg=document.querySelector('#canvas svg'),m=svg.getScreenCTM();for(const path of svg.querySelectorAll('path.diagram-cable'))for(const s of cableGeometry(path.getAttribute('d')).segments){if(s.arc||s.ellipse)continue;for(const fraction of [.5,.3,.7]){const x=(s.a[0]+(s.b[0]-s.a[0])*fraction)*m.a+m.e,y=(s.a[1]+(s.b[1]-s.a[1])*fraction)*m.d+m.f,element=document.elementFromPoint(x,y);if(element===path)return {x,y,key:path.getAttribute('data-drawing-key')};}}return null;});assert.ok(target);
 await page.mouse.dblclick(target.x,target.y);await page.waitForFunction(()=>document.querySelector('#dialog').open);assert.equal(await objectField().inputValue(),target.key);assert.equal(await page.locator('#edit-drawing').getAttribute('aria-pressed'),'true');results.cableDoubleClick=true;
 await page.locator('#dialog').getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('#link-styles').click();await page.screenshot({path:resolve(output,'line-colors.png')});
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'results.json'),JSON.stringify({...results,errors},null,2));console.log(JSON.stringify({...results,errors},null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error('Browser errors:',errors);throw error;}finally{await browser.close();}
