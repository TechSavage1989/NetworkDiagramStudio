import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {CABLE_MOVE_NOTE} from '../src/web/reports/scene.mjs';

// Port map sheets name each member with its model and hardware, keep VLANs
// and LAGs under their own headings, list port descriptions when every one
// fits, and end with the cable-move safety note. Fictional data only.
const vlans=Array.from({length:8},(_,i)=>({id:10+i,name:'Lab '+(10+i)}));
function site({members=1,described=10,details}={}){
 const ports=[];for(let m=1;m<=members;m++)for(let p=1;p<=52;p++)ports.push({name:(members>1?m+'/':'')+p,state:p%5?'up':'down',native:p>48?null:10+(p%4),voice:p<=48&&p%3===0?20:undefined,tagged:p>48?vlans.map(v=>v.id):vlans.slice(4,4+(p%3)).map(v=>v.id),description:p<=described?'Office drop '+(100+p):undefined,lag:p>50?'Trk1':undefined});
 const device={id:'idf',name:'LAB-IDF',kind:'switch',vendor:'Aruba',model:'JL256A',...(members>1?{stackMembers:Array.from({length:members},(_,i)=>({id:String(i+1),model:'JL256A'}))}:{}),vlans,ports,...(details?{reportDetails:details}:{})};
 return {name:'Lab site',devices:[device],links:[]};
}
const portMap=project=>buildPages(project).find(page=>page.switchportReport&&page.role==='onePage');
const texts=page=>page.items.filter(item=>item.type==='text').map(item=>String(item.value));

test('the port map header names the member, model and hardware',()=>{
 const one=texts(portMap(site({details:[{id:'1',serialNumber:'SN-TEST-1',assetTag:'IT-42'}]})));
 assert.ok(one.some(value=>/^Switch \| JL256A \| 48 RJ-45 \+ 4 SFP\+? \| S\/N SN-TEST-1 \| Asset IT-42$/.test(value)),one.find(v=>/JL256A \|/.test(v)));
 const stack=texts(portMap(site({members:2})));
 for(const member of [1,2])assert.ok(stack.some(value=>value.startsWith('Member '+member+' | JL256A | 48 RJ-45')),'member '+member+' heading');
});

test('VLANs and LAGs have their own headings and the safety note closes the sheet',()=>{
 const page=portMap(site());
 const headings=page.items.filter(item=>item.reportKeyHeading).map(item=>item.reportKeyHeading);
 assert.deepEqual(headings.filter(key=>key!=='descriptions'),['vlans','lags']);
 const note=page.items.find(item=>item.reportFooterRole==='safety');
 assert.ok(note&&String(note.value).startsWith(CABLE_MOVE_NOTE),'safety note');
 assert.equal(CABLE_MOVE_NOTE,'Confirm live link, LLDP/CDP, and MAC address table before moving production cables.');
 const lowest=Math.max(...page.items.filter(item=>item!==note&&item.type!=='rect'&&item.y!=null&&!item.pageFrame).map(item=>item.y+(item.h||0)));
 assert.ok(lowest<=note.y,'content stays above the note');
});

test('port descriptions are listed when they fit, never partially',()=>{
 const few=portMap(site({described:10}));
 assert.equal(few.reportDescriptions,10);
 assert.equal(few.items.filter(item=>item.reportDescription&&!/\|port$/.test(item.editKey)).length,10);
 const stack=portMap(site({members:2,described:52}));
 const shown=stack.items.filter(item=>item.reportDescription&&!/\|port$/.test(item.editKey)).length;
 assert.ok(shown===0||shown===104,'all or none ('+shown+')');
 for(const item of stack.items.filter(item=>item.reportDescription))assert.ok(item.x+item.w<=stack.width&&item.y+item.h<=stack.height-47,'inside the sheet');
 const none=portMap(site({described:0}));assert.ok(!none.items.some(item=>item.reportKeyHeading==='descriptions'));
});

test('the safety note never overlaps the key, with or without the footer and at any margin',async()=>{
 const {adaptiveProject}=await import('./fixtures/adaptive-port-maps.mjs'),{intersects}=await import('../src/web/diagram/labels.mjs');
 const variants=[[],[p=>{p.layout.pageNumbers={footer:true,show:true};}],[p=>{p.layout.pageSetup.visible.marginMm=25;}]];
 for(const members of [2,5])for(const orientation of ['landscape','portrait'])for(const [change] of variants){
  const project=adaptiveProject('letter',orientation,members);change?.(project);
  for(const page of buildPages(project).filter(page=>page.switchportReport)){
   const note=page.items.find(item=>item.reportFooterRole==='safety');assert.ok(note,page.name+' has the safety note');
   const others=page.items.filter(item=>item!==note&&!item.pageFrame&&!item.pageHeading&&item.reportFooterRole!=='page'&&item.y!=null&&!(item.type==='rect'&&item.h<=1.5));
   for(const item of others)assert.ok(!intersects(note,{x:item.x,y:item.y,w:item.w||0,h:item.h||0},-.5),page.name+': the note overlaps '+(item.value||item.type));
   assert.ok(note.y+note.h<=page.height+.5,'the note stays on the sheet');
  }
 }
});

test('Port Inventory sheets are named after their devices and use compact table text',async()=>{
 const {wirelessTwoStackSite}=await import('./fixtures/wireless-two-stack.mjs'),{printGeometry}=await import('../src/web/page-options.mjs'),{textLayout}=await import('../src/web/diagram/scene.mjs');
 const p=wirelessTwoStackSite({mac:false});p.layout={...p.layout,pageSetup:{visible:{default:{preset:'letter'}}}};
 const pages=buildPages(p).filter(page=>page.portMap?.bookletRole==='inventory');
 assert.deepEqual(pages.map(page=>page.displayName),['Port Inventory - LAB-SW01-MDF, LAB-2FL-IDF-STACK','Port Inventory - LAB-1FL-IDF-STACK']);
 assert.deepEqual(pages.map(page=>page.name),['Port Inventory 1','Port Inventory 2'],'stable page names stay for settings and frames');
 for(const page of pages){
  assert.equal(page.items.find(item=>item.pageTitle).value,page.displayName,'the sheet title names its devices');
  const k=.75*printGeometry(page).width/page.width,cells=page.items.filter(item=>item.type==='text'&&item.compactTable&&item.portTableRole);
  const printed=Math.min(...cells.map(item=>textLayout(item).size))*k;assert.ok(printed>=6&&printed<7.5,'table text prints about 6.5 pt ('+printed.toFixed(2)+')');
  assert.ok(page.paperReadability.actualPt>=8,'table typography is not held to the diagram minimum');
 }
});

test('Port Inventory - Interfaces sheets are named after their devices, with plain Native text and compact type',async()=>{
 const {printGeometry}=await import('../src/web/page-options.mjs'),{textLayout}=await import('../src/web/diagram/scene.mjs');
 // Fictional switches with routed VLAN interfaces.
 const project={name:'Fictional campus',links:[],layout:{pageSetup:{visible:{default:{preset:'letter'}}}},devices:Array.from({length:6},(_,d)=>({id:'sw'+d,name:'LAB-SW-'+(d+1),kind:'switch',vendor:'Aruba',model:'JL256A',ip:'10.0.'+d+'.1',ports:[...Array.from({length:8},(_,i)=>({name:String(i+1),state:'up',native:10})),...Array.from({length:6+d*5},(_,v)=>({name:'vlan'+(10+v),state:'up',ip:'10.'+d+'.'+v+'.1/24',description:'Lab VLAN interface '+(10+v)}))],vlans:Array.from({length:6+d*5},(_,v)=>({id:10+v,name:'Lab VLAN '+(10+v),ip:'10.'+d+'.'+v+'.1/24'}))}))};
 const pages=buildPages(project),interfaces=pages.filter(page=>page.interfaceInventory),inventory=pages.filter(page=>page.portMap?.bookletRole==='inventory');
 assert.ok(interfaces.length>1);
 for(const page of interfaces){
  assert.match(page.displayName,/^Port Inventory - Interfaces - LAB-SW-\d/,page.name);
  assert.equal(page.items.find(item=>item.pageTitle).value,page.displayName);
  const names=new Set(page.interfaceSections.map(section=>section.name));for(const name of names)assert.ok(page.displayName.includes(name)||/\+\d+$/.test(page.displayName),name+' is named');
  const k=.75*printGeometry(page).width/page.width,cells=page.items.filter(item=>item.type==='text'&&item.logicalColumn!=null);
  const printed=Math.min(...cells.map(item=>textLayout(item).size))*k;assert.ok(printed>=6&&printed<7.5,'the same compact table text as Port Inventory ('+printed.toFixed(2)+')');
  assert.ok(cells.every(item=>item.compactTable));
 }
 // A device on several sheets is counted on each one.
 const counted=inventory.filter(page=>/\(\d\/\d\)/.test(page.displayName));
 for(const page of counted)assert.match(page.displayName,/LAB-SW-\d \(\d\/\d\)/);
 // The Native column is text only.
 for(const page of inventory)assert.ok(!page.items.some(item=>/\|swatch$/.test(item.editKey||'')),'no color blocks in the inventory rows');
});

test('tagged-VLAN dots may run over the jack latch line when a port needs the room',()=>{
 // Twelve tagged VLANs on the SFP+ ports: their dots need the latch band.
 const dense=Array.from({length:12},(_,i)=>({id:10+i,name:'Lab '+(10+i)})),ports=Array.from({length:52},(_,i)=>({name:String(i+1),state:'up',native:i>=48?null:10+(i%4),tagged:i>=48?dense.map(v=>v.id):[14]}));
 const page=portMap({name:'Lab',devices:[{id:'idf',name:'LAB-IDF',kind:'switch',vendor:'Aruba',model:'JL256A',vlans:dense,ports}],links:[]}),faces=new Map(page.items.filter(item=>item.reportPortRole==='native').map(face=>[face.reportPort,face]));
 const dots=page.items.filter(item=>['tagged','voice'].includes(item.reportPortRole)&&item.type!=='text'),byPort=new Map();
 for(const dot of dots){const list=byPort.get(dot.reportPort)||[];list.push(dot);byPort.set(dot.reportPort,list);}
 const lowest=port=>Math.max(...byPort.get(port).map(dot=>dot.y+dot.h)),latchTop=port=>{const face=faces.get(port),optical=!/RJ|copper/i.test(face.socketForm);return face.y+face.h-(optical?2.4:3);};
 const busiest=[...byPort.keys()].sort((a,b)=>byPort.get(b).length-byPort.get(a).length)[0],sparse=[...byPort.keys()].find(port=>byPort.get(port).length===1);
 // A cramped optical port takes the full row height or the latch band for larger dots.
 assert.ok(lowest(busiest)>latchTop(busiest)||faces.get(busiest).h>faces.get(busiest).w*.85,'the busiest port gets room for larger dots');
 const radius=port=>byPort.get(port)[0].w/2;assert.ok(radius(sparse)>radius(busiest),'a port with few dots draws them larger');
 assert.ok(lowest(sparse)<=latchTop(sparse)+1e-6,'a port with room keeps its dots above the latch line');
 for(const [port,list] of byPort)for(const dot of list){const face=faces.get(port);assert.ok(dot.x>=face.x+1&&dot.x+dot.w<=face.x+face.w-1&&dot.y>=face.y+1&&dot.y+dot.h<=face.y+face.h-1,'dots stay inside the jack, clear of its edges');}
});

test('an unconfirmed module is drawn as sockets, like the Switchport builder, with a one-line heading and a small note',async()=>{
 const {textLayout}=await import('../src/web/diagram/scene.mjs');
 const ports=[...Array.from({length:48},(_,i)=>({name:'GigabitEthernet0/'+(i+1),state:'up',native:130})),...['GigabitEthernet0/49','GigabitEthernet0/50','TenGigabitEthernet0/1','GigabitEthernet0/51','GigabitEthernet0/52','TenGigabitEthernet0/2'].map(name=>({name,state:'down',native:130,lag:/49|50|Ten/.test(name)?'Po1':undefined}))];
 const device={id:'n130',name:'LAB_NORTH_130_2',kind:'switch',vendor:'Cisco',model:'WS-C3560E-48PD-SF',vlans:[{id:130,name:'Lab'}],ports};
 const page=buildPages({name:'Lab',links:[],devices:[device]}).find(page=>page.switchportReport&&page.role==='onePage');
 const heading=page.items.find(item=>item.type==='text'&&/\|group\|Uplink interfaces - module unconfirmed\|title$/.test(item.editKey||''));
 assert.equal(heading.value,'Uplink interfaces','a short heading on drawing-set maps');assert.equal(textLayout(heading).lines.length,1,'one line');
 const faces=page.items.filter(item=>item.reportPortRole==='native'&&/0\/(49|50|51|52)$|TenGigabitEthernet/.test(item.reportPort));
 assert.equal(faces.length,6,'each configured interface has a socket');
 const labels=page.items.filter(item=>item.type==='text'&&/^(Gi|Te)\d+$/.test(item.value)).map(item=>item.value).sort();
 assert.deepEqual(labels,['Gi49','Gi50','Gi51','Gi52','Te1','Te2'],'short interface labels');
 const bottom=heading.y+textLayout(heading).lines.length*textLayout(heading).size*1.2;
 assert.ok(Math.min(...faces.map(face=>face.y))>bottom,'sockets sit below the heading');
 assert.ok(page.items.some(item=>item.reportUplinkBasis&&/^Uplink module unconfirmed: Upper bay: Te1 OR Gi49\/Gi50/.test(item.value)&&item.size<=9),'one small uplink note');assert.ok(!page.items.some(item=>item.reportKeyHeading==='uplinks'),'no separate note heading');
 assert.ok(!page.items.some(item=>/configured alternative/.test(String(item.value))),'no text-only rows');
});

test('a trunk-policy * or disabled ! mark sits beside the port number and never takes room from the dots',()=>{
 const vlans=Array.from({length:14},(_,i)=>({id:10+i,name:'Lab '+(10+i)})),build=policy=>{
  const ports=Array.from({length:48},(_,i)=>({name:'GigabitEthernet0/'+(i+1),state:'up',native:10,...(i===0?{tagged:vlans.map(v=>v.id).slice(1),mode:'trunk',...(policy?{taggedVlanPolicy:'All'}:{})}:{}),...(i===2&&policy?{disabled:true}:{})}));
  return buildPages({name:'Lab',links:[],devices:[{id:'sw',name:'LAB-SW',kind:'switch',vendor:'Cisco',model:'WS-C3560E-48PD-SF',vlans,ports}]}).find(page=>page.switchportReport&&page.role==='onePage');
 };
 const plain=build(false),marked=build(true),radius=page=>Math.max(...page.items.filter(i=>i.reportPortRole==='tagged'&&i.reportPort==='GigabitEthernet0/1').map(i=>i.w/2));
 assert.ok(Math.abs(radius(marked)-radius(plain))<1e-9,'the mark costs the dots nothing: '+radius(marked)+' vs '+radius(plain));
 const face=port=>marked.items.find(i=>i.reportPortRole==='native'&&i.reportPort===port),number=port=>marked.items.find(i=>i.portNumberRole==='text'&&i.reportPort===port);
 for(const [port,role,mark] of [['GigabitEthernet0/1','policy','*'],['GigabitEthernet0/3','disabled','!']]){
  const item=marked.items.find(i=>i.reportPortRole===role&&i.reportPort===port),f=face(port),n=number(port);
  assert.equal(item.value,mark);assert.ok(item.y+item.h<=f.y+1e-6||item.y>=f.y+f.h-1e-6,role+' mark outside the jack');
  assert.ok(Math.abs(item.y-n.y)<1e-6&&item.x>n.x+n.w/2,role+' mark follows the number on its line');
 }
 assert.ok(marked.items.some(i=>i.value==='All VLANs allowed (trunk policy)'),'the key explains *');
});
