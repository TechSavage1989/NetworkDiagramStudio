// Real-browser coverage for the network page Arrange control: one undoable
// action, saved order kept, and the Pages & layout default.
// Use the same browser/output environment variables as browser-cable-proximity.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),output=resolve(process.env.NDS_QA_OUTPUT||'qa-output/core-arrangement');await mkdir(output,{recursive:true});
const url=process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href;
// Fictional firewall, chassis core and two access stacks.
const port=(name,o={})=>({name,state:'up',native:10,...o});
const stack=(id,name,count)=>({id,name,kind:'switch',vendor:'Aruba',model:'JL558A',stackMembers:Array.from({length:count},(_,i)=>({id:String(i+1),model:'JL558A'})),ports:Array.from({length:count},(_,i)=>[port((i+1)+'/49'),port((i+1)+'/50')]).flat()});
const project={name:'Arrangement browser lab',devices:[
 {id:'fw',name:'LAB-FW',kind:'firewall',vendor:'Fortinet',model:'FortiGate 120G',ports:[{name:'x1',state:'up'},{name:'x2',state:'up'}]},
 {id:'core',name:'LAB-CORE',kind:'switch',vendor:'Aruba',model:'J9850A',modules:[{slot:'A',model:'J9993A'},{slot:'B',model:'J9993A'}],ports:['A','B'].flatMap(s=>Array.from({length:8},(_,i)=>port(s+(i+1))))},
 stack('idf1','LAB-IDF1',4),stack('idf2','LAB-IDF2',3)],
 links:[['fw','x1','core','A1'],['fw','x2','core','B1'],['core','A2','idf1','1/49'],['core','B2','idf1','4/49'],['core','A3','idf2','1/49'],['core','B3','idf2','3/49']].map(([a,ap,b,bp])=>({a,ap,b,bp,media:'SR',speed:'10 Gbps',status:'confirmed'})),
 stencils:{},optics:{},warnings:[],layout:{order:['fw','core','idf1','idf2'],corePages:[],coreExclude:[],includeAPs:false}};
const fixture=resolve(output,'arrangement-lab.nds.json');await writeFile(fixture,JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],result={};page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
// The drawing itself, without the editor's zoom/pan view transform.
const scene=()=>page.locator('#canvas svg').evaluate(svg=>{const clone=svg.cloneNode(true);clone.removeAttribute('style');for(const node of clone.querySelectorAll('[data-editor-only],.diagram-selection,.cable-controls'))node.remove();return clone.outerHTML;});
const columns=()=>page.locator('#canvas svg').evaluate(svg=>{const xs=[...svg.querySelectorAll('[data-drawing-key$="|body"]')].filter(n=>/\|device\|(?:core|idf1|idf2|fw)\|/.test(n.dataset.drawingKey)).map(n=>Math.round(n.getBBox().x));return new Set(xs).size;});
try{
 await page.goto(url);await page.locator('#project-file').setInputFiles(fixture);await page.waitForSelector('#canvas svg');await page.locator('#edit-drawing').click();
 const arrange=page.locator('#drawing-arrange');assert.equal(await arrange.isVisible(),true);assert.equal(await arrange.isEnabled(),true);assert.equal(await arrange.inputValue(),'compact');
 const baseline=await scene();result.compactColumns=await columns();assert.ok(result.compactColumns>1,'Compact packs the default page into several columns');assert.equal(await page.locator('#drawing-undo').isDisabled(),true);
 await page.screenshot({path:resolve(output,'compact.png')});
 await arrange.selectOption('vertical');await page.waitForFunction(()=>/re-arranged/.test(document.querySelector('#feedback').textContent));
 result.verticalColumns=await columns();assert.equal(result.verticalColumns,1);assert.notEqual(await scene(),baseline);assert.equal(await arrange.inputValue(),'vertical');
 await page.screenshot({path:resolve(output,'vertical.png')});
 await page.locator('#drawing-undo').click();assert.equal(await scene(),baseline,'Undo restores the compact page in one step');assert.equal(await arrange.inputValue(),'compact');assert.equal(await page.locator('#drawing-undo').isDisabled(),true);
 await page.locator('#drawing-redo').click();assert.equal(await columns(),1);assert.equal(await arrange.inputValue(),'vertical');
 // The drawing default is also available in Pages & layout.
 await page.locator('#page-layout').click();await page.locator('#dialog select').first().selectOption('*');
 const field=page.getByLabel('Network page arrangement',{exact:true});assert.equal(await field.inputValue(),'vertical');await field.selectOption('columns-2');
 await page.getByRole('button',{name:'Apply layout',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 assert.equal(await columns(),2);await page.locator('#edit-drawing').isVisible();assert.equal(await arrange.inputValue(),'columns-2');
 assert.deepEqual(errors,[]);result.errors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error(error);console.error('Browser errors:',errors);console.error('Status:',await page.locator('#feedback').textContent());process.exitCode=1;}finally{await browser.close();}
