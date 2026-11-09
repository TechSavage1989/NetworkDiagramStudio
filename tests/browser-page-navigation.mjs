// Real browser interactions against the built offline app, using fictional data.
import assert from 'node:assert/strict';
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
 await page.locator('#sample').click();await page.waitForSelector('#page-families .page-group summary');
 const groups=page.locator('#page-families .page-group'),portGroup=groups.filter({hasText:'Port maps'});
 assert.ok(await groups.count()>=3,'sample has multiple page groups');
 assert.equal(await portGroup.count(),1);
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
 // Restore the renamed port map for the paper-option regression below.
 const renamedValue=await page.locator('#page-select option').evaluateAll(options=>options.find(option=>option.textContent==='Fictional renamed map').value);
 await page.locator('#page-select').selectOption(renamedValue);
 await page.screenshot({path:resolve(output,'page-groups.png')});
 const before=await page.locator('#canvas svg').getAttribute('viewBox');
 await page.locator('#page-options').click();
 await page.locator('#dialog details').filter({hasText:'Printing'}).locator('summary').click();
 await page.locator('#dialog').getByLabel('Print paper',{exact:true}).selectOption('a4');
 await page.locator('#dialog').getByLabel('Print orientation',{exact:true}).selectOption('portrait');
 await page.locator('#dialog').getByRole('button',{name:'Save page options'}).click();
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
 await dialog.getByRole('button',{name:'Save page options'}).click();
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
 await dialog.getByRole('button',{name:'Save page options'}).click();
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
 await page.locator('#sample').click();
 await page.waitForSelector('#page-families .page-group summary');
 assert.equal(await page.locator('.pages-sidebar').isVisible(),true,'loading another drawing restores its separate rail');
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'results.json'),JSON.stringify({groups:await groups.count(),sidebarScrolledPixels:scrolled,printCanvasUnchanged:true,errors},null,2));
 console.log('PASS sidebar page lists, keyboard navigation, rename, responsive scrolling and independent paper selection.');
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error(errors);throw error;}finally{await browser.close();}
