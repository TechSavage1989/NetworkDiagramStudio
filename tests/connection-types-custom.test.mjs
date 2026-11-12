import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {cleanLayout} from '../src/web/layout.mjs';
import {cleanConnectionTypes,setCustomConnectionTypes,connectionMediaInfo,cableTypeChoices} from '../src/web/connection-types.mjs';
import {changeSelectedConnections} from '../src/web/legend-connections.mjs';
import {fictionalCampus} from './fixtures/site-map-campus.mjs';

test('custom connection types are cleaned, take precedence and are offered as cable types',()=>{
 assert.deepEqual(cleanConnectionTypes([{name:' Fiber backbone ',color:'#2a7ab0'},{name:'fiber BACKBONE'},{name:''},{name:'Lab',color:'red'}]),[{name:'Fiber backbone',color:'#2A7AB0'},{name:'Lab',color:'#707A83'}]);
 setCustomConnectionTypes([{name:'Fiber backbone',color:'#2A7AB0'}]);
 assert.deepEqual(connectionMediaInfo('fiber backbone'),{name:'Fiber backbone',color:'#2A7AB0'});
 assert.equal(connectionMediaInfo('fiber').name,'Fiber, reach unspecified','other text keeps the built-in match');
 assert.ok(cableTypeChoices().some(([value])=>value==='Fiber backbone'));assert.equal(cableTypeChoices().at(-1)[0],'__custom__');
 assert.deepEqual(cleanLayout({connectionTypes:[{name:'Fiber backbone',color:'#2a7ab0'}]},[]).connectionTypes,[{name:'Fiber backbone',color:'#2A7AB0'}]);
 setCustomConnectionTypes([]);
});

test('changing selected connections leaves every other connection of the old type alone',()=>{
 const project=fictionalCampus();project.layout={connectionTypes:[{name:'Building backbone',color:'#2A7AB0'}],linkStyles:{'Building backbone':{color:'#2A7AB0',weight:6}}};
 const pages=buildPages(project),core=pages.find(p=>p.coreDeviceIds),fiber=core.items.filter(i=>i.type==='path'&&i.linkType==='SR fiber');
 assert.ok(fiber.length>3);
 const {project:next,changed}=changeSelectedConnections(project,fiber.slice(0,2),{media:'Building backbone'});
 assert.equal(changed,2);
 const after=buildPages(next).find(p=>p.coreDeviceIds),types=after.items.filter(i=>i.type==='path').map(i=>i.linkType);
 assert.equal(types.filter(t=>t==='Building backbone').length,2);assert.equal(types.filter(t=>t==='SR fiber').length,fiber.length-2,'the other SR fiber connections keep their type');
 const moved=after.items.filter(i=>i.type==='path'&&i.linkType==='Building backbone');assert.ok(moved.every(i=>i.color==='#2A7AB0'));
 assert.ok(after.items.some(i=>i.legendEntry&&i.linkType==='Building backbone'),'the key lists the new type');
 assert.equal(project.links.filter(l=>l.media==='Building backbone').length,0,'the original project is unchanged');
});
