import {coreRoutes} from './routing.mjs';
import {placeCableLabels,placeDeviceTitles,embeddedTextBoxes,textWidth} from './labels.mjs';
import {applyDrawingEdits,editDeviceShape} from '../drawing-edits.mjs';
import {linkCaption} from '../link-styles.mjs';
import {hardwareProfile,portCapability} from '../imports/hardware.mjs';
import {wrapPortText} from '../port-table.mjs';
import {C,addDevice,bridge,displayPortCaption,fresh,getAnchor,label,linkLegend,mediaInfo,optic,physicalPorts,portList,rate,rect,route} from './scene.mjs';

const name=d=>d?.name||d?.id||'Device';
const linkKey=e=>[e.a+'/'+e.ap,e.b+'/'+e.bp].sort().join('|');
const TOP=164,BOTTOM=901,GAP=24,LEFT=430,WIDTH=700;
function handoffs(db){
 const devices=new Map(),links=[...db.links];
 for(const d of db.devices.values()){
  if(d.kind!=='ap')for(const port of physicalPorts(d)){
   if(db.links.some(l=>l.a===d.id&&l.ap===port.name||l.b===d.id&&l.bp===port.name))continue;
   const children=portList(d).filter(p=>p.parent===port.name&&p.sdwanMember),uplink=port.sdwanMember||port.role==='wan'?port:children[0]||port;
   if(!(port.handoff||port.role==='handoff')&&!((uplink.role==='wan'||uplink.sdwanMember)&&(uplink.gateway||uplink.zone||uplink.ip||uplink.state==='up')))continue;
   const id='handoff:'+d.id+'/'+port.name,gateways=[...new Set([port,...children].map(p=>p.gateway).filter(Boolean))];
   if(db.devices.has(id))continue;
   devices.set(id,{id,name:typeof port.handoff==='string'?port.handoff:uplink.description||port.description||port.name+' handoff',kind:'handoff',model:uplink.zone||'Site handoff',ip:gateways.length?'Gateway '+gateways.join(', '):'',ports:[{name:'handoff'}],owner:d.id,ownerPort:port.name});
   const capability=portCapability(hardwareProfile(d),port.name);
   links.push({a:id,ap:'handoff',b:d.id,bp:port.name,media:port.media||(/(?:base-t$|^RJ.?45$)/i.test(capability||'')?'copper':'unknown'),speed:port.speed,status:'configured',idx:links.length});
  }
  devices.set(d.id,d);
 }
 return {devices,links};
}
function bounds(d,y=0,width=WIDTH){const scale=Math.max(.3,Math.min(1,d.scale||1)),compact=!['switch','firewall','unknown','handoff','ap'].includes(d.kind),bodyWidth=Math.min(width,compact?300:WIDTH);return d.kind==='ap'?[LEFT+(width-72*scale)/2,y,72*scale,72*scale]:d.kind==='handoff'?[LEFT+(width-170)/2,y,170,29]:[LEFT+(width-bodyWidth*scale)/2,y,bodyWidth*scale,Math.max(124,Math.min(420,(d.stackMembers?.length||1)*100))];}
function probe(project,d){return addDevice({items:[]},project,d,bounds(d),'probe');}
function handoffCard(d,width){const detail=[d.ownerPort&&displayPortCaption(d.ownerPort),d.ip||d.model].filter(Boolean).join(' | '),titleHeight=Math.max(25,wrapPortText(d.name,width-24,18,true).length*22),detailHeight=Math.max(20,wrapPortText(detail,width-24,12).length*15);return {detail,titleHeight,detailHeight,height:Math.max(64,titleHeight+detailHeight+12)};}
function handoffRows(devices){const cols=Math.min(2,devices.length),width=(824-(cols-1)*30)/(cols||1),rows=[];for(let i=0;i<devices.length;i+=2)rows.push(Math.max(...devices.slice(i,i+2).map(d=>handoffCard(d,width).height))+20);return {width,rows,height:rows.reduce((a,b)=>a+b,0)};}
function measurement(project,d,edges,positions,handoffs=[]){
 const g=probe(project,d),counts={top:0,bottom:0};
 edges.forEach((e,i)=>{const port=e.a===d.id?e.ap:e.bp,other=e.a===d.id?e.b:e.a,prefer=positions.get(other)<positions.get(d.id)?'top':'bottom';counts[d.kind==='ap'?prefer:getAnchor(g,port,prefer,i).side]++;});
 // This space is allocated before packing, so cable tracks cannot enter the next row.
 const header=d.kind==='handoff'?0:42,top=d.kind==='handoff'?23:Math.max(46,counts.top?74+GAP*(counts.top-1):0,handoffs.length?handoffRows(handoffs).height+72:0),bottom=d.kind==='handoff'?20:counts.bottom?50+GAP*(counts.bottom-1):32;
 return {body:g.h,top,bottom,header,height:d.kind==='handoff'&&d.owner?0:g.h+top+bottom+10};
}
function moduleLegend(page,project){
 const modules=new Map();for(const plug of page.items.filter(i=>i.kind==='plug')){const key=plug.asset?.id||plug.masterKey;if(!modules.has(key))modules.set(key,{plug,ports:[]});const item=modules.get(key),host=page.items.find(i=>i.key===plug.host?.device);if(host)item.ports.push((host.name||host.sourceId)+' '+plug.host.port);}
 if(!modules.size)return [];const extra=[],scope=page.name,edits=project.layout?.drawingEdits||{};let target=page,y=Math.max(410,(page.legendBottom||320)+38),heading=false;
 const caption=(key,value,size,width,bold)=>{const patch=edits[key]||{},font=patch.size||size,w=patch.w||width,full=patch.value??value;return {value:full,size:font,w,h:Math.max(patch.h||0,wrapPortText(full,w,font,patch.bold??bold).length*font*1.2),bold:patch.bold??bold};};
 for(const [key,{plug,ports}] of modules){
  const titleKey=scope+'|module-legend|'+key+'|title',portsKey=scope+'|module-legend|'+key+'|ports',description=[...new Set(ports)].join(' / ');
  let title=caption(titleKey,plug.asset?.name||plug.name,13,target===page?166:1048,true),detail=caption(portsKey,description,11,target===page?244:1120,false),top=Math.max(36,title.h),height=top+8+detail.h+20;
  if(y+(heading?0:48)+height>900){target=fresh(scope+' Port Modules'+(extra.length?' '+(extra.length+1):''),'Port modules',scope+' - physical interface assignments',project);extra.push(target);y=174;heading=false;title=caption(titleKey,plug.asset?.name||plug.name,13,1048,true);detail=caption(portsKey,description,11,1120,false);top=Math.max(36,title.h);height=top+8+detail.h+20;}
  if(y+(heading?0:48)+height>900)throw Error('This port module description needs more space. Enlarge its text box or reduce the module assignments on this core page.');
  if(!heading){label(target.items,38,y,target===page?244:1120,26,'PORT MODULES',16,true,C.teal);target.items.at(-1).editKey=scope+'|module-legend|heading'+(target===page?'':'|continued'+extra.length);y+=48;heading=true;}
  const ratio=plug.w/plug.h,w=Math.min(64,44*ratio),h=w/ratio,copy={...plug,key:'module-legend-'+key,sourceId:'module-legend-'+key,x:47,y:y+(top-h)/2,w,h,host:null,instanceKey:'module-legend',ports:JSON.parse(JSON.stringify(plug.ports)),children:JSON.parse(JSON.stringify(plug.children))};delete copy.editKey;delete copy.legacyEditKey;for(const child of copy.children){delete child.editKey;delete child.legacyEditKey;}editDeviceShape(target,project,copy);target.items.push(copy);
  label(target.items,116,y,title.w,title.h,title.value,title.size,title.bold,C.ink);Object.assign(target.items.at(-1),{editKey:titleKey,moduleLegend:true,full:true});
  label(target.items,38,y+top+8,detail.w,detail.h,detail.value,detail.size,detail.bold,C.muted);Object.assign(target.items.at(-1),{editKey:portsKey,moduleLegend:true,full:true});y+=height;
 }return extra;
}
export function corePages(project,inventory){
 const db=handoffs(inventory),layout=project.layout||{},excluded=new Set(layout.coreExclude||[]),custom=layout.corePages||[];
 const explicit=new Set(custom.flatMap(p=>p.devices));
 const eligible=[...db.devices.keys()].filter(id=>!excluded.has(id)&&(db.devices.get(id).kind!=='ap'||layout.includeAPs===true||explicit.has(id)));
 const allowed=new Set(eligible),edges=db.links.filter(e=>allowed.has(e.a)&&allowed.has(e.b));
 const positions=new Map(eligible.map((id,i)=>[id,i]));
 const attachments=new Map();for(const id of eligible){const d=db.devices.get(id);if(d.owner&&allowed.has(d.owner)){const a=attachments.get(d.owner)||[];a.push(id);attachments.set(d.owner,a);}}
 const sizes=new Map(eligible.map(id=>[id,measurement(project,db.devices.get(id),edges.filter(e=>e.a===id||e.b===id).slice(0,8),positions,(attachments.get(id)||[]).map(id=>db.devices.get(id)))]));
 const assigned=new Set(),groups=[];
 for(const p of custom){
  const wanted=new Set(p.devices),ids=eligible.filter(id=>wanted.has(id)||wanted.has(db.devices.get(id).owner));
  ids.forEach(id=>assigned.add(id));if(ids.length)groups.push({name:p.name||'Core Network',ids,custom:true});
 }
 const rest=eligible.filter(id=>!assigned.has(id));if(rest.length)groups.push({name:'Core Network',ids:rest});
 const packed=[];
 for(const group of groups){
  let ids=[],height=0;
  const flush=()=>{if(ids.length)packed.push({name:group.name,baseName:group.name,custom:group.custom,ids});ids=[];height=0;};
  for(const id of group.ids.filter(id=>!db.devices.get(id).owner||!group.ids.includes(db.devices.get(id).owner))){
   const incident=edges.filter(e=>e.a===id||e.b===id);
   if(incident.length>8){flush();for(let i=0;i<incident.length;i+=8)packed.push({name:group.name,baseName:group.name,custom:group.custom,ids:[id],linkIds:new Set(incident.slice(i,i+8).map(e=>e.idx))});continue;}
   const h=sizes.get(id).height;if(ids.length&&height+h>(BOTTOM-TOP)/.8)flush();ids.push(...(attachments.get(id)||[]).filter(id=>group.ids.includes(id)),id);height+=h;
  }flush();
 }
 if(!packed.length){const page=fresh('Core Network','Core Network','Site equipment and physical connections',project);label(page.items,38,191,1100,36,'No equipment selected for the core pages.',18);return [page];}
 for(let attempt=0;attempt<=eligible.length;attempt++){
 try{
 for(const sheet of packed)sheet.name=sheet.baseName;
 const totals=new Map(),seen=new Map(),names=new Set();
 for(const p of packed)totals.set(p.name,(totals.get(p.name)||0)+1);
 for(const p of packed){const n=(seen.get(p.name)||0)+1;seen.set(p.name,n);let title=p.name+(totals.get(p.name)>1?' '+n:'');while(names.has(title))title+=' (continued)';names.add(title);p.name=title;}
 const locations=new Map(),edgeLocations=new Map();for(const page of packed)for(const id of page.ids){if(!locations.has(id))locations.set(id,page.name);for(const e of edges.filter(e=>(e.a===id||e.b===id)&&(!page.linkIds||page.linkIds.has(e.idx))))edgeLocations.set(id+'/'+e.idx,page.name);}
 return packed.flatMap((sheet,pi)=>{
  const priorEdits=project.layout?.drawingEdits||{},aliases=!sheet.custom&&sheet.name!==sheet.baseName?Object.fromEntries(Object.entries(priorEdits).filter(([key])=>key.startsWith(sheet.baseName+'|')).map(([key,value])=>[sheet.name+key.slice(sheet.baseName.length),value])):{},pageProject=Object.keys(aliases).length?{...project,layout:{...project.layout,drawingEdits:{...aliases,...priorEdits}}}:project;
  const page=fresh(sheet.name,sheet.name,'Site handoffs, firewalls and switch uplinks',pageProject),items=page.items,nodes=new Map(),members=new Set(sheet.ids);page.legendLayout='sidebar';
  const headerRule=items.findIndex(i=>i.type==='rect'&&i.y===138);if(headerRule>=0)items.splice(headerRule,1);rect(items,300,145,1,761,C.rule);
  const used=edges.filter(e=>(members.has(e.a)||members.has(e.b))&&(!sheet.linkIds||sheet.linkIds.has(e.idx)));
  const internal=used.filter(e=>members.has(e.a)&&members.has(e.b)),external=used.filter(e=>!members.has(e.a)||!members.has(e.b));
  const width=Math.min(WIDTH,Math.max(240,WIDTH-12*Math.max(0,internal.length-1)));
  const height=sheet.ids.reduce((n,id)=>n+sizes.get(id).height,0),scale=Math.min(1,(BOTTOM-TOP)/height);
  let row=TOP+(BOTTOM-TOP-height*scale)/2;
  sheet.ids.filter(id=>!db.devices.get(id).owner||!members.has(db.devices.get(id).owner)).forEach((id,i)=>{
   const d=db.devices.get(id),m=sizes.get(id),b=bounds(d,row+m.top*scale,width);b[3]=m.body*scale;
   const node=addDevice(page,pageProject,d,b,'core-'+i);nodes.set(id,node);
   if(d.kind!=='handoff'){
    const titleKey=page.name+'|title|'+id,titlePatch=pageProject.layout?.drawingEdits?.[titleKey]||{},titleValue=titlePatch.value??name(d),titleSize=titlePatch.size||18,titleWidth=titlePatch.w||Math.min(node.w,textWidth(titleValue,titleSize,titlePatch.bold??true)),titleHeight=Math.max(titlePatch.h||23,wrapPortText(titleValue,titleWidth,titleSize,titlePatch.bold??true).length*titleSize*1.2),titleY=node.y-titleHeight-6;
    label(items,node.x,titleY,titleWidth,titleHeight,titleValue,titleSize,titlePatch.bold??true);Object.assign(items.at(-1),{full:true,titleOwner:id,editKey:titleKey});
    const platform=d.technology&&String(d.technology).toLowerCase()!==String(d.model||'').toLowerCase()?d.technology:'',detail=[d.vendor,d.model,platform,d.ip].filter(Boolean).join('  |  ');
    const detailKey=page.name+'|detail|'+id,detailPatch=pageProject.layout?.drawingEdits?.[detailKey]||{},detailValue=detailPatch.value??detail,detailSize=detailPatch.size||12,detailWidth=detailPatch.w||Math.min(node.w,textWidth(detailValue,detailSize,detailPatch.bold)),detailHeight=Math.max(detailPatch.h||18,wrapPortText(detailValue,detailWidth,detailSize,detailPatch.bold).length*detailSize*1.2);
    label(items,node.x,node.y+node.h+5,detailWidth,detailHeight,detailValue,detailSize,detailPatch.bold??false,C.muted);Object.assign(items.at(-1),{full:true,titleOwner:id,titleSlot:'detail',editKey:detailKey});
   }
   if(d.kind==='handoff'){label(items,node.x+8,node.y,node.w-16,node.h,d.name,12,true,C.ink,'center');items.at(-1).deviceTextOwner=id;if(d.ip)label(items,node.x-20,node.y-19,node.w+40,14,d.ip,10,false,C.muted,'center');}
   row+=m.height*scale;
  });
  for(const [owner,attached] of attachments){const host=nodes.get(owner);if(!host)continue;const local=attached.filter(id=>members.has(id)),cols=Math.min(2,local.length),cards=handoffRows(local.map(id=>db.devices.get(id))),cardWidth=cards.width;
   local.forEach((id,i)=>{const d=db.devices.get(id),card=handoffCard(d,cardWidth),x=330+(i%cols)*(cardWidth+30),y=host.y-sizes.get(owner).top*scale+cards.rows.slice(0,Math.floor(i/cols)).reduce((a,b)=>a+b,0)*scale,node=addDevice(page,pageProject,d,[x,y,cardWidth,card.height*scale],'handoff-'+id,{fillBounds:true});nodes.set(id,node);
    label(items,node.x+12,node.y+4,node.w-24,card.titleHeight*scale,d.name,18*scale,true,C.ink);items.at(-1).deviceTextOwner=id;
    label(items,node.x+12,node.y+(card.titleHeight+6)*scale,node.w-24,card.detailHeight*scale,card.detail,12*scale,false,C.muted);items.at(-1).deviceTextOwner=id;
   });
  }
  applyDrawingEdits(page,pageProject);
  const endData=new Map(),banks=new Map();
  for(const e of used)for(const [id,port,other,which] of [[e.a,e.ap,e.b,'a'],[e.b,e.bp,e.a,'b']]){
   if(!nodes.has(id))continue;
   const node=nodes.get(id),info=mediaInfo(e.media,db.devices.get(e.a).kind==='ap'||db.devices.get(e.b).kind==='ap');
   const preferred=positions.get(other)<positions.get(id)?'top':'bottom';
   let anchor=getAnchor(node,port,preferred,e.idx*2+(which==='b'?1:0));
   if(node.kind==='ap'){
    const k='uplink.core.'+which+e.idx,side=preferred;node.ports[k]=[.5,side==='top'?0:1];anchor=getAnchor(node,k,side,0);
   }
   if(node.kind!=='handoff'&&node.kind!=='ap'&&info.plug&&!anchor.port.startsWith('uplink.'))anchor=optic(page,pageProject,db.devices.get(id),node,anchor,info);
   const data={e,id,which,node,anchor,info},key=id+'/'+anchor.side;
   if(!banks.has(key))banks.set(key,[]);banks.get(key).push(data);endData.set(e.idx+'/'+which,data);
  }
  const pinnedTitles=new Set(items.filter(i=>i.titleOwner&&(Number.isFinite(pageProject.layout?.drawingEdits?.[i.editKey]?.x)||Number.isFinite(pageProject.layout?.drawingEdits?.[i.editKey]?.y))).map(i=>i.titleOwner));
  const obstacles=[...items.filter(i=>i.type==='text'&&!i.deviceTextOwner&&(!i.titleOwner||pinnedTitles.has(i.titleOwner))),...embeddedTextBoxes(page).filter(b=>b.x<b.owner.x||b.y<b.owner.y||b.x+b.w>b.owner.x+b.owner.w||b.y+b.h>b.owner.y+b.owner.h)];
  const planned=coreRoutes(internal,external,endData,banks,nodes,{left:LEFT,right:LEFT+width,pitch:GAP,scale,obstacles});
  const outer={left:Math.min(LEFT-18,...planned.routes.filter(r=>r.side==='left').map(r=>r.rail)),right:Math.max(LEFT+width+18,...planned.routes.filter(r=>r.side==='right').map(r=>r.rail))},requests=[];
  for(const r of planned.routes.filter(r=>!r.v)){
   const {e,a,b}=r;
   route(page,a.anchor,b.anchor,r.points,a.info.color,'L'+(e.idx+1)+' '+name(db.devices.get(e.a))+' '+e.ap+' / '+name(db.devices.get(e.b))+' '+e.bp,a.info.name,{a:e.a,ap:e.ap,b:e.b,bp:e.bp,media:e.media,speed:e.speed,status:e.status},[e.a,e.b].map(id=>db.devices.get(id)).find(d=>d.kind==='handoff'&&!project.devices.some(p=>p.id===d.id)));
   const y=(a.ay+b.ay)/2,text=linkCaption(project,a.info.name,rate(e.speed));
   const horizontal=r.points.slice(1).map((p,i)=>[r.points[i],p]).filter(([a,b])=>a[1]===b[1]).sort((a,b)=>Math.abs(b[1][0]-b[0][0])-Math.abs(a[1][0]-a[0][0]))[0];
   requests.push({role:'media',editKey:page.name+'|media|'+linkKey(e),linkId:e.idx,value:text,y,side:r.side,outer:outer[r.side],...(r.points.length<=4?horizontal?{segment:horizontal}:{near:{x:r.points[0][0]+9,y:(r.points[0][1]+r.points.at(-1)[1])/2}}:{}),color:a.info.color==='#FFD965'?C.ink:a.info.color});
  }
  for(const r of planned.references){
   const {e,v,which:local}=r,remote=local==='a'?e.b:e.a,port=local==='a'?e.bp:e.ap;
   const ref=edgeLocations.get(remote+'/'+e.idx)||locations.get(remote)||'Core Network',stub={id:'continuation-'+pi+'-'+e.idx,name:ref,kind:'handoff',ports:[{name:'handoff'}]};
   const n=addDevice(page,project,stub,[r.x-12,r.y-4,12,8],'reference-'+e.idx);n.y=r.y-4;n.h=8;n.ports.handoff=[1,.5];
   const end=getAnchor(n,'handoff','top',0);
   route(page,v.anchor,end,r.points,v.info.color,'L'+(e.idx+1)+' '+name(db.devices.get(remote))+' '+port+' on '+ref,v.info.name,{a:e.a,ap:e.ap,b:e.b,bp:e.bp,media:e.media,speed:e.speed,status:e.status});
   requests.push({role:'reference',editKey:page.name+'|reference|'+linkKey(e)+'|'+v.id,linkId:e.idx,value:[name(db.devices.get(remote)),port+' / '+ref],y:r.y,side:'left',outer:r.x,color:C.teal});
  }
  for(const v of planned.ends.values())if(v.node.kind!=='handoff'){
   const port=v.which==='a'?v.e.ap:v.e.bp,r=planned.routes.find(r=>r.e===v.e),side=r?.side||'left',rail=r?.rail||LEFT-26;
   const horizontals=r?.points.slice(1).map((p,i)=>[r.points[i],p]).filter(([a,b])=>a[1]===b[1])||[],segment=v.which==='a'?horizontals[0]:horizontals.at(-1);
   requests.unshift({role:'port',editKey:page.name+'|port|'+linkKey(v.e)+'|'+v.id,linkId:v.e.idx,value:port,y:v.ay,side,outer:outer[side],...(segment?{segment}:{near:{x:v.anchor.x+9,y:v.ay}}),color:C.ink});
  }
  applyDrawingEdits(page,pageProject);
  for(const req of requests.filter(r=>r.role==='media')){const path=page.items.find(i=>i.type==='path'&&i.sourceLink&&linkKey(i.sourceLink)===req.editKey.split('|media|')[1]);if(path){const h=path.color.replace('#',''),v=[0,2,4].map(n=>parseInt(h.slice(n,n+2),16));req.color=(v[0]*.299+v[1]*.587+v[2]*.114)>180?C.ink:path.color;}}
  linkLegend(page);const modulePages=moduleLegend(page,pageProject);applyDrawingEdits(page,pageProject);for(const continued of modulePages)applyDrawingEdits(continued,pageProject);
  bridge(page);placeDeviceTitles(page,pageProject,nodes);
  const placed=placeCableLabels(page,requests,pageProject.layout?.drawingEdits);
  if(!placed.ok)throw Object.assign(Error('This core page needs more room for the '+placed.failed.role+' label '+JSON.stringify(placed.failed.value)+'. Move devices to another core page under Device order / Core pages.'),{code:'CORE_LAYOUT_CAPACITY',role:placed.failed.role,page:page.name});
  return [page,...modulePages];
 });
 }catch(error){
  const index=packed.findIndex(sheet=>sheet.name===error.page),sheet=packed[index];
  if(error.code!=='CORE_LAYOUT_CAPACITY'||!sheet||sheet.custom)throw error;
  const owners=sheet.ids.filter(id=>!db.devices.get(id).owner||!sheet.ids.includes(db.devices.get(id).owner));
  if(owners.length<2)throw error;
  const left=new Set(owners.slice(0,Math.ceil(owners.length/2))),groups=[sheet.ids.filter(id=>left.has(id)||left.has(db.devices.get(id).owner)),sheet.ids.filter(id=>!left.has(id)&&!left.has(db.devices.get(id).owner))];
  packed.splice(index,1,...groups.map(ids=>({...sheet,name:sheet.baseName,ids})));
 }
 }
 throw Error('This core layout needs more space. Assign devices to additional core pages.');
}
