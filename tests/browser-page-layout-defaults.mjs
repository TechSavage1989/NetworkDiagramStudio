// Real built-editor interactions; all devices, links and captures are fictional.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/page-layout-defaults');await mkdir(output,{recursive:true});
const project={name:'Fictional page-layout validation',devices:[1,2].flatMap(i=>[
 {id:'switch-'+i,name:'LAB-SWITCH-'+i,kind:'switch',vendor:'Aruba',model:'JL255A',ports:Array.from({length:24},(_,n)=>({name:String(n+1),state:'up',native:10,description:'Fictional socket '+(n+1)}))},
 {id:'ap-'+i,name:'LAB-AP-'+i,kind:'ap',model:'AP-515',ports:[{name:'eth0',state:'up'}]}
]),links:[1,2].map(i=>({a:'switch-'+i,ap:'1',b:'ap-'+i,bp:'eth0',media:'copper',speed:'1 Gbps'})),layout:{portMap:{presentation:'separate'}}};
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
const open=async input=>{
 await page.locator('#project-file').setInputFiles(input);
 await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent?.includes('Project opened'));
};
const save=async name=>{
 const waiting=page.waitForEvent('download');await page.locator('#save').click();
 const download=await waiting,path=resolve(output,name);await download.saveAs(path);
 return {path,doc:JSON.parse(await readFile(path,'utf8'))};
};
const options=async()=>{
 await page.locator('#page-options').click();const dialog=page.locator('#dialog');
 await dialog.getByText('Footer and page numbering',{exact:true}).click();
 return {dialog,footer:dialog.getByLabel('Show footer',{exact:true}),numbers:dialog.getByLabel('Show page numbers',{exact:true})};
};
const close=async dialog=>{await dialog.locator('#close').click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);};
const apply=async dialog=>{await dialog.getByRole('button',{name:'Save page options'}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);};
const order=async()=>{
 const names=await page.locator('#page-select option').allTextContents(),maps=names.map((name,i)=>/Port map/i.test(name)&&!/Inventory/i.test(name)?i:-1).filter(i=>i>=0),inventories=names.map((name,i)=>/Port Inventory/i.test(name)?i:-1).filter(i=>i>=0);
 assert.ok(maps.length>=2,'both switches have map sheets');assert.ok(inventories.length>=2,'both switches have inventory sheets');
 assert.ok(Math.max(...maps)<Math.min(...inventories),'all maps precede all inventory pages');return names;
};
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 await open({name:'fictional.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}))});
 const names=await order();
 let controls=await options();assert.equal(await controls.footer.isChecked(),false);assert.equal(await controls.numbers.isChecked(),false);
 await controls.footer.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,'footer-defaults.png')});await close(controls.dialog);
 const portGroup=page.locator('#page-families .page-group').filter({hasText:'Port maps'});await portGroup.locator('summary').click();
 await page.screenshot({path:resolve(output,'consecutive-port-pages.png')});await page.keyboard.press('Escape');
 // Each optional decoration is independently saved, not coupled to its peer.
 controls=await options();await controls.numbers.check();await controls.dialog.getByLabel('First page number',{exact:true}).fill('7');await apply(controls.dialog);
 let saved=await save('numbers-only.nds.json');assert.equal(saved.doc.project.layout.pageNumbers.show,true);assert.equal(saved.doc.project.layout.pageNumbers.footer,false);
 controls=await options();await controls.footer.check();await apply(controls.dialog);
 await page.keyboard.press('Control+z');controls=await options();assert.equal(await controls.footer.isChecked(),false);assert.equal(await controls.numbers.isChecked(),true);await close(controls.dialog);
 await page.keyboard.press('Control+Shift+z');controls=await options();assert.equal(await controls.footer.isChecked(),true);assert.equal(await controls.numbers.isChecked(),true);await close(controls.dialog);
 saved=await save('both-enabled.nds.json');await open(saved.path);controls=await options();assert.equal(await controls.footer.isChecked(),true);assert.equal(await controls.numbers.isChecked(),true);assert.equal(await controls.dialog.getByLabel('First page number',{exact:true}).inputValue(),'7');await close(controls.dialog);
 assert.deepEqual(await order(),names);
 controls=await options();await controls.numbers.uncheck();await apply(controls.dialog);saved=await save('footer-only.nds.json');assert.equal(saved.doc.project.layout.pageNumbers.footer,true);assert.equal(saved.doc.project.layout.pageNumbers.show,false);
 controls=await options();await controls.footer.uncheck();await apply(controls.dialog);saved=await save('both-disabled.nds.json');await open(saved.path);controls=await options();assert.equal(await controls.footer.isChecked(),false);assert.equal(await controls.numbers.isChecked(),false);await close(controls.dialog);
 assert.deepEqual(await order(),names);
 // Backing controls apply to the actual editor, remain undoable and reopen.
 // The sample action exists only on the welcome screen, not an open project.
 await page.locator('#new').click();await page.locator('#welcome').waitFor();
 await page.getByRole('button',{name:'Open sample site',exact:true}).click();await page.waitForSelector('#canvas svg');
 const backingCount=()=>page.locator('#canvas path').filter({has:page.locator('title').filter({hasText:'Caption backing'})}).count();
 const backingOptions=async()=>{await page.locator('#page-layout').click();const d=page.locator('#dialog');await d.getByLabel('Edit page',{exact:true}).selectOption('*');return {dialog:d,mode:d.getByLabel('Port/link label backing',{exact:true}),padding:d.getByLabel('Port/link label padding (px)',{exact:true})};};
 const applyBacking=async d=>{await d.getByRole('button',{name:'Apply layout',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);};
 let backing=await backingOptions();assert.equal(await backing.mode.inputValue(),'white');assert.equal(await backing.padding.inputValue(),'0.5');await close(backing.dialog);assert.ok(await backingCount()>0);
 backing=await backingOptions();await backing.padding.fill('4');await applyBacking(backing.dialog);saved=await save('label-padding.nds.json');assert.deepEqual(saved.doc.project.layout.labelBacking,{padding:4,mode:'white'});
 await page.keyboard.press('Control+z');backing=await backingOptions();assert.equal(await backing.padding.inputValue(),'0.5');await close(backing.dialog);
 await page.keyboard.press('Control+Shift+z');backing=await backingOptions();assert.equal(await backing.padding.inputValue(),'4');await backing.mode.selectOption('transparent');assert.equal(await backing.padding.isDisabled(),true);await applyBacking(backing.dialog);assert.equal(await backingCount(),0);
 saved=await save('transparent-labels.nds.json');await open(saved.path);backing=await backingOptions();assert.equal(await backing.mode.inputValue(),'transparent');assert.equal(await backing.padding.inputValue(),'4');await close(backing.dialog);assert.equal(await backingCount(),0);
 backing=await backingOptions();await backing.mode.selectOption('white');await backing.padding.fill('0');await applyBacking(backing.dialog);assert.ok(await backingCount()>0);
 backing=await backingOptions();await backing.padding.fill('20');await backing.dialog.getByRole('button',{name:'Cancel',exact:true}).click();backing=await backingOptions();assert.equal(await backing.padding.inputValue(),'0');
 await page.screenshot({path:resolve(output,'label-backing-options.png')});await close(backing.dialog);
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'result.json'),JSON.stringify({ok:true,checks:['default decorations off','independent toggles','Undo/redo','save/reopen enabled and disabled','consecutive port pages','tight/transparent label backing','backing Undo/redo and save/reopen','backing cancel'],names},null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error('Browser errors:',errors);throw error;}finally{await browser.close();}
