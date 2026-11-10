import test from 'node:test';
import assert from 'node:assert/strict';
import {guideTopics,matchingGuideTopics,guideSearchKeydown} from '../src/web/user-guide.mjs';
test('offline guide covers common tasks with nonempty stable topics and unique navigation',()=>{
 assert.equal(new Set(guideTopics.map(t=>t.id)).size,guideTopics.length);
 for(const id of ['start','paper','calibration','panel','lock','edit','exports','troubleshooting'])assert.ok(guideTopics.some(t=>t.id===id));
 for(const t of guideTopics){assert.ok(t.title&&t.summary&&t.tip&&t.steps.length>=3);for(const action of t.actions||[])assert.ok(['page-options','page-layout','screen-calibrate'].includes(action));}
});
test('guide search matches all words case-insensitively without modifying topics',()=>{
 const before=JSON.stringify(guideTopics);
 assert.equal(matchingGuideTopics().length,guideTopics.length);
 assert.ok(matchingGuideTopics('  ACTUAL calibration ').some(t=>t.id==='calibration'));
 assert.ok(matchingGuideTopics('panel width').some(t=>t.id==='panel'));
 assert.ok(matchingGuideTopics('Ctrl+Z').some(t=>t.id==='edit'));
 assert.deepEqual(matchingGuideTopics('not-a-real-feature'),[]);
 assert.equal(JSON.stringify(guideTopics),before);
});
test('guide distinguishes physical readability controls from screen zoom and respects saved layouts',()=>{
 const body=id=>{const topic=guideTopics.find(t=>t.id===id);return [...topic.steps,topic.tip].join(' ');};
 assert.match(body('paper'),/Minimum paper text \(pt\).*8/);
 assert.match(body('paper'),/0 only to disable/);
 assert.match(body('paper'),/individual font-size edits remain authoritative/);
 assert.match(body('panel'),/Panel width \(% of paper; 0 = automatic\)/);
 assert.match(body('panel'),/rewraps content instead of shrinking/);
 assert.match(body('lock'),/Older saved frames stay fixed/);
});

test('wireless guide describes deliberate side-space placement without promising automatic fit',()=>{
 const topic=guideTopics.find(t=>t.id==='wireless'),body=[...topic.steps,topic.tip].join(' ');
 assert.match(body,/Wireless APs and details \(\%\)/);
 assert.match(body,/Preserve rows/);assert.match(body,/Use side space/);
 assert.match(body,/keeps rows if a safe side arrangement cannot improve/);
 assert.match(body,/does not remove deliberate manual placements/);
 assert.match(body,/Locked paper keeps its dimensions/);
});

test('Escape dismisses guide search once without changing normal editing or IME cancellation',()=>{
 let closed=0,prevented=0,stopped=0;
 const event=(key,extra={})=>({key,preventDefault(){prevented++;},stopPropagation(){stopped++;},...extra});
 assert.equal(guideSearchKeydown(event('Escape'),()=>closed++),true);
 assert.deepEqual([closed,prevented,stopped],[1,1,1]);
 for(const e of [event('a',{ctrlKey:true}),event('Backspace'),event('Enter'),event('Escape',{isComposing:true}),event('Escape',{defaultPrevented:true})])assert.equal(guideSearchKeydown(e,()=>closed++),false);
 assert.deepEqual([closed,prevented,stopped],[1,1,1]);
});
