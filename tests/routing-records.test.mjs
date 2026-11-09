import test from 'node:test';
import assert from 'node:assert/strict';
import {parseConfiguredRoute,configuredRouteKey,reconcileConfiguredRoutes,configuredAddress,configuredRouteText} from '../src/web/imports/routing-records.mjs';
test('configured routes normalize native masks, Comware numeric masks, VRFs and distance',()=>{
 const a='ip route vrf LAB 192.0.2.0 255.255.255.0 GigabitEthernet1/0/1 198.51.100.1 10 tag 22';
 const b='ip route-static vpn-instance LAB 192.0.2.0 24 Gi1/0/1 198.51.100.1 preference 10 tag 22';
 assert.equal(configuredRouteKey(a),configuredRouteKey(b));assert.equal(parseConfiguredRoute(b).distance,'10');
 assert.notEqual(configuredRouteKey(a),configuredRouteKey(a.replace('LAB','OTHER')));
 assert.notEqual(configuredRouteKey(a),configuredRouteKey(a.replace(' 10 ',' 20 ')));
 assert.notEqual(configuredRouteKey(a),configuredRouteKey(a.replace('tag 22','tag 23')));
});
test('unknown route suffixes cannot become invented interfaces or proven equivalence',()=>{
 for(const suffix of ['mystery','ether1garbage','recursive','nexthop extra','dhcp','track','tag','preference 2 unknown'])assert.equal(parseConfiguredRoute('0.0.0.0/0 192.0.2.1 '+suffix),null,suffix);
 assert.equal(parseConfiguredRoute('192.0.2.0/24/7 198.51.100.1'),null);
 assert.equal(parseConfiguredRoute('192.0.2.0 255.0.255.0 198.51.100.1'),null);
 assert.equal(parseConfiguredRoute('192.0.2.0 33 198.51.100.1'),null);
 assert.equal(configuredRouteKey({destination:'0.0.0.0/0'}),null);
});
test('IPv6 next hops, zones, recognized interfaces and options remain significant',()=>{
 assert.equal(configuredRouteKey('ipv6 route 2001:0db8:0:0::/64 Vlan20 fe80::1%Vlan20 7 permanent'),configuredRouteKey({destination:'2001:db8::/64',interface:'Vlan20',nextHop:'fe80::1%Vlan20',distance:7,options:['permanent']}));
 assert.notEqual(configuredRouteKey('::/0 fe80::1%Vlan20'),configuredRouteKey('::/0 fe80::1%Vlan21'));
 assert.notEqual(configuredRouteKey('::/0 fe80::1 permanent'),configuredRouteKey('::/0 fe80::1'));
 assert.ok(configuredRouteKey('0.0.0.0/0 Null0 254'));
 assert.ok(configuredRouteKey('0.0.0.0/0 blackhole'));
});
test('FortiOS explicit on-interface syntax is recognized but opaque destinations stay unparsed',()=>{
 assert.deepEqual(parseConfiguredRoute('Static route 1: 0.0.0.0 0.0.0.0 via 192.0.2.1 on WAN'),{type:'static',nextHop:'192.0.2.1',interface:'WAN',destination:'0.0.0.0/0'});
 assert.equal(parseConfiguredRoute('Static route 2: ADDRESS_OBJECT via 192.0.2.1 on WAN'),null);
 assert.notEqual(configuredRouteKey({destination:'0.0.0.0/0',nextHop:'192.0.2.1',interface:'WAN'}),configuredRouteKey({destination:'0.0.0.0/0',nextHop:'192.0.2.1',interface:'wan'}));
});
test('reconciliation deduplicates only proven routes and keeps every structured qualifier',()=>{
 const browser=[{destination:'0.0.0.0/0',nextHop:'192.0.2.1',interface:'Gi1/0/1',type:'static',distance:5}],native=[{destination:'0.0.0.0 0.0.0.0 GigabitEthernet1/0/1 192.0.2.1 5'},'192.0.2.0/24 198.51.100.1'];
 const result=reconcileConfiguredRoutes(browser,native);assert.equal(result.routes.length,2);assert.equal(result.added,1);assert.equal(result.unresolved,0);assert.deepEqual(result.routes[0],browser[0]);
 for(const qualifier of [{type:'policy'},{addressObject:'lab'},{status:'disabled'},{context:'LAB'},{metric:8},{source:'198.51.100.0/24'}]){const qualified={...browser[0],...qualifier};const reconciled=reconcileConfiguredRoutes([qualified],native.slice(0,1));assert.equal(reconciled.routes.length,2);assert.deepEqual(reconciled.routes[0],qualified);}
 const raw={destination:'0.0.0.0/0 192.0.2.1',context:'LAB'};assert.equal(parseConfiguredRoute(raw),null);assert.deepEqual(reconcileConfiguredRoutes([], [raw]).routes,[raw]);
});
test('opaque references survive repeated hydration without duplication',()=>{
 const raw='0.0.0.0/0 192.0.2.1 unsupported-option';const first=reconcileConfiguredRoutes([], [raw,{destination:'Static route 3: address-object via 192.0.2.1'}]);
 const second=reconcileConfiguredRoutes(first.routes,[raw,{destination:'Static route 3: address-object via 192.0.2.1'}]);assert.deepEqual(second.routes,first.routes);assert.ok(second.unresolved>0);assert.equal(second.added,0);
});
test('configured addresses retain secondary and IPv6 qualifiers while normalizing masks',()=>{
 assert.equal(configuredAddress('192.0.2.1 255.255.255.0 secondary'),'192.0.2.1/24 secondary');
 assert.equal(configuredAddress('192.0.2.1 24 sub'),'192.0.2.1/24 sub');
 assert.equal(configuredAddress('2001:0db8::1/64 eui-64'),'2001:db8::1/64 eui-64');
 assert.equal(configuredAddress('192.0.2.1 255.0.255.0'),null);assert.equal(configuredAddress('192.0.2.1/24/6'),null);
});
test('route text includes options and future fields in stable top-level order',()=>{
 const a={future:{flag:true},options:['global'],status:'disabled',destination:'::/0',distance:4};
 const b={distance:4,destination:'::/0',status:'disabled',options:['global'],future:{flag:true}};
 assert.equal(configuredRouteText(a),configuredRouteText(b));assert.match(configuredRouteText(a),/options: \["global"\]/);assert.match(configuredRouteText(a),/future: \{"flag":true\}/);assert.match(configuredRouteText(a),/status: disabled/);
});
test('native hydration reconciles equivalents and qualifies opaque route references',async()=>{
 const {enrichSwitchportSources}=await import('../src/web/switchport-import.mjs');const oldReader=globalThis.FileReader,oldDesktop=globalThis.NDSDesktop;
 try{
  globalThis.FileReader=class{readAsDataURL(){this.result='data:text/plain;base64,';this.onload();}};
  const inventory={routes:[],assumptions:[]},native=[{destination:'0.0.0.0 0.0.0.0 192.0.2.1'},{destination:'192.0.2.0/24 198.51.100.1 unvalidated'}];
  globalThis.NDSDesktop={report:async()=>({items:[{id:'native',inventory,device:{name:'SYNTHETIC',ports:[],routes:native}}]})};
  const original={destination:'0.0.0.0/0',nextHop:'192.0.2.1',type:'static'},d={name:'SYNTHETIC',id:'synthetic',ports:[],routes:[original]},source={kind:'Configuration',model:{devices:[d],links:[],warnings:[]}};
  await enrichSwitchportSources([new File([''],'synthetic.cfg')],[source]);assert.equal(d.routes.length,2);assert.deepEqual(d.routes[0],original);assert.deepEqual(d.routes[1],native[1]);assert.match(source.model.warnings.join(' '),/could not be compared safely/);assert.match(inventory.assumptions.join(' '),/unresolved references/);
 }finally{if(oldReader===undefined)delete globalThis.FileReader;else globalThis.FileReader=oldReader;if(oldDesktop===undefined)delete globalThis.NDSDesktop;else globalThis.NDSDesktop=oldDesktop;}
});
