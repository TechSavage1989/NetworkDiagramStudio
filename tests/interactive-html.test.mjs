import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {exportInteractiveHtml} from '../src/web/interactive-html.mjs';
import {buildPages} from '../src/web/diagram/index.mjs';
import {rotationProject} from './fixtures/device-rotation.mjs';
const payload=html=>JSON.parse(html.match(/<script id="drawing-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
test('interactive HTML preserves the exact accepted drawing snapshot and includes no project evidence',()=>{
 const pages=buildPages(rotationProject()),html=exportInteractiveHtml(pages,{title:'Fictional network',rawConfig:'SECRET'}),data=payload(html);
 assert.equal(data.length,pages.length);assert.equal(data[0].svg,pages[0].svg);assert.deepEqual(Object.keys(data[0]),['name','svg']);assert.ok(!html.includes('SECRET'));
 assert.match(html,/Offline, read-only drawing/);assert.match(html,/connect-src 'none'/);assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(html));
 new vm.Script(html.match(/<script>\(([\s\S]*)<\/script>/)[1].replace(/\)\(\);$/,''));
});
test('titles and serialized SVG cannot break out of their HTML contexts',()=>{
 const title='</title><script>alert("injected")</script>',svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><text>&lt;/script&gt;</text></svg>',html=exportInteractiveHtml([{name:title,svg}],{title});
 assert.equal(payload(html)[0].name,title);assert.equal(payload(html)[0].svg,svg);assert.ok(!html.includes(title));assert.equal((html.match(/<script[ >]/g)||[]).length,2);
 assert.throws(()=>exportInteractiveHtml([]),/at least one/);
});
test('exported cables carry only normalized scene endpoint associations',()=>{
 const pages=buildPages(rotationProject()),html=exportInteractiveHtml(pages);
 assert.match(pages[0].svg,/data-from-device="a" data-from-port="p1" data-to-device="b" data-to-port="p1"/);
 assert.match(html,/requestAnimationFrame/);assert.match(html,/linksByPort/);assert.match(html,/Escape to clear/);assert.match(html,/addEventListener\('focusin'/);
 assert.ok(!html.includes('"sourceLink":'));
});
