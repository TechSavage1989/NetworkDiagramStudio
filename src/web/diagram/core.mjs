import {hardwareProfile,portCapability} from '../imports/hardware.mjs';
import {C,addDevice,fresh,getAnchor,label,mediaInfo,optic,physicalPorts,portList,rate,rect,route,short} from './scene.mjs';

const name=d=>d?.name||d?.id||'Device';
const TOP=169,BOTTOM=853,GAP=10,LEFT=444,WIDTH=440;
function handoffs(db){
 const devices=new Map(),links=[...db.links];
 for(const d of db.devices.values()){
  if(d.kind!=='ap')for(const port of physicalPorts(d)){
   if(db.links.some(l=>l.a===d.id&&l.ap===port.name||l.b===d.id&&l.bp===port.name))continue;
   const children=portList(d).filter(p=>p.parent===port.name&&p.sdwanMember),uplink=port.sdwanMember||port.role==='wan'?port:children[0]||port;
   if(!(port.handoff||port.role==='handoff')&&!((uplink.role==='wan'||uplink.sdwanMember)&&(uplink.gateway||uplink.zone||uplink.ip||uplink.state==='up')))continue;
   const id='handoff:'+d.id+'/'+port.name,gateways=[...new Set([port,...children].map(p=>p.gateway).filter(Boolean))];
   devices.set(id,{id,name:typeof port.handoff==='string'?port.handoff:uplink.description||port.description||port.name+' handoff',kind:'handoff',model:uplink.zone||'Site handoff',ip:gateways.length?'Gateway '+gateways.join(', '):'',ports:[{name:'handoff'}],owner:d.id});
   const capability=portCapability(hardwareProfile(d),port.name);
   links.push({a:id,ap:'handoff',b:d.id,bp:port.name,media:port.media||(/base-t$/i.test(capability||'')?'copper':'unknown'),speed:port.speed,status:'configured',idx:links.length});
  }
  devices.set(d.id,d);
 }
 return {devices,links};
}
function bounds(d,y=0){const scale=Math.max(.3,Math.min(1,d.scale||1));return d.kind==='ap'?[LEFT+(WIDTH-72*scale)/2,y,72*scale,72*scale]:d.kind==='handoff'?[LEFT+(WIDTH-170)/2,y,170,29]:[LEFT+(WIDTH-WIDTH*scale)/2,y,WIDTH*scale,124];}
function probe(project,d){return addDevice({items:[]},project,d,bounds(d),'probe');}
function measurement(project,d,edges,positions){
 const g=probe(project,d),counts={top:0,bottom:0};
 edges.forEach((e,i)=>{const port=e.a===d.id?e.ap:e.bp,other=e.a===d.id?e.b:e.a,prefer=positions.get(other)<positions.get(d.id)?'top':'bottom';counts[d.kind==='ap'?prefer:getAnchor(g,port,prefer,i).side]++;});
 // This space is allocated before packing, so cable tracks cannot enter the next row.
 const top=14+GAP*counts.top,bottom=14+GAP*counts.bottom;
 return {body:g.h,top,bottom,height:g.h+top+bottom+14};
}
export function corePages(project,inventory){
 const db=handoffs(inventory),layout=project.layout||{},excluded=new Set(layout.coreExclude||[]),custom=layout.corePages||[];
 const explicit=new Set(custom.flatMap(p=>p.devices));
 const eligible=[...db.devices.keys()].filter(id=>!excluded.has(id)&&(db.devices.get(id).kind!=='ap'||layout.includeAPs!==false||explicit.has(id)));
 const allowed=new Set(eligible),edges=db.links.filter(e=>allowed.has(e.a)&&allowed.has(e.b));
 const positions=new Map(eligible.map((id,i)=>[id,i]));
 const sizes=new Map(eligible.map(id=>[id,measurement(project,db.devices.get(id),edges.filter(e=>e.a===id||e.b===id),positions)]));
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
  for(const id of group.ids){const h=sizes.get(id).height;if(ids.length&&height+h>BOTTOM-TOP)flush();ids.push(id);height+=h;}flush();
 }
 if(!packed.length){const page=fresh('Core Network','Core Network','Site equipment and physical connections',project);label(page.items,38,191,1100,36,'No equipment selected for the core pages.',18);return [page];}
 const totals=new Map(),seen=new Map(),names=new Set();
 for(const p of packed)totals.set(p.name,(totals.get(p.name)||0)+1);
 for(const p of packed){const n=(seen.get(p.name)||0)+1;seen.set(p.name,n);let title=p.name+(totals.get(p.name)>1?' '+n:'');while(names.has(title))title+=' (continued)';names.add(title);p.name=title;}
 const locations=new Map();for(const page of packed)for(const id of page.ids)if(!locations.has(id))locations.set(id,page.name);
 return packed.map((sheet,pi)=>{
  const page=fresh(sheet.name,sheet.name,'Site equipment and physical connections',project),items=page.items,nodes=new Map(),members=new Set(sheet.ids);
  const used=edges.filter(e=>members.has(e.a)||members.has(e.b));
  const height=sheet.ids.reduce((n,id)=>n+sizes.get(id).height,0),scale=Math.min(1,(BOTTOM-TOP)/height);
  let row=TOP+(BOTTOM-TOP-height*scale)/2;
  sheet.ids.forEach((id,i)=>{
   const d=db.devices.get(id),m=sizes.get(id),b=bounds(d,row+m.top*scale);b[3]=m.body*scale;
   const node=addDevice(page,project,d,b,'core-'+i);nodes.set(id,node);
   const y=node.y+node.h/2;
   label(items,38,y-24,245,23,short(name(d),31),16,true);
   label(items,38,y,245,18,short([d.vendor,d.model].filter(Boolean).join(' ')||d.kind,35),12,false,C.muted);
   label(items,38,y+20,245,16,d.ip||'',11,false,C.muted);
   if(d.kind==='handoff')label(items,node.x+8,node.y,node.w-16,node.h,short(d.name,24),12,true,C.ink,'center');
   row+=m.height*scale;
  });
  const endData=new Map(),banks=new Map();
  for(const e of used)for(const [id,port,other,which] of [[e.a,e.ap,e.b,'a'],[e.b,e.bp,e.a,'b']]){
   if(!nodes.has(id))continue;
   const node=nodes.get(id),info=mediaInfo(e.media,db.devices.get(e.a).kind==='ap'||db.devices.get(e.b).kind==='ap');
   const preferred=positions.get(other)<positions.get(id)?'top':'bottom';
   let anchor=getAnchor(node,port,preferred,e.idx*2+(which==='b'?1:0));
   if(node.kind==='ap'){
    const k='uplink.core.'+which+e.idx,side=preferred;node.ports[k]=[.5,side==='top'?0:1];anchor=getAnchor(node,k,side,0);
   }
   const data={e,id,which,node,anchor,info},key=id+'/'+anchor.side;
   if(!banks.has(key))banks.set(key,[]);banks.get(key).push(data);endData.set(e.idx+'/'+which,data);
  }
  for(const bank of banks.values()){
   bank.sort((a,b)=>a.anchor.x-b.anchor.x||a.anchor.y-b.anchor.y||a.e.idx-b.e.idx);
   const exits=[];
   bank.forEach((v,i)=>{
    const sign=v.anchor.side==='top'?-1:1;
    const aligned=bank.filter(o=>Math.abs(o.anchor.x-v.anchor.x)<4).length>1;
    let x=v.anchor.x+(aligned?6:0);
    while(exits.some(o=>Math.abs(o-x)<4))x+=6;
    exits.push(x);v.exitX=x;v.ay=v.anchor.edge+sign*(12+GAP*i)*scale;
    // A small socket dogleg gives independent leads to ports aligned in a column.
    if(v.node.kind!=='handoff'&&v.node.kind!=='ap'&&v.info.plug&&!v.anchor.port.startsWith('uplink.'))v.anchor=optic(page,project,db.devices.get(v.id),v.node,v.anchor,v.info);
   });
  }
  function lead(v){const start=[v.anchor.x,v.anchor.y];return v.exitX===start[0]?[start,[v.exitX,v.ay]]:[start,[start[0],start[1]+(v.anchor.side==='top'?-2:2)],[v.exitX,start[1]+(v.anchor.side==='top'?-2:2)],[v.exitX,v.ay]];}
  const internal=used.filter(e=>members.has(e.a)&&members.has(e.b)),railIntervals=[];
  internal.sort((a,b)=>Math.abs(endData.get(a.idx+'/a').ay-endData.get(a.idx+'/b').ay)-Math.abs(endData.get(b.idx+'/a').ay-endData.get(b.idx+'/b').ay)||a.idx-b.idx);
  for(const e of internal){
   const a=endData.get(e.idx+'/a'),b=endData.get(e.idx+'/b'),lo=Math.min(a.ay,b.ay)-7,hi=Math.max(a.ay,b.ay)+7;
   let lane=0;while(railIntervals.some(v=>v.lane===lane&&Math.min(hi,v.hi)>Math.max(lo,v.lo)))lane++;
   railIntervals.push({lane,lo,hi});const rail=LEFT-18-GAP*lane;
   route(page,a.anchor,b.anchor,[...lead(a),[rail,a.ay],[rail,b.ay],...lead(b).reverse()],a.info.color,'L'+(e.idx+1)+' '+name(db.devices.get(e.a))+' '+e.ap+' / '+name(db.devices.get(e.b))+' '+e.bp);
  }
  for(const e of used.filter(e=>!members.has(e.a)||!members.has(e.b))){
   const local=members.has(e.a)?'a':'b',v=endData.get(e.idx+'/'+local),remote=local==='a'?e.b:e.a,port=local==='a'?e.bp:e.ap;
   const ref=locations.get(remote)||'Core Network',stub={id:'continuation-'+pi+'-'+e.idx,name:ref,kind:'handoff',ports:[{name:'handoff'}]};
   const n=addDevice(page,project,stub,[LEFT-38,v.ay-4,12,8],'reference-'+e.idx);n.y=v.ay-4;n.h=8;n.ports.handoff=[1,.5];
   const end=getAnchor(n,'handoff','top',0);
   route(page,v.anchor,end,[...lead(v),[end.x,end.y]],v.info.color,'L'+(e.idx+1)+' '+name(db.devices.get(remote))+' '+port+' on '+ref);
  }
  // A compact register is separate from the cable lanes and equipment labels.
  if(used.length){
   const rh=Math.min(55,(BOTTOM-TOP-24)/used.length);label(items,916,152,248,18,'PHYSICAL LINKS',11,true,C.teal);
   used.forEach((e,i)=>{
    const y=TOP+i*rh,info=mediaInfo(e.media,db.devices.get(e.a).kind==='ap'||db.devices.get(e.b).kind==='ap');
    rect(items,916,y+5,12,3,info.color);
    label(items,934,y-2,226,15,'L'+(e.idx+1)+'  '+info.name+'  '+rate(e.speed),11,true);
    label(items,916,y+13,248,14,name(db.devices.get(e.a))+' '+e.ap,10,false,C.muted);
    if(rh>=40)label(items,916,y+27,248,14,name(db.devices.get(e.b))+' '+e.bp,10,false,C.muted);
    if(rh>=53&&(!members.has(e.a)||!members.has(e.b)))label(items,916,y+40,248,12,locations.get(members.has(e.a)?e.b:e.a)||'Core Network',9,true,C.teal);
   });
  }
  return page;
 });
}
