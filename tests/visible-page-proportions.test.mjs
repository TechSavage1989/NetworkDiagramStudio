import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,printDocument} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {cleanPageSetup,visiblePagePaper,paperDimensions,pageFamily} from '../src/web/page-options.mjs';
import {cleanLayout} from '../src/web/layout.mjs';

const site=visible=>{const project=sampleSite();project.layout={...project.layout,pageSetup:{visible}};return project;};
const build=visible=>buildPages(site(visible));
const shape=page=>page.width/page.height;
const signature=page=>JSON.stringify(page.items.map(item=>[item.editKey,item.type,item.x,item.y,item.w,item.h,item.size,item.value,item.points]));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' should equal '+b);

test('paper dimensions represent the selected orientation, not real-world drawing scale',()=>{
 close(paperDimensions({preset:'a4',orientation:'portrait'}).ratio,210/297);
 close(paperDimensions({preset:'a4',orientation:'landscape'}).ratio,297/210);
 assert.equal(paperDimensions({preset:'dynamic'}),null);
});

test('visible page setting changes boundaries while retaining every drawing item and its edit identity',()=>{
 const original=build({}),source=original[0],target=source.name;
 const changed=build({pages:{[target]:{preset:'a4',orientation:'portrait'}}}),page=changed.find(p=>p.name===target);
 assert.equal(changed.length,original.length,'paper must not repaginate');
 assert.ok(page);
 close(shape(page),210/297);
 assert.notEqual(shape(source),shape(page),'visible sheet proportions must change');
 assert.equal(signature(source),signature(page),'item coordinates and proportions must remain unchanged');
 assert.equal(page.printPaper.preset,'a4','printing matches visible paper unless independently overridden');
 for(const other of original.slice(1))assert.equal(signature(other),signature(changed.find(p=>p.name===other.name)));
 assert.match(page.svg,/viewBox="/);
 const html=printDocument([page]);
 assert.ok(html.includes('@page nds0{size:210.0000mm 297.0000mm'));
});

test('individual page overrides its group and default; dynamic override cancels inherited paper',()=>{
 const original=build({}),core=original[0],group=core.family||pageFamily(core.name);
 const configured={default:{preset:'letter',orientation:'portrait'},groups:{[group]:{preset:'a3',orientation:'landscape'}},pages:{[core.name]:{preset:'a4',orientation:'portrait'}}};
 const modified=build(configured),selected=modified.find(p=>p.name===core.name);
 close(shape(selected),210/297);
 const peers=modified.filter(p=>(p.family||pageFamily(p.name))===group&&p.name!==core.name);
 if(peers.length)close(shape(peers[0]),420/297);
 const dynamic=build({...configured,pages:{[core.name]:{preset:'dynamic'}}}).find(p=>p.name===core.name);
 close(shape(dynamic),shape(core));
 const cleaned=cleanPageSetup({visible:configured});assert.equal(cleaned.visible.pages[core.name].preset,'a4');
 const reopened=cleanLayout({pageSetup:cleaned},site({}).devices.map(d=>d.id));assert.equal(reopened.pageSetup.visible.pages[core.name].preset,'a4');
 assert.equal(visiblePagePaper({layout:{pageSetup:cleaned}},core).preset,'a4');
});

test('print paper can be independent from visible page without reshaping the diagram',()=>{
 const first=site({default:{preset:'a4',orientation:'landscape'}});
 first.layout.pageSetup.printPaper={preset:'letter',orientation:'portrait'};
 const pages=buildPages(first),p=pages[0];
 close(shape(p),297/210);
 assert.equal(p.printPaper.preset,'letter');
 assert.equal(p.printPaper.orientation,'portrait');
 assert.ok(printDocument([p]).includes('@page nds0{size:215.9000mm 279.4000mm'));
});
