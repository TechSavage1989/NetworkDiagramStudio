import test from 'node:test';
import assert from 'node:assert/strict';
import {newPageSetup,cleanPageSetup,visiblePagePaper} from '../src/web/page-options.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {buildPages,printDocument} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {adaptiveStack} from './fixtures/adaptive-port-maps.mjs';
const mapPaper=project=>visiblePagePaper(project,{name:'MDF Port Map',family:'ports'});

test('new projects default every page family to Letter landscape',()=>{
 const project={layout:{pageSetup:newPageSetup()}};
 assert.equal(mapPaper(project).preset,'letter');assert.equal(mapPaper(project).orientation,'landscape');
 assert.equal(mapPaper(project).locked,false);
 for(const family of ['core','sitemap','wireless','logical','trunk','switchports']){const paper=visiblePagePaper(project,{family});assert.equal(paper.preset,'letter');assert.equal(paper.orientation,'landscape');assert.equal(paper.locked,false);}
 // Saved projects keep their own choice; only a project without one is Dynamic.
 assert.equal(visiblePagePaper({layout:{}},{family:'core'}).preset,'dynamic');
 const other=newPageSetup();project.layout.pageSetup.visible.groups.ports.preset='a3';assert.equal(other.visible.groups.ports.preset,'letter');
});
test('existing implicit Dynamic and explicit paper settings are not migrated on load',()=>{
 for(const setup of [undefined,{}, {visible:{default:{preset:'a4',orientation:'portrait'}}},{visible:{groups:{ports:{preset:'a3'}}}},{visible:{groups:{ports:{preset:'dynamic'}}}}]){
  const expected=mapPaper({layout:{pageSetup:setup}});
  const project={layout:cleanLayout({pageSetup:setup},[])};
  assert.deepEqual(mapPaper(project),expected);
 }
});
test('new Letter defaults persist through save/reopen and permit page/family overrides',()=>{
 const project={layout:{pageSetup:newPageSetup()}};
 project.layout=cleanLayout(JSON.parse(JSON.stringify(project.layout)),[]);
 assert.equal(mapPaper(project).preset,'letter');
 project.layout.pageSetup.visible.groups.ports={preset:'a4',orientation:'portrait'};
 assert.equal(mapPaper(project).preset,'a4');
 project.layout.pageSetup.visible.pages={'MDF Port Map':{preset:'tabloid'}};
 assert.equal(mapPaper(project).preset,'tabloid');
 assert.equal(cleanPageSetup().visible.groups.ports,undefined,'cleaning is not project creation');
});
test('new default builds and prints a complete Letter map, including stack members',()=>{
 const project={name:'Fictional Letter default',devices:[adaptiveStack(5)],links:[],layout:{pageSetup:newPageSetup()}};
 const pages=buildPages(project).filter(p=>p.portMap?.switchportSheet);assert.equal(pages.length,1);
 const page=pages[0];assert.equal(page.visiblePaper.preset,'letter');
 assert.ok(Math.abs(page.width/page.height-11/8.5)<1e-8);
 assert.equal(page.items.filter(i=>i.reportPanel).length,5);
 assert.ok(printDocument(pages).includes('279.4000mm 215.9000mm'));
});


test('adaptive physical port maps retain descriptive navigation identities across paper changes and reopen',()=>{
 const project=sampleSite(),original=buildPages(project).filter(p=>p.portMap?.switchportSheet);
 assert.deepEqual(original.map(p=>p.displayName),['SW-1 / Port map','SW-2 / Port map']);
 for(const preset of ['letter','a4']){
  const changed=structuredClone(project);changed.layout={...changed.layout,pageSetup:newPageSetup()};changed.layout.pageSetup.visible.groups.ports.preset=preset;
  for(const state of [changed,JSON.parse(JSON.stringify(changed))]){
   const maps=buildPages(state).filter(p=>p.portMap?.switchportSheet);
   assert.deepEqual(maps.map(p=>p.name),original.map(p=>p.name));
   assert.deepEqual(maps.map(p=>p.displayName),original.map(p=>p.displayName));
   assert.ok(maps.every(p=>p.adaptivePortMap));
  }
 }
});
