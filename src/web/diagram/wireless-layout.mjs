import {deviceScale,presentation} from '../presentation.mjs';
import {pageGeometry} from '../page-options.mjs';
import {applyDrawingEdits} from '../drawing-edits.mjs';
import {applyLinkStyles} from '../link-styles.mjs';
import {deviceModel,macCaption} from '../device-details.mjs';
import {wrapPortText} from '../port-table.mjs';
import {equipmentPadding,equipmentSize,equipmentViews,equipmentScope,equipmentGapPlan,canContinueEquipment} from './equipment-layout.mjs';
import {coreRoutes} from './routing.mjs';
import {lineSpacing} from '../layout.mjs';
import {wirelessNumberLeads} from './wireless-number-leads.mjs';
import {crossesText} from './labels.mjs';
import {C,addDevice,cableWeight,fresh,getAnchor,label,linkLegend,mediaInfo,physicalPorts,rate,route} from './scene.mjs';

const cmp=(a,b)=>String(a).localeCompare(String(b),'en',{numeric:true,sensitivity:'base'});
const nameOf=d=>String(d?.name||d?.id||'Unnamed');
const capacityError=message=>Object.assign(Error(message),{code:'WIRELESS_LAYOUT_CAPACITY'});
const pageScope=(project,device,batchIndex)=>(project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections|'+equipmentScope(device)+'|sheet:'+batchIndex;
function organizing(project,scope){const value=project._organizeCandidate;return value===true||value?.family==='wireless'&&(!scope||!value.scope||value.scope===scope);}
function pathKey(project,e){
 let hash=0;for(const c of JSON.stringify(['AP link '+(e.idx+1)]))hash=Math.imul(hash,31)+c.charCodeAt(0)|0;
 const prefix=(project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections',suffix='|path|'+hash+'|0',key=prefix+suffix,edits=project.layout?.drawingEdits||{};
 if(edits[key])return key;
 // Older sheets numbered path keys after pagination. A link's original index
 // is unique in this family, so retain that saved key when sheets consolidate.
 return Object.keys(edits).find(k=>k.endsWith(suffix)&&(k.startsWith(prefix+'|')||k.startsWith(prefix+' ')&&/^ \d+\|/.test(k.slice(prefix.length))))||key;
}
const pathWeight=(project,e)=>project.layout?.drawingEdits?.[pathKey(project,e)]?.weight||cableWeight;
function identityKey(project,e,role){
 let hash=14695981039346656037n;for(const c of JSON.stringify([e.apId,e.sw,e.sp,e.apPort]))hash=BigInt.asUintN(64,(hash^BigInt(c.codePointAt(0)))*1099511628211n);
 return (project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections|'+role+'|'+hash.toString(36);
}
function captionTitleKey(project,db,e){
 const key=identityKey(project,e,'title'),edits=project.layout?.drawingEdits||{},ap=db.devices.get(e.apId);if(edits[key]||[...db.devices.values()].filter(d=>d.kind==='ap'&&nameOf(d)===nameOf(ap)).length!==1)return key;
 let hash=0;for(const c of JSON.stringify([nameOf(ap),undefined]))hash=Math.imul(hash,31)+c.charCodeAt(0)|0;const prefix=(project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections',matches=Object.keys(edits).filter(key=>(key.startsWith(prefix+'|')||key.startsWith(prefix+' '))&&key.includes('|text|'+hash+'|'));
 return matches.length===1?matches[0]:key;
}
function captionFor(project,e){const name=mediaInfo(e.media,true).name,s=project.layout?.linkStyles?.[name]||{};return [s.lineTitle&&s.lineTitle!==name?s.lineTitle:'',s.lineDescription].filter(Boolean).join(' | ');}
function measured(project,e,role,value,width,defaults={}){
 const key=defaults.key||identityKey(project,e,role),patch=project.layout?.drawingEdits?.[key]||{},size=patch.size||defaults.size||12,w=patch.w||width,bold=patch.bold??defaults.bold??false,text=patch.value??value;
 return {key,value:text,size,w,bold,height:patch.hidden||!text?0:Math.max(patch.h||defaults.height||18,wrapPortText(text,w,size,bold).length*size*1.25)};
}
function captions(project,db,e,width){
 const ap=db.devices.get(e.apId),register=[e.sp||'Port unknown',rate(e.speed)].filter(Boolean).join(' · '),detail=[ap.ip,e.apPort||'AP port unspecified'].filter(Boolean).join(' · ');
 const title=measured(project,e,'title',nameOf(ap),width,{key:captionTitleKey(project,db,e),size:18,bold:true,height:26}),registerText=measured(project,e,'register',register,width,{size:13,bold:true,height:21}),detailText=measured(project,e,'detail',detail,width),model=measured(project,e,'model',deviceModel(ap),width),mac=measured(project,e,'mac',macCaption(ap,e.apPort),width),notes=captionFor(project,e)?wrapPortText(captionFor(project,e),width,12):[];
 return {title,register:registerText,detail:detailText,model,mac,notes,width:Math.max(width,title.w,registerText.w,detailText.w,model.w,mac.w),height:title.height+2+model.height+registerText.height+1+detailText.height+mac.height+2+notes.length*14};
}
function captionItems(page,project,db,e,center,y,width,caption){
 const items=page.items,ap=db.devices.get(e.apId);
 const text=(role,x,top,w,h,value,size,bold,color)=>{label(items,x,top,w,h,value,size,bold,color,'center');Object.assign(items.at(-1),{editKey:identityKey(project,e,role),wirelessCaption:true,sourceId:ap.id,deviceTextOwner:ap.id,ownerInstanceKey:e.sw+'/'+e.sp+'/'+e.apPort,full:true});};
 const title=caption.title;text('title',center-title.w/2,y,title.w,title.height,title.value,title.size,title.bold,C.ink);items.at(-1).editKey=title.key;let cy=y+title.height+2;
 // Legacy AP titles used numbered page keys. A uniquely named AP can retain
 // its existing title edit while all new captions use stable link identities.
 if(caption.model.height){const m=caption.model;text('model',center-m.w/2,cy,m.w,m.height,m.value,m.size,m.bold,C.muted);Object.assign(items.at(-1),{editKey:m.key,deviceInfo:'model'});cy+=m.height;}
 const register=caption.register;text('register',center-register.w/2,cy,register.w,register.height,register.value,register.size,register.bold,C.teal);cy+=register.height+1;
 const detail=caption.detail;text('detail',center-detail.w/2,cy,detail.w,detail.height,detail.value,detail.size,detail.bold,C.muted);cy+=detail.height;
 if(caption.mac.height){const m=caption.mac;text('mac',center-m.w/2,cy,m.w,m.height,m.value,m.size,m.bold,C.muted);Object.assign(items.at(-1),{editKey:m.key,deviceInfo:'mac'});}
 caption.notes.forEach((value,n)=>text('note'+n,center-width/2,y+caption.height-caption.notes.length*14+n*14,width,14,value,12,false,C.muted));
}

// Reserve only the member gaps actually used by cables. The hardware remains
// at one common width; more space is added between members only when painted
// strokes would otherwise touch. Dynamic canvases may grow past paper limits.
function stackSpacing(project,device,edges,width){
 return equipmentGapPlan(project,device,edges,width,{weight:e=>pathWeight(project,e)});
}

// AP banks are measured from their real captions and real socket positions.
// Candidate bank splits balance page area against travel distance, without a
// device-height or name-length rule that creates one page for each AP.
function bankLayout(project,db,device,edges,width,spacing,geometry){
 const panel=addDevice({items:[]},project,device,[0,0,width,1],'measure',{fitWidth:true,...spacing}),apSize=72*width/998;
 const ends=edges.map(e=>({e,anchor:getAnchor(panel,e.sp,panel.moduleChannel?'auto':'top',e.idx,{weight:pathWeight(project,e)}),apGeometry:addDevice({items:[]},project,db.devices.get(e.apId),[0,0,apSize,apSize],'measure-ap')}));
 const byHeight=ends.slice().sort((a,b)=>a.anchor.y-b.anchor.y||a.anchor.x-b.anchor.x||a.e.idx-b.e.idx),natural=new Set(ends.filter(v=>v.anchor.y<panel.h/2).map(v=>v.e.idx)),balanced=new Set(byHeight.slice(0,Math.ceil(ends.length/2)).map(v=>v.e.idx)),splits=[natural];
 if([...balanced].some(id=>!natural.has(id))||balanced.size!==natural.size)splits.push(balanced);
 const choices=[],captionCache=new Map(),legendCache=new Map(),maxWeight=Math.max(cableWeight,...ends.map(v=>v.anchor.weight)),pitch=Math.max(7,maxWeight+3),margin=Math.max(46,22+Math.ceil(edges.length/2)*pitch);
 for(const topIds of splits)for(const rowCount of geometry.dynamic&&edges.length>12?[1,2,3]:[1])for(const col of geometry.dynamic?[132,180,245,360,680]:[132,180,245,360,680].filter(w=>w<=geometry.width-100)){
  const banks={top:[],bottom:[]};for(const v of ends){const key=v.e.idx+'/'+col;if(!captionCache.has(key))captionCache.set(key,captions(project,db,v.e,col));banks[topIds.has(v.e.idx)?'top':'bottom'].push({...v,caption:captionCache.get(key)});}
  for(const bank of Object.values(banks))bank.sort((a,b)=>a.anchor.x-b.anchor.x||a.anchor.y-b.anchor.y||a.e.idx-b.e.idx);
  const rows=Object.fromEntries(Object.entries(banks).map(([side,bank])=>{const capacity=Math.max(1,Math.ceil(bank.length/rowCount)),rows=[];for(let i=0;i<bank.length;i+=capacity){const items=bank.slice(i,i+capacity);rows.push({items,width:items.reduce((n,v)=>n+Math.max(v.apGeometry.w,v.caption.width)+16,0),height:Math.max(...items.map(v=>v.caption.height)),apHeight:Math.max(...items.map(v=>v.apGeometry.h)),lanes:28+2*pitch*items.length});}return [side,rows];}));
  const metrics=Object.fromEntries(Object.entries(rows).map(([side,rows])=>[side,{width:Math.max(0,...rows.map(row=>row.width)),height:rows.reduce((n,row)=>n+row.height+row.apHeight+row.lanes+(side==='top'?6:10),0)}]));
  const W=geometry.dynamic?Math.max(geometry.width,panel.w+margin*2,metrics.top.width+92,metrics.bottom.width+92):geometry.width;
  if(panel.w+margin*2>W+.01||Math.max(metrics.top.width,metrics.bottom.width)>W-92)continue;
  if(!legendCache.has(W)){const preview={width:W,height:geometry.height,items:edges.map(e=>({type:'path',color:mediaInfo(e.media,true).color,weight:pathWeight(project,e),linkType:mediaInfo(e.media,true).name,sourceLink:e}))};applyLinkStyles(preview,project.layout?.linkStyles);linkLegend(preview);legendCache.set(W,Math.max(204,(preview.legendBottom||189)+14));}
  const start=legendCache.get(W),switchY=start+metrics.top.height,H=switchY+panel.h+metrics.bottom.height+64;
  if(!geometry.dynamic&&H>geometry.height)continue;
  const travel=ends.reduce((sum,v)=>sum+(topIds.has(v.e.idx)?v.anchor.y:panel.h-v.anchor.y),0);
  const score=Math.max(W,H)**2+.15*W*H+travel*60;
  choices.push({W,H,start,switchY,width,...spacing,apSize,pitch,banks,rows,metrics,col,score,panel,rowCount});
 }
 return choices.sort((a,b)=>a.score-b.score||a.col-b.col);
}

function renderBankPage(project,db,device,edges,layout,batchIndex,portNumbers){
 const local={...project,_pageGeometry:{...project._pageGeometry,wireless:{width:layout.W,height:Math.max(pageGeometry(project,'wireless').height,layout.H)}}},page=fresh('Wireless Connections','Wireless Connections',nameOf(device)+'  ·  access-point uplinks and physical switch ports',local);
 page.editScope=pageScope(project,device,batchIndex);page.sourceDeviceIds=[device.id,...new Set(edges.map(e=>e.apId))];page.wirelessDeviceIds=[...page.sourceDeviceIds];
 const sw=addDevice(page,project,device,[(layout.W-layout.panel.w)/2,layout.switchY,layout.width,1],'switch',{fitWidth:true,padding:layout.padding,memberGaps:layout.memberGaps}),nodes=new Map([[device.id,sw]]),endData=new Map(),banks=new Map(),routed=[];
 const addEnd=(edge,which,node,anchor,key)=>{const data={e:edge,id:node.sourceId,which,node,anchor,info:mediaInfo(edge.media,true)};endData.set(edge.idx+'/'+which,data);if(!banks.has(key))banks.set(key,[]);banks.get(key).push(data);};
 for(const side of ['top','bottom']){
  const top=side==='top';let rowY=top?layout.start:layout.switchY+layout.panel.h,index=0;
  for(const [rowIndex,row] of layout.rows[side].entries()){
  let cursor=(layout.W-row.width)/2;
  for(const {e,caption,apGeometry} of row.items){const i=index++,y=top?rowY+row.height+6+row.apHeight-apGeometry.h:rowY+row.lanes,textY=top?rowY:y+apGeometry.h+10;
   const cell=Math.max(apGeometry.w,caption.width)+16,center=cursor+cell/2;cursor+=cell;
   const ap=db.devices.get(e.apId),edgeKey=top?'uplink.bottom':'uplink.top',dest=addDevice(page,project,ap,[center-apGeometry.w/2-apGeometry.x,y-apGeometry.y,layout.apSize,layout.apSize],'ap'+side+i,{apEdge:edgeKey,instanceKey:e.sw+'/'+e.sp+'/'+e.apPort});nodes.set('ap/'+e.idx,dest);
   captionItems(page,project,db,e,dest.x+dest.w/2,textY+dest.y-y+(top?0:dest.h-apGeometry.h),layout.col,caption);
   const weight=pathWeight(project,e),mappedPort=Object.keys(dest.ports).find(port=>port.toLowerCase()===String(e.apPort).toLowerCase())||edgeKey,end=getAnchor(dest,mappedPort,top?'bottom':'top',i,{weight}),start=getAnchor(sw,e.sp,side,e.idx,{weight,peer:{x:end.x,y:end.y}}),edge={...e,a:e.sw,ap:e.sp,b:'ap/'+e.idx,bp:mappedPort};routed.push(edge);
   const gap=start.escapeRange?'gap/'+start.escapeRange.map(v=>v.toFixed(3)).join('/'):'edge/'+start.side;
   addEnd(edge,'a',sw,start,'switch/'+gap);addEnd(edge,'b',dest,end,'ap/'+side+'/'+rowIndex);
  }
  rowY+=row.height+row.apHeight+row.lanes+(top?6:10);
  }
 }
 portNumbers(page.items,sw,physicalPorts(device),{selected:new Set(edges.map(e=>e.sp.toLowerCase())),fontScale:presentation(project,'Wireless Connections').textScale});
 applyDrawingEdits(page,project);
 const numberBoxes=wirelessNumberLeads(page,sw,endData,project),obstacles=[...numberBoxes.obstacles,...page.items.filter(i=>i.type==='text'&&!i.portNumberRole&&(i.wirelessCaption||!i.deviceTextOwner))],planned=coreRoutes(routed,[],endData,banks,nodes,{left:sw.x,right:sw.x+sw.w,minX:36,maxX:layout.W-36,pitch:layout.pitch,railPitch:layout.pitch,topClearance:12,bottomClearance:12,obstacles,uniform:lineSpacing(project,page.name)});
 // Validate every complete lead once, including internal number bands.
 planned.cost[0]+=planned.routes.filter(r=>numberBoxes.numbers.some(box=>crossesText(r.points,box,r.weight/2))).length;
 for(const r of planned.routes){const e=edges.find(e=>e.idx===r.e.idx);route(page,r.a.anchor,r.b.anchor,r.points,r.a.info.color,'AP link '+(e.idx+1),r.a.info.name,{a:e.a,ap:e.ap,b:e.b,bp:e.bp,media:e.media,speed:e.speed,status:e.status});Object.assign(page.items.at(-1),{editKey:pathKey(project,e),linkId:e.idx,weight:pathWeight(project,e)});}
 page.wirelessLayout={kind:'banks',rows:layout.rowCount,deviceId:device.id,memberIds:(device.stackMembers||[]).map(m=>String(m.id)),padding:layout.padding,memberGaps:layout.memberGaps,links:edges.map(e=>e.idx),routingCost:planned.cost,routingStats:planned.stats};
 return page;
}

function assignedEdges(project,parts,edges,width){
 const owners=parts.map(d=>new Set([...physicalPorts(d).map(p=>p.name),...Object.keys(addDevice({items:[]},project,d,[0,0,width,1],'inspect',{fitWidth:true,padding:equipmentPadding}).ports)].map(n=>n.toLowerCase()))),assigned=parts.map(()=>[]);
 for(const e of edges){const owner=owners.findIndex(ports=>ports.has(e.sp.toLowerCase()));assigned[Math.max(0,owner)].push(e);}
 return assigned;
}
function pageBatches(project,db,device,edges,width,geometry){
 const batches=[],probe=addDevice({items:[]},project,device,[0,0,width,1],'inspect',{fitWidth:true,padding:equipmentPadding}),keys=new Map(edges.map(e=>{const a=getAnchor(probe,e.sp,probe.moduleChannel?'auto':'top',e.idx);return [e,a.x.toFixed(4)+'/'+a.y.toFixed(4)];}));
 for(const edge of edges){const key=keys.get(edge);let current=geometry.dynamic?batches.find(batch=>batch.every(e=>keys.get(e)!==key)):batches.at(-1);if(current?.some(e=>keys.get(e)===key))current=null;const next=current?[...current,edge]:[edge];
  if(current&&(geometry.dynamic||bankLayout(project,db,device,next,width,stackSpacing(project,device,next,width),geometry).length))current.push(edge);
  else{if(!geometry.dynamic&&!bankLayout(project,db,device,[edge],width,stackSpacing(project,device,[edge],width),geometry).length)return null;batches.push([edge]);}
 }
 return batches;
}

export function buildWirelessPages(project,db,{portNumbers,tablePages,empty}){
 let geometry=pageGeometry(project,'wireless'),width=geometry.width-202;
 const apIds=new Set([...db.devices.keys()].filter(id=>db.devices.get(id).kind==='ap')),linked=new Set(),groups=new Map();
 for(const e of db.links){const left=apIds.has(e.a),right=apIds.has(e.b);if(left===right)continue;const sw=left?e.b:e.a,edge={...e,sw,sp:left?e.bp:e.ap,apId:left?e.a:e.b,apPort:left?e.ap:e.bp};if(!groups.has(sw))groups.set(sw,[]);groups.get(sw).push(edge);linked.add(edge.apId);}
 const devices=[...groups.keys()].map(id=>db.devices.get(id));
 if(!geometry.dynamic)width=Math.min(width,...devices.filter(d=>!canContinueEquipment(project,d)).map(d=>width*Math.max(90,geometry.height-500)/(equipmentSize(project,d,width).h/deviceScale(project,d))));
 for(let attempt=0;attempt<(organizing(project)?1:4);attempt++){
  let required=width;
  for(const device of devices){const probe=addDevice({items:[]},project,device,[0,0,width,1],'inspect',{fitWidth:true,padding:equipmentPadding});try{portNumbers([],probe,physicalPorts(device),{fontScale:presentation(project,'Wireless Connections').textScale});}catch(error){if(error.code!=='PORT_LABEL_CAPACITY'||!Number.isFinite(error.requiredWidth))throw error;required=Math.max(required,error.requiredWidth/deviceScale(project,device)+2);}}
  if(required<=width+.01)break;if(organizing(project))throw capacityError('This arrangement needs more room for readable wireless ports.');width=required;
 }
 if(!geometry.dynamic&&width>geometry.width-92)throw capacityError('This wireless sheet needs a wider page for readable ports and cables.');
 const out=[];
 for(const [sw,records] of groups){
  const source=db.devices.get(sw),sorted=records.slice().sort((a,b)=>cmp(a.sp,b.sp)||cmp(a.apId,b.apId)),whole=geometry.dynamic?[]:bankLayout(project,db,source,sorted,width,stackSpacing(project,source,sorted,width),geometry);
  // Keep complete dynamic stacks. Fixed paper tries the whole stack before a
  // physical member continuation, and never slices an imported faceplate.
  if(!geometry.dynamic&&organizing(project,pageScope(project,source,0))&&!whole.length)throw capacityError('This arrangement needs more room for wireless captions.');
  let parts=[source],assigned=[sorted],prepared;
  if(!geometry.dynamic&&!whole.length){
   const variants=[[source],...[480,600,700].map(reserve=>equipmentViews(project,source,width,Math.max(80,geometry.height-reserve))),equipmentViews(project,source,width,Math.max(80,width/7))],seen=new Set(),plans=[];
   for(const variant of variants){const signature=variant.map(equipmentScope).join(';');if(seen.has(signature))continue;seen.add(signature);const owned=assignedEdges(project,variant,sorted,width),batches=variant.map((part,i)=>pageBatches(project,db,part,owned[i],width,geometry));if(batches.some(value=>!value))continue;plans.push({parts:variant,assigned:owned,prepared:batches,count:batches.reduce((n,b)=>n+b.length,0)});}
   const fit=plans.sort((a,b)=>a.count-b.count||a.parts.length-b.parts.length)[0];if(!fit)throw capacityError('This wireless caption needs more space. Choose a larger or dynamic page.');({parts,assigned,prepared}=fit);
  }
  for(const [partIndex,device] of parts.entries()){
   const edges=assigned[partIndex];if(!edges.length)continue;const batches=prepared?.[partIndex]||pageBatches(project,db,device,edges,width,geometry);if(!batches)throw capacityError('This wireless caption needs more space. Choose a larger or dynamic page.');
   for(let batchIndex=0;batchIndex<batches.length;batchIndex++){const batch=batches[batchIndex],candidate=organizing(project,pageScope(project,device,batchIndex));
    const spacing=stackSpacing(project,device,batch,width),choices=bankLayout(project,db,device,batch,width,spacing,geometry);if(!choices.length)throw capacityError('This wireless caption needs more space. Choose a larger or dynamic page.');
    let selected,error,attempts=0,candidates=0;
    const alternatives=[...new Map(choices.map(choice=>[choice.rowCount,choice])).keys()].map(rows=>choices.find(choice=>choice.rowCount===rows));alternatives.push(...choices.filter(choice=>!alternatives.includes(choice)).slice(0,3));
    for(const choice of alternatives.slice(0,candidate?1:6)){attempts++;try{const page=renderBankPage(project,db,device,batch,choice,batchIndex,portNumbers);candidates+=page.wirelessLayout.routingStats.candidates;if(!selected||page.wirelessLayout.routingCost[0]+page.wirelessLayout.routingCost[1]<selected.wirelessLayout.routingCost[0]+selected.wirelessLayout.routingCost[1])selected=page;if(!page.wirelessLayout.routingCost[0]&&!page.wirelessLayout.routingCost[1])break;}catch(e){if(e.code!=='CORE_LAYOUT_CAPACITY')throw e;error=e;}}
    if(!selected||selected.wirelessLayout.routingCost[0]||selected.wirelessLayout.routingCost[1]){
     if(!candidate&&batch.length>1){const middle=Math.ceil(batch.length/2);batches.splice(batchIndex,1,batch.slice(0,middle),batch.slice(middle));batchIndex--;continue;}
     else throw error||capacityError('This wireless page needs more room for its connections.');
    }
    Object.assign(selected.wirelessLayout,{attempts,totalRouteCandidates:candidates});out.push(selected);
   }
  }
 }
 const unseen=[...apIds].filter(id=>!linked.has(id)).map(id=>db.devices.get(id));if(unseen.length)out.push(...tablePages(project,'Wireless Connections','Access points with no mapped switch uplink',[['Access point',390],['Model',370],['IP / MAC address',368]],unseen.map(d=>Object.assign([nameOf(d),deviceModel(d),[d.ip,macCaption(d)].filter(Boolean).join(' | ')],{sourceDeviceId:d.id})),''));
 if(!out.length){const layout=project.layout||{},pattern=/(?:^|\|)Wireless Connections(?:\b|\|)/,retained=project._reportPrefix||layout.documentation==='full'||layout.pageSetup?.overrides?.wireless||Object.keys(layout.drawingEdits||{}).some(key=>pattern.test(key))||Object.keys(layout.presentation?.pages||{}).some(key=>pattern.test(key));if(retained){const p=fresh('Wireless Connections','Wireless Connections','Access-point uplinks',project);empty(p,'No access points or switch-to-AP links were supplied.');out.push(p);}}
 return out;
}
