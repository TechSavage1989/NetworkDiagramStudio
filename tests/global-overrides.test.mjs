import test from 'node:test';
import assert from 'node:assert/strict';
import {globalOverrides} from '../src/web/page-layout-ui.mjs';

// Layout & content: a changed drawing default replaces the same setting on
// every page that had its own; the pages keep their other settings.
test('a drawing-default change replaces the same page settings and keeps the rest',()=>{
 const pages={a:{name:'A',textScale:1.2,drawingScale:.8,panel:{width:200,scale:1,position:'right'}},b:{hidden:true},c:{minimumTextPt:6}};
 globalOverrides({textScale:1,drawingScale:1,minimumTextPt:8,panel:{width:240,scale:1,position:'left'}},{textScale:1.5,drawingScale:1,minimumTextPt:8,panel:{width:240,scale:1.2,position:'left'}},pages);
 assert.deepEqual(pages.a,{name:'A',drawingScale:.8,panel:{width:200,scale:1.2,position:'right'}},'text scale now follows the default; the page keeps its drawing scale, panel width and position');
 assert.deepEqual(pages.b,{hidden:true});assert.deepEqual(pages.c,{minimumTextPt:6},'unchanged defaults leave page settings alone');
});
