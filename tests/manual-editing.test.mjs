import test from 'node:test';import assert from 'node:assert/strict';
import {addCableBends,moveCablePoint,removeCablePoint,validCable} from '../src/web/cable-edit.mjs';
import {movementStep,selectedInBox,moveAnchors} from '../src/web/point-tools.mjs';
import {parseHex,rgb,rgbHex,toHSV,hsvHex,toHSL,hslHex} from '../src/web/color-picker.mjs';
import {comparePorts,hasPortDetails} from '../src/web/port-table.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {unzip} from '../src/web/zip.mjs';
import {connectionPorts,checkConnection,sameConnection} from '../src/web/connection-edit.mjs';
import {bridge,svgPage} from '../src/web/diagram/scene.mjs';
import {textWidth} from '../src/web/diagram/labels.mjs';
const orthogonal=(next,original)=>{assert.ok(validCable(next));assert.deepEqual(next[0],original[0]);assert.deepEqual(next.at(-1),original.at(-1));};
test('bend insertion, free point dragging and removal preserve port endpoints and orthogonal legs',()=>{
 for(const original of [[[0,0],[100,0]],[[0,0],[0,100]],[[0,0],[0,30],[100,30],[100,100]]]){
  const added=addCableBends(original,0,20);orthogonal(added,original);assert.ok(added.length>original.length);
  for(let i=1;i<added.length-1;i++)for(const [dx,dy] of [[7,13],[-10,0],[0,-30]])orthogonal(moveCablePoint(added,i,added[i][0]+dx,added[i][1]+dy),original);
  const removed=removeCablePoint(added,2);orthogonal(removed,original);assert.ok(removed.length<added.length);
 }
 assert.throws(()=>moveCablePoint([[0,0],[0,100]],0,10,10),/endpoint/);assert.throws(()=>removeCablePoint([[0,0],[0,100],[100,100]],1),/needed/);
 assert.ok(!validCable([[0,0],[1,1]]));assert.ok(!validCable([[0,0],[NaN,0]]));
});
test('box selection works in either drag direction and group nudges preserve spacing at boundaries',()=>{
 const points={p1:[.1,.2],p2:[.2,.2],p3:[.8,.2],p4:[.3,.7]};assert.deepEqual(selectedInBox(points,[.25,.3],[.05,.1]),['p1','p2']);
 const moved=moveAnchors(points,['p1','p2'],1,-1);assert.deepEqual(moved.p1,[.9,0]);assert.deepEqual(moved.p2,[1,0]);assert.deepEqual(moved.p3,points.p3);assert.deepEqual(points.p1,[.1,.2]);
 assert.equal(movementStep({}),1);assert.equal(movementStep({shiftKey:true}),10);assert.equal(movementStep({ctrlKey:true}),.1);assert.equal(movementStep({metaKey:true}),.1);
});
test('color formats round trip across hue sectors and accept only valid solid colors',()=>{
 assert.equal(parseHex(' abc '),'#AABBCC');assert.equal(parseHex('url(bad)'),null);assert.equal(parseHex('#AABBCCDD'),null);
 for(const color of ['#000000','#FFFFFF','#C32B65','#00B0F0','#FFD965','#123456','#112233','#808080','#00FF00']){assert.equal(rgbHex(...rgb(color)),color);assert.equal(hsvHex(...toHSV(color)),color);assert.equal(hslHex(...toHSL(color)),color);}
});
test('the legend contains only styles used on this sheet, including edited color and opacity',async()=>{
 const site=sampleSite(),p=buildPages(site)[0],cable=p.items.find(i=>i.type==='path'&&i.linkType==='SR fiber');assert.ok(cable);
 assert.ok(!p.items.some(i=>i.legendEntry&&i.value==='LR fiber'));
 site.layout={drawingEdits:{[cable.editKey]:{color:'#815AC0',opacity:.6}}};const pages=buildPages(JSON.parse(JSON.stringify(site))),next=pages[0],used=new Set(next.items.filter(i=>i.type==='path').map(i=>i.color.toUpperCase()+'|'+(i.opacity??1))),shown=new Set(next.items.filter(i=>i.legendEntry&&i.type==='rect').map(i=>i.fill+'|'+(i.opacity??1)));
 assert.deepEqual(shown,used);assert.ok(next.svg.includes('stroke="#815AC0" stroke-opacity="0.6"'));assert.ok(next.svg.includes('fill="#815AC0" fill-opacity="0.6"'));
 for(const page of pages.filter(p=>p.title==='Wireless Connections'))assert.deepEqual(page.items.filter(i=>i.legendEntry&&i.type==='text').map(i=>i.value),['AP copper']);
 const files=await unzip(await exportVisio(site,pages).arrayBuffer()),xml=new TextDecoder().decode(files.get('visio/pages/page1.xml'));assert.match(xml,/<Cell N="LineColorTrans" V="0.4"/);assert.match(xml,/#815AC0/);
});
test('port details remain in numeric member/slot/port order, with persistent optional filters',()=>{
 const d={id:'s',name:'LAB',kind:'switch',model:'JL724A',ports:[{name:'1/1/10'},{name:'1/1/3',native:12},{name:'1/1/2',description:'Printer'},{name:'1/1/1',state:'down'},{name:'1/1/11',role:'uplink'}]},site={devices:[d],links:[],layout:{portMap:{detailFilter:'assigned',groupConsecutive:false}}};
 assert.deepEqual(d.ports.slice().sort(comparePorts).map(p=>p.name),['1/1/1','1/1/2','1/1/3','1/1/10','1/1/11']);assert.equal(hasPortDetails({name:'1',state:'up',speed:'1G'}),false);
 site.layout=cleanLayout(site.layout,['s']);const maps=buildPages(JSON.parse(JSON.stringify(site))).filter(p=>p.portMap);assert.deepEqual(maps.flatMap(p=>p.portMap.rowNames),['1/1/2','1/1/3','1/1/11']);assert.equal(maps[0].portMap.total,5);assert.equal(maps[0].portMap.shown,3);
 assert.ok(maps.some(p=>p.items.some(i=>i.type==='text'&&i.value.includes('2 hidden by table filter'))));
 site.layout.portMap.detailFilter='connected';assert.deepEqual(buildPages(site).filter(p=>p.portMap).flatMap(p=>p.portMap.rowNames),['1/1/2']);
 site.layout.portMap={detailFilter:'all',groupConsecutive:true};const grouped=buildPages(site).filter(p=>p.portMap).flatMap(p=>p.items.filter(i=>i.portTableRole==='interface').map(i=>i.value));assert.ok(grouped.includes('1, 10'));assert.ok(!grouped.some(n=>n.includes('10, 1')));
});
test('compact port maps reduce pages without omitting records and keep the faceplate optional on continuations',()=>{
 const ports=Array.from({length:96},(_,i)=>({name:'1/1/'+(i+1),description:'Workstation '+(i+1),state:'up',speed:'1 Gbps',role:'access',native:8,tagged:[20]})),site={devices:[{id:'s',name:'LAB',kind:'switch',model:'JL675A',ports}],links:[]};
 const maps=()=>buildPages(site).filter(p=>p.portMap),compact=maps();site.layout={portMap:{density:'expanded'}};const expanded=maps();assert.ok(compact.length<expanded.length);assert.ok(compact.filter(p=>p.portMap.bookletRole==='inventory').length<=4);
 assert.deepEqual(compact.flatMap(p=>p.portMap.rowNames),ports.map(p=>p.name));assert.equal(compact[0].portMap.overview,true);assert.ok(compact.slice(1).every(p=>!p.portMap.overview&&!p.items.some(i=>i.type==='device')));
 site.layout=cleanLayout({portMap:{density:'compact',repeatFaceplate:true}},['s']);assert.equal(site.layout.portMap.repeatFaceplate,true);assert.ok(maps().every(p=>p.portMap.overview&&p.items.some(i=>i.type==='device')));
 for(const page of [...compact,...expanded])for(const t of page.items.filter(i=>i.portTableRole)){assert.ok(textWidth(t.value,t.size,t.bold)<=t.w,t.value+' is wider than its column');assert.ok(t.y+t.h<=851);}
});
test('long port records retain every word across pages and oversized repeated faceplates still allow detail pages',()=>{
 const description=Array.from({length:160},(_,i)=>'Description'+i).join(' '),site={devices:[{id:'s',name:'LAB',kind:'switch',ports:[{name:'1/1/1',description}]}],links:[],layout:{portMap:{repeatFaceplate:true}}};
 const first=buildPages(site).find(p=>p.portMap),panel=first.items.find(i=>i.type==='device');site.layout.drawingEdits={[panel.editKey]:{y:780,h:75}};
 const pages=buildPages(JSON.parse(JSON.stringify(site))).filter(p=>p.portMap);assert.ok(pages.length>1&&pages.length<8);assert.equal(pages[0].portMap.rowNames.length,0);assert.ok(pages.slice(1).every(p=>!p.portMap.overview));
 const text=pages.flatMap(p=>p.items.filter(i=>i.portTableRole==='detail').map(i=>i.value)).join(' ');for(const word of description.split(' '))assert.ok(text.includes(word));
 for(const t of pages.flatMap(p=>p.items.filter(i=>i.portTableRole)))assert.ok(textWidth(t.value,t.size,t.bold)<=t.w);
});
test('endpoint selectors include unused model jacks and reject an occupied port alias',()=>{
 const d={id:'s',kind:'switch',model:'JL724A',ports:[{name:'1/1/1'},{name:'1/1/25'}]},site={devices:[d,{id:'f',kind:'firewall',model:'FortiGate 120G',ports:[{name:'x1'}]}],links:[{a:'s',ap:'1/1/25',b:'f',bp:'x1'}]};
 const ports=connectionPorts(site,d);assert.ok(ports.some(p=>p.name==='1/1/26'));assert.ok(!ports.some(p=>p.name==='25'));
 assert.throws(()=>checkConnection(site,{a:'s',ap:'25',b:'f',bp:'x2'}),/already connected/);
 assert.doesNotThrow(()=>checkConnection(site,{a:'s',ap:'1/1/26',b:'f',bp:'x2'}));
 assert.ok(sameConnection(site.links[0],{a:'f',ap:'X1',b:'s',bp:'1/1/25'}));
 assert.ok(buildPages(sampleSite())[0].items.filter(i=>i.type==='path').every(i=>i.sourceLink));
 const manual=sampleSite(),handoff=buildPages(manual)[0].items.find(i=>i.type==='path'&&i.generatedDevice);assert.ok(handoff);
 manual.devices.push(handoff.generatedDevice);manual.links.push({...handoff.sourceLink,bp:'port3'});
 const sources=buildPages(JSON.parse(JSON.stringify(manual))).filter(p=>p.title.startsWith('Core Network')).flatMap(p=>p.items.filter(i=>i.type==='path').map(i=>i.sourceLink));
 assert.equal(sources.filter(l=>l.a===handoff.generatedDevice.id||l.b===handoff.generatedDevice.id).length,1);assert.ok(sources.some(l=>l.bp==='port3'));
});
test('crossing hops have visible clearance, scale to nearby crossings, and skip shared endpoints',async()=>{
 const line=(points,color)=>({type:'path',points,color,name:'Test',weight:2.2}),p={title:'Crossing',items:[line([[0,20],[100,20]],'#FF0000'),line([[30,0],[30,60]],'#00B0F0'),line([[34,0],[34,60]],'#00B050'),line([[0,20],[0,60]],'#000000')]};
 bridge(p);assert.ok(p.items[1].commands.some(c=>c[0]==='A'));assert.equal(p.items[3].hops.length,0);assert.match(svgPage(p),/class="link-hop-clearance"/);assert.ok(p.items[1].hops[0].w>5);
 p.items[1].points=[[30,0],[30,10]];bridge(p);assert.equal(p.items[1].hops.length,0);
 const site=sampleSite(),files=await unzip(await exportVisio(site,buildPages(site)).arrayBuffer()),pages=new TextDecoder().decode(files.get('visio/pages/pages.xml')),content=new TextDecoder().decode(files.get('visio/pages/page1.xml'));
 assert.match(pages,/<Cell N="LineJumpCode" V="4"/);assert.match(pages,/<Cell N="LineJumpStyle" V="1"/);assert.match(content,/<Cell N="ConLineJumpCode" V="0"/);assert.match(content,/<Cell N="ConLineJumpStyle" V="1"/);
});
