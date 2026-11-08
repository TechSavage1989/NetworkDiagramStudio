import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';

test('moving core hardware reuses independent report planners without retaining stale endpoints',()=>{
 const project=sampleSite(),cache=new Map(),initial=buildPages(project,{cache}),page=initial.find(p=>p.coreDeviceIds),body=page.items.find(item=>item.sourceId==='sw-2'&&item.type==='device'),ports=cache.get('ports'),wireless=cache.get('wireless');
 project.layout={...project.layout,drawingEdits:{[body.editKey]:{x:body.x+60}}};
 const moved=buildPages(project,{cache}),uncached=buildPages(project);
 assert.equal(cache.get('ports'),ports);assert.equal(cache.get('wireless'),wireless);
 assert.deepEqual(moved.map(p=>p.svg),uncached.map(p=>p.svg));
 assert.notEqual(moved.find(p=>p.coreDeviceIds).svg,page.svg);
});

test('cached scenes remain independent through page numbering, drawing scale and caller changes',()=>{
 const project=sampleSite(),cache=new Map(),first=buildPages(project,{cache});first[0].items[0].fill='#ff0000';first[0].items.push({type:'text',value:'CALLER ONLY'});
 const second=buildPages(project,{cache});assert.deepEqual(second.map(p=>p.svg),buildPages(project).map(p=>p.svg));
 assert.equal(second.some(p=>p.items.some(i=>i.value==='CALLER ONLY')),false);
 project.layout={pageNumbers:{start:7,pad:3},presentation:{defaults:{drawingScale:1.25}}};
 assert.deepEqual(buildPages(project,{cache}).map(p=>p.svg),buildPages(project).map(p=>p.svg));
});

test('report settings add measured switchport sheets without rebuilding unchanged core routes',()=>{
 const project=sampleSite(),cache=new Map();buildPages(project,{cache});const core=cache.get('core');
 project.layout={...project.layout,switchport:{enabled:true,deviceIds:['sw-1','sw-2'],combined:true,reportType:'workspace',title:'Fictional port reports'}};
 // Port maps use the same builder scene; this checks the reports family.
 const pages=buildPages(project,{cache}),reports=pages.filter(p=>p.switchportReport&&p.family==='switchports');
 assert.equal(cache.get('core'),core);assert.ok(reports.length);
 for(const page of reports){assert.equal(page.family,'switchports');assert.equal(page.items.filter(item=>item.pageFrame==='footer-name').length,0);assert.match(page.svg,/Fictional port reports/);}
 assert.deepEqual(pages.map(p=>p.svg),buildPages(project).map(p=>p.svg));
});
