import test from 'node:test';
import assert from 'node:assert/strict';
import {previewQueue,isolatedPreview} from '../src/web/settings-preview.mjs';
const timers=()=>{let id=0;const jobs=new Map();return {jobs,schedule:fn=>{jobs.set(++id,fn);return id;},cancel:key=>jobs.delete(key),async run(){const entry=jobs.entries().next().value;if(!entry)return;const [key,fn]=entry;jobs.delete(key);return fn();}};};
test('preview candidate and builder cannot mutate authoritative project data',()=>{
 const source={devices:[{id:'a',ports:[{name:'1'}]}],layout:{textStyles:{}}},before=structuredClone(source);
 const value=isolatedPreview(source,draft=>{draft.layout.textStyles.names={scale:1.5};},draft=>{draft.devices[0].ports[0].name='preview only';return draft;});
 assert.deepEqual(source,before);assert.equal(value.layout.textStyles.names.scale,1.5);assert.equal(value.devices[0].ports[0].name,'preview only');
});
test('rapid changes coalesce and only the latest draft is published',async()=>{
 const t=timers(),published=[],states=[];let draft=1;
 const q=previewQueue({...t,read:()=>draft,build:x=>x*2,publish:x=>published.push(x),state:x=>states.push(x)});
 q.request();draft=2;q.request();assert.equal(t.jobs.size,1);await t.run();assert.deepEqual(published,[4]);assert.equal(states.at(-1),'ready');q.dispose();
});
test('late async results, paused work and disposed dialogs cannot replace a newer preview',async()=>{
 const t=timers(),published=[];let release;
 const q=previewQueue({...t,read:()=>1,build:()=>new Promise(resolve=>release=resolve),publish:x=>published.push(x)});
 q.request();const old=t.run();q.pause();release('obsolete');await old;assert.deepEqual(published,[]);
 q.request();q.dispose();await t.run();assert.deepEqual(published,[]);assert.equal(t.jobs.size,0);
});
test('invalid drafts report failure without replacing the last valid preview',async()=>{
 const t=timers(),published=[],states=[];let bad=false;
 const q=previewQueue({...t,read:()=>{if(bad)throw Error('Invalid size');return 1;},build:x=>x,publish:x=>published.push(x),state:(state,error)=>states.push([state,error?.message])});
 q.request();await t.run();bad=true;q.request();await t.run();assert.deepEqual(published,[1]);assert.deepEqual(states.at(-1),['error','Invalid size']);q.dispose();
});
test('slow automatic builds pause future typing updates but allow manual refresh and explicit resume',async()=>{
 const t=timers(),published=[],states=[];let clock=0;
 const q=previewQueue({...t,now:()=>clock,slowAfter:750,read:()=>1,build:x=>{clock+=1800;return x;},publish:x=>published.push(x),state:x=>states.push(x)});
 q.request();await t.run();assert.equal(states.at(-1),'slow');assert.deepEqual(published,[1]);
 q.request();assert.equal(t.jobs.size,0,'typing cannot repeatedly trigger expensive builds');
 q.request(0,{manual:true});await t.run();assert.equal(states.at(-1),'ready');assert.deepEqual(published,[1,1]);
 q.request();assert.equal(t.jobs.size,0,'manual refresh does not re-enable automatic rebuilds');
 q.resume();q.request();await t.run();assert.equal(states.at(-1),'slow');assert.equal(published.length,3);
});
test('fast previews remain live and disposed slow results do not report a false pause',async()=>{
 const t=timers(),states=[];let clock=0,release;
 const q=previewQueue({...t,now:()=>clock,read:()=>1,build:x=>{clock+=20;return x;},publish:()=>{},state:x=>states.push(x)});
 q.request();await t.run();q.request();assert.equal(t.jobs.size,1);await t.run();assert.equal(states.at(-1),'ready');
 const pending=previewQueue({...t,now:()=>clock,read:()=>1,build:()=>new Promise(r=>release=r),publish:()=>assert.fail(),state:x=>states.push(x)});
 pending.request();const run=t.run();pending.dispose();clock+=2000;release(1);await run;assert.equal(states.at(-1),'pending');
});
test('slow failed automatic builds pause repeated work, preserve error, and allow manual retry',async()=>{
 const t=timers(),states=[],published=[];let clock=0,bad=true;
 const q=previewQueue({...t,now:()=>clock,read:()=>1,build:x=>{clock+=1800;if(bad)throw Error('Dense layout failed');return x;},publish:x=>published.push(x),state:(...args)=>states.push(args)});
 q.request();await t.run();assert.equal(states.at(-1)[0],'error');assert.equal(states.at(-1)[1].message,'Dense layout failed');assert.deepEqual(states.at(-1)[2],{paused:true});assert.deepEqual(published,[]);
 q.request();assert.equal(t.jobs.size,0);bad=false;q.request(0,{manual:true});await t.run();assert.deepEqual(published,[1]);
 q.request();assert.equal(t.jobs.size,0,'successful manual retry does not silently resume automatic updates');
});
test('stale and disposed slow failures stay silent',async()=>{
 for(const stop of ['pause','dispose']){
  const t=timers(),states=[];let clock=0,reject;
  const q=previewQueue({...t,now:()=>clock,read:()=>1,build:()=>new Promise((_,r)=>reject=r),publish:()=>assert.fail(),state:(...args)=>states.push(args)});
  q.request();const pending=t.run();q[stop]();clock+=1800;reject(Error('Obsolete failure'));await pending;assert.deepEqual(states,[['pending']]);
 }
});
