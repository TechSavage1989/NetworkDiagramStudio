import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {deviceFaceplate} from '../src/web/diagram/faceplate.mjs';
import {textWidth} from '../src/web/diagram/labels.mjs';
import {sampleSite} from '../src/web/sample.mjs';
import {wirelessApLab} from './fixtures/wireless-ap-layout.mjs';

// Undo, Redo and returning to an earlier setting reuse a recent build of each
// page family; the result must be exactly the build it replaces.
test('undo and redo reuse recent builds with identical pages',()=>{
 const original=wirelessApLab(12,2),cache=new Map(),first=buildPages(original,{cache}),wireless=cache.get('wireless'),core=cache.get('core');
 const edited={...original,layout:{...original.layout,textStyles:{title:{size:13}}}},changed=buildPages(edited,{cache});
 assert.notEqual(cache.get('wireless'),wireless,'a style edit rebuilds wireless sheets');
 const undo=buildPages(original,{cache});
 assert.equal(cache.get('wireless'),wireless,'undo reuses the earlier wireless build');assert.equal(cache.get('core'),core,'undo reuses the earlier core build');
 assert.deepEqual(undo.map(p=>p.svg),first.map(p=>p.svg));
 const redo=buildPages(edited,{cache});assert.deepEqual(redo.map(p=>p.svg),changed.map(p=>p.svg));
 assert.deepEqual(redo.map(p=>p.svg),buildPages(edited).map(p=>p.svg),'a reused build matches a cold build');
 // A caller changing a returned scene never alters a remembered build.
 undo[0].items.push({type:'text',value:'CALLER ONLY'});
 assert.equal(buildPages(original,{cache}).some(p=>p.items.some(i=>i.value==='CALLER ONLY')),false);
 // A cleared cache (a newly opened project) starts a fresh history.
 cache.clear();buildPages(edited,{cache});const fresh=cache.get('wireless');buildPages(original,{cache});assert.notEqual(cache.get('wireless'),wireless);assert.notEqual(cache.get('wireless'),fresh);
});

test('memoized faceplates are independent exact copies',()=>{
 for(const device of sampleSite().devices.filter(d=>d.kind==='switch'||d.kind==='firewall')){
  const first=deviceFaceplate(device,{padding:.6});if(!first)continue;
  const second=deviceFaceplate(device,{padding:.6});
  assert.notEqual(first,second);assert.deepEqual(first,second);
  assert.deepEqual(first,structuredClone(first));
  first.children.push({type:'text',value:'CALLER ONLY'});first.ports[Object.keys(first.ports)[0]][0]=-99;
  const third=deviceFaceplate(device,{padding:.6});
  assert.deepEqual(third,second,'a caller change never reaches the memo');
 }
});

test('table-driven text widths match the measured character classes',()=>{
 const reference=(value,size=12,bold=false)=>{let w=0;for(const c of String(value))w+=/[MW@%#]/.test(c)?.94:/[ilI1.,:;!|' ]/.test(c)?.29:/[A-Z]/.test(c)?.72:/[0-9]/.test(c)?.57:.56;return Math.ceil(w*size*(bold?1.06:1)+6);};
 const samples=[...Array.from({length:256},(_,i)=>String.fromCharCode(i)),'LAB-AP-2-15','Gi1/0/48','Wireless Connections 1','é中😀x','MW@%# ilI1.,:;!|\'','','  '];
 for(const value of samples)for(const [size,bold] of [[12,false],[9.5,true],[7.25,false]])assert.equal(textWidth(value,size,bold),reference(value,size,bold),JSON.stringify(value));
});
