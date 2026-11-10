import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the exact test-host JavaScript without claiming a Windows UI pass.
const source=readFileSync(new URL('./desktop/NativeSmoke.cs',import.meta.url),'utf8');
const script=source.match(/expression=\$\$"""([\s\S]*?)"""/)[1].replace('{{query}}',JSON.stringify('#title'));
function context({visible=[0],text=true,offset=0}={}){
 const n={dataset:{drawingKey:'Core Network|title|edge'},scrollIntoView(){},matches(){return text;},getBoundingClientRect(){return {x:offset,y:0,width:90,height:50};},getNumberOfChars(){return 3;},getScreenCTM(){return {a:1,b:0,c:0,d:1,e:offset,f:0};},getExtentOfChar(i){return {x:i*30,y:i%2?30:0,width:10,height:10};}};
 const wrong={localName:'svg',closest(){return null;}},hit={localName:'tspan',closest(selector){return selector==='text'?n:null;}};
 const document={querySelector(selector){return selector==='#canvas'?null:n;},getElementById(){return {textContent:'Ready'};},elementFromPoint(x,y){const i=Math.round((x-offset-5)/30);return visible.includes(i)&&Math.abs(x-(offset+i*30+5))<.01&&Math.abs(y-(i%2?35:5))<.01?hit:wrong;}};
 class DOMPoint{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return {x:this.x*m.a+this.y*m.c+m.e,y:this.x*m.b+this.y*m.d+m.f};}}
 return {document,DOMPoint,innerWidth:1280,innerHeight:820,requestAnimationFrame:fn=>queueMicrotask(fn)};
}
test('native title target chooses an actual glyph rather than blank enclosing center',async()=>{
 const result=await vm.runInNewContext(script,context());assert.equal(result.glyph,0);assert.equal(result.x,5);assert.equal(result.y,5);
});
test('native title target follows current presentation coordinates',async()=>{
 const result=await vm.runInNewContext(script,context({offset:73,visible:[2]}));assert.equal(result.glyph,2);assert.equal(result.x,138);
});
test('native title target fails with diagnostics rather than clicking an obstruction',async()=>{
 const result=await vm.runInNewContext(script,context({visible:[]}));assert.equal(result.error,'No visible text glyph hit');assert.equal(result.hits.length,3);assert.equal(result.centerHit,'svg');
});
test('native ordinary controls retain their center target',async()=>{
 const result=await vm.runInNewContext(script,context({text:false}));assert.equal(result.x,45);assert.equal(result.y,25);
});

const navigation=source.split('async Task PanEditorTargetIntoView')[1].match(/expression=\$\$"""([\s\S]*?)"""/)[1].replace('{{query}}',JSON.stringify('#title'));
function navigationContext(bounds,canvas={left:410,right:1028,top:522.6875,bottom:727.0625}){
 return {document:{querySelector:s=>s==='#canvas'?{getBoundingClientRect:()=>canvas}:bounds?{getBoundingClientRect:()=>bounds}:null},innerWidth:1028,innerHeight:749,requestAnimationFrame:fn=>queueMicrotask(fn)};
}
test('native navigation plans bounded real pan for different offscreen title',async()=>{
 const step=await vm.runInNewContext(navigation,navigationContext({left:636.55,right:655.9,top:774.71,bottom:784.71}));
 assert.ok(step.dy<0);assert.ok(Math.abs(step.dy)<=72.1875);assert.ok(step.y+step.dy>=552.6875);assert.ok(step.x>=440&&step.x<=998);
 assert.match(source,/type="mouseMoved",x=endX,y=endY,button="middle",buttons=4/);
 assert.match(source,/Native title navigation changed zoom/);
});
test('native navigation leaves an already visible target alone and fails closed without a canvas',async()=>{
 assert.equal((await vm.runInNewContext(navigation,navigationContext({left:600,right:650,top:580,bottom:600}))).visible,true);
 assert.match((await vm.runInNewContext(navigation,navigationContext(null))).error,/missing/);
 assert.match((await vm.runInNewContext(navigation,navigationContext({left:0,right:1,top:0,bottom:1},{left:0,right:50,top:0,bottom:50}))).error,/no pointer navigation area/);
});
