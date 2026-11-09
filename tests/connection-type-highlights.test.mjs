import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionTypeForSelection} from '../src/web/connection-type-highlights.mjs';
import {linkLegend,route,bridge,svgPage} from '../src/web/diagram/scene.mjs';

test('selecting a legend sample or its matching cable identifies the same connection type',()=>{
 const page={name:'Core Network',width:1200,height:975,legendLayout:'sidebar',items:[]};
 route(page,{x:50,y:200},{x:500,y:200},[[50,200],[500,200]],'#3377AA','Cable A','SR fiber');
 route(page,{x:50,y:250},{x:500,y:250},[[50,250],[500,250]],'#228833','Cable B','Copper');
 // Assign stable selection keys as the editor does before SVG creation.
 for(const [n,item] of page.items.entries())item.editKey='core|cable|'+n;
 bridge(page);linkLegend(page);
 const fiber=page.items.find(item=>item.legendEntry&&item.linkType==='SR fiber'&&item.type==='rect');
 const copper=page.items.find(item=>item.legendEntry&&item.linkType==='Copper'&&item.type==='rect');
 assert.ok(fiber&&copper);
 assert.deepEqual([...connectionTypeForSelection(page,[fiber.editKey])],['SR fiber']);
 assert.deepEqual([...connectionTypeForSelection(page,['core|cable|0'])],['SR fiber']);
 assert.deepEqual([...connectionTypeForSelection(page,[copper.editKey])],['Copper']);
 const drawing=svgPage(page);
 assert.match(drawing,/class="diagram-legend-line" data-link-type="SR fiber"/);
 assert.match(drawing,/class="connection-legend-text" data-link-type="Copper"/);
 assert.match(drawing,/class="diagram-cable" data-link-type="SR fiber"/);
});
