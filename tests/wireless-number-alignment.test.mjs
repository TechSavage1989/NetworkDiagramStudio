import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {labelBackingItems} from '../src/web/diagram/label-backings.mjs';
import {pathCrossesText} from '../src/web/diagram/labels.mjs';

// A fictional 48-port access switch with one AP on a top-row port, on Letter.
function site(port='GigabitEthernet0/37'){
 const ports=[...Array.from({length:48},(_,i)=>({name:'GigabitEthernet0/'+(i+1),state:'up'})),{name:'TenGigabitEthernet0/1'},{name:'TenGigabitEthernet0/2'}];
 return {name:'Fictional campus',devices:[
  {id:'sw',name:'FICT-ACCESS-01',kind:'switch',vendor:'Cisco',model:'WS-C3560E-48PD-SF',ip:'192.0.2.5',ports},
  {id:'ap',name:'FICT-AP-01',kind:'ap',vendor:'Cisco',model:'AIR-CAP3602I-A-K9',ip:'192.0.2.219',ports:[{name:'Gi0'}]}],
  links:[{a:'sw',ap:port,b:'ap',bp:'Gi0',media:'copper',speed:'1 Gbps'}],
  layout:{pageSetup:{visible:{default:{preset:'letter',orientation:'landscape'}}}}};
}

test('wireless port numbers stay in line with their sockets when a cable leaves through a number row',()=>{
 const page=buildPages(site()).find(p=>p.wirelessLayout),device=page.items.find(i=>i.type==='device'&&i.sourceId==='sw');
 const numbers=page.items.filter(i=>i.portNumberRole==='text'&&i.sourceId==='sw'),path=page.items.find(i=>i.type==='path');
 const sockets=device.children.filter(c=>c.socketPart===0).map(c=>({x:device.x+c.x*device.w,y:device.y+c.y*device.h,w:c.w*device.w,h:c.h*device.h,name:c.anchorName}));
 const distance=(number,s)=>number.numberSide==='above'?s.y-(number.y+number.h):number.y-(s.y+s.h);
 const socketOf=number=>sockets.filter(s=>Math.abs(s.x+s.w/2-(number.x+number.w/2))<1e-6&&distance(number,s)>=0).sort((a,b)=>distance(number,a)-distance(number,b))[0];
 // Every number keeps the same distance from its socket, above and below.
 const gaps=numbers.filter(n=>/^GigabitEthernet/.test(n.portName)).map(n=>{const s=socketOf(n);assert.ok(s,n.value);return distance(n,s);});
 assert.ok(Math.max(...gaps)-Math.min(...gaps)<.01,'numbers sit the same distance from their sockets: '+Math.min(...gaps).toFixed(2)+' to '+Math.max(...gaps).toFixed(2));
 const top=numbers.filter(n=>n.numberSide==='above'),bottom=numbers.filter(n=>n.numberSide==='below');
 assert.ok(top.length===24&&top.every(n=>Math.abs(n.y-top[0].y)<1e-6),'one top row');assert.ok(bottom.every(n=>Math.abs(n.y-bottom[0].y)<1e-6),'one bottom row');
 // Numbers stay on the faceplate rather than straddling its edge (the text box
 // includes line spacing, so it may reach a little past the glyphs).
 assert.ok(numbers.every(n=>n.y>=device.y-n.h*.15&&n.y+n.h<=device.y+device.h+n.h*.15),'numbers stay on the faceplate');
 // The cable rises straight out of its socket, behind its own number, which
 // is painted after it on a backing in the plate color.
 const own=numbers.find(n=>n.portName==='GigabitEthernet0/37');
 assert.equal(own.leadThrough,path.linkId);assert.equal(own.background,own.surface);assert.match(own.surface,/^#[0-9A-F]{6}$/i);
 assert.ok(page.items.indexOf(own)>page.items.indexOf(path),'the number is painted over its cable');
 assert.equal(path.points[0][0],path.points[1][0],'the first run is vertical');assert.ok(Math.abs(path.points[0][0]-(own.x+own.w/2))<1e-6,'straight out of the socket');
 assert.ok(path.points[1][1]<own.y,'the cable continues past the number before it turns');
 assert.ok(path.points.length<=4,'no detour along the number row');
 // Only its own cable passes behind it; no other number is crossed.
 for(const number of numbers)if(number!==own)assert.ok(!pathCrossesText(path,number,1),number.value);
 const backing=labelBackingItems(page.items,page.labelBacking).filter(i=>i.captionBacking);
 assert.ok(backing.some(i=>i.fill===own.surface),'the SVG paints the backing');
 assert.ok(page.svg.includes('>37</text>'));
});

test('a cable whose path already clears the numbers keeps them unchanged',()=>{
 for(const port of ['TenGigabitEthernet0/1','GigabitEthernet0/38']){
  const page=buildPages(site(port)).find(p=>p.wirelessLayout),numbers=page.items.filter(i=>i.portNumberRole==='text'&&i.sourceId==='sw');
  const plain=buildPages(site(port)).find(p=>p.wirelessLayout);
  assert.equal(numbers.filter(n=>n.leadThrough!=null).length<=1,true);
  assert.deepEqual(numbers.map(n=>[n.x,n.y]),plain.items.filter(i=>i.portNumberRole==='text'&&i.sourceId==='sw').map(n=>[n.x,n.y]),'deterministic');
  const top=numbers.filter(n=>n.numberSide==='above'),bottom=numbers.filter(n=>n.numberSide==='below');
  assert.ok(top.every(n=>Math.abs(n.y-top[0].y)<1e-6)&&bottom.every(n=>Math.abs(n.y-bottom[0].y)<1e-6),port+' rows stay aligned');
 }
});
