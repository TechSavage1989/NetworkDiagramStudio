import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {targetPageAspect} from '../src/web/page-options.mjs';

// Fictional eight-member VSF fixture. No customer configuration or secrets.
const stack=(members=8)=>({
 id:'fictional-stack',name:'LAB-8-MEMBER-VSF',kind:'switch',vendor:'Aruba',model:'JL558A',
 stackMembers:Array.from({length:members},(_,i)=>({id:String(i+1),model:i===members-1?'JL256A':'JL558A'})),
 vlans:[{id:10,name:'Lab management'},{id:110,name:'Lab voice',voice:true},{id:120,name:'Lab data'},{id:150,name:'Lab security'},{id:160,name:'Lab display'}],
 ports:Array.from({length:members},(_,i)=>Array.from({length:48},(_,j)=>{
  const member=i+1,number=j+1,security=member===8&&number>=21,display=member===8&&number>=45;
  return {name:member+'/'+number,state:'up',native:display?160:security?150:120,tagged:security||display?[]:[110]};
 })).flat()
});
const project=(pageSetup,members=8)=>({name:'Synthetic stack documentation',devices:[stack(members)],links:[],layout:{pageSetup,portMap:{mapStyle:'switchport',presentation:'separate'}}});
const map=site=>buildPages(site).filter(page=>page.portMap?.device==='fictional-stack'&&page.portMap.switchportSheet&&page.portMap.bookletRole!=='inventory');

test('eight-member VSF stays on one dynamic logical port-map page with one legend',()=>{
 const pages=map(project());
 assert.equal(pages.length,1,'the stack must not paginate into two-member sheets');
 const page=pages[0],groups=new Set(page.items.filter(item=>item.reportPanel).map(item=>String(item.reportGroup)));
 assert.equal(groups.size,8,'all eight members remain visible with their physical sockets');
 assert.equal(page.items.filter(item=>item.type==='text'&&item.value==='VLAN and LAG key').length,1,'the VLAN/LAG key is not repeated');
 assert.equal(page.role,'workspace','large stacks use readable full-size member rows rather than a shrunken one-page fit');
 assert.ok(page.height>=816,'the logical canvas preserves the nominal height and grows when required');
 const numbers=page.items.filter(item=>item.reportPortRole==='number');
 assert.ok(numbers.length>=8*48,'every member retains its port number labels');
 assert.ok(numbers.every(item=>item.size>=8),'port numbers retain the renderer\'s readable minimum rather than becoming illegible');
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

test('every one-through-eight-member VSF map keeps the full stack and one key on a single page',()=>{
 for(let members=1;members<=8;members++){
  const pages=map(project(undefined,members));
  assert.equal(pages.length,1,members+' members should be a single logical map');
  const page=pages[0],groups=new Set(page.items.filter(item=>item.reportPanel).map(item=>String(item.reportGroup)));
  assert.equal(groups.size,members,'all member faceplates retained');
  assert.equal(page.items.filter(item=>item.type==='text'&&item.value==='VLAN and LAG key').length,1);
  assert.ok(page.items.filter(item=>item.reportPortRole==='number').length>=members*48);
 }
});

test('landscape pages arrange eight stack members in balanced columns without splitting or repeating the key',()=>{
 const settings={visible:{fitMode:'optimize',groups:{ports:{preset:'a3',orientation:'landscape'}}}};
 const shape=targetPageAspect(project(settings,8),{name:'MDF Port Map',family:'ports'});
 assert.ok(Math.abs(shape-420/297)<1e-8,'selected landscape paper is delivered to port map layout');
 const pages=map(project(settings,8));
 assert.equal(pages.length,1);
 const page=pages[0],bodies=page.items.filter(item=>item.reportPanel&&item.reportGroup);
 assert.equal(bodies.length,8);
 assert.ok(new Set(bodies.map(body=>Math.round(body.x))).size>=2,'member blocks should fill landscape page in columns: '+JSON.stringify(bodies.map(body=>[body.reportGroup,Math.round(body.x),Math.round(body.y)]))+' role='+page.role);
 assert.equal(page.items.filter(item=>item.type==='text'&&item.value==='VLAN and LAG key').length,1);
 assert.ok(page.items.some(item=>item.reportPort?.startsWith('8/')));
 const same=map(project(settings,8))[0];
 assert.equal(same.svg,page.svg,'responsive stack layout is deterministic');
});
