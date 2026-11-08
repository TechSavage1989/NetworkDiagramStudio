import test from 'node:test';
import assert from 'node:assert/strict';
import {addDevice,label,svgPage} from '../src/web/diagram/scene.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {portLabelLayout,portLabelText} from '../src/web/diagram/port-label-layout.mjs';
import {intersects,textWidth} from '../src/web/diagram/labels.mjs';
import {applyDrawingEdits} from '../src/web/drawing-edits.mjs';
import {scalePage} from '../src/web/presentation.mjs';
import {exportVisio} from '../src/web/diagram/visio.mjs';
import {unzip} from '../src/web/zip.mjs';

const build=(device,width=1100,project={})=>addDevice({name:'Port layout lab',items:[]},project,device,[40,170,width,1],'panel',{fitWidth:true,padding:.6});
function inventory(model,extra={}){
 const device={id:'lab-'+model,name:'LAB '+model,kind:'switch',model,...extra};
 device.ports=Object.keys(deviceFaceplate(device).ports).map(name=>({name}));return device;
}
function clearLayout(layout){
 assert.ok(layout.readable);assert.ok(layout.fontSize>=8);
 assert.equal(new Set(layout.entries.map(entry=>[entry.number.w,entry.number.h,entry.number.size].join(','))).size,1);
 for(const entry of layout.entries){
  const {number,socket,anchor}=entry;
  assert.ok(Math.abs(number.x+number.w/2-anchor.x)<1e-8);
  assert.ok(number.w>=textWidth(entry.text,number.size,true));
  if(socket){assert.ok(number.y+number.h<=socket.y-1||number.y>=socket.y+socket.h+1);assert.ok(Math.abs(socket.x+socket.w/2-anchor.x)<1e-8);assert.ok(Math.abs(socket.y+socket.h/2-anchor.y)<1e-8);assert.ok(entry.content.x>socket.x&&entry.content.y>socket.y);}
  for(const obstacle of layout.socketObstacles)assert.ok(!intersects(number,obstacle,1),'number covers a socket: '+entry.portName);
 }
 for(let i=0;i<layout.entries.length;i++)for(let j=i+1;j<layout.entries.length;j++)assert.ok(!intersects(layout.entries[i].number,layout.entries[j].number,1),'number bands collide');
}

test('external port numbers preserve every physical socket and use common readable copper and optical bands',()=>{
 const device={id:'lab-switch',name:'LAB ACCESS',kind:'switch',model:'JL675A',ports:Array.from({length:52},(_,i)=>({name:'1/1/'+(i+1)}))};
 for(const width of [700,1100]){
  const group=build(device,width),before=JSON.stringify(group),layout=portLabelLayout(group,device.ports);clearLayout(layout);
  assert.equal(layout.entries.length,52);assert.equal(layout.fontSize,10);assert.equal(JSON.stringify(group),before);
  assert.deepEqual(new Set(layout.entries.map(entry=>entry.number.side)),new Set(['above','below']));
  assert.ok(layout.entries.some(entry=>entry.socket.form==='SFP+'));assert.ok(layout.entries.some(entry=>/RJ/.test(entry.socket.form)));
  for(const entry of layout.entries){assert.equal(entry.portName,entry.port.name);assert.equal(entry.editKey,group.editKey+'|port-number|'+entry.portName);}
 }
});

test('stack member bands and modular chassis labels stay clear of neighboring hardware regions',()=>{
 const devices=[inventory('JL558A',{stackMembers:[{id:'1',model:'JL558A'},{id:'2',model:'JL558A'},{id:'3',model:'JL558A'}]}),...['J9850A','J9851A','J8697A','J8698A'].map(model=>inventory(model,{modules:['A','B','C','D','E','F'].map((slot,index)=>({slot,model:index%2?'J9987A':'J9993A'}))}))];
 for(const device of devices){
  let group=build(device),layout=portLabelLayout(group,device.ports);if(!layout.readable){assert.ok(layout.requiredWidth);group=build(device,layout.requiredWidth);layout=portLabelLayout(group,device.ports);}
  clearLayout(layout);assert.equal(layout.entries.length,device.ports.length);
  for(const entry of layout.entries)for(const region of group.panelRegions){
   const box={x:group.x+(region.x??0)*group.w,y:group.y+region.y*group.h,w:(region.w??1)*group.w,h:region.h*group.h};
   if(entry.anchor.x>=box.x&&entry.anchor.x<=box.x+box.w&&entry.anchor.y>=box.y&&entry.anchor.y<=box.y+box.h)continue;
   assert.ok(!intersects(entry.number,box),'number crosses another member or module');
  }
 }
});

test('three-row optical hardware requests space instead of shrinking text, shifting anchors or dropping ports',()=>{
 for(const model of ['JL479A','JL581A']){
  const device=inventory(model),group=build(device,700),before=JSON.stringify(group),small=portLabelLayout(group,device.ports);
  assert.equal(small.readable,false);assert.equal(small.entries.length,54);assert.ok(small.entries.every(entry=>entry.number===null));
  assert.ok(small.requiredWidth>700&&small.requiredWidth<1500);assert.equal(JSON.stringify(group),before);
  const larger=build(device,small.requiredWidth),fit=portLabelLayout(larger,device.ports);clearLayout(fit);assert.equal(fit.fontSize,10);assert.deepEqual(larger.ports,group.ports);
  assert.ok(new Set(fit.entries.map(entry=>Math.round(entry.anchor.y))).size>=3);
 }
});

test('mapped artwork keeps anchor-only labels, excludes unmapped interfaces and retains physical aliases',()=>{
 const group={x:10,y:20,w:500,h:100,editKey:'lab|device|mapped',sourceId:'mapped',children:[],ports:{wan1:[.2,.3],alias:[.2,.3],x1:[.8,.7]}},ports=[{name:'wan1'},{name:'alias'},{name:'x1'},{name:'unmapped'}];
 const layout=portLabelLayout(group,ports);clearLayout(layout);assert.equal(layout.entries.length,2);assert.equal(layout.unmapped[0].name,'unmapped');assert.equal(layout.socketObstacles.length,0);
 assert.ok(layout.entries.every(entry=>entry.socket===null&&entry.content===null));assert.deepEqual(layout.entries[0].aliases,['alias']);assert.deepEqual(layout.entries[0].ports,ports.slice(0,2));
 assert.deepEqual(layout.entries.map(entry=>entry.text),['wan1','x1']);assert.equal(portLabelText('GigabitEthernet2/0/48'),'48');assert.equal(portLabelText('A12'),'A12');assert.equal(portLabelText('port17'),'17');
});

test('outer bands expose padding and impossible mapped geometry has a bounded capacity result',()=>{
 const group={x:0,y:0,w:500,h:20,editKey:'lab',ports:{'1':[.2,0],'2':[.8,1]},children:[]},layout=portLabelLayout(group,[{name:'1'},{name:'2'}]);clearLayout(layout);assert.ok(layout.padding.top>=14);assert.ok(layout.bounds.y<group.y);
 const crowded={...group,ports:Object.fromEntries(Array.from({length:8},(_,i)=>[String(i+1),[.5+i/1e8,.5]]))},failed=portLabelLayout(crowded,Object.keys(crowded.ports).map(name=>({name})),{maxScale:2});
 assert.equal(failed.readable,false);assert.equal(failed.requiredScale,null);assert.equal(failed.requiredWidth,null);assert.equal(failed.entries.length,8);
});

test('external number edit keys and geometry remain editable in SVG, native Visio and drawing scale',async()=>{
 const device={id:'lab-switch',name:'LAB ACCESS',kind:'switch',model:'JL675A',ports:Array.from({length:52},(_,i)=>({name:'1/1/'+(i+1)}))},project={name:'Label export lab',devices:[device]},page={name:'Port layout lab',title:'Port labels',width:1200,height:600,items:[]},group=addDevice(page,project,device,[40,170,1100,1],'panel',{fitWidth:true}),layout=portLabelLayout(group,device.ports);
 for(const entry of layout.entries){const b=entry.number;label(page.items,b.x,b.y,b.w,b.h,entry.text,b.size,true,'#16364A','center');Object.assign(page.items.at(-1),{editKey:entry.editKey+'|text',portName:entry.portName,portNumberRole:'text',sourceId:group.sourceId,full:true});}
 const number=page.items.find(item=>item.portName==='1/1/49'),key=number.editKey;project.layout={drawingEdits:{[key]:{value:'WAN',w:32,x:number.x+(number.w-32)/2,color:'#AA2200'}}};applyDrawingEdits(page,project);
 const edited=page.items.find(item=>item.editKey===key);assert.equal(edited.value,'WAN');assert.ok(svgPage(page).includes('WAN'));assert.equal(edited.editKey,group.editKey+'|port-number|1/1/49|text');
 const parts=await unzip(await exportVisio(project,[page]).arrayBuffer()),xml=new TextDecoder().decode(parts.get('visio/pages/page1.xml'));assert.ok(xml.includes('WAN'));assert.ok(xml.includes('#AA2200'));assert.ok(xml.includes('<Text>'));
 const before={x:edited.x,y:edited.y,w:edited.w,h:edited.h,size:edited.size};project.layout.presentation={defaults:{drawingScale:1.5}};scalePage(page,project);
 for(const field of ['x','y','w','h','size'])assert.equal(edited[field],before[field]*1.5);
});
