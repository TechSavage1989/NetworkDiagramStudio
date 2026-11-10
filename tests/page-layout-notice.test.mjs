import test from 'node:test';
import assert from 'node:assert/strict';
import {pageLayoutNotice} from '../src/web/page-layout-notice.mjs';
test('legacy frozen-frame refit action remains first when readable content also overflows',()=>{
 const notice=pageLayoutNotice({panelFitLegacy:true,pageOverflow:true,paperReadability:{minimumPt:8,actualPt:8,overflow:true}});
 assert.match(notice,/^This saved page keeps its earlier layout\./);
 assert.match(notice,/Page options and Save page options/);
 assert.match(notice,/saved object edits are retained/);
 assert.match(notice,/needs more space at 8 pt/);
 assert.match(notice,/Print\/PDF may clip/);
});
test('legacy explanation remains with generic overflow and small text warnings',()=>{
 const notice=pageLayoutNotice({panelFitLegacy:true,pageOverflow:true,paperReadability:{minimumPt:8,actualPt:5.25,overflow:false}});
 assert.match(notice,/earlier layout/);assert.match(notice,/Content extends beyond/);assert.match(notice,/5\.3 pt/);
});
test('resolved layout removes notice while independent overflow stays actionable',()=>{
 assert.equal(pageLayoutNotice(), '');assert.equal(pageLayoutNotice({paperReadability:{minimumPt:8,actualPt:8,overflow:false}}),'');
 assert.match(pageLayoutNotice({pageOverflow:true}),/Open Page options/);
 assert.match(pageLayoutNotice({panelFitLegacy:true}),/earlier layout/);
 assert.doesNotMatch(pageLayoutNotice({paperReadability:{minimumPt:8,actualPt:7,overflow:false}}),/earlier layout/);
});

test('automatic fitted small text explains the tradeoff without recommending a useless refit',()=>{
 const notice=pageLayoutNotice({paperReadability:{minimumPt:8,actualPt:4,preserved:false,overflow:false}});
 assert.match(notice,/complete diagram fits/);assert.match(notice,/4.0 pt/);assert.match(notice,/below the 8 pt target/);
 assert.doesNotMatch(notice,/Save page options|clip off-page/);
});
