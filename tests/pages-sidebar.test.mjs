import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../src/web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/web/style.css',import.meta.url),'utf8');

test('drawing pages have a separate sibling landmark between project and canvas',()=>{
 const project=html.match(/<aside class="project-sidebar"[^>]*>([\s\S]*?)<\/aside>/);
 const pages=html.match(/<aside id="page-navigation"[^>]*>([\s\S]*?)<\/aside>/);
 assert.ok(project);assert.ok(pages);
 assert.match(pages[0],/aria-label="Drawing pages"/);
 assert.match(pages[0],/\bhidden\b/);
 for(const id of ['site','drop','import','paste','evidence','devices','filter'])assert.ok(project[1].includes(`id="${id}"`),`${id} remains in project workspace`);
 for(const id of ['page-families','tabs']){
  assert.ok(pages[1].includes(`id="${id}"`),`${id} lives in drawing pages`);
  assert.ok(!project[1].includes(`id="${id}"`));
 }
 assert.ok(project.index+project[0].length<=pages.index);
 assert.ok(pages.index+pages[0].length<=html.indexOf('<div class="stage">'));
 for(const id of ['page-navigation','page-families','tabs','page-select'])assert.equal(html.split(`id="${id}"`).length-1,1,`${id} remains unique`);
});

test('page rail scrolls independently and reclaims empty or narrow workspace space',()=>{
 assert.match(css,/#page-families\{display:block;flex:1;min-height:0;max-height:none;overflow:auto;/);
 assert.match(css,/\.pages-sidebar\.page-navigation\[hidden\]\{display:none\}/);
 assert.match(css,/main:not\(:has\(>\.pages-sidebar:not\(\[hidden\]\)\)\)/);
 assert.match(css,/@media screen and \(min-width:621px\) and \(max-width:999px\)/);
 assert.match(css,/main>\.stage\{grid-column:1 \/ -1;grid-row:2\}/);
});
