import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages as buildAllPages,exportVisio} from '../src/web/diagram/index.mjs';
import {withFaceplateMaps} from './fixtures/faceplate-maps.mjs';
const buildPages=withFaceplateMaps(buildAllPages);
import {unzip} from '../src/web/zip.mjs';
import {intersects} from '../src/web/diagram/labels.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {luminance} from '../src/web/reports/palette.mjs';

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
 // A growing page widens the common hardware until every dot fits at the minimum size.
 const page=sheet({pageSetup:{overrides:{ports:{preset:'dynamic'}}}});
 for(const [name,count] of [['A1',25],['A8',25],['C1',19]]){
  const dots=page.items.filter(i=>i.portNumberRole==='tagged'&&i.portName===name),socket=page.items.find(i=>i.portNumberRole==='socket'&&i.portName===name);
  assert.equal(dots.length,count,name+' shows every tagged VLAN');assert.ok(socket,name);assert.ok(dots.every(d=>d.w/2>=1.5-1e-9),name+' dots stay readable');
  for(const d of dots)assert.ok(d.x>=socket.x-.01&&d.y>=socket.y-.01&&d.x+d.w<=socket.x+socket.w+.01&&d.y+d.h<=socket.y+socket.h+.01,name+' dot stays on the jack');
  for(let i=0;i<dots.length;i++)for(let j=i+1;j<dots.length;j++)assert.ok(!intersects(dots[i],dots[j],0),name+' dots do not overlap');
 }
 const voice=page.items.find(i=>i.portNumberRole==='voice'&&i.portName==='C1');assert.ok(voice&&page.items.filter(i=>i.portNumberRole==='tagged'&&i.portName==='C1').every(d=>!intersects(d,voice,0)),'the voice diamond keeps its room');
 assert.ok(!page.items.some(i=>i.portNumberRole==='tagged-more'));
 // Fixed paper cannot grow: every dot stays readable, and any the jack
 // cannot hold are counted by a + marker and listed in full.
 const fixed=sheet({pageSetup:{default:{preset:'letter'}}}),dots=fixed.items.filter(i=>i.portNumberRole==='tagged'&&i.portName==='A1'),more=fixed.items.find(i=>i.portNumberRole==='tagged-more'&&i.type==='ellipse'&&i.portName==='A1');
 assert.ok(dots.every(d=>d.w/2>=1.5-1e-9));assert.equal(dots.length+(more?.moreCount||0),25);
 if(more){const texts=fixed.items.filter(i=>i.type==='text').map(i=>i.value);assert.ok(texts.includes('Tagged VLANs (+ on the jack)'));assert.ok(texts.some(t=>/^A?1-8: 100-124$/.test(t)),texts.filter(t=>/100/.test(t)).join(' | '));}
});

test('port maps default to the switchport builder sheet on US Letter, readable, complete and in device colors',async()=>{
 const {parseConfig}=await import('../src/web/imports/config.mjs');
 // Fictional AOS-Switch chassis with two SFP+ and two copper modules.
 const text=['; J9851A Configuration Editor; Created on release #KB.16.10.0009','hostname "LAB-SHEET"','module A type j9993a','module B type j9993a','module C type j9986a','module D type j9986a','trunk A1,B2 trk1 lacp',
  'vlan 1','   name "DEFAULT_VLAN"','   untagged C1-C12,Trk1','   no untagged A2-A8,B1,B3-B8,C13-C24,D1-D24','   exit',
  'vlan 20','   name "LAB_USERS"','   untagged C13-C24,D1-D24','   tagged A2-A8,B1,B3-B8,Trk1','   exit','vlan 30','   name "LAB_VOICE"','   tagged A2-A8,B1,B3-B8,C1-C24,Trk1','   voice','   exit'].join('\n');
 const device=parseConfig(text,'lab-sheet.cfg').devices[0],site={name:'Sheet lab',devices:[device],links:[],layout:{}};
 const pages=buildAllPages(site),sheet=pages.find(page=>page.portMap?.switchportSheet);assert.ok(sheet,'the builder sheet is the port map');
 assert.equal(Math.round(sheet.width),1056);assert.equal(Math.round(sheet.height),816);assert.equal(sheet.family,'ports');assert.equal(sheet.portMap.device,device.id);
 const numbers=sheet.items.filter(item=>item.reportPortRole==='number'),dots=sheet.items.filter(item=>item.reportPortRole==='tagged'||item.reportPortRole==='voice');
 assert.equal(new Set(numbers.map(item=>item.reportPort)).size,64,'every physical port is drawn');assert.ok(numbers.every(item=>item.size>=10),'numbers stay at least the builder size');
 assert.ok(dots.length&&dots.filter(dot=>dot.type==='ellipse').every(dot=>dot.w>=4.2-1e-9),'VLAN markers stay at least the builder size');
 assert.ok(pages.some(page=>page.portMap?.bookletRole==='inventory'),'the port inventory tables remain');
 // The sheet takes the chassis colors of the core-diagram artwork: the frame
 // shows around and between the slots, which use the module-bay color.
 const frame=sheet.items.find(item=>item.reportFrame),bodies=sheet.items.filter(item=>item.reportPanel);
 assert.equal(frame?.fill,'#D8DDDE','the chassis frame color');assert.ok(bodies.length&&bodies.every(item=>item.fill==='#C2CCCF'),'slot panels use the module-bay color');
 for(const body of bodies)assert.ok(body.x>=frame.x&&body.y>=frame.y&&body.x+body.w<=frame.x+frame.w&&body.y+body.h<=frame.y+frame.h,'slots sit inside the frame');
 // The realistic faceplate stays available as an explicit choice.
 const faceplate=buildAllPages({...site,layout:{portMap:{mapStyle:'faceplate'}}});assert.ok(!faceplate.some(page=>page.portMap?.switchportSheet));assert.ok(faceplate.some(page=>page.portMap?.overview&&page.items.some(item=>item.portNumberRole==='socket')));
 assert.equal(cleanLayout({portMap:{mapStyle:'faceplate'}}).portMap.mapStyle,'faceplate');assert.equal(cleanLayout({portMap:{mapStyle:'switchport'}}).portMap.mapStyle,undefined,'the builder sheet is the default and is not stored');
});

test('a dark access switch keeps its plate color on the builder sheet, with white port numbers',async()=>{
 const {deviceFaceplate}=await import('../src/web/diagram/faceplate.mjs');
 const vlans=[{id:10,name:'Lab users'},{id:20,name:'Lab voice'}];
 const stack={id:'idf',name:'LAB-IDF',kind:'switch',vendor:'HPE Aruba',model:'JL558A',vlans,ports:Array.from({length:52},(_,i)=>({name:String(i+1),state:'up',native:10,tagged:i>=48?[20]:[]}))};
 const sheet=buildAllPages({name:'Dark lab',devices:[stack],links:[],layout:{}}).find(page=>page.portMap?.switchportSheet);assert.ok(sheet,'the builder sheet is drawn');
 const bodies=sheet.items.filter(item=>item.reportPanel),numbers=sheet.items.filter(item=>item.reportPortRole==='number');
 const plate=deviceFaceplate(stack).children.filter(c=>c.type==='rect').reduce((a,b)=>b.w*b.h>a.w*a.h?b:a);assert.ok(luminance(plate.fill)<.4,'the fictional switch has a dark plate');
 assert.ok(bodies.length&&bodies.every(item=>item.fill===plate.fill),'panels use the plate color of the core artwork');
 assert.ok(numbers.length&&numbers.every(item=>item.color==='#ffffff'),'numbers stay readable on the dark plate');assert.ok(!sheet.items.some(item=>item.reportFrame),'a fixed switch has no chassis frame');
});

test('the realistic faceplate port map stays on a US Letter sheet, with builder-shaped jacks for readable dots',()=>{
 const vlans=Array.from({length:26},(_,i)=>({id:100+i,name:'Lab '+(100+i)}));
 const core={id:'core',name:'LAB-CHASSIS',kind:'switch',vendor:'Aruba',model:'J9850A',modules:[{slot:'A',model:'J9993A'},{slot:'C',model:'J9986A'}],vlans,ports:[{name:'A1',state:'up',native:100,tagged:vlans.slice(1,13).map(v=>v.id)},{name:'C1',state:'up',native:100,voice:125,tagged:vlans.slice(1,13).map(v=>v.id)}]};
 const page=buildAllPages({name:'Letter lab',devices:[core],links:[],layout:{portMap:{mapStyle:'faceplate'}}}).find(p=>p.portMap?.overview);
 assert.equal(Math.round(page.width),1056);assert.equal(Math.round(page.height),816);assert.ok(!page.portMap.switchportSheet,'the faceplate artwork is drawn');
 // Jack faces grow together and never overlap.
 const faces=page.items.filter(i=>i.portNumberRole==='face'),plate=page.items.find(i=>i.type==='device'&&i.sourceId==='core');assert.ok(faces.length,'jack faces are enlarged');
 // Faces take the switchport builder's shapes and cover their jack artwork.
 const sockets=plate.children.filter(c=>c.socketPart===0).map(c=>({x:plate.x+c.x*plate.w,y:plate.y+c.y*plate.h,w:c.w*plate.w,h:c.h*plate.h}));
 for(const face of faces){const optical=/^A/.test(face.portName),ratio=optical?25.2/16.2:25.2/23.2;assert.ok(Math.abs(face.w/face.h-ratio)<.01,face.portName+' uses the builder proportions');
  assert.ok(sockets.some(s=>s.x>=face.x-1e-6&&s.y>=face.y-1e-6&&s.x+s.w<=face.x+face.w+1e-6&&s.y+s.h<=face.y+face.h+1e-6),face.portName+' covers its jack');}
 const width=prefix=>new Set(faces.filter(f=>f.portName.startsWith(prefix)).map(f=>f.w.toFixed(3)));assert.equal(width('A').size,1,'optical faces share one width');assert.equal(width('C').size,1,'copper faces share one width');
 for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++)assert.ok(!intersects(faces[i],faces[j],-.01),'faces may touch but not overlap');
 for(const name of ['A1','C1']){const dots=page.items.filter(i=>i.portNumberRole==='tagged'&&i.portName===name);assert.equal(dots.length,12,name+' shows every tagged VLAN');assert.ok(dots.every(d=>d.w/2>=1.5-1e-9),name+' dots stay readable');}
 assert.ok(!page.items.some(i=>i.portNumberRole==='tagged-more'));
});

test('faceplate captions grow to a readable size without pushing a dense chassis map off US Letter',()=>{
 const vlans=Array.from({length:26},(_,i)=>({id:100+i,name:'Lab '+(100+i)}));
 const core={id:'core',name:'LAB-CHASSIS',kind:'switch',vendor:'Aruba',model:'J9850A',modules:[{slot:'A',model:'J9993A'},{slot:'C',model:'J9986A'}],vlans,ports:[...Array.from({length:8},(_,i)=>({name:'A'+(i+1),state:'up',native:null,nativeState:'None',tagged:vlans.slice(0,25).map(v=>v.id)})),...Array.from({length:24},(_,i)=>({name:'C'+(i+1),state:'up',native:100+(i%6),voice:i%3?125:undefined,tagged:vlans.slice(1,2+(i%8)*2).map(v=>v.id)}))]};
 const page=buildAllPages({name:'Caption lab',devices:[core],links:[],layout:{portMap:{mapStyle:'faceplate'}}}).find(p=>p.portMap?.overview);
 assert.equal(Math.round(page.width),1056);assert.equal(Math.round(page.height),816);
 const plate=page.items.find(i=>i.type==='device'&&i.sourceId==='core'),caption=value=>plate.children.find(c=>c.type==='text'&&c.value===value);
 for(const value of ['Management module','Optional MM2 bay'])assert.ok(caption(value)?.size>=9,value+' is readable');
 // A grown caption stays clear of every port number and jack face.
 const blocked=page.items.filter(i=>i.portNumberRole==='text'||i.portNumberRole==='face');
 for(const c of plate.children.filter(c=>c.type==='text'&&c.size>5)){const box={x:plate.x+c.x*plate.w,y:plate.y+c.y*plate.h+(c.h*plate.h-c.size*1.2)/2,w:c.w*plate.w,h:c.size*1.2};assert.ok(!blocked.some(b=>intersects(box,b,0)),c.value+' stays clear of numbers and faces');}
});

test('builder port maps grow tagged dots to fill the most filled jack, centered, one size per map',()=>{
 const vlans=Array.from({length:30},(_,i)=>({id:10+i,name:'Lab VLAN '+(10+i)})),ids=vlans.map(v=>v.id);
 const chassis=(id,max)=>({id,name:'LAB-'+id,kind:'switch',vendor:'HPE Aruba',model:'J9850A',modules:[{slot:'A',model:'J9993A'},{slot:'C',model:'J9986A'}],vlans,
  ports:[...Array.from({length:8},(_,i)=>({name:'A'+(i+1),state:'up',native:ids[0],tagged:ids.slice(6,6+(i%max)+1)})),...Array.from({length:24},(_,i)=>({name:'C'+(i+1),state:'up',native:ids[i%6],tagged:ids.slice(6,6+(i%max)+1)}))]});
 const pages=buildAllPages({name:'Fill lab',devices:[chassis('sparse',3),chassis('dense',14)],links:[],layout:{pageNumbers:{footer:true}}}).filter(page=>page.portMap?.switchportSheet),sheet=id=>pages.find(page=>page.portMap.device===id);
 const dots=page=>page.items.filter(i=>(i.reportPortRole==='tagged'&&i.type==='ellipse')),sizes=page=>new Set(dots(page).map(i=>i.w.toFixed(3)));
 for(const page of pages){assert.equal(sizes(page).size,1,'one dot size per map');assert.ok(Math.abs([...sizes(page)][0]/2-page.reportMarkerFit)<1e-3,'the map draws its fill size');}
 assert.ok(sheet('sparse').reportMarkerFit>sheet('dense').reportMarkerFit,'a sparser map takes larger dots');assert.ok(sheet('dense').reportMarkerFit>2.1,'the dense map grows past the builder radius');
 for(const page of pages){
  const faces=new Map(page.items.filter(i=>i.reportPortRole==='native'&&/\|face$/.test(i.editKey||'')).map(i=>[i.reportPort,i])),byPort=new Map();
  for(const dot of dots(page))byPort.set(dot.reportPort,[...(byPort.get(dot.reportPort)||[]),dot]);
  let widest=0;
  for(const [port,list] of byPort){
   const face=faces.get(port),xs=list.map(d=>d.x+d.w/2),left=Math.min(...list.map(d=>d.x)),right=Math.max(...list.map(d=>d.x+d.w)),top=Math.min(...list.map(d=>d.y)),bottom=Math.max(...list.map(d=>d.y+d.h));
   // The block is centered across the jack and inside its face.
   assert.ok(Math.abs((left+right)/2-(face.x+face.w/2))<.6,port+' dots are centered');assert.ok(left>=face.x&&right<=face.x+face.w&&top>=face.y&&bottom<=face.y+face.h,port+' dots stay on the face');
   widest=Math.max(widest,Math.max((right-left)/(face.w-4),(bottom-top)/(face.h-5)));
  }
  assert.ok(widest>.85,'the most filled jack is filled');
  // The jacks grow into the sheet: the map and key reach the page's width or
  // its footer, and optical cages stay rectangular but a little taller.
  const panels=page.items.filter(i=>i.reportPanel),right=Math.max(...panels.map(i=>i.x+i.w)),low=Math.max(...page.items.filter(i=>(i.y+(i.h||0))<page.height-45).map(i=>i.y+(i.h||0)));
  assert.ok(right>page.width-24-40||low>page.height-90,'the map uses the free page space');
  for(const face of faces.values())if(/^A/.test(face.reportPort))assert.ok(Math.abs(face.h/face.w-19.6/25.2)<.01,'optical faces use the map proportions');
  const d=chassis(page.portMap.device,page.portMap.device==='dense'?14:3);assert.equal(page.items.filter(i=>i.reportPortRole==='tagged').length,d.ports.reduce((n,p)=>n+p.tagged.length,0),'every tagged VLAN is drawn');
 }
});
