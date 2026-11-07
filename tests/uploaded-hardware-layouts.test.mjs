import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConfig} from '../src/web/imports/config.mjs';
import {mergeModels} from '../src/web/imports/model.mjs';
import {hardwareProfile} from '../src/web/imports/hardware.mjs';
import {deviceFaceplate,faceplateProfile} from '../src/web/diagram/faceplate.mjs';
import {connectionPorts} from '../src/web/connection-edit.mjs';
const interfaces=(prefix,n,start=1)=>Array.from({length:n},(_,i)=>'interface '+prefix+(i+start)+'\n description Lab data\n!').join('\n')+'\n';

test('complete Cisco family signatures select geometry without inventing an exact SKU',()=>{
 for(const n of [24,48]){
  const d=parseConfig('version 17.6\nhostname LAB-C9500\n'+interfaces('TwentyFiveGigE1/0/',n)+interfaces('HundredGigE1/0/',4,n+1)+'\ninterface GigabitEthernet0/0').devices[0];
  assert.equal(d.model,'Catalyst 9500 '+n+'Y4C family');assert.equal(d.hardwareEvidence.kind,'family-layout');assert.ok(!d.sku);assert.ok(!hardwareProfile(d).sku);
  const p=deviceFaceplate(d);for(const port of d.ports.filter(p=>p.name!=='Gi0/0'))assert.ok(p.ports[port.name],port.name);
  assert.ok(p.ports['HundredGigE1/0/'+(n+1)][0]>p.ports['TwentyFiveGigE1/0/'+n][0]);
 }
 const ios='version 15.0\nhostname LAB-ACCESS\ninterface FastEthernet0\n!\n'+interfaces('GigabitEthernet0/',52)+interfaces('TenGigabitEthernet0/',2);
 const result=parseConfig(ios),d=result.devices[0];assert.equal(d.model,'Cisco 48-port access family');assert.ok(result.warnings.some(w=>/exact Cisco model/.test(w)));
 const named=parseConfig(ios,'lab-3560E.txt').devices[0];assert.equal(named.model,'Catalyst 3560-E 48-port family');
 const p=deviceFaceplate({...d,modules:[{slot:'X2-1',model:'X2-10GB-SR'}]});assert.ok(p.ports['Gi0/48']);assert.ok(!p.ports['Te0/1']);assert.ok(!p.ports['Gi0/49']);
 const declared=parseConfig('! PID: C9500-24Y4C\n'+ios).devices[0];assert.equal(declared.model,'C9500-24Y4C');assert.ok(!declared.hardwareEvidence);
 const partial=parseConfig('version 17.6\nhostname LAB-C9500\n'+interfaces('TwentyFiveGigE1/0/',23)).devices[0];assert.equal(partial.model,'');
});

test('PL layouts require a complete signature and retain unknown SFP speed',()=>{
 for(const [count,label] of [[16,'12G'],[28,'24G'],[52,'48G']]){
  const d=parseConfig('!Version ArubaOS-CX PL.10.06.0110\nhostname LAB\n'+interfaces('1/1/',count)).devices[0];assert.equal(d.model,'Aruba CX 6000/6100 '+label+' family');
  const p=deviceFaceplate(d);for(const port of d.ports)assert.ok(p.ports[port.name]);assert.ok(hardwareProfile(d).interfaces.some(([,form])=>form==='SFP cage'));assert.ok(!d.sku);
 }
 for(const cfg of ['!Version ArubaOS-CX PL.10.13\n'+interfaces('1/1/',51),'!Version ArubaOS-CX ML.10.13\n'+interfaces('1/1/',52)])assert.equal(parseConfig(cfg).devices[0].model,'');
 const compact=deviceFaceplate({model:'JL679A'});assert.equal(compact.ratio,25.4/4.4);assert.ok(compact.ports['15'][0]<compact.ports['13'][0]);assert.ok(compact.ports['14'][0]<compact.ports['1'][0]);assert.ok(compact.ports['12'][0]>.75);
});

test('FortiGate 201G configured aliases attach to correctly oriented fixed sockets',()=>{
 const d=parseConfig('#config-version=FG2H1G-7.4.8\nconfig system interface\n'+['ha','mgmt','port1','port16','port17','port20','x1','x8'].map(n=>' edit "'+n+'"\n set type physical\n next').join('\n')+'\nend').devices[0];
 assert.equal(d.model,'FortiGate 201G');const p=deviceFaceplate(d);assert.equal(p.sockets.length,30);
 for(const n of ['ha','port1','port17','x1'])assert.equal(p.sockets.find(s=>s.name===n).orientation,'up');
 for(const n of ['mgmt','port16','port20','x8'])assert.equal(p.sockets.find(s=>s.name===n).orientation,'down');
 assert.ok(p.ports.x8[0]<p.ports.port17[0]);assert.ok(p.ports.ha[0]<p.ports.port1[0]);
});

test('5400R geometry preserves real chassis proportions, slot order and qualified socket identities',()=>{
 for(const [model,ratio,last] of [['J9850A',44.45/17.53,'F'],['J9851A',44.45/30.73,'L']]){
  const d={model,modules:[{slot:'A',model:'J9993A'},{slot:'B',model:'J9986A'},{slot:last,model:'J9987A'}],ports:[{name:'A1'},{name:'B1'},{name:last+'24'}]},p=deviceFaceplate(d);assert.equal(p.ratio,ratio);
  assert.ok(p.ports.A1[0]<p.ports.B1[0]);assert.ok(p.ports[last+'24'][1]>p.ports.B1[1]);assert.equal(p.sockets.length,56);
  assert.ok(p.children.some(c=>c.anchorName==='A1'));assert.ok(p.children.some(c=>c.anchorName==='B1'));assert.ok(connectionPorts({stencils:{}},d).some(p=>p.name===last+'24'));
 }
});

test('unknown stack members keep an editable branded fallback and do not invent port anchors',()=>{
 const d={vendor:'HPE Aruba',stackMembers:[{id:'1',model:'JL727A'},{id:'2',model:'Future model'}],ports:[{name:'GigabitEthernet1/0/1'},{name:'2/1/1'}]},p=deviceFaceplate(d);
 assert.equal(p.verified,false);assert.equal(p.regions.length,2);assert.ok(p.children.some(c=>c.type==='text'&&c.value.includes('Future model')));assert.ok(p.children.some(c=>c.name?.includes('Switch connection band')));assert.ok(!p.ports['2/1/1']);
 const known=deviceFaceplate({model:'JL727A',ports:[{name:'mgmt'},{name:'1/1/48'}]});assert.ok(known.ports.mgmt[0]>known.ports['1/1/48'][0]);
});

test('binary RouterOS backups produce a readable export instruction rather than a partial device',()=>{
 const r=parseConfig('BINARY\0r5/version\0net/devices\0restored-data','lab.backup');assert.equal(r.devices.length,0);assert.match(r.warnings[0],/MikroTik binary backup/);assert.match(r.warnings[0],/\/export file=diagram/);
 const other=parseConfig('BINARY\0other','lab.txt');assert.equal(other.devices.length,0);assert.match(other.warnings[0],/readable text/);
 const rear=parseConfig('; J9729A Configuration Editor\nhostname LAB\ninterface B1\n name "Uplink"\n exit');assert.ok(rear.warnings.some(w=>/J9731A/.test(w)));
});

test('declared models supersede family drawings regardless of import order',()=>{
 const inferred={id:'lab',name:'LAB',kind:'switch',model:'Aruba CX 6000/6100 48G family',hardwareEvidence:{kind:'family-layout',model:'Aruba CX 6000/6100 48G family'},ports:[]};
 const exact={id:'lab',name:'LAB',kind:'switch',model:'JL675A',sku:'JL675A',ports:[]};
 for(const devices of [[inferred,exact],[exact,inferred]]){const d=mergeModels({devices}).devices[0];assert.equal(d.model,'JL675A');assert.equal(d.sku,'JL675A');assert.ok(!d.hardwareEvidence);}
});
