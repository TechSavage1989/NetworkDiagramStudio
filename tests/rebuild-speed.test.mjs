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
 const edited={...original,layout:{...original.layout,presentation:{defaults:{wirelessApScale:1.2}}}},changed=buildPages(edited,{cache});
 assert.notEqual(cache.get('wireless'),wireless,'an AP size edit rebuilds wireless sheets');
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

// Finished pages are reused only while their draft, position, layout and
// drawing edits are unchanged. Port maps drawn as Switchport sheets are
// drafted by the port-map family but carry Switchport names; their edits
// must still finish them again.
test('reused finished pages always match a cold build after any page edit',()=>{
 const cache=new Map();let project=sampleSite();project.layout={...project.layout,pageSetup:{visible:{default:{preset:'letter',orientation:'landscape'}}}};
 const same=(label)=>{const warm=buildPages(project,{cache}),cold=buildPages(project);assert.deepEqual(warm.map(p=>[p.name,p.svg]),cold.map(p=>[p.name,p.svg]),label);return warm;};
 const pages=same('first build');
 const families=[...new Set(pages.map(p=>p.name.split('|')[0].replace(/ \d+$/,'')))];assert.ok(families.length>=4);
 for(const page of pages){
  const text=page.items.find(i=>i.type==='text'&&i.editKey&&!i.pageFrame);if(!text)continue;
  const p=text.presentation||{scale:1},x=(text.x-(p.x||0))/p.scale+7;
  project={...project,layout:{...project.layout,drawingEdits:{...project.layout.drawingEdits,[text.editKey]:{x}}}};
  const after=same('after moving text on '+page.name);
  assert.notEqual(after.find(q=>q.name===page.name).svg,pages.find(q=>q.name===page.name).svg,page.name+' shows its edit');
 }
 same('unchanged after every edit');
});

// Global text styles are applied when pages are finished: changing one never
// plans a page again, yet every page matches a cold build.
test('a text style change reuses every planned page',()=>{
 const original=wirelessApLab(12,2),cache=new Map();buildPages(original,{cache});const drafts=['core','ports','wireless'].map(f=>cache.get(f));
 const styled={...original,layout:{...original.layout,textStyles:{deviceNames:{size:12,color:'#AA0011'},linkLabels:{bold:true}}}};
 const warm=buildPages(styled,{cache});
 assert.deepEqual(['core','ports','wireless'].map(f=>cache.get(f)),drafts,'no family is planned again');
 assert.deepEqual(warm.map(p=>p.svg),buildPages(styled).map(p=>p.svg));
});
