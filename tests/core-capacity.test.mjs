import test from 'node:test';
import assert from 'node:assert/strict';
import {placeCableLabels,placeDeviceTitles,intersects,pathCrossesText,textWidth,textFootprint} from '../src/web/diagram/labels.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {cleanLayout,coreLinkKey} from '../src/web/layout.mjs';
import {ProjectHistory} from '../src/web/history.mjs';

const compute=()=>({id:'compute',name:'Scale Hypercore Scale Hypercore Scale Hypercore Node 01',kind:'unknown',model:'Unspecified hypervisor',ports:[]});
const core=project=>buildPages(project).filter(page=>page.title.startsWith('Core Network'));
const body=(pages,id)=>pages.flatMap(page=>page.items).find(item=>item.type==='device'&&item.kind!=='plug'&&item.sourceId===id);
function validateTitles(pages){
 for(const page of pages){const bodies=page.items.filter(item=>item.type==='device'&&item.kind!=='plug'),titles=page.items.filter(item=>item.titleOwner),paths=page.items.filter(item=>item.type==='path');
  for(const title of titles){assert.ok(title.x>=318&&title.x+title.w<=1162);assert.ok(title.y>=151&&title.y+title.h<906);assert.ok(!bodies.some(item=>intersects(title,item,3)));assert.ok(!paths.some(path=>pathCrossesText(path,title,3)));}
  for(let i=0;i<titles.length;i++)for(let j=i+1;j<titles.length;j++)assert.ok(!intersects(titles[i],titles[j],3));
 }
}

test('wrapped automatic titles use the rendered box instead of the full unwrapped string width',()=>{
 const title={type:'text',titleOwner:'lab',value:'A long hyperconverged compute node title '.repeat(6),x:430,y:300,w:280,h:88,size:18,bold:true},page={name:'Core Network',legendLayout:'sidebar',items:[title]},node={sourceId:'lab',x:430,y:400,w:400,h:60};assert.ok(textWidth(title.value,title.size,title.bold)>1200);placeDeviceTitles(page,{},new Map([['lab',node]]));assert.equal(title.w,280);assert.ok(title.x>=318&&title.x+title.w<=1162);assert.ok(!intersects(title,node,3));
});

test('unplaceable titles expose a structured capacity failure for bounded automatic repagination',()=>{
 const title={type:'text',titleOwner:'lab',editKey:'title',value:'Lab',x:430,y:200,w:200,h:24,size:18},page={name:'Fixed Core',legendLayout:'sidebar',items:[title,{type:'text',value:'Occupied',x:318,y:151,w:844,h:755,size:12}]};
 assert.throws(()=>placeDeviceTitles(page,{},new Map([['lab',{sourceId:'lab',x:430,y:400,w:600,h:60}]])),error=>error.code==='CORE_LAYOUT_CAPACITY'&&error.role==='title'&&error.owner==='lab'&&error.page==='Fixed Core');
});

test('adding a compute device to a crowded automatic core creates continuation sheets without dropping devices or connections',()=>{
 const project=sampleSite(),before=core(project);assert.equal(before.length,1);project.devices.splice(3,0,compute());const after=core(project);assert.ok(after.length>1&&after.length<=4);
 for(const id of ['edge','sw-1','sw-2','compute'])assert.ok(body(after,id),id);assert.equal(after.flatMap(page=>page.items).find(item=>item.titleOwner==='compute').value,compute().name);
 const original=new Set(before.flatMap(page=>page.items.filter(item=>item.type==='path').map(item=>JSON.stringify(item.sourceLink)))),kept=new Set(after.flatMap(page=>page.items.filter(item=>item.type==='path').map(item=>JSON.stringify(item.sourceLink))));assert.deepEqual(kept,original);assert.ok(after.some(page=>page.coreDeviceIds.includes('compute')));validateTitles(after);
 assert.deepEqual(after.map(page=>page.svg),core(project).map(page=>page.svg));
});

test('automatic continuation preserves accepted drawing edits, project state and undo redo for the added device',()=>{
 let project=sampleSite();const before=core(project),edge=body(before,'edge'),title=before[0].items.find(item=>item.titleOwner==='edge'&&item.titleSlot!=='detail');project.layout={drawingEdits:{[edge.editKey]:{x:442},[title.editKey]:{color:'#2255AA'}}};const history=new ProjectHistory(project),patches=JSON.stringify(project.layout.drawingEdits);project.devices.splice(3,0,compute());history.record(project,'device');let pages=core(project);assert.ok(pages.length>1);assert.equal(body(pages,'edge').x,442);assert.equal(pages.flatMap(page=>page.items).find(item=>item.titleOwner==='edge'&&item.titleSlot!=='detail').color,'#2255AA');assert.equal(JSON.stringify(project.layout.drawingEdits),patches);
 project=history.travel(project,{validate:buildPages});assert.ok(!project.devices.some(device=>device.id==='compute'));assert.equal(core(project).length,1);assert.equal(body(core(project),'edge').x,442);
 project=history.travel(project,{redo:true,validate:buildPages});pages=core(project);assert.ok(project.devices.some(device=>device.id==='compute'));assert.ok(pages.length>1);assert.equal(body(pages,'edge').x,442);assert.equal(JSON.stringify(project.layout.drawingEdits),patches);
});

test('an overfull explicit core page reports capacity clearly without mutating the accepted project',()=>{
 const project=sampleSite();project.devices.splice(3,0,compute());project.layout={corePages:[{id:'fixed',name:'Fixed core',devices:['edge','sw-1','sw-2','compute']}]};const accepted=JSON.stringify(project);
 assert.throws(()=>buildPages(project),error=>error.code==='CORE_LAYOUT_CAPACITY'&&error.page==='Fixed core'&&/needs more (?:space|room)/i.test(error.message));assert.equal(JSON.stringify(project),accepted);
});

test('a vertical label follows its own cable on the side away from a nearby parallel cable',()=>{
 const owner={type:'path',linkId:1,points:[[500,250],[500,550]]};
 const neighbor={type:'path',linkId:2,points:[[490,250],[490,550]]};
 const page={items:[owner,neighbor],legendLayout:'sidebar'};
 const result=placeCableLabels(page,[{role:'media',editKey:'media',linkId:1,value:['Fiber','10 Gbps'],y:400,side:'left',outer:500}]);
 assert.equal(result.ok,true);
 const texts=page.items.filter(item=>item.type==='text');
 assert.equal(texts.length,2);
 for(const item of texts){
  assert.equal(item.angle,Math.PI/2);
  assert.ok(textFootprint(item).x>=505);
  assert.ok(!pathCrossesText(owner,item)&&!pathCrossesText(neighbor,item));
 }
 assert.ok(!intersects(...texts));
});

test('a dedicated page can hide one off-page connection without changing project links',()=>{
 const project=sampleSite();
 const link=project.links.find(link=>[link.a,link.b].includes('sw-2'));
 assert.ok(link);
 project.layout=cleanLayout({corePages:[{id:'dedicated',name:'Distribution',devices:['sw-2']}]},project.devices.map(device=>device.id));
 const dedicated=()=>buildPages(project).find(page=>page.title==='Distribution');
 assert.ok(dedicated().items.some(item=>item.labelRole==='reference'));
 project.layout.corePages[0].hiddenReferences=[coreLinkKey(link)];
 project.layout=cleanLayout(JSON.parse(JSON.stringify(project.layout)),project.devices.map(device=>device.id));
 assert.ok(!dedicated().items.some(item=>item.sourceLink&&coreLinkKey(item.sourceLink)===coreLinkKey(link)));
 assert.ok(project.links.includes(link));
});
