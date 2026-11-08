import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeRouterosBackup,routerosSnapshotModel} from '../src/web/imports/routeros-backup.mjs';
import {importFiles} from '../src/web/imports/index.mjs';
import {importSwitchportWorkspace} from '../src/web/switchport-import.mjs';
import {arubaConfig,routerosBackup,rosMessage,rosNumber,rosString,rosArray,rosBool} from './fixtures/switchport-inputs.mjs';

test('RouterOS binary import keeps physical identities and configured state without reading credential tables',async()=>{
 const bytes=routerosBackup(),snapshot=decodeRouterosBackup(bytes),model=routerosSnapshotModel(snapshot),device=model.devices[0];
 assert.equal(snapshot.Hostname,'LAB-ROUTEROS');assert.equal(snapshot.Interfaces.length,9);assert.equal(device.ports[0].admin,'down');assert.equal(device.ports[1].admin,'up');
 assert.ok(device.ports.every(port=>port.state==='unknown'&&port.native==null));assert.ok(!JSON.stringify(model).includes('NEVER-IMPORT-SECRET'));assert.equal(device.routerosSnapshot.Binary,true);
 const imported=await importFiles([new File([bytes],'fictional.backup')]);assert.equal(imported.devices.length,1);assert.equal(imported.devices[0].ports.length,9);assert.ok(imported.warnings.some(text=>text.includes('exact model are not inferred')));
});
test('RouterOS binary VLAN membership keeps ingress PVID separate and blocks inconsistent egress assignments',()=>{
 const devices=[rosMessage(rosNumber(0x010001,1),rosNumber(0xfe0001,1),rosString(0x010006,'ether1')),rosMessage(rosNumber(0x010001,12),rosNumber(0xfe0001,20),rosString(0x010006,'bridge'))];
 const bytes=routerosBackup({'net/devices':devices,bridgeports:[rosMessage(rosNumber(3,1),rosNumber(4,20),rosNumber(0x13,10),rosNumber(0x14,2))],'bridge-vlans':[rosMessage(rosNumber(2,20),rosArray(1,[20,20]),rosArray(3,[]),rosArray(4,[1]),rosBool(0xfe0008,false))]});
 const device=routerosSnapshotModel(decodeRouterosBackup(bytes)).devices[0];assert.equal(device.ports[0].ingressPvid,10);assert.equal(device.ports[0].native,20);assert.equal(device.ports[0].nativeState,'known');assert.ok(device.reportBlockers.some(note=>note.includes('PVID and untagged egress')));
});
test('RouterOS invalid, encrypted and unsupported binary records fail explicitly',()=>{
 assert.throws(()=>decodeRouterosBackup(Buffer.from([0xef,0xa8,0x91,0x73,0,0,0,0])),/encrypted/);
 const good=routerosBackup();assert.throws(()=>decodeRouterosBackup(good.subarray(0,-1)),/damaged|truncated/);
 const duplicate=routerosBackup({system:[rosMessage(rosString(12,'A'),rosString(12,'B'))]});assert.throws(()=>decodeRouterosBackup(duplicate),/Duplicate/);
 const unknown=routerosBackup({'net/devices':[rosMessage(rosNumber(0x010001,999),rosNumber(0xfe0001,1),rosString(0x010006,'mystery'))]});assert.ok(decodeRouterosBackup(unknown).Unsupported.some(note=>note.includes('999')));
 assert.throws(()=>routerosSnapshotModel({Interfaces:[{Key:'1',Name:'ether1'},{Key:'2',Name:'Ether1'}]}),/Duplicate/);
});
const first='a'.repeat(32),second='b'.repeat(32);
const workspace=()=>({Format:'SwitchportDiagramBuilder.Workspace',Version:1,SelectedId:second,OutputLabel:'Technician files',ShowWorkspaceTitle:true,PaletteOverrides:{Vlans:{'vlan:10':'#FBC02D'},Aggregates:{' trk1 ':'#008877'}},Items:[{Id:first,Name:'first.cfg',SourcePath:'C:/private/never-retain.cfg',Text:arubaConfig,Devices:[{Id:'1',Name:'LAB-ASSET',SerialNumber:'LAB-SERIAL',AssetTag:'LAB-ASSET',ModelSelection:'JL256A',Notes:'Fictional record'}],SupplementarySources:[]},{Id:second,Name:'second.cfg',Text:arubaConfig.replace('LAB-ACCESS','LAB-SECOND'),Devices:[],SupplementarySources:[]}]});
const file=doc=>new File([JSON.stringify(doc)],'Fictional campus.spworkspace.json');
test('Switchport workspace migration preserves order, choices, details and independent names without raw input',async()=>{
 const result=await importSwitchportWorkspace(file(workspace()));assert.equal(result.model.devices.length,2);assert.deepEqual(result.settings.deviceIds,['switchport:'+first,'switchport:'+second]);assert.equal(result.selectedId,'switchport:'+second);
 assert.equal(result.settings.outputLabel,'Technician files');assert.equal(result.settings.title,'Fictional campus');assert.equal(result.settings.palette.vlans['vlan:10'],'#fbc02d');assert.equal(result.settings.palette.aggregates.TRK1,'#008877');assert.equal(result.model.devices[0].reportDetails[0].serialNumber,'LAB-SERIAL');assert.equal(result.model.devices[0].model,'JL256A');
 assert.ok(!JSON.stringify(result).includes('Configuration Editor'));assert.ok(!JSON.stringify(result).includes('never-retain'));assert.equal(result.model.devices[0].ports.find(port=>port.name==='1').native,10);
 const noSelection=workspace();noSelection.SelectedId=null;assert.equal((await importSwitchportWorkspace(file(noSelection))).selectedId,'switchport:'+first);
});
test('Switchport workspace rejects damaged identity, palette and supplementary data rather than truncating it',async()=>{
 for(const mutate of [doc=>doc.Version=2,doc=>doc.Items[1].Id=first,doc=>doc.SelectedId='c'.repeat(32),doc=>doc.PaletteOverrides.Vlans['vlan:10:Data']='#ff0000',doc=>doc.Items[0].SupplementarySources=[{Id:'invalid',Name:'Bad',Kind:'Command output',Device:'LAB-ACCESS',Observations:[]}],doc=>doc.Items[0].SupplementarySources=[{Id:'c'.repeat(32),Name:'Too many',Kind:'Command output',Device:'LAB-ACCESS',Observations:Array.from({length:5001},()=>({Category:'Reference',Interface:'1',Field:'Status',Value:'Up'}))}]]){const doc=workspace();mutate(doc);await assert.rejects(importSwitchportWorkspace(file(doc)));}
});
