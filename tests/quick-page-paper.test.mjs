import test from 'node:test';
import assert from 'node:assert/strict';
import {quickPagePaperLayout} from '../src/web/quick-page-paper.mjs';
import {cleanPageSetup,visiblePagePaper} from '../src/web/page-options.mjs';
const frame={scale:1,x:0,y:0,originX:0,originY:0,width:1200,height:900};
const fixture=()=>({drawingEdits:{'Core Network|device|a':{x:123,y:456}},pageSetup:{printPaper:{preset:'a3'},visible:{default:{preset:'letter',orientation:'portrait',locked:true},fitMode:'preserve',wirelessFit:'readable',groups:{wireless:{preset:'a4'}},pages:{Other:{preset:'legal'}},lockFrames:{'Core Network':frame,Other:frame},editFrames:{'Core Network':frame,Other:frame}}}});
test('quick paper changes only selected page and keeps lock, fit, print and manual positions',()=>{
 const layout=fixture(),before=structuredClone(layout),page={name:'Core Network'};
 const after=quickPagePaperLayout(layout,page,{preset:'a4'}),setup=after.pageSetup;
 assert.deepEqual(layout,before,'draft construction is immutable');
 assert.deepEqual(visiblePagePaper({layout:after},page),{preset:'a4',orientation:'portrait',locked:true,widthMm:297,heightMm:420});
 assert.equal(setup.visible.fitMode,'preserve');assert.equal(setup.visible.wirelessFit,'readable');
 assert.deepEqual(setup.visible.default,cleanPageSetup(layout.pageSetup).visible.default);
 assert.deepEqual(setup.visible.pages.Other,cleanPageSetup(layout.pageSetup).visible.pages.Other);
 assert.deepEqual(setup.visible.lockFrames.Other,frame);assert.deepEqual(setup.visible.editFrames.Other,frame);
 assert.equal(setup.visible.lockFrames[page.name],undefined);assert.equal(setup.visible.editFrames[page.name],undefined);
 assert.deepEqual(after.drawingEdits,before.drawingEdits);assert.equal(setup.printPaper.preset,'a3');
});
test('quick orientation preserves dimensions and Dynamic explicitly removes physical lock',()=>{
 const page={name:'Core Network'},rotated=quickPagePaperLayout(fixture(),page,{orientation:'landscape'});
 assert.equal(rotated.pageSetup.visible.pages[page.name].orientation,'landscape');
 assert.equal(rotated.pageSetup.visible.pages[page.name].locked,true);
 const dynamic=quickPagePaperLayout(rotated,page,{preset:'dynamic'});
 assert.equal(dynamic.pageSetup.visible.pages[page.name].locked,false);
 assert.equal(dynamic.pageSetup.visible.pages[page.name].preset,'dynamic');
 assert.deepEqual(cleanPageSetup(JSON.parse(JSON.stringify(dynamic.pageSetup))),dynamic.pageSetup);
});
test('quick paper refuses missing page or invalid choices',()=>{
 assert.throws(()=>quickPagePaperLayout(fixture(),null,{preset:'letter'}));
 assert.throws(()=>quickPagePaperLayout(fixture(),{name:'Core Network'},{preset:'unknown'}));
 assert.throws(()=>quickPagePaperLayout(fixture(),{name:'Core Network'},{orientation:'upside-down'}));
});
