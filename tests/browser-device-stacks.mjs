import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rotationProject} from './fixtures/device-rotation.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/device-stacks');await mkdir(output,{recursive:true});
const source=rotationProject(),fixture=resolve(output,'stacks.nds.json');await writeFile(fixture,JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:source}));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const dialog=page.locator('#dialog');
async function open(){await page.locator('#devices .device-details').filter({hasText:'LAB-a'}).click();await dialog.getByRole('button',{name:'Configure device stack',exact:true}).click();await dialog.getByLabel('Stack name',{exact:true}).waitFor();}
async function saveFile(name){const waiting=page.waitForEvent('download');await page.locator('#save').click();const file=resolve(output,name);await (await waiting).saveAs(file);return {file,project:JSON.parse(await readFile(file,'utf8')).project};}
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);await page.locator('#project-file').setInputFiles(fixture);await page.locator('#devices .device-details').first().waitFor();
 await open();await dialog.getByLabel('Stack name',{exact:true}).fill('Discard me');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await dialog.isVisible(),false);
 await open();assert.notEqual(await dialog.getByLabel('Stack name',{exact:true}).inputValue(),'Discard me');await dialog.getByLabel('Stack name',{exact:true}).fill('Fictional lab stack');await dialog.getByRole('button',{name:'Add existing device',exact:true}).click();await dialog.getByLabel('Stack device',{exact:true}).nth(1).selectOption('b');
 await dialog.getByLabel('Stack member number',{exact:true}).nth(1).fill('1');await dialog.getByRole('button',{name:'Save stack',exact:true}).click();assert.equal(await dialog.isVisible(),true,'Duplicate member number must not save');
 await dialog.getByLabel('Stack member number',{exact:true}).nth(0).fill('2');await dialog.getByRole('button',{name:'Save stack',exact:true}).click();await dialog.waitFor({state:'hidden'});
 assert.ok(await page.locator('#canvas').getByText('Fictional lab stack · member 2',{exact:false}).count());
 await page.locator('#undo-devices').click();assert.equal(await page.locator('#devices').getByText('Fictional lab stack · member 2',{exact:true}).count(),0);
 if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();await page.locator('#drawing-redo').click(); // Global history restores the entire association atomically.
 const saved=await saveFile('saved.nds.json');assert.deepEqual(saved.project.layout.deviceStacks[0].members,[{deviceId:'b',number:1},{deviceId:'a',number:2}]);assert.deepEqual(saved.project.devices,source.devices);assert.deepEqual(saved.project.links,source.links);
 await page.locator('#project-file').setInputFiles(saved.file);await open();assert.equal(await dialog.getByLabel('Stack device',{exact:true}).nth(0).inputValue(),'b');
 await page.screenshot({path:resolve(output,'device-stacks.png')});await dialog.getByRole('button',{name:'Remove member',exact:true}).nth(0).click();await dialog.getByRole('button',{name:'Save stack',exact:true}).click();
 const removed=await saveFile('member-removed.nds.json');assert.deepEqual(removed.project.layout.deviceStacks[0].members,[{deviceId:'a',number:2}]);assert.deepEqual(removed.project.devices,source.devices);assert.deepEqual(removed.project.links,source.links);
 await open();await dialog.getByRole('button',{name:'Dissolve stack',exact:true}).click();const dissolved=await saveFile('dissolved.nds.json');assert.deepEqual(dissolved.project.layout.deviceStacks,[]);assert.deepEqual(dissolved.project.devices,source.devices);assert.deepEqual(dissolved.project.links,source.links);assert.deepEqual(errors,[]);
 console.log('Device stack association/order, duplicate validation, Cancel, Undo/Redo, member removal, dissolve, caption, save/reopen and source preservation passed.');
}finally{await browser.close();}
