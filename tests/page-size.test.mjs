import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio,printDocument} from '../src/web/diagram/index.mjs';
import {pageGeometry,cleanPageSetup,pageFamily,paperSizes} from '../src/web/page-options.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {unzip} from '../src/web/zip.mjs';
import {updatePresentation} from '../src/web/desktop-updates.mjs';
const stack=(count,id='stack')=>({id,name:'LAB-STACK',kind:'switch',model:'JL558A',stackMembers:Array.from({length:count},(_,i)=>({id:String(i+1),model:i<count-1?'JL558A':'JL256A'})),ports:Array.from({length:count},(_,i)=>({name:(i+1)+'/49'}))});
test('all preset orientations build bounded scenes with complete table data',()=>{
 const baseline=buildPages(sampleSite()),basePorts=new Set(baseline.flatMap(p=>p.portMap?.portRecords?.map(r=>r.device+'/'+r.name)||[]));
 for(const [preset] of paperSizes)for(const orientation of ['portrait','landscape']){
  const site=sampleSite();site.layout={pageSetup:{default:{preset,orientation}}};const pages=buildPages(site),g=pageGeometry(site);
  for(const p of pages){assert.equal(p.width,g.width);assert.equal(p.height,g.height);assert.ok(p.svg.includes('viewBox="0 0 '+p.width+' '+p.height+'"'));for(const i of p.items.filter(i=>i.type!=='path')){assert.ok(i.x>=0&&i.x+i.w<=p.width+1&&i.y+i.h<=p.height+1,preset+' '+orientation+' '+p.name+' '+i.value);if(i.type==='text')assert.ok(textLayout(i).size>=8);}}
  assert.deepEqual(new Set(pages.flatMap(p=>p.portMap?.portRecords?.map(r=>r.device+'/'+r.name)||[])),basePorts);
 }
});
test('mixed paper settings survive cleaning and control both print and native Visio page sizes',async()=>{
 const site=sampleSite();site.layout=cleanLayout({pageSetup:{default:{preset:'letter',orientation:'portrait'},overrides:{core:{preset:'a3',orientation:'landscape'},ports:{preset:'custom',widthMm:350,heightMm:500,orientation:'portrait'},invalid:{preset:'a1'}}}},site.devices.map(d=>d.id));
 assert.equal(site.layout.pageSetup.overrides.invalid,undefined);const pages=buildPages(JSON.parse(JSON.stringify(site))),html=printDocument(pages),parts=await unzip(await exportVisio(site,pages).arrayBuffer()),index=new TextDecoder().decode(parts.get('visio/pages/pages.xml'));
 for(const [i,p] of pages.entries()){const g=pageGeometry(site,pageFamily(p.name));assert.equal(p.width,g.width);assert.equal(p.height,g.height);assert.ok(html.includes('@page nds'+i+'{size:'+g.widthMm.toFixed(4)+'mm '+g.heightMm.toFixed(4)+'mm'));}
 const sizes=[...index.matchAll(/N="PageWidth" V="([^"]+)"\/><Cell N="PageHeight" V="([^"]+)"/g)];assert.equal(sizes.length,pages.length);sizes.forEach((s,i)=>{assert.ok(Math.abs(+s[1]-pages[i].width/96)<.0001);assert.ok(Math.abs(+s[2]-pages[i].height/96)<.0001);});
 assert.equal(cleanPageSetup({default:{widthMm:Infinity,heightMm:-1}}).default.widthMm,297);
});
test('larger paper fits more equipment without individual hardware shrinking',()=>{
 const site={name:'Capacity lab',devices:Array.from({length:10},(_,i)=>({id:'s'+i,name:'LAB-SWITCH-'+i,kind:'switch',model:'JL675A',ports:[]})),links:[]};
 const render=preset=>buildPages({...site,layout:{pageSetup:{default:{preset}}}}).filter(p=>p.coreDeviceIds),small=render('letter'),large=render('a2');assert.ok(large.length<small.length);
 for(const pages of [small,large]){const bodies=pages.flatMap(p=>p.items.filter(i=>i.type==='device'&&i.kind==='switch'));assert.equal(new Set(bodies.map(b=>b.w)).size,1);for(const b of bodies)assert.ok(Math.abs(b.w/b.h-deviceFaceplate(site.devices[0]).ratio)<1e-9);}
});
test('eight-member stacks fit original paper and oversized stacks continue with correct member anchors and cross-page links',async()=>{
 const site={name:'Member continuation lab',devices:[stack(8)],links:[]},original=buildPages(site).filter(p=>p.coreDeviceIds);assert.equal(original.length,1);const body=original[0].items.find(i=>i.sourceId==='stack'&&i.type==='device');assert.equal(body.w,700);
 site.devices=[stack(12),{id:'peer',name:'LAB-PEER',kind:'switch',model:'JL675A',ports:[{name:'1/1/49'},{name:'1/1/51'}]}];site.links=[{a:'stack',ap:'1/49',b:'peer',bp:'1/1/49',media:'DAC',speed:'10 Gbps'},{a:'peer',ap:'1/1/51',b:'stack',bp:'12/49',media:'DAC',speed:'10 Gbps'}];site.layout={pageSetup:{default:{preset:'letter'}},corePages:[{id:'rack',name:'Test rack',devices:['stack','peer']}]};
 const pages=buildPages(site),core=pages.filter(p=>p.coreDeviceIds),pieces=core.flatMap(p=>p.items.filter(i=>i.type==='device'&&i.sourceId==='stack'&&i.kind!=='plug'));assert.ok(pieces.length>1);assert.equal(new Set(pieces.map(b=>b.w)).size,1);assert.ok(pieces.some(b=>b.ports['1/49']));assert.ok(pieces.some(b=>b.ports['12/49']));assert.ok(!pieces.some(b=>b.ports['1/49']&&b.ports['12/49']));assert.ok(core.every(p=>p.corePageId==='rack'));
 for(const link of site.links){const paths=core.flatMap(p=>p.items.filter(i=>i.type==='path'&&i.sourceLink?.ap===link.ap&&i.sourceLink?.bp===link.bp));assert.equal(paths.length,2);for(const path of paths){const stackEnd=[path.from,path.to].find(e=>e.port=== (link.a==='stack'?link.ap:link.bp));if(stackEnd)assert.ok(pieces.some(b=>b.key===stackEnd.device&&b.ports[stackEnd.port]));}}
 const parts=await unzip(await exportVisio(site,pages).arrayBuffer());assert.ok(parts.has('visio/pages/page1.xml'));
});
test('updater presentation separates checking, downloading, verification and installation readiness',()=>{
 assert.equal(updatePresentation({checking:true}).phase,'checking');assert.equal(updatePresentation({available:true}).phase,'available');assert.equal(updatePresentation({available:true,fetching:true,progress:50}).phase,'downloading');assert.equal(updatePresentation({available:true,fetching:true,progress:100}).phase,'verifying');assert.equal(updatePresentation({available:true,downloaded:true}).phase,'ready');assert.equal(updatePresentation({message:'Could not check for updates.'}).phase,'error');
});
