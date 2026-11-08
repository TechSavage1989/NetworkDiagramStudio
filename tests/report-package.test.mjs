import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {sampleSite} from '../src/web/sample.mjs';
import {browserReportPackage} from '../src/web/report-package.mjs';
import {buildReportPackage} from '../src/web/reports/index.mjs';
import {exportPdf} from '../src/web/report-export.mjs';

const project=()=>{const p=sampleSite();p.devices=p.devices.filter(d=>d.kind==='switch');p.layout={switchport:{enabled:true,combined:true,deviceIds:p.devices.map(d=>d.id)}};return p;};
const png=async page=>new TextEncoder().encode('synthetic PNG for '+page.name);
const pdf=async pages=>new TextEncoder().encode('synthetic PDF for '+pages.map(p=>p.name).join(','));

test('browser report packages retain the eight standard outputs, shared booklets, hashes and independent duplicate names',async()=>{
 const p=project();p.devices[1].name=p.devices[0].name;const result=await browserReportPackage(p,{png,pdf});
 assert.equal(result.complete,true);assert.equal(result.items.length,2);assert.notEqual(result.items[0].directory,result.items[1].directory);
 for(const item of result.items){assert.equal(item.files.length,8);const base=item.directory+'/',inventory=result.parts[base+'inventory.json'],digest=createHash('sha256').update(inventory).digest('hex');assert.match(result.parts[base+'validation-report.txt'],new RegExp('Inventory SHA-256 '+digest));assert.ok(result.parts[base+'a4-booklet.pdf']);}
 for(const name of ['workspace-a4-diagrams.pdf','workspace-a4-booklets.pdf','workspace-sheet-001.png','workspace-layout.json','workspace-palette.json','workspace-export.json'])assert.ok(result.parts[name],name);
 assert.equal(JSON.parse(result.parts['workspace-export.json']).items.length,2);
});

test('one renderer failure preserves valid formats and other devices, and records the failure instead of claiming success',async()=>{
 const p=project();let calls=0;const result=await browserReportPackage(p,{png:async page=>{if(++calls===1)throw Error('Injected PNG capacity failure');return png(page);},pdf});
 assert.equal(result.success,true);assert.equal(result.complete,false);assert.equal(result.items[0].success,false);assert.equal(result.items[1].success,true);
 const base=result.items[0].directory+'/';assert.ok(result.parts[base+'a4-one-page.png']);assert.ok(result.parts[base+'a4-one-page.pdf']);assert.ok(result.parts[base+'a4-booklet.pdf']);assert.equal(result.parts[base+'wall-chart.png'],undefined);assert.match(result.parts[base+'validation-report.txt'],/Injected PNG capacity failure/);
});

test('vector PDF exporter runs offline with embedded fonts and preserves A4 page geometry',async()=>{
 const require=createRequire(import.meta.url);globalThis.jspdf=require('../src/web/vendor/jspdf.umd.min.js');
 const report=buildReportPackage(project()),pages=report.items[0].pages.onePage,bytes=await exportPdf(pages,{title:'Fictional switch'}),text=new TextDecoder('latin1').decode(bytes);
 assert.equal(text.startsWith('%PDF-'),true);const box=/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);assert.ok(box);assert.ok(Math.abs(Number(box[1])-841.889764)<.001);assert.ok(Math.abs(Number(box[2])-595.275591)<.001);assert.match(text,/\/FontFile2/);assert.match(text,/Fictional switch/);assert.ok(bytes.length>50000);
 delete globalThis.jspdf;
});


test('case-insensitive folder suffix collisions retain every independent device package',async()=>{
 const p=project(),source=p.devices[0];p.devices=['A','a-3','a'].map((name,index)=>({...structuredClone(source),id:'independent-'+index,name}));p.layout.switchport.deviceIds=p.devices.map(device=>device.id);
 const result=await browserReportPackage(p,{png,pdf});assert.equal(result.complete,true);assert.equal(new Set(result.items.map(item=>item.directory.toLowerCase())).size,3);assert.equal(Object.keys(result.parts).filter(name=>name.endsWith('/inventory.json')).length,3);
 const manifest=JSON.parse(result.parts['workspace-export.json']);assert.equal(manifest.items.length,3);
 for(const [index,item] of result.items.entries()){assert.equal(item.files.length,8);assert.equal(JSON.parse(result.parts[item.directory+'/inventory.json']).hostname,p.devices[index].name);assert.equal(manifest.items[index].directory,item.directory);}
});
