// Actual built-editor interactions with fictional ports and linked models.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rotationProject} from './fixtures/device-rotation.mjs';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(process.env.NDS_QA_OUTPUT||'.artifacts/port-sizing-controls');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],results={};
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
const dialog=page.locator('#dialog'),field=name=>dialog.getByLabel(name,{exact:true});
const settle=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
const open=async input=>{await page.locator('#project-file').setInputFiles(input);await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent==='Project opened.');await page.locator('#canvas svg').waitFor();};
const fixture=project=>({name:'fictional-controls.nds.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'NetworkDiagramStudio',schema:1,project}))});
const save=async name=>{const waiting=page.waitForEvent('download');await page.locator('#save').click();const download=await waiting,path=resolve(output,name);await download.saveAs(path);return {path,project:JSON.parse(await readFile(path,'utf8')).project};};
const close=async()=>{await dialog.locator('#close').click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);};
const saveDevice=async()=>{await dialog.getByRole('button',{name:'Save device',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);};
const editPort=async()=>{await page.locator('.device-details[title="Edit LAB-a"]').click();await dialog.getByText('Edit ports',{exact:true}).click();await dialog.locator('.device-port > summary').click();await field('Port name').waitFor();};
const popup=()=>dialog.locator('.nds-suggestions:not([hidden])');
const chooseSuggestion=async(label,query,value,{keyboard=false}={})=>{
 const input=field(label);await input.fill(query);await popup().waitFor();assert.equal(await input.getAttribute('role'),'combobox');
 const option=popup().getByRole('option').filter({has:page.locator('.nds-suggestion-value').filter({hasText:new RegExp('^'+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})});
 assert.equal(await option.count(),1,'Requested option is offered by the actual dropdown');
 if(keyboard){assert.equal(await popup().getByRole('option').count(),1);await input.press('ArrowDown');await input.press('Enter');}else await option.click();
 assert.equal(await input.inputValue(),value);assert.equal(await input.getAttribute('aria-expanded'),'false');
};
const closeSuggestions=async input=>{await input.press('Escape');assert.equal(await dialog.evaluate(node=>node.open),true);};
const alert=()=>dialog.locator('[role="alert"]:visible').filter({hasText:'Enter VLAN IDs from 1 to 4094'});
const assertRejected=async()=>{
 await dialog.getByRole('button',{name:'Save device',exact:true}).click();await alert().waitFor();
 assert.equal(await dialog.evaluate(node=>node.open),true,'A rejected Save keeps the editor open');
 assert.equal(await field('Role (e.g. access or trunk)').inputValue(),'custom-access');
 assert.equal(await field('Link speed (e.g. 1 Gbps)').inputValue(),'2.75 Gbps');
};
const body=id=>page.locator(`#canvas g[data-device-id="${id}"][data-drawing-key$="|body"]`);
const bodyPoint=async id=>body(id).evaluate(group=>{
 const b=group.getBoundingClientRect();
 for(const fx of [.12,.2,.35,.65,.8,.9])for(const fy of [.15,.5,.7,.85]){
  const x=b.x+b.width*fx,y=b.y+b.height*fy,target=document.elementFromPoint(x,y);
  if(target&&group.contains(target)&&!target.closest('text,[data-port-name],.transform-controls,.cable-controls')&&target.closest('[data-device-id]')===group)return {x,y};
 }
 throw Error('No unobstructed device body point for '+group.dataset.deviceId);
});
const selectBody=async(id,shift=false)=>{await settle();const point=await bodyPoint(id);if(shift)await page.keyboard.down('Shift');try{await page.mouse.click(point.x,point.y);}finally{if(shift)await page.keyboard.up('Shift');}};
const geometry=()=>page.evaluate(()=>{
 const svg=document.querySelector('#canvas svg'),inverse=svg.getScreenCTM().inverse(),result={};
 for(const id of ['a','b']){
  const group=svg.querySelector(`g[data-device-id="${id}"][data-drawing-key$="|body"]`),path=group.querySelector('path'),box=path.getBBox(),matrix=inverse.multiply(path.getScreenCTM()),p=new DOMPoint(box.x,box.y).matrixTransform(matrix),q=new DOMPoint(box.x+box.width,box.y+box.height).matrixTransform(matrix);
  result[id]={key:group.dataset.drawingKey,x:p.x,y:p.y,w:q.x-p.x,h:q.y-p.y};
 }
 const cable=svg.querySelector('path.diagram-cable'),matrix=inverse.multiply(cable.getScreenCTM());
 result.ends=[cable.getPointAtLength(0),cable.getPointAtLength(cable.getTotalLength())].map(p=>{const at=new DOMPoint(p.x,p.y).matrixTransform(matrix);return {x:at.x,y:at.y};});
 return result;
});
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<.04,`${message}: ${actual} versus ${expected}`);
const assertGlue=scene=>{for(const [index,id] of ['a','b'].entries()){near(scene.ends[index].x,scene[id].x+scene[id].w*.25,id+' socket x');near(scene.ends[index].y,scene[id].y+scene[id].h*.5,id+' socket y');}};
const assertBoxes=(actual,expected)=>{for(const id of ['a','b'])for(const axis of ['x','y','w','h'])near(actual[id][axis],expected[id][axis],id+' '+axis);assertGlue(actual);};

try{
 await page.goto(process.env.NDS_BROWSER_URL||pathToFileURL(resolve('dist/NetworkDiagramStudio.html')).href);
 const project=rotationProject();project.name='Fictional port and size controls';
 project.devices[0].vlans=[{id:10,name:'Lab data'},{id:20,name:'Lab voice'}];project.devices[1].vlans=[{id:30,name:'Lab guest'}];
 Object.assign(project.devices[0].ports[0],{role:'vendor-trunk',speed:'9.5 Gbps',native:10,tagged:[20]});
 await open(fixture(project));await editPort();
 assert.equal(await field('Port name').inputValue(),'p1');assert.equal(await field('Port name').getAttribute('readonly'),'');
 assert.equal(await field('Role (e.g. access or trunk)').inputValue(),'vendor-trunk');assert.equal(await field('Link speed (e.g. 1 Gbps)').inputValue(),'9.5 Gbps');
 await chooseSuggestion('Role (e.g. access or trunk)','tru','trunk',{keyboard:true});
 await chooseSuggestion('Link speed (e.g. 1 Gbps)','25 G','25 Gbps');
 await chooseSuggestion('Native VLAN','Lab data','10');
 const picker=dialog.locator('.port-vlan-picker');await picker.locator('summary').click();
 const voice=picker.getByRole('checkbox',{name:'Tagged VLAN 20 — Lab voice',exact:true}),guest=picker.getByRole('checkbox',{name:'Tagged VLAN 30 — Lab guest',exact:true});
 assert.equal(await voice.isChecked(),true);await field('Tagged VLANs').fill('20, 777');assert.equal(await voice.isChecked(),true);
 await guest.check();assert.equal(await field('Tagged VLANs').inputValue(),'20, 30, 777');await voice.uncheck();assert.equal(await field('Tagged VLANs').inputValue(),'30, 777');
 await page.screenshot({path:resolve(output,'port-vlan-controls.png')});await saveDevice();
 let saved=await save('port-presets.nds.json');let port=saved.project.devices.find(d=>d.id==='a').ports[0];
 assert.equal(port.role,'trunk');assert.equal(port.speed,'25 Gbps');assert.equal(port.native,10);assert.deepEqual(port.tagged,[30,777]);
 await open(saved.path);await editPort();assert.equal(await field('Role (e.g. access or trunk)').inputValue(),'trunk');assert.equal(await field('Link speed (e.g. 1 Gbps)').inputValue(),'25 Gbps');assert.equal(await field('Native VLAN').inputValue(),'10');assert.equal(await field('Tagged VLANs').inputValue(),'30, 777');
 // A hidden, collapsed picker alert must not swallow the generic Save error.
 await field('Role (e.g. access or trunk)').fill('custom-access');await closeSuggestions(field('Role (e.g. access or trunk)'));
 await field('Link speed (e.g. 1 Gbps)').fill('2.75 Gbps');await closeSuggestions(field('Link speed (e.g. 1 Gbps)'));
 await field('Native VLAN').fill('4095');await closeSuggestions(field('Native VLAN'));await field('Tagged VLANs').fill('20, 333');
 assert.equal(await picker.evaluate(node=>node.open),false);await assertRejected();assert.equal(await field('Native VLAN').inputValue(),'4095');
 await page.screenshot({path:resolve(output,'port-invalid-save.png')});
 await field('Native VLAN').fill('999');await closeSuggestions(field('Native VLAN'));await field('Tagged VLANs').fill('20, not-a-vlan');await assertRejected();assert.equal(await field('Tagged VLANs').inputValue(),'20, not-a-vlan');
 // Cancel after failed validation must keep the previously accepted inventory.
 await close();const cancelled=await save('port-cancelled.nds.json');assert.deepEqual(cancelled.project,saved.project);
 await editPort();await field('Role (e.g. access or trunk)').fill('custom-access');await closeSuggestions(field('Role (e.g. access or trunk)'));
 await field('Link speed (e.g. 1 Gbps)').fill('2.75 Gbps');await closeSuggestions(field('Link speed (e.g. 1 Gbps)'));
 await field('Native VLAN').fill('999');await closeSuggestions(field('Native VLAN'));await field('Tagged VLANs').fill('20, 333, 20');
 await saveDevice();saved=await save('port-custom.nds.json');port=saved.project.devices.find(d=>d.id==='a').ports[0];
 assert.equal(port.role,'custom-access');assert.equal(port.speed,'2.75 Gbps');assert.equal(port.native,999);assert.deepEqual(port.tagged,[20,333]);
 await open(saved.path);await editPort();assert.equal(await field('Role (e.g. access or trunk)').inputValue(),'custom-access');assert.equal(await field('Link speed (e.g. 1 Gbps)').inputValue(),'2.75 Gbps');assert.equal(await field('Native VLAN').inputValue(),'999');assert.equal(await field('Tagged VLANs').inputValue(),'20, 333');await close();
 results.ports=['keyboard and pointer dropdown selection','known native VLAN','tagged checkboxes retain manual IDs','visible native and tagged validation errors','draft retained on failure','cancel preserves accepted inventory','custom values and manual VLANs save/reopen'];

 // Reset to the two linked bodies so geometry is independent of port-table text.
 await open(fixture(rotationProject()));if(await page.locator('#edit-drawing').getAttribute('aria-pressed')!=='true')await page.locator('#edit-drawing').click();await page.locator('#zoom-fit').click();await settle();
 const mode=page.getByLabel('Size button behavior',{exact:true});assert.equal(await mode.inputValue(),'models');
 await selectBody('a');assert.equal(await page.locator('#drawing-selection').textContent(),'1 selected');const before=await geometry();assertGlue(before);
 await page.locator('#drawing-larger').click();await page.waitForFunction(()=>document.querySelector('#feedback')?.textContent.includes('Selected models resized in place.'));
 const resized=await geometry();for(const axis of ['x','y'])near(resized.a[axis],before.a[axis],'Model resize retains '+axis);for(const axis of ['w','h'])near(resized.a[axis],before.a[axis]*1.1,'Model resize changes '+axis);for(const axis of ['x','y','w','h'])near(resized.b[axis],before.b[axis],'Unselected body retains '+axis);assertGlue(resized);
 await page.locator('#drawing-undo').click();assertBoxes(await geometry(),before);await page.locator('#drawing-redo').click();assertBoxes(await geometry(),resized);
 saved=await save('model-sized.nds.json');assert.equal(saved.project.layout.sizeMode,'models');await open(saved.path);assert.equal(await mode.inputValue(),'models');assertBoxes(await geometry(),resized);
 await page.locator('#zoom-fit').click();await settle();await selectBody('a');await mode.selectOption('spacing');assert.equal(await mode.inputValue(),'spacing');
 // Spacing is invalid for one body; the size dialog must explain why and retry.
 await page.locator('#drawing-size').click();await field('Size (% of current size)').fill('110');await dialog.getByRole('button',{name:'Apply size',exact:true}).click();
 await dialog.locator('[role="alert"]:visible').filter({hasText:'Select at least two objects'}).waitFor();assert.equal(await field('Size (% of current size)').inputValue(),'110');await close();assertBoxes(await geometry(),resized);
 await selectBody('b',true);assert.equal(await page.locator('#drawing-selection').textContent(),'2 selected');
 await page.locator('#drawing-size').click();await field('Size (% of current size)').fill('110');await dialog.getByRole('button',{name:'Apply size',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 const spaced=await geometry(),left=Math.min(resized.a.x,resized.b.x),top=Math.min(resized.a.y,resized.b.y);
 for(const id of ['a','b']){for(const axis of ['w','h'])near(spaced[id][axis],resized[id][axis],id+' spacing retains '+axis);near(spaced[id].x,left+(resized[id].x-left)*1.1,id+' spacing x');near(spaced[id].y,top+(resized[id].y-top)*1.1,id+' spacing y');}assertGlue(spaced);
 assert.ok(spaced.b.y-spaced.a.y>resized.b.y-resized.a.y,'The spacing action actually changes separation');
 await page.locator('#drawing-undo').click();assertBoxes(await geometry(),resized);assert.equal(await mode.inputValue(),'spacing');await page.locator('#drawing-redo').click();assertBoxes(await geometry(),spaced);
 saved=await save('layout-spaced.nds.json');assert.equal(saved.project.layout.sizeMode,'spacing');await open(saved.path);assert.equal(await mode.inputValue(),'spacing');assertBoxes(await geometry(),spaced);
 await mode.selectOption('models');await page.locator('#drawing-undo').click();assert.equal(await mode.inputValue(),'spacing');await page.locator('#drawing-redo').click();assert.equal(await mode.inputValue(),'models');assertBoxes(await geometry(),spaced);
 await page.locator('#zoom-fit').click();await page.screenshot({path:resolve(output,'model-spacing-controls.png')});
 results.sizing=['model mode default','resize without repacking','unselected dimensions and positions retained','single-object spacing rejection and dialog retry','spacing without resizing','physical socket glue','Undo/redo geometry and mode','both modes save/reopen'];

 // Grouping is persistent membership, not a copy or layout rearrangement.
 await open(fixture(rotationProject()));await page.locator('#zoom-fit').click();await settle();await selectBody('a');await selectBody('b',true);
 const ungrouped=await geometry();await page.locator('#drawing-group').click();assertBoxes(await geometry(),ungrouped);
 await page.locator('#drawing-clear').click();await selectBody('a');assert.equal(await page.locator('#drawing-selection').textContent(),'2 selected');assert.equal(await page.locator('#drawing-ungroup').isEnabled(),true);
 await page.keyboard.press('ArrowRight');const movedGroup=await geometry(),dx=movedGroup.a.x-ungrouped.a.x;assert.ok(dx>0,'A grouped member moves the complete group');
 for(const id of ['a','b']){near(movedGroup[id].x-ungrouped[id].x,dx,id+' grouped translation');for(const axis of ['y','w','h'])near(movedGroup[id][axis],ungrouped[id][axis],id+' grouped move retains '+axis);}assertGlue(movedGroup);
 await page.locator('#drawing-undo').click();assertBoxes(await geometry(),ungrouped);await page.locator('#drawing-redo').click();assertBoxes(await geometry(),movedGroup);
 await page.locator('#drawing-larger').click();const scaledGroup=await geometry(),cx=(Math.min(movedGroup.a.x,movedGroup.b.x)+Math.max(movedGroup.a.x+movedGroup.a.w,movedGroup.b.x+movedGroup.b.w))/2,cy=(Math.min(movedGroup.a.y,movedGroup.b.y)+Math.max(movedGroup.a.y+movedGroup.a.h,movedGroup.b.y+movedGroup.b.h))/2;
 for(const id of ['a','b']){near(scaledGroup[id].x,cx+(movedGroup[id].x-cx)*1.1,id+' shared scale x');near(scaledGroup[id].y,cy+(movedGroup[id].y-cy)*1.1,id+' shared scale y');for(const axis of ['w','h'])near(scaledGroup[id][axis],movedGroup[id][axis]*1.1,id+' shared scale '+axis);}assertGlue(scaledGroup);
 await page.locator('#drawing-undo').click();assertBoxes(await geometry(),movedGroup);await page.locator('#drawing-redo').click();assertBoxes(await geometry(),scaledGroup);
 saved=await save('grouped-models.nds.json');assert.equal(saved.project.layout.drawingGroups.length,1);assert.deepEqual([...saved.project.layout.drawingGroups[0].keys].sort(),[scaledGroup.a.key,scaledGroup.b.key].sort());
 await open(saved.path);assertBoxes(await geometry(),scaledGroup);await page.locator('#zoom-fit').click();await selectBody('b');assert.equal(await page.locator('#drawing-selection').textContent(),'2 selected');
 await page.screenshot({path:resolve(output,'grouped-model-controls.png')});await page.locator('#drawing-ungroup').click();assertBoxes(await geometry(),scaledGroup);
 await page.locator('#drawing-clear').click();await selectBody('a');assert.equal(await page.locator('#drawing-selection').textContent(),'1 selected');assert.equal(await page.locator('#drawing-ungroup').isDisabled(),true);
 saved=await save('ungrouped-models.nds.json');assert.deepEqual(saved.project.layout.drawingGroups,[]);await open(saved.path);assertBoxes(await geometry(),scaledGroup);
 results.groups=['group without repositioning','member selection expands group','shared translation and proportional size','physical socket glue','atomic move/size Undo/redo','membership and geometry save/reopen','ungroup preserves geometry'];

 // Physical paper freezes its fitted frame instead of shrinking every edit.
 await open(fixture(rotationProject()));const unlocked=await save('before-page-lock.nds.json');
 const pageFrame=()=>page.locator('#canvas svg').evaluate(svg=>{const b=svg.viewBox.baseVal;return {x:b.x,y:b.y,w:b.width,h:b.height};});
 const paperDialog=async()=>{await page.locator('#page-options').click();await field('Visible page proportions').waitFor();};
 const applyPaper=async()=>{await dialog.getByRole('button',{name:'Save page options',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);};
 await paperDialog();await field('Visible page proportions').selectOption('a4');assert.equal(await field('Lock physical page size').isChecked(),true);await close();assert.deepEqual((await save('cancelled-page-lock.nds.json')).project,unlocked.project);
 await paperDialog();await field('Visible page proportions').selectOption('a4');await field('Page orientation').selectOption('landscape');await applyPaper();
 const lockedFrame=await pageFrame(),lockedBodies=await geometry();near(lockedFrame.w,297*96/25.4,'Locked A4 width');near(lockedFrame.h,210*96/25.4,'Locked A4 height');assertGlue(lockedBodies);
 saved=await save('locked-page.nds.json');assert.equal(Object.values(saved.project.layout.pageSetup.visible.pages)[0].locked,true);assert.equal(Object.keys(saved.project.layout.pageSetup.visible.lockFrames).length,1);
 await selectBody('a');await page.locator('#drawing-size').click();await field('Size (% of current size)').fill('400');await dialog.getByRole('button',{name:'Apply size',exact:true}).click();
 await dialog.locator('[role="alert"]:visible').filter({hasText:'exceeds the locked page'}).waitFor();assert.equal(await field('Size (% of current size)').inputValue(),'400');assert.deepEqual(await pageFrame(),lockedFrame);assertBoxes(await geometry(),lockedBodies);
 await page.screenshot({path:resolve(output,'locked-page-overflow.png')});
 // The same failed dialog accepts a corrected size without losing its scope.
 await field('Size (% of current size)').fill('90');await dialog.getByRole('button',{name:'Apply size',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
 const smaller=await geometry();assert.deepEqual(await pageFrame(),lockedFrame);for(const axis of ['x','y'])near(smaller.a[axis],lockedBodies.a[axis],'Locked page model retains '+axis);for(const axis of ['w','h'])near(smaller.a[axis],lockedBodies.a[axis]*.9,'Locked page model changes '+axis);for(const axis of ['x','y','w','h'])near(smaller.b[axis],lockedBodies.b[axis],'Locked page does not refit unselected '+axis);assertGlue(smaller);
 await page.locator('#drawing-undo').click();assertBoxes(await geometry(),lockedBodies);assert.deepEqual(await pageFrame(),lockedFrame);await page.locator('#drawing-redo').click();assertBoxes(await geometry(),smaller);
 saved=await save('locked-page-edited.nds.json');await open(saved.path);assert.deepEqual(await pageFrame(),lockedFrame);assertBoxes(await geometry(),smaller);await paperDialog();assert.equal(await field('Lock physical page size').isChecked(),true);
 await field('Lock physical page size').uncheck();await applyPaper();saved=await save('unlocked-page.nds.json');assert.equal(Object.values(saved.project.layout.pageSetup.visible.pages)[0].locked,false);assert.deepEqual(saved.project.layout.pageSetup.visible.lockFrames,{});
 results.pageLock=['cancel does not change paper','physical A4 dimensions','lock frame saved','visible overflow error and unchanged scene','corrected size retry','frozen scale preserves other bodies','Undo/redo and save/reopen','unlock clears the frame'];
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'results.json'),JSON.stringify({...results,errors},null,2));console.log(JSON.stringify({...results,errors},null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});console.error('Browser errors:',errors);throw error;}finally{await browser.close();}
