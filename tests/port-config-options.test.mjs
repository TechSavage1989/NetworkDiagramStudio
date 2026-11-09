import test from 'node:test';
import assert from 'node:assert/strict';
import {existingVlanOptions,portVlanIds,portRoleOptions,portSpeedOptions} from '../src/web/port-config-options.mjs';
test('port VLAN suggestions combine document definitions and existing associations without duplicates',()=>{
 const devices=[{vlans:[{id:20,name:'Voice'},{id:10,name:'Data'}],ports:[{native:30,tagged:[20,40]}]},{vlans:[{id:20,name:'Phones'},{id:4095}],ports:[{native:0}]}];
 assert.deepEqual(existingVlanOptions({devices},devices[0]).map(v=>v.id),[10,20,30,40]);
 assert.match(existingVlanOptions({devices})[1].label,/Phones.*Voice/);
 assert.deepEqual(devices[0].ports[0].tagged,[20,40]);
});
test('VLAN entry permits manual IDs, deduplicates and validates native versus tagged',()=>{
 assert.deepEqual(portVlanIds(' 20, 999,20 '),[20,999]);
 assert.deepEqual(portVlanIds('4094',{single:true}),[4094]);
 assert.deepEqual(portVlanIds(''),[]);
 for(const value of ['0','4095','2-5','2,','x'])assert.throws(()=>portVlanIds(value),/1 to 4094/);
 assert.throws(()=>portVlanIds('1,2',{single:true}));
 assert.ok(portRoleOptions.includes('trunk'));assert.ok(portRoleOptions.includes('access'));
 assert.ok(portSpeedOptions.length>5);assert.ok(portSpeedOptions.every(v=>typeof v==='string'));
});
