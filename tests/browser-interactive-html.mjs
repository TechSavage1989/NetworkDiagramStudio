import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rotationProject} from './fixtures/device-rotation.mjs';
import {exportInteractiveHtml} from '../src/web/interactive-html.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {fictionalCampus} from './fixtures/site-map-campus.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/interactive-html');await mkdir(output,{recursive:true});
const fixture=resolve(output,'fictional.nds.json');await writeFile(fixture,JSON.stringify({format:'NetworkDiagramStudio',schema:1,project:rotationProject()}));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);await page.locator('#project-file').setInputFiles(fixture);await page.locator('#canvas svg').waitFor();
 await page.locator('#export-menu').click();const exportDialog=page.getByRole('dialog',{name:'Export documentation',exact:true});await exportDialog.waitFor();
 // The project also has a Drawing pages landmark. Target the named form control in this dialog.
 const scope=exportDialog.getByRole('combobox',{name:'Drawing pages',exact:true});assert.equal(await scope.count(),1);await scope.selectOption('all');
 const pending=page.waitForEvent('download');await exportDialog.getByRole('button',{name:'Interactive HTML',exact:true}).click();const download=await pending,path=resolve(output,'fictional-viewer.html');await download.saveAs(path);
 const content=await readFile(path,'utf8');assert.ok(!content.includes('"rawConfig"'));
 const viewer=await browser.newPage({viewport:{width:1366,height:900}}),requests=[];viewer.on('pageerror',e=>errors.push(e.message));viewer.on('request',r=>{if(!/^(?:file|data):/.test(r.url()))requests.push(r.url());});
 const settle=()=>viewer.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 await viewer.goto(pathToFileURL(path).href);await viewer.locator('#drawing svg').waitFor();await settle();assert.ok(await viewer.locator('#drawing path').count()>0);assert.ok(await viewer.locator('#pages button').count()>1);
 // Inspect real exported cable/device associations without exposing project records.
 const cable=viewer.locator('#drawing .diagram-cable').first();await cable.focus();await settle();
 assert.equal(await cable.evaluate(n=>n===document.activeElement),true,'Cable receives real keyboard focus');
 assert.match(await viewer.locator('#inspection').textContent(),/LAB-a.*p1.*LAB-b.*p1/);
 assert.ok(await viewer.locator('#drawing [data-device-id].viewer-related').count()>=2);
 await cable.press('Enter');await viewer.locator('#stage').press('Escape');assert.equal(await viewer.locator('.viewer-active').count(),0);
 const inspectionTransform=await viewer.locator('#drawing').getAttribute('style');const device=viewer.locator('#drawing [data-device-id]').first();await device.focus();await settle();assert.equal(await viewer.locator('#drawing').getAttribute('style'),inspectionTransform,'Inspecting details must not resize stage or trigger a refit');assert.match(await viewer.locator('#inspection').textContent(),/connected link/);
 await viewer.locator('#stage').press('Escape');
 const original=await viewer.locator('#zoom').textContent();await viewer.getByRole('button',{name:'Zoom in',exact:true}).click();await settle();assert.notEqual(await viewer.locator('#zoom').textContent(),original);
 await viewer.locator('#pages button').nth(1).click();assert.equal(await viewer.locator('#pages button').nth(1).getAttribute('aria-current'),'page');await viewer.locator('#pages button').first().click();
 const text='Fictional rotation lab';await viewer.locator('#search').fill(text);assert.ok(await viewer.locator('#results button').count()>0);
 for(const result of await viewer.locator('#results button').allTextContents())assert.equal(result.split(text).length-1,1,'A search result must show each full label once, not title + tspans');
 await viewer.locator('#results button').first().click();assert.equal(await viewer.locator('#inspection').textContent(),text);
 await viewer.locator('#search').fill('NO_MATCH_123456789');assert.equal(await viewer.locator('#matches').textContent(),'0 matches');await viewer.locator('#search').fill('');await viewer.getByRole('button',{name:'Fit page',exact:true}).click();await settle();
 const before=await viewer.locator('#drawing').getAttribute('style'),box=await viewer.locator('#drawing text').first().boundingBox();await viewer.mouse.move(box.x+box.width/2,box.y+box.height/2);await viewer.mouse.down();await viewer.mouse.move(box.x+box.width/2+90,box.y+box.height/2+45,{steps:5});
 // A pan moves the drawing as one compositor layer, dropped soon after release so it repaints once.
 assert.equal(await viewer.locator('#drawing').evaluate(d=>d.classList.contains('moving')&&getComputedStyle(d).willChange==='transform'),true,'Panning moves the drawing as one compositor layer');
 await viewer.mouse.up();assert.notEqual(await viewer.locator('#drawing').getAttribute('style'),before);
 await viewer.waitForFunction(()=>!document.getElementById('drawing').classList.contains('moving'),null,{timeout:3000});assert.equal(await viewer.locator('#drawing').evaluate(d=>getComputedStyle(d).willChange),'auto','The layer is dropped once the pan stops');assert.equal(await viewer.evaluate(()=>getSelection().toString()),'','Panning from SVG text must not create a native text selection');await viewer.locator('#stage').press('0');await settle();assert.equal(await viewer.evaluate(()=>getSelection().toString()),'');
 // Wheel zoom follows the distance moved: a mouse notch is about 15%, a small touchpad step a fraction of that.
 const scaleOf=()=>viewer.locator('#drawing').evaluate(d=>+/scale\(([^)]+)\)/.exec(d.style.transform)[1]);
 const stageBox=await viewer.locator('#stage').boundingBox();await viewer.mouse.move(stageBox.x+stageBox.width/2,stageBox.y+stageBox.height/2);
 let start=await scaleOf();await viewer.mouse.wheel(0,-100);await settle();const notch=await scaleOf()/start;assert.ok(notch>1.12&&notch<1.18,'one mouse notch zooms about 15%: '+notch);
 start=await scaleOf();await viewer.mouse.wheel(0,-4);await settle();const small=await scaleOf()/start;assert.ok(small>1&&small<1.02,'a small touchpad step zooms a little: '+small);
 assert.equal(await viewer.locator('#drawing').evaluate(d=>d.classList.contains('moving')),false,'zooming does not use the pan layer');
 await viewer.locator('#stage').press('0');await settle();
 await viewer.screenshot({path:resolve(output,'interactive-html.png')});await viewer.setViewportSize({width:390,height:844});await settle();assert.ok(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Malicious imported markup stays inert; embedded raster images and port metadata survive.
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=';
 const hostile=exportInteractiveHtml([{name:'</script><script>window.pwned=1</script>',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" onload="window.pwned=1"><script>window.pwned=1</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">bad</div></foreignObject><image href="https://example.com/track.png"/><image href="${image}" width="20" height="20"/><rect data-port-name="Gi1/1" x="30" y="30" width="30" height="30" fill="blue"/><text x="10" y="80">Safe label</text></svg>`}]);
 const attack=resolve(output,'inert.html');await writeFile(attack,hostile);await viewer.goto(pathToFileURL(attack).href);await viewer.locator('#drawing svg').waitFor();assert.equal(await viewer.evaluate(()=>window.pwned),undefined);assert.equal(await viewer.locator('#drawing script,#drawing foreignObject,[onload]').count(),0);assert.equal(await viewer.locator('#drawing image[href]').count(),1);assert.equal(await viewer.locator('[data-port-name="Gi1/1"]').count(),1);
 // Empty drawing, repeated page switching and large exported scenes remain usable.
 const largeSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 1800">'+Array.from({length:600},(_,i)=>'<g data-device-id="d'+i+'"><title>LAB '+i+'</title><rect x="'+(i%30*80)+'" y="'+(Math.floor(i/30)*80)+'" width="60" height="40" fill="#ddd"/><text x="'+(i%30*80)+'" y="'+(Math.floor(i/30)*80+25)+'">Device '+i+'</text></g>').join('')+'</svg>';
 const large=resolve(output,'large-viewer.html');await writeFile(large,exportInteractiveHtml([{name:'Large synthetic lab',svg:largeSvg},{name:'Empty',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"/>'}]));
 await viewer.goto(pathToFileURL(large).href);await settle();
 const metrics=await viewer.evaluate(async()=>{const stage=document.getElementById('stage'),drawing=document.getElementById('drawing');let writes=0;const observer=new MutationObserver(items=>writes+=items.filter(i=>i.attributeName==='style').length);observer.observe(drawing,{attributes:true});const before=drawing.style.transform,start=performance.now();for(let i=0;i<101;i++)stage.dispatchEvent(new WheelEvent('wheel',{deltaY:i%2?1:-1,clientX:200,clientY:200,cancelable:true}));await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));observer.disconnect();return {burstMilliseconds:performance.now()-start,transformWrites:writes,before,after:drawing.style.transform,objects:drawing.querySelectorAll('[data-inspect]').length};});
 assert.notEqual(metrics.after,metrics.before,'The odd zoom burst must change the transform');assert.equal(metrics.transformWrites,1,'A burst of 101 wheel events must produce one transform write, not 101');console.log('Large viewer interaction metrics:',JSON.stringify(metrics));
 for(let i=0;i<3;i++){await viewer.locator('#pages button').nth(1).click();await settle();assert.equal(await viewer.locator('#drawing [data-inspect]').count(),0);await viewer.locator('#pages button').first().click();await settle();}
 await viewer.locator('#drawing [data-device-id]').first().focus();await viewer.keyboard.press('Enter');assert.equal(await viewer.locator('.viewer-active').count(),1);await viewer.keyboard.press('Escape');assert.equal(await viewer.locator('.viewer-active').count(),0);
 // Engineer review: device details, connections, jumps, Back, path to the
 // edge, connection types, deep links and page keys on a fictional campus.
 const campus=resolve(output,'campus-viewer.html');await writeFile(campus,exportInteractiveHtml(buildPages(fictionalCampus()),{title:'Fictional campus'}));
 await viewer.setViewportSize({width:1500,height:950});await viewer.goto(pathToFileURL(campus).href);await viewer.locator('#drawing svg').waitFor();await settle();
 assert.match(await viewer.locator('#details').textContent(),/devices · \d+ connections on this page/);
 await viewer.locator('#pages button',{hasText:'Site Map'}).click();await settle();
 await viewer.locator('#drawing text[data-owner="core1"]').first().click();await settle();
 assert.equal(await viewer.locator('#details h2').textContent(),'CORE-1');
 const panel=await viewer.locator('#details').textContent();assert.match(panel,/Connections \(\d+\)/);assert.match(panel,/IDF-03-ACCESS/);assert.match(panel,/SR fiber · 10 Gbps/);assert.match(panel,/Core Network/);
 assert.equal(await viewer.locator('#drawing svg').evaluate(svg=>svg.classList.contains('viewer-dim')),true,'unrelated items are dimmed');
 await viewer.locator('#dim').uncheck();assert.equal(await viewer.locator('#drawing svg').evaluate(svg=>svg.classList.contains('viewer-dim')),false);await viewer.locator('#dim').check();
 await viewer.getByRole('button',{name:'Path to the network edge',exact:true}).click();await settle();
 assert.match(await viewer.locator('#details').textContent(),/Path to the edge: CORE-1 → CAMPUS-FW-A/);assert.ok(await viewer.locator('#drawing .diagram-cable.viewer-path').count()>=1);
 await viewer.locator('#details button.link',{hasText:'NAS-01'}).first().click();await settle();assert.equal(await viewer.locator('#details h2').textContent(),'NAS-01');
 await viewer.locator('#back').click();await settle();assert.equal(await viewer.locator('#details h2').textContent(),'CORE-1');assert.match(await viewer.evaluate(()=>location.hash),/page=2&device=core1/);
 await viewer.locator('#details button.link',{hasText:'1. Core Network'}).click();await settle();assert.match(await viewer.locator('#page-name').textContent(),/^1 \/ \d+ · Core Network/);assert.equal(await viewer.locator('#details h2').textContent(),'CORE-1');assert.equal(await viewer.locator('#drawing [data-device-id="core1"].viewer-active').count(),1);
 await viewer.locator('#stage').press('Escape');await viewer.locator('#pages button',{hasText:'Site Map'}).click();await settle();
 await viewer.locator('#drawing .connection-legend-text',{hasText:'SR fiber'}).first().click();await settle();assert.equal(await viewer.locator('#details h2').textContent(),'SR fiber');assert.ok(await viewer.locator('#drawing .diagram-cable.viewer-related').count()>=10);
 await viewer.locator('#stage').press('Escape');await viewer.keyboard.press(']');await settle();assert.match(await viewer.locator('#page-name').textContent(),/^3 \//);await viewer.keyboard.press('[');await settle();assert.match(await viewer.locator('#page-name').textContent(),/^2 \//);
 await viewer.locator('#search').fill('srv-host');assert.ok((await viewer.locator('#results button.result-device').allTextContents()).some(t=>/SRV-HOST-02/.test(t)));
 await viewer.locator('#results button.result-device',{hasText:'SRV-HOST-02'}).click();await settle();assert.equal(await viewer.locator('#details h2').textContent(),'SRV-HOST-02');
 await viewer.screenshot({path:resolve(output,'interactive-html-review.png')});
 await viewer.goto(pathToFileURL(campus).href+'#page=1&device=nas');await viewer.locator('#drawing svg').waitFor();await settle();assert.equal(await viewer.locator('#details h2').textContent(),'NAS-01');assert.match(await viewer.locator('#page-name').textContent(),/Core Network/);
 await viewer.setViewportSize({width:390,height:844});await settle();assert.ok(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);console.log('Downloaded offline HTML: pages, search, zoom, pan, responsive rendering, safe SVG, embedded image, engineer review (details, jumps, Back, path to edge, connection types, deep links) and zero network requests passed.');
}finally{await browser.close();}
