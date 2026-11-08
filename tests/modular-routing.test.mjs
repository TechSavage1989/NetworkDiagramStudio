import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPages} from '../src/web/diagram/index.mjs';
import {addDevice,getAnchor} from '../src/web/diagram/scene.mjs';
import {planModuleEscapes,endpointLead,simplifyRoute} from '../src/web/diagram/routing.mjs';
import {crossesText,textWidth} from '../src/web/diagram/labels.mjs';
import {ROUTE_STYLE} from '../src/web/diagram/routing.mjs';
import {modularChassis,modularRoutingFixture} from './fixtures/modular-routing.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' differs from '+b);
const box=(g,r)=>({x:g.x+(r.x??0)*g.w,y:g.y+r.y*g.h,w:(r.w??1)*g.w,h:r.h*g.h});
function clearModule(g,port,points){
 const own=g.panelRegions.find(r=>r.id===port[0]||port==='oobm'&&r.id==='management');
 assert.ok(own,'Expected a physical bay for '+port);
 // An empty bay is open faceplate for the chassis' own leads; its caption is not.
 for(const region of g.panelRegions)if(region!==own&&!region.empty)assert.ok(!crossesText(points,box(g,region),1.9),port+' crosses bay '+region.id);
 for(const caption of g.children.filter(c=>c.type==='text'&&g.panelRegions.some(r=>r.empty&&c.x>=r.x&&c.x<r.x+r.w&&c.y>=r.y&&c.y<r.y+r.h))){
  const width=Math.max(0,textWidth(caption.value,caption.size,caption.bold)-6),left=caption.align==='right'?caption.x*g.w+caption.w*g.w-width:caption.x*g.w;
  assert.ok(!crossesText(points,{x:g.x+left,y:g.y+caption.y*g.h,w:width,h:caption.h*g.h},1.9),port+' crosses the caption '+caption.value);
 }
 for(const socket of g.children.filter(c=>c.socketPart===0&&c.anchorName!==port))
  assert.ok(!crossesText(points,{x:g.x+socket.x*g.w,y:g.y+socket.y*g.h,w:socket.w*g.w,h:socket.h*g.h},1.9),port+' crosses '+socket.name);
 for(let i=1;i<points.length;i++)assert.ok(points[i-1][0]===points[i][0]||points[i-1][1]===points[i][1],'Cable is not orthogonal');
}
function attached(page,path){
 for(const [anchor,point] of [[path.from,path.points[0]],[path.to,path.points.at(-1)]]){
  const g=page.items.find(i=>i.key===anchor.device);assert.ok(g?.ports[anchor.port]);
  close(point[0],g.x+g.ports[anchor.port][0]*g.w);close(point[1],g.y+g.ports[anchor.port][1]*g.h);
 }
}
function localLeads(model,ports,side,width=700){
 const d=modularChassis(model);
 if(/^J869/.test(model)){d.modules=d.modules.map(m=>({...m,model:'J8706A'}));d.ports=ports.map(name=>({name}));}
 const g=addDevice({items:[]},{},d,[100,-120,width,1],'chassis',{fitWidth:true}),anchors=ports.map((port,i)=>getAnchor(g,port,side,i)),plans=planModuleEscapes(anchors);
 const leads=anchors.map(anchor=>{const moduleEscape=plans.get(anchor),ay=anchor.edge+(anchor.side==='top'?-1:1)*24,exitX=moduleEscape?.x??anchor.departure?.at(-1)[0]??anchor.x;
  return {anchor,moduleEscape,points:simplifyRoute(endpointLead({anchor,ay,exitX,moduleEscape}))};});
 return {g,leads};
}

test('modular core uses separate short center or exterior leads and direct exposed bottom sockets',()=>{
 const site=modularRoutingFixture(),page=buildPages(site).find(p=>p.name==='Core Network'),g=page.items.find(i=>i.sourceId==='chassis'&&i.kind==='switch'),paths=page.items.filter(i=>i.type==='path');
 assert.equal(paths.length,8);assert.deepEqual(g.panelRegions.map(r=>r.id),['management','management-bay','A','B','C','D','E','F']);
 for(const region of g.panelRegions)assert.ok(g.children.some(c=>c.type==='rect'&&c.x===region.x&&c.y===region.y&&c.w===region.w&&c.h===region.h),'Bay bounds must match the native artwork');
 const channel=[g.x+g.moduleChannel.left*g.w,g.x+g.moduleChannel.right*g.w],rails=[];
 for(const path of paths){
  const port=path.sourceLink.ap;attached(page,path);clearModule(g,port,path.points);
  const plug=page.items.find(i=>i.key===path.from.device);assert.equal(plug.host.port,port);assert.equal(plug.host.device,g.key);
  if(['A3','A5','A6','C6','C7'].includes(port)){
   const own=g.panelRegions.find(region=>region.id===port[0]),turn=path.points[1][1];
   assert.ok(turn>g.y+own.y*g.h&&turn<g.y+(own.y+own.h)*g.h,'Interior socket turns in clear space inside its own module');
   const x=path.points[2][0];assert.ok(x<g.x-1.9||x>=channel[0]+2-1e-7&&x<=channel[1]-2+1e-7,'Interior lead uses a clear center or exterior lane');rails.push(x);
  }else{close(path.points[0][0],path.points[1][0]);assert.ok(path.points[1][1]>g.y+g.h,'Exposed bottom socket should leave directly');}
 }
 rails.sort((a,b)=>a-b);for(let i=1;i<rails.length;i++)assert.ok(rails[i]-rails[i-1]>=4.25-1e-7,'Painted center leads merge');
});

test('six and twelve slot bays route both directions without cutting through management or other sockets',()=>{
 for(const model of ['J9850A','J9851A','J8697A','J8698A'])for(const side of ['top','bottom'])for(const width of [500,1050]){
  const {g,leads}=localLeads(model,['A3','B1','C6','D2'],side,width);
  for(const lead of leads)clearModule(g,lead.anchor.port,lead.points);
  for(const {anchor,moduleEscape} of leads)if(moduleEscape?.via==='center'){
   assert.ok(moduleEscape.x>=anchor.moduleEscape.channel[0]+2-1e-7&&moduleEscape.x<=anchor.moduleEscape.channel[1]-2+1e-7);
  }
 }
});

test('a full center uses clear outer sides and dense resized modules reject merged leads',()=>{
 const ports=Array.from({length:8},(_,i)=>'A'+(i+1)),{g,leads}=localLeads('J9850A',ports,'bottom');
 // The narrow center keeps a visible white gap between leads; the rest use
 // their column's exterior at the standard device clearance and pitch.
 const center=leads.filter(l=>l.moduleEscape.via==='center').map(l=>l.moduleEscape.x).sort((a,b)=>a-b),outer=leads.filter(l=>l.moduleEscape.via==='outer').map(l=>l.moduleEscape.x).sort((a,b)=>b-a);
 assert.equal(center.length,2);assert.equal(outer.length,6);
 for(let i=1;i<center.length;i++)assert.ok(center[i]-center[i-1]>=4+ROUTE_STYLE.gap-1e-7,'Center leads keep a visible gap');
 assert.ok(g.x-outer[0]>=ROUTE_STYLE.clearance-1e-7,'Exterior leads clear the chassis');
 for(let i=1;i<outer.length;i++)assert.ok(outer[i-1]-outer[i]>=ROUTE_STYLE.pitch-1e-7,'Exterior leads use the standard pitch');
 for(const lead of leads){clearModule(g,lead.anchor.port,lead.points);if(lead.moduleEscape.via==='outer')assert.ok(lead.moduleEscape.x<g.x);}
 assert.throws(()=>localLeads('J9850A',ports,'bottom',350),e=>e.code==='CORE_LAYOUT_CAPACITY'&&/separate cables/.test(e.message));
 const {g:small,leads:few}=localLeads('J9850A',['A3','C6'],'bottom',350);for(const lead of few)clearModule(small,lead.anchor.port,lead.points);
});

test('unconfirmed modules and imported artwork retain boundary or explicitly mapped anchors',()=>{
 const d=modularChassis();d.modules[0].model='Unconfirmed module';
 const g=addDevice({items:[]},{},d,[0,0,700,1],'unknown',{fitWidth:true}),unknown=getAnchor(g,'A3','top',7);
 assert.equal(unknown.port,'uplink.7');assert.equal(unknown.moduleEscape,undefined);assert.ok(!g.ports.A3);
 const stencil={id:'manual',name:'Mapped chassis',view:'front',width:10,height:4,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5F8AAAAASUVORK5CYII=',anchors:{A3:[.3,.4]}};
 const imported=addDevice({items:[]},{},{...d,stencil},[0,0,700,1],'imported',{fitWidth:true}),anchor=getAnchor(imported,'A3','bottom',0);
 assert.equal(imported.moduleChannel,undefined);assert.equal(anchor.moduleEscape,undefined);close(anchor.x,imported.x+.3*imported.w);close(anchor.y,imported.y+.4*imported.h);
 const edited=addDevice({items:[]},{},modularChassis(),[0,0,700,1],'edited',{fitWidth:true}),region=edited.panelRegions.find(r=>r.id==='C');
 edited.children.push({type:'rect',...region,socketPart:0,name:'Overlapping edited socket'});
 assert.throws(()=>getAnchor(edited,'C6','bottom',0),e=>e.code==='CORE_LAYOUT_CAPACITY');
});

test('wireless modular leads and scaled core endpoints use the same safe physical corridors',()=>{
 const chassis=modularChassis(),ports=['A3','B1','C6','D2','E7','F8'],wireless={name:'Wireless module lab',devices:[chassis,...ports.map((_,i)=>({id:'ap'+i,name:'LAB-AP-'+i,kind:'ap',ports:[{name:'eth0'}]}))],links:ports.map((ap,i)=>({a:'chassis',ap,b:'ap'+i,bp:'eth0',media:'copper'}))};
 let count=0;
 for(const page of buildPages(wireless).filter(p=>p.title==='Wireless Connections')){const g=page.items.find(i=>i.sourceId==='chassis'&&i.kind==='switch');for(const path of page.items.filter(i=>i.type==='path')){attached(page,path);clearModule(g,path.sourceLink.ap,path.points);count++;}}
 assert.equal(count,ports.length);
 const site=modularRoutingFixture();site.layout={presentation:{defaults:{drawingScale:1.5,deviceScale:1.2}}};
 const page=buildPages(site).find(p=>p.name==='Core Network'),g=page.items.find(i=>i.sourceId==='chassis'&&i.kind==='switch');
 for(const path of page.items.filter(i=>i.type==='path')){attached(page,path);clearModule(g,path.sourceLink.ap,path.points);}
});

test('explicit saved cable bends and styles survive regenerated module routing and reopen',()=>{
 const site=modularRoutingFixture(),page=buildPages(site).find(p=>p.name==='Core Network'),path=page.items.find(i=>i.type==='path'&&i.sourceLink.ap==='C6');
 const points=path.points.map(p=>[...p]);site.layout={drawingEdits:{[path.editKey]:{points,color:'#815AC0',weight:7}}};
 const reopened=buildPages(JSON.parse(JSON.stringify(site))).find(p=>p.name==='Core Network'),line=reopened.items.find(i=>i.editKey===path.editKey);
 assert.deepEqual(line.points,points);assert.equal(line.color,'#815AC0');assert.equal(line.weight,7);attached(reopened,line);
});
