import test from 'node:test';
import assert from 'node:assert/strict';
import {bridge,svgPage} from '../src/web/diagram/scene.mjs';

const line=(key,points,color='#546D79',weight=6)=>({type:'path',editKey:key,name:key,points,color,weight});
const fixture=()=>({name:'Crossing',title:'Fictional cable crossing',width:180,height:140,originX:-20,originY:-30,items:[
 {type:'rect',editKey:'artwork',x:-20,y:-30,w:180,h:140,fill:'#B0C4D5',stroke:'none',weight:1},
 line('across',[[0,40],[140,40]]),line('jump',[[70,-20],[70,100]],'#185B68')
]});
const masked=(svg,key)=>svg.match(new RegExp('<path class="diagram-cable" data-drawing-key="'+key+'"[^>]*mask="url\\(#([^)]*)\\)"'))?.[1];

test('jump clearance masks other cables while preserving the complete visible path and artwork',()=>{
 const page=fixture();bridge(page);const original=JSON.stringify(page),svg=svgPage(page),mask=masked(svg,'across');
 assert.ok(mask,'the underpassing cable has a clearance mask');assert.equal(masked(svg,'jump'),undefined,'a jump never masks its own arc');
 assert.match(svg,new RegExp('<mask id="'+mask+'"[^>]*maskUnits="userSpaceOnUse"[^>]*maskContentUnits="userSpaceOnUse"'));
 const defs=svg.match(/<defs>(.*?)<\/defs>/s)?.[1],paint=svg.replace(/<defs>.*?<\/defs>/s,'');
 assert.ok(defs.includes('class="link-hop-clearance"'));assert.match(defs,/stroke="#000000" stroke-width="9.5"/);
 assert.doesNotMatch(paint,/link-hop-clearance|stroke="#FFFFFF"|<mask|<use/,'no clearance paint covers the actual artwork');
 assert.match(paint,/data-drawing-key="artwork"[^>]+fill="#B0C4D5"/);
 assert.match(paint,/data-drawing-key="across" d="M 0 40 L 140 40"/,'the underlying cable keeps its complete interaction geometry');
 assert.match(paint,/data-drawing-key="jump" d="[^"]+ A [^"]+"/);
 assert.equal(JSON.stringify(page),original,'serialization never modifies the scene');
});

test('tight bundles retain individual or shared jumps regardless of which cable is painted first',()=>{
 const page={title:'Bundle',width:200,height:150,items:[line('bridge',[[10,80],[190,80]],'#185B68',4),line('first',[[85,10],[85,130]]),line('second',[[105,10],[105,130]])]};
 for(const style of ['single','bundle']){
  bridge(page,{style});const svg=svgPage(page);
  assert.equal(page.items[0].commands.filter(c=>c[0]==='A').length,style==='single'?2:1);
  assert.ok(masked(svg,'first'));assert.ok(masked(svg,'second'));assert.equal(masked(svg,'bridge'),undefined);
  const rendered=[...svg.matchAll(/<path class="diagram-cable"[^>]*data-drawing-key="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(rendered,['bridge','first','second']);
 }
});

test('invisible hops do not erase visible connections, and unrelated lines need no mask',()=>{
 const page=fixture();bridge(page);page.items.at(-1).opacity=0;
 assert.doesNotMatch(svgPage(page),/<mask|link-hop-clearance/);
 page.items.at(-1).opacity=.2;page.items.push(line('remote',[[110,85],[150,85]]));bridge(page);
 const svg=svgPage(page);assert.ok(masked(svg,'across'));assert.equal(masked(svg,'remote'),undefined);
});

test('mask IDs stay deterministic but do not collide across distinct printed page geometries',()=>{
 const first=fixture();bridge(first);const before=svgPage(first),ids=svg=>[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(svgPage(JSON.parse(JSON.stringify(first))),before);
 const second=fixture();second.items.at(-1).points=[[90,-20],[90,100]];bridge(second);const after=svgPage(second);
 assert.ok(ids(before).length);assert.ok(ids(before).every(id=>!ids(after).includes(id)),'a multi-page print cannot resolve another scene\'s mask');
 second.items.at(-1).weight=12;bridge(second);assert.ok(ids(svgPage(second)).every(id=>!ids(after).includes(id)),'a wider preview gets its own masks');
 assert.match(before,/<mask[^>]+x="-5" y="35" width="150" height="10"/,'mask bounds cover the complete cable in page coordinates without allocating a full-page surface');
});

test('legend samples remain keyed rectangles with an explicit hover-target class',()=>{
 const page={title:'Legend',items:[{type:'rect',legendEntry:true,linkType:'Copper',editKey:'legend|swatch',name:'Copper color key',x:20,y:20,w:52,h:4,weight:1,fill:'#A8873D',stroke:'none'}]},svg=svgPage(page);
 assert.match(svg,/<rect class="diagram-legend-line" data-link-type="Copper" data-drawing-key="legend\|swatch"/);
 assert.doesNotMatch(svg,/class="diagram-cable"/);
});
