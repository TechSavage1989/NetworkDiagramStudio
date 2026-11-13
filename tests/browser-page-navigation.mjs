// Real browser interactions against the built offline app, using fictional data.
import assert from 'node:assert/strict';
import {sampleSite} from '../src/web/sample.mjs';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/page-navigation');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 await page.getByRole('button',{name:'Open sample site',exact:true}).click();await page.waitForSelector('#page-families .page-group summary');
 for(const name of ['View','Styles','Page','Quick export']) assert.equal(await page.locator('.workspace-action-group').filter({has:page.locator('.workspace-group-label',{hasText:new RegExp('^'+name+'$')})}).count(),1,'workspace commands have visible purpose groups');
 assert.equal(await page.locator('.workspace-actions #edit-drawing').count(),1,'direct editing stays one click away');
 // Paper changes are available without opening a dialog and belong only to this page.
 const quickPaper=page.locator('#active-page-paper'),quickOrientation=page.locator('#active-page-orientation');
 // New projects start on Letter; choose A4 to record a change.
 assert.equal(await quickPaper.inputValue(),'letter');
 await quickPaper.selectOption('a4');
 assert.equal(await page.locator('#dialog').evaluate(d=>d.open),false);
 assert.equal(await quickPaper.inputValue(),'a4');
 await quickOrientation.selectOption('portrait');
 assert.equal(await quickOrientation.inputValue(),'portrait');
 assert.match(await page.locator('#active-page-paper-status').textContent(),/Auto-fit/);assert.equal((await page.locator('#active-page-lock').textContent()).trim(),'Unlocked');assert.equal(await page.locator('#active-page-lock').getAttribute('aria-pressed'),'false');
 await page.locator('#canvas').click({position:{x:10,y:10}});await page.keyboard.press('Control+z');
 await page.waitForFunction(()=>document.getElementById('active-page-orientation').value==='landscape');
 await page.keyboard.press('Control+z');
 await page.waitForFunction(()=>document.getElementById('active-page-paper').value==='letter');
 await quickPaper.selectOption('custom');
 assert.equal(await page.locator('#dialog').evaluate(d=>d.open),true);
 assert.equal(await page.getByLabel('Visible page proportions',{exact:true}).inputValue(),'custom');
 await page.locator('#dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(await quickPaper.inputValue(),'letter','cancelling custom paper leaves current page unchanged');
 const groups=page.locator('#page-families .page-group'),portGroup=groups.filter({hasText:'Port maps'});
 assert.ok(await groups.count()>=3,'sample has multiple page groups');
 assert.equal(await portGroup.count(),1);
 // Port Inventory tables are their own sidebar group, separate from the maps.
 const inventoryGroup=groups.filter({has:page.locator('summary',{hasText:/^Port inventory \(\d+\)$/})});
 assert.equal(await inventoryGroup.count(),1,'Port inventory has its own page group');
 assert.ok((await inventoryGroup.locator('button[data-page]').allTextContents()).every(name=>/^Port Inventory/.test(name)),'the inventory group lists only inventory pages');
 assert.ok((await portGroup.locator('button[data-page]').allTextContents()).every(name=>!/^Port Inventory/.test(name)),'port maps no longer list inventory pages');
 // Each switch has its own inventory sheet. The page menu puts devices on one
 // sheet as one Undo step.
 await inventoryGroup.locator('summary').click();
 const sidebarNames=()=>page.locator('#page-families button[data-page]').allTextContents();
 assert.deepEqual(await inventoryGroup.locator('button[data-page]').allTextContents(),['Port Inventory - SW-1','Port Inventory - SW-2'],'one inventory sheet per switch');
 await inventoryGroup.locator('button[data-page]').first().click({button:'right'});
 await page.getByRole('menuitem',{name:'Devices on these pages…',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#dialog').open);
 const joins=page.locator('#dialog').getByLabel('SW-2',{exact:true});
 assert.equal(await joins.inputValue(),'own','SW-2 starts on its own sheet');
 await joins.selectOption('@sw-1');await page.locator('#dialog').getByRole('button',{name:'Apply',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 await page.waitForFunction(()=>[...document.querySelectorAll('#page-families button[data-page]')].some(b=>b.textContent==='Port Inventory - SW-1, SW-2'));
 assert.ok(!(await sidebarNames()).includes('Port Inventory - SW-2'),'SW-2 joined the SW-1 sheet');
 await page.locator('#canvas').click({position:{x:10,y:10}});await page.keyboard.press('Control+z');
 await page.waitForFunction(()=>[...document.querySelectorAll('#page-families button[data-page]')].some(b=>b.textContent==='Port Inventory - SW-2'));
 await inventoryGroup.locator('summary').click();
 await portGroup.locator('summary').click();
 assert.ok(await portGroup.evaluate(e=>e.open),'sidebar group expands its page list');
 assert.equal(await page.locator('main > aside#page-navigation').count(),1,'page groups live in their own sidebar');
 assert.equal(await page.locator('.stagebar #page-navigation, .pagebar #tabs').count(),0,'no top page tabs remain');
 const rulerTop=page.locator('#canvas .page-ruler-top'),unit=page.locator('#canvas .page-ruler-unit');
 assert.equal(await rulerTop.count(),1);
 const firstUnit=await unit.textContent();await unit.click();assert.notEqual(await unit.textContent(),firstUnit);
 await page.locator('#zoom-in').click();assert.ok(Number(await rulerTop.getAttribute('width'))>0);
 assert.equal(await portGroup.evaluate(el=>el.open),true,'canvas controls do not dismiss persistent lists');
 const list=portGroup.locator('.page-group-menu');
 assert.ok(await list.locator('button').count()>0,'sidebar lists pages');
 const lastName=await list.locator('button').last().textContent();
 await list.locator('button').last().focus();await page.keyboard.press('Enter');
 await page.waitForFunction(name=>document.querySelector('#page-select').selectedOptions[0].textContent===name,lastName);
 assert.equal(await page.locator('#tabs button[aria-current="page"]').textContent(),lastName);
 await page.locator('#canvas').click({position:{x:30,y:40}});
 assert.equal(await portGroup.evaluate(el=>el.open),true,'outside click leaves sidebar expanded');
 await portGroup.locator('summary').focus();await page.keyboard.press('Enter');
 assert.equal(await portGroup.evaluate(el=>el.open),false,'keyboard collapses a group');
 await page.keyboard.press('Enter');assert.equal(await portGroup.evaluate(el=>el.open),true);
 const nav=page.locator('#page-families');
 await nav.evaluate(e=>{e.style.maxHeight='90px';e.scrollTop=0;});
 assert.ok(await nav.evaluate(e=>e.scrollHeight>e.clientHeight),'long page lists scroll vertically');
 const bounds=await nav.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.wheel(0,360);
 await page.waitForFunction(()=>document.querySelector('#page-families').scrollTop>0);
 const scrolled=await nav.evaluate(e=>e.scrollTop);
 await nav.evaluate(e=>{e.style.maxHeight='';});
 for(const [width,height] of [[1366,768],[1024,768],[900,768],[768,768],[620,900],[390,844]]){
  await page.setViewportSize({width,height});await page.locator('#zoom-fit').click();
  const geometry=await page.evaluate(()=>{const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};};return {canvas:box('#canvas'),nav:box('#page-families'),aside:box('.pages-sidebar'),project:box('.project-sidebar'),overflow:document.documentElement.scrollWidth>innerWidth+1};});
  assert.ok(geometry.canvas.width>300&&geometry.canvas.height>150,'responsive canvas stays usable');
  assert.ok(geometry.nav.left>=geometry.aside.left&&geometry.nav.right<=geometry.aside.right,'page lists stay within sidebar');
  assert.equal(geometry.overflow,false,'no horizontal document overflow');
  const actions=await page.locator('.workspace-actions button:not([hidden])').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {id:b.id,left:r.left,right:r.right,width:r.width,height:r.height};}));
  assert.ok(actions.every(b=>b.width>0&&b.height>0&&b.left>=0&&b.right<=width+1), 'all grouped commands remain visible within the viewport');

  if(width>=1000){
   assert.ok(geometry.aside.left>=geometry.project.right-1,'pages rail is immediately right of project sidebar');
   assert.ok(geometry.canvas.left>=geometry.aside.right-1,'drawing canvas follows the pages rail');
   assert.ok(geometry.nav.height>height/2,'page list uses the available sidebar height');
  }else if(width>620){
   assert.ok(geometry.aside.left>=geometry.project.right-1,'narrow layout retains separate side-by-side panels');
   assert.ok(geometry.canvas.top>=geometry.aside.bottom,'narrow canvas sits below the bounded panels');
   assert.ok(geometry.canvas.width>=width-1,'narrow canvas retains full width');
  }
  assert.equal(await page.locator('.project-sidebar #page-families').count(),0);
  assert.equal(await page.locator('.project-sidebar #site, .project-sidebar #drop, .project-sidebar #devices').count(),3,'project controls stay in main sidebar');
  await page.screenshot({path:resolve(output,'sidebar-'+width+'.png')});
 }
 await page.setViewportSize({width:1366,height:768});
 await page.locator('#filter').fill('SW-1');assert.ok(await page.locator('#devices .device-row').count()>0,'inventory remains usable');await page.locator('#filter').fill('');
 const activePage=page.locator('#tabs button.active');await activePage.dblclick();
 const rename=page.locator('#page-families .page-tab-rename');await rename.fill('Fictional renamed map');await rename.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#page-select').selectedOptions[0].textContent==='Fictional renamed map');
 assert.equal(await page.locator('#tabs button.active').textContent(),'Fictional renamed map','sidebar rename updates page choice');
 await page.locator('#tabs button.active').click({button:'right'});
 assert.ok(await page.getByRole('menuitem',{name:'Rename page',exact:true}).isVisible(),'page context menu survives sidebar move');
 await page.keyboard.press('Escape');
 const values=await page.locator('#page-select option').evaluateAll(options=>options.map(option=>option.value));
 await page.locator('#page-select').selectOption(values[0]);await page.locator('#page-select').selectOption(values.at(-1));
 assert.ok(await nav.evaluate(e=>{const row=e.querySelector('[aria-current="page"]').getBoundingClientRect(),bounds=e.getBoundingClientRect();return row.top>=bounds.top-1&&row.bottom<=bounds.bottom+1;}),'page selector reveals the selected sidebar entry');
 // The closed page picker shows its value on one line: a long page name ends
 // in an ellipsis before the arrow instead of wrapping into a clipped second line.
 const longest=await page.locator('#page-select option').evaluateAll(options=>options.reduce((a,b)=>b.textContent.length>a.textContent.length?b:a).value);
 await page.locator('#page-select').selectOption(longest);
 const picker=await page.locator('#page-select').evaluate(select=>{const box=select.getBoundingClientRect(),shown=select.querySelector('selectedcontent');if(!shown)return {box:box.height,customizable:CSS.supports('appearance','base-select')};const inner=shown.getBoundingClientRect(),style=getComputedStyle(shown);return {box:box.height,customizable:true,text:shown.textContent,selected:select.selectedOptions[0].textContent,lines:inner.height/parseFloat(style.lineHeight||'16'),right:box.right-inner.right,overflow:shown.scrollWidth>shown.clientWidth,ellipsis:style.textOverflow,tooltip:select.querySelector('button')?.title};});
 assert.ok(picker.box<=32,'page picker stays one line high: '+JSON.stringify(picker));
 if(picker.customizable){
  assert.equal(picker.text,picker.selected,'the picker shows the selected page');assert.ok(picker.lines<1.6,'one line of text: '+JSON.stringify(picker));
  assert.ok(picker.right>=12,'the arrow keeps its room: '+JSON.stringify(picker));assert.equal(picker.ellipsis,'ellipsis');assert.equal(picker.tooltip,picker.selected,'the full name is in the tooltip');
 }
 // Restore the renamed port map for the paper-option regression below.
 const renamedValue=await page.locator('#page-select option').evaluateAll(options=>options.find(option=>option.textContent==='Fictional renamed map').value);
 await page.locator('#page-select').selectOption(renamedValue);
 await page.screenshot({path:resolve(output,'page-groups.png')});
 const before=await page.locator('#canvas svg').getAttribute('viewBox');
 await page.locator('#page-options').click();
 await page.locator('#dialog details').filter({hasText:'Printing'}).locator('summary').click();
 await page.locator('#dialog').getByLabel('Print paper',{exact:true}).selectOption('a4');
 await page.locator('#dialog').getByLabel('Print orientation',{exact:true}).selectOption('portrait');
 await page.locator('#dialog').getByRole('button',{name:'Apply paper settings'}).click();
 await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 assert.equal(await page.locator('#canvas svg').getAttribute('viewBox'),before,'printing paper must not change drawing dimensions');
 await page.screenshot({path:resolve(output,'print-paper-options.png')});
 // The new visible page control must change the actual editor sheet boundary,
 // independently of print paper, and must expose all/group/page scopes.
 await page.locator('#page-options').click();
 const dialog=page.locator('#dialog'),scope=dialog.getByLabel('Apply visible page proportions to',{exact:true}),size=dialog.getByLabel('Visible page proportions',{exact:true}),orientation=dialog.getByLabel('Page orientation',{exact:true});
 assert.equal(await scope.inputValue(),'page','individual-page controls are restored');
 assert.ok(await dialog.getByLabel('Individual page',{exact:true}).count());
 await size.selectOption('a4');await orientation.selectOption('portrait');
 await dialog.getByRole('button',{name:'Apply paper settings'}).click();
 await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 const visible=await page.locator('#canvas svg').getAttribute('viewBox');
 assert.notEqual(visible,before,'visible paper must change the actual drawing page');
 const current=await page.locator('#canvas svg').evaluate(svg=>svg.viewBox.baseVal.width/svg.viewBox.baseVal.height);
 assert.ok(Math.abs(current-210/297)<1e-6,'A4 portrait proportions are visible in the editor');
 await page.screenshot({path:resolve(output,'visible-a4-portrait.png')});
 await page.locator('#page-options').click();
 await scope.selectOption('group');
 assert.ok(await dialog.getByLabel('Page group',{exact:true}).isVisible());
 await dialog.getByLabel('Page group',{exact:true}).selectOption('ports');
 await size.selectOption('a3');await orientation.selectOption('landscape');
 await scope.selectOption('page');
 assert.equal(await size.inputValue(),'a4','switching scopes retains the unsaved group choice and individual override');
 await dialog.getByRole('button',{name:'Apply paper settings'}).click();
 await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 await page.locator('#page-options').click();
 await scope.selectOption('group');
 await dialog.getByLabel('Page group',{exact:true}).selectOption('ports');
 assert.equal(await size.inputValue(),'a3','group paper choice was saved');
 await dialog.locator('#close').click();

 // A genuine validation rejection must retain its editor and error even
 // though a dynamic drawing can legitimately accept long titles.
 const rejection=await page.evaluate(async()=>{
  const {inlineTextEditor}=await import('nds/inline-text.mjs');
  const svg=document.querySelector('#canvas svg');
  const editor=inlineTextEditor(svg,{box:{x:80,y:110,w:220,h:26},value:'Synthetic label',onSave(){throw Error('Synthetic validation rejection');}});
  const input=document.querySelector('[data-inline-editor] textarea');
  input.value='Invalid synthetic value';
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  const error=document.querySelector('[data-inline-editor] .inline-text-error');
  const result={attached:input.isConnected,visible:!!error?.textContent.includes('Synthetic validation rejection')&&error.getClientRects().length>0};
  editor.cancel();
  return result;
 });
 assert.equal(rejection.attached,true,'rejected editor remains attached');
 assert.equal(rejection.visible,true,'validation failure remains visible');
 await page.locator('#new').click();
 await page.waitForFunction(()=>document.querySelector('#page-navigation').hidden);
 assert.equal(await page.locator('.pages-sidebar').isVisible(),false,'new project hides the empty pages rail');
 const blank=await page.evaluate(()=>({left:document.querySelector('#canvas').getBoundingClientRect().left,right:document.querySelector('.project-sidebar').getBoundingClientRect().right}));
 assert.ok(Math.abs(blank.left-blank.right)<1,'hidden pages rail returns its width to the canvas');
 // Reset recreates the welcome button; its accessible name survives that lifecycle.
 await page.getByRole('button',{name:'Open sample site',exact:true}).click();
 await page.waitForSelector('#page-families .page-group summary');
 assert.equal(await page.locator('.pages-sidebar').isVisible(),true,'loading another drawing restores its separate rail');
 // Real normal Paper workflow must size device captions in physical points,
 // not merely certify a scene-model helper or a source-space font size.
 const dense=sampleSite();dense.name='Fictional device paper captions';
 for(const [id,count] of [['sw-1',5],['sw-2',8]]){const d=dense.devices.find(d=>d.id===id);d.model='JL558A';d.stackMembers=Array.from({length:count},(_,i)=>({id:String(i+1),model:'JL558A'}));}
 const previousSvg=await page.$('#canvas svg');
 await page.locator('#project-file').setInputFiles({name:'fictional-captions.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:dense}))});
 await page.waitForFunction(node=>!node.isConnected,previousSvg);await previousSvg.dispose();
 await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent==='Project opened.');
 await page.locator('#page-select').selectOption({label:'Core Network'});
 for(const [paper,widthPt] of [['letter',792],['a4',297*72/25.4]]){
  await quickPaper.selectOption(paper);await quickOrientation.selectOption('landscape');
  const fonts=await page.locator('#canvas svg').evaluate((svg,points)=>{
   const labels=[...svg.querySelectorAll('text[data-drawing-key]')].filter(t=>/^Core Network\|(title|detail)\|/.test(t.dataset.drawingKey));
   return labels.map(t=>({key:t.dataset.drawingKey,pt:parseFloat(getComputedStyle(t).fontSize)*points/svg.viewBox.baseVal.width}));
  },widthPt);
  assert.equal(fonts.length,6,'all three devices retain their name and detail captions');
  assert.ok(fonts.every(t=>t.pt>=7.95),JSON.stringify(fonts));
  await page.locator('#zoom-fit').click();await page.screenshot({path:resolve(output,'device-captions-'+paper+'.png')});
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'results.json'),JSON.stringify({groups:await groups.count(),sidebarScrolledPixels:scrolled,printCanvasUnchanged:true,errors},null,2));
 console.log('PASS sidebar page lists, keyboard navigation, rename, responsive scrolling and independent paper selection.');
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error(errors);throw error;}finally{await browser.close();}
