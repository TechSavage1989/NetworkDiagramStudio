import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {placeCableLabels,wrapText} from '../src/web/diagram/labels.mjs';
import {newPageSetup} from '../src/web/page-options.mjs';
import {mdfLookalike} from './fixtures/mdf-lookalike.mjs';

// A fictional MDF: an HA firewall pair (one with five WAN circuits and a long
// host name), a modular chassis and 8- and 5-member stacks, on Letter landscape.
function haSite(){
 const p=mdfLookalike(),top=p.devices.find(d=>d.id==='fw');top.name='LAB-FG200G-TOP';
 p.devices.splice(1,0,{...structuredClone(top),id:'fw2',name:'LAB-FG200G-BOTTOM.example.org',ip:'10.0.0.2',ports:top.ports.filter(x=>x.role!=='wan').map(x=>({...x}))});
 p.links.push({a:'fw2',ap:'port2',b:'mdf',bp:'B12',media:'copper',speed:'1 Gbps',status:'confirmed'},{a:'fw2',ap:'port4',b:'mdf',bp:'A7',media:'copper',speed:'1 Gbps',status:'confirmed'},{a:'fw',ap:'ha1',b:'fw2',bp:'ha1',media:'copper',speed:'1 Gbps',status:'confirmed'});
 p.layout={...(p.layout||{}),pageSetup:newPageSetup()};
 return p;
}

test('labels wrap at words and name separators, never leaving a letter or two alone',()=>{
 assert.deepEqual(wrapText('Some Interface',80,12,true),['Some','Interface']);
 const host=wrapText('LAB-FG200G-BOTTOM.example.org',150,12,true);
 assert.ok(host.length>1&&host.every(line=>line.length>2),JSON.stringify(host));
 assert.ok(/[-.]$/.test(host[0]),'breaks after a separator: '+JSON.stringify(host));
 assert.equal(host.join(''),'LAB-FG200G-BOTTOM.example.org');
 for(const line of wrapText('ABCDEFGHIJKLMNOPQ',80,12,true))assert.ok(line.length>2,line);
});

test('a port name on its own cable is one run of text, not its wrapped pieces',()=>{
 // A narrow sidebar label width wraps "Some Interface"; on the cable it is one line.
 const page={legendLayout:'sidebar',sidebar:{contentLeft:306},width:1200,height:975,items:[
  {type:'path',linkId:1,points:[[400,700],[400,300],[1000,300]],weight:4,editKey:'P|path|1'},
  {type:'path',linkId:2,points:[[440,700],[440,340],[1000,340]],weight:4,editKey:'P|path|2'}]};
 const requests=[1,2].map(id=>({role:'port',value:'Some Interface',editKey:'P|label|'+id,linkId:id,size:12,endpoint:'b',outer:400}));
 assert.equal(placeCableLabels(page,requests,{}).ok,true);
 const texts=page.items.filter(i=>i.type==='text');
 assert.equal(texts.length,2);
 for(const text of texts){assert.equal(text.value,'Some Interface');assert.equal(text.background,'#FFFFFF');assert.match(text.editKey,/^P\|label\|\d\|0$/);}
});

test('a compact network page fills landscape paper in columns and keeps names against their devices',()=>{
 const core=buildPages(haSite()).find(page=>page.name==='Core Network');
 const devices=core.items.filter(i=>i.type==='device'&&['fw','fw2','mdf','idf1','idf2'].includes(i.sourceId));
 assert.equal(devices.length,5);
 // One label that needed room must not push the sheet into a single tall column.
 assert.ok(new Set(devices.map(d=>Math.round(d.x))).size>=2,'at least two columns: '+devices.map(d=>Math.round(d.x)));
 assert.ok(core.width/core.height>1.1,'landscape-shaped sheet');
 assert.ok(core.paperReadability.actualPt>3,'prints larger than the one-column 2 pt: '+core.paperReadability.actualPt);
 // Names and details sit right against their own device, above or below it.
 const unit=core.width/1056;
 for(const caption of core.items.filter(i=>i.type==='text'&&i.titleOwner&&['fw','fw2','mdf','idf1','idf2'].includes(i.titleOwner))){
  const body=devices.find(d=>d.sourceId===caption.titleOwner),sibling=core.items.find(i=>i!==caption&&i.type==='text'&&i.titleOwner===caption.titleOwner);
  const gap=caption.y+caption.h<=body.y+1?body.y-(caption.y+caption.h):caption.y-(body.y+body.h),allowed=12*unit+(sibling?sibling.h+8*unit:0);
  assert.ok(gap>=-1&&gap<=allowed,caption.value+' is '+gap.toFixed(1)+' from its device (allowed '+allowed.toFixed(1)+')');
  assert.ok(caption.x<body.x+body.w&&caption.x+caption.w>body.x,caption.value+' overlaps its device horizontally');
 }
});
