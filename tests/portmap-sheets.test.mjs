import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {unzip} from '../src/web/zip.mjs';
import {intersects} from '../src/web/diagram/labels.mjs';

// Fictional light-faceplate switch and dark-faceplate stack with tagged,
// voice and LAG ports.
function lab(){
 const access={id:'access',name:'LAB-ACCESS',kind:'switch',vendor:'Aruba',model:'JL724A',ip:'192.0.2.10',vlans:[{id:10,name:'Data'},{id:20,name:'Voice'},{id:30,name:'Printers'}],
  ports:Array.from({length:28},(_,i)=>{const n=i+1;return {name:'1/1/'+n,state:n===28?'down':'up',native:n<=20?10:n<=24?30:1,tagged:n<=20?[30]:n>=25?[10,20,30]:[],...(n<=20?{voice:20}:{}),...(n>=27?{lag:'7'}:{}),...(n===25?{description:'Core uplink'}:{})};})};
 const stack={id:'stack',name:'LAB-STACK',kind:'switch',vendor:'Aruba',model:'JL558A',stackMembers:[{id:'1',model:'JL558A'},{id:'2',model:'JL558A'}],
  ports:['1/1','1/2','2/1','1/49','2/49'].map(name=>({name,state:'up',native:10,tagged:/49$/.test(name)?[20,30]:[]}))};
 return {name:'Port sheet lab',devices:[access,stack],links:[{a:'access',ap:'1/1/25',b:'stack',bp:'1/49',media:'DAC',speed:'10 Gbps'}]};
}
const maps=site=>buildPages(site).filter(page=>page.portMap);

test('port numbers are plain black or white text chosen for the faceplate, with no color block',()=>{
 const overview=maps(lab()).filter(page=>page.portMap.bookletRole==='map');
 const numbers=overview.flatMap(page=>page.items.filter(item=>item.portNumberRole==='text'));
 assert.ok(numbers.length);assert.ok(!overview.some(page=>page.items.some(item=>item.portNumberRole==='box')));
 const light=numbers.filter(n=>n.sourceId==='access'),dark=numbers.filter(n=>n.sourceId==='stack');
 assert.ok(light.length&&light.every(n=>n.color==='#111827'),'Dark numbers on the light switch');
 assert.ok(dark.length&&dark.every(n=>n.color==='#FFFFFF'),'White numbers on the dark stack faceplate');
});

test('booklet jacks carry native fills, tagged dots, voice diamonds and LAG outlines from one shared palette',()=>{
 const pages=maps(lab()),overview=pages.find(page=>page.portMap.bookletRole==='map'),items=overview.items;
 const fill=name=>items.find(i=>i.portNumberRole==='socket'&&i.portName===name&&i.sourceId==='access');
 assert.equal(fill('1/1/1').fill,fill('1/1/20').fill);assert.notEqual(fill('1/1/1').fill,fill('1/1/21').fill,'Native VLANs have distinct fills');
 const tagged=name=>items.filter(i=>i.portNumberRole==='tagged'&&i.portName===name&&i.sourceId==='access');
 assert.equal(tagged('1/1/1').length,1,'Voice and native VLANs are not repeated as tagged dots');assert.equal(tagged('1/1/25').length,3);assert.equal(tagged('1/1/21').length,0);
 assert.ok(items.some(i=>i.portNumberRole==='voice'&&i.portName==='1/1/1'));assert.ok(!items.some(i=>i.portNumberRole==='voice'&&i.portName==='1/1/25'));
 const lag=fill('1/1/27');assert.notEqual(lag.stroke,'none');assert.equal(fill('1/1/28').stroke,lag.stroke);assert.equal(fill('1/1/26').stroke,'none');
 const texts=pages.filter(page=>['map','key'].includes(page.portMap.bookletRole)).flatMap(page=>page.items.filter(i=>i.type==='text').map(i=>i.value));
 for(const value of ['VLAN key','VLAN 10 · Data','VLAN 20 · Voice (voice)','Trunks / LAGs','LAG 7: LAB-ACCESS 27-28','Port descriptions','LAB-ACCESS 25: Core uplink','Tagged VLAN','Voice VLAN','LAG / trunk'])assert.ok(texts.includes(value),value);
 // The key swatch for a VLAN uses the jack's fill.
 const swatch=items.find(i=>i.editKey?.endsWith('|key|vlan:10|swatch'));assert.equal(swatch.fill,fill('1/1/1').fill);
});

test('port inventory tables follow the switchport builder and keep every record',()=>{
 const pages=maps(lab()),inventory=pages.filter(page=>page.portMap.bookletRole==='inventory');
 assert.deepEqual(inventory.map(page=>page.portMap.device),['access','stack']);
 for(const page of inventory){
  const text=page.items.filter(i=>i.type==='text').map(i=>i.value);
  for(const heading of ['Description','Mode','Native','Tagged VLANs','LAG','Voice','Link','Connected to'])assert.ok(text.includes(heading),heading);
  assert.ok(text.some(value=>value.endsWith('/  Port inventory')));
  const cells=page.items.filter(i=>i.tableContent&&i.type==='text');for(const a of cells)for(const b of cells)if(a!==b)assert.ok(!intersects(a,b),a.value+' / '+b.value);
 }
 const access=inventory[0],ports=access.items.filter(i=>i.portTableRole==='interface').map(i=>i.value);
 assert.deepEqual(ports,['1-20 (20)','21-24 (4)','25','26','27-28 (2)'],'Consecutive identical ports share a row with their count');
 const details=access.items.filter(i=>i.portTableRole==='detail').map(i=>i.value);
 for(const value of ['Core uplink','Tagged/mixed','Untagged','LAB-STACK / 1/49','1 up, 1 down','7','20'])assert.ok(details.some(v=>v.includes(value)),value);
 assert.equal(new Set(inventory.flatMap(page=>page.portMap.portRecords.map(r=>r.device+'/'+r.name))).size,33);
});

test('inline connector captions and booklet marks remain editable native Visio shapes',async()=>{
 const site=lab(),pages=buildPages(site),parts=await unzip(await exportVisio(site,pages).arrayBuffer());
 const xml=[...parts].filter(([key])=>/^visio\/pages\/page\d+\.xml$/.test(key)).map(([,bytes])=>new TextDecoder().decode(bytes)).join('');
 assert.ok(xml.includes('Trunks / LAGs'));assert.ok(xml.includes('Port inventory'));
});
