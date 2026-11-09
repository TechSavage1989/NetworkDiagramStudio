// Synthetic saved-project and actual dialog interactions.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/panel-content');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const project={name:'Fictional panel validation',devices:[1,2].map(i=>({id:'s'+i,name:'LAB-'+i,kind:'switch',model:'JL255A',ports:[{name:'1',native:10}],vlans:[{id:10,name:'Lab'}]})),links:[]};
const open=async input=>{await page.locator('#project-file').setInputFiles(input);await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent?.includes('Project opened'));};
const edit=async()=>{await page.locator('#page-layout').click();const d=page.locator('#dialog');await d.getByLabel('Edit page',{exact:true}).selectOption('*');return d;};
const apply=async d=>{await d.getByRole('button',{name:'Apply layout',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);};
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 await open({name:'fictional.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}))});
 let d=await edit();await d.getByLabel('Show VLANs',{exact:true}).check();await d.getByLabel('Show Routes',{exact:true}).check();
 await d.getByLabel('Panel width',{exact:true}).fill('1');await d.getByRole('button',{name:'Apply layout',exact:true}).click();
 await d.locator('.layout-apply-feedback').waitFor({state:'visible'});assert.match(await d.locator('.layout-apply-feedback').textContent(),/not applied/);assert.equal(await d.getByLabel('Show VLANs',{exact:true}).isChecked(),true);
 await page.screenshot({path:resolve(output,'apply-error.png')});
 await d.getByLabel('Panel width',{exact:true}).fill('244');await d.getByLabel('VLAN display',{exact:true}).selectOption('devices');await apply(d);
 await page.keyboard.press('Control+z');d=await edit();assert.equal(await d.getByLabel('Show VLANs',{exact:true}).isChecked(),false);await d.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.keyboard.press('Control+Shift+z');d=await edit();assert.equal(await d.getByLabel('VLAN display',{exact:true}).inputValue(),'devices');await d.getByLabel('VLAN display',{exact:true}).selectOption('summary');await apply(d);
 const downloading=page.waitForEvent('download');await page.locator('#save').click();const download=await downloading,path=resolve(output,'panel.nds.json');await download.saveAs(path);
 const saved=JSON.parse(await readFile(path,'utf8'));assert.equal(saved.project.layout.presentation.defaults.panel.vlanMode,'summary');await open(path);
 d=await edit();assert.equal(await d.getByLabel('Show VLANs',{exact:true}).isChecked(),true);assert.equal(await d.getByLabel('Sections without data',{exact:true}).inputValue(),'explain');await d.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.screenshot({path:resolve(output,'panel-content.png')});
}finally{await browser.close();}
