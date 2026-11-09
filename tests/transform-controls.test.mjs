import test from 'node:test';
import assert from 'node:assert/strict';
import {transformGeometry,transformEdits,rotatable} from '../src/web/transform-controls.mjs';
import {cleanDrawingEdits} from '../src/web/drawing-edits.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {unzip} from '../src/web/zip.mjs';
const item={type:'text',editKey:'text',x:100,y:100,w:100,h:20,size:12,value:'Example'};
test('corner resizing is proportional, bounded and anchored opposite the handle',()=>{
 for(const handle of ['nw','ne','sw','se']){
  const g=transformGeometry(item,handle,handle.includes('w')?-50:50,handle.includes('n')?-10:10);
  assert.equal(g.factor,1.5);const patch=transformEdits({items:[item]}, {},item,g).text;
  assert.equal(patch.w,150);assert.equal(patch.h,30);assert.equal(patch.size,18);
  assert.equal(patch.x,handle.includes('w')?50:100);assert.equal(patch.y,handle.includes('n')?90:100);
 }
 assert.equal(transformGeometry(item,'se',-1e6,-1e6).factor,.1);
 assert.equal(transformGeometry(item,'se',1e6,1e6).factor,4);
});
test('manual rotation is persistent, supports 15 degree snapping and excludes hardware',()=>{
 const g=transformGeometry(item,'rotate',22,5,{shiftKey:true});assert.equal(g.angle/(Math.PI/12),Math.round(g.angle/(Math.PI/12)));
 const patch=transformEdits({items:[item]}, {},item,g).text;
 assert.equal(patch.rotationMode,'fixed');assert.deepEqual(cleanDrawingEdits(JSON.parse(JSON.stringify({text:patch}))).text,patch);
 assert.equal(rotatable({type:'device'}),false);assert.throws(()=>transformEdits({items:[]},{},{type:'device',editKey:'d'},{angle:1}),/text/);
});
test('resizing keeps device presentation coordinates and pins neighboring layout',()=>{
 const d={type:'device',editKey:'d',sourceId:'d',kind:'switch',x:200,y:80,w:120,h:40,children:[],presentation:{scale:2,x:0,y:0}},other={...d,editKey:'e',sourceId:'e',x:400};
 const edits=transformEdits({items:[d,other],coreDeviceIds:['d','e']},{},d,{factor:1.5,dx:0,dy:0});
 assert.equal(edits.d.w,90);assert.equal(edits.d.x,100);assert.equal(edits.e.x,200);
});
test('arbitrary text angle survives rebuilt SVG and native Visio export',async()=>{
 const p={name:'Fictional transform test',devices:[],links:[]},first=buildPages(p),label=first[0].items.find(i=>i.type==='text'&&i.value==='Fictional transform test');assert.ok(label);
 p.layout={drawingEdits:{[label.editKey]:{angle:Math.PI/6,bold:true,color:'#112233'}}};
 const pages=buildPages(JSON.parse(JSON.stringify(p)));assert.match(pages[0].svg,/rotate\(-30 /);
 const zip=await unzip(await exportVisio(p,pages).arrayBuffer());assert.match(new TextDecoder().decode(zip.get('visio/pages/page1.xml')),/N="Angle" V="0\.523/);
 assert.doesNotMatch(pages[0].svg,/transform-controls|quick-text/);
});
test('native text resize keeps its opposite corner anchored despite baseline coordinates',()=>{
 const parent={type:'device',editKey:'d',x:50,y:50,w:200,h:100,children:[],asset:{native:{paths:[],texts:[{x:.5,y:.5,w:.2,size:.05,text:'Native'}]}}};
 const text={type:'arttext',editKey:'d|arttext|0',parent,normalized:true,x:.5,y:.5,w:.2,size:.05};
 const patch=transformEdits({items:[parent]},{},text,{factor:2,dx:0,dy:0})[text.editKey];
 assert.equal(patch.w,.4);assert.equal(patch.size,.1);assert.ok(Math.abs(patch.x-.6)<1e-8);assert.ok(Math.abs(patch.y-.57)<1e-8);
});
