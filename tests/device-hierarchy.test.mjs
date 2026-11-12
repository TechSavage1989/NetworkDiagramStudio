import test from 'node:test';
import assert from 'node:assert/strict';
import {hierarchyOrder,applyAutomaticOrder} from '../src/web/device-hierarchy.mjs';
import {moveDevice,moveStep,cleanLayout,orderedDevices} from '../src/web/layout.mjs';

// Fictional campus imported in an unhelpful order: access switches and APs
// first, the firewall last.
const campus=()=>({name:'Fictional campus',devices:[
 {id:'ap2',name:'LAB-AP-2',kind:'ap'},{id:'acc2',name:'LAB-ACCESS-2',kind:'switch'},{id:'ap1',name:'LAB-AP-1',kind:'ap'},
 {id:'acc1',name:'LAB-ACCESS-1',kind:'switch'},{id:'core',name:'LAB-CORE',kind:'switch'},{id:'dist',name:'LAB-DIST',kind:'switch'},
 {id:'srv',name:'LAB-SERVER',kind:'server'},{id:'fw',name:'LAB-FW',kind:'firewall'},{id:'stray',name:'LAB-SPARE',kind:'switch'}],
 links:[{a:'fw',ap:'port1',b:'core',bp:'1/49'},{a:'core',ap:'1/1',b:'dist',bp:'49'},{a:'dist',ap:'1',b:'acc2',bp:'49'},{a:'dist',ap:'2',b:'acc1',bp:'49'},
  {a:'acc1',ap:'7',b:'ap2',bp:'eth0'},{a:'acc1',ap:'3',b:'ap1',bp:'eth0'},{a:'core',ap:'1/10',b:'srv',bp:'eth0'}],layout:{}});

test('devices are ordered edge, core, distribution, access, then endpoints under their switch',()=>{
 const p=campus(),names=new Map(p.devices.map(d=>[d.id,d.name]));
 assert.deepEqual(hierarchyOrder(p).map(id=>names.get(id)),['LAB-FW','LAB-CORE','LAB-DIST','LAB-ACCESS-1','LAB-ACCESS-2','LAB-SPARE','LAB-SERVER','LAB-AP-1','LAB-AP-2']);
});

test('stacked devices stay together in member order',()=>{
 const p=campus();p.layout.deviceStacks=[{id:'s',name:'Access stack',members:[{deviceId:'acc2',number:1},{deviceId:'acc1',number:2}]}];
 const order=hierarchyOrder(p);assert.equal(order.indexOf('acc1'),order.indexOf('acc2')+1);
});

test('imports keep the hierarchy until a device is moved by hand',()=>{
 const p=campus();assert.equal(applyAutomaticOrder(p),true);assert.equal(p.layout.orderAuto,true);
 assert.equal(orderedDevices(p)[0].id,'fw');
 assert.deepEqual(cleanLayout(JSON.parse(JSON.stringify(p.layout)),p.devices.map(d=>d.id)).orderAuto,true,'the automatic marker is saved');
 p.devices.push({id:'acc3',name:'LAB-ACCESS-3',kind:'switch'});p.links.push({a:'dist',ap:'3',b:'acc3',bp:'49'});
 applyAutomaticOrder(p);assert.ok(p.layout.order.indexOf('acc3')<p.layout.order.indexOf('srv'),'new data re-applies the automatic order');
 moveStep(p,'core',1);assert.equal(p.layout.orderAuto,undefined,'a manual move takes over');
 const manual=[...p.layout.order];assert.equal(applyAutomaticOrder(p),false);assert.deepEqual(p.layout.order,manual,'and is kept on later imports');
 moveDevice(p,'fw',null);assert.equal(p.layout.order.at(-1),'fw');
 const saved=campus();saved.layout.order=['ap1','fw'];assert.equal(applyAutomaticOrder(saved),false,'an existing saved order is the user\'s');
});
