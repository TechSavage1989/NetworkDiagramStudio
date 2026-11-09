import test from 'node:test';
import assert from 'node:assert/strict';
import {portMapSheets} from '../src/web/reports/index.mjs';
import {validateReportScene} from '../src/web/reports/scene.mjs';
import {svgPage} from '../src/web/diagram/scene.mjs';
import {readFile} from 'node:fs/promises';
import {standardizedMaps} from './fixtures/standard-port-maps.mjs';
test('chassis, modules, fixed switches and stacks use one reference socket size and media aspect',()=>{
 const pages=standardizedMaps();assert.equal(pages.length,3);
 const widths=new Set();
 for(const page of pages){assert.deepEqual(validateReportScene(page),[]);for(const face of page.items.filter(i=>i.reportPortRole==='native')){widths.add(face.w.toFixed(6));const copper=/RJ|copper/i.test(face.socketForm);assert.ok(Math.abs(face.h/face.w-(copper?23.2:16.2)/25.2)<1e-9);}}
 assert.deepEqual([...widths],['30.000000']);
 assert.equal(pages[0].reportSockets.length,96);assert.equal(pages[1].reportSockets.length,260);assert.equal(pages[2].reportSockets.length,52);
 const svg=svgPage(pages[0]);for(const face of pages[0].items.filter(i=>i.reportPortRole==='native'))assert.ok(svg.includes('width="'+face.w+'"'),'SVG retains standardized vector dimensions');
});
test('native port-map geometry uses identical copper and optical reference ratios for every group',async()=>{
 const source=await readFile(new URL('../desktop/SwitchportReports/Engine/QuickSheet.cs',import.meta.url),'utf8');
 assert.match(source,/PortWidth=25\.2/);assert.match(source,/PortHeight=TabTop\+5\.4/);assert.match(source,/OpticalHeight=16\.2/);assert.match(source,/FaceWidth=>PortWidth\*FaceScale/);assert.match(source,/OpticalFaceHeight=>OpticalHeight\*FaceScale/);
 assert.match(source,/DrawSocket\(output,inv,item.Group,port,item.Placement/);
});
