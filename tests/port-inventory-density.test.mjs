import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {intersects} from '../src/web/diagram/labels.mjs';

// Synthetic two-member switch with 96 individually documented interfaces.
// Unique one-line descriptions prevent grouping from hiding page density.
const site=mapStyle=>({
 name:'Fictional port-inventory layout test',
 devices:[{
  id:'lab-stack',name:'LAB-STACK',kind:'switch',vendor:'Aruba',model:'JL558A',
  stackMembers:[{id:'1',model:'JL558A'},{id:'2',model:'JL558A'}],
  ports:Array.from({length:96},(_,i)=>({
   name:Math.floor(i/48)+1+'/'+(i%48+1),state:'up',native:10,
   description:'Outlet '+(i+1)
  }))
 }],
 links:[],
 layout:{portMap:{mapStyle,presentation:'separate',detailFilter:'all',groupConsecutive:false}}
});
// Inventory tables may share a sheet with the previous device's table.
const inventory=project=>buildPages(project).filter(page=>page.portMap?.bookletRole==='inventory'&&(page.portMap?.devices||[page.portMap?.device]).includes('lab-stack'));

for(const style of ['faceplate','switchport'])test('compact Port Inventory '+style+' fits 96 independent rows on fewer pages without losing records',()=>{
 const pages=inventory(site(style));
 assert.ok(pages.length>0,'Port Inventory pages generated');
 assert.ok(pages.length<=4,'96 one-line ports should fit within four Letter sheets, got '+pages.length);
 const identities=pages.flatMap(page=>page.portMap.portRecords.filter(record=>record.device==='lab-stack').map(record=>record.name));
 assert.equal(identities.length,96,'all physical interfaces retained');
 assert.equal(new Set(identities).size,96,'no repeated or lost interfaces across page boundaries');
 for(const page of pages){
  const labels=page.items.filter(item=>item.type==='text'&&item.tableContent);
  assert.ok(labels.length>20,'inventory page contains headings and data cells');
  assert.ok(labels.every(item=>item.size<=10.35),'only Port Inventory table typography becomes smaller');
  const portLabels=labels.filter(item=>item.portTableRole==='interface');
  assert.ok(portLabels.length,'interface labels remain present and editable');
  const texts=labels.filter(item=>item.portTableRole);
  for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++)
   assert.ok(!intersects(texts[i],texts[j]),'no overlapping inventory cells: '+texts[i].value+' vs '+texts[j].value);
  assert.ok(page.items.some(item=>item.value?.includes('Port inventory')),'inventory title remains visible');
 }
});
