import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanGlobalTextStyles,globalTextCategory,applyGlobalTextStyles,globalTextCategories} from '../src/web/global-text-styles.mjs';
import {cleanLayout} from '../src/web/layout.mjs';

const label=(editKey,fields={})=>({type:'text',editKey,x:100,y:100,w:150,h:24,size:12,bold:false,color:'#123456',align:'left',value:'Fictional label',...fields});

test('global text styles classify each meaningful document text type',()=>{
 const cases=[
  ['deviceNames',{titleOwner:'sw1',titleSlot:'title'}],
  ['deviceDetails',{titleOwner:'sw1',titleSlot:'detail'}],
  ['portLabels',{labelRole:'port'}],
  ['linkLabels',{labelRole:'media'}],
  ['pageTitles',{pageTitle:true}],
  ['pageMetadata',{pageHeading:'subtitle'}],
  ['connectionKey',{legendEntry:true}],
  ['sidebarText',{panelGroup:true}],
  ['tableText',{tableContent:true}],
  ['otherText',{}]
 ];
 assert.deepEqual(cases.map(([,sample])=>globalTextCategory(label('sample',sample))),cases.map(([key])=>key));
 assert.equal(globalTextCategories.length,cases.length);
});

test('global text settings survive project normalization and reject malformed values',()=>{
 const source={deviceNames:{scale:1.5,color:'#aabbcc',bold:true,align:'center'},linkLabels:{scale:.8},otherText:{scale:99,color:'red',align:'justify',bold:'no'},__proto__:{color:'blue'}};
 const result=cleanLayout({textStyles:source},[]).textStyles;
 assert.deepEqual(result.deviceNames,{scale:1.5,color:'#AABBCC',bold:true,align:'center'});
 assert.deepEqual(result.linkLabels,{scale:.8});
 assert.equal(Object.hasOwn(result,'otherText'),false);
 assert.ok(!Object.hasOwn(result,'__proto__'));
 assert.deepEqual(cleanGlobalTextStyles({deviceNames:{scale:1}}),{});
});

test('existing page labels receive global defaults while individual edits retain priority',()=>{
 const device=label('site|device',{titleOwner:'switch',titleSlot:'title',align:'center',color:'#008800'}),cable=label('site|cable',{labelRole:'media'});
 const page={items:[device,cable]};
 applyGlobalTextStyles(page,{deviceNames:{scale:1.5,color:'#AA0011',bold:true},linkLabels:{scale:.8,color:'#0022BB',align:'right'}},{'site|device':{color:'#008800'}});
 assert.equal(device.size,18); // explicit color remains authoritative
 assert.equal(device.color,'#008800');assert.equal(device.bold,true);
 assert.equal(cable.size,9.6);assert.equal(cable.color,'#0022BB');assert.equal(cable.align,'right');
 const oldSize=device.size;applyGlobalTextStyles({items:[device]},{},{});assert.equal(device.size,oldSize);
});

test('category styling never changes paths, hardware geometry or unrelated text',()=>{
 const wire={type:'path',weight:4,color:'#123456',points:[[0,0],[40,0]]},title=label('site|title',{pageTitle:true});
 const page={items:[wire,title]};
 applyGlobalTextStyles(page,{pageTitles:{bold:true,color:'#ff0077'}});
 assert.deepEqual(wire,{type:'path',weight:4,color:'#123456',points:[[0,0],[40,0]]});
 assert.equal(title.bold,true);assert.equal(title.color,'#FF0077');assert.equal(title.size,12);
});
