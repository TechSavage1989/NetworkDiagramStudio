import {coreRoutes} from './routing.mjs';
import {placeCableLabels,placeDeviceTitles,embeddedTextBoxes,textWidth} from './labels.mjs';
import {applyDrawingEdits} from '../drawing-edits.mjs';
import {hardwareProfile,portCapability} from '../imports/hardware.mjs';
import {C,addDevice,bridge,fresh,getAnchor,label,linkLegend,mediaInfo,optic,physicalPorts,portList,rate,rect,route,short} from './scene.mjs';

const name=d=>d?.name||d?.id||'Device';
const linkKey=e=>[e.a+'/'+e.ap,e.b+'/'+e.bp].sort().join('|');
const TOP=224,BOTTOM=853,GAP=24,LEFT=330,WIDTH=640;
function handoffs(db){
 const devices=new Map(),links=[...db.links];
 for(const d of db.devices.values()){
  if(d.kind!=='ap')for(const port of physicalPorts(d)){
   if(db.links.some(l=>l.a===d.id&&l.ap===port.name||l.b===d.id&&l.bp===port.name))continue;
   const children=portList(d).filter(p=>p.parent===port.name&&p.sdwanMember),uplink=port.sdwanMember||port.role==='wan'?port:children[0]||port;
   if(!(port.handoff||port.role==='handoff')&&!((uplink.role==='wan'||uplink.sdwanMember)&&(uplink.gateway||uplink.zone||uplink.ip||uplink.state==='up')))continue;
   const id='handoff:'+d.id+'/'+port.name,gateways=[...new Set([port,...children].map(p=>p.gateway).filter(Boolean))];
   if(db.devices.has(id))continue;
   devices.set(id,{id,name:typeof port.handoff==='string'?port.handoff:uplink.description||port.description||port.name+' handoff',kind:'handoff',model:uplink.zone||'Site handoff',ip:gateways.length?'Gateway '+gateways.join(', '):'',ports:[{name:'handoff'}],owner:d.id});
   const capability=portCapability(hardwareProfile(d),port.name);
   links.push({a:id,ap:'handoff',b:d.id,bp:port.name,media:port.media||(/(?:base-t$|^RJ.?45$)/i.test(capability||'')?'copper':'unknown'),speed:port.speed,status:'configured',idx:links.length});
  }
  devices.set(d.id,d);
 }
 return {devices,links};
}
function bounds(d,y=0,width=WIDTH){const scale=Math.max(.3,Math.min(1,d.scale||1));return d.kind==='ap'?[LEFT+(width-72*scale)/2,y,72*scale,72*scale]:d.kind==='handoff'?[LEFT+(width-170)/2,y,170,29]:[LEFT+(width-width*scale)/2,y,width*scale,124];}
function probe(project,d){return addDevice({items:[]},project,d,bounds(d),'probe');}
function measurement(project,d,edges,positions){
 const g=probe(project,d),counts={top:0,bottom:0};
 edges.forEach((e,i)=>{const port=e.a===d.id?e.ap:e.bp,other=e.a===d.id?e.b:e.a,prefer=positions.get(other)<positions.get(d.id)?'top':'bottom';counts[d.kind==='ap'?prefer:getAnchor(g,port,prefer,i).side]++;});
 // This space is allocated before packing, so cable tracks cannot enter the next row.
 const header=d.kind==='handoff'?0:42,top=d.kind==='handoff'?23:Math.max(46,counts.top?74+GAP*(counts.top-1):0),bottom=d.kind==='handoff'?20:counts.bottom?36+GAP*(counts.bottom-1):12;
 return {body:g.h,top,bottom,header,height:g.h+top+bottom+10};
}
export function corePages(project,inventory){
 const db=handoffs(inventory),layout=project.layout||{},excluded=new Set(layout.coreExclude||[]),custom=layout.corePages||[];
 const explicit=new Set(custom.flatMap(p=>p.devices));
 const eligible=[...db.devices.keys()].filter(id=>!excluded.has(id)&&(db.devices.get(id).kind!=='ap'||layout.includeAPs===true||explicit.has(id)));
 const allowed=new Set(eligible),edges=db.links.filter(e=>allowed.has(e.a)&&allowed.has(e.b));
 const positions=new Map(eligible.map((id,i)=>[id,i]));
 const sizes=new Map(eligible.map(id=>[id,measurement(project,db.devices.get(id),edges.filter(e=>e.a===id||e.b===id).slice(0,8),positions)]));
 const assigned=new Set(),groups=[];
 for(const p of custom){
  const wanted=new Set(p.devices),ids=eligible.filter(id=>wanted.has(id)||wanted.has(db.devices.get(id).owner));
  ids.forEach(id=>assigned.add(id));if(ids.length)groups.push({name:p.name||'Core Network',ids});
 }
 const rest=eligible.filter(id=>!assigned.has(id));if(rest.length)groups.push({name:'Core Network',ids:rest});
 const packed=[];
 for(const group of groups){
  let ids=[],height=0;
  const flush=()=>{if(ids.length)packed.push({name:group.name,ids});ids=[];height=0;};
  for(const id of group.ids){
   const incident=edges.filter(e=>e.a===id||e.b===id);
   if(incident.length>8){flush();for(let i=0;i<incident.length;i+=8)packed.push({name:group.name,ids:[id],linkIds:new Set(incident.slice(i,i+8).map(e=>e.idx))});continue;}
   const h=sizes.get(id).height;if(ids.length&&height+h>(BOTTOM-TOP)/.8)flush();ids.push(id);height+=h;
  }flush();
 }
 if(!packed.length){const page=fresh('Core Network','Core Network','Site equipment and physical connections',project);label(page.items,38,191,1100,36,'No equipment selected for the core pages.',18);return [page];}
 const totals=new Map(),seen=new Map(),names=new Set();
 for(const p of packed)totals.set(p.name,(totals.get(p.name)||0)+1);
 for(const p of packed){const n=(seen.get(p.name)||0)+1;seen.set(p.name,n);let title=p.name+(totals.get(p.name)>1?' '+n:'');while(names.has(title))title+=' (continued)';names.add(title);p.name=title;}
 const locations=new Map(),edgeLocations=new Map();for(const page of packed)for(const id of page.ids){if(!locations.has(id))locations.set(id,page.name);for(const e of edges.filter(e=>(e.a===id||e.b===id)&&(!page.linkIds||page.linkIds.has(e.idx))))edgeLocations.set(id+'/'+e.idx,page.name);}
 return packed.map((sheet,pi)=>{
  const page=fresh(sheet.name,sheet.name,'Site equipment and physical connections',project),items=page.items,nodes=new Map(),members=new Set(sheet.ids);
  const used=edges.filter(e=>(members.has(e.a)||members.has(e.b))&&(!sheet.linkIds||sheet.linkIds.has(e.idx)));
  const internal=used.filter(e=>members.has(e.a)&&members.has(e.b)),external=used.filter(e=>!members.has(e.a)||!members.has(e.b));
  const width=Math.min(WIDTH,Math.max(240,WIDTH-12*Math.max(0,internal.length-1)));
  const height=sheet.ids.reduce((n,id)=>n+sizes.get(id).height,0),scale=Math.min(1,(BOTTOM-TOP)/height);
  let row=TOP+(BOTTOM-TOP-height*scale)/2;
  sheet.ids.forEach((id,i)=>{
   const d=db.devices.get(id),m=sizes.get(id),b=bounds(d,row+m.top*scale,width);b[3]=m.body*scale;
   const node=addDevice(page,project,d,b,'core-'+i);nodes.set(id,node);
   if(d.kind!=='handoff'){
    const titleY=node.y-40,titleWidth=textWidth(name(d),16,true);
    label(items,node.x,titleY,titleWidth,21,name(d),16,true);Object.assign(items.at(-1),{full:true,titleOwner:id,editKey:page.name+'|title|'+id});
    const detail=[d.vendor,d.model,d.ip].filter(Boolean).join('  |  ');
    label(items,node.x,titleY+22,textWidth(detail,11),15,detail,11,false,C.muted);Object.assign(items.at(-1),{full:true,titleOwner:id,editKey:page.name+'|detail|'+id});
   }
   if(d.kind==='handoff'){label(items,node.x+8,node.y,node.w-16,node.h,short(d.name,24),12,true,C.ink,'center');items.at(-1).deviceTextOwner=id;if(d.ip)label(items,node.x-20,node.y-19,node.w+40,14,d.ip,10,false,C.muted,'center');}
   row+=m.height*scale;
  });
  applyDrawingEdits(page,project);
  const endData=new Map(),banks=new Map();
  for(const e of used)for(const [id,port,other,which] of [[e.a,e.ap,e.b,'a'],[e.b,e.bp,e.a,'b']]){
   if(!nodes.has(id))continue;
   const node=nodes.get(id),info=mediaInfo(e.media,db.devices.get(e.a).kind==='ap'||db.devices.get(e.b).kind==='ap');
   const preferred=positions.get(other)<positions.get(id)?'top':'bottom';
   let anchor=getAnchor(node,port,preferred,e.idx*2+(which==='b'?1:0));
   if(node.kind==='ap'){
    const k='uplink.core.'+which+e.idx,side=preferred;node.ports[k]=[.5,side==='top'?0:1];anchor=getAnchor(node,k,side,0);
   }
   if(node.kind!=='handoff'&&node.kind!=='ap'&&info.plug&&!anchor.port.startsWith('uplink.'))anchor=optic(page,project,db.devices.get(id),node,anchor,info);
   const data={e,id,which,node,anchor,info},key=id+'/'+anchor.side;
   if(!banks.has(key))banks.set(key,[]);banks.get(key).push(data);endData.set(e.idx+'/'+which,data);
  }
  const pinnedTitles=new Set(items.filter(i=>i.titleOwner&&(Number.isFinite(project.layout?.drawingEdits?.[i.editKey]?.x)||Number.isFinite(project.layout?.drawingEdits?.[i.editKey]?.y))).map(i=>i.titleOwner));
  const obstacles=[...items.filter(i=>i.type==='text'&&!i.deviceTextOwner&&(!i.titleOwner||pinnedTitles.has(i.titleOwner))),...embeddedTextBoxes(page).filter(b=>b.x<b.owner.x||b.y<b.owner.y||b.x+b.w>b.owner.x+b.owner.w||b.y+b.h>b.owner.y+b.owner.h)];
  const planned=coreRoutes(internal,external,endData,banks,nodes,{left:LEFT,right:LEFT+width,pitch:GAP,scale,obstacles});
  const outer={left:Math.min(LEFT-18,...planned.routes.filter(r=>r.side==='left').map(r=>r.rail)),right:Math.max(LEFT+width+18,...planned.routes.filter(r=>r.side==='right').map(r=>r.rail))},requests=[];
  for(const r of planned.routes.filter(r=>!r.v)){
   const {e,a,b}=r;
   route(page,a.anchor,b.anchor,r.points,a.info.color,'L'+(e.idx+1)+' '+name(db.devices.get(e.a))+' '+e.ap+' / '+name(db.devices.get(e.b))+' '+e.bp,a.info.name,{a:e.a,ap:e.ap,b:e.b,bp:e.bp},[e.a,e.b].map(id=>db.devices.get(id)).find(d=>d.kind==='handoff'&&!project.devices.some(p=>p.id===d.id)));
   const y=(a.ay+b.ay)/2,text=[a.info.name,rate(e.speed)].filter(Boolean);
   const horizontal=r.points.slice(1).map((p,i)=>[r.points[i],p]).filter(([a,b])=>a[1]===b[1]).sort((a,b)=>Math.abs(b[1][0]-b[0][0])-Math.abs(a[1][0]-a[0][0]))[0];
   requests.push({role:'media',editKey:page.name+'|media|'+linkKey(e),linkId:e.idx,value:text,y,side:r.side,outer:outer[r.side],...(r.points.length<=4?horizontal?{segment:horizontal}:{near:{x:r.points[0][0]+9,y:(r.points[0][1]+r.points.at(-1)[1])/2}}:{}),color:a.info.color==='#FFD965'?C.ink:a.info.color});
  }
  for(const r of planned.references){
   const {e,v,which:local}=r,remote=local==='a'?e.b:e.a,port=local==='a'?e.bp:e.ap;
   const ref=edgeLocations.get(remote+'/'+e.idx)||locations.get(remote)||'Core Network',stub={id:'continuation-'+pi+'-'+e.idx,name:ref,kind:'handoff',ports:[{name:'handoff'}]};
   const n=addDevice(page,project,stub,[r.x-12,r.y-4,12,8],'reference-'+e.idx);n.y=r.y-4;n.h=8;n.ports.handoff=[1,.5];
   const end=getAnchor(n,'handoff','top',0);
   route(page,v.anchor,end,r.points,v.info.color,'L'+(e.idx+1)+' '+name(db.devices.get(remote))+' '+port+' on '+ref,v.info.name,{a:e.a,ap:e.ap,b:e.b,bp:e.bp});
   requests.push({role:'reference',editKey:page.name+'|reference|'+linkKey(e)+'|'+v.id,linkId:e.idx,value:[name(db.devices.get(remote)),port+' / '+ref],y:r.y,side:'left',outer:r.x,color:C.teal});
  }
  for(const v of planned.ends.values())if(v.node.kind!=='handoff'){
   const port=v.which==='a'?v.e.ap:v.e.bp,r=planned.routes.find(r=>r.e===v.e),side=r?.side||'left',rail=r?.rail||LEFT-26;
   const horizontals=r?.points.slice(1).map((p,i)=>[r.points[i],p]).filter(([a,b])=>a[1]===b[1])||[],segment=v.which==='a'?horizontals[0]:horizontals.at(-1);
   requests.unshift({role:'port',editKey:page.name+'|port|'+linkKey(v.e)+'|'+v.id,linkId:v.e.idx,value:port,y:v.ay,side,outer:outer[side],...(segment?{segment}:{near:{x:v.anchor.x+9,y:v.ay}}),color:C.ink});
  }
  applyDrawingEdits(page,project);
  for(const req of requests.filter(r=>r.role==='media')){const path=items.find(i=>i.type==='path'&&i.sourceLink&&linkKey(i.sourceLink)===req.editKey.split('|media|')[1]);if(path){const h=path.color.replace('#',''),v=[0,2,4].map(n=>parseInt(h.slice(n,n+2),16));req.color=(v[0]*.299+v[1]*.587+v[2]*.114)>180?C.ink:path.color;}}
  linkLegend(page);applyDrawingEdits(page,project);
  bridge(page);placeDeviceTitles(page,project,nodes);
  const placed=placeCableLabels(page,requests,project.layout?.drawingEdits);
  if(!placed.ok)throw Error('This core page needs more room for legible labels. Move devices to another core page under Device order / Core pages.');
  return page;
 });
}
