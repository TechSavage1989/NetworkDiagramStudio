import test from 'node:test';
import assert from 'node:assert/strict';
import {hardwareProfile,identify,portCapability} from '../src/web/imports/hardware.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {addDevice,getAnchor} from '../src/web/diagram/scene.mjs';
import {connectionPorts} from '../src/web/connection-edit.mjs';
import {deviceKinds} from '../src/web/device-types.mjs';

test('UniFi documented copper and optical banks preserve number, order, gaps and orientation',()=>{
 for(const [model,count,optic] of [['USW-16-POE',16,'SFP'],['USW-24',24,'SFP'],['USW-24-POE',24,'SFP'],['USW-48-POE',48,'SFP'],['USW-Pro-24',24,'SFP+'],['USW-Pro-24-POE',24,'SFP+'],['USW-Pro-48',48,'SFP+'],['USW-Pro-48-POE',48,'SFP+']]){
  assert.equal(identify(model).vendor,'Ubiquiti');const panel=deviceFaceplate({model});assert.ok(panel.verified);assert.equal(panel.sockets.length,count+(count===48?4:2));
  const port=n=>panel.sockets.find(s=>s.name===String(n));
  assert.equal(port(1).x,port(2).x);assert.ok(port(1).y<port(2).y);assert.equal(port(1).orientation,'up');assert.equal(port(2).orientation,'down');assert.ok(port(count).x<port(count+1).x);assert.equal(port(count+1).form,optic);assert.equal(port(count+1).x,port(count+2).x);
  assert.ok(panel.sockets.every(s=>s.x>0&&s.x<1&&s.y>0&&s.y<1&&s.view==='front'));
  assert.equal(hardwareProfile({model}).interfaces.length,panel.sockets.length);
 }
 assert.equal(deviceFaceplate({model:'USW-Unknown-24'}),null);
});

test('Netgate rear layouts retain printed order and do not invent a single jack for a shared LAN',()=>{
 const d={model:'Netgate 4200',ports:[{name:'PORT1WAN'},{name:'PORT4'}]},p=deviceFaceplate(d);
 assert.equal(p.sockets.length,4);assert.ok(p.sockets.every(s=>s.view==='rear'));assert.deepEqual(p.ports.PORT1WAN,p.ports.igc3);assert.deepEqual(p.ports.PORT4,p.ports.igc0);assert.ok(p.ports.igc3[0]<p.ports.igc0[0]);assert.ok(!p.ports.console);
 const n={model:'Netgate 2100',ports:[{name:'WAN',configuredMedia:'fiber'},{name:'mvneta1'}]},optical=deviceFaceplate(n),copper=deviceFaceplate({...n,ports:[{name:'WAN',configuredMedia:'copper'}]});
 assert.ok(optical.ports.WAN[0]<copper.ports.WAN[0]);assert.ok(!optical.ports.mvneta1);assert.equal(optical.sockets.length,6);for(let i=1;i<4;i++)assert.ok(optical.ports['LAN'+i][0]<optical.ports['LAN'+(i+1)][0]);assert.equal(identify('Netgate 2100').kind,'firewall');
});

test('PA-415 and PA-455 combo pairs select media without merging management and data interfaces',()=>{
 for(const model of ['PA-415','PA-455']){
  const names=model==='PA-415'?['management','ethernet1/1']:['ethernet1/1','ethernet1/2'],p=deviceFaceplate({model,ports:names.map(name=>({name,configuredMedia:'fiber'}))}),c=deviceFaceplate({model,ports:names.map(name=>({name,configuredMedia:'copper'}))});
  assert.notDeepEqual(p.ports[names[0]],p.ports[names[1]]);for(const name of names)assert.ok(p.ports[name][0]<c.ports[name][0]);assert.equal(p.sockets.length,model==='PA-415'?12:11);assert.match(portCapability(hardwareProfile({model}),'ethernet1/1'),/shared/);
 }
 const p=deviceFaceplate({model:'PA-415',ports:[{name:'management'},{name:'ethernet1/1'}]});assert.equal(p.ports.management[0],p.ports['ethernet1/1'][0]);assert.ok(p.ports.management[1]<p.ports['ethernet1/1'][1]);assert.match(portCapability(hardwareProfile({model:'PA-415'}),'management'),/shared/);
});

test('all unknown hardware roles retain editable base drawings and safe boundary connections',()=>{
 for(const kind of deviceKinds){
  const d={id:'unknown-'+kind,name:'Lab '+kind,model:'Uncatalogued model',kind,ports:[{name:'custom-port'}]},page={items:[]},g=addDevice(page,{},d,[50,200,500,120],kind);
  assert.ok(g.children.length>0,kind);assert.ok(!g.physicalLayout,kind);assert.ok(g.children.every(c=>c.editKey),kind);assert.ok(!g.ports['custom-port'],kind);assert.deepEqual(connectionPorts({},d).map(p=>p.name),['custom-port']);
  const a=getAnchor(g,'custom-port','top',0);assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
 }
 const g=addDevice({items:[]},{},{id:'future',kind:'future-kind',ports:[]},[0,0,300,100],'future');assert.ok(g.children.some(c=>c.name==='Generic device enclosure'));
});
