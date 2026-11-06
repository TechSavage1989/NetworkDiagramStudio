import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesHardware,modelKey} from '../src/web/hardware-match.mjs';
import {buildPages,exportStencil} from '../src/web/diagram/index.mjs';
import {unzip} from '../src/web/zip.mjs';

test('exact model, combo front, and persistent pack binding',()=>{
  const s={name:'FG-120/121G',view:'front'};
  for(const name of ['FortiGate 120G','FortiGate 121G'])assert.ok(matchesHardware(s,{model:name}));
  assert.ok(!matchesHardware(s,{model:'FortiGate 120F'}));
  assert.ok(!matchesHardware({...s,view:'rear'},{model:'FortiGate 120G'}));
  assert.ok(!matchesHardware({name:'AP-5150 front'},{model:'AP-515'}));
  assert.ok(matchesHardware({name:'OEM panel',models:[modelKey('Example','Rack 8')]},{vendor:'Example',model:'Rack 8'}));
});
test('configured local handoffs, date-free output and reusable stencil content types',async()=>{
  const project={name:'Lab',devices:[{id:'f',name:'Gate',kind:'firewall',ports:[{name:'wan1',role:'wan',gateway:'192.0.2.1',description:'ISP A',media:'copper'}]}],links:[]};
  const pages=buildPages(project);assert.ok(pages[0].svg.includes('ISP A'));assert.ok(pages[0].svg.includes('192.0.2.1'));
  assert.equal(pages[0].items.filter(i=>i.type==='path').length,1);
  const entries=await unzip(exportStencil(project,pages)),dec=new TextDecoder();
  assert.match(dec.decode(entries.get('[Content_Types].xml')),/stencil\.main\+xml/);
  assert.match(dec.decode(entries.get('visio/masters/masters.xml')),/<Master ID=/);
  assert.equal(entries.has('visio/pages/page1.xml'),false);
});
