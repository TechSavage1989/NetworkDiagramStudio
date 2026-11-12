// Run after build-web.mjs. PLAYWRIGHT_MODULE_PATH and BROWSER_EXECUTABLE_PATH
// may select an existing local browser installation; no downloads are needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {unzip} from '../src/web/zip.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'qa-output/cable-proximity');await mkdir(output,{recursive:true});
const url=process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href;
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),errors=[],result={zooms:[]};
const page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
const hoverKey=()=>page.locator('path.cable-hover').getAttribute('data-drawing-key');
const waitHover=key=>page.waitForFunction(key=>document.querySelector('path.cable-hover')?.getAttribute('data-drawing-key')===key,key);
const noHover=()=>page.waitForFunction(()=>!document.querySelector('.cable-proximity-halo,path.cable-hover'));
const screen=async(x,y)=>page.evaluate(([x,y])=>{const m=document.querySelector('#fixture svg').getScreenCTM();return {x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};},[x,y]);
try{
 await page.goto(url);
 // Exercise the real viewport and styles in a deterministic synthetic sheet.
 await page.evaluate(async()=>{
  const {diagramViewport}=await import('nds/viewport.mjs');
  const canvas=document.createElement('div');canvas.id='fixture';canvas.className='editing';canvas.style.cssText='position:fixed;inset:0;width:1200px;height:800px;background:white;z-index:10000;overflow:clip';document.body.append(canvas);
  const style=document.createElement('style');style.textContent='#fixture>svg{position:absolute;left:0;top:0;transform-origin:0 0}#fixture .cable-proximity-halo{pointer-events:none}';document.head.append(style);
  const markup='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><rect width="1000" height="700" fill="white"/><path class="diagram-cable" data-drawing-key="a" d="M 100 350 L 900 350" fill="none" stroke="#145a6b" stroke-width="2"><title>First parallel cable</title></path><path class="diagram-cable" data-drawing-key="b" d="M 100 370 L 900 370" fill="none" stroke="#264685" stroke-width="2"><title>Second parallel cable</title></path><path class="diagram-cable" data-drawing-key="c" d="M 650 200 L 650 340 A 10 10 0 0 0 650 360 L 650 550" fill="none" stroke="#556515" stroke-width="2"><title>Crossing cable</title></path><g data-device-id="device" data-drawing-key="device"><rect x="300" y="335" width="80" height="50" fill="#d9e5e8"/><text x="310" y="357" font-size="10">Device</text></g><text data-drawing-key="label" x="410" y="348" font-size="14">Device label</text><g class="cable-controls" data-drawing-key="control"><circle data-cable-point="1" tabindex="0" role="button" cx="740" cy="350" r="8" fill="white" stroke="#146374"/></g></svg>';
  const state=window.cableFixture={canvas,enabled:true,events:[],shapes:[],controls:0,make:()=>new DOMParser().parseFromString(markup,'image/svg+xml').documentElement};
  state.viewport=diagramViewport(canvas,{canSelectCable:()=>state.enabled,onShape(key,id,e,target){state.shapes.push({key,additive:!!e.shiftKey,target:target.getAttribute('data-drawing-key')});return true;},onMoveStart(key){return {preview(dx,dy,e){state.events.push({type:'preview',key,dx,dy,shift:e.shiftKey});},commit(dx,dy,e){state.events.push({type:'commit',key,dx,dy,shift:e.shiftKey});},cancel(){}};},onEdit(key){state.events.push({type:'edit',key});}});
  document.addEventListener('keydown',e=>{if(!e.defaultPrevented&&e.target.closest('[data-cable-point]')&&[' ','Enter'].includes(e.key)){state.controls++;e.preventDefault();}});
  state.viewport.show('Fixture',state.make());
 });
 for(const scale of [.25,.49,1,1.77,3]){
  const center=await screen(500,350),current=await page.locator('#fixture svg').evaluate(svg=>svg.getScreenCTM().a);
  await page.mouse.move(center.x,center.y);await page.mouse.wheel(0,-Math.log(scale/current)/.0015);
  await page.waitForFunction(scale=>Math.abs(document.querySelector('#fixture svg').getScreenCTM().a-scale)<.001,scale);
  const p=await screen(550,350),edge=scale;
  await page.mouse.move(p.x,p.y-edge-11);await waitHover('a');assert.equal(await page.locator('.cable-proximity-halo').count(),1);const glowWidth=await page.locator('.cable-proximity-halo path').first().evaluate(path=>+path.getAttribute('stroke-width')*path.ownerSVGElement.getScreenCTM().a);assert.ok(Math.abs(glowWidth-(2*scale+12))<.01,'glow padding must stay constant in screen pixels');
  await page.mouse.click(p.x,p.y-edge-11);assert.equal(await page.evaluate(()=>cableFixture.shapes.at(-1).key),'a');
  await page.mouse.move(p.x,p.y-edge-13);await noHover();
  const b=await screen(550,370);await page.mouse.move(b.x,b.y);await waitHover('b');
  assert.deepEqual(await page.locator('#fixture path.diagram-cable').evaluateAll(paths=>paths.map(p=>p.getAttribute('stroke-width'))),['2','2','2']);
  result.zooms.push({scale,allowancePixels:12,nearestParallel:true});
 }
 // Return to a view containing all artwork, the crossing and bend control.
 const center=await screen(500,350),current=await page.locator('#fixture svg').evaluate(svg=>svg.getScreenCTM().a);await page.mouse.move(center.x,center.y);await page.mouse.wheel(0,-Math.log(1/current)/.0015);await page.waitForFunction(()=>Math.abs(document.querySelector('#fixture svg').getScreenCTM().a-1)<.001);
 for(const [x,y,key] of [[650,350,'a'],[640,350,'c'],[650,330,'c']]){const p=await screen(x,y);await page.mouse.move(p.x,p.y);await waitHover(key);}
 for(const [x,y,key] of [[340,350,'device'],[445,342,'label'],[740,350,'control']]){const p=await screen(x,y);await page.mouse.move(p.x,p.y);await noHover();await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>cableFixture.shapes.at(-1).key),key);}
 result.artworkPriority=true;
 const near=await screen(550,350);near.y-=10;
 await page.keyboard.down('Shift');await page.mouse.click(near.x,near.y);await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>cableFixture.shapes.at(-1).additive),true);
 await page.mouse.dblclick(near.x,near.y);assert.deepEqual(await page.evaluate(()=>cableFixture.events.at(-1)),{type:'edit',key:'a'});
 await page.mouse.move(near.x,near.y);await page.keyboard.down('Shift');await page.mouse.down();await page.mouse.move(near.x+32,near.y+7);await page.mouse.up();await page.keyboard.up('Shift');
 const move=await page.evaluate(()=>cableFixture.events.at(-1));assert.equal(move.key,'a');assert.equal(move.type,'commit');assert.equal(move.shift,true);assert.ok(Math.abs(move.dx-32)<.01);
 await page.locator('#fixture [data-drawing-key="b"]').focus();await waitHover('b');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>cableFixture.shapes.at(-1).key),'b');await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>cableFixture.shapes.at(-1).key),'b');
 await page.locator('#fixture [data-cable-point]').focus();await page.keyboard.press('Space');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>cableFixture.controls),2);
 await page.mouse.move(near.x,near.y);await waitHover('a');await page.evaluate(()=>{cableFixture.enabled=false;cableFixture.viewport.syncCableInteraction();});await noHover();assert.equal(await page.locator('#fixture path.diagram-cable[tabindex]').count(),0);
 await page.evaluate(()=>{cableFixture.enabled=true;cableFixture.viewport.syncCableInteraction();});await page.mouse.move(near.x+1,near.y);await waitHover('a');await page.mouse.move(1300,900);await noHover();
 await page.mouse.move(near.x,near.y);await waitHover('a');await page.evaluate(()=>cableFixture.viewport.show('Next page',cableFixture.make()));await noHover();
 result.gestures={click:true,shift:true,doubleClick:true,drag:true,keyboard:true,handles:true,modeClear:true,leaveClear:true,pageClear:true};
 await page.reload();await page.locator('#sample').click();await page.waitForSelector('#canvas svg path.diagram-cable',{state:'attached'});if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();
 await page.evaluate(async()=>{const {cableGeometry,closestCable}=await import('nds/cable-proximity.mjs');window.cableQAEvents=[];for(const type of ['pointerdown','pointerup','dblclick'])document.querySelector('#canvas').addEventListener(type,event=>{const svg=document.querySelector('#canvas svg'),paths=[...svg.querySelectorAll('path.diagram-cable')].map(element=>({key:element.getAttribute('data-drawing-key'),weight:+element.getAttribute('stroke-width'),geometry:cableGeometry(element.getAttribute('d'))}));cableQAEvents.push({type,x:event.clientX,y:event.clientY,target:event.target.tagName,key:event.target.closest('[data-drawing-key]')?.getAttribute('data-drawing-key'),nearest:closestCable(paths,{x:event.clientX,y:event.clientY},svg.getScreenCTM())?.key,selection:document.querySelector('#drawing-selection').textContent});},true);});
 // Find an unobscured real connection with room for an off-stroke pointer.
 const findCable=async(exclude=null,only=null)=>page.evaluate(async({exclude,only})=>{
  const {cableGeometry,closestCable}=await import('nds/cable-proximity.mjs'),svg=document.querySelector('#canvas svg'),m=svg.getScreenCTM(),canvas=document.querySelector('#canvas').getBoundingClientRect();
  const candidates=[...svg.querySelectorAll('path.diagram-cable')].map(element=>({element,key:element.getAttribute('data-drawing-key'),weight:+element.getAttribute('stroke-width'),geometry:cableGeometry(element.getAttribute('d'))}));
  for(const line of candidates){if(line.key===exclude||only&&line.key!==only||!exclude&&line.geometry.segments.length<2)continue;for(const segment of line.geometry.segments){if(segment.arc||Math.hypot(segment.a[0]-segment.b[0],segment.a[1]-segment.b[1])*m.a<45)continue;
   for(const fraction of [.5,.35,.65])for(const side of [-1,1]){const p=[segment.a[0]+(segment.b[0]-segment.a[0])*fraction,segment.a[1]+(segment.b[1]-segment.a[1])*fraction],horizontal=segment.a[1]===segment.b[1],offset=(line.weight*m.a/2+9)*side,x=m.a*p[0]+m.e+(horizontal?0:offset),y=m.d*p[1]+m.f+(horizontal?offset:0);if(x<canvas.left+15||x>canvas.right-15||y<canvas.top+15||y>canvas.bottom-15)continue;
    const target=document.elementFromPoint(x,y),keyed=target.closest('[data-drawing-key]');if(target.closest('text,.cable-controls,[data-device-id]')||keyed&&!keyed.matches('path.diagram-cable'))continue;
    if(closestCable(candidates,{x,y},m)?.key===line.key)return {key:line.key,x,y,d:line.element.getAttribute('d'),weight:line.weight};
   }
  }}return null;
 },{exclude,only});
 const first=await findCable();assert.ok(first);await page.mouse.move(first.x,first.y);await waitHover(first.key);await page.mouse.click(first.x,first.y);assert.equal(await page.locator('.cable-controls').getAttribute('data-drawing-key'),first.key);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));Object.assign(first,await findCable(null,first.key));await page.mouse.move(first.x+1,first.y);await waitHover(first.key);await page.screenshot({path:resolve(output,'edit-toolbar.png')});
 const second=await findCable(first.key);assert.ok(second);await page.keyboard.down('Shift');await page.mouse.click(second.x,second.y);await page.keyboard.up('Shift');assert.equal((await page.locator('#drawing-selection').textContent()).trim(),'2 selected');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const fresh=await findCable(null,first.key);assert.ok(fresh);Object.assign(first,fresh);await page.mouse.move(first.x,first.y);await waitHover(first.key);await page.mouse.dblclick(first.x,first.y);await page.waitForFunction(()=>document.querySelector('#dialog').open,null,{timeout:5000});assert.equal(await page.locator('#dialog-title').textContent(),'Edit drawing object');await page.locator('#dialog').evaluate(dialog=>dialog.close());
 // Exercise real bend handles, then undo back to the original glued route.
 await page.mouse.click(first.x,first.y);const handle=page.locator('.cable-controls [data-cable-point]').first();assert.ok(await handle.count());await handle.focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#feedback').textContent==='Selected items nudged.');await page.locator('#drawing-undo').click();
 const restored=await page.locator('#canvas path.diagram-cable').evaluateAll((paths,key)=>paths.find(p=>p.getAttribute('data-drawing-key')===key)?.getAttribute('d'),first.key);assert.equal(restored,first.d);
 const after=await findCable();await page.mouse.move(after.x,after.y);await waitHover(after.key);
 const download=page.waitForEvent('download');await page.evaluate(()=>document.querySelector('#svg').click());const svgDownload=await download;await svgDownload.saveAs(resolve(output,'cable-selection-export.svg'));const exported=await readFile(resolve(output,'cable-selection-export.svg'),'utf8');assert.doesNotMatch(exported,/cable-proximity-halo|cable-hover|cable-hit-target|data-editor-only|stroke="transparent"/);assert.match(exported,/class="diagram-cable"/);
 await page.mouse.move(after.x+1,after.y);await waitHover(after.key);const visioDownload=page.waitForEvent('download');await page.evaluate(()=>document.querySelector('#export').click());const visio=await visioDownload;await visio.saveAs(resolve(output,'cable-selection-export.vsdx'));const parts=await unzip(new Uint8Array(await readFile(resolve(output,'cable-selection-export.vsdx')))),xml=new TextDecoder().decode(parts.get('visio/pages/page1.xml'));assert.doesNotMatch(xml,/cable-proximity-halo|cable-hover|cable-hit-target|data-editor-only/);assert.match(xml,/<Connect /);
 await page.evaluate(()=>{window.print=()=>{};document.querySelector('#print').click();});assert.equal(await page.locator('#print-set .cable-proximity-halo,#print-set .cable-hit-target,#print-set [data-editor-only]').count(),0);assert.ok(await page.locator('#print-set path.diagram-cable').count()>0);
 result.realApp={hover:true,selection:true,shiftSelection:true,connectionDoubleClick:true,keyboardBend:true,undoRouteRestored:true,svgClean:true,visioClean:true,visioGlue:true,printClean:true};
 assert.deepEqual(errors,[]);result.errors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error(error);console.error('Browser errors:',errors);console.error('Interaction trace:',await page.evaluate(()=>window.cableQAEvents||[]));process.exitCode=1;}finally{await browser.close();}
