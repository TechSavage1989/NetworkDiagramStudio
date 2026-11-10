import test from 'node:test';
import assert from 'node:assert/strict';
import {pageLayoutEditor} from '../src/web/page-layout-ui.mjs';

// Exercise the real editor/store closures without a browser or rendering mocks.
class Node {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.value='';this.isConnected=true;}
 append(...nodes){for(const n of nodes){this.children.push(n);n.parentElement=this;}}
 insertBefore(n,before){this.children.splice(this.children.indexOf(before),0,n);n.parentElement=this;}
 before(n){this.parentElement.insertBefore(n,this);}
 setAttribute(k,v){this[k]=v;}
 focus(){} scrollIntoView(){}
}
function editor(layout={},named=false,wireless=false){
 const fields=new Map(),buttons=new Map(),nodes=[];let collect,applied;
 const previous=globalThis.document;
 globalThis.document={createElement:tag=>{const n=new Node(tag);nodes.push(n);return n;},createTextNode:text=>({textContent:text})};
 try{
  pageLayoutEditor({project:{devices:[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}],layout},pages:wireless?[{name:'Wireless Connections',wirelessLayout:{kind:'banks'},items:[{editKey:'wireless-ap'}]}]:[{name:'network',coreDeviceIds:['a','b'],...(named?{corePageId:'named'}:{})}],selected:wireless?'Wireless Connections':'network',
   modal:()=>new Node(),field:(parent,title,value)=>{const n=new Node('input');n.value=String(value??'');parent.append(n);fields.set(title,n);return n;},
   button:(parent,title,fn)=>{const n=new Node('button');parent.append(n);buttons.set(title,fn);},apply:value=>applied=value,close:()=>{},preview:(_,read)=>collect=read});
 }finally{globalThis.document=previous;}
 return {fields,buttons,collect,check:label=>nodes.find(n=>n['aria-label']===label),device:id=>nodes.find(n=>n.dataset.deviceId===id),apply:()=>{buttons.get('Apply layout')();assert.ok(applied,'Apply succeeded');return applied;}};
}
test('temporary device preview cannot turn an automatic page into a named definition',()=>{
 const ui=editor();ui.device('b').checked=false;
 assert.deepEqual(ui.collect().layout.corePages[0].devices,['a']);
 ui.device('b').checked=true;
 assert.deepEqual(ui.collect().layout.corePages,[]);
 assert.deepEqual(ui.apply().corePages,[],'future imports must continue to join automatic pages');
});
test('temporary arrangement preview preserves manual geometry when reverted before Apply',()=>{
 const edits={'network|device|a':{x:100,y:200,scale:1.2},'network|path|c':{points:[[1,2],[3,4]],color:'red'}};
 const ui=editor({drawingEdits:edits});
 const control=ui.fields.get('Device arrangement (all automatic network pages)');
 control.value='vertical';assert.equal(ui.collect().layout.drawingEdits['network|device|a'].x,undefined);
 control.value='compact';assert.deepEqual(ui.collect().layout.drawingEdits,edits);
 assert.deepEqual(ui.apply().drawingEdits,edits);
});
test('named page preview restores captured definition on repeat and explicit Apply still saves',()=>{
 const ui=editor({corePages:[{id:'named',name:'network',devices:['a','b']}]},true);
 ui.device('b').checked=false;const candidate=ui.collect();assert.deepEqual(candidate.layout.corePages[0].devices,['a']);
 candidate.layout.corePages[0].devices.push('external');
 ui.device('b').checked=true;assert.deepEqual(ui.collect().layout.corePages[0].devices,['a','b']);
 ui.device('a').checked=false;assert.deepEqual(ui.apply().corePages[0].devices,['b']);
});
test('failed preview restores draft references before next preview and Apply',()=>{
 const ui=editor();ui.device('b').checked=false;
 const control=ui.fields.get('Device arrangement (all automatic network pages)');control.value='invalid';
 assert.throws(()=>ui.collect(),/supported page arrangement/);
 control.value='compact';ui.device('b').checked=true;
 assert.deepEqual(ui.collect().layout.corePages,[]);assert.deepEqual(ui.apply().corePages,[]);
});
test('explicit Apply still commits arrangement change and clears only positional edits',()=>{
 const ui=editor({drawingEdits:{'network|device|a':{x:100,y:200,scale:1.2}}});
 ui.fields.get('Device arrangement (all automatic network pages)').value='vertical';ui.collect();
 const applied=ui.apply();assert.equal(applied.coreArrangement,'vertical');assert.deepEqual(applied.drawingEdits['network|device|a'],{scale:1.2});
});

test('wireless live draft refit is reversible and Apply clears only its automatic frame',()=>{
 const frame={scale:1,x:0,y:0,originX:0,originY:0,width:1056,height:816},ui=editor({pageSetup:{visible:{lockFrames:{'Wireless Connections':frame,Other:frame}}}},false,true);
 ui.check('Use drawing defaults').checked=false;
 ui.fields.get('Wireless AP placement').value='sides';
 assert.deepEqual(ui.collect().layout.pageSetup.visible.lockFrames,{Other:frame});
 ui.fields.get('Wireless AP placement').value='rows';assert.deepEqual(ui.collect().layout.pageSetup.visible.lockFrames,{'Wireless Connections':frame,Other:frame});
 ui.fields.get('Wireless AP placement').value='sides';assert.deepEqual(ui.apply().pageSetup.visible.lockFrames,{Other:frame});
});
