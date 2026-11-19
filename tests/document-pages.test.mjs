import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanDocumentPages,documentPageAnchor,documentPageKey,setDocumentPage,OTHER_DEVICES} from '../src/web/document-pages.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';

const stacked={layout:{deviceStacks:[{id:'stack-a',members:[{deviceId:'b',number:2},{deviceId:'a',number:1},{deviceId:'c',number:3}]}]}};

test('every device has its own page and a stack shares its first member\'s page',()=>{
 assert.equal(documentPageAnchor({},'logical','x'),'x');
 for(const id of ['a','b','c'])assert.equal(documentPageAnchor(stacked,'logical',id),'a');
 assert.equal(documentPageKey(stacked,'inventory',{id:'c',sourceDeviceIds:['c']}),'device:a');
 assert.equal(documentPageKey({},'logical',{id:'a',sourceDeviceIds:['a','b'],shared:true}),'shared','records shared by several devices keep their own page');
});

test('chosen pages follow chains, a self choice leaves the stack and loops settle',()=>{
 const project=layout=>({layout:{...stacked.layout,documentPages:{logical:layout}}});
 assert.equal(documentPageAnchor(project({x:'b'}),'logical','x'),'a','joining a stack member joins the stack page');
 assert.equal(documentPageAnchor(project({c:'c'}),'logical','c'),'c','a member chosen for its own page leaves the stack page');
 assert.equal(documentPageAnchor(project({c:'c'}),'inventory','c'),'a','each family keeps its own choices');
 const loop={layout:{documentPages:{logical:{p:'q',q:'p'}}}};
 assert.equal(documentPageAnchor(loop,'logical','p'),'p');assert.equal(documentPageAnchor(loop,'logical','q'),'p');
});

test('setDocumentPage stores only choices that differ from the default',()=>{
 let layout=setDocumentPage(stacked.layout,'logical','x','a',stacked);
 assert.deepEqual(layout.documentPages,{logical:{x:'a'}});
 layout=setDocumentPage(layout,'logical','b','a',{layout});
 assert.deepEqual(layout.documentPages,{logical:{x:'a'}},'a stack member on its stack page needs no entry');
 layout=setDocumentPage(layout,'logical','b','b',{layout});
 assert.deepEqual(layout.documentPages,{logical:{x:'a',b:'b'}});
 layout=setDocumentPage(layout,'logical','x','x',{layout});layout=setDocumentPage(layout,'logical','b','a',{layout});
 assert.equal(layout.documentPages,undefined,'returning to the defaults clears the setting');
 assert.deepEqual(stacked.layout.documentPages,undefined,'the original layout is unchanged');
});

test('saved choices are cleaned against known devices and survive cleanLayout',()=>{
 assert.deepEqual(cleanDocumentPages({logical:{a:'b',z:'a',b:7},inventory:[],other:{a:'b'}},['a','b']),{logical:{a:'b'}});
 assert.equal(cleanDocumentPages({logical:{}},['a']),undefined);
 assert.deepEqual(cleanLayout({documentPages:{inventory:{a:'b',gone:'a'}}},['a','b']).documentPages,{inventory:{a:'b'}});
 assert.equal('documentPages' in cleanLayout({},['a']),false);
});

test('VLAN interface inventory follows the same per-device pages and choices',()=>{
 // Fictional switches with routed VLAN interfaces.
 const project=documentPages=>({name:'Fictional campus',links:[],layout:{pageSetup:{visible:{default:{preset:'letter'}}},...(documentPages?{documentPages}:{})},devices:Array.from({length:3},(_,d)=>({id:'sw'+d,name:'LAB-SW-'+(d+1),kind:'switch',vendor:'Aruba',model:'JL256A',ports:[{name:'1',state:'up',native:10},...Array.from({length:3},(_,v)=>({name:'vlan'+(10+v),state:'up',ip:'10.'+d+'.'+v+'.1/24'}))],vlans:Array.from({length:3},(_,v)=>({id:10+v,name:'Lab VLAN '+(10+v),ip:'10.'+d+'.'+v+'.1/24'}))}))});
 const names=pages=>pages.filter(page=>page.interfaceInventory).map(page=>page.displayName);
 assert.deepEqual(names(buildPages(project())),['Port Inventory - Interfaces - LAB-SW-1','Port Inventory - Interfaces - LAB-SW-2','Port Inventory - Interfaces - LAB-SW-3']);
 assert.deepEqual(names(buildPages(project({inventory:{sw2:'sw0'}}))),['Port Inventory - Interfaces - LAB-SW-1, LAB-SW-3','Port Inventory - Interfaces - LAB-SW-2']);
 const vlan=buildPages(project({inventory:{sw2:'sw0'}})).filter(page=>/^VLANs and Routing/.test(page.name)).map(page=>page.displayName);
 assert.deepEqual(vlan,['VLANs and Routing - LAB-SW-1','VLANs and Routing - LAB-SW-2','VLANs and Routing - LAB-SW-3'],'inventory choices do not move VLAN pages');
});

test('devices other than switches, routers and firewalls share pages unless chosen otherwise',()=>{
 // Fictional site: two switches, a firewall and three servers with routes.
 const project=documentPages=>({name:'Fictional campus',links:[],layout:{pageSetup:{visible:{default:{preset:'letter'}}},...(documentPages?{documentPages}:{})},devices:[
  ...['LAB-SW-1','LAB-SW-2'].map((name,d)=>({id:'sw'+d,name,kind:'switch',vendor:'Aruba',model:'JL256A',ports:[],vlans:[{id:10+d,name:'Lab VLAN '+d,ip:'10.'+d+'.0.1/24'}],routes:[]})),
  {id:'fw',name:'LAB-FW',kind:'firewall',vendor:'Fortinet',model:'FortiGate 101F',ports:[],vlans:[{id:30,name:'Lab DMZ',ip:'10.30.0.1/24'}],routes:[]},
  ...['LAB-SRV-1','LAB-SRV-2','LAB-PRN-1'].map((name,d)=>({id:'host'+d,name,kind:d<2?'server':'printer',ports:[],vlans:[],routes:[{destination:'0.0.0.0/0',gateway:'10.9.'+d+'.1'}]}))
 ]});
 const names=pages=>pages.filter(page=>/^VLANs and Routing/.test(page.name)).map(page=>page.displayName||page.name);
 assert.deepEqual(documentPageKey(project(),'logical',{id:'host0',sourceDeviceIds:['host0']}),'other');
 assert.deepEqual(documentPageKey(project(),'logical',{id:'fw',sourceDeviceIds:['fw']}),'device:fw');
 assert.deepEqual(names(buildPages(project())),['VLANs and Routing - LAB-SW-1','VLANs and Routing - LAB-SW-2','VLANs and Routing - LAB-FW','VLANs and Routing - LAB-SRV-1, LAB-SRV-2, LAB-PRN-1']);
 // A server on its own page; a switch put with the other devices.
 assert.deepEqual(names(buildPages(project({logical:{host1:'host1',sw1:OTHER_DEVICES}}))),['VLANs and Routing - LAB-SW-1','VLANs and Routing - LAB-SW-2, LAB-SRV-1, LAB-PRN-1','VLANs and Routing - LAB-FW','VLANs and Routing - LAB-SRV-2'],'pages follow the device order of their first device');
 // The stored choices are exactly the ones that differ from the default.
 let layout=setDocumentPage(project().layout,'logical','host0','host0',project());
 assert.deepEqual(layout.documentPages,{logical:{host0:'host0'}});
 layout=setDocumentPage(layout,'logical','host0',OTHER_DEVICES,{...project(),layout});
 assert.equal(layout.documentPages,undefined);
 assert.deepEqual(cleanDocumentPages({logical:{host0:OTHER_DEVICES,sw0:'*nope'}},['host0','sw0']),{logical:{host0:OTHER_DEVICES}});
});

test('an interface page of records several devices share is named Shared',()=>{
 // Fictional switches with an identical loopback record.
 const project={name:'Fictional campus',links:[],layout:{pageSetup:{visible:{default:{preset:'letter'}}}},devices:['LAB-SW-1','LAB-SW-2'].map((name,d)=>({id:'sw'+d,name,kind:'switch',vendor:'Aruba',model:'JL256A',ports:[{name:'1',state:'up',native:1},{name:'lo0',type:'loopback',state:'up'}],vlans:[],routes:[]}))};
 const pages=buildPages(project).filter(page=>page.interfaceInventory);
 assert.ok(pages.some(page=>page.interfaceSections.some(section=>section.shared)),'the loopback record is shared');
 for(const page of pages)if(page.interfaceSections.every(section=>section.shared))assert.equal(page.displayName,'Port Inventory - Interfaces - Shared');
});
