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
