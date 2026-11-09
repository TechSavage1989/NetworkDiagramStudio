import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';

// Fictional eight-member VSF fixture. No customer configuration or secrets.
const stack=()=>({
 id:'fictional-stack',name:'LAB-8-MEMBER-VSF',kind:'switch',vendor:'Aruba',model:'JL558A',
 stackMembers:Array.from({length:8},(_,i)=>({id:String(i+1),model:i===7?'JL256A':'JL558A'})),
 vlans:[{id:10,name:'Lab management'},{id:110,name:'Lab voice',voice:true},{id:120,name:'Lab data'},{id:150,name:'Lab security'},{id:160,name:'Lab display'}],
 ports:Array.from({length:8},(_,i)=>Array.from({length:48},(_,j)=>{
  const member=i+1,number=j+1,security=member===8&&number>=21,display=member===8&&number>=45;
  return {name:member+'/'+number,state:'up',native:display?160:security?150:120,tagged:security||display?[]:[110]};
 })).flat()
});
const project=pageSetup=>({name:'Synthetic stack documentation',devices:[stack()],links:[],layout:{pageSetup,portMap:{mapStyle:'switchport',presentation:'separate'}}});
const map=site=>buildPages(site).filter(page=>page.portMap?.device==='fictional-stack'&&page.portMap.switchportSheet&&page.portMap.bookletRole!=='inventory');

test('eight-member VSF stays on one dynamic logical port-map page with one legend',()=>{
 const pages=map(project());
 assert.equal(pages.length,1,'the stack must not paginate into two-member sheets');
 const page=pages[0],groups=new Set(page.items.filter(item=>item.reportPanel).map(item=>String(item.reportGroup)));
 assert.equal(groups.size,8,'all eight members remain visible with their physical sockets');
 assert.equal(page.items.filter(item=>item.type==='text'&&item.value==='VLAN and LAG key').length,1,'the VLAN/LAG key is not repeated');
 assert.equal(page.role,'workspace','large stacks use readable full-size member rows rather than a shrunken one-page fit');
 assert.ok(page.height>=816,'the logical canvas preserves the nominal height and grows when required');
 assert.ok(page.items.filter(item=>item.reportPortRole==='number').every(item=>item.size>=10),'member port numbers remain at the normal readable size');
 assert.ok(page.items.some(item=>item.reportPort?.startsWith('8/')),'member eight sockets are present');
});

test('print paper and fixed legacy canvas settings do not repaginate builder-style stack drawings',()=>{
 const reference=map(project())[0];
 const signature=page=>JSON.stringify({width:page.width,height:page.height,items:page.items.map(item=>[item.type,item.editKey,item.x,item.y,item.w,item.h,item.value])});
 for(const preset of ['letter','legal','a4','a3','a2']){
  const paper={preset,orientation:'portrait'};
  const page=map(project({default:{preset:'dynamic'},printPaper:paper}))[0];
  assert.equal(signature(page),signature(reference),preset+' should change only print output');
  assert.equal(page.printPaper?.preset,preset);
 }
 const legacy=map(project({default:{preset:'a4',orientation:'portrait'},overrides:{ports:{preset:'a2',orientation:'portrait'}}}))[0];
 assert.equal(signature(legacy),signature(reference),'a saved paper shape must not divide the builder map');
});
