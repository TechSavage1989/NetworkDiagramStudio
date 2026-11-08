import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {intersects,pathCrossesText,textFootprint} from '../src/web/diagram/labels.mjs';
import {parallelUplinks,tallWirelessCaptions} from './fixtures/caption-layouts.mjs';

function glued(page){
 for(const path of page.items.filter(i=>i.type==='path'))for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]]){
  const device=page.items.find(i=>i.key===anchor.device),port=device?.ports[anchor.port];assert.ok(port);
  assert.ok(Math.abs(point[0]-device.x-port[0]*device.w)<1e-6);assert.ok(Math.abs(point[1]-device.y-port[1]*device.h)<1e-6);
 }
}

test('dynamic parallel stack uplinks keep complete readable labels, clear routes and glued ports on one page',()=>{
 for(const scale of [1,1.5,2]){
  const project=parallelUplinks(scale),saved=JSON.stringify(project),pages=buildPages(project),core=pages.filter(p=>p.coreDeviceIds);assert.equal(core.length,1);
  const page=core[0],paths=page.items.filter(i=>i.type==='path'),texts=page.items.filter(i=>i.type==='text'),labels=texts.filter(i=>i.labelRole),bodies=page.items.filter(i=>i.type==='device');
  assert.equal(paths.length,8);assert.deepEqual(page.coreDeviceIds,['a','b']);assert.ok(bodies.filter(i=>i.kind==='switch').every(i=>i.w===700));
  for(const path of paths){const media=labels.filter(i=>i.linkId===path.linkId&&i.labelRole==='media');assert.equal(media.map(i=>i.value).join('').replace(/\s/g,''),'Mediaunspecified10Gbps');assert.equal(labels.filter(i=>i.linkId===path.linkId&&i.labelRole==='port').length,2);}
  for(const label of labels){assert.equal(label.size,12*scale);assert.ok(!texts.some(other=>other!==label&&intersects(label,other)));assert.ok(!paths.some(path=>label.background&&path.linkId===label.linkId?(path.hops||[]).some(hop=>intersects(hop,label,1)):pathCrossesText(path,label,1)),'Only inline connector text may sit on its own cable');assert.ok(!bodies.some(body=>intersects(label,body)));const b=textFootprint(label);assert.ok(b.x>=page.originX&&b.y>=page.originY&&b.x+b.w<=page.originX+page.width&&b.y+b.h<=page.originY+page.height);}
  glued(page);assert.equal(JSON.stringify(project),saved);assert.equal(buildPages(JSON.parse(saved))[0].svg,page.svg);
 }
});

test('dynamic wireless sheets grow for complete upper and lower captions while retaining paper limits',()=>{
 const project=tallWirelessCaptions(),pages=buildPages(project).filter(p=>p.title==='Wireless Connections');assert.equal(pages.length,2);assert.ok(pages.every(p=>p.height>975));
 for(const page of pages){glued(page);const paths=page.items.filter(i=>i.type==='path'),captions=page.items.filter(i=>i.type==='text'&&i.value.startsWith('LAB-AP-'));assert.equal(captions.length,1);const title=captions[0];assert.ok(project.devices.some(d=>d.name===title.value));assert.ok(title.y+title.h<page.height-47);assert.ok(!paths.some(p=>pathCrossesText(p,title)));}
 assert.throws(()=>buildPages({...project,layout:{pageSetup:{overrides:{wireless:{preset:'original'}}}}}),/wireless caption needs more space/);
});
