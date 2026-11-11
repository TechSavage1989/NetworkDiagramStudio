import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {wirelessTwoStackSite} from './fixtures/wireless-two-stack.mjs';

// Network (core) pages number switch and firewall sockets like the wireless
// pages. A socket with a cable on the page is named by its port label instead,
// so cable routes are exactly the same with numbers on or off.
test('core pages number uncabled switch sockets without changing any cable',()=>{
 const site=wirelessTwoStackSite({mac:false}),core=buildPages(site).find(page=>page.coreDeviceIds);
 const numbers=core.items.filter(i=>i.portNumberRole==='text');assert.ok(numbers.length>40,'faceplates carry port numbers');
 assert.ok(numbers.every(i=>!i.angle),'numbers stay upright');
 const onPage=new Set(core.coreDeviceIds),cabled=new Set(site.links.filter(e=>onPage.has(e.a)&&onPage.has(e.b)).flatMap(e=>[e.a+'/'+e.ap,e.b+'/'+e.bp]));assert.ok(cabled.size>=6);
 assert.ok(numbers.every(i=>!cabled.has(i.sourceId+'/'+i.portName)),'cabled sockets are named by their port label, not a number');
 assert.ok(numbers.some(i=>i.sourceId==='s2'&&i.portName==='7/1'),'a socket cabled only to an AP (not on this page) is numbered');
 const off={...site,layout:cleanLayout({...site.layout,corePortNumbers:false},site.devices.map(d=>d.id))};assert.equal(off.layout.corePortNumbers,false,'the off choice is saved');
 const plain=buildPages(off).find(page=>page.coreDeviceIds);
 assert.equal(plain.items.filter(i=>i.portNumberRole==='text').length,0,'Layout & content can turn the numbers off');
 const paths=page=>JSON.stringify(page.items.filter(i=>i.type==='path').map(i=>[i.editKey,i.points]));
 assert.equal(paths(core),paths(plain),'cable routes do not depend on the numbers');
 assert.equal(cleanLayout({corePortNumbers:true},[]).corePortNumbers,undefined,'on is the default and is not stored');
});
