import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildPages,exportVisio,exportStencil} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {unzip} from '../src/web/zip.mjs';

const decode=new TextDecoder();
const widthCell=/<Cell N="LineWeight" V="([^"]+)" U="PT" F="([^"]+) pt"\/>/g;
function validateWidths(xml){
 const cells=[...xml.matchAll(widthCell)],all=xml.match(/<Cell N="LineWeight" /g)||[];assert.equal(cells.length,all.length);assert.ok(cells.length);
 for(const [,cached,points] of cells){assert.ok(Number(cached)>0);assert.ok(Number(points)>0);assert.ok(Math.abs(Number(cached)-Number(points)/72)<=.0000051,'cached inch width differs from point formula');}
 return cells;
}

test('native Visio line weights cache inches and declare explicit editable point formulas for every supported width',async()=>{
 const site=sampleSite(),original=buildPages(site),cables=original.flatMap(page=>page.items.filter(item=>item.type==='path')).slice(0,4),widths=[.5,2.2,4,8];assert.equal(cables.length,widths.length);site.layout={drawingEdits:Object.fromEntries(cables.map((cable,index)=>[cable.editKey,{weight:widths[index]}]))};const pages=buildPages(site),parts=await unzip(await exportVisio(site,pages).arrayBuffer());
 const all=[...parts].filter(([name])=>name.endsWith('.xml')).map(([,bytes])=>decode.decode(bytes)).join('');validateWidths(all);
 const connectorXml=[...parts].filter(([name])=>/^visio\/pages\/page\d+\.xml$/.test(name)).map(([,bytes])=>decode.decode(bytes)).join('');
 for(const width of widths){const cell=[...connectorXml.matchAll(widthCell)].find(([,cached,points])=>Math.abs(Number(cached)-width/96)<.0000051&&Math.abs(Number(points)-width*.75)<1e-8);assert.ok(cell,'missing explicit weight '+width);assert.ok(!cell[0].includes('GUARD'));}
 assert.match(connectorXml,/<Connect [^>]*FromCell="BeginX"/);assert.match(connectorXml,/<Connect [^>]*FromCell="EndX"/);
});

test('default cable width matches the legend bar and survives both native drawing and stencil package checks',async()=>{
 const site=sampleSite();site.stencils={native:{id:'native',name:'Fictional line-weight test panel',view:'front',width:10,height:1,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5F8AAAAASUVORK5CYII=',anchors:{'1/1/25':[.2,.3],'1/1/27':[.8,.7]},native:{paths:[{commands:[['M',0,0],['L',1,0],['L',1,1],['L',0,1],['Z']],fill:'#EEEEEE',stroke:'#16364A',weight:.003}],texts:[]}}};site.devices.find(device=>device.id==='sw-1').stencilId='native';const pages=buildPages(site),core=pages[0],line=core.items.find(item=>item.type==='path'),legend=core.items.find(item=>item.legendEntry&&item.type==='rect'&&item.linkType===line.linkType);assert.equal(line.weight,3);assert.equal(line.weight,legend.h);
 const folder=mkdtempSync(join(tmpdir(),'nds-visio-width-'));
 try{for(const [name,blob] of [['drawing.vsdx',exportVisio(site,pages)],['hardware.vssx',exportStencil(site,pages)]]){const bytes=new Uint8Array(await blob.arrayBuffer()),parts=await unzip(bytes.buffer),xml=[...parts].filter(([part])=>part.endsWith('.xml')).map(([,content])=>decode.decode(content)).join('');validateWidths(xml);if(name.endsWith('.vsdx'))assert.ok(/<Cell N="LineWeight" V="0.03125" U="PT" F="2.25 pt"\/>/.test(xml));const path=join(folder,name);writeFileSync(path,bytes);const check=spawnSync('python',['scripts/check-visio-package.py',path],{encoding:'utf8'});assert.equal(check.status,0,check.stdout+check.stderr);}}
 finally{rmSync(folder,{recursive:true,force:true});}
});
