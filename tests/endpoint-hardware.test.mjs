import test from 'node:test';
import assert from 'node:assert/strict';
import {endpointHardwareCatalog,matchEndpointHardware} from '../src/web/imports/endpoint-hardware.mjs';
import {identify,hardwareProfile} from '../src/web/imports/hardware.mjs';
import {mergeModels} from '../src/web/imports/model.mjs';
import {parseTable} from '../src/web/imports/tables.mjs';

test('common server chassis aliases resolve to families without manufacturing fixed interfaces',()=>{
 for(const [model,id] of [
  ['Dell Inc. PowerEdge R750xd','dell-poweredge-r'],['R740','dell-poweredge-r'],['PowerEdge T550','dell-poweredge-t'],['Dell M640','dell-poweredge-m'],['PowerEdge MX750c','dell-poweredge-mx'],['PowerEdge XE9680','dell-poweredge-xe'],
  ['HP ProLiant DL380 Gen10','hpe-proliant'],['HPE ML350 Gen11','hpe-proliant'],['HPE Synergy 480 Gen10','hpe-synergy'],['HPE Apollo 2000','hpe-apollo'],
  ['Lenovo ThinkSystem SR650 V3','lenovo-thinksystem'],['ST250 V2','lenovo-thinksystem'],['Cisco UCS C240 M6','cisco-ucs'],['UCSB-B200-M5','cisco-ucs'],['SuperServer SYS-2029U-TN24R4T','supermicro-server'],['SYS-1029U','supermicro-server']
 ]){const item=matchEndpointHardware(model);assert.equal(item?.id,id,model);assert.equal(item.kind,'server');assert.equal(item.interfaces,undefined);assert.equal(hardwareProfile({model}),undefined);}
});

test('common storage, NAS and HCI families preserve their separate inventory roles',()=>{
 for(const [model,id,kind] of [
  ['Dell PowerStore 500T','dell-powerstore','storage'],['PowerVault ME5024','dell-powervault','storage'],['ME4024','dell-powervault','storage'],['EMC Unity XT 480F','dell-unity','storage'],['Dell PowerScale F710','dell-powerscale','storage'],['Isilon H500','dell-powerscale','storage'],
  ['NetApp AFF A250','netapp-aff','storage'],['ASA A400','netapp-asa','storage'],['FAS2750','netapp-fas','storage'],['Pure Storage FlashArray//X20','pure-flasharray','storage'],['FlashBlade//S','pure-flashblade','storage'],['Nimble HF40','hpe-nimble','storage'],['AF60','hpe-nimble','storage'],['HPE Alletra 6030','hpe-alletra','storage'],['MSA2060','hpe-msa','storage'],['3PAR StoreServ 8200','hpe-3par','storage'],['IBM FlashSystem 5200','ibm-flashsystem','storage'],
  ['ThinkSystem DM5000H','lenovo-dm','storage'],['Lenovo DE6000F','lenovo-de','storage'],['Synology DS923+','synology-storage','storage'],['RS3621RPxs','synology-storage','storage'],['QNAP TS-h973AX','qnap-storage','storage'],['TVS-h874','qnap-storage','storage'],['TrueNAS M50','truenas-storage','storage'],
  ['Dell VxRail E660','dell-vxrail','hci'],['Lenovo ThinkAgile HX650','lenovo-thinkagile','hci'],['Scale Computing HyperCore','scale-hypercore','hci'],['HC3','scale-hypercore','hci'],['Nutanix NX-8155-G8','nutanix-hci','hci']
 ]){const item=matchEndpointHardware(model);assert.equal(item?.id,id,model);assert.equal(item.kind,kind,model);}
});

test('platform recognition distinguishes software technologies from chassis and Windows Server from enabled Hyper-V',()=>{
 for(const [model,id,kind] of [['VMware ESXi 8.0','vmware-esxi','hypervisor'],['VMware vSphere 8','vmware-esxi','hypervisor'],['Microsoft Hyper-V Server 2019','microsoft-hyperv','hypervisor'],['Windows Server 2022','microsoft-windows-server','server'],['Proxmox VE 8','proxmox-ve','hypervisor'],['Nutanix AHV','nutanix-ahv','hypervisor'],['XCP-ng 8.3','xcp-ng','hypervisor'],['Citrix Hypervisor 8.2','xenserver','hypervisor'],['XenServer 8','xenserver','hypervisor'],['KVM','linux-kvm','hypervisor']]){const item=matchEndpointHardware(model);assert.equal(item?.id,id,model);assert.equal(item.kind,kind);assert.equal(item.portLayout,'inventory');}
 assert.equal(matchEndpointHardware('Dell PowerEdge R750','VMware ESXi 8').id,'dell-poweredge-r');
 assert.equal(matchEndpointHardware('Unspecified host','Proxmox VE 8').id,'proxmox-ve');
});

test('Auvik family recognition keeps declared endpoint type and imported port details',()=>{
 const result=parseTable([
  ['Device Name','Make & Model','Type','Description'],
  ['LAB-HOST','Dell PowerEdge R750','Hypervisor',''],
  ['LAB-VM','Windows Server 2022','Virtual Machine',''],
  ['LAB-ARRAY','NetApp AFF A250','',''],
  ['LAB-PHONE','PowerEdge R740','Phone','']
 ]);
 assert.deepEqual(result.devices.map(d=>d.kind),['hypervisor','virtual-machine','storage','phone']);assert.equal(result.devices[0].model,'Dell PowerEdge R750');assert.equal(result.devices[0].hardwareFamily,'dell-poweredge-r');
 const ports=parseTable([['Parent Device','Interface Name','Type','Oper Status','Negotiated Speed'],['LAB-HOST','vmnic3','ethernet','up','25 Gbps']]);
 const combined=mergeModels(result,ports),host=combined.devices.find(d=>d.name==='LAB-HOST');assert.equal(host.kind,'hypervisor');assert.deepEqual(host.ports,[{name:'vmnic3',type:'ethernet',state:'up',speed:'25 Gbps'}]);
 assert.ok(result.devices.every(d=>d.ports.length===0));
});

test('catalogue entries expose primary references and bounded matching keeps generic/custom fallback',()=>{
 assert.ok(endpointHardwareCatalog.length>=40);assert.equal(new Set(endpointHardwareCatalog.map(p=>p.id)).size,endpointHardwareCatalog.length);
 for(const entry of endpointHardwareCatalog){assert.ok(Object.isFrozen(entry));assert.ok(Object.isFrozen(entry.aliases));assert.match(entry.officialSource,/^https:\/\//);assert.ok(entry.family&&entry.vendor&&entry.kind&&entry.technology&&entry.moduleGuidance);assert.equal(entry.interfaces,undefined);}
 for(const model of ['Custom LAB Appliance','QNAP QSW-M408','Synology RT2600ac','Cisco ASA5505','Cisco UCS 6332 Fabric Interconnect','KVM switch','Linux KVM console','Unity software plugin'])assert.equal(matchEndpointHardware(model),null,model);
 assert.equal(matchEndpointHardware('x'.repeat(100000)+' PowerEdge R750'),null);assert.equal(matchEndpointHardware({model:'PowerEdge R750'}),null);
 assert.equal(identify('FG-120G').kind,'firewall');assert.equal(identify('JL675A').kind,'switch');assert.deepEqual(identify('Custom LAB Appliance'),{kind:'unknown',vendor:'',model:'Custom LAB Appliance'});
});
