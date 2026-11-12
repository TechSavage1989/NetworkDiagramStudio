// Real built-editor interactions; all devices, links and captures are fictional.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {wirelessApLab} from './fixtures/wireless-ap-layout.mjs';
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
 const document=JSON.parse(typeof input==='string'?await readFile(input,'utf8'):input.buffer.toString('utf8')),name=document.project.name;
 // File.text() yields after the input change handler starts. The previous
 // 'Project opened' feedback is still present during that read; never use it
 // alone as evidence that this fixture's drawing has replaced the old one.
 await page.waitForFunction(()=>!document.querySelector('#open')?.disabled);
 await page.locator('#project-file').setInputFiles(input);
 await page.waitForFunction(expected=>document.querySelector('#site')?.value===expected&&document.querySelector('#heading')?.textContent===expected&&!document.querySelector('#open')?.disabled&&!document.querySelector('#export')?.disabled&&!!document.querySelector('#canvas svg')&&document.querySelector('#feedback')?.textContent==='Project opened.',name);
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
const apply=async dialog=>{await dialog.getByRole('button',{name:'Apply paper settings'}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);};
const order=async()=>{
 const names=await page.locator('#page-select option').allTextContents(),maps=names.map((name,i)=>/Port map/i.test(name)&&!/Inventory/i.test(name)?i:-1).filter(i=>i>=0),inventories=names.map((name,i)=>/Port Inventory/i.test(name)?i:-1).filter(i=>i>=0);
 assert.ok(maps.length>=2,'both switches have map sheets');assert.ok(inventories.length>=2,'both switches have inventory sheets');
 assert.ok(Math.max(...maps)<Math.min(...inventories),'all maps precede all inventory pages');return names;
};
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 // Creation uses Letter for port maps; loading an old project below must not
 // apply that creation default to its saved Dynamic paper.
 await page.locator('#sample').click();await page.waitForFunction(()=>document.querySelector('#heading')?.textContent==='Harbor Workshop');
 const fresh=await save('new-letter-default.nds.json');
 assert.equal(fresh.doc.project.layout.pageSetup.visible.groups.ports.preset,'letter');
 assert.equal(fresh.doc.project.layout.pageSetup.visible.groups.ports.orientation,'landscape');
 await open(fresh.path);const reopened=await save('reopened-letter-default.nds.json');
 assert.deepEqual(reopened.doc.project.layout.pageSetup.visible.groups.ports,fresh.doc.project.layout.pageSetup.visible.groups.ports);
 await open({name:'fictional.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}))});
 const oldSaved=await save('old-project-paper.nds.json');assert.equal(oldSaved.doc.project.layout.pageSetup.visible.groups.ports,undefined,'old implicit Dynamic remains unchanged');
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
 // Paper selection preserves one complete wireless drawing by default. The
 // separate readability choice remains explicit, undoable and persistent.
 const densePorts=Array.from({length:32},(_,i)=>({name:'7/'+(i+1)}));
 const dense={name:'Fictional wireless paper validation',devices:[{id:'sw',name:'LAB-STACK',kind:'switch',model:'JL558A',stackMembers:Array.from({length:8},(_,i)=>({id:String(i+1),model:'JL558A'})),ports:densePorts},...Array.from({length:16},(_,i)=>({id:'ap'+i,name:'LAB-AP-FLOOR-'+(i+1),kind:'ap',vendor:'HPE Aruba',model:'AP-515',ip:'192.0.2.'+(i+1),ports:[{name:'eth0'},{name:'eth1'}]}))],links:densePorts.map((p,i)=>({a:'sw',ap:p.name,b:'ap'+Math.floor(i/2),bp:'eth'+i%2,media:'copper',speed:'1 Gbps'}))};
 await open({name:'wireless-paper.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:dense}))});
 const wirelessNames=async()=>(await page.locator('#page-select option').allTextContents()).filter(name=>/Wireless Connections/.test(name));
 assert.equal((await wirelessNames()).length,1);
 controls=await options();assert.equal(await controls.dialog.getByLabel('Paper layout',{exact:true}).inputValue(),'optimize');await controls.dialog.locator('.wireless-paper-options summary').click();await controls.dialog.getByLabel('Wireless layout',{exact:true}).selectOption('layout');
 await controls.dialog.getByLabel('Apply visible page proportions to',{exact:true}).selectOption('group');
 await controls.dialog.getByLabel('Page group',{exact:true}).selectOption('wireless');
 await controls.dialog.getByLabel('Visible page proportions',{exact:true}).selectOption('letter');
 await apply(controls.dialog);assert.equal((await wirelessNames()).length,1);
 saved=await save('wireless-proportional.nds.json');assert.equal(saved.doc.project.layout.pageSetup.visible.wirelessFit,'layout');assert.equal(saved.doc.project.layout.pageSetup.visible.groups.wireless.preset,'letter');
 await open(saved.path);assert.equal((await wirelessNames()).length,1);
 const wirelessIndex=(await page.locator('#page-select option').allTextContents()).findIndex(name=>/Wireless Connections/.test(name));await page.locator('#page-select').selectOption(String(wirelessIndex));
 const outside=await page.locator('#canvas').evaluate(canvas=>{
  const svg=canvas.querySelector('svg'),paper=svg.querySelector(':scope>rect[fill="#fff"]')?.getBoundingClientRect();if(!paper)throw Error('Missing physical paper rectangle');
  return [...svg.querySelectorAll('[data-device-id],path.diagram-cable,text[data-drawing-key]')].filter(node=>{const b=node.getBoundingClientRect();return b.width&&b.height&&(b.left<paper.left-2||b.top<paper.top-2||b.right>paper.right+2||b.bottom>paper.bottom+2);}).map(node=>node.getAttribute('data-drawing-key')||node.getAttribute('data-device-id'));
 });
 assert.deepEqual(outside,[],'choosing Letter keeps every wireless device, caption and cable within the physical sheet');
 await page.screenshot({path:resolve(output,'wireless-letter-proportional.png')});
 // Explicit side-space application refits the old automatic paper frame.
 // It must visibly populate the space beside the stack, not retain only rows.
 const apGeometry=()=>page.locator('#canvas svg').evaluate(svg=>({viewBox:svg.getAttribute('viewBox'),devices:[...svg.querySelectorAll('[data-device-id]')].map(node=>({id:node.getAttribute('data-device-id'),box:node.getBBox().toJSON?.()||{x:node.getBBox().x,y:node.getBBox().y,width:node.getBBox().width,height:node.getBBox().height}}))}));
 const rowGeometry=await apGeometry();
 await page.locator('#page-layout').click();let apDialog=page.locator('#dialog');await apDialog.getByLabel('Edit page',{exact:true}).selectOption('*');
 await apDialog.getByLabel('Wireless APs and details (%)',{exact:true}).fill('150');
 await apDialog.getByLabel('Wireless AP placement',{exact:true}).selectOption('sides');
 await apDialog.getByRole('button',{name:'Apply layout',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 const sideGeometry=await apGeometry();assert.notDeepEqual(sideGeometry,rowGeometry);
 const sideBoxes=await page.locator('#canvas svg').evaluate(svg=>{const sw=svg.querySelector('[data-device-id="sw"]').getBoundingClientRect();return [...svg.querySelectorAll('[data-device-id^="ap"]')].filter(node=>{const b=node.getBoundingClientRect();return b.right<sw.left||b.left>sw.right;}).length;});
 // Paper plans keep 150% AP cards readable on Letter by continuing to more
 // sheets; each sheet still visibly uses the space beside the stack.
 const sheetAps=await page.locator('#canvas svg [data-device-id^="ap"]').count();assert.ok(sideBoxes>=Math.ceil(sheetAps*.4)&&sideBoxes>=4,'APs visibly fill side space on Letter ('+sideBoxes+' of '+sheetAps+')');
 await page.screenshot({path:resolve(output,'wireless-letter-side-space.png')});
 saved=await save('wireless-side-space.nds.json');await open(saved.path);await page.locator('#page-select').selectOption(String((await page.locator('#page-select option').allTextContents()).findIndex(name=>/Wireless Connections/.test(name))));assert.deepEqual(await apGeometry(),sideGeometry,'saved side-space geometry reopens without reverting to rows');

 // Restore the original100% AP fixture before checking its four-sheet
 // readable-continuation budget. The side-space test intentionally enlarged
 // APs to150%, which correctly needs more sheets and is a different case.
 await open(resolve(output,'wireless-proportional.nds.json'));
 controls=await options();await controls.dialog.locator('.wireless-paper-options summary').click();await controls.dialog.getByLabel('Wireless layout',{exact:true}).selectOption('readable');await apply(controls.dialog);
 const continued=(await wirelessNames()).length;assert.ok(continued>1&&continued<=4);
 saved=await save('wireless-readable.nds.json');assert.equal(saved.doc.project.layout.pageSetup.visible.wirelessFit,'readable');
 await page.keyboard.press('Control+z');assert.equal((await wirelessNames()).length,1);
 await page.keyboard.press('Control+Shift+z');assert.equal((await wirelessNames()).length,continued);
 await open(saved.path);assert.equal((await wirelessNames()).length,continued);controls=await options();assert.equal(await controls.dialog.getByLabel('Wireless layout',{exact:true}).inputValue(),'readable');await close(controls.dialog);
 // Independent fixture: optimize means readable side cards, not a tiny
 // containment-only fit. Keep old preserve/readable cases above unchanged.
 const adaptive=wirelessApLab(32,8);adaptive.name='Fictional adaptive wireless paper';
 adaptive.devices[0].ports.forEach((port,i)=>port.name='7/'+(i+1));adaptive.links.forEach((link,i)=>link.ap='7/'+(i+1));
 await open({name:'wireless-adaptive.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:adaptive}))});
 await page.locator('#page-select').selectOption(String((await page.locator('#page-select option').allTextContents()).findIndex(name=>/Wireless Connections/.test(name))));
 await page.locator('#active-page-paper').selectOption('letter');await page.waitForFunction(()=>document.querySelector('#page-overflow-notice')?.textContent.includes('AP details print at'));
 assert.equal((await wirelessNames()).length,1,'all 32 AP cards stay on their switch\'s Letter sheet');
 await page.locator('#page-select').selectOption(String((await page.locator('#page-select option').allTextContents()).findIndex(name=>/Wireless Connections/.test(name))));
 {const notice=await page.locator('#page-overflow-notice').textContent(),pt=Number(notice.match(/AP details print at ([\d.]+) pt/)?.[1]);assert.ok(pt>=4,'AP details print at '+pt+' pt');assert.match(notice,/all 32 AP links stay on this sheet with their switch/,'the AP note explains the one-sheet size');}
 const assertNoticeFits=async()=>{const bounds=await page.locator('#page-overflow-notice').evaluate(node=>{const a=node.getBoundingClientRect(),b=node.parentElement.getBoundingClientRect();return {left:a.left,right:a.right,parentLeft:b.left,parentRight:b.right,scroll:node.scrollWidth,width:node.clientWidth,whiteSpace:getComputedStyle(node).whiteSpace};});assert.ok(bounds.left>=bounds.parentLeft-1&&bounds.right<=bounds.parentRight+1,'full notice remains inside page toolbar');assert.ok(bounds.scroll<=bounds.width+1,'notice wraps rather than clipping content');assert.equal(bounds.whiteSpace,'normal');};
 await assertNoticeFits();const priorViewport=page.viewportSize();await page.setViewportSize({width:620,height:900});await assertNoticeFits();await page.setViewportSize(priorViewport);await assertNoticeFits();
 const adaptiveGeometry=await apGeometry();
 await page.screenshot({path:resolve(output,'wireless-adaptive-paper.png')});
 saved=await save('wireless-adaptive-paper.nds.json');assert.equal(saved.doc.project.layout.pageSetup.visible.wirelessFit,'adaptive');
 await open(saved.path);await page.locator('#page-select').selectOption(String((await page.locator('#page-select option').allTextContents()).findIndex(name=>/Wireless Connections/.test(name))));
 assert.deepEqual(await apGeometry(),adaptiveGeometry,'adaptive cards and physical fit survive reopen');
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
 // Device name and details corners: offered from the network page itself, and
 // for one selected device in Edit drawing (one Undo step).
 const coreIndex=(await page.locator('#page-select option').allTextContents()).findIndex(name=>/Core Network/.test(name));await page.locator('#page-select').selectOption(String(coreIndex));
 await page.waitForFunction(()=>document.querySelector('#canvas svg')?.getAttribute('aria-label')?.startsWith('Core Network'));
 await page.locator('#page-layout').click();await page.locator('#dialog').getByLabel('Device name position (network pages)',{exact:true}).waitFor();
 assert.equal(await page.locator('#dialog').getByLabel('Device details position (network pages)',{exact:true}).inputValue(),'below-left','details default below, left');
 await close(page.locator('#dialog'));
 const sceneBox=key=>page.locator('#canvas svg').evaluate((svg,key)=>{const n=[...svg.querySelectorAll('[data-drawing-key="'+key+'"]')].find(n=>!n.closest('.transform-controls'));const b=n.getBBox(),m=svg.getCTM().inverse().multiply(n.getCTM());return {x:m.a*b.x+m.e,y:m.d*b.y+m.f,w:b.width*m.a,h:b.height*m.d};},key);
 const bodyKey='Core Network|device|sw-1|body',titleKey='Core Network|title|sw-1';
 const titleBefore=await sceneBox(titleKey),bodyBefore=await sceneBox(bodyKey);assert.ok(titleBefore.y+titleBefore.h<=bodyBefore.y+1,'the name starts above its device');
 if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();const barBefore=await page.locator('.edit-bars').evaluate(n=>n.getBoundingClientRect().height);await page.locator('#canvas svg [data-drawing-key="'+bodyKey+'"]').first().click({position:{x:8,y:8}});
 await page.waitForFunction(()=>document.querySelector('#drawing-selection').textContent==='1 selected');assert.ok(await page.locator('.edit-bars').evaluate(n=>n.getBoundingClientRect().height)<=barBefore+4,'selecting a device does not add a toolbar row, so the drawing does not move');
 await page.locator('#drawing-properties').click();const props=page.locator('#dialog'),namePosition=props.getByLabel('Name position (network pages)',{exact:true});
 assert.equal(await namePosition.inputValue(),'');assert.match(await namePosition.locator('option').first().textContent(),/Drawing default \(Above, left\)/);
 await namePosition.selectOption('below-right');await props.getByRole('button',{name:'Save object',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 const titleAfter=await sceneBox(titleKey),bodyAfter=await sceneBox(bodyKey);assert.ok(titleAfter.y>=bodyAfter.y+bodyAfter.h-1,'the chosen device name moves below its device');
 assert.ok(bodyAfter.x+bodyAfter.w-(titleAfter.x+titleAfter.w)<bodyAfter.w/2,'toward the right edge');
 await page.keyboard.press('Control+z');await page.waitForFunction(key=>{const n=document.querySelector('#canvas svg [data-drawing-key="'+key+'"]');return !!n;},titleKey);
 const titleUndo=await sceneBox(titleKey);assert.ok(Math.abs(titleUndo.y-titleBefore.y)<1,'one Undo restores the name');
 if(await page.locator('#edit-drawing').getAttribute('aria-pressed')==='true')await page.locator('#edit-drawing').click();
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'result.json'),JSON.stringify({ok:true,checks:['default decorations off','independent toggles','Undo/redo','save/reopen enabled and disabled','consecutive port pages','tight/transparent label backing','backing Undo/redo and save/reopen','backing cancel','whole wireless Letter fit','side-space AP placement and save/reopen','explicit readable continuation','device caption corners on the network page and per device','adaptive side cards at actual8.3pt and reopen','wireless fit Undo/redo and save/reopen'],names},null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error('Browser errors:',errors);throw error;}finally{await browser.close();}
