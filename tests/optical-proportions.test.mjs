import test from 'node:test';
import assert from 'node:assert/strict';
import {connectorEnvelope} from '../src/web/diagram/connector-geometry.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {devicePoint} from '../src/web/diagram/device-geometry.mjs';
import {unzip} from '../src/web/zip.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('optical front-face aspects use sourced form-factor proportions without stretching RJ45',()=>{
 for(const form of ['SFP','SFP+','SFP28']){const e=connectorEnvelope(form);near(e.w/e.h,13.7/8.6);assert.ok(e.h>.014);}
 const q=connectorEnvelope('QSFP28');near(q.w/q.h,18.35/8.5);
 assert.deepEqual(connectorEnvelope('RJ45'),{w:.025,h:.020});
});
test('optical modules and stacks retain socket centers and common optical aspect',()=>{
 for(const device of [{model:'JL255A'},{model:'J9850A',modules:[{slot:'A',model:'J9993A'}]},{model:'JL558A',stackMembers:[{id:'1',model:'JL558A'},{id:'2',model:'JL558A'}]}]){
  const panel=deviceFaceplate(device),faces=panel.children.filter(c=>c.socketPart===0&&/SFP/i.test(c.socketForm));assert.ok(faces.length);
  for(const face of faces){const ratio=connectorEnvelope(face.socketForm);near(face.w/(face.h/panel.ratio),ratio.w/ratio.h);if(face.anchorOrigin){near(face.x+face.w/2,face.anchorOrigin[0]);near(face.y+face.h/2,face.anchorOrigin[1]);}}
 }
});
test('installed generic optics and module legend preserve one aspect with endpoint glue in SVG/Visio',async()=>{
 const project=sampleSite(),pages=buildPages(project),page=pages.find(p=>p.coreDeviceIds),plugs=page.items.filter(i=>i.kind==='plug'&&!i.asset);assert.ok(plugs.length);
 for(const plug of plugs){near(plug.w/plug.h,13.7/8.6);const face=plug.children.find(c=>c.name==='Module face');assert.ok(face);near(face.w*plug.w/(face.h*plug.h),13.7/8.6);}
 for(const cable of page.items.filter(i=>i.type==='path'))for(const [end,point] of [[cable.from,cable.points[0]],[cable.to,cable.points.at(-1)]])if(end?.device){const device=page.items.find(i=>i.key===end.device);const p=devicePoint(device,...device.ports[end.port]);near(point[0],p[0]);near(point[1],p[1]);}
 assert.match(page.svg,/Module face/);
 const zip=await unzip(await exportVisio(project,pages).arrayBuffer());assert.ok([...zip.keys()].some(k=>k==='visio/pages/page1.xml'));
});
test('PDF preserves generic module face aspect instead of stretching it to its frame',async()=>{
 const {createRequire}=await import('node:module'),{inflateSync}=await import('node:zlib'),{exportPdf}=await import('../src/web/report-export.mjs'),require=createRequire(import.meta.url),previous=globalThis.jspdf;
 globalThis.jspdf=require('../src/web/vendor/jspdf.umd.min.js');
 try{
  const plug=buildPages(sampleSite()).find(p=>p.coreDeviceIds).items.find(i=>i.kind==='plug'&&!i.asset);const body={...plug,x:10,y:10,w:137,h:86};
  const bytes=Buffer.from(await exportPdf([{name:'Fictional optical geometry',width:180,height:120,items:[body]}])),text=bytes.toString('latin1'),streams=[];
  for(const match of text.matchAll(/<<[^>]*\/Length\s+(\d+)[^>]*>>\s*stream\r?\n/g)){const start=match.index+match[0].length,data=bytes.subarray(start,start+Number(match[1]));streams.push((/\/FlateDecode/.test(match[0])?inflateSync(data):data).toString('latin1'));}
  const rectangles=streams.join('\n').matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) re/g);assert.ok([...rectangles].some(m=>Math.abs(Math.abs(Number(m[3])/Number(m[4]))-13.7/8.6)<1e-8));
 }finally{if(previous===undefined)delete globalThis.jspdf;else globalThis.jspdf=previous;}
});
