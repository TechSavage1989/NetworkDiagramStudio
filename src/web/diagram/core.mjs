import {informationPanel} from './information-panel.mjs';
import {presentation,deviceScale,scaleText} from '../presentation.mjs';
import {fitDynamicPage} from './dynamic-page.mjs';
import {pageGeometry} from '../page-options.mjs';
import {deviceDetails} from '../device-details.mjs';
import {coreLinkKey as linkKey} from '../layout.mjs';
import {coreSidebar} from './sidebar.mjs';
import {coreRoutes} from './routing.mjs';
import {placeCableLabels,placeDeviceTitles,embeddedTextBoxes,textWidth} from './labels.mjs';
import {applyDrawingEdits,editDeviceShape} from '../drawing-edits.mjs';
import {linkCaption} from '../link-styles.mjs';
import {hardwareProfile,portCapability} from '../imports/hardware.mjs';
import {wrapPortText} from '../port-table.mjs';
import {C,addDevice,bridge,displayPortCaption,fresh,getAnchor,label,linkLegend,mediaInfo,optic,physicalPorts,portList,rate,rect,route} from './scene.mjs';

const name=d=>d?.name||d?.id||'Device';

const TOP=164,BOTTOM=901,GAP=24,LEFT=430,WIDTH=700;
// Try readable layouts before continuing a page. Extra rail clearance resolves
// labels trapped between parallel cables; tighter padding recovers unused space.
const FITS=[244,208,176].flatMap(sidebarWidth=>[1,.85,.7].flatMap(padding=>[12,60].map(railPitch=>({padding,railPitch,sidebarWidth}))));
const spacing=padding=>({pitch:GAP*padding,topClearance:38+12*padding,bottomClearance:14+4*padding});
function handoffs(db,suppressed=[]){
 const devices=new Map(),links=[...db.links];
 for(const d of db.devices.values()){
  if(d.kind!=='ap')for(const port of physicalPorts(d)){
   if(db.links.some(l=>l.a===d.id&&l.ap===port.name||l.b===d.id&&l.bp===port.name))continue;
   const children=portList(d).filter(p=>p.parent===port.name&&p.sdwanMember),uplink=port.sdwanMember||port.role==='wan'?port:children[0]||port;
   if(!(port.handoff||port.role==='handoff')&&!((uplink.role==='wan'||uplink.sdwanMember)&&(uplink.gateway||uplink.zone||uplink.ip||uplink.state==='up')))continue;
   const id='handoff:'+d.id+'/'+port.name,gateways=[...new Set([port,...children].map(p=>p.gateway).filter(Boolean))];
   if(db.devices.has(id)||suppressed.includes(id))continue;
   devices.set(id,{id,name:typeof port.handoff==='string'?port.handoff:uplink.description||port.description||port.name+' handoff',kind:'handoff',model:uplink.zone||'Site handoff',ip:gateways.length?'Gateway '+gateways.join(', '):'',ports:[{name:'handoff'}],owner:d.id,ownerPort:port.name});
   const capability=portCapability(hardwareProfile(d),port.name);
   links.push({a:id,ap:'handoff',b:d.id,bp:port.name,media:port.media||(/(?:base-t$|^RJ.?45$)/i.test(capability||'')?'copper':'unknown'),speed:port.speed,status:'configured',idx:links.length});
  }
  devices.set(d.id,d);
 }
 return {devices,links};
}
function bounds(d,y=0,width=WIDTH,left=LEFT){const scale=1,compact=!['switch','firewall','unknown','handoff','ap'].includes(d.kind),bodyWidth=width*(compact?300/WIDTH:1);return d.kind==='ap'?[left+(width-72*scale*width/WIDTH)/2,y,72*scale*width/WIDTH,72*scale*width/WIDTH]:d.kind==='handoff'?[left+(width-170)/2,y,170,29]:[left+(width-bodyWidth*scale)/2,y,bodyWidth*scale,Math.max(124,Math.min(420,(d.stackMembers?.length||1)*100))];}
function probe(project,d,width=WIDTH,padding=1){return addDevice({items:[]},project,d,bounds(d,0,width),'probe',{fitWidth:d.kind!=='handoff',padding});}
function handoffCard(d,width){const textSpan=(width-24)/1.12,detail=[d.ownerPort&&displayPortCaption(d.ownerPort),d.ip||d.model].filter(Boolean).join(' | '),titleHeight=Math.max(25,wrapPortText(d.name,textSpan,18,true).length*22),detailHeight=Math.max(20,wrapPortText(detail,textSpan,12).length*15);return {detail,titleHeight,detailHeight,height:Math.max(64,titleHeight+detailHeight+12)};}
function handoffRows(devices,span,spread=false){
 // Measure compact cards against the actual chassis. Separate rows reserve
 // enough space for complete two-line cable captions, not just a connector.
 // Text keeps a small font-substitution allowance inside the card padding.
 let gap=24;const available=Math.max(180,span),cols=Math.max(1,Math.min(2,devices.length,Math.floor((available+gap)/(180+gap))));
 const natural=Math.max(180,...devices.map(d=>Math.max(textWidth(d.name,18,true),textWidth(handoffCard(d,300).detail,12,false))*1.12+24));
 const width=Math.min(300,natural,(available-gap*(cols-1))/cols),rows=[];
 for(let i=0;i<devices.length;i+=cols)rows.push(Math.max(...devices.slice(i,i+cols).map(d=>handoffCard(d,width).height))+(i+cols<devices.length?44:20));
 if(spread&&cols>1)gap=(available-cols*width)/(cols-1);
 return {width,cols,gap,rows,height:rows.reduce((a,b)=>a+b,0)};
}
function measurement(project,d,edges,positions,handoffs=[],width=WIDTH,padding=1){
 const g=probe(project,d,width,padding),counts={top:0,bottom:0};
 edges.forEach((e,i)=>{const port=e.a===d.id?e.ap:e.bp,other=e.a===d.id?e.b:e.a,prefer=positions.get(other)<positions.get(d.id)?'top':'bottom';counts[d.kind==='ap'?prefer:getAnchor(g,port,prefer,i).side]++;});
 // This space is allocated before packing, so cable tracks cannot enter the next row.
 const {pitch,topClearance,bottomClearance}=spacing(padding);
 const top=d.kind==='handoff'?23:Math.max(40+6*padding,counts.top?topClearance+14*padding+pitch*(counts.top-1):0,handoffs.length?handoffRows(handoffs,g.w).height+72+40*padding:0),bottom=d.kind==='handoff'?20:counts.bottom?bottomClearance+26*padding+pitch*(counts.bottom-1):Math.max(24,28*padding);
 const detailHeight=Math.max(18,wrapPortText(deviceDetails(d),g.w,12).length*14.4);
 return {body:g.h,top,height:d.kind==='handoff'&&d.owner?0:g.h+top+Math.max(bottom,detailHeight+10)+10*padding};
}
function moduleLegend(page,project){
 const modules=new Map();for(const plug of page.items.filter(i=>i.kind==='plug')){const key=plug.asset?.id||plug.masterKey;if(!modules.has(key))modules.set(key,{plug,ports:[]});const item=modules.get(key),host=page.items.find(i=>i.key===plug.host?.device);if(host)item.ports.push((host.name||host.sourceId)+' '+plug.host.port);}
 if(!modules.size)return [];
 // Older drawings shared one SFP legend across reaches. Keep its saved edits
 // on the original category, or the first remaining category when it is absent.
 const inherited={},claimed=new Set(modules.keys()),prior=project.layout?.drawingEdits||{};
 for(const [key,{plug}] of modules){const legacy=plug.legacyMasterKey;if(plug.asset||!legacy||key===legacy||claimed.has(legacy))continue;claimed.add(legacy);
  for(const prefix of ['module-legend|','device|module-legend-']){const old=page.name+'|'+prefix+legacy,next=page.name+'|'+prefix+key;for(const [id,value] of Object.entries(prior))if((id===old||id.startsWith(old+'|'))&&!Object.hasOwn(prior,next+id.slice(old.length)))inherited[next+id.slice(old.length)]=value;}
 }
 if(Object.keys(inherited).length)project={...project,layout:{...project.layout,drawingEdits:{...inherited,...prior}}};
 const side=page.sidebar||coreSidebar(),s=side.scale,extra=[],scope=page.name,edits=project.layout?.drawingEdits||{};let target=page,y=Math.max(147+263*s,(page.legendBottom||320)+38*s),heading=false;
 const caption=(key,value,size,width,bold)=>{const patch=edits[key]||{},font=patch.size||size*(side.textScale||1),w=patch.w||width,full=patch.value??value;return {value:full,size:font,w,h:Math.max(patch.h||0,wrapPortText(full,w,font,patch.bold??bold).length*font*1.2),bold:patch.bold??bold};};
 for(const [key,{plug,ports}] of modules){
  const titleKey=scope+'|module-legend|'+key+'|title',portsKey=scope+'|module-legend|'+key+'|ports',description=[...new Set(ports)].join(' / ');
  let iconScale=target===page?s:1,title=caption(titleKey,plug.asset?.name||plug.name,Math.max(12,13*iconScale),target===page?side.width-78*iconScale:target.width-152,true),detail=caption(portsKey,description,11,target===page?side.width:target.width-80,false),top=Math.max(42*iconScale,title.h),height=top+8*iconScale+detail.h+20*iconScale;
  if(!target.dynamic&&y+(heading?0:48*iconScale)+height>target.height-75){target=fresh(scope+' Port Modules'+(extra.length?' '+(extra.length+1):''),'Port modules',scope+' - physical interface assignments',project);extra.push(target);y=174;heading=false;iconScale=1;title=caption(titleKey,plug.asset?.name||plug.name,13,target.width-152,true);detail=caption(portsKey,description,11,target.width-80,false);top=Math.max(42,title.h);height=top+8+detail.h+20;}
  if(!target.dynamic&&y+(heading?0:48*iconScale)+height>target.height-75)throw Error('This port module description needs more space. Enlarge its text box or reduce the module assignments on this core page.');
  if(!heading){label(target.items,38,y,target===page?side.width:target.width-80,26*iconScale*(side.textScale||1),'PORT MODULES',16*iconScale*(side.textScale||1),true,C.teal);target.items.at(-1).editKey=scope+'|module-legend|heading'+(target===page?'':'|continued'+extra.length);y+=48*iconScale*(side.textScale||1);heading=true;}
  const ratio=plug.w/plug.h,w=(plug.asset?Math.min(64,44*ratio):64)*iconScale,h=plug.asset?w/ratio:42*iconScale,copy={...plug,key:'module-legend-'+key,sourceId:'module-legend-'+key,x:38,y:y+(top-h)/2,w,h,host:null,instanceKey:'module-legend',ports:JSON.parse(JSON.stringify(plug.ports)),children:JSON.parse(JSON.stringify(plug.children))};if(!plug.asset){
   const face=copy.children.map((child,i)=>({...child,editSlot:i,x:9/64+child.x*46/64,y:9.5/42+child.y*23/42,w:child.w*46/64,h:child.h*23/42}));
   copy.children=[];rect(copy.children,0,0,1,1,'#EEF2F7','#9AA9C0',1);Object.assign(copy.children[0],{name:'Module frame',editSlot:'frame'});copy.children.push(...face);copy.masterKey+=':legend-frame';
  }
  delete copy.editKey;delete copy.legacyEditKey;for(const child of copy.children){delete child.editKey;delete child.legacyEditKey;}editDeviceShape(target,project,copy);target.items.push(copy);
  label(target.items,38+78*iconScale,y,title.w,title.h,title.value,title.size,title.bold,C.ink);Object.assign(target.items.at(-1),{editKey:titleKey,moduleLegend:true,full:true});
  label(target.items,38,y+top+8*iconScale,detail.w,detail.h,detail.value,detail.size,detail.bold,C.muted);Object.assign(target.items.at(-1),{editKey:portsKey,moduleLegend:true,full:true});y+=height;
 }if(Object.keys(inherited).length)for(const target of [page,...extra])applyDrawingEdits(target,project);return extra;
}
export function corePages(project,inventory){
 const geometry=pageGeometry(project,'core'),{width:baseW,height:baseH,dynamic}=geometry,BOTTOM=baseH-74;
 const db=handoffs(inventory,project.layout?.suppressedHandoffs),layout=project.layout||{},excluded=new Set(layout.coreExclude||[]),custom=layout.corePages||[];
 const explicit=new Set(custom.flatMap(p=>p.devices));
 const eligible=[...db.devices.keys()].filter(id=>!excluded.has(id)&&(db.devices.get(id).kind!=='ap'||layout.includeAPs===true||explicit.has(id)));
 const allowed=new Set(eligible),edges=db.links.filter(e=>allowed.has(e.a)&&allowed.has(e.b));
 const positions=new Map(eligible.map((id,i)=>[id,i]));
 const attachments=new Map();for(const id of eligible){const d=db.devices.get(id);if(d.owner&&allowed.has(d.owner)){const a=attachments.get(d.owner)||[];a.push(id);attachments.set(d.owner,a);}}
 // This is only an optimistic lower bound, using the narrowest supported body
 // and minimum padding with no cable/card reserves. It cannot prematurely split
 // a group that the actual layout can fit, and bounds work for large inventories.
 const minimums=new Map(eligible.map(id=>[id,measurement(project,db.devices.get(id),[],positions,[],240,FITS.at(-1).padding).height]));
 const assigned=new Set(),groups=[];
 for(const p of custom){
  const wanted=new Set(p.devices),ids=eligible.filter(id=>wanted.has(id)||wanted.has(db.devices.get(id).owner));
  ids.forEach(id=>assigned.add(id));if(ids.length)groups.push({name:p.name||'Core Network',ids,custom:true,corePageId:p.id,showReferences:p.showReferences!==false,hiddenReferences:p.hiddenReferences});
 }
 const rest=eligible.filter(id=>!assigned.has(id));if(rest.length)groups.push({name:custom.some(p=>p.name==='Core Network')?'Unassigned devices':'Core Network',ids:rest});
 const packed=[];
 for(const group of groups){
  let ids=[],minimumHeight=0;
  const flush=()=>{if(ids.length)packed.push({name:group.name,baseName:group.name,custom:group.custom,corePageId:group.corePageId,showReferences:group.showReferences,hiddenReferences:group.hiddenReferences,ids});ids=[];minimumHeight=0;};
  for(const id of group.ids.filter(id=>!db.devices.get(id).owner||!group.ids.includes(db.devices.get(id).owner))){
   const incident=edges.filter(e=>e.a===id||e.b===id);
   if(!dynamic&&incident.length>8){flush();for(let i=0;i<incident.length;i+=8)packed.push({name:group.name,baseName:group.name,custom:group.custom,corePageId:group.corePageId,showReferences:group.showReferences,hiddenReferences:group.hiddenReferences,ids:[id],linkIds:new Set(incident.slice(i,i+8).map(e=>e.idx))});continue;}
   const minimum=minimums.get(id);if(!dynamic&&!group.custom&&ids.length&&minimumHeight+minimum>BOTTOM-TOP)flush();
   ids.push(...(attachments.get(id)||[]).filter(id=>group.ids.includes(id)),id);minimumHeight+=minimum;
  }flush();
 }
 if(!packed.length){const page=fresh('Core Network','Core Network','Site equipment and physical connections',project);label(page.items,38,191,1100,36,'No equipment selected for the core pages.',18);return [page];}
 const viewDevice=(sheet,id)=>sheet.views?.[id]||db.devices.get(id);
 const localPort=(sheet,id,port)=>{if(!sheet.ids.includes(id))return false;const view=sheet.views?.[id];if(!view)return true;const member=String(port||'').match(/^(?:(?:Gi|Te|TwentyFiveGigE|HundredGigE|Ethernet|Eth))?(\d+)\//i)?.[1];return member?view.stackMembers.some(m=>String(m.id)===member):view.stackMembers[0].id===db.devices.get(id).stackMembers[0].id;};
 const rendered=new Map();
 for(let attempt=0;attempt<=(dynamic?8:1)*Math.max(1,eligible.length)*2*FITS.length*2;attempt++){
 try{
 for(const sheet of packed)sheet.name=sheet.baseName;
 const totals=new Map(),seen=new Map(),names=new Set();
 for(const p of packed)totals.set(p.name,(totals.get(p.name)||0)+1);
 for(const p of packed){const n=(seen.get(p.name)||0)+1;seen.set(p.name,n);let title=p.name+(totals.get(p.name)>1?' '+n:'');while(names.has(title))title+=' (continued)';names.add(title);p.name=title;}
 const locations=new Map(),edgeLocations=new Map();for(const page of packed)for(const id of page.ids){if(!locations.has(id))locations.set(id,page.name);for(const e of edges.filter(e=>(e.a===id&&localPort(page,id,e.ap)||e.b===id&&localPort(page,id,e.bp))&&(!page.linkIds||page.linkIds.has(e.idx))))edgeLocations.set(id+'/'+e.idx,page.name);}
 return packed.flatMap((sheet,pi)=>{
  const priorEdits=project.layout?.drawingEdits||{},aliases=sheet.name!==sheet.baseName?Object.fromEntries(Object.entries(priorEdits).filter(([key])=>key.startsWith(sheet.baseName+'|')).map(([key,value])=>[sheet.name+key.slice(sheet.baseName.length),value])):{},aliasProject=Object.keys(aliases).length?{...project,layout:{...project.layout,drawingEdits:{...aliases,...priorEdits}}}:project;
  const expansion=sheet.expansion||0;
  const measuredHeight=dynamic?sheet.ids.reduce((sum,id)=>sum+measurement(aliasProject,viewDevice(sheet,id),edges.filter(e=>e.a===id||e.b===id),positions,(attachments.get(id)||[]).filter(v=>sheet.ids.includes(v)).map(v=>db.devices.get(v)),WIDTH).height+expansion,0):0;
  const W=dynamic?baseW+expansion+Math.max(0,edges.length-8)*48+WIDTH*Math.max(0,...sheet.ids.map(id=>deviceScale(aliasProject,viewDevice(sheet,id))-1)):baseW,H=dynamic?Math.max(baseH,TOP+measuredHeight+110,520+edges.length*110):baseH,BOTTOM=H-74;
  const pageProject=dynamic?{...aliasProject,_pageGeometry:{...aliasProject._pageGeometry,core:{width:W,height:H}}}:aliasProject;
  const fit=FITS[sheet.fit||0],fixedSidebar=Object.entries(pageProject.layout?.drawingEdits||{}).some(([key,patch])=>key.startsWith(sheet.name+'|')&&/(?:module-legend|\|legend\|)/.test(key)&&['x','y','w','h'].some(k=>Number.isFinite(patch[k]))),sidebar=coreSidebar(fixedSidebar?244:Math.min(fit.sidebarWidth,W<1000?176:244));
  const panelOptions=presentation(pageProject,sheet.name).panel;
  if(panelOptions.width!==244||panelOptions.scale!==1||!panelOptions.visible||panelOptions.position!=='left'){const reserve=panelOptions.visible&&panelOptions.position==='left'?panelOptions.width*panelOptions.scale:0;sidebar.width=panelOptions.width;sidebar.contentLeft=reserve?62+reserve:38;sidebar.divider=reserve?56+reserve:38;sidebar.bodyLeft=sidebar.contentLeft+124;}
  sidebar.textScale=panelOptions.textScale*presentation(pageProject,sheet.name).textScale;
  if(dynamic)sidebar.bodyLeft+=Math.max(0,edges.length-8)*24;
  if(W<1200)sidebar.bodyLeft=Math.max(sidebar.contentLeft+38,Math.min(sidebar.bodyLeft,W-738));
  const page=fresh(sheet.name,sheet.name,'Site handoffs, firewalls and switch uplinks',pageProject),items=page.items,nodes=new Map(),members=new Set(sheet.ids);page.legendLayout='sidebar';page.sidebar=sidebar;page.coreDeviceIds=sheet.ids.filter(id=>project.devices.some(d=>d.id===id));page.automaticCore=!sheet.custom;page.corePageId=sheet.corePageId;
  const headerRule=items.findIndex(i=>i.type==='rect'&&i.y===138);if(headerRule>=0)items.splice(headerRule,1);rect(items,sidebar.divider,145,1,H-214,C.rule);items.at(-1).pageFrame='sidebar';
  const hiddenReferences=new Set(sheet.hiddenReferences||[]);
  const used=edges.filter(e=>(localPort(sheet,e.a,e.ap)&&localPort(sheet,e.b,e.bp)||sheet.showReferences!==false&&!hiddenReferences.has(linkKey(e))&&(localPort(sheet,e.a,e.ap)||localPort(sheet,e.b,e.bp)))&&(!sheet.linkIds||sheet.linkIds.has(e.idx)));
  const internal=used.filter(e=>localPort(sheet,e.a,e.ap)&&localPort(sheet,e.b,e.bp)),external=used.filter(e=>!localPort(sheet,e.a,e.ap)||!localPort(sheet,e.b,e.bp));
  const signature=JSON.stringify([pi,sheet.name,sheet.ids,sheet.views,sheet.fit,sheet.spreadHandoffs,sheet.expansion,external.map(e=>[edgeLocations.get(e.a+'/'+e.idx),edgeLocations.get(e.b+'/'+e.idx)])]),cached=rendered.get(sheet);
  if(cached?.signature===signature)return cached.pages;
  const width=Math.min(WIDTH,W-(W<1000?276:W<1200?344:430)-38);
  const pageSizes=new Map(sheet.ids.map(id=>[id,measurement(pageProject,viewDevice(sheet,id),used.filter(e=>e.a===id&&localPort(sheet,id,e.ap)||e.b===id&&localPort(sheet,id,e.bp)).slice(0,dynamic?Infinity:8),positions,(attachments.get(id)||[]).filter(id=>members.has(id)).map(id=>db.devices.get(id)),width,fit.padding)]));
  const height=sheet.ids.reduce((n,id)=>n+pageSizes.get(id).height,0),scale=1;
  if(height>BOTTOM-TOP)throw Object.assign(Error('This core page needs more room to keep the equipment readable.'),{code:'CORE_LAYOUT_CAPACITY',page:page.name});
  let row=dynamic?TOP:TOP+(BOTTOM-TOP-height*scale)/2;
  sheet.ids.filter(id=>!db.devices.get(id).owner||!members.has(db.devices.get(id).owner)).forEach((id,i)=>{
   const d=viewDevice(sheet,id),m=pageSizes.get(id),b=bounds(d,row+m.top*scale,width,sidebar.bodyLeft);b[3]=m.body*scale;
   const node=addDevice(page,pageProject,d,b,'core-'+i,{fitWidth:d.kind!=='handoff',padding:fit.padding});nodes.set(id,node);
   if(d.kind!=='handoff'){
    const titleKey=page.name+'|title|'+id,titlePatch=pageProject.layout?.drawingEdits?.[titleKey]||{},titleValue=titlePatch.value??name(d),titleSize=titlePatch.size||18,titleWidth=titlePatch.w||Math.min(node.w,textWidth(titleValue,titleSize,titlePatch.bold??true)),titleHeight=Math.max(titlePatch.h||23,wrapPortText(titleValue,titleWidth,titleSize,titlePatch.bold??true).length*titleSize*1.2),titleY=node.y-titleHeight-6;
    label(items,node.x,titleY,titleWidth,titleHeight,titleValue,titleSize,titlePatch.bold??true);Object.assign(items.at(-1),{full:true,titleOwner:id,editKey:titleKey});
    const detail=deviceDetails(d);
    const detailKey=page.name+'|detail|'+id,detailPatch=pageProject.layout?.drawingEdits?.[detailKey]||{},detailValue=detailPatch.value??detail,detailSize=detailPatch.size||12,detailWidth=detailPatch.w||Math.min(node.w,textWidth(detailValue,detailSize,detailPatch.bold)),detailHeight=Math.max(detailPatch.h||18,wrapPortText(detailValue,detailWidth,detailSize,detailPatch.bold).length*detailSize*1.2);
    label(items,node.x,node.y+node.h+5,detailWidth,detailHeight,detailValue,detailSize,detailPatch.bold??false,C.muted);Object.assign(items.at(-1),{full:true,titleOwner:id,titleSlot:'detail',editKey:detailKey});
   }
   if(d.kind==='handoff'){label(items,node.x+8,node.y,node.w-16,node.h,d.name,12,true,C.ink,'center');items.at(-1).deviceTextOwner=id;if(d.ip)label(items,node.x-20,node.y-19,node.w+40,14,d.ip,10,false,C.muted,'center');}
   row+=m.height*scale+expansion;
  });
  for(const [owner,attached] of attachments){const host=nodes.get(owner);if(!host)continue;const local=attached.filter(id=>members.has(id)),cards=handoffRows(local.map(id=>db.devices.get(id)),host.w/scale,sheet.spreadHandoffs),{cols}=cards,cardWidth=cards.width*scale,gap=cards.gap*scale;
   local.forEach((id,i)=>{const d=db.devices.get(id),card=handoffCard(d,cards.width),rowIds=local.slice(Math.floor(i/cols)*cols,Math.floor(i/cols)*cols+cols),rowWidth=rowIds.length*cardWidth+(rowIds.length-1)*gap;
    const knownPort=Object.keys(host.ports).find(port=>port.toLowerCase()===String(d.ownerPort||'').toLowerCase()),anchor=rowIds.length===1&&knownPort?getAnchor(host,knownPort,'top',0):null;
    const center=anchor?.side==='top'?Math.max(host.x+rowWidth/2,Math.min(host.x+host.w-rowWidth/2,anchor.x)):host.x+host.w/2;
    const x=center-rowWidth/2+(i%cols)*(cardWidth+gap),y=host.y-pageSizes.get(owner).top*scale+cards.rows.slice(0,Math.floor(i/cols)).reduce((a,b)=>a+b,0)*scale,node=addDevice(page,pageProject,d,[x,y,cardWidth,card.height*scale],'handoff-'+id,{fillBounds:true});nodes.set(id,node);
    label(items,node.x+12*scale,node.y+4*scale,Math.max(1,(node.w-24*scale)/1.12),card.titleHeight*scale,d.name,18*scale,true,C.ink);items.at(-1).deviceTextOwner=id;
    label(items,node.x+12*scale,node.y+(card.titleHeight+6)*scale,Math.max(1,(node.w-24*scale)/1.12),card.detailHeight*scale,card.detail,12*scale,false,C.muted);items.at(-1).deviceTextOwner=id;
   });
  }
  applyDrawingEdits(page,pageProject);
  const endData=new Map(),banks=new Map();
  for(const e of used)for(const [id,port,other,which] of [[e.a,e.ap,e.b,'a'],[e.b,e.bp,e.a,'b']]){
   if(!nodes.has(id)||!localPort(sheet,id,port))continue;
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
  const stack=[...nodes.values()].filter(n=>n.kind!=='handoff'),withinPage=stack.length&&stack.every(n=>n.x>=sidebar.contentLeft+18&&n.x+n.w<=(W-56));
  const routingBounds=withinPage?{left:Math.min(...stack.map(n=>n.x)),right:Math.max(...stack.map(n=>n.x+n.w))}:{left:sidebar.bodyLeft,right:sidebar.bodyLeft+width};
  const planned=coreRoutes(internal,external,endData,banks,nodes,{...routingBounds,minX:sidebar.contentLeft,maxX:W-38,...spacing(fit.padding),railPitch:fit.railPitch,scale,obstacles});
  if(planned.cost[0]&&[...nodes.values()].every(n=>n.x>=sidebar.contentLeft&&n.x+n.w<=(W-38)&&n.y>=145&&n.y+n.h<=(H-69)))throw Object.assign(Error('This core page needs more room to route cables around the equipment.'),{code:'CORE_LAYOUT_CAPACITY',page:page.name});
  const outer={left:Math.min(routingBounds.left-18,...planned.routes.filter(r=>r.side==='left').map(r=>r.rail)),right:Math.max(routingBounds.right+18,...planned.routes.filter(r=>r.side==='right').map(r=>r.rail))},requests=[];
  for(const r of planned.routes.filter(r=>!r.v)){
   const {e,a,b}=r;
   route(page,a.anchor,b.anchor,r.points,a.info.color,'L'+(e.idx+1)+' '+name(db.devices.get(e.a))+' '+e.ap+' / '+name(db.devices.get(e.b))+' '+e.bp,a.info.name,{a:e.a,ap:e.ap,b:e.b,bp:e.bp,media:e.media,speed:e.speed,status:e.status},[e.a,e.b].map(id=>db.devices.get(id)).find(d=>d.kind==='handoff'&&!project.devices.some(p=>p.id===d.id)));
   page.items.at(-1).linkId=e.idx;
   const y=(a.ay+b.ay)/2,text=linkCaption(project,a.info.name,rate(e.speed));
   const horizontal=r.points.slice(1).map((p,i)=>[r.points[i],p]).filter(([a,b])=>a[1]===b[1]).sort((a,b)=>Math.abs(b[1][0]-b[0][0])-Math.abs(a[1][0]-a[0][0]))[0];
   requests.push({role:'media',editKey:page.name+'|media|'+linkKey(e),linkId:e.idx,value:text,y,side:r.side,outer:outer[r.side],...(r.points.length<=4?horizontal?{segment:horizontal}:{near:{x:r.points[0][0]+9,y:(r.points[0][1]+r.points.at(-1)[1])/2}}:{}),color:a.info.color==='#FFD965'?C.ink:a.info.color});
  }
  for(const r of planned.references){
   const {e,v,which:local}=r,remote=local==='a'?e.b:e.a,port=local==='a'?e.bp:e.ap;
   const destination=edgeLocations.get(remote+'/'+e.idx)||locations.get(remote)||'Core Network',ref=presentation(project,destination).name||destination,stub={id:'continuation-'+pi+'-'+e.idx,name:ref,kind:'handoff',ports:[{name:'handoff'}]};
   const code='L'+(e.idx+1),badgeWidth=textWidth(code,9,true)+4;
   const n=addDevice(page,project,stub,[r.x-badgeWidth,r.y-7,badgeWidth,14],'reference-'+e.idx,{fillBounds:true});n.ports.handoff=[1,.5];
   label(n.children,0,0,1,1,code,9,true,C.teal,'center');
   const end=getAnchor(n,'handoff','top',0);
   route(page,v.anchor,end,r.points,v.info.color,'L'+(e.idx+1)+' '+name(db.devices.get(remote))+' '+port+' on '+ref,v.info.name,{a:e.a,ap:e.ap,b:e.b,bp:e.bp,media:e.media,speed:e.speed,status:e.status});
   Object.assign(page.items.at(-1),{linkId:e.idx,startEndpoint:local});
   requests.push({role:'reference',editKey:page.name+'|reference|'+linkKey(e)+'|'+v.id,linkId:e.idx,value:[code+' '+name(db.devices.get(remote)),port+' / '+ref],y:r.y,side:'left',outer:r.x,color:C.teal});
  }
  for(const v of planned.ends.values())if(v.node.kind!=='handoff'){
   const port=v.which==='a'?v.e.ap:v.e.bp,r=planned.routes.find(r=>r.e===v.e),side=r?.side||'left',rail=r?.rail||LEFT-26;
   const horizontals=r?.points.slice(1).map((p,i)=>[r.points[i],p]).filter(([a,b])=>a[1]===b[1])||[],segment=v.which==='a'?horizontals[0]:horizontals.at(-1);
   requests.unshift({role:'port',endpoint:v.which,editKey:page.name+'|port|'+linkKey(v.e)+'|'+v.id,linkId:v.e.idx,value:port,y:v.ay,side,outer:outer[side],...(segment?{segment}:{near:{x:v.anchor.x+9,y:v.ay}}),color:C.ink});
  }
  applyDrawingEdits(page,pageProject);
  for(const req of requests.filter(r=>r.role==='media')){const path=page.items.find(i=>i.type==='path'&&i.sourceLink&&linkKey(i.sourceLink)===req.editKey.split('|media|')[1]);if(path){const h=path.color.replace('#',''),v=[0,2,4].map(n=>parseInt(h.slice(n,n+2),16));req.color=(v[0]*.299+v[1]*.587+v[2]*.114)>180?C.ink:path.color;}}
  linkLegend(page);const modulePages=moduleLegend(page,pageProject);applyDrawingEdits(page,pageProject);for(const continued of modulePages)applyDrawingEdits(continued,pageProject);
  informationPanel(page,pageProject);scaleText(page,pageProject);bridge(page);fitDynamicPage(page,pageProject);placeDeviceTitles(page,pageProject,nodes);fitDynamicPage(page,pageProject);
  const fontFactor=presentation(pageProject,page).textScale;for(const request of requests){request.size=12*fontFactor;request.minSize=Math.min(12,request.size);request.fontFactor=fontFactor;}
  const placed=placeCableLabels(page,requests,pageProject.layout?.drawingEdits);
  if(!placed.ok)throw Object.assign(Error('This core page needs more room for the '+placed.failed.role+' label '+JSON.stringify(placed.failed.value)+'. Move devices to another core page under Device order / Core pages.'),{code:'CORE_LAYOUT_CAPACITY',role:placed.failed.role,page:page.name});
  const pages=[page,...modulePages];rendered.set(sheet,{signature,pages});return pages;
 });
 }catch(error){
  const index=packed.findIndex(sheet=>sheet.name===error.page),sheet=packed[index];
  if(error.code!=='CORE_LAYOUT_CAPACITY'||!sheet)throw error;
  // Keep the cards compact; use more of the same stack width only when their
  // cable labels or routes cannot fit safely in the tighter arrangement.
  if(!sheet.spreadHandoffs&&sheet.ids.some(id=>attachments.get(id)?.length>1)){sheet.spreadHandoffs=true;continue;}
  if(!dynamic&&(sheet.fit||0)<FITS.length-1){sheet.fit=(sheet.fit||0)+1;sheet.spreadHandoffs=false;continue;}
  if(dynamic){
   if((sheet.expansion||0)>=768)throw error;
   sheet.expansion=(sheet.expansion||0)+128;sheet.fit=0;sheet.spreadHandoffs=false;continue;
  }
  // A named group can continue at full device scale, just like an automatic group.
  // The saved membership is unchanged; users can move devices from any visible sheet.
  const owners=sheet.ids.filter(id=>!db.devices.get(id).owner||!sheet.ids.includes(db.devices.get(id).owner));
  if(owners.length<2){
   const id=owners[0],d=viewDevice(sheet,id),members=d?.stackMembers||[];
   if(members.length<2||d.stencilId||d.stencil)throw error;
   const middle=Math.ceil(members.length/2),parts=[members.slice(0,middle),members.slice(middle)];
   packed.splice(index,1,...parts.map(stackMembers=>{const ids=new Set(stackMembers.map(m=>String(m.id))),ports=(d.ports||[]).filter(p=>ids.has(String(p.name).match(/^(?:(?:Gi|Te|TwentyFiveGigE|HundredGigE|Ethernet|Eth))?(\d+)\//i)?.[1])),view={...d,name:name(db.devices.get(id))+' (members '+stackMembers.map(m=>m.id).join(', ')+')',stackMembers,ports,stackContinuation:true};
    const next={...sheet,ids:[id],views:{[id]:view},fit:0,spreadHandoffs:false};next.ids.unshift(...(attachments.get(id)||[]).filter(h=>localPort(next,id,db.devices.get(h).ownerPort)));return next;}));continue;
  }
  const left=new Set(owners.slice(0,-1)),groups=[sheet.ids.filter(id=>left.has(id)||left.has(db.devices.get(id).owner)),sheet.ids.filter(id=>!left.has(id)&&!left.has(db.devices.get(id).owner))];
  // Keep the overflowing tail with the next compatible sheet, so one failed
  // arrangement cannot strand a single device on its own intermediate page.
  const next=packed[index+1],continuing=next&&next.custom===sheet.custom&&next.corePageId===sheet.corePageId&&!next.linkIds&&!sheet.linkIds&&!next.views&&!sheet.views&&next.baseName===sheet.baseName;
  if(continuing){next.ids=[...groups[1],...next.ids];next.fit=0;next.spreadHandoffs=false;groups.pop();}
  packed.splice(index,1,...groups.map(ids=>({...sheet,name:sheet.baseName,ids,fit:0,spreadHandoffs:false})));
 }
 }
 throw Error('This core layout needs more space. Assign devices to additional core pages.');
}
