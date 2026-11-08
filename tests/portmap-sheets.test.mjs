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
 const overview=maps(lab()).filter(page=>page.portMap.overview);
 const numbers=overview.flatMap(page=>page.items.filter(item=>item.portNumberRole==='text'));
 assert.ok(numbers.length);assert.ok(!overview.some(page=>page.items.some(item=>item.portNumberRole==='box')));
 const light=numbers.filter(n=>n.sourceId==='access'),dark=numbers.filter(n=>n.sourceId==='stack');
 assert.ok(light.length&&light.every(n=>n.color==='#111827'),'Dark numbers on the light switch');
 assert.ok(dark.length&&dark.every(n=>n.color==='#FFFFFF'),'White numbers on the dark stack faceplate');
});

test('booklet jacks carry native fills, tagged dots, voice diamonds and LAG outlines from one shared palette',()=>{
 const pages=maps(lab()),overview=pages.find(page=>page.portMap.overview&&page.portMap.device==='access'),items=overview.items;
 const fill=name=>items.find(i=>i.portNumberRole==='socket'&&i.portName===name&&i.sourceId==='access');
 assert.equal(fill('1/1/1').fill,fill('1/1/20').fill);assert.notEqual(fill('1/1/1').fill,fill('1/1/21').fill,'Native VLANs have distinct fills');
 const tagged=name=>items.filter(i=>i.portNumberRole==='tagged'&&i.portName===name&&i.sourceId==='access');
 assert.equal(tagged('1/1/1').length,1,'Voice and native VLANs are not repeated as tagged dots');assert.equal(tagged('1/1/25').length,3);assert.equal(tagged('1/1/21').length,0);
 assert.ok(items.some(i=>i.portNumberRole==='voice'&&i.portName==='1/1/1'));assert.ok(!items.some(i=>i.portNumberRole==='voice'&&i.portName==='1/1/25'));
 const lag=fill('1/1/27');assert.notEqual(lag.stroke,'none');assert.equal(fill('1/1/28').stroke,lag.stroke);assert.equal(fill('1/1/26').stroke,'none');
 const texts=pages.filter(page=>page.portMap.device==='access').flatMap(page=>page.items.filter(i=>i.type==='text').map(i=>i.value));
 for(const value of ['NETWORK PORT MAP','LAB-ACCESS','VLAN key','10  Data','20  Voice (voice)','Trunks / LAGs','LAG 7: 27-28','Port descriptions','25: Core uplink','Native VLAN','Tagged VLAN','Voice VLAN','LAG / trunk','Stack / VSF'])assert.ok(texts.includes(value),value);
 // Stack members each sit under their own bar.
 const stack=pages.find(page=>page.portMap.overview&&page.portMap.device==='stack');assert.ok(stack.items.some(i=>i.value?.startsWith('Member 1  |  JL558A  |')));assert.ok(stack.items.some(i=>i.value?.startsWith('Member 2  |  JL558A  |')));
 assert.equal(stack.items.filter(i=>i.type==='device'&&i.kind==='switch').length,2,'Each member is drawn as its own faceplate');
 // The key swatch for a VLAN uses the jack's fill.
 const swatch=items.find(i=>i.editKey?.endsWith('|key|vlan:10|swatch'));assert.equal(swatch.fill,fill('1/1/1').fill);
});

test('port inventory tables follow the switchport builder and keep every record',()=>{
 const site=lab();site.layout={portMap:{presentation:'separate'}};const pages=maps(site),inventory=pages.filter(page=>page.portMap.bookletRole==='inventory');
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

test('inline connector text paints its white background in native Visio',async()=>{
 const site=lab(),pages=buildPages(site),page=pages[0];
 page.items.push({type:'text',x:600,y:300,w:80,h:16,value:'Inline caption',size:12,bold:true,color:'#111827',align:'center',background:'#FFFFFF',full:true,labelRole:'media',editKey:page.name+'|media|inline-test'});
 const parts=await unzip(await exportVisio(site,pages).arrayBuffer()),xml=new TextDecoder().decode(parts.get('visio/pages/page1.xml'));
 const shape=xml.split('<Shape ').find(s=>s.includes('Inline caption'));assert.ok(shape);
 assert.match(shape,/N="FillPattern" V="1"/);assert.match(shape,/N="NoFill" V="0"/);assert.match(shape,/N="NoLine" V="1"/);
});

test('a trunk with many tagged VLANs keeps readable dots: wider hardware, or a + marker and a full list on fixed paper',()=>{
 // Fictional chassis: SFP+ trunks carrying 25 VLANs with no native VLAN, and
 // a copper trunk with a voice VLAN.
 const vlans=Array.from({length:26},(_,i)=>({id:100+i,name:'Lab '+(100+i)}));
 const core=()=>({id:'core',name:'LAB-CHASSIS',kind:'switch',vendor:'Aruba',model:'J9850A',modules:[{slot:'A',model:'J9993A'},{slot:'C',model:'J9986A'}],vlans,
  ports:[...Array.from({length:8},(_,i)=>({name:'A'+(i+1),state:'up',native:null,nativeState:'None',tagged:vlans.slice(0,25).map(v=>v.id)})),{name:'C1',state:'up',native:100,voice:125,tagged:vlans.slice(1,20).map(v=>v.id)}]});
 const sheet=layout=>maps({name:'Trunk lab',devices:[core()],links:[],layout}).find(p=>p.portMap.overview&&p.portMap.device==='core');
 // A dynamic page widens the common hardware until every dot fits at the minimum size.
 const page=sheet({});
 for(const [name,count] of [['A1',25],['A8',25],['C1',19]]){
  const dots=page.items.filter(i=>i.portNumberRole==='tagged'&&i.portName===name),socket=page.items.find(i=>i.portNumberRole==='socket'&&i.portName===name);
  assert.equal(dots.length,count,name+' shows every tagged VLAN');assert.ok(socket,name);assert.ok(dots.every(d=>d.w/2>=1.5-1e-9),name+' dots stay readable');
  for(const d of dots)assert.ok(d.x>=socket.x-.01&&d.y>=socket.y-.01&&d.x+d.w<=socket.x+socket.w+.01&&d.y+d.h<=socket.y+socket.h+.01,name+' dot stays on the jack');
  for(let i=0;i<dots.length;i++)for(let j=i+1;j<dots.length;j++)assert.ok(!intersects(dots[i],dots[j],0),name+' dots do not overlap');
 }
 const voice=page.items.find(i=>i.portNumberRole==='voice'&&i.portName==='C1');assert.ok(voice&&page.items.filter(i=>i.portNumberRole==='tagged'&&i.portName==='C1').every(d=>!intersects(d,voice,0)),'the voice diamond keeps its room');
 assert.ok(!page.items.some(i=>i.portNumberRole==='tagged-more'));
 // Fixed paper cannot widen: readable dots, a + marker and the full list.
 const fixed=sheet({pageSetup:{default:{preset:'letter'}}}),dots=fixed.items.filter(i=>i.portNumberRole==='tagged'&&i.portName==='A1'),more=fixed.items.find(i=>i.portNumberRole==='tagged-more'&&i.type==='ellipse'&&i.portName==='A1');
 assert.ok(dots.length<25&&dots.every(d=>d.w/2>=1.5-1e-9));assert.equal(more?.moreCount,25-dots.length);
 const texts=fixed.items.filter(i=>i.type==='text').map(i=>i.value);assert.ok(texts.includes('Tagged VLANs (+ on the jack)'));assert.ok(texts.some(t=>/^A?1-8: 100-124$/.test(t)),texts.filter(t=>/100/.test(t)).join(' | '));
});
