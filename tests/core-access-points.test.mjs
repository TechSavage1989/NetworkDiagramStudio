import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {textWidth} from '../src/web/diagram/labels.mjs';

// Layout & content (or Device order) can show the wireless access points on
// the network pages; short AP names stay on one line. Fictional sample.
test('access points can be shown on the network page, with whole names',()=>{
 const cache=new Map(),site=sampleSite(),aps=site.devices.filter(d=>d.kind==='ap');assert.ok(aps.length);
 const core=project=>buildPages(project,{cache}).find(page=>page.coreDeviceIds);
 const without=core(site);assert.ok(!without.items.some(i=>i.type==='device'&&i.kind==='ap'),'access points stay off by default');
 const shown=core({...site,layout:{...site.layout,includeAPs:true}});
 for(const ap of aps){
  assert.ok(shown.items.some(i=>i.type==='device'&&i.sourceId===ap.id),ap.name+' is drawn');
  const title=shown.items.find(i=>i.titleOwner===ap.id&&!i.titleSlot);
  assert.ok(title.w>=textWidth(title.value,title.size,true)-.5,ap.name+' fits on one line');
 }
 assert.ok(shown.items.some(i=>i.type==='path'&&aps.some(ap=>i.sourceLink?.a===ap.id||i.sourceLink?.b===ap.id)),'their cables are routed');
 assert.ok(!core(site).items.some(i=>i.type==='device'&&i.kind==='ap'),'turning it off again rebuilds through the cache');
});
