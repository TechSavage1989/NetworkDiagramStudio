import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importFiles,parseConfig,hardwareCatalog,identify} from '../src/web/imports/index.mjs';

const file=(name,source)=>new File([source],name);
const prefix='<config version="11.0"><devices><entry name="localhost.localdomain"><deviceconfig><system><hostname>LAB-PAN</hostname></system></deviceconfig><network>';
const end='</network></entry></devices></config>';
test('PAN-OS XML imports only the device network, IP, explicit tag, virtual wire and routing context',async()=>{
 const xml=prefix+'<interface><ethernet><entry name="ethernet1/1"><layer3><units><entry name="ethernet1/1.91"><tag>57</tag><ip><entry name="192.0.2.17/28"/></ip></entry></units></layer3></entry></ethernet></interface><virtual-router><entry name="LAB-VR"><routing-table><ip><static-route><entry name="outside"><destination>0.0.0.0/0</destination><interface>ethernet1/2</interface><nexthop><ip-address>198.51.100.1</ip-address></nexthop></entry></static-route></ip></routing-table></entry></virtual-router><virtual-wire><entry name="pair"><interface1>ethernet1/3</interface1><interface2>ethernet1/4</interface2></entry></virtual-wire>'+end;
 const r=await importFiles([file('lab.xml',xml)]);assert.deepEqual(r.warnings,[]);const d=r.devices[0];
 assert.equal(d.name,'LAB-PAN');assert.equal(d.fromConfig,true);assert.equal(d.kind,'firewall');assert.equal(d.vlans[0].id,57);assert.equal(d.vlans[0].interfaces[0].parent,'ethernet1/1');assert.equal(d.vlans[0].ip,'192.0.2.17/28');assert.equal(d.routes[0].context,'LAB-VR');assert.equal(d.routes[0].nextHop,'198.51.100.1');assert.deepEqual(d.bridges[0].members,['ethernet1/3','ethernet1/4']);assert.equal(r.links.length,0);
});
test('PAN-OS set merges partial subinterface and route fields while preserving same destination across virtual routers',async()=>{
 const s='set deviceconfig system hostname PAN-LAB\nset network interface ethernet ethernet1/6 layer3 units ethernet1/6.51 tag 27\nset network interface ethernet ethernet1/6 layer3 units ethernet1/6.51 ip 198.51.100.9/27\nset network virtual-router VR1 routing-table ip static-route one destination 192.0.2.0/24\nset network virtual-router VR1 routing-table ip static-route one nexthop ip-address 198.51.100.1\nset network virtual-router VR2 routing-table ip static-route two destination 192.0.2.0/24\nset network virtual-router VR2 routing-table ip static-route two nexthop ip-address 198.51.100.1';
 const d=(await importFiles([file('commands.txt',s)])).devices[0];assert.equal(d.vendor,'Palo Alto Networks');assert.equal(d.vlans[0].id,27);assert.equal(d.vlans[0].ip,'198.51.100.9/27');assert.equal(d.routes.length,2);assert.equal(d.routes[1].context,'VR2');
});
test('pfSense XML resolves interface assignment, actual VLAN parent, gateway name and disabled routes',()=>{
 const s='<pfsense><system><hostname>lab-pf</hostname></system><vlans><vlan><if>igb0</if><tag>57</tag><vlanif>igb0.57</vlanif><descr>Staff</descr></vlan></vlans><interfaces><wan><if>igb1</if><enable/><ipaddr>dhcp</ipaddr></wan><opt1><if>igb0.57</if><enable/><ipaddr>192.0.2.1</ipaddr><subnet>26</subnet></opt1></interfaces><gateways><gateway_item><name>WAN_TEST</name><interface>wan</interface><gateway>198.51.100.33</gateway></gateway_item></gateways><staticroutes><route><network>203.0.113.0/24</network><gateway>WAN_TEST</gateway><disabled/></route></staticroutes></pfsense>';
 const [d]=parseConfig(s).devices;assert.equal(d.vendor,'pfSense');assert.equal(d.vlans[0].ip,'192.0.2.1/26');assert.equal(d.ports[0].parent,'igb0');assert.equal(d.routes[0].interface,'igb1');assert.equal(d.routes[0].nextHop,'198.51.100.33');assert.equal(d.routes[0].status,'disabled');
});
test('OPNsense XML supports current MVC gateways with UUID references and a disabled static route',()=>{
 const s='<opnsense><system><hostname>lab-opn</hostname></system><interfaces><wan><if>em2</if><ipaddr>dhcp</ipaddr><enable/></wan></interfaces><OPNsense><Gateways><gateway_item uuid="test-id"><name>Uplink_A</name><gateway>192.0.2.100</gateway><interface>wan</interface></gateway_item></Gateways></OPNsense><staticroutes><route><network>198.51.100.0/24</network><gateway>test-id</gateway><enabled>0</enabled></route></staticroutes></opnsense>';
 const [d]=parseConfig(s).devices;assert.equal(d.vendor,'OPNsense');assert.equal(d.routes[0].interface,'em2');assert.equal(d.routes[0].nextHop,'192.0.2.100');assert.equal(d.routes[0].status,'disabled');
});
test('SonicOS decoded export handles encoded names, subinterfaces and constrained route policies',()=>{
 const s='firewallName=LAB-SONIC&firewallModel=TZ%20500&iface_name_0=X0&iface_name_1=X0%3AV57&iface_vlan_tag_1=57&iface_vlan_parent_1=0&iface_static_ip_1=192.0.2.1&iface_static_mask_1=255.255.255.0&routePolicyDst_4=Other%20Network&routePolicySrc_4=Users&routePolicySvc_4=HTTPS&routePolicyGw_4=198.51.100.1&routePolicyIface_4=0';
 const [d]=parseConfig(s).devices;assert.equal(d.vendor,'SonicWall');assert.equal(d.model,'TZ 500');assert.equal(d.vlans[0].interfaces[0].parent,'X0');assert.equal(d.vlans[0].ip,'192.0.2.1/24');assert.equal(d.routes[0].type,'policy');assert.equal(d.routes[0].source,'Users');assert.equal(d.routes[0].service,'HTTPS');assert.equal(d.routes[0].destination,'Other Network');
});
test('SonicOS E-CLI interface blocks and ASA names and subinterface tags are not interchanged',()=>{
 const [sonic]=parseConfig('SonicOS 7\nhostname LAB-SWALL\ninterface X0:V23\n ip-assignment LAN static\n ip address 192.0.2.1\n ip subnet-mask 255.255.255.0\nexit').devices;
 assert.equal(sonic.vendor,'SonicWall');assert.equal(sonic.vlans[0].id,23);assert.equal(sonic.vlans[0].ip,'192.0.2.1/24');
 const [asa]=parseConfig('ASA Version 9.16\nhostname LAB-ASA\ninterface GigabitEthernet1/1.200\n vlan 42\n nameif inside\n security-level 100\n ip address 192.0.2.1 255.255.255.0\n no shutdown\n!\nroute inside 198.51.100.0 255.255.255.0 192.0.2.2 1').devices;
 assert.equal(asa.kind,'firewall');assert.equal(asa.vlans[0].id,42);assert.equal(asa.vlans[0].ip,'192.0.2.1/24');assert.equal(asa.routes[0].interface,'Gi1/1.200');assert.equal(asa.routes[0].nextHop,'192.0.2.2');
});
test('FortiOS WAN/SD-WAN settings remain interface properties, without inventing a provider or neighbor',()=>{
 const s='config system global\nset hostname LAB-FG\nend\nconfig system interface\n edit "wan1"\n set role wan\n next\nend\nconfig system sdwan\n set status enable\n config members\n  edit 1\n   set interface "wan1"\n   set gateway 192.0.2.254\n   set zone "EDGE_UPLINKS"\n  next\n end\nend';
 const r=parseConfig(s);const p=r.devices[0].ports[0];assert.equal(p.role,'wan');assert.equal(p.sdwanMember,true);assert.equal(p.gateway,'192.0.2.254');assert.equal(p.zone,'EDGE_UPLINKS');assert.deepEqual(r.links,[]);
});
test('reject opaque exports, unrecognized XML, malformed nesting, DTDs and non-firewall lookalikes',async()=>{
 for(const [name,s] of [['protected.exp','T3BhcXVlRGF0YQ=='],['private.cfg','#config-version=FG120G-7.0\nU2FsdGVkX1'],['data.xml','<pfsense><encrypted>ciphertext</encrypted></pfsense>'],['table.xml','<root><devices><entry name="something"/></devices></root>'],['malformed.xml','<pfsense><system></interfaces></pfsense>'],['blocked.xml','<!DOCTYPE a [<!ENTITY foo SYSTEM "file:///example">]><pfsense/>']]){
  const r=await importFiles([file(name,s)]);assert.equal(r.devices.length,0,name);assert.equal(r.links.length,0);assert.ok(r.warnings.some(w=>/Auvik/i.test(w)),name);
 }
});
test('extended offline model catalog identifies exact firewall chassis without asserting installed optics',()=>{
 assert.ok(hardwareCatalog.length>=330);assert.equal(identify('PA-1420').kind,'firewall');assert.equal(identify('SonicWall NSa4700').vendor,'SonicWall');assert.equal(identify('FG201G').model,'FortiGate 201G');
});
