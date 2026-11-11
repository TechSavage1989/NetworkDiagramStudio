import test from 'node:test';
import assert from 'node:assert/strict';
import {portMapIdentities,portMapDetailsDraft,applyPortMapDetails,portMapTarget} from '../src/web/port-map-details.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';

// Double-clicking a device on a port map page edits the Switchport builder's
// identity fields for that switch, member or module. Fictional data only.
const stack={id:'idf',name:'LAB-IDF',kind:'switch',vendor:'Aruba',model:'JL256A',ip:'192.0.2.10',stackMembers:[{id:'1',model:'JL256A'},{id:'2',model:'JL256A'}],modules:[],ports:[{name:'1/1',state:'up'},{name:'2/1',state:'up'}],vlans:[]};

test('identities follow the builder: members, then modules',()=>{
 assert.deepEqual(portMapIdentities(stack).map(row=>row.id),['1','2']);
 assert.deepEqual(portMapIdentities({kind:'switch',model:'X',modules:[{slot:'a',model:'J9731A'}]}).map(row=>row.label),['Chassis','Module A']);
 assert.equal(portMapDetailsDraft(stack,{member:'2'}).identity.label,'Member 2');
});

test('saving writes the member details, model and addresses on the device',()=>{
 const next=applyPortMapDetails(stack,{member:'2'},{name:'LAB-IDF-2',model:'JL256A',ip:'192.0.2.11',mac:'0011.2233.4455',hardwareModel:'JL258A',displayName:'Upper unit',serialNumber:'SN-TEST-2',assetTag:'IT-7',notes:'Rack B'});
 assert.equal(next.name,'LAB-IDF-2');assert.equal(next.id,'idf','the device keeps its identity');
 assert.equal(next.ip,'192.0.2.11');assert.equal(next.mac,'00:11:22:33:44:55');
 assert.deepEqual(next.stackMembers,[{id:'1',model:'JL256A'},{id:'2',model:'JL258A'}]);
 assert.deepEqual(next.reportDetails,[{id:'2',name:'Upper unit',serialNumber:'SN-TEST-2',assetTag:'IT-7',notes:'Rack B'}]);
 assert.equal(stack.reportDetails,undefined,'the original device is unchanged');
 const draft=portMapDetailsDraft(next,{member:'2'});assert.equal(draft.serialNumber,'SN-TEST-2');assert.equal(draft.hardwareModel,'JL258A');
 const cleared=applyPortMapDetails(next,{member:'2'},{...draft,displayName:'',serialNumber:'',assetTag:'',notes:''});assert.deepEqual(cleared.reportDetails,[]);
});

test('invalid values are rejected with a readable message',()=>{
 assert.throws(()=>applyPortMapDetails(stack,{member:'1'},{name:''}),/device name/);
 assert.throws(()=>applyPortMapDetails(stack,{member:'1'},{name:'Other',mac:'not-a-mac'}),/MAC/);
 assert.throws(()=>applyPortMapDetails(stack,{member:'1'},{name:'Taken'},{nameTaken:()=>true}),/unique/);
 assert.throws(()=>applyPortMapDetails(stack,{member:'1'},{name:'LAB-IDF',serialNumber:'x'.repeat(81)}),/Serial number/);
});

test('port map panels point at their device and member, and saved details reach the heading',()=>{
 const project={name:'Lab',devices:[{...stack,ports:Array.from({length:52},(_,i)=>({name:'2/'+(i+1),state:'up',native:10})).concat(Array.from({length:52},(_,i)=>({name:'1/'+(i+1),state:'up',native:10}))),vlans:[{id:10,name:'Users'}]}],links:[]};
 const page=buildPages(project).find(p=>p.switchportReport&&p.role==='onePage');
 const panel=page.items.find(item=>item.reportPanel&&item.reportMember==='2'),title=page.items.find(item=>item.reportDevice&&item.reportMember==='2');
 assert.deepEqual(portMapTarget(page,panel),{device:'idf',member:'2',slot:'',identity:'2'});
 assert.deepEqual(portMapTarget(page,title),{device:'idf',member:'2',slot:'',identity:'2'});
 assert.equal(portMapTarget({family:'core'},panel),null,'other pages keep their own double-click');
 const saved=applyPortMapDetails(project.devices[0],portMapTarget(page,panel),{...portMapDetailsDraft(project.devices[0],{member:'2'}),serialNumber:'SN-TEST-2',assetTag:'IT-7'});
 const again=buildPages({...project,devices:[saved]}).find(p=>p.switchportReport&&p.role==='onePage');
 assert.ok(again.items.some(item=>item.reportDevice&&item.reportMember==='2'&&/S\/N SN-TEST-2 \| Asset IT-7/.test(item.value)),'member heading shows the serial and asset tag');
});

test('a device with an imported stencil draws its port map on that artwork',()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5F8AAAAASUVORK5CYII=';
 const ports=()=>Array.from({length:52},(_,i)=>({name:String(i+1),state:'up',native:10}));
 const project=(portMap)=>({name:'Stencil lab',links:[],stencils:{front:{id:'front',name:'Lab front panel',width:10,height:1,dataUrl:png,anchors:Object.fromEntries(Array.from({length:52},(_,i)=>[String(i+1),[.04+(i%26)*.035,i<26?.3:.7]]))}},layout:portMap?{portMap}:{},
  devices:[{id:'own',name:'LAB-OWN',kind:'switch',vendor:'Aruba',model:'JL256A',stencilId:'front',ports:ports(),vlans:[{id:10,name:'Users'}]},{id:'plain',name:'LAB-PLAIN',kind:'switch',vendor:'Aruba',model:'JL256A',ports:ports(),vlans:[{id:10,name:'Users'}]}]});
 const maps=pages=>pages.filter(page=>page.portMap&&page.portMap.bookletRole!=='inventory');
 const pages=maps(buildPages(project()));
 const own=pages.filter(page=>(page.portMap?.devices||[page.portMap?.device]).includes('own')||page.sourceDeviceIds?.includes('own'));
 assert.ok(own.length&&own.every(page=>!page.switchportReport),'the stencil device keeps a faceplate sheet');
 assert.ok(own.some(page=>page.items.some(item=>item.type==='device'&&item.sourceId==='own'&&item.masterKey==='asset:front')),'drawn with its imported artwork');
 assert.ok(pages.some(page=>page.switchportReport&&page.sourceDeviceIds?.includes('plain')),'other devices keep the builder sheet');
 const builder=maps(buildPages(project({stencilSheets:false})));
 assert.ok(builder.some(page=>page.switchportReport&&page.sourceDeviceIds?.includes('own')),'Port map options can use the builder sheet for every device');
});
