import test from 'node:test';import assert from 'node:assert/strict';
import {arrangeBoxes,arrangeAnchors} from '../src/web/arrange.mjs';
import {filterStencilMasters} from '../src/web/stencil-search.mjs';
import {buildPages,exportVisio} from '../src/web/diagram/index.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {faceplates} from '../src/web/imports/faceplates.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {drawingObjects,drawingBounds,moveDrawingItems} from '../src/web/drawing-edits.mjs';
import {crossesText,intersects} from '../src/web/diagram/labels.mjs';
import {unzip} from '../src/web/zip.mjs';
const core=site=>buildPages(site).filter(p=>p.title.startsWith('Core Network'));
function clearLabels(p){const texts=p.items.filter(i=>i.type==='text'),paths=p.items.filter(i=>i.type==='path');for(const a of texts.filter(i=>i.labelRole||i.titleOwner)){for(const b of texts)if(a!==b)assert.ok(!intersects(a,b,0),a.value+' overlaps '+b.value);for(const path of paths){const own=a.background&&a.linkId!=null&&a.linkId===path.linkId;assert.ok(own?!(path.hops||[]).some(hop=>intersects(hop,a,0)):!crossesText(path.points,a,0),a.value+' crosses '+path.name);}}}
test('core routing uses straight or two-bend routes between facing jacks and four bends for same-side jacks',()=>{
 for(const [ap,bp,expected] of [['1/1/26','1/1/25',0],['1/1/26','1/1/27',2],['1/1/25','1/1/25',4]]){
  const site={devices:['a','b'].map(id=>({id,name:'LAB-'+id,kind:'switch',model:'JL724A',ports:[{name:ap},{name:bp}]})),links:[{a:'a',ap,b:'b',bp,media:'DAC',speed:'10 Gbps'}]},page=core(site)[0],path=page.items.find(i=>i.type==='path');
  assert.equal(path.points.length-2,expected,ap+' / '+bp);for(let i=1;i<path.points.length;i++)assert.ok(path.points[i][0]===path.points[i-1][0]||path.points[i][1]===path.points[i-1][1]);clearLabels(page);
  // Interior segments cannot cut through either endpoint chassis.
  for(const d of page.items.filter(i=>i.kind==='switch'))for(let i=2;i<path.points.length-1;i++)assert.ok(!crossesText([path.points[i-1],path.points[i]],d,0));
 }
});
test('diagram legends have the actual cable colors and remain editable in SVG and native Visio',async()=>{
 const site=sampleSite(),p=core(site)[0],text=p.items.find(i=>i.editKey?.endsWith('|legend|0|text')),swatch=p.items.find(i=>i.editKey?.endsWith('|legend|0|swatch'));
 assert.equal(text.value,'SR fiber');assert.equal(swatch.fill,'#FF0000');assert.ok(buildPages(site).filter(p=>p.title==='Wireless Connections').every(p=>p.items.some(i=>i.value==='LINK COLORS')));
 const port=p.items.find(i=>i.labelRole==='port'),title=p.items.find(i=>i.titleOwner);
 site.layout={drawingEdits:{[text.editKey]:{value:'Optical link',color:'#C32B65',x:text.x+12,y:text.y+3},[title.editKey]:{color:'#006775'},[port.editKey]:{color:'#815AC0'},[swatch.editKey]:{x:swatch.x+12}}};const ps=buildPages(JSON.parse(JSON.stringify(site)));assert.match(ps[0].svg,/Optical link/);assert.equal(ps[0].items.find(i=>i.editKey===text.editKey).x,text.x+12);
 for(const [key,color] of [[text.editKey,'#C32B65'],[title.editKey,'#006775'],[port.editKey,'#815AC0']])assert.equal(ps[0].items.find(i=>i.editKey===key).color,color);
 const files=await unzip(await exportVisio(site,ps).arrayBuffer()),xml=new TextDecoder().decode(files.get('visio/pages/page1.xml'));assert.match(xml,/Optical link/);for(const color of ['#C32B65','#006775','#815AC0'])assert.ok(xml.includes('<Cell N="Color" V="'+color+'"'));
});
test('alignment preserves outer extents and equal gaps for different-size diagram items',()=>{
 const boxes=[{key:'a',x:10,y:10,w:20,h:10},{key:'b',x:60,y:50,w:30,h:20},{key:'c',x:130,y:80,w:40,h:15}],moves=arrangeBoxes(boxes,'space-x'),positions=boxes.map(b=>({...b,x:b.x+moves.get(b.key)[0]}));
 assert.equal(positions[0].x,10);assert.equal(positions[2].x+positions[2].w,170);assert.equal(positions[1].x-positions[0].x-positions[0].w,positions[2].x-positions[1].x-positions[1].w);
 const aligned=arrangeBoxes(boxes,'center-y');assert.equal(new Set(boxes.map(b=>b.y+b.h/2+aligned.get(b.key)[1])).size,1);
});
test('port alignment and distribution leave unselected sockets untouched',()=>{
 const original={p1:[.1,.2],p2:[.3,.25],p3:[.8,.3],other:[.9,.8]},row=arrangeAnchors(original,['p1','p2','p3'],'row','p2'),spaced=arrangeAnchors(row,['p1','p2','p3'],'space-x');assert.deepEqual([spaced.p1[1],spaced.p2[1],spaced.p3[1]],[.25,.25,.25]);assert.ok(Math.abs(spaced.p2[0]-.45)<1e-9);assert.deepEqual(spaced.other,original.other);assert.deepEqual(original.p1,[.1,.2]);
 const col=arrangeAnchors(original,['p1','p2'],'column','p1');assert.equal(col.p2[0],.1);
});
test('master search matches case, SKU separators and multiple terms without changing the catalog',()=>{
 const items=[{key:'a',name:'FG-120G front'},{key:'b',name:'FG-120G rear'},{key:'c',name:'JL675A Switch'}];assert.deepEqual(filterStencilMasters(items,'fg120g FRONT').map(i=>i.key),['a']);assert.equal(filterStencilMasters(items,'').length,3);assert.equal(filterStencilMasters(items,'missing').length,0);assert.equal(items.length,3);
});
test('drag patches preserve glued cable ends and survive project reopen',()=>{
 const site=sampleSite(),p=core(site)[0],device=p.items.find(i=>i.kind==='switch'),title=p.items.find(i=>i.titleOwner===device.sourceId),cable=p.items.find(i=>i.type==='path');
 site.layout={drawingEdits:moveDrawingItems(p,{},new Map([[device.editKey,[5,0]],[title.editKey,[18,0]],[cable.editKey,[10,7]]]))};const next=core(JSON.parse(JSON.stringify(site)))[0],moved=next.items.find(i=>i.editKey===device.editKey),line=next.items.find(i=>i.editKey===cable.editKey);assert.equal(moved.x,device.x+5);assert.equal(next.items.find(i=>i.editKey===title.editKey).x,title.x+18);assert.deepEqual(line.points[0],[line.from.x,line.from.y]);assert.deepEqual(line.points.at(-1),[line.to.x,line.to.y]);for(let i=1;i<line.points.length;i++)assert.ok(line.points[i][0]===line.points[i-1][0]||line.points[i][1]===line.points[i-1][1]);clearLabels(next);
 assert.ok(drawingObjects(next).every(i=>drawingBounds(i)!==null||i.type==='vector'));
});
test('every sourced native hardware panel has bounded socket coordinates',()=>{for(const p of faceplates){const g=deviceFaceplate({model:p.models[0]});assert.ok(g);for(const pt of Object.values(g.ports))assert.ok(pt.every(v=>Number.isFinite(v)&&v>=0&&v<=1));}});
