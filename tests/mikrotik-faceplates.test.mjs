import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mikrotikFaceplates} from '../src/web/imports/mikrotik-faceplates.mjs';
import {deviceFaceplate,faceplateProfile} from '../src/web/diagram/faceplate.mjs';
const expected=[['CRS326-24S+2Q+RM',27],['CRS328-24P-4S+RM',28],['CRS317-1G-16S+RM',17],['CRS309-1G-8S+IN',9],['CRS305-1G-4S+IN',5],['CRS326-24G-2S+RM',26],['CRS326-24G-2S+IN',26]];
test('every recognized native MikroTik model and shared identity has a physical faceplate',()=>{
 const native=readFileSync(new URL('../desktop/SwitchportReports/Engine/MikroTikParser.cs',import.meta.url),'utf8');
 const models=[...native.matchAll(/new\("(CRS[^\"]+)",\d+,\d+,\d+,(?:true|false)\)/g)].map(m=>m[1]);
 assert.deepEqual(models.sort(),expected.map(([m])=>m).sort());
 for(const [model,count] of expected)for(const shared of [false,true]){
  const d={model:(shared?'MIKROTIK-SHARED-':'')+model},p=deviceFaceplate(d),profile=faceplateProfile(d);
  assert.equal(p.verified,true);assert.equal(p.sockets.length,count);assert.equal(Object.keys(p.ports).length,count);assert.ok(!p.ports.console);
  assert.equal(!!profile.familyOnly,shared);assert.match(p.source,/^https:\/\/mikrotik.com\/product\//);
  for(const s of p.sockets){assert.ok(s.x>0&&s.x<1&&s.y>0&&s.y<1);assert.ok(p.children.some(c=>c.anchorName===s.name));}
 }
 assert.equal(mikrotikFaceplates.length,models.length*2);
});
test('model-specific bank ordering and row numbering match manufacturer front views',()=>{
 const p=m=>deviceFaceplate({model:m}).ports;
 for(const model of ['CRS326-24G-2S+RM','CRS326-24G-2S+IN','CRS328-24P-4S+RM']){
  const a=p(model);assert.ok(a.ether1[1]>a.ether2[1]);assert.equal(a.ether1[0],a.ether2[0]);
  assert.ok(a.ether9[0]-a.ether7[0]>(a.ether3[0]-a.ether1[0])*1.2);assert.ok(a['sfp-sfpplus1'][0]>a.ether24[0]);
 }
 const fiber=p('CRS326-24S+2Q+RM');assert.ok(fiber['sfp-sfpplus1'][1]>fiber['sfp-sfpplus2'][1]);assert.ok(fiber.qsfpplus1[1]>fiber.qsfpplus2[1]);assert.ok(fiber.ether1[0]>fiber.qsfpplus1[0]);
 for(const m of ['CRS309-1G-8S+IN','CRS317-1G-16S+RM'])assert.ok(p(m).ether1[0]>p(m)['sfp-sfpplus1'][0]);
 assert.ok(p('CRS305-1G-4S+IN').ether1[0]<p('CRS305-1G-4S+IN')['sfp-sfpplus1'][0]);
});
test('QSFP lane aliases attach to the physical cage without inventing eight sockets',()=>{
 const panel=deviceFaceplate({model:'CRS326-24S+2Q+RM',ports:[{name:'qsfpplus1-3'},{name:'qsfpplus2-4'}]});
 assert.deepEqual(panel.ports['qsfpplus1-3'],panel.ports.qsfpplus1);assert.deepEqual(panel.ports['qsfpplus2-4'],panel.ports.qsfpplus2);assert.equal(panel.sockets.length,27);
});
