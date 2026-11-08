import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {documentationSections} from '../src/web/diagram/documentation.mjs';
import {cleanLayout} from '../src/web/layout.mjs';

const copy=value=>structuredClone(value);
const device=id=>({id,name:'LAB-SW-'+id,kind:'switch',model:'JL724A',ports:[{name:'1/1/1',role:'access',native:10},{name:'lag 1',type:'aggregate',state:'up',admin:'up',speed:1e10,ip:'192.0.2.1/24',native:10,tagged:[20,30],members:['1/1/25','1/1/26'],description:'Distribution uplink'}]});
const site=ids=>({name:'Fictional interface identity lab',devices:ids.map(device),links:[],layout:{}});
const inventory=project=>documentationSections(project,project.devices).filter(section=>section.inventory);
const cell=(pages,key)=>pages.flatMap(page=>page.items).find(item=>item.editKey===key);

test('named interface cell edits survive refreshed observations, inserted rows and reopen',()=>{
 const project=site(['A']),original=inventory(project)[0],record=original.recordKeys[0],key=record+'|cell|1';
 project.layout={drawingEdits:{[key]:{value:'Reviewed aggregate',color:'#2266AA'}}};
 const port=project.devices[0].ports.find(port=>port.name==='lag 1');Object.assign(port,{state:'down',speed:2.5e10,ip:'198.51.100.1/24',tagged:[20,30,40]});
 project.devices[0].ports.unshift({name:'Vlan99',type:'vlan',ip:'203.0.113.1/24'});
 project.layout=cleanLayout(copy(project.layout),project.devices.map(device=>device.id));
 for(const detail of ['concise','full']){
  project.layout.documentation=detail;const section=inventory(project)[0],index=section.rows.findIndex(row=>row[0]==='lag 1');
  assert.equal(section.recordKeys[index],record);assert.match(section.rows[index][2],/down/);assert.equal(section.rows[index][3],'25 Gbps');assert.match(section.rows[index][4],/198\.51\.100\.1\/24/);
  const rendered=cell(buildPages(project),key);assert.equal(rendered.value,'Reviewed aggregate');assert.equal(rendered.color,'#2266AA');assert.deepEqual(rendered.logicalSourceDeviceIds,['A']);
 }
});

test('an edited interface remains device-specific when identical devices are added',()=>{
 const project=site(['A']),key=inventory(project)[0].recordKeys[0]+'|cell|1';project.layout.drawingEdits={[key]:{value:'A-specific aggregate'}};
 project.devices.push(device('B'),device('C'));const sections=inventory(project);
 assert.equal(sections.length,2);assert.ok(sections.some(section=>section.sourceDeviceIds.join(',')==='A'));assert.ok(sections.some(section=>section.shared&&section.sourceDeviceIds.join(',')==='B,C'));
 const pages=buildPages(project),edited=cell(pages,key);assert.equal(edited.value,'A-specific aggregate');assert.deepEqual(edited.logicalSourceDeviceIds,['A']);
 assert.ok(pages.flatMap(page=>page.items).some(item=>item.logicalColumn===1&&item.value==='aggregate'&&item.logicalSourceDeviceIds?.join(',')==='B,C'));
});

test('shared interface rows retain a stable representative across ordering and customization',()=>{
 const project=site(['C','B','A']),section=inventory(project)[0];assert.deepEqual(section.sourceDeviceIds,['A','B','C']);
 const key=section.recordKeys[0]+'|cell|1',individual=inventory(site(['A']))[0].recordKeys[0]+'|cell|1';assert.equal(key,individual);
 project.devices=[project.devices[1],project.devices[2],project.devices[0]];assert.equal(inventory(project)[0].recordKeys[0]+'|cell|1',key);
 project.layout.drawingEdits={[key]:{value:'Reviewed representative'}};project.devices.push(device('D'));
 const updated=inventory(project);assert.ok(updated.some(section=>section.sourceDeviceIds.join(',')==='A'));assert.ok(updated.some(section=>section.shared&&section.sourceDeviceIds.join(',')==='B,C,D'));
 const rendered=cell(buildPages(project),key);assert.equal(rendered.value,'Reviewed representative');assert.deepEqual(rendered.logicalSourceDeviceIds,['A']);
});

test('saved shared interface headings survive full reference mode and custom report scopes stay independent',()=>{
 const project=site(['A','B','C']),section=inventory(project)[0],heading=section.keyPrefix+'|heading|0';
 project.layout={documentation:'full',drawingEdits:{[heading]:{value:'Reviewed campus interfaces'}}};
 const sections=inventory(project);assert.equal(sections.length,1);assert.deepEqual(sections[0].sourceDeviceIds,['A','B','C']);assert.equal(cell(buildPages(project),heading).value,'Reviewed campus interfaces');
 const scoped={...project,_reportPrefix:'report:isolated',layout:{...project.layout,documentation:'concise'}},own=inventory(scoped)[0];
 assert.ok(own.keyPrefix.startsWith('report:isolated|'));assert.ok(own.recordKeys.every(key=>key.startsWith('report:isolated|')));assert.notEqual(own.keyPrefix,section.keyPrefix);
});
