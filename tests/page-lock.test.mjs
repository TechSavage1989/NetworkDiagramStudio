import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPageSetup,fitVisiblePage} from '../src/web/page-options.mjs';
const project=(fitMode='optimize')=>({layout:{pageSetup:{visible:{default:{preset:'a4',orientation:'landscape',locked:true},fitMode}}}});
const page=(width=1000)=>({name:'Core',width,height:500,items:[{type:'text',x:50,y:50,w:100,h:20,size:12}]});
test('locked physical paper dimensions remain exact as content changes',()=>{
 for(const width of [1000,1400,1800]){const fitted=fitVisiblePage(page(width),project());assert.ok(Math.abs(fitted.width-297*96/25.4)<1e-8);assert.ok(Math.abs(fitted.height-210*96/25.4)<1e-8);assert.ok(fitted.pageLockFrame);}
});
test('saved locked transform remains fixed and overflow is rejected',()=>{
 const p=project(),initial=fitVisiblePage(page(),p);p.layout.pageSetup.visible.lockFrames={Core:initial.pageLockFrame};
 const restored=cleanPageSetup(JSON.parse(JSON.stringify(p.layout.pageSetup)));p.layout.pageSetup=restored;
 const next=fitVisiblePage(page(990),p);assert.equal(next.items[0].x,initial.items[0].x);assert.equal(next.items[0].size,initial.items[0].size);
 assert.throws(()=>fitVisiblePage(page(1800),p),/exceeds the locked page/);
});
test('preserve rejects oversized content instead of clipping and unlocked stays compatible',()=>{
 assert.throws(()=>fitVisiblePage(page(1600),project('preserve')),/locked page size/);
 const p=project('preserve');p.layout.pageSetup.visible.default.locked=false;assert.ok(fitVisiblePage(page(1600),p).width>=1600);
});
