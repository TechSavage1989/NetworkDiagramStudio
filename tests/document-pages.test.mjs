import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanDocumentPages,documentPageAnchor,documentPageKey,setDocumentPage} from '../src/web/document-pages.mjs';
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
