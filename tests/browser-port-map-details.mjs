// Real-browser coverage for port map device details: double-clicking a stack
// member on its port map opens that member's details; saving shows them in
// the member heading as one Undo step. Fictional data only.
// Use the same browser/output environment variables as browser-cable-proximity.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),output=resolve(process.env.NDS_QA_OUTPUT||'qa-output/port-map-details');await mkdir(output,{recursive:true});
const url=process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href;
const ports=[];for(const member of [1,2])for(let port=1;port<=52;port++)ports.push({name:member+'/'+port,state:port%4?'up':'down',native:port>48?null:10+(port%2),tagged:port>48?[10,11]:[]});
const project={name:'Port map lab',devices:[{id:'idf',name:'LAB-IDF',kind:'switch',vendor:'Aruba',model:'JL256A',ip:'192.0.2.10',stackMembers:[{id:'1',model:'JL256A'},{id:'2',model:'JL256A'}],modules:[],vlans:[{id:10,name:'Users'},{id:11,name:'Voice'}],ports}],links:[],stencils:{},optics:{},warnings:[],layout:{}};
const fixture=resolve(output,'port-map-lab.nds.json');await writeFile(fixture,JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[],result={};
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
const feedback=pattern=>page.waitForFunction(source=>new RegExp(source,'i').test(document.querySelector('#feedback').textContent),pattern.source);
const field=label=>page.locator('#dialog').getByLabel(label,{exact:true});
const heading=member=>page.locator('#canvas svg text').filter({hasText:new RegExp('^Member '+member+' \\|')});
try{
 await page.goto(url);await page.locator('#project-file').setInputFiles(fixture);await page.waitForSelector('#canvas svg');
 const options=await page.locator('#page-select option').evaluateAll(options=>options.map(option=>({value:option.value,label:option.textContent})));
 const map=options.find(option=>/Port map/i.test(option.label));assert.ok(map,'the port map page is listed');
 await page.locator('#page-select').selectOption(map.value);await page.waitForFunction(()=>[...document.querySelectorAll('#canvas svg text')].some(text=>/^Member 2 \|/.test(text.textContent)));
 await page.locator('#zoom-fit').click();
 // Double-click the panel body of member 2, beside its sockets.
 const panel=page.locator('#canvas svg rect[data-drawing-key$="|body"]').nth(1);const box=await panel.boundingBox();
 await page.mouse.dblclick(box.x+box.width-6,box.y+box.height-4);await page.waitForFunction(()=>document.querySelector('#dialog').open);
 assert.equal((await page.locator('#dialog-title').textContent()).trim(),'Port map details');
 assert.match(await page.locator('#dialog').textContent(),/Member 2/);
 for(const label of ['Device name','Model','Management IP','MAC address(es)','Member model','Display name','Serial number','Asset tag','Notes'])assert.equal(await field(label).count(),1,label+' field');
 assert.equal(await field('Device name').inputValue(),'LAB-IDF');assert.equal(await field('Member model').inputValue(),'JL256A');
 assert.equal(await field('Model').getAttribute('data-suggestion-list'),'known-hardware-models','models come from the hardware database');assert.equal(await field('Member model').getAttribute('data-suggestion-list'),'known-hardware-models');
 await page.screenshot({path:resolve(output,'dialog.png')});
 await field('Serial number').fill('SN-TEST-2');await field('Asset tag').fill('IT-7');await field('MAC address(es)').fill('not-a-mac');
 await page.getByRole('button',{name:'Save details',exact:true}).click();await feedback(/MAC/);assert.equal(await page.locator('#dialog').evaluate(d=>d.open),true,'an invalid value keeps the dialog open');
 await field('MAC address(es)').fill('0011.2233.4455');await page.getByRole('button',{name:'Save details',exact:true}).click();await feedback(/Port map details saved/);
 await page.waitForFunction(()=>[...document.querySelectorAll('#canvas svg text')].some(text=>/^Member 2 \|.*S\/N SN-TEST-2 \| Asset IT-7/.test(text.textContent)));
 result.heading=await heading(2).first().textContent();assert.doesNotMatch(await heading(1).first().textContent(),/SN-TEST-2/,'member 1 keeps its own heading');
 await page.screenshot({path:resolve(output,'saved.png')});
 // One Undo step restores the heading.
 await page.locator('#canvas').focus();await page.keyboard.press('Control+z');
 await page.waitForFunction(()=>![...document.querySelectorAll('#canvas svg text')].some(text=>/SN-TEST-2/.test(text.textContent)));
 assert.deepEqual(errors,[]);result.ok=true;
}catch(error){result.failure=error.message;await page.screenshot({path:resolve(output,'failure.png')});throw error;}
finally{result.errors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
