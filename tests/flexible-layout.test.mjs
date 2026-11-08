import test from 'node:test';
import assert from 'node:assert/strict';
import {faceplates} from '../src/web/imports/faceplates.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {connectorEnvelope} from '../src/web/diagram/connector-geometry.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {placeDeviceTitles,intersects,pathCrossesText} from '../src/web/diagram/labels.mjs';
import {fitDynamicPage} from '../src/web/diagram/dynamic-page.mjs';
import {drawingObjects,moveDrawingItems} from '../src/web/drawing-edits.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {unpresentPatch,cleanPresentation,cleanReportPages} from '../src/web/presentation.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {unzip} from '../src/web/zip.mjs';
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-6,message||`${a} != ${b}`);
const core=site=>buildPages(site).find(p=>p.coreDeviceIds);
function glued(page){for(const cable of page.items.filter(i=>i.type==='path'))for(const [end,index] of [[cable.from,0],[cable.to,cable.points.length-1]]){if(!end?.device)continue;const body=page.items.find(i=>i.key===end.device);assert.ok(body);const point=body.ports[end.port];assert.ok(point,JSON.stringify(end));near(end.x,body.x+point[0]*body.w);near(end.y,body.y+point[1]*body.h);near(cable.points[index][0],end.x);near(cable.points[index][1],end.y);}}

test('all catalog sockets share connector proportions without overlap or changing mapped centers',()=>{
 let count=0;
 for(const profile of faceplates){const panel=deviceFaceplate({model:profile.models[0]});if(!panel)continue;const sockets=panel.children.filter(c=>c.socketPart===0);
  for(const s of sockets){const envelope=connectorEnvelope(s.socketForm);near(s.w,envelope.w);near(s.h/panel.ratio,envelope.h);if(s.anchorOrigin){near(s.x+s.w/2,s.anchorOrigin[0]);near(s.y+s.h/2,s.anchorOrigin[1]);}count++;}
  for(let i=0;i<sockets.length;i++)for(let j=i+1;j<sockets.length;j++)assert.ok(!intersects(sockets[i],sockets[j],-.0001),profile.models[0]+' '+sockets[i].anchorName+'/'+sockets[j].anchorName);
 }
 assert.ok(count>9000);
 for(const model of ['JL479A','JL581A']){const panel=deviceFaceplate({model});assert.equal(new Set(['49','50','51','52','53','54'].map(n=>JSON.stringify(panel.ports[n]))).size,6);assert.ok(panel.ports['49'][1]<panel.ports['50'][1]&&panel.ports['50'][1]<panel.ports['51'][1]);}
});

test('chassis modules and full stacks keep the same physical socket envelope',()=>{
 const chassis=deviceFaceplate({model:'J9850A',modules:[{slot:'A',model:'J9986A'},{slot:'B',model:'J9993A'}]}),stack=deviceFaceplate({model:'JL558A',stackMembers:[{id:'1',model:'JL558A'},{id:'2',model:'JL558A'}]});
 for(const panel of [chassis,stack])for(const socket of panel.children.filter(c=>c.socketPart===0)){const envelope=connectorEnvelope(socket.socketForm);near(socket.w*700,envelope.w*700);near(socket.h*700/panel.ratio,envelope.h*700);}
});

test('dynamic title placement reserves new space when all nearby positions are blocked',()=>{
 const node={type:'device',sourceId:'s',x:400,y:240,w:700,h:80,children:[]},title={type:'text',x:400,y:210,w:900,h:52,value:'A complete device title',size:24,titleOwner:'s',editKey:'test|title|s'},blocker={type:'text',x:0,y:0,w:1600,h:1200,value:'occupied',size:12},cable={type:'path',points:[[0,200],[1700,200],[1700,900]]},page={name:'test',width:1200,height:975,dynamic:true,items:[node,title,blocker,cable]};
 placeDeviceTitles(page,{layout:{}},new Map([['s',node]]));fitDynamicPage(page,{});
 assert.ok(!intersects(title,node)&&!intersects(title,blocker)&&!pathCrossesText(cable,title));assert.ok(page.width>1200||page.originX<0||page.originY<0);assert.ok(title.x>=page.originX&&title.x+title.w<=page.originX+page.width);assert.equal(title.value,'A complete device title');
});

test('large text and small devices rebuild on a single growing network page',()=>{
 const site=sampleSite();site.layout={includeAPs:true,presentation:{defaults:{deviceScale:.35,textScale:2.5}}};for(const d of site.devices)d.name='LAB-BUILDING-NETWORK-DEVICE-'+d.id;
 const page=core(site);assert.equal(page.coreDeviceIds.length,site.devices.length);glued(page);const titles=page.items.filter(i=>i.titleOwner);for(const title of titles)assert.ok(page.items.filter(i=>i.type==='device').every(d=>!intersects(title,d,2)));
});

test('drawing, device and text scales survive save/reopen with glued endpoints and inverse edits',()=>{
 const site=sampleSite(),base=core(site),original=base.items.find(i=>i.sourceId==='sw-1'&&i.kind==='switch');
 site.layout={presentation:{defaults:{drawingScale:1.5,deviceScale:1.2,textScale:1.3},pages:{'Core Network':{panel:{scale:.7,textScale:1.1,position:'right',sections:['connections','modules','vlans','notes'],notes:'Lab panel'}}}}};site.devices.find(d=>d.id==='sw-1').scale=.8;
 site.layout=cleanLayout(JSON.parse(JSON.stringify(site.layout)),site.devices.map(d=>d.id));let page=core(site),body=page.items.find(i=>i.editKey===original.editKey);near(body.w,original.w*1.5*1.2*.8);glued(page);
 const legend=page.items.find(i=>i.panelGroup&&i.type==='text'&&i.value==='Lab panel'),objects=[body,legend];
 for(const item of objects){site.layout.drawingEdits=moveDrawingItems(page,site.layout.drawingEdits,new Map([[item.editKey,[42,31]]]));page=core(site);const moved=page.items.find(i=>i.editKey===item.editKey);near(moved.x,item.x+42);near(moved.y,item.y+31);glued(page);}
 body=page.items.find(i=>i.editKey===original.editKey);site.layout.drawingEdits[body.editKey]={...site.layout.drawingEdits[body.editKey],...unpresentPatch(body,{w:body.w*1.1,h:body.h*1.1})};page=core(site);near(page.items.find(i=>i.editKey===body.editKey).w,body.w*1.1);glued(page);
 const restored=core(JSON.parse(JSON.stringify(site)));assert.equal(restored.svg,page.svg);
});

test('page aliases preserve edit keys, appear in native Visio and hidden tabs use continuous numbering',async()=>{
 const site=sampleSite(),before=buildPages(site),first=before[0],body=first.items.find(i=>i.kind==='switch');site.layout={presentation:{pages:{[first.name]:{name:'Campus network'},[before[1].name]:{hidden:true}}},drawingEdits:{[body.editKey]:{x:body.x+90}}};
 const pages=buildPages(site);assert.equal(pages.length,before.length-1);assert.equal(pages[0].name,first.name);assert.equal(pages[0].displayName,'Campus network');near(pages[0].items.find(i=>i.editKey===body.editKey).x,body.x+90);
 pages.forEach((p,i)=>assert.equal(p.items.find(t=>t.pageFrame==='footer-number').value,String(i+1).padStart(2,'0')+' / '+String(pages.length).padStart(2,'0')));
 const parts=await unzip(await exportVisio(site,pages).arrayBuffer());assert.match(new TextDecoder().decode(parts.get('visio/pages/pages.xml')),/Name="Campus network"/);
 const heading=pages[0].items.find(i=>i.pageTitle);site.layout.drawingEdits[heading.editKey]={value:'Custom drawing heading'};const edited=core(site);assert.equal(edited.displayName,'Campus network');assert.equal(edited.items.find(i=>i.pageTitle).value,'Custom drawing heading');
});

test('selected report devices and edits remain independent of the automatic report',()=>{
 const site=sampleSite();site.layout={reportPages:[{id:'access',name:'Access VLANs',family:'logical',devices:['sw-1']},{id:'ports',name:'Access ports',family:'ports',devices:['sw-1']}]};let pages=buildPages(site);
 const report=pages.find(p=>p.reportId==='access'),cell=report.items.find(i=>i.logicalColumn===1);assert.ok(report.logicalSections.every(s=>s.deviceId==='sw-1'));assert.ok(cell.editKey.startsWith('report:access|'));
 site.layout.drawingEdits={[cell.editKey]:{value:'Custom report description'}};pages=buildPages(site);assert.ok(pages.find(p=>p.reportId==='access').svg.includes('Custom report description'));assert.ok(!pages.find(p=>p.title==='VLANs and Routing'&&!p.reportId).svg.includes('Custom report description'));
 for(const page of pages.filter(p=>p.reportId==='ports'))assert.ok(page.items.filter(i=>i.kind==='switch').every(i=>i.sourceId==='sw-1'&&i.editKey.startsWith('report:ports|')));
});

test('scaled table text expands rows and remains independently editable',()=>{
 const site=sampleSite();site.layout={presentation:{pages:{'VLANs and Routing':{textScale:2}}}};let page=buildPages(site).find(p=>p.title==='VLANs and Routing'),cell=page.items.find(i=>i.logicalRecord===0&&i.logicalColumn===1);
 const cells=page.items.filter(i=>i.logicalRecord!=null);for(const c of cells)for(const other of cells)if(c!==other)assert.ok(!intersects(c,other),c.value+' / '+other.value);
 site.layout.drawingEdits=moveDrawingItems(page,{},new Map([[cell.editKey,[80,40]]]));page=buildPages(site).find(p=>p.title==='VLANs and Routing');const moved=page.items.find(i=>i.editKey===cell.editKey);near(moved.x,cell.x+80);near(moved.y,cell.y+40);
});

test('panel options select content and the dynamic module panel grows rather than splitting',()=>{
 const site=sampleSite();site.layout={presentation:{defaults:{panel:{position:'left',width:350,scale:1.4,sections:['vlans','addresses','models','routes','ports','notes'],notes:'Maintenance details'}}}};
 const page=core(site);assert.ok(page.items.some(i=>i.value==='Maintenance details'));assert.ok(!page.items.some(i=>i.moduleLegend||i.legendEntry));for(const name of ['VLANS','DEVICE ADDRESSES','DEVICE DETAILS','ROUTES','PORT DETAILS'])assert.ok(page.items.some(i=>i.value===name),name);
 const plain=sampleSite(),key=core(plain).items.find(i=>i.moduleLegend&&i.editKey.endsWith('|ports')).editKey;plain.layout={drawingEdits:{[key]:{value:Array.from({length:250},(_,i)=>'Interface'+i).join(' ')}}};const pages=buildPages(plain);assert.ok(!pages.some(p=>p.title==='Port modules'));assert.equal(pages.flatMap(p=>p.items).filter(i=>i.editKey===key).length,1);
});

test('port-map text scales its table spacing without stretching the hardware or its anchors',()=>{
 const site=sampleSite(),before=buildPages(site).find(p=>p.portMap);site.layout={presentation:{defaults:{textScale:2}}};let page=buildPages(site).find(p=>p.portMap),body=page.items.find(i=>i.kind==='switch'),original=before.items.find(i=>i.editKey===body.editKey);near(body.w,original.w);near(body.h,original.h);assert.deepEqual(body.ports,original.ports);
 page=buildPages(site).find(p=>p.portMap?.bookletRole==='inventory');
 const cells=page.items.filter(i=>i.tableContent&&i.type==='text');for(const cell of cells)for(const other of cells)if(cell!==other)assert.ok(!intersects(cell,other),cell.value+' / '+other.value);
 const cell=cells.find(i=>i.portTableRole);site.layout.drawingEdits=moveDrawingItems(page,{},new Map([[cell.editKey,[30,20]]]));page=buildPages(site).find(p=>p.portMap?.bookletRole==='inventory');const moved=page.items.find(i=>i.editKey===cell.editKey);near(moved.x,cell.x+30);near(moved.y,cell.y+20);
});

test('invalid saved presentation and report fields are bounded',()=>{
 const clean=cleanPresentation(JSON.parse('{"defaults":{"drawingScale":0,"textScale":9999},"pages":{"__proto__":{"name":"bad"},"Core Network":{"panel":{"width":-1}}}}'));assert.equal(clean.defaults.drawingScale,1);assert.equal(clean.defaults.textScale,1);assert.ok(!Object.hasOwn(clean.pages,'__proto__'));assert.equal(clean.pages['Core Network'].panel.width,244);
 assert.deepEqual(cleanReportPages([{id:'a',family:'ports',devices:'invalid'}],['s'])[0].devices,[]);assert.doesNotThrow(()=>buildPages({layout:{reportPages:[{id:'a',family:'ports',devices:[]}]}}));
});

test('automatic report panels follow the devices on their particular sheet',()=>{
 const site=sampleSite();site.layout={presentation:{defaults:{panel:{sections:['models'],position:'right'}}}};
 const pages=buildPages(site),port=pages.find(p=>p.portMap),wireless=pages.find(p=>p.title==='Wireless Connections'),logical=pages.find(p=>p.logicalSections),trunk=pages.find(p=>p.title==='Trunk VLANs');
 for(const page of [port,wireless,logical,trunk]){const ids=page.sourceDeviceIds||page.portMap?.devices||page.logicalSections?.map(s=>s.deviceId)||page.items.filter(i=>i.type==='device'&&i.kind!=='plug').map(i=>i.sourceId),actual=page.items.filter(i=>/\|info-panel\|models\|\d+$/.test(i.editKey)).map(i=>i.value.split(' · ')[0]);assert.deepEqual(new Set(actual),new Set(site.devices.filter(d=>ids.includes(d.id)).map(d=>d.name)));}
 const unlinked=site.devices.find(d=>d.kind==='ap');site.links=site.links.filter(l=>l.a!==unlinked.id&&l.b!==unlinked.id);const page=buildPages(site).find(p=>p.title==='Wireless Connections'&&p.sourceDeviceIds?.includes(unlinked.id));assert.ok(page);assert.deepEqual(page.items.filter(i=>/\|info-panel\|models\|\d+$/.test(i.editKey)).map(i=>i.value.split(' · ')[0]),[unlinked.name]);
});
