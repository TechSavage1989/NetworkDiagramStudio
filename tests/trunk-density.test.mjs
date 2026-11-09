import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages as buildPaperPages,exportVisio} from '../src/web/diagram/index.mjs';
import {intersects} from '../src/web/diagram/labels.mjs';
import {unzip} from '../src/web/zip.mjs';
const fixture=(count,vlans,long=false)=>({name:'Trunk Lab',devices:Array.from({length:count},(_,i)=>({id:'sw'+i,name:long?'LAB distribution switch '+i+' with complete department designation':'LAB'+i,kind:'switch',ports:[{name:'1/1/49',native:1,tagged:Array.from({length:vlans-1},(_,n)=>n+2)}],vlans:Array.from({length:vlans},(_,n)=>({id:n+1,name:long?'Department '+(n+1)+' with a complete readable VLAN description':'VLAN'+(n+1)}))})),links:[]});
const matrices=p=>buildPages(p).filter(p=>p.title==='Trunk VLANs');
function clear(pages){for(const p of pages){const texts=p.items.filter(i=>i.type==='text'&&i.y>=188&&i.y<851);for(const a of texts){assert.ok(a.x>=36&&a.x+a.w<=1164.01&&a.y+a.h<=851.01);for(const b of texts)if(a!==b)assert.ok(!intersects(a,b,0),a.value+' / '+b.value);assert.ok(!a.value.includes('…'));}}}
test('short trunk headings use available width beyond six columns and compact readable rows',()=>{
 const p=matrices(fixture(8,22));assert.equal(p.length,1);clear(p);for(let i=0;i<8;i++)assert.ok(p[0].items.some(t=>t.value==='LAB'+i));assert.equal(p[0].items.filter(t=>t.type==='text'&&/^\d+    VLAN/.test(t.value)).length,22);assert.equal(p[0].items.filter(t=>t.type==='text'&&['N','T','·'].includes(t.value)).length,8*22);
 const more=matrices(fixture(8,23));assert.equal(more.length,2);clear(more);assert.equal(more.flatMap(p=>p.items).filter(t=>t.type==='text'&&/^\d+    VLAN/.test(t.value)).length,23);
});
test('long trunk labels wrap fully and spill only when measured content needs another sheet',async()=>{
 const project=fixture(8,24,true),pages=matrices(project);assert.ok(pages.length>1);clear(pages);
 for(let i=0;i<8;i++)for(let v=1;v<=24;v++)assert.ok(pages.some(p=>p.items.some(t=>t.value===project.devices[i].name)&&p.items.some(t=>t.value===v+'    '+project.devices[i].vlans[v-1].name)));
 const files=await unzip(await exportVisio(project,pages).arrayBuffer()),xml=[...files].filter(([n])=>/^visio\/pages\/page\d+\.xml$/.test(n)).map(([,b])=>new TextDecoder().decode(b)).join('');assert.match(xml,/complete/);assert.match(xml,/designation/);assert.match(xml,/description/);
});

// Fixed-paper regression coverage; new projects use a dynamic canvas.
function buildPages(project){return buildPaperPages({...project,layout:{...project.layout,documentation:'full',pageNumbers:{show:true},pageSetup:project.layout?.pageSetup||{default:{preset:'original'}}}});}
