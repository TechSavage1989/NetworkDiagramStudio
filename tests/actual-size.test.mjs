import test from 'node:test';
import assert from 'node:assert/strict';
import {actualSizeScale,actualSizePaper,screenSignature,validCalibration,calibrationMatches} from '../src/web/actual-size.mjs';
const signature=screenSignature({devicePixelRatio:1.25,screen:{width:1920,height:1080,colorDepth:24},visualViewport:{scale:1}});
test('calibrated physical paper preserves exact size regardless of drawing units',()=>{
 for(const [preset,orientation,width,height] of [['letter','portrait',215.9,279.4],['a4','landscape',297,210],['a3','portrait',297,420],['custom','portrait',200,400]]){
  const page={width:2000,height:2000*height/width,visiblePaper:{preset,orientation,widthMm:width,heightMm:height}};
  const scale=actualSizeScale(page,4.2);assert.ok(Math.abs(page.width*scale-width*4.2)<1e-8);assert.ok(Math.abs(page.height*scale-height*4.2)<1e-8);
 }
});
test('implicit physical port-map paper is supported without making dynamic canvases physical',()=>{
 const page={width:1056,paper:{preset:'letter',orientation:'landscape'}};
 assert.equal(actualSizeScale(page,4),279.4*4/1056);
 assert.equal(actualSizeScale({...page,dynamic:true},4),null);
});

test('off-paper editor bounds do not shrink the selected sheet',()=>{
 const page={width:1000,height:1000*210/297,visiblePaper:{preset:'a4',orientation:'landscape'},originX:-400,viewBox:{width:5000}};
 assert.equal(actualSizeScale(page,4),297*4/1000);
 assert.equal(actualSizeScale({...page,visiblePaper:{preset:'dynamic'}},4),null);
 assert.equal(actualSizeScale(null,4),null);assert.equal(actualSizeScale({...page,width:0},4),null);
});
test('calibration validates persistence and detects measurable screen changes',()=>{
 const saved={version:1,pxPerMm:4,signature};assert.ok(validCalibration(saved));assert.ok(calibrationMatches(saved,signature));
 for(const k of ['dpr','width','height','depth','zoom'])assert.equal(calibrationMatches(saved,{...signature,[k]:signature[k]+1}),false,k);
 for(const value of [null,{}, {...saved,version:2},{...saved,pxPerMm:NaN},{...saved,pxPerMm:0},{...saved,pxPerMm:17},{...saved,signature:{}}])assert.equal(validCalibration(value)||false,false);
});

import {diagramViewport} from '../src/web/viewport.mjs';
test('viewport keeps physical scale through resize, preserves data and leaves the claim on manual zoom or display changes',t=>{
 const prior={window:globalThis.window,localStorage:globalThis.localStorage,ResizeObserver:globalThis.ResizeObserver};
 t.after(()=>{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}});
 const events=new Map();let resize;
 globalThis.window={devicePixelRatio:1.25,screen:{width:1920,height:1080,colorDepth:24},visualViewport:{scale:1,addEventListener(){}},addEventListener:(k,v)=>events.set(k,v),matchMedia:()=>({addEventListener(){}})};
 globalThis.localStorage={getItem:()=>JSON.stringify({version:1,pxPerMm:4,signature})};
 globalThis.ResizeObserver=class{constructor(fn){resize=fn;}observe(){}};
 const button=()=>({setAttribute(k,v){this[k]=v;}}),actual=button(),fit=button(),inside=button(),calibrate=button(),actualStatus={textContent:''};
 const canvas={clientWidth:800,clientHeight:500,classList:{add(){},remove(){}},addEventListener(){},setAttribute(){},getBoundingClientRect(){return {left:0,top:0};},replaceChildren(){}};
 const svg={style:{},viewBox:{baseVal:{x:-100,y:-200,width:1400,height:1200}}};
 const paper={width:1000,height:1000*210/297,visiblePaper:{preset:'a4',orientation:'landscape'},originX:0,originY:0},original=JSON.stringify(paper);
 const view=diagramViewport(canvas,{actual,fit,inside,calibrate,actualStatus});view.show('A4',svg,paper);actual.onclick();
 const scale=()=>Number(/scale\(([^)]+)/.exec(svg.style.transform)[1]);
 assert.equal(scale(),1.188);assert.equal(actual['aria-pressed'],'true');assert.match(actualStatus.textContent,/1:1/);
 canvas.clientWidth=400;resize();assert.equal(scale(),1.188,'overflow is not fitted away');
 inside.onclick();assert.equal(actual['aria-pressed'],'false');assert.equal(actualStatus.textContent,'');
 actual.onclick();fit.onclick();assert.equal(actual['aria-pressed'],'false');
 actual.onclick();window.devicePixelRatio=2;events.get('resize')();assert.equal(actual['aria-pressed'],'false');assert.match(actualStatus.textContent,/changed/);
 assert.equal(JSON.stringify(paper),original,'screen actions never modify page data');
 window.devicePixelRatio=1.25;events.get('resize')();actual.onclick();
 view.show('A4',svg,{...paper,visiblePaper:{preset:'dynamic'}});assert.equal(actual.disabled,true);assert.equal(actual['aria-pressed'],'false');
});

import {buildPages} from '../src/web/diagram/index.mjs';
import {adaptiveProject} from './fixtures/adaptive-port-maps.mjs';
import {sampleSite} from '../src/web/sample.mjs';
test('real grown Dynamic builder pages cannot masquerade as physical custom paper',()=>{
 const dynamic=adaptiveProject('dynamic'),page=buildPages(dynamic).find(p=>p.portMap?.switchportSheet);
 assert.ok(page);assert.equal(page.paper.preset,'custom');assert.equal(page.dynamic,undefined);
 const screenPage={...page,actualSizePaper:actualSizePaper(dynamic,page)};
 assert.equal(actualSizeScale(screenPage,4),null);
 const inherited=adaptiveProject();delete inherited.layout.pageSetup.visible.groups.ports;
 inherited.layout.pageSetup.visible.default={preset:'dynamic'};
 const grown=buildPages(inherited).find(p=>p.portMap?.switchportSheet);
 assert.equal(grown.paper.preset,'custom');
 assert.equal(actualSizeScale({...grown,actualSizePaper:actualSizePaper(inherited,grown)},4),null,'preferred Letter cannot legitimize a grown custom canvas');
 const sample=sampleSite(),letter=buildPages(sample).find(p=>p.portMap?.switchportSheet);
 assert.ok(actualSizeScale({...letter,actualSizePaper:actualSizePaper(sample,letter)},4)>0,'implicit Letter remains available');
 sample.layout={switchport:{enabled:true,deviceIds:['sw-1']}};
 const report=buildPages(sample).find(p=>p.family==='switchports');
 assert.ok(report);assert.ok(Math.abs(actualSizeScale({...report,actualSizePaper:actualSizePaper(sample,report)},4)*report.width-297*4)<1e-7,'independent A4 reports retain physical paper');
 const fixed=adaptiveProject('a4'),a4=buildPages(fixed).find(p=>p.portMap?.switchportSheet);
 assert.ok(Math.abs(actualSizeScale({...a4,actualSizePaper:actualSizePaper(fixed,a4)},4)*a4.width-297*4)<1e-7);
});
