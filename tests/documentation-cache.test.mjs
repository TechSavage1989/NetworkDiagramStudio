import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';

const site=()=>({name:'Fictional report cache lab',devices:['A','B','C'].map((id,index)=>({id,name:'LAB-SW-'+id,kind:'switch',model:'JL724A',vlans:[{id:10,name:'Staff'},...(index===0?[{id:20,name:'A-only VLAN'}]:[])],ports:[{name:'1/1/1',native:10},{name:'lag 1',type:'aggregate',state:'up',admin:'up',speed:1e10,native:10,tagged:[20,30],members:['1/1/25','1/1/26']}]})),links:[],layout:{documentation:'concise'}});
const items=pages=>pages.flatMap(page=>page.items);
const scopes=(pages,value,column)=>items(pages).filter(item=>item.logicalColumn===column&&item.value===value).map(item=>item.logicalSourceDeviceIds).sort((a,b)=>a.join(',').localeCompare(b.join(',')));
const samePages=(actual,expected)=>{assert.deepEqual(actual.map(page=>page.name),expected.map(page=>page.name));for(let i=0;i<actual.length;i++)assert.ok(actual[i].svg===expected[i].svg,'cached scene differs for '+actual[i].name);};

for(const kind of ['interface','logical'])test('cached documentation matches fresh grouping after a saved '+kind+' edit and undo',()=>{
 const project=site(),cache=new Map(),initial=buildPages(project,{cache}),core=cache.get('core'),wireless=cache.get('wireless');
 assert.deepEqual(scopes(initial,'VLAN 10',0),[['A','B','C']]);
 assert.deepEqual(scopes(initial,'lag 1',0),[['A','B','C']]);
 const target=items(initial).find(item=>item.logicalColumn===1&&item.value===(kind==='interface'?'aggregate':'A-only VLAN'));
 assert.ok(target);const patch={value:'Reviewed '+kind+' record',color:'#2266AA'};
 const dependentFamily=kind==='interface'?'logical':'ports',before=cache.get(dependentFamily);
 project.layout.drawingEdits={[target.editKey]:patch};
 const edited=buildPages(project,{cache}),fresh=buildPages(JSON.parse(JSON.stringify(project)));
 samePages(edited,fresh);
 assert.notEqual(cache.get(dependentFamily),before,'the paired documentation planner must see changed device grouping');
 assert.deepEqual(scopes(edited,'VLAN 10',0),[['A'],['B','C']]);
 assert.deepEqual(scopes(edited,'lag 1',0),[['A'],['B','C']]);
 assert.equal(items(edited).find(item=>item.editKey===target.editKey)?.value,patch.value);
 assert.equal(cache.get('core'),core);assert.equal(cache.get('wireless'),wireless);
 project.layout.drawingEdits={};
 const undone=buildPages(project,{cache});
 samePages(undone,initial);
 project.layout.drawingEdits={[target.editKey]:patch};
 samePages(buildPages(project,{cache}),fresh);
 assert.equal(cache.get('core'),core);assert.equal(cache.get('wireless'),wireless);
});
