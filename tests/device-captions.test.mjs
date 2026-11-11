import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {cleanPageSetup} from '../src/web/page-options.mjs';
import {deviceBounds} from '../src/web/diagram/device-geometry.mjs';
import {wirelessTwoStackSite} from './fixtures/wireless-two-stack.mjs';

// Network-page device names and details stay next to their own device: the
// name above and the details below on the left by default, or the corner
// chosen in Layout & content. On fixed paper they keep their readable size
// after the user moves a device or a caption.
const site=(layout={})=>{const p=wirelessTwoStackSite({mac:false});p.layout={...p.layout,pageSetup:cleanPageSetup({visible:{default:{preset:'letter',orientation:'landscape'}}}),...layout};return p;};
const core=project=>buildPages(project).find(page=>page.coreDeviceIds);
const captions=page=>page.items.filter(i=>i.type==='text'&&i.titleOwner);
const bodyOf=(page,id)=>{const b=page.items.find(i=>i.type==='device'&&i.sourceId===id&&i.kind!=='plug');return {...b,...deviceBounds(b)};};

test('device names sit above and details below their own device by default',()=>{
 const page=core(site());
 for(const text of captions(page)){
  const body=bodyOf(page,text.titleOwner),near=12*page.width/1056;
  assert.ok(text.x>=body.x-1&&text.x+text.w<=body.x+body.w+1,text.editKey+' stays within its device width');
  if(text.titleSlot==='detail')assert.ok(text.y>=body.y+body.h&&text.y-(body.y+body.h)<80,text.editKey+' sits just below');
  else assert.ok(text.y+text.h<=body.y&&body.y-(text.y+text.h)<80,text.editKey+' sits just above');
  assert.ok(text.x-body.x<body.w/2||text.titleSlot==='detail','names start from the left');
  assert.ok(near>0);
 }
});

test('the chosen corners move every name and detail line',()=>{
 const page=core(site({deviceCaptions:{name:'below-right',info:'above-right'}}));
 for(const text of captions(page)){
  const body=bodyOf(page,text.titleOwner);
  if(text.titleSlot==='detail')assert.ok(text.y+text.h<=body.y,text.editKey+' above');
  else assert.ok(text.y>=body.y+body.h,text.editKey+' below');
  assert.ok(body.x+body.w-(text.x+text.w)<body.w/2,text.editKey+' toward the right edge');
 }
 assert.deepEqual(cleanLayout({deviceCaptions:{name:'below-right',info:'below-left'}},[]).deviceCaptions,{name:'below-right'},'only a changed corner is stored');
 assert.equal(cleanLayout({deviceCaptions:{name:'above-left',info:'sideways'}},[]).deviceCaptions,undefined);
});

test('moving a device or a caption keeps its readable paper size',()=>{
 const before=core(site()),title=captions(before).find(t=>t.titleOwner==='fw'&&!t.titleSlot),body=before.items.find(i=>i.type==='device'&&i.sourceId==='fw');
 assert.ok(title.paperDeviceLabel,'the name is enlarged for paper');
 // Edit drawing pins every device on the first move, so every body has an edit.
 const source=item=>{const p=item.presentation||{scale:1,x:0,y:0};return {x:(item.x-(p.x||0))/p.scale,y:(item.y-(p.y||0))/p.scale};};
 const pinned=Object.fromEntries(before.items.filter(i=>i.type==='device'&&i.sourceId&&i.kind!=='plug').map(i=>[i.editKey,source(i)]));
 pinned[body.editKey]={...pinned[body.editKey],x:pinned[body.editKey].x+30};
 const moved=core(site({drawingEdits:pinned})),after=captions(moved).find(t=>t.titleOwner==='fw'&&!t.titleSlot);
 assert.ok(after.size>=title.size*.9,'a moved device keeps its readable name ('+after.size.toFixed(1)+' vs '+title.size.toFixed(1)+')');
 for(const text of captions(moved))assert.ok(text.paperDeviceLabel,text.editKey+' stays readable after pinning');
 const dropped=core(site({drawingEdits:{[title.editKey]:{...source(title),y:source(title).y-40}}})),own=captions(dropped).find(t=>t.editKey===title.editKey);
 assert.ok(own.size>=title.size*.95,'a moved name does not shrink ('+own.size.toFixed(1)+' vs '+title.size.toFixed(1)+')');
});

test('one device can take its own corners; a dragged caption follows them',async()=>{
 const {setDeviceCaptionCorners,deviceCaptionPlacement}=await import('../src/web/device-captions.mjs');
 const base=site({deviceCaptions:{info:'above-left'}}),page=core({...base,layout:{...base.layout,deviceCaptions:{info:'above-left',devices:{s1:{name:'below-right'}}}}});
 for(const text of captions(page)){
  const body=bodyOf(page,text.titleOwner);
  if(text.titleOwner==='s1'&&!text.titleSlot){assert.ok(text.y>=body.y+body.h,'s1 name below its device');assert.ok(body.x+body.w-(text.x+text.w)<body.w/2,'toward the right');}
  else if(!text.titleSlot)assert.ok(text.y+text.h<=body.y,text.editKey+' keeps the drawing corner (above)');
  else assert.ok(text.y+text.h<=body.y,text.editKey+' details follow the drawing corner (above)');
 }
 assert.deepEqual(deviceCaptionPlacement({layout:{deviceCaptions:{name:'below-left',devices:{a:{info:'above-right'}}}}},'a'),{name:'below-left',info:'above-right'});
 assert.deepEqual(cleanLayout({deviceCaptions:{devices:{s1:{name:'below-right',info:'nowhere'},gone:{name:'above-right'}}}},['s1']).deviceCaptions,{devices:{s1:{name:'below-right'}}},'only known devices and real corners are kept');
 const layout={drawingEdits:{'Core Network|title|s1':{x:10,y:20,size:14},'Core Network|detail|s1':{x:5,y:6},'Core Network|title|s2':{x:1,y:2}}};
 setDeviceCaptionCorners(layout,'s1',{name:'below-right'});
 assert.deepEqual(layout.drawingEdits,{'Core Network|title|s1':{size:14},'Core Network|detail|s1':{x:5,y:6},'Core Network|title|s2':{x:1,y:2}},'only the moved name loses its dragged position');
 setDeviceCaptionCorners(layout,'s1',{});assert.equal(layout.deviceCaptions.devices,undefined,'choosing Default clears the device');
});
