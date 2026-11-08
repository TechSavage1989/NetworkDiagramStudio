import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {switchportCatalog} from '../src/web/reports/catalog-data.mjs';
import {buildReportPackage,buildSwitchportReports,inventoryForDevice,validateInventory,reportRequest,sharedReportPalette,colorDifference} from '../src/web/reports/index.mjs';
import {lab,labDistance,luminance} from '../src/web/reports/palette.mjs';
import {validateReportScene,reportPaper} from '../src/web/reports/scene.mjs';
import {svgPage} from '../src/web/diagram/scene.mjs';
import {intersects} from '../src/web/diagram/labels.mjs';
import {exportVisio} from '../src/web/diagram/visio.mjs';
import {unzip} from '../src/web/zip.mjs';

function access(id='sw-1',name='LAB ACCESS'){
 return {id,name,kind:'switch',model:'JL675A',ports:[{name:'1/1/1',native:10,tagged:[20],voice:30,lag:' Trk1 ',description:'Desk and phone'},{name:'1/1/2',native:null,nativeState:'none'},{name:'1/1/3'},{name:'1/1/4',stackLink:true},{name:'1/1/5',native:10,disabled:true},{name:'1/1/6',native:10,tagged:['all']}],vlans:[{id:10,name:'Data'},{id:20,name:'Guest'},{id:30,name:'Voice',voice:true}],reportDetails:[{id:'1',name:'LAB ACCESS',serialNumber:'LAB-SN-100',assetTag:'LAB-ASSET-10',notes:'Lab reference only.'}]};
}
const project=devices=>({name:'Switchport reference lab',devices,layout:{switchport:{enabled:true}}});
function png(width,height){
 const crc=data=>{let result=-1;for(const byte of data){result^=byte;for(let bit=0;bit<8;bit++)result=result&1?0xedb88320^(result>>>1):result>>>1;}return (result^-1)>>>0;},chunk=(name,data)=>{const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([type,data])),8+data.length);return out;};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;const pixels=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=y*(width*4+1)+1+x*4;pixels[at+3]=x>width/4&&x<width*3/4?255:0;}
 return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}

test('all native catalog inventories retain complete socket identities and explicit model/module changes take precedence',()=>{
 for(const choice of [...switchportCatalog.models,...switchportCatalog.additionalModels]){const inv=inventoryForDevice({id:'lab',name:'LAB',model:choice.sku,kind:'switch'}),validation=validateInventory(inv);assert.ok(validation.ok,choice.sku+': '+validation.errors.join('; '));}
 const d={id:'chassis',name:'LAB CHASSIS',kind:'switch',model:'J9850A',modules:[{slot:'A',model:'J9993A'}],reportDetails:[{id:'1',serialNumber:'LAB-SN'},{id:'1/A',serialNumber:'LAB-MODULE-SN',modelSelection:'J9993A'}]},retained=inventoryForDevice(d),removed=inventoryForDevice({...d,modules:[],switchportInventory:retained});
 assert.equal(retained.ports.length,8);assert.equal(removed.ports.length,0);assert.equal(removed.logicalInterfaces.length,8);assert.equal(removed.devices.find(detail=>detail.id==='1/A').kind,'Unassigned');assert.equal(removed.devices.find(detail=>detail.id==='1/A').serialNumber,'LAB-MODULE-SN');
 const explicit=inventoryForDevice({...access(),stackMembers:[],modules:[],reportDetails:[{id:'1',modelSelection:'JL558A',moduleSelections:[{slot:'A',sku:'J9993A'}]}]});assert.deepEqual(explicit.groups.map(group=>group.product),['JL675A']);
 const cisco=inventoryForDevice({id:'cisco',name:'LAB CISCO',model:'C9300-48P',modules:[{slot:'NM',model:'C9300-NM-8X'}]});assert.ok(validateInventory(cisco).ok);assert.equal(cisco.ports.filter(port=>port.group.includes('NM')).length,8);
});

test('native, tagged, voice, LAG, stack, none, unknown and disabled state have complete distinct report symbols',()=>{
 const site=project([access()]),before=JSON.stringify(site),bundle=buildReportPackage(site),item=bundle.items[0],page=item.onePage[0];assert.ok(item.validation.ok);assert.equal(item.filenames.length,8);assert.equal(page.reportSockets.length,52);assert.equal(page.items.filter(item=>item.portNumberRole==='text').length,52);assert.equal(JSON.stringify(site),before);
 const face=name=>page.items.find(item=>item.reportPort===name&&item.reportPortRole==='native');assert.equal(face('1/1/1').fill,bundle.palette.vlans[10]);assert.equal(face('1/1/2').fill,'#ffffff');assert.equal(face('1/1/3').fill,'#e6e6e6');assert.equal(face('1/1/4').fill,'#000000');assert.equal(face('1/1/1').stroke,bundle.palette.aggregates.TRK1);
 assert.ok(page.items.some(item=>item.reportPort==='1/1/1'&&item.reportPortRole==='tagged'&&item.type==='ellipse'));assert.ok(page.items.some(item=>item.reportPort==='1/1/1'&&item.reportPortRole==='voice'&&item.type==='vector'));assert.ok(page.items.some(item=>item.reportPortRole==='disabled'&&item.value==='!'));assert.ok(page.items.some(item=>item.reportPortRole==='policy'&&item.value==='*'));assert.ok(page.items.some(item=>item.value==='LAG / trunk TRK1'));assert.deepEqual(validateReportScene(page),[]);
 for(const label of page.reportNumberBoxes)for(const socket of page.reportSockets)assert.ok(!intersects(label,socket,.5));
});

test('eight-member 416-port A4 maps compact proportionally without losing external labels or splitting a complete shared configuration',()=>{
 const d={id:'stack',name:'LAB STACK',kind:'switch',model:'JL558A',hardwareComposition:{stackMembers:Array.from({length:8},(_,index)=>({id:String(index+1),model:'JL558A'}))}},bundle=buildReportPackage(project([d])),item=bundle.items[0],p=item.onePage[0];
 assert.ok(item.validation.ok);assert.equal(item.capacityError,'');assert.equal(item.inventory.ports.length,416);assert.equal(p.reportSockets.length,416);assert.equal(p.items.filter(item=>item.portNumberRole==='text').length,416);assert.equal(p.width,reportPaper.width);assert.equal(p.height,reportPaper.height);assert.ok(p.reportGeometryScale<1);assert.ok(p.items.filter(item=>item.type==='text').every(item=>item.size>=8));assert.deepEqual(validateReportScene(p),[]);assert.equal(bundle.combined.pages.length,1);assert.equal(bundle.combined.pages[0].reportSockets.length,416);
 const chassis={id:'chassis',name:'LAB CHASSIS',kind:'switch',model:'J9850A',modules:['A','B','C','D','E','F'].map((slot,index)=>({slot,model:index%2?'J9987A':'J9993A'}))},map=buildReportPackage(project([chassis])).items[0].onePage[0];assert.equal(map.reportSockets.length,96);assert.equal(new Set(map.reportSockets.map(socket=>socket.group)).size,6);assert.deepEqual(validateReportScene(map),[]);
});

test('workspace colors use semantic identities, preserve aliases and native subset exports, and retain inactive overrides',()=>{
 const a=access(),b=access('sw-2','LAB ACCESS');b.ports[0].lag='trk1';b.vlans[0].name='Office';b.vlans.push({id:99,name:'Lab storage'});const site=project([a,b]),bundle=buildReportPackage(site),full=reportRequest(site),subset=reportRequest(site,['sw-1']);
 assert.equal(bundle.items[0].folder,'LAB ACCESS');assert.equal(bundle.items[1].folder,'LAB ACCESS (2)');assert.deepEqual(bundle.palette.aliases[10],['Data','Office']);assert.equal(Object.keys(bundle.palette.aggregates).length,1);assert.equal(subset.palette.vlans['vlan:10'],full.palette.vlans['vlan:10']);assert.equal(subset.palette.aggregates.TRK1,full.palette.aggregates.TRK1);assert.ok(!subset.palette.vlans['vlan:99']);
 const outline=bundle.palette.aggregates.TRK1;assert.ok(labDistance(lab(outline),lab(bundle.palette.vlans[10]))>=35);assert.ok(1.05/(luminance(outline)+.05)>=3);assert.ok(Math.abs(colorDifference([50,2.6772,-79.7751],[50,0,-82.7485])-2.0425)<.0001);
 site.layout.switchport={...site.layout.switchport,deviceIds:['sw-1'],palette:{vlans:{'vlan:10':bundle.palette.vlans[10],'vlan:99':bundle.palette.vlans[99]},aggregates:{TRK1:outline,UNUSED:'#033399'}}};assert.equal(reportRequest(site).palette.vlans['vlan:10'],bundle.palette.vlans[10]);assert.ok(!reportRequest(site).palette.vlans['vlan:99']);assert.ok(site.layout.switchport.palette.vlans['vlan:99']);
});

test('long descriptions and identification notes continue intact with stable per-record keys',()=>{
 const d=access(),words=Array.from({length:450},(_,index)=>'Detail'+index);d.ports[0].description=words.join(' ');d.reportDetails[0].notes=Array.from({length:300},(_,index)=>'AssetNote'+index).join(' ');const item=buildReportPackage(project([d])).items[0];assert.ok(item.validation.ok,item.validation.errors.join('; '));assert.ok(item.booklet.length>5);
 const detail=item.booklet.flatMap(page=>page.items.filter(item=>item.reportTableRole==='description').map(item=>item.value)).join(' '),notes=item.booklet.flatMap(page=>page.items.filter(item=>item.reportTableRole==='value').map(item=>item.value)).join(' ');for(const word of words)assert.ok(detail.includes(word),word);assert.ok(notes.includes('AssetNote299'));assert.ok(item.csv.includes('Detail449'));assert.ok(item.summary.includes('AssetNote299'));
 const keys=item.booklet.flatMap(page=>page.items.filter(item=>item.reportTableRole).map(item=>item.editKey));assert.equal(new Set(keys).size,keys.length);for(const page of item.booklet)assert.deepEqual(validateReportScene(page),[]);
});

test('disabled supplementary sources remove stale snapshots without altering configured VLAN or aggregate intent',()=>{
 const d=access(),inventory=inventoryForDevice(d),port=inventory.ports.find(port=>port.id==='1/1/1');port.connectedDevice='Observed: OLD-LAB-PEER';port.liveState='Observed: Down';port.speed='Observed: 100 Mbps';port.notes.push('Supplementary (old): Connected device: OLD-LAB-PEER');inventory.assumptions.push('Supplementary observations from old are snapshots.');
 d.switchportInventory=inventory;Object.assign(d.ports[0],{connectedDevice:port.connectedDevice,state:port.liveState,speed:port.speed,notes:[...port.notes]});d.reportSupplementary=[{id:'old',name:'Old lab snapshot',enabled:false,observations:[{category:'Interface',interface:'1/1/1',field:'Operational status',value:'Down'}]},{id:'new',name:'New lab snapshot',kind:'Command output',observations:[{category:'Interface',interface:'1/1/1',field:'Operational status',value:'Up'},{category:'Neighbor',interface:'1/1/1',field:'Connected device',value:'NEW-LAB-PEER'},{category:'VLAN',interface:'1/1/1',field:'Native VLAN',value:'99'}]}];
 const site=project([d]),before=JSON.stringify(site),request=reportRequest(site);assert.equal(request.items[0].supplementary.length,1);const result=buildReportPackage(site).items[0],current=result.inventory.ports.find(port=>port.id==='1/1/1');assert.equal(current.liveState,'Observed: Up');assert.equal(current.connectedDevice,'Observed: NEW-LAB-PEER');assert.equal(current.untaggedVlan,10);assert.equal(current.aggregate,'Trk1');assert.ok(!result.summary.includes('OLD-LAB-PEER'));assert.equal(JSON.stringify(site),before);
});

test('wide and tall transparent logos retain aspect ratio, white padding and clear full titles',()=>{
 for(const [w,h] of [[480,60],[60,480]]){const site=project([access()]);site.devices[0].name=Array.from({length:12},(_,index)=>'Equipment'+index).join(' ');site.devices[0].reportDetails=[];site.layout.switchport.logoDataUrl=png(w,h);const page=buildReportPackage(site).items[0].onePage[0],logo=page.items.find(item=>item.kind==='logo'),back=page.items.find(item=>item.reportLogoBacking);assert.ok(page);assert.equal(back.fill,'#ffffff');assert.ok(back.x<logo.x&&back.y<logo.y&&back.x+back.w>logo.x+logo.w&&back.y+back.h>logo.y+logo.h);assert.ok(Math.abs(logo.w/logo.h-w/h)<1e-8);for(const text of page.items.filter(item=>item.type==='text'&&item.y<page.contentTop))assert.ok(!intersects(text,back));assert.deepEqual(validateReportScene(page),[]);}
});

test('configured administrative intent stays separate from operational state with explicit precedence',()=>{
 const d=access();d.ports=[{name:'1/1/1',admin:'down',state:'up'},{name:'1/1/2',admin:'up',state:'down'},{name:'1/1/3',state:'down'},{name:'1/1/4',admin:'down',adminState:'up'},{name:'1/1/5',disabled:false,admin:'down',adminState:'down'},{name:'1/1/6',admin:'disable'},{name:'1/1/7',admin:'enable'}];const inv=inventoryForDevice(d),ports=inv.ports.slice(0,7);assert.deepEqual(ports.map(port=>port.disabled),[true,false,null,false,false,true,false]);assert.deepEqual(ports.slice(0,3).map(port=>port.liveState),['up','down','down']);
});

test('optional VLAN voice metadata survives normalized overlays while explicit edits take precedence',()=>{
 const d=access();d.switchportInventory=inventoryForDevice(d);delete d.vlans[2].voice;assert.equal(inventoryForDevice(d).vlans.find(vlan=>vlan.id===30).voice,true);d.vlans[2].voice=false;assert.equal(inventoryForDevice(d).vlans.find(vlan=>vlan.id===30).voice,false);d.vlans[2].voice=true;assert.equal(inventoryForDevice(d).vlans.find(vlan=>vlan.id===30).voice,true);
});

test('long LAG titles reserve their own lines and shared or combined booklets have independent complete page counts',()=>{
 const d=access(),lag=Array.from({length:12},(_,index)=>'UplinkSegment'+index).join(' ');d.ports[0].lag=lag;const stack={id:'stack',name:'LAB STACK',kind:'switch',model:'JL558A',hardwareComposition:{stackMembers:Array.from({length:8},(_,index)=>({id:String(index+1),model:'JL558A'}))}},bundle=buildReportPackage(project([d,stack])),page=bundle.items[0].onePage[0],title=page.items.find(item=>item.reportKeyTitle?.startsWith?.('lag:')),names=page.items.find(item=>item.reportKeyNames===title.reportKeyTitle);assert.ok(title.h>12);assert.ok(names.y>=title.y+title.h);assert.deepEqual(validateReportScene(page),[]);
 const numbered=pages=>pages.forEach((page,index)=>assert.equal(page.items.find(item=>item.reportFooterRole==='page').value,(index+1)+' / '+pages.length));assert.equal(bundle.combined.pages.length,2);numbered(bundle.combined.pages);numbered(bundle.combined.booklet);for(const item of bundle.items){numbered(item.booklet);assert.equal(item.onePage[0].items.find(row=>row.reportFooterRole==='page').value,'1 / 1');}
});

test('report SVG and native Visio preserve editable ellipse and voice geometry, and default selection never silently truncates',async()=>{
 const bundle=buildReportPackage(project([access()])),page=bundle.items[0].onePage[0],svg=svgPage(page);assert.ok(svg.includes('<ellipse'));assert.ok(svg.includes('VLAN 30 voice'));const bytes=new Uint8Array(await exportVisio({},[page]).arrayBuffer()),parts=await unzip(bytes.buffer),xml=new TextDecoder().decode(parts.get('visio/pages/page1.xml'));assert.ok(xml.includes('T="Ellipse"'));assert.ok(xml.includes('VLAN 30 voice'));assert.ok(xml.includes('<Text>'));
 const folder=mkdtempSync(join(tmpdir(),'nds-report-scenes-'));try{const file=join(folder,'report.vsdx');writeFileSync(file,bytes);const result=spawnSync('python',['scripts/check-visio-package.py',file],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);}finally{rmSync(folder,{recursive:true,force:true});}
 const many=project(Array.from({length:101},(_,index)=>({...access('sw-'+index),ports:[],vlans:[]})));assert.throws(()=>reportRequest(many),/100 devices/);assert.equal(reportRequest(many,['sw-0']).items.length,1);many.layout.switchport.enabled=false;assert.deepEqual(buildSwitchportReports(many),[]);
});
