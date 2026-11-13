import test from 'node:test';
import assert from 'node:assert/strict';
import {logicalPages} from '../src/web/diagram/logical.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {textLayout} from '../src/web/diagram/scene.mjs';
import {cleanDrawingEdits} from '../src/web/drawing-edits.mjs';
import {unzip} from '../src/web/zip.mjs';
const section=(id,n)=>({id,name:'LAB-SWITCH-'+id,rows:Array.from({length:n},(_,i)=>['VLAN '+(i+1),'Network '+(i+1),'192.0.2.1/24','1/1/1'])});
const clear=pages=>{for(const p of pages){const texts=p.items.filter(i=>i.logicalDeviceId);for(const t of texts){assert.ok(t.y+t.h<=p.height-36);assert.equal(textLayout(t).size,t.size);}for(let i=1;i<p.logicalSections.length;i++)assert.ok(p.logicalSections[i].y>=p.logicalSections[i-1].y+p.logicalSections[i-1].h+18);}};
test('legacy table captions and text colors remain available in grouped device records',()=>{
 const s=section('A',1);s.rows[0][1]='Office';let hash=0;for(const c of JSON.stringify(['Office',null]))hash=Math.imul(hash,31)+c.charCodeAt(0)|0;
 const project={layout:{drawingEdits:{['VLANs and Routing|text|'+hash+'|0']:{value:'Office users',color:'#2255AA'}}}},pages=logicalPages(project,[s]),item=pages[0].items.find(i=>i.logicalColumn===1);
 assert.equal(item.value,'Office users');assert.equal(item.color,'#2255AA');
});
test('VLANs and routes share a page under separate device headers when they fit',()=>{
 const pages=logicalPages({},[section('A',3),section('B',4)]);assert.equal(pages.length,1);assert.deepEqual(pages[0].logicalSections.map(s=>s.name),['LAB-SWITCH-A','LAB-SWITCH-B']);clear(pages);
});
test('a complete device section moves together and oversized devices repeat their header',()=>{
 const pages=logicalPages({},[section('A',18),section('B',8),section('C',37)]);assert.deepEqual(pages[0].logicalSections.map(s=>s.deviceId),['A']);assert.equal(pages[1].logicalSections[0].deviceId,'B');assert.ok(pages.slice(2).some(p=>p.logicalSections.some(s=>s.deviceId==='C'&&s.continued)));
 for(const [id,n] of [['A',18],['B',8],['C',37]])assert.equal(pages.flatMap(p=>p.items).filter(i=>i.logicalDeviceId===id&&i.logicalColumn===0).length,n);clear(pages);
});
test('very long records retain all content across continued device sections',()=>{
 const text=Array.from({length:1700},(_,i)=>'VLAN'+i).join(' '),s=section('Long',1);s.rows[0][1]=text;const pages=logicalPages({},[s]);assert.ok(pages.length>1);const values=pages.flatMap(p=>p.items).filter(i=>i.logicalColumn===1).map(i=>i.value).join('');assert.equal(values.replace(/\s/g,''),text.replace(/\s/g,''));clear(pages);assert.ok(pages.flatMap(p=>p.items).filter(i=>i.editKey).every(i=>i.editKey.length<500));
});
test('logical text edits survive reordering and native Visio exports device headers',async()=>{
 const p={name:'Routing lab',devices:['A','B'].map(id=>({id,name:'LAB-SWITCH-'+id,kind:'switch',ports:[],vlans:[{id:10,name:'Users'}],routes:[{destination:'0.0.0.0/0',gateway:'192.0.2.254'}]})),links:[]};
 const original=buildPages(p).flatMap(p=>p.items).find(i=>i.logicalDeviceId==='A'&&i.logicalColumn===1&&i.value==='Users');p.layout={order:['B','A'],drawingEdits:cleanDrawingEdits({[original.editKey]:{value:'Office users',color:'#2255AA'}})};
 const pages=buildPages(JSON.parse(JSON.stringify(p))),item=pages.flatMap(p=>p.items).find(i=>i.editKey===original.editKey);assert.equal(item.value,'Office users');assert.equal(item.color,'#2255AA');
 const parts=await unzip(await exportVisio(p,pages).arrayBuffer()),xml=[...parts].filter(([k])=>/^visio\/pages\/page\d+\.xml$/.test(k)).map(([,v])=>new TextDecoder().decode(v)).join('');assert.ok(xml.includes('LAB-SWITCH-A'));assert.ok(xml.includes('Office users'));
});

// A fictional campus: twelve switches with different VLAN and route counts.
const campus=layout=>({name:'Fictional campus',links:[],layout:{pageSetup:{visible:{default:{preset:'letter'}}},...layout},devices:Array.from({length:12},(_,d)=>({id:'sw'+d,name:'LAB-SW-'+(d+1),kind:'switch',vendor:'Aruba',model:'JL256A',ip:'10.0.'+d+'.1',ports:Array.from({length:8},(_,i)=>({name:String(i+1),state:'up',native:10})),vlans:Array.from({length:4+(d*7)%23},(_,v)=>({id:10+v,name:'Lab VLAN '+(10+v),ip:'10.'+d+'.'+v+'.1/24'})),routes:Array.from({length:d%4},()=>({destination:'0.0.0.0/0',gateway:'10.'+d+'.0.254'}))}))});
const vlanPages=project=>buildPages(project).filter(page=>/^VLANs and Routing/.test(page.name));
const devicesOn=pages=>pages.map(page=>[...new Set(page.logicalSections.map(section=>section.name))]);

test('VLANs and Routing gives every switch its own page by default and keeps it whole',()=>{
 const project=campus(),pages=vlanPages(project),sections=pages.flatMap(page=>page.logicalSections||[]);
 assert.equal(sections.filter(section=>section.continued).length,0,'no device continues onto another page');
 assert.deepEqual(devicesOn(pages),project.devices.map(device=>[device.name]),'one page per switch, in device order');
 assert.deepEqual(pages.map(page=>page.displayName),project.devices.map(device=>'VLANs and Routing - '+device.name));
 for(const page of pages)assert.equal(page.pageOverflow,false);
});

test('devices chosen for one page share it, and a stack shares one page',()=>{
 const grouped=vlanPages(campus({documentPages:{logical:{sw7:'sw0',sw10:'sw0'}}}));
 assert.deepEqual(devicesOn(grouped).slice(0,2),[['LAB-SW-1','LAB-SW-8','LAB-SW-11'],['LAB-SW-2']],'the chosen devices share the first device\'s page');
 assert.equal(grouped[0].displayName,'VLANs and Routing - LAB-SW-1, LAB-SW-8, LAB-SW-11');
 assert.equal(grouped.length,10);
 const stacked=vlanPages(campus({deviceStacks:[{id:'stack-a',members:[{deviceId:'sw5',number:2},{deviceId:'sw4',number:1}]}]}));
 assert.deepEqual(devicesOn(stacked).find(names=>names.includes('LAB-SW-5')),['LAB-SW-5','LAB-SW-6'],'stack members share one page');
 assert.equal(stacked.length,11);
 // A member chosen for its own page leaves its stack's page.
 const own=vlanPages(campus({deviceStacks:[{id:'stack-a',members:[{deviceId:'sw4',number:1},{deviceId:'sw5',number:2}]}],documentPages:{logical:{sw5:'sw5'}}}));
 assert.equal(own.length,12);
 // A group larger than a page continues on the next page with whole devices.
 const all=vlanPages(campus({documentPages:{logical:Object.fromEntries(Array.from({length:11},(_,d)=>['sw'+(d+1),'sw0']))}}));
 assert.ok(all.length>1&&all.length<12,'the twelve switches fill pages together ('+all.length+')');
 assert.deepEqual(all.flatMap(page=>page.logicalSections.map(section=>section.name)).sort(),campus().devices.map(device=>device.name).sort(),'every device appears once');
 assert.equal(all.flatMap(page=>page.logicalSections).filter(section=>section.continued).length,0);
});
