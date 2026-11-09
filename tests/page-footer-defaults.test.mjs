import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPageNumbers,pageNumber,pageFamily} from '../src/web/page-options.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {buildPages,exportVisio,printDocument} from '../src/web/diagram/index.mjs';
import {fitDynamicPage} from '../src/web/diagram/dynamic-page.mjs';
import {unzip} from '../src/web/zip.mjs';

const project=()=>({name:'Fictional footer lab',devices:[1,2].map(i=>({id:'sw-'+i,name:'Lab switch '+i,kind:'switch',model:'Aruba 2930F 24G',ports:Array.from({length:24},(_,n)=>({name:String(n+1),state:'up',native:10,description:'Fictional interface '+(n+1)}))})),links:[]});
test('new and legacy unspecified decorations default off, explicit saved values and formats survive',()=>{
 for(const raw of [undefined,null,{}, {start:3}]){const p=cleanPageNumbers(raw);assert.equal(p.show,false);assert.equal(p.footer,false);assert.equal(pageNumber(raw,0,4),null);}
 for(const show of [false,true])for(const footer of [false,true]){
  const source={pageNumbers:{show,footer,start:7,pad:3,format:'Sheet {page} of {last}'}};
  const saved=cleanLayout(JSON.parse(JSON.stringify(source)),[]);assert.deepEqual(saved.pageNumbers,source.pageNumbers);
  assert.equal(pageNumber(saved.pageNumbers,0,4),show?'Sheet 007 of 010':null);
 }
});
test('disabled decorations reclaim dynamic space without moving content',()=>{
 const scene=()=>({dynamic:true,items:[{type:'rect',editKey:'content',x:36,y:100,w:200,h:300}]});
 const off=scene(),on=scene();fitDynamicPage(off,{layout:{}});fitDynamicPage(on,{layout:{pageNumbers:{show:true,footer:true}}});
 assert.equal(on.height-off.height,42);assert.deepEqual(off.items,on.items);
 for(const pageNumbers of [{show:true,footer:false},{show:false,footer:true}]){const one=scene();fitDynamicPage(one,{layout:{pageNumbers}});assert.equal(one.height,on.height);}
});
test('drawing pages and exports omit default footers and retain map-first order on save/reopen',async()=>{
 const site=project(),pages=buildPages(site),inventory=page=>page.portMap?.bookletRole==='inventory'||/^Port Inventory/.test(page.name);
 const portPages=pages.filter(p=>(p.family||pageFamily(p.name))==='ports');assert.ok(portPages.some(inventory));assert.ok(portPages.some(p=>!inventory(p)));
 const firstInventory=portPages.findIndex(inventory);assert.ok(portPages.slice(firstInventory).every(inventory));
 assert.ok(pages.every(p=>!p.items.some(i=>/^footer-/.test(i.pageFrame||'')||i.reportFooterRole==='page')));
 assert.doesNotMatch(printDocument(pages),/Configured settings and observed state remain separate\./);
 const files=await unzip(await exportVisio(site,pages).arrayBuffer()),xml=[...files].filter(([name])=>/^visio\/pages\/page\d+\.xml$/.test(name)).map(([,data])=>new TextDecoder().decode(data)).join('');
 assert.doesNotMatch(xml,/Configured settings and observed state remain separate\./);
 assert.deepEqual(buildPages(JSON.parse(JSON.stringify(site))).map(p=>p.name),pages.map(p=>p.name));
 site.layout={pageNumbers:{show:true,footer:true,start:7,pad:3,format:'Sheet {page}'}};
 const enabled=buildPages(site);assert.ok(enabled.some(p=>p.items.some(i=>i.pageFrame==='footer-name')));
 for(const [index,page] of enabled.entries())assert.ok(page.items.some(i=>(i.pageFrame==='footer-number'||i.reportFooterRole==='page')&&i.value==='Sheet '+String(7+index).padStart(3,'0')));
});
