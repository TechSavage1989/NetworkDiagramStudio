import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {portColumnPrefix,portRanges,portNumberBox} from '../src/web/port-table.mjs';
import {textWidth} from '../src/web/diagram/labels.mjs';
import {unzip} from '../src/web/zip.mjs';

function fixture(){
 const panel=n=>({id:'switch-'+n,name:'LAB-MDF-'+n,kind:'switch',vendor:'Aruba',model:'JL675A',ip:'192.0.2.'+n,ports:Array.from({length:52},(_,i)=>{const number=i+1;return {name:'1/1/'+number,role:number<=40?'wired':number<=48?'ap':number>=51?'uplink':'access',native:number===50?1:12,tagged:number<=40?[24]:[],state:number===52?'down':'up',speed:number>=49?'10 Gbps':'1 Gbps',...(number>=51?{lag:'1'}:{}),...(number===49?{description:'Firewall uplink'}:{})};})});
 const aps=[1,2,3,4].map(n=>({id:'ap-'+n,name:'LAB-AP-'+n,kind:'ap',ports:[{name:'eth0'}]}));
 return {name:'Port Layout Lab',devices:[panel(1),panel(2),...aps],links:[{a:'switch-1',ap:'1/1/51',b:'switch-2',bp:'1/1/51',media:'DAC',speed:'10 Gbps'},...aps.map((ap,i)=>({a:'switch-'+(i<2?1:2),ap:'1/1/'+(41+i%2),b:ap.id,bp:'eth0',media:'copper',speed:'1 Gbps'}))]};
}
const maps=site=>buildPages(site).filter(page=>page.portMap);
const identities=pages=>new Set(pages.flatMap(page=>page.portMap.portRecords||page.portMap.rowNames.map(name=>({device:page.portMap.device,name}))).map(port=>port.device+'/'+port.name));

test('compact grouped port maps combine panel pairs and a reference-style assignment matrix',()=>{
 const site=fixture();site.layout={portMap:{presentation:'combined'}};const pages=maps(site),first=pages[0],panels=first.items.filter(item=>item.type==='device');
 assert.equal(panels.length,2);assert.ok(panels.every(panel=>panel.w>1100));assert.ok(panels[0].y+panels[0].h<panels[1].y);
 assert.equal(first.portMap.assignmentMatrix,true);assert.deepEqual(first.portMap.devices,['switch-1','switch-2']);assert.equal(first.portMap.total,104);assert.equal(identities(pages).size,104);assert.ok(pages.length<=2);
 const text=first.items.filter(item=>item.type==='text').map(item=>item.value);for(const title of ['PORT ROLES','LINK STATE','Port assignment','VLANs and link details'])assert.ok(text.includes(title));
 assert.ok(first.items.some(item=>item.fill==='#16364A'&&item.editKey?.endsWith('|assignment-header')));
 assert.ok(first.items.some(item=>item.portAssignmentRole==='ports'&&item.value==='1-40'));
 assert.equal(first.items.filter(item=>item.portAssignmentRole==='assignment'&&item.value==='LAG 1').length,1);
 const details=pages.flatMap(page=>page.items.filter(item=>item.portAssignmentRole==='details').map(item=>item.value)).join(' ');for(const value of ['Native VLAN 12','Tagged VLANs 24','10 Gbps','DAC','Down','LAB-AP-1 / eth0'])assert.ok(details.includes(value),value);
 for(const panel of panels){const title=first.items.find(item=>item.editKey===panel.editKey+'|port-map-title|0');assert.ok(title.y+title.h<=panel.y&&panel.y-title.y<40);}
});

test('port number boxes share one size and font across all RJ45 and optical jacks and wireless pages',()=>{
 const pages=buildPages(fixture());
 for(const page of pages.filter(page=>page.portMap||page.title==='Wireless Connections'))for(const panel of page.items.filter(item=>item.type==='device'&&item.kind==='switch')){
  const boxes=page.items.filter(item=>item.portNumberRole==='box'&&item.sourceId===panel.sourceId),numbers=page.items.filter(item=>item.portNumberRole==='text'&&item.sourceId===panel.sourceId);
  assert.equal(boxes.length,52);assert.equal(numbers.length,52);assert.equal(new Set(boxes.map(box=>[box.w,box.h].join(','))).size,1);assert.equal(new Set(numbers.map(number=>number.size)).size,1);assert.ok(numbers[0].size>=6);
  assert.ok(numbers.some(number=>number.value==='1'));assert.ok(numbers.some(number=>number.value==='49'));
  for(const box of boxes){const point=panel.ports[box.portName];assert.ok(Math.abs(box.x+box.w/2-panel.x-point[0]*panel.w)<1e-8);assert.ok(Math.abs(box.y+box.h/2-panel.y-point[1]*panel.h)<1e-8);}
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x+.01||b.x+b.w<=a.x+.01||a.y+a.h<=b.y+.01||b.y+b.h<=a.y+.01,'number boxes overlap');}
 }
 const box=portNumberBox([{text:'1',x:10,y:10},{text:'52',x:35,y:10},{text:'2',x:10,y:30}]);assert.ok(box.readable);assert.ok(box.w<=23&&box.h<=18);
});

test('assignment filters preserve faceplate inventory and expanded or ungrouped details remain available',()=>{
 const site=fixture(),original=identities(maps(site));site.layout={portMap:{detailFilter:'connected'}};const filtered=maps(site);assert.equal(identities(filtered).size,8);assert.equal(filtered[0].items.filter(item=>item.portNumberRole==='box').length,104);assert.equal(filtered[0].portMap.total,104);
 for(const options of [{density:'expanded'},{groupConsecutive:false}]){site.layout.portMap={...options};const pages=maps(site);assert.deepEqual(identities(pages),original);assert.ok(pages.every(page=>!page.portMap.assignmentMatrix));}
});

test('long matrix records continue without losing content and every cell remains within the page',()=>{
 const words=Array.from({length:350},(_,i)=>'Detail'+i),site=fixture();site.devices[0].ports[0].description=words.join(' ');const pages=maps(site);assert.ok(pages.length>1&&pages.length<12);assert.equal(identities(pages).size,104);
 const text=pages.flatMap(page=>page.items.filter(item=>item.portTableRole==='detail').map(item=>item.value)).join(' ');for(const word of words)assert.ok(text.includes(word));
 for(const page of pages){const keys=page.items.map(item=>item.editKey).filter(Boolean);assert.equal(keys.length,new Set(keys).size);assert.ok(keys.every(key=>key.length<=500));for(const item of page.items.filter(item=>item.portTableRole)){assert.ok(item.y+item.h<=851);assert.ok(textWidth(item.value,item.size,item.bold)<=item.w,item.value);}}
});

test('assignment cells and uniform number labels retain stable edits in SVG and native Visio',async()=>{
 const site=fixture(),before=maps(site)[0],number=before.items.find(item=>item.portNumberRole==='text'&&item.value==='49'),assignment=maps(site).find(page=>page.portMap.bookletRole==='inventory').items.find(item=>item.portAssignmentRole==='assignment');site.layout={drawingEdits:{[number.editKey]:{value:'WAN',color:'#AA2200',w:32,x:number.x+(number.w-32)/2},[assignment.editKey]:{value:'Edited assignment',x:70}}};const pages=buildPages(site),after=pages.find(page=>page.portMap);
 assert.equal(after.items.find(item=>item.editKey===number.editKey).value,'WAN');const inventory=pages.find(page=>page.portMap?.bookletRole==='inventory');assert.equal(inventory.items.find(item=>item.editKey===assignment.editKey).x,70);assert.ok(inventory.svg.includes('Edited assignment'));
 const parts=await unzip(await exportVisio(site,pages).arrayBuffer()),xml=[...parts].filter(([key])=>/^visio\/pages\/page\d+\.xml$/.test(key)).map(([,bytes])=>new TextDecoder().decode(bytes)).join('');assert.ok(xml.includes('Edited assignment'));assert.ok(xml.includes('WAN'));assert.ok(xml.includes('#AA2200'));
});

test('numeric assignment ranges retain mixed stack prefixes and disjoint ranges',()=>{
 assert.equal(portColumnPrefix(['1/1/1','1/1/10']),'1/1/');assert.equal(portColumnPrefix(['1/1/1','2/1/1']),'');assert.equal(portRanges(['1/1/10','1/1/2','1/1/1'],'1/1/'),'1-2, 10');assert.equal(portRanges(['2/1/1','1/1/10','1/1/9']),'1/1/9-10, 2/1/1');
});

test('long device titles and summaries wrap above their panels and existing panel edits retain their keys',()=>{
 const site=fixture();site.layout={coreExclude:['switch-1']};site.devices[0].name=Array.from({length:28},(_,i)=>'Equipment'+i).join(' ');site.devices[0].vendor=Array.from({length:20},(_,i)=>'Vendor'+i).join(' ');let first=maps(site)[0];
 for(const panel of first.items.filter(item=>item.type==='device')){const titles=first.items.filter(item=>item.editKey?.startsWith(panel.editKey+'|port-map-title|')),summary=first.items.filter(item=>item.editKey?.startsWith(panel.editKey+'|port-map-summary'));assert.ok(titles.length);for(const text of [...titles,...summary]){assert.ok(text.y>=146);assert.ok(text.y+text.h<=panel.y);assert.ok(textWidth(text.value,text.size,text.bold)<=text.w);}}
 const panel=first.items.find(item=>item.type==='device'&&item.sourceId==='switch-1');assert.equal(panel.editKey,'MDF Port Map|switch-1|sheet:0|device|switch-1|body');site.layout.drawingEdits={[panel.editKey]:{x:64,y:300,w:1050,h:100}};first=maps(site)[0];const moved=first.items.find(item=>item.editKey===panel.editKey);assert.deepEqual([moved.x,moved.y,moved.w,moved.h],[64,300,1050,100]);
});

test('paired bitmap and native stencil panels use distinct scene keys and correct Visio masters',async()=>{
 const site=fixture(),bitmap={id:'bitmap',name:'Lab bitmap panel',view:'front',width:10,height:1,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5F8AAAAASUVORK5CYII=',anchors:{'1/1/1':[.1,.3],'1/1/49':[.8,.7]}},native={...bitmap,id:'native',name:'Lab native panel',native:{paths:[{commands:[['M',0,0],['L',1,0],['L',1,1],['L',0,1],['Z']],fill:'#EEEEEE',stroke:'#16364A',weight:.001}],texts:[{text:'Native panel artwork',x:.5,y:.5,w:.5,size:.02,angle:0,color:'#16364A'}]}};site.stencils={bitmap,native};site.devices[0].stencilId='bitmap';site.devices[1].stencilId='native';const pages=buildPages(site),panels=pages.find(page=>page.portMap).items.filter(item=>item.type==='device');assert.equal(new Set(panels.map(panel=>panel.key)).size,2);assert.deepEqual(panels.map(panel=>panel.asset.id),['bitmap','native']);
 const parts=await unzip(await exportVisio(site,pages).arrayBuffer()),xml=[...parts].filter(([key])=>/^visio\/pages\/page\d+\.xml$/.test(key)).map(([,bytes])=>new TextDecoder().decode(bytes)).join('');assert.ok(xml.includes('Native panel artwork'));assert.ok(xml.includes('ForeignType="Bitmap"'));assert.equal([...parts.keys()].filter(key=>key.startsWith('visio/media/')).length,1);
});

test('default booklet sheets separate colored faceplates from complete inventory',()=>{
 const site=fixture(),pages=maps(site);
 const overviews=pages.filter(page=>page.portMap.bookletRole==='map');
 const inventory=pages.filter(page=>page.portMap.bookletRole==='inventory');
 assert.ok(overviews.length&&inventory.length);
 assert.ok(overviews.every(page=>page.items.some(item=>item.type==='device')&&
   page.items.some(item=>item.value==='NATIVE VLAN KEY')&&!page.items.some(item=>item.portTableRole)));
 assert.ok(inventory.every(page=>page.title==='Port Inventory'&&
   page.items.some(item=>item.portTableRole)&&!page.items.some(item=>item.type==='device')));
 assert.equal(identities(inventory).size,104);
 const ports=overviews.flatMap(page=>page.items.filter(item=>item.portNumberRole==='box'));
 assert.notEqual(ports.find(port=>port.portName==='1/1/1').fill,ports.find(port=>port.portName==='1/1/50').fill);
});
