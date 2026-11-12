import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {CABLE_MOVE_NOTE} from '../src/web/reports/scene.mjs';

// Port map sheets name each member with its model and hardware, keep VLANs
// and LAGs under their own headings, list port descriptions when every one
// fits, and end with the cable-move safety note. Fictional data only.
const vlans=Array.from({length:8},(_,i)=>({id:10+i,name:'Lab '+(10+i)}));
function site({members=1,described=10,details}={}){
 const ports=[];for(let m=1;m<=members;m++)for(let p=1;p<=52;p++)ports.push({name:(members>1?m+'/':'')+p,state:p%5?'up':'down',native:p>48?null:10+(p%4),voice:p<=48&&p%3===0?20:undefined,tagged:p>48?vlans.map(v=>v.id):vlans.slice(4,4+(p%3)).map(v=>v.id),description:p<=described?'Office drop '+(100+p):undefined,lag:p>50?'Trk1':undefined});
 const device={id:'idf',name:'LAB-IDF',kind:'switch',vendor:'Aruba',model:'JL256A',...(members>1?{stackMembers:Array.from({length:members},(_,i)=>({id:String(i+1),model:'JL256A'}))}:{}),vlans,ports,...(details?{reportDetails:details}:{})};
 return {name:'Lab site',devices:[device],links:[]};
}
const portMap=project=>buildPages(project).find(page=>page.switchportReport&&page.role==='onePage');
const texts=page=>page.items.filter(item=>item.type==='text').map(item=>String(item.value));

test('the port map header names the member, model and hardware',()=>{
 const one=texts(portMap(site({details:[{id:'1',serialNumber:'SN-TEST-1',assetTag:'IT-42'}]})));
 assert.ok(one.some(value=>/^Switch \| JL256A \| 48 RJ-45 \+ 4 SFP\+? \| S\/N SN-TEST-1 \| Asset IT-42$/.test(value)),one.find(v=>/JL256A \|/.test(v)));
 const stack=texts(portMap(site({members:2})));
 for(const member of [1,2])assert.ok(stack.some(value=>value.startsWith('Member '+member+' | JL256A | 48 RJ-45')),'member '+member+' heading');
});

test('VLANs and LAGs have their own headings and the safety note closes the sheet',()=>{
 const page=portMap(site());
 const headings=page.items.filter(item=>item.reportKeyHeading).map(item=>item.reportKeyHeading);
 assert.deepEqual(headings.filter(key=>key!=='descriptions'),['vlans','lags']);
 const note=page.items.find(item=>item.reportFooterRole==='safety');
 assert.ok(note&&String(note.value).startsWith(CABLE_MOVE_NOTE),'safety note');
 assert.equal(CABLE_MOVE_NOTE,'Confirm live link, LLDP/CDP, and MAC address table before moving production cables.');
 const lowest=Math.max(...page.items.filter(item=>item!==note&&item.type!=='rect'&&item.y!=null&&!item.pageFrame).map(item=>item.y+(item.h||0)));
 assert.ok(lowest<=note.y,'content stays above the note');
});

test('port descriptions are listed when they fit, never partially',()=>{
 const few=portMap(site({described:10}));
 assert.equal(few.reportDescriptions,10);
 assert.equal(few.items.filter(item=>item.reportDescription&&!/\|port$/.test(item.editKey)).length,10);
 const stack=portMap(site({members:2,described:52}));
 const shown=stack.items.filter(item=>item.reportDescription&&!/\|port$/.test(item.editKey)).length;
 assert.ok(shown===0||shown===104,'all or none ('+shown+')');
 for(const item of stack.items.filter(item=>item.reportDescription))assert.ok(item.x+item.w<=stack.width&&item.y+item.h<=stack.height-47,'inside the sheet');
 const none=portMap(site({described:0}));assert.ok(!none.items.some(item=>item.reportKeyHeading==='descriptions'));
});

test('the safety note never overlaps the key, with or without the footer and at any margin',async()=>{
 const {adaptiveProject}=await import('./fixtures/adaptive-port-maps.mjs'),{intersects}=await import('../src/web/diagram/labels.mjs');
 const variants=[[],[p=>{p.layout.pageNumbers={footer:true,show:true};}],[p=>{p.layout.pageSetup.visible.marginMm=25;}]];
 for(const members of [2,5])for(const orientation of ['landscape','portrait'])for(const [change] of variants){
  const project=adaptiveProject('letter',orientation,members);change?.(project);
  for(const page of buildPages(project).filter(page=>page.switchportReport)){
   const note=page.items.find(item=>item.reportFooterRole==='safety');assert.ok(note,page.name+' has the safety note');
   const others=page.items.filter(item=>item!==note&&!item.pageFrame&&!item.pageHeading&&item.reportFooterRole!=='page'&&item.y!=null&&!(item.type==='rect'&&item.h<=1.5));
   for(const item of others)assert.ok(!intersects(note,{x:item.x,y:item.y,w:item.w||0,h:item.h||0},-.5),page.name+': the note overlaps '+(item.value||item.type));
   assert.ok(note.y+note.h<=page.height+.5,'the note stays on the sheet');
  }
 }
});

test('Port Inventory sheets are named after their devices and use compact table text',async()=>{
 const {wirelessTwoStackSite}=await import('./fixtures/wireless-two-stack.mjs'),{printGeometry}=await import('../src/web/page-options.mjs'),{textLayout}=await import('../src/web/diagram/scene.mjs');
 const p=wirelessTwoStackSite({mac:false});p.layout={...p.layout,pageSetup:{visible:{default:{preset:'letter'}}}};
 const pages=buildPages(p).filter(page=>page.portMap?.bookletRole==='inventory');
 assert.deepEqual(pages.map(page=>page.displayName),['Port Inventory - LAB-SW01-MDF, LAB-2FL-IDF-STACK','Port Inventory - LAB-1FL-IDF-STACK']);
 assert.deepEqual(pages.map(page=>page.name),['Port Inventory 1','Port Inventory 2'],'stable page names stay for settings and frames');
 for(const page of pages){
  assert.equal(page.items.find(item=>item.pageTitle).value,page.displayName,'the sheet title names its devices');
  const k=.75*printGeometry(page).width/page.width,cells=page.items.filter(item=>item.type==='text'&&item.compactTable&&item.portTableRole);
  const printed=Math.min(...cells.map(item=>textLayout(item).size))*k;assert.ok(printed>=6&&printed<7.5,'table text prints about 6.5 pt ('+printed.toFixed(2)+')');
  assert.ok(page.paperReadability.actualPt>=8,'table typography is not held to the diagram minimum');
 }
});
