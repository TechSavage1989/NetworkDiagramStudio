import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanLabelBacking} from '../src/web/label-backing-settings.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {captionBackingBoxes,labelBackingItems} from '../src/web/diagram/label-backings.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {exportVisio} from '../src/web/diagram/visio.mjs';
import {unzip} from '../src/web/zip.mjs';
const label=overrides=>({type:'text',labelRole:'port',x:20,y:80,w:400,h:40,value:'1/1/48',size:12,bold:true,align:'center',background:'#FFFFFF',color:'#000000',...overrides});
const backings=items=>items.filter(i=>i.captionBacking);

test('label backing settings default to minimal white and preserve explicit zero/transparent through layout cleaning',()=>{
 assert.deepEqual(cleanLabelBacking(),{padding:.5,mode:'white'});
 for(const padding of [-1,NaN,Infinity,21,'4'])assert.equal(cleanLabelBacking({padding}).padding,.5);
 for(const padding of [0,.5,4,20])for(const mode of ['white','transparent'])assert.deepEqual(cleanLayout({labelBacking:{padding,mode}},[]).labelBacking,{padding,mode});
});
test('backing hugs actual lettering independently of saved box size, alignment and manual angle',()=>{
 for(const align of ['left','center','right'])for(const angle of [0,.3,Math.PI/2]){
  const item=label({align,angle}),before=JSON.stringify(item),[box]=captionBackingBoxes(item,.5),[large]=captionBackingBoxes(item,8);
  assert.ok(box.w<50&&box.h<14);assert.equal(large.w-box.w,15);assert.equal(large.h-box.h,15);assert.equal(large.x,box.x-7.5);assert.equal(large.y,box.y-7.5);
  const output=labelBackingItems([item]);assert.equal(backings(output).length,1);assert.deepEqual(output.at(-1),{...item,background:undefined});assert.equal(JSON.stringify(item),before);
 }
 const item=label({value:'1'}),[box]=captionBackingBoxes(item,0);assert.ok(box.w<8);assert.ok(box.h<10);
 assert.equal(captionBackingBoxes(label({value:'  '}),0).length,0);
});
test('transparency emits neither fill nor cutout and does not alter label text or cable geometry',()=>{
 const item=label({}),path={type:'path',points:[[0,100],[500,100]],commands:[['M',0,100],['L',500,100]],color:'#123456',weight:4};
 for(const nativeText of [false,true]){const result=labelBackingItems([path,item],{mode:'transparent',padding:20,nativeText});assert.equal(result.length,2);assert.strictEqual(result[0],path);assert.equal(result[1].background,undefined);assert.equal(result[1].backingPieces,undefined);}
});
test('project setting reaches generated SVG and native Visio without changing persisted manual labels',async()=>{
 const project=sampleSite(),base=buildPages(project),first=base[0].items.find(i=>i.labelRole==='port'),patch={x:first.x+30,y:first.y,w:300,h:40,angle:.3};
 project.layout={...project.layout,labelBacking:{padding:0,mode:'white'},drawingEdits:{[first.editKey]:patch}};
 const original=JSON.stringify(project.layout.drawingEdits),white=buildPages(project),caption=white[0].items.find(i=>i.editKey===first.editKey);
 assert.deepEqual(white[0].labelBacking,{padding:0,mode:'white'});assert.ok(white[0].svg.includes('Caption backing'));assert.ok(backings(labelBackingItems([caption],white[0].labelBacking))[0].commands.some(c=>c.length===3));
 project.layout.labelBacking={padding:9,mode:'transparent'};const reopened={...project,layout:cleanLayout(JSON.parse(JSON.stringify(project.layout)),project.devices.map(d=>d.id))},clear=buildPages(reopened);
 assert.equal(JSON.stringify(project.layout.drawingEdits),original);assert.deepEqual(clear[0].items.find(i=>i.editKey===first.editKey),caption);assert.ok(!clear[0].svg.includes('Caption backing'));
 const parts=await unzip(await exportVisio(reopened,clear).arrayBuffer()),xml=new TextDecoder().decode(parts.get('visio/pages/page1.xml'));
 const shape=xml.split('<Shape ').find(s=>s.includes('<Text>')&&s.includes('>'+first.value+'</Text>'));
 assert.ok(shape);assert.match(shape,/N="FillPattern" V="0"/);assert.match(shape,/N="NoFill" V="1"/);
});
test('padding scales with presentation while multiline backing uses one tight box per line',()=>{
 const item=label({value:'Port 1\nPort 2',w:120,h:60,art:true}),boxes=captionBackingBoxes(item,0);assert.equal(boxes.length,2);assert.ok(boxes.every(b=>b.w<50));
 const normal=labelBackingItems([label({})],{padding:2,nativeText:true})[0].backingPieces[0];
 const scaled=labelBackingItems([label({x:40,y:160,w:800,h:80,size:24,presentation:{fontScale:2}})],{padding:2,nativeText:true})[0].backingPieces[0];
 for(const key of ['x','y','w','h'])assert.ok(Math.abs(scaled[key]-normal[key]*2)<1e-9);
});


test('large multiline padding has a nonoverlapping native union before cable cutouts',()=>{
 const item=label({value:'Port 1\nPort 2',w:120,h:60,art:true});
 const {backingPieces}=labelBackingItems([item],{padding:20,nativeText:true})[0];assert.ok(backingPieces.length>1);
 for(const [i,a] of backingPieces.entries())for(const b of backingPieces.slice(i+1))assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);
});
