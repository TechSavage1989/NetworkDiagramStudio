import {deviceBounds} from './device-geometry.mjs';
import {deviceScale,presentation} from '../presentation.mjs';
import {pageGeometry,targetPageAspect,visibleFitMode,visiblePagePaper,cleanPageSetup,paperDimensions} from '../page-options.mjs';
import {applyDrawingEdits} from '../drawing-edits.mjs';
import {applyLinkStyles,linkWeight} from '../link-styles.mjs';
import {deviceModel,macCaption} from '../device-details.mjs';
import {wrapPortText} from '../port-table.mjs';
import {equipmentPadding,equipmentSize,equipmentViews,equipmentScope,equipmentGapPlan,canContinueEquipment} from './equipment-layout.mjs';
import {coreRoutes} from './routing.mjs';
import {lineSpacing} from '../layout.mjs';
import {wirelessNumberLeads} from './wireless-number-leads.mjs';
import {crossesText,intersects} from './labels.mjs';
import {C,addDevice,cableWeight,fresh,getAnchor,label,linkLegend,mediaInfo,physicalPorts,rate,route} from './scene.mjs';

const cmp=(a,b)=>String(a).localeCompare(String(b),'en',{numeric:true,sensitivity:'base'});
const nameOf=d=>String(d?.name||d?.id||'Unnamed');
const wirelessSettings=project=>presentation(project,project._wirelessPresentationName||((project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections'));
const apScale=project=>(wirelessSettings(project).wirelessApScale||1)*(project._wirelessAdaptiveFactor||1);
function wirelessNumberMinimum(project){
 const config=wirelessSettings(project),visible=project.layout?.pageSetup?.visible||{},name=project._wirelessPresentationName||((project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections'),paper=visiblePagePaper(project,{name,family:'wireless'}),frames={...visible.lockFrames,...visible.editFrames};
 const frozen=Object.entries(frames).filter(([key])=>key.includes('Wireless Connections'));
 if(frozen.length){const exact=frames[project._wirelessFrameName]||frames[name];return exact?.wirelessNumberScale||Math.max(1,...frozen.map(([,frame])=>frame.wirelessNumberScale||1));}
 if(Object.entries(project.layout?.drawingEdits||{}).some(([key,value])=>key.includes('Wireless Connections')&&['x','y','w','h','size','angle','points'].some(k=>value[k]!=null)))return 1;
 // Plan readable number geometry before cables. Do not enlarge a complete
 // switch merely because the old 10px number default is 7.5pt instead of 8pt.
 return paper.preset!=='dynamic'&&visibleFitMode(project)==='optimize'&&!project._wirelessLegacyPaper?Math.max(1,(config.minimumTextPt||0)/7.5):1;
}
const wirelessNumberScale=project=>wirelessSettings(project).textScale*wirelessNumberMinimum(project);

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
const pathWeight=(project,e)=>linkWeight(project,mediaInfo(e.media,true).name,project.layout?.drawingEdits?.[pathKey(project,e)]?.weight);
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
 return {key,value:text,size,w,bold,height:patch.hidden||!text?0:Math.max(patch.h||(project._wirelessAdaptive?size*1.25:defaults.height)||18,wrapPortText(text,w,size,bold).length*size*1.25)};
}
function captions(project,db,e,width){
 const scale=apScale(project),ap=db.devices.get(e.apId),register=[e.sp||'Port unknown',rate(e.speed)].filter(Boolean).join(' · '),detail=[ap.ip,e.apPort||'AP port unspecified'].filter(Boolean).join(' · ');
 const title=measured(project,e,'title',nameOf(ap),width,{key:captionTitleKey(project,db,e),size:18*scale,bold:true,height:26*scale}),registerText=measured(project,e,'register',register,width,{size:13*scale,bold:true,height:21*scale}),detailText=measured(project,e,'detail',detail,width,{size:12*scale,height:18*scale}),model=measured(project,e,'model',deviceModel(ap),width,{size:12*scale,height:18*scale}),mac=measured(project,e,'mac',macCaption(ap,e.apPort,{counts:false}),width,{size:12*scale,height:18*scale}),notes=captionFor(project,e)?wrapPortText(captionFor(project,e),width,12*scale):[];
 return {scale,title,register:registerText,detail:detailText,model,mac,notes,width:Math.max(width,title.w,registerText.w,detailText.w,model.w,mac.w),height:title.height+2+model.height+registerText.height+1+detailText.height+mac.height+2+notes.length*14*scale};
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
 caption.notes.forEach((value,n)=>text('note'+n,center-width/2,y+caption.height-caption.notes.length*14*caption.scale+n*14*caption.scale,width,14*caption.scale,value,12*caption.scale,false,C.muted));
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
 const panel=addDevice({items:[]},project,device,[0,0,width,1],'measure',{fitWidth:true,...spacing}),apSize=72*width/998*apScale(project);
 const ends=edges.map(e=>({e,anchor:getAnchor(panel,e.sp,panel.moduleChannel?'auto':'top',e.idx,{weight:pathWeight(project,e)}),apGeometry:addDevice({items:[]},project,db.devices.get(e.apId),[0,0,apSize,apSize],'measure-ap')}));
 const byHeight=ends.slice().sort((a,b)=>a.anchor.y-b.anchor.y||a.anchor.x-b.anchor.x||a.e.idx-b.e.idx),natural=new Set(ends.filter(v=>v.anchor.y<panel.h/2).map(v=>v.e.idx)),balanced=new Set(byHeight.slice(0,Math.ceil(ends.length/2)).map(v=>v.e.idx)),splits=[natural];
 if([...balanced].some(id=>!natural.has(id))||balanced.size!==natural.size)splits.push(balanced);
 const compactPaper=!geometry.dynamic&&!project._wirelessLegacyPaper&&visibleFitMode(project)==='optimize';
 const targetAspect=cleanPageSetup(project.layout?.pageSetup).visible.wirelessFit==='readable'?targetPageAspect(project,{name:'Wireless Connections',family:'wireless'}):null,choices=[],captionCache=new Map(),legendCache=new Map(),maxWeight=Math.max(cableWeight,...ends.map(v=>v.anchor.weight)),pitch=Math.max(7,maxWeight+3),margin=Math.max(46,22+Math.ceil(edges.length/2)*pitch);
 // Paper can use narrower, fully measured captions and additional banks.
 // Try that space before splitting; never shrink the source caption fonts.
 for(const topIds of splits)for(const rowCount of (geometry.dynamic||compactPaper)&&edges.length>12?[1,2,3]:[1])for(const col of (compactPaper?[104,116,132,180,245,360,680]:[132,180,245,360,680]).map(w=>w*apScale(project)).filter(w=>geometry.dynamic||w<=geometry.width-100)){
  const banks={top:[],bottom:[]};for(const v of ends){const key=v.e.idx+'/'+col;if(!captionCache.has(key))captionCache.set(key,captions(project,db,v.e,col));banks[topIds.has(v.e.idx)?'top':'bottom'].push({...v,caption:captionCache.get(key)});}
  for(const bank of Object.values(banks))bank.sort((a,b)=>a.anchor.x-b.anchor.x||a.anchor.y-b.anchor.y||a.e.idx-b.e.idx);
  // One pitch per lead provides distinct painted lanes on paper. The route
  // validator still rejects collisions and falls back to smaller batches.
  // Keep the established roomier dynamic layout (and its saved coordinates).
  const rows=Object.fromEntries(Object.entries(banks).map(([side,bank])=>{const capacity=Math.max(1,Math.ceil(bank.length/rowCount)),rows=[];for(let i=0;i<bank.length;i+=capacity){const items=bank.slice(i,i+capacity);rows.push({items,width:items.reduce((n,v)=>n+Math.max(v.apGeometry.w,v.caption.width)+16,0),height:Math.max(...items.map(v=>v.caption.height)),apHeight:Math.max(...items.map(v=>v.apGeometry.h)),lanes:28+(compactPaper?1:2)*pitch*items.length});}return [side,rows];}));
  const metrics=Object.fromEntries(Object.entries(rows).map(([side,rows])=>[side,{width:Math.max(0,...rows.map(row=>row.width)),height:rows.reduce((n,row)=>n+row.height+row.apHeight+row.lanes+(side==='top'?6:10),0)}]));
  const W=geometry.dynamic?Math.max(geometry.width,panel.w+margin*2,metrics.top.width+92,metrics.bottom.width+92):geometry.width;
  if(panel.w+margin*2>W+.01||Math.max(metrics.top.width,metrics.bottom.width)>W-92)continue;
  if(!legendCache.has(W)){const preview={width:W,height:geometry.height,items:edges.map(e=>({type:'path',editKey:pathKey(project,e),color:mediaInfo(e.media,true).color,weight:pathWeight(project,e),linkType:mediaInfo(e.media,true).name,sourceLink:e}))};applyLinkStyles(preview,project.layout?.linkStyles,project.layout?.drawingEdits);linkLegend(preview);legendCache.set(W,Math.max(204,(preview.legendBottom||189)+14));}
  const start=legendCache.get(W),switchY=start+metrics.top.height,H=switchY+panel.h+metrics.bottom.height+64;
  if(!geometry.dynamic&&H>geometry.height)continue;
  const travel=ends.reduce((sum,v)=>sum+(topIds.has(v.e.idx)?v.anchor.y:panel.h-v.anchor.y),0);
  const score=(Math.max(W,H)**2+.15*W*H+travel*60)*(targetAspect?1+.75*Math.abs(Math.log((W/H)/targetAspect)):1);
  choices.push({W,H,start,switchY,width,...spacing,apSize,pitch,banks,rows,metrics,col,score,panel,rowCount});
 }
 choices.push(...sideLayoutChoices(project,db,device,edges,width,spacing,geometry,panel,ends,apSize,pitch));
 const retained=wirelessFrame(project)?.wirelessPlan;
 return (retained?choices.filter(choice=>choice.planKey===retained):choices).sort((a,b)=>a.score-b.score||a.col-b.col);
}

// Side columns use the open space beside a stack instead of forcing every AP
// into long top/bottom rows. Keep authored placements and frozen layouts on
// their established plan; these candidates only rearrange automatic content.
function wirelessFrame(project){
 const visible=project.layout?.pageSetup?.visible||{},frames={...visible.lockFrames,...visible.editFrames};
 return frames[project._wirelessFrameName]||frames[project._wirelessPresentationName]||frames[(project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections'];
}
function sideLayoutChoices(project,db,device,edges,width,spacing,geometry,panel,ends,apSize,pitch){
 const edits=project.layout?.drawingEdits||{},frozen=wirelessFrame(project),retained=!!frozen?.wirelessPlan;
 if((wirelessSettings(project).wirelessApPlacement!=='sides'&&!project._wirelessAdaptive&&!retained)||!geometry.dynamic||project._wirelessLegacyPaper||edges.length<8||(frozen&&!retained)||(!retained&&Object.entries(edits).some(([key,value])=>key.includes('Wireless Connections')&&['x','y','w','h','angle','points'].some(k=>value[k]!=null))))return [];
 const result=[],ordered=ends.slice().sort((a,b)=>a.anchor.x-b.anchor.x||a.anchor.y-b.anchor.y||a.e.idx-b.e.idx),left=new Set(ordered.slice(0,Math.ceil(ends.length/2)).map(v=>v.e.idx));
 for(const col of (project._wirelessAdaptive?[116,120,132,180,245]:[132,180,245]).map(w=>w*apScale(project)))for(const fraction of [1,.5])for(const columns of project._wirelessAdaptive&&fraction===1&&edges.length>=16?[1,2]:[1]){
  const sides={left:[],right:[]};
  const horizontal={top:[],bottom:[]};
  const sideIds=fraction===1?new Set(ends.map(v=>v.e.idx)):new Set([...ordered.slice(0,Math.ceil(ends.length/4)),...ordered.slice(-Math.floor(ends.length/4))].map(v=>v.e.idx));
  const middle=ends.filter(v=>!sideIds.has(v.e.idx)).sort((a,b)=>a.anchor.y-b.anchor.y||a.anchor.x-b.anchor.x),topIds=new Set(middle.slice(0,Math.ceil(middle.length/2)).map(v=>v.e.idx));
  for(const v of ends){const item={...v,caption:captions(project,db,v.e,col)};if(sideIds.has(v.e.idx))sides[left.has(v.e.idx)?'left':'right'].push(item);else horizontal[topIds.has(v.e.idx)?'top':'bottom'].push(item);}
  for(const entries of Object.values(horizontal))entries.sort((a,b)=>a.anchor.x-b.anchor.x||a.anchor.y-b.anchor.y);
  for(const [side,entries] of Object.entries(sides))entries.sort((a,b)=>a.anchor.y-b.anchor.y||((side==='left'&&a.anchor.side==='top'||side==='right'&&a.anchor.side==='bottom')?-1:1)*(a.anchor.x-b.anchor.x)||a.e.idx-b.e.idx);
  const bankHeight=entries=>entries.reduce((n,v)=>n+Math.max(v.caption.height,v.apGeometry.h)+18,0),bankWidth=entries=>Math.max(0,...entries.map(v=>v.caption.width+v.apGeometry.w+14));
  const sideColumns=Object.fromEntries(Object.entries(sides).map(([side,entries])=>[side,Array.from({length:columns},(_,col)=>entries.filter((_,i)=>i%columns===col))]));
  const columnGap=36+pitch*2,sideWidth=entries=>entries.reduce((n,v)=>n+bankWidth(v),0)+(columns-1)*columnGap,stagger=columns>1?Math.max(...ends.map(v=>Math.max(captions(project,db,v.e,col).height,v.apGeometry.h)+18))/2:0,sideHeight=entries=>Math.max(...entries.map(bankHeight))+stagger;
  const leftWidth=sideWidth(sideColumns.left),rightWidth=sideWidth(sideColumns.right),lanes=48+Math.max(columns>1?7:18,pitch)*Math.max(sides.left.length,sides.right.length),start=204;
  const rowWidth=entries=>entries.reduce((n,v)=>n+Math.max(v.caption.width,v.apGeometry.w)+18,0),rowHeight=entries=>entries.length?Math.max(...entries.map(v=>v.caption.height+v.apGeometry.h))+48+pitch*entries.length:0;
  const topHeight=rowHeight(horizontal.top),bottomHeight=rowHeight(horizontal.bottom),middleHeight=Math.max(panel.h,sideHeight(sideColumns.left),sideHeight(sideColumns.right));
  const W=Math.max(72+leftWidth+lanes+panel.w+lanes+rightWidth,72+rowWidth(horizontal.top),72+rowWidth(horizontal.bottom)),H=start+topHeight+middleHeight+bottomHeight+36,switchX=(W-(72+leftWidth+lanes+panel.w+lanes+rightWidth))/2+36+leftWidth+lanes,switchY=start+topHeight+(middleHeight-panel.h)/2;
  const placements=[];
  for(const [side,banks] of Object.entries(sideColumns)){
   let offset=0;
   for(const [column,entries] of banks.entries()){
    let y=start+topHeight+(middleHeight-bankHeight(entries))/2+(columns>1?(column?1:-1)*stagger/2:0);
    for(const v of entries){const h=Math.max(v.caption.height,v.apGeometry.h),apX=side==='left'?switchX-lanes-offset-v.apGeometry.w:switchX+panel.w+lanes+offset;
     placements.push({...v,side,rowIndex:column,x:apX,y:y+(h-v.apGeometry.h)/2,captionX:side==='left'?apX-14-v.caption.width/2:apX+v.apGeometry.w+14+v.caption.width/2,captionY:y+(h-v.caption.height)/2});y+=h+18;
    }
    offset+=bankWidth(entries)+columnGap;
   }
  }
  for(const [side,entries] of Object.entries(horizontal)){
   let cursor=(W-rowWidth(entries))/2;
   const height=entries.length?Math.max(...entries.map(v=>v.caption.height)):0;
   for(const v of entries){const cell=Math.max(v.caption.width,v.apGeometry.w)+18,center=cursor+cell/2;cursor+=cell;
    const y=side==='top'?start+height+6:start+topHeight+middleHeight+48+pitch*entries.length;
    placements.push({...v,side,x:center-v.apGeometry.w/2,y,captionX:center,captionY:side==='top'?start:y+v.apGeometry.h+10});
   }
  }
  // Match the existing area/long-axis objective; physical source text is never
  // reduced to win this candidate. Routing still validates every placement.
  const score=Math.max(W,H)**2+.15*W*H;
  result.push({planKey:(columns===2?'columns':fraction===1?'sides':'surround')+':'+Math.round(col/apScale(project)),kind:columns===2?'columns':fraction===1?'sides':'surround',W,H,start,switchX,switchY,width,...spacing,apSize,pitch,panel,col,score,rowCount:columns===2?'columns':fraction===1?'sides':'surround',placements});
 }
 return result;
}

function renderBankPage(project,db,device,edges,layout,batchIndex,portNumbers){
 const local={...project,_pageGeometry:{...project._pageGeometry,wireless:{width:layout.W,height:Math.max(pageGeometry(project,'wireless').height,layout.H)}}},page=fresh('Wireless Connections','Wireless Connections',nameOf(device)+'  ·  access-point uplinks and physical switch ports',local);
 page.editScope=pageScope(project,device,batchIndex);page.sourceDeviceIds=[device.id,...new Set(edges.map(e=>e.apId))];page.wirelessDeviceIds=[...page.sourceDeviceIds];
 const sw=addDevice(page,project,device,[layout.switchX??(layout.W-layout.panel.w)/2,layout.switchY,layout.width,1],'switch',{fitWidth:true,padding:layout.padding,memberGaps:layout.memberGaps}),nodes=new Map([[device.id,sw]]),endData=new Map(),banks=new Map(),routed=[];
 const addEnd=(edge,which,node,anchor,key)=>{const data={e:edge,id:node.sourceId,which,node,anchor,info:mediaInfo(edge.media,true)};endData.set(edge.idx+'/'+which,data);if(!banks.has(key))banks.set(key,[]);banks.get(key).push(data);};
 const placements=layout.placements||[];
 if(!layout.placements)for(const side of ['top','bottom']){
  const top=side==='top';let rowY=top?layout.start:layout.switchY+layout.panel.h,index=0;
  for(const [rowIndex,row] of layout.rows[side].entries()){
   let cursor=(layout.W-row.width)/2;
   for(const v of row.items){const {caption,apGeometry}=v,y=top?rowY+row.height+6+row.apHeight-apGeometry.h:rowY+row.lanes,textY=top?rowY:y+apGeometry.h+10,cell=Math.max(apGeometry.w,caption.width)+16,center=cursor+cell/2;cursor+=cell;
    placements.push({...v,side,rowIndex,index:index++,x:center-apGeometry.w/2,y,captionX:center,captionY:textY});
   }
   rowY+=row.height+row.apHeight+row.lanes+(top?6:10);
  }
 }
 for(const [i,placed] of placements.entries()){
  const {e,caption,apGeometry,side,x,y,captionX,captionY:plannedCaptionY,rowIndex=0}=placed,top=side==='top',lateral=side==='left'||side==='right',ap=db.devices.get(e.apId),edgeKey='uplink.'+(lateral?(side==='left'?'right':'left'):top?'bottom':'top');
  const dest=addDevice(page,project,ap,[x-apGeometry.x,y-apGeometry.y,layout.apSize,layout.apSize],'ap'+side+i,{apEdge:edgeKey,instanceKey:e.sw+'/'+e.sp+'/'+e.apPort});nodes.set('ap/'+e.idx,dest);
  const visible=deviceBounds(dest),captionY=dest.angle&&!lateral?(top?visible.y-caption.height-6:visible.y+visible.h+10):plannedCaptionY+dest.y-y+(!lateral&&!top?dest.h-apGeometry.h:0);
  captionItems(page,project,db,e,lateral?captionX+dest.x-x:dest.x+dest.w/2,captionY,layout.col,caption);
  const weight=pathWeight(project,e),mappedPort=Object.keys(dest.ports).find(port=>port.toLowerCase()===String(e.apPort).toLowerCase())||edgeKey,end=getAnchor(dest,mappedPort,lateral?(side==='left'?'right':'left'):top?'bottom':'top',i,{weight}),start=getAnchor(sw,e.sp,lateral?'auto':side,e.idx,{weight,peer:{x:end.x,y:end.y}}),edge={...e,a:e.sw,ap:e.sp,b:'ap/'+e.idx,bp:mappedPort};
  if(lateral&&mappedPort===edgeKey&&!dest.angle)Object.assign(end,{edge:end.y,escapeY:end.y,departure:[[end.x+(side==='left'?1:-1)*24,end.y]],rotatedDeparture:true});
  routed.push(edge);
  const gap=start.escapeRange?'gap/'+start.escapeRange.map(v=>v.toFixed(3)).join('/'):'edge/'+start.side;
  addEnd(edge,'a',sw,start,'switch/'+gap);addEnd(edge,'b',dest,end,'ap/'+side+'/'+rowIndex);
 }
 portNumbers(page.items,sw,physicalPorts(device),{selected:new Set(edges.map(e=>e.sp.toLowerCase())),fontScale:wirelessNumberScale(project)});
 applyDrawingEdits(page,project);
 if([...nodes.values()].some(n=>n.angle)){const bodies=[...nodes.values()].map(deviceBounds);if(page.items.some(i=>i.wirelessCaption&&bodies.some(b=>intersects(i,b,2))))throw Object.assign(Error('This rotated wireless equipment needs more space around its captions. Move the devices apart or adjust the rotation.'),{code:'CORE_LAYOUT_CAPACITY'});}
 const numberBoxes=wirelessNumberLeads(page,sw,endData,project),obstacles=[...numberBoxes.obstacles,...page.items.filter(i=>i.type==='text'&&!i.portNumberRole&&(i.wirelessCaption||!i.deviceTextOwner))],planned=coreRoutes(routed,[],endData,banks,nodes,{left:sw.x,right:sw.x+sw.w,minX:36,maxX:layout.W-36,pitch:layout.pitch,railPitch:layout.pitch,topClearance:12,bottomClearance:12,obstacles,uniform:lineSpacing(project,page.name),directionNeutralLevels:true,peerFacingGapLanes:!!layout.placements});
 // Validate every complete lead once, including internal number bands.
 planned.cost[0]+=planned.routes.filter(r=>numberBoxes.numbers.some(box=>crossesText(r.points,box,r.weight/2))).length;
 for(const r of planned.routes){const e=edges.find(e=>e.idx===r.e.idx);route(page,r.a.anchor,r.b.anchor,r.points,r.a.info.color,'AP link '+(e.idx+1),r.a.info.name,{a:e.a,ap:e.ap,b:e.b,bp:e.bp,media:e.media,speed:e.speed,status:e.status});Object.assign(page.items.at(-1),{editKey:pathKey(project,e),linkId:e.idx,weight:pathWeight(project,e)});}
 page.wirelessLayout={...(project._wirelessAdaptive?{adaptiveAP:true,adaptiveFactor:project._wirelessAdaptiveFactor||1,adaptiveFrozen:!!wirelessFrame(project),batchLimit:project._wirelessBatchLimit||null}:{}),...(layout.planKey?{planKey:layout.planKey}:{}),numberScale:wirelessNumberMinimum(project),kind:layout.kind||'banks',rows:layout.rowCount,deviceId:device.id,memberIds:(device.stackMembers||[]).map(m=>String(m.id)),padding:layout.padding,memberGaps:layout.memberGaps,links:edges.map(e=>e.idx),routingCost:planned.cost,routingStats:planned.stats};
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
 // Paper normally frames the complete drawing with one proportional transform.
 // Readable continuation is opt-in: it plans at the physical paper size so
 // dense diagrams retain readable captions rather than shrinking to fit.
 // Frozen frames remain authoritative; a changed plan cannot silently
 // refit an existing physical lock.
 const visible=cleanPageSetup(project.layout?.pageSetup).visible,base=visiblePagePaper(project,{name:'Wireless Connections',family:'wireless'}),numbered=Object.entries(visible.pages).filter(([name])=>/^Wireless Connections(?: \d+)?$/.test(name)).map(([,paper])=>paper);
 // Numbered overrides retain their final paper, but the shared continuation
 // plan must fit the smallest applicable width AND height. This avoids tiny
 // text on one overridden sheet and keeps the plan stable after editing.
 const dimensions=[base,...numbered].map(paperDimensions).filter(Boolean),widthMm=Math.min(...dimensions.map(d=>d.widthMm)),heightMm=Math.min(...dimensions.map(d=>d.heightMm));
 const paper=dimensions.length?{preset:'custom',widthMm,heightMm,orientation:widthMm<heightMm?'portrait':'landscape'}:base;
 const frames=Object.entries(visible.lockFrames).filter(([name])=>/^Wireless Connections(?: \d+)?$/.test(name)).map(([,frame])=>frame),explicit=['layout','readable','adaptive'].includes(project.layout?.pageSetup?.visible?.wirelessFit);
 const legacy=project._wirelessLegacyPaper===true||!explicit&&frames.some(frame=>!frame.wirelessFit||frame.wirelessFit==='readable-legacy')&&!frames.some(frame=>frame.wirelessFit==='layout');
 const render=planned=>wirelessPages(planned,db,{portNumbers,tablePages,empty}).map(page=>{if(page.wirelessLayout)page.wirelessLayout.paperFit=visible.wirelessFit==='adaptive'?'adaptive':visible.wirelessFit==='readable'?(legacy?'readable-legacy':'readable'):'layout';return page;});
 if(visible.wirelessFit==='adaptive'&&paper.preset!=='dynamic'&&visibleFitMode(project)==='optimize'){
  const savedLimits=Object.values({...visible.lockFrames,...visible.editFrames}).map(f=>f.wirelessBatchLimit).filter(Number.isFinite),limit=project._wirelessBatchLimit||Math.min(...savedLimits);
  return render({...project,_wirelessAdaptive:true,...(Number.isFinite(limit)?{_wirelessBatchLimit:limit}:{})});
 }
 if(visible.wirelessFit==='readable'&&paper.preset!=='dynamic'&&visibleFitMode(project)==='optimize'){
  const planned={...project,_wirelessLegacyPaper:legacy,layout:{...project.layout,pageSetup:{...project.layout?.pageSetup,overrides:{...project.layout?.pageSetup?.overrides,wireless:paper}}}};
  try{return render(planned);}
  catch(error){
   if(error.code!=='WIRELESS_LAYOUT_CAPACITY')throw error;
   // A narrow sheet can fit a multi-member box but not its outside cable
   // departures. Retry smaller measured member groups before failing.
   try{return render({...planned,_wirelessMaxMembers:2});}
   catch(retry){if(retry.code!=='WIRELESS_LAYOUT_CAPACITY')throw retry;return render({...planned,_wirelessMaxMembers:1});}
  }
 }
 return render(project);
}
function wirelessPages(project,db,{portNumbers,tablePages,empty}){
 let geometry=pageGeometry(project,'wireless'),width=geometry.width-202;
 const apIds=new Set([...db.devices.keys()].filter(id=>db.devices.get(id).kind==='ap')),linked=new Set(),groups=new Map();
 for(const e of db.links){const left=apIds.has(e.a),right=apIds.has(e.b);if(left===right)continue;const sw=left?e.b:e.a,edge={...e,sw,sp:left?e.bp:e.ap,apId:left?e.a:e.b,apPort:left?e.ap:e.bp};if(!groups.has(sw))groups.set(sw,[]);groups.get(sw).push(edge);linked.add(edge.apId);}
 const devices=[...groups.keys()].map(id=>db.devices.get(id));
 if(!geometry.dynamic)width=Math.min(width,...devices.filter(d=>!canContinueEquipment(project,d)).map(d=>width*Math.max(90,geometry.height-500)/(equipmentSize(project,d,width).h/deviceScale(project,d))));
 for(let attempt=0;attempt<(organizing(project)?1:4);attempt++){
  let required=width;
  for(const device of devices){const probe=addDevice({items:[]},project,device,[0,0,width,1],'inspect',{fitWidth:true,padding:equipmentPadding});try{portNumbers([],probe,physicalPorts(device),{fontScale:wirelessNumberScale(project)});}catch(error){if(error.code!=='PORT_LABEL_CAPACITY'||!Number.isFinite(error.requiredWidth))throw error;required=Math.max(required,error.requiredWidth/deviceScale(project,device)+2);}}
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
   const memberLimit=project._wirelessMaxMembers,limitedHeight=memberLimit>1&&source.stackMembers?.length?equipmentSize(project,{...source,stackMembers:source.stackMembers.slice(0,memberLimit),stackContinuation:true},width).h+.01:1;
   const variants=memberLimit?[equipmentViews(project,source,width,limitedHeight)]:[[source],...[480,600,700].map(reserve=>equipmentViews(project,source,width,Math.max(80,geometry.height-reserve))),equipmentViews(project,source,width,Math.max(80,width/7))],seen=new Set(),plans=[];
   for(const variant of variants){const signature=variant.map(equipmentScope).join(';');if(seen.has(signature))continue;seen.add(signature);const owned=assignedEdges(project,variant,sorted,width),batches=variant.map((part,i)=>pageBatches(project,db,part,owned[i],width,geometry));if(batches.some(value=>!value))continue;plans.push({parts:variant,assigned:owned,prepared:batches,count:batches.reduce((n,b)=>n+b.length,0)});}
   const fit=plans.sort((a,b)=>a.count-b.count||a.parts.length-b.parts.length)[0];if(!fit)throw capacityError('This wireless caption needs more space. Choose a larger or dynamic page.');({parts,assigned,prepared}=fit);
  }
  for(const [partIndex,device] of parts.entries()){
   const edges=assigned[partIndex];if(!edges.length)continue;const batches=prepared?.[partIndex]||pageBatches(project,db,device,edges,width,geometry);if(!batches)throw capacityError('This wireless caption needs more space. Choose a larger or dynamic page.');
   if(project._wirelessAdaptive&&project._wirelessBatchLimit)for(let i=0;i<batches.length;i++){const batch=batches[i];if(batch.length>project._wirelessBatchLimit){batches.splice(i,1,batch.slice(0,project._wirelessBatchLimit),batch.slice(project._wirelessBatchLimit));}}
   for(let batchIndex=0;batchIndex<batches.length;batchIndex++){const batch=batches[batchIndex],candidate=organizing(project,pageScope(project,device,batchIndex));
    const numberedName=(project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections '+(out.length+1),pageProject={...project,_wirelessFrameName:numberedName,...(project.layout?.presentation?.pages?.[numberedName]?{_wirelessPresentationName:numberedName}:{})};
    if(pageProject._wirelessAdaptive){
     const frame=wirelessFrame(pageProject),authored=Object.entries(project.layout?.drawingEdits||{}).some(([key,edit])=>key.includes('Wireless Connections')&&['x','y','w','h','angle','points'].some(k=>edit[k]!=null));
     if((frame&&!frame.wirelessApFactor)||authored&&!frame?.wirelessApFactor)pageProject._wirelessAdaptive=false;
     else pageProject._wirelessAdaptiveFactor=frame?.wirelessApFactor||(batch.length>=16?4:2);
    }
    const spacing=stackSpacing(pageProject,device,batch,width),choices=bankLayout(pageProject,db,device,batch,width,spacing,geometry);if(!choices.length)throw capacityError('This wireless caption needs more space. Choose a larger or dynamic page.');
    let selected,error,attempts=0,candidates=0,clearChecks=0;
    const alternatives=[...new Set([...(pageProject._wirelessAdaptive?choices.filter(c=>c.kind===(batch.length>=16?'columns':'sides')):[]),...new Map(choices.map(choice=>[choice.rowCount,choice])).keys()].map(c=>typeof c==='object'?c:choices.find(choice=>choice.rowCount===c)))];alternatives.push(...choices.filter(choice=>!alternatives.includes(choice)).slice(0,3));
    // A zero-collision result is necessary, not sufficient: compare several
    // valid arrangements for crossings, bends and footprint instead of always
    // keeping the first layout. Bound this search on large wireless sites.
    // Penalize crossings strongly, but do not veto a substantially shorter
    // clear side plan solely because it has one more legitimate crossing.
    const aesthetic=page=>{const c=page.wirelessLayout.routingCost;return c[2]+c[3]*(wirelessSettings(pageProject).wirelessApPlacement==='sides'?200:55)+c[4]*8+page.width*page.height*.00035;};
    for(const choice of alternatives.slice(0,candidate?1:Math.min(pageProject._wirelessAdaptive?7:4,alternatives.length))){
     attempts++;
     try{
      const page=renderBankPage(pageProject,db,device,batch,choice,batchIndex,portNumbers),cost=page.wirelessLayout.routingCost;
      candidates+=page.wirelessLayout.routingStats.candidates;
      if(!selected||cost[0]+cost[1]<selected.wirelessLayout.routingCost[0]+selected.wirelessLayout.routingCost[1]||cost[0]+cost[1]===selected.wirelessLayout.routingCost[0]+selected.wirelessLayout.routingCost[1]&&aesthetic(page)<aesthetic(selected))selected=page;
      if(!cost[0]&&!cost[1]&&++clearChecks>=3&&cost[3]===0)break;
     }catch(e){if(e.code!=='CORE_LAYOUT_CAPACITY')throw e;error=e;}
    }
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
