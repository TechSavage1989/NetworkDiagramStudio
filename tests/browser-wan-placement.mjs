// Real-browser coverage for WAN/ISP cards: they sit above their firewall, can
// be placed beside other objects alone or in a Shift selection, and follow the
// firewall when it is dragged. Fictional data only.
// Use the same browser/output environment variables as browser-cable-proximity.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mdfLookalike} from './fixtures/mdf-lookalike.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),output=resolve(process.env.NDS_QA_OUTPUT||'qa-output/wan-placement');await mkdir(output,{recursive:true});
const url=process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href;
const project={...mdfLookalike(),stencils:{},optics:{},warnings:[]};project.layout||={};
const fixture=resolve(output,'wan-lab.nds.json');await writeFile(fixture,JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],result={};
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
// Body boxes in drawing coordinates, read from the rendered SVG.
const boxes=()=>page.locator('#canvas svg').evaluate(svg=>Object.fromEntries([...svg.querySelectorAll('[data-drawing-key$="|body"]')].map(n=>{const b=n.getBBox(),m=n.getCTM(),s=svg.getCTM().inverse().multiply(m);return [n.dataset.drawingKey,{x:s.a*b.x+s.e,y:s.d*b.y+s.f,w:b.width*s.a,h:b.height*s.d}];})));
const body=key=>page.locator(`#canvas svg [data-drawing-key="${key}"]`);
const key=id=>'Core Network|device|'+id+'|body',firewall=key('fw'),cards=['handoff:fw/port1','handoff:fw/port11'].map(key),reference=key('mdf');
const feedback=pattern=>page.waitForFunction(source=>new RegExp(source,'i').test(document.querySelector('#feedback').textContent),pattern.source);
try{
 await page.goto(url);await page.locator('#project-file').setInputFiles(fixture);await page.waitForSelector('#canvas svg');await page.locator('#edit-drawing').click();
 let before=await boxes();for(const card of cards){assert.ok(before[card],card);assert.ok(before[card].y+before[card].h<=before[firewall].y+.5,card+' starts above the firewall');}
 // A selected WAN card enables Place beside and lands left of its firewall.
 await body(cards[0]).click({position:{x:12,y:8}});assert.equal(await page.locator('#drawing-beside [data-place="left"]').isEnabled(),true);
 await page.locator('#drawing-beside [data-place="left"]').click();await body(firewall).click({position:{x:20,y:10}});await feedback(/placed left/);
 let after=await boxes();assert.ok(after[cards[0]].x+after[cards[0]].w<=after[firewall].x+.5,'the card sits left of its firewall');result.single=await page.locator('#feedback').textContent();
 await page.locator('#drawing-undo').click();await feedback(/undone/);after=await boxes();assert.ok(Math.abs(after[cards[0]].x-before[cards[0]].x)<.5,'Undo restores the card in one step');
 // Two cards selected with Shift move together below the switch.
 await page.locator('#drawing-clear').click();await body(cards[0]).click({position:{x:12,y:8}});await body(cards[1]).click({position:{x:12,y:8},modifiers:['Shift']});
 assert.match(await page.locator('#drawing-selection').textContent(),/2 selected/);
 await page.locator('#drawing-beside [data-place="below"]').click();await body(reference).click({position:{x:30,y:20}});await feedback(/placed below|room|clear position/);result.group=await page.locator('#feedback').textContent();assert.match(result.group,/placed below/);
 after=await boxes();for(const card of cards)assert.ok(after[card].y>=after[reference].y+after[reference].h-.5,card+' is below the switch');
 const shift=[0,1].map(i=>[after[cards[i]].x-before[cards[i]].x,after[cards[i]].y-before[cards[i]].y]);assert.ok(Math.abs(shift[0][0]-shift[1][0])<.5&&Math.abs(shift[0][1]-shift[1][1])<.5,'the selection keeps its arrangement');
 await page.locator('#drawing-undo').click();await feedback(/undone/);
 // Dragging the firewall carries its WAN cards; they stay above it.
 before=await boxes();const f=await body(firewall).boundingBox();
 await page.mouse.move(f.x+30,f.y+f.height/2);await page.mouse.down();for(let i=1;i<=6;i++)await page.mouse.move(f.x+30+i*6,f.y+f.height/2);await page.mouse.up();await feedback(/moved/);
 after=await boxes();const dx=after[firewall].x-before[firewall].x,dy=after[firewall].y-before[firewall].y;assert.ok(Math.abs(dx)>10,'the firewall moved');
 for(const card of cards){assert.ok(Math.abs(after[card].x-before[card].x-dx)<.5&&Math.abs(after[card].y-before[card].y-dy)<.5,card+' follows its firewall');assert.ok(after[card].y+after[card].h<=after[firewall].y+.5,card+' stays above');}
 await page.screenshot({path:resolve(output,'wan-follow.png')});
 assert.deepEqual(errors,[]);result.errors=errors;await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error(error);console.error('Browser errors:',errors);console.error('Status:',await page.locator('#feedback').textContent());process.exitCode=1;}finally{await browser.close();}
