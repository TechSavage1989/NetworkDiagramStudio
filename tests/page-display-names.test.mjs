import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';

// Twelve fictional switches with shared VLANs and their own VLANs and routes:
// enough VLANs and Routing content for several sheets, one of them shared.
function vlanSite(){
 const devices=[];
 for(let d=1;d<=12;d++){
  const vlans=[...Array.from({length:12},(_,i)=>({id:10+i,name:'Shared-'+(10+i)})),...Array.from({length:14},(_,i)=>({id:200+d*20+i,name:'Local-'+d+'-'+i,ip:'10.'+d+'.'+i+'.1/24'}))];
  devices.push({id:'sw'+d,name:'FICT_BUILDING_'+d+'_DISTRIBUTION_SW',kind:'switch',vendor:'Cisco',model:'WS-C3560E-48PD-SF',vlans,ports:[{name:'GigabitEthernet0/1',native:10}],routes:Array.from({length:6},(_,i)=>({prefix:'10.'+(100+i)+'.0.0/16',nextHop:'10.'+d+'.0.254'}))});
 }
 return {name:'Fictional VLAN pages',devices,links:[],layout:{pageSetup:{default:{preset:'letter',orientation:'landscape'}}}};
}

test('VLANs and Routing sheets are named briefly: a shared section is "Shared", never its whole device list',()=>{
 const pages=buildPages(vlanSite()).filter(page=>/^VLANs and Routing \d+$/.test(page.name));
 assert.ok(pages.length>2,'several sheets');
 const shared=pages.filter(page=>page.logicalSections.some(section=>section.shared));assert.ok(shared.length,'a sheet holds the shared records');
 for(const page of shared)assert.match(page.displayName,/^VLANs and Routing - Shared/);
 for(const page of pages){
  assert.ok(!/Shared:/.test(page.displayName),page.displayName);
  const names=page.displayName.replace(/^VLANs and Routing - /,'').replace(/ \+\d+$/,'').split(', ');assert.ok(names.length<=3,page.displayName);
  assert.ok(page.displayName.length<=110,'short enough for two sidebar lines: '+page.displayName);
 }
 // The stable page names stay for settings and frames.
 assert.deepEqual(pages.map(page=>page.name),pages.map((_,i)=>'VLANs and Routing '+(i+1)));
});
