import test from 'node:test';
import assert from 'node:assert/strict';
import {composeEvidence,captureEdits,reopenEvidence,categories} from '../src/web/evidence.mjs';
import {inventoryForDevice,reportRequest} from '../src/web/reports/model.mjs';

function fixture(pascal=false){
 const inventory={hostname:'LAB',groups:[{id:'bank',product:'Fictional',device:'1',copper:1,optical:0,socketLayout:[{number:1,column:0,row:0,media:'RJ-45'}]}],ports:[{id:'1',group:'bank',number:1,relatedInterfaces:['Ethernet1'],media:'RJ-45',untaggedVlan:30,untaggedState:'Known',taggedVlans:[40],voiceVlan:40,aggregate:'Trk1',disabled:true,liveState:'Down',speed:'1000',stackLink:true,description:'Configured description',notes:['Address: 192.0.2.1/24','Dual-personality socket.']}],logicalInterfaces:[],vlans:[{id:30,name:'Data'}],svis:[{interface:'vlan 30',address:'192.0.2.1/24'}],routes:['0.0.0.0/0 192.0.2.254'],management:['Default gateway: 192.0.2.254'],mirrors:['mirror 1 port 1'],assumptions:['Configured default VLAN 30.']};
 const convert=value=>Array.isArray(value)?value.map(convert):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,value])=>[key==='svis'?'SVIs':key[0].toUpperCase()+key.slice(1),convert(value)])):value;
 const device={id:'lab',name:'LAB',kind:'switch',ports:[{name:'1',native:30}],vlans:[{id:30,name:'Data'}],routes:[{destination:'0.0.0.0/0',nextHop:'192.0.2.254'}],management:inventory.management,mirrors:inventory.mirrors,switchportInventory:pascal?convert(inventory):inventory};
 const source={id:'config',enabled:true,kind:'Configuration',categories:[...categories],model:{devices:[device],links:[],warnings:[]}};
 const project={devices:[],links:[],warnings:[],evidence:{base:{devices:[],links:[],warnings:[]},sources:[source],edits:{}}};
 return {project,source};
}

test('disabled report port category removes semantics but retains exact immutable hardware, with save/reopen and manual replay',()=>{
 for(const pascal of [false,true]){
  const {project,source}=fixture(pascal),original=JSON.stringify(source.model),snapshot=composeEvidence(project);
  project.devices[0].ports[0].native=50;captureEdits(project,snapshot);
  source.categories=categories.filter(name=>name!=='ports');composeEvidence(project);
  let device=project.devices[0],inv=inventoryForDevice(device);
  assert.deepEqual(device.ports,[]);assert.equal(inv.ports[0].untaggedVlan,null);assert.equal(inv.ports[0].disabled,null);assert.equal(inv.ports[0].stackLink,false);assert.deepEqual(inv.ports[0].taggedVlans,[]);assert.equal(inv.ports[0].speed,'Not specified');assert.equal(inv.ports[0].aggregate,'');assert.equal(inv.ports[0].description,'');
  assert.deepEqual(inv.ports[0].relatedInterfaces,['Ethernet1']);assert.equal(inv.ports[0].media,'RJ-45');assert.deepEqual(inv.ports[0].notes,[]);
  assert.equal(inv.groups[0].socketLayout[0].column,0);assert.equal(inv.groups[0].copper,1);assert.deepEqual(inv.management,[]);assert.deepEqual(inv.mirrors,[]);
  assert.equal(JSON.stringify(source.model),original);
  const reopened=reopenEvidence(JSON.parse(JSON.stringify(project)));assert.equal(inventoryForDevice(reopened.devices[0]).ports[0].untaggedVlan,null);
  reopened.evidence.sources[0].categories=[...categories];composeEvidence(reopened);assert.equal(reopened.devices[0].ports[0].native,50);
  reopened.evidence.sources[0].enabled=false;composeEvidence(reopened);assert.equal(reopened.devices.length,0);
  reopened.evidence.sources[0].enabled=true;composeEvidence(reopened);assert.equal(reopened.devices[0].ports[0].native,50);
 }
});

test('VLAN and route categories mask retained metadata independently of port membership',()=>{
 const {project,source}=fixture();source.categories=categories.filter(name=>!['vlans','routes'].includes(name));composeEvidence(project);
 const inv=inventoryForDevice(project.devices[0]);assert.deepEqual(inv.vlans,[]);assert.deepEqual(inv.svis,[]);assert.deepEqual(inv.routes,[]);assert.deepEqual(inv.management,[]);assert.equal(inv.ports[0].untaggedVlan,30);
});

test('supplementary categories cannot reintroduce disabled observations or reference copies',()=>{
 const {project,source}=fixture();
 const observations=[['Interface','State'],['IP interface','Address'],['DHCP relay','Target'],['ARP','Address'],['MAC table','MAC'],['Neighbor','Connected device'],['Route','Default'],['Device','Model'],['Reference','show interfaces'],['Reference','show lldp neighbors'],['Reference','show ip route'],['Reference','show vlan'],['Reference','unclassified']].map(([category,field])=>({category,field,interface:'1',value:'Fictional'}));
 source.model.devices[0].reportSupplementary=[{id:'a'.repeat(32),name:'Fictional capture',kind:'Command output',device:'LAB',observations}];
 const original=JSON.stringify(source.model);
 source.categories=categories.filter(name=>!['ports','links','routes'].includes(name));composeEvidence(project);
 const retained=reportRequest(project).items[0].supplementary[0].observations;
 assert.deepEqual(retained.map(row=>row.field),['Model','show vlan']);assert.equal(JSON.stringify(source.model),original);
 source.categories=categories.filter(name=>name!=='identity');composeEvidence(project);
 assert.ok(!project.devices[0].reportSupplementary[0].observations.some(row=>row.category==='Device'));
 assert.ok(project.devices[0].reportSupplementary[0].observations.some(row=>row.category==='Interface'));
 source.categories=[...categories];composeEvidence(project);assert.equal(project.devices[0].reportSupplementary[0].observations.length,observations.length);
});

test('selected supplementary evidence survives without identity category or editor rows',()=>{
 const {project,source}=fixture();
 const d=source.model.devices[0];d.ports=[];d.vlans=[];d.routes=[];
 d.reportSupplementary=[{id:'b'.repeat(32),name:'Fictional route',kind:'Command output',device:'LAB',observations:[{category:'Route',field:'Default',interface:'',value:'Next hop 192.0.2.254'}]}];
 source.categories=['routes'];composeEvidence(project);
 assert.equal(project.devices.length,1);assert.equal(project.devices[0].reportSupplementary[0].observations.length,1);
 source.categories=['ports'];composeEvidence(project);assert.equal(project.devices.length,0);
});
