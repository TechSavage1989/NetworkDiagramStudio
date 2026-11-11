import {deviceBounds} from './device-geometry.mjs';
import {deviceScale,presentation} from '../presentation.mjs';
import {pageGeometry,targetPageAspect,visibleFitMode,visiblePagePaper,cleanPageSetup,paperDimensions,pageMarginPx} from '../page-options.mjs';
import {applyDrawingEdits} from '../drawing-edits.mjs';
import {hasAuthoredWirelessGeometry} from '../wireless-paper-defaults.mjs';
import {applyLinkStyles,linkWeight} from '../link-styles.mjs';
import {deviceModel,macCaption} from '../device-details.mjs';
import {wrapPortText} from '../port-table.mjs';
import {equipmentPadding,equipmentSize,equipmentViews,equipmentScope,equipmentGapPlan,canContinueEquipment,memberSubsetView,portStackMember} from './equipment-layout.mjs';
import {paperFurniture} from '../page-content-fit.mjs';
import {paperLinkKey} from '../paper-panel.mjs';
import {coreRoutes,ROUTE_STYLE} from './routing.mjs';
import {lineSpacing,hopStyle} from '../layout.mjs';
import {wirelessNumberLeads} from './wireless-number-leads.mjs';
import {crossesText,intersects,textWidth,pathCrossesText} from './labels.mjs';
import {C,addDevice,bridge,cableWeight,fresh,getAnchor,label,linkLegend,mediaInfo,physicalPorts,rate,route} from './scene.mjs';

const cmp=(a,b)=>String(a).localeCompare(String(b),'en',{numeric:true,sensitivity:'base'});
const nameOf=d=>String(d?.name||d?.id||'Unnamed');
const wirelessSettings=project=>presentation(project,project._wirelessPresentationName||((project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections'));
// AP card factors a whole-switch paper sheet may use to fill its paper.
const AP_FACTORS=[1,1.15,1.3,1.5,1.75,2];
const apScale=project=>(wirelessSettings(project).wirelessApScale||1)*(project._wirelessAdaptiveFactor||1);
function wirelessNumberMinimum(project){
 const config=wirelessSettings(project),visible=project.layout?.pageSetup?.visible||{},name=project._wirelessPresentationName||((project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections'),paper=visiblePagePaper(project,{name,family:'wireless'}),frames={...visible.lockFrames,...visible.editFrames};
 const frozen=Object.entries(frames).filter(([key])=>key.includes('Wireless Connections'));
 if(frozen.length){const exact=frames[project._wirelessFrameName]||frames[name];return exact?.wirelessNumberScale||Math.max(1,...frozen.map(([,frame])=>frame.wirelessNumberScale||1));}
 if(Object.entries(project.layout?.drawingEdits||{}).some(([key,value])=>key.includes('Wireless Connections')&&['x','y','w','h','size','angle','points'].some(k=>value[k]!=null)))return 1;
 // Plan readable number geometry before cables. Do not enlarge a complete
 // switch merely because the old 10px number default is 7.5pt instead of 8pt.
 // Paper plans size switch port numbers for at most 8pt: they are faceplate
 // labels, and a larger AP-text preference must not make the stack unroutable.
 if(project._wirelessPaperPlan&&(project._wirelessPaperPlan.dynamic||visibleFitMode(project)==='optimize'))return Math.max(1,Math.min(8,config.minimumTextPt||0)/7.5);
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
// Generated paper captions break between words ("MAC" / address) rather
// than inside an address when a whole word fits the card. Saved text is kept.
function wordBreaks(text,width,size,bold){
 const value=String(text??''),lines=wrapPortText(value,width,size,bold);if(lines.length<2||lines.join(' ')===value.replace(/\s+/g,' ').trim())return value;
 const words=value.split(/\s+/).filter(Boolean);if(words.some(word=>textWidth(word,size,bold)>width))return value;
 const out=[];for(const word of words){const line=out.length?out.at(-1)+' '+word:word;if(out.length&&textWidth(line,size,bold)<=width)out[out.length-1]=line;else out.push(word);}return out.join('\n');
}
function measured(project,e,role,value,width,defaults={}){
 const key=defaults.key||identityKey(project,e,role),patch=project.layout?.drawingEdits?.[key]||{},size=patch.size||defaults.size||12,w=patch.w||width,bold=patch.bold??defaults.bold??false,paper=!!project._wirelessPaperPlan,text=patch.value??(paper&&value?wordBreaks(value,w+6,size,bold):value);
 // Paper plans measure lines exactly as the renderer wraps them (box + 6).
 const lines=patch.hidden||!text?0:wrapPortText(text,w+(paper?6:0),size,bold).length;
 return {key,value:text,size,w,bold,lines,height:patch.hidden||!text?0:Math.max(patch.h||(project._wirelessAdaptive?size*1.25:defaults.height)||18,lines*size*1.25)};
}
// Captions depend only on the project (with its AP factor), the link and the
// column width, not on the stack width or arrangement: measure each once.
const captionMemo=new WeakMap();
function captions(project,db,e,width){
 let memo=captionMemo.get(project);if(!memo)captionMemo.set(project,memo=new Map());const key=e.idx+'/'+width;if(!memo.has(key))memo.set(key,measureCaptions(project,db,e,width));return memo.get(key);
}
function measureCaptions(project,db,e,width){
 const scale=apScale(project),ap=db.devices.get(e.apId),register=[e.sp||'Port unknown',rate(e.speed)].filter(Boolean).join(' · '),detail=[ap.ip,e.apPort||'AP port unspecified'].filter(Boolean).join(' · ');
 const title=measured(project,e,'title',nameOf(ap),width,{key:captionTitleKey(project,db,e),size:18*scale,bold:true,height:26*scale}),registerText=measured(project,e,'register',register,width,{size:13*scale,bold:true,height:21*scale}),detailText=measured(project,e,'detail',detail,width,{size:12*scale,height:18*scale}),model=measured(project,e,'model',deviceModel(ap),width,{size:12*scale,height:18*scale}),mac=measured(project,e,'mac',macCaption(ap,e.apPort,{counts:false}),width,{size:12*scale,height:18*scale}),notes=captionFor(project,e)?wrapPortText(captionFor(project,e),width,12*scale):[];
 return {scale,title,brokenTitle:title.lines>1?1:0,register:registerText,detail:detailText,model,mac,notes,wraps:[title,registerText,detailText,model,mac].reduce((n,part)=>n+Math.max(0,part.lines-1)*(part===title?3:1),0),width:Math.max(width,title.w,registerText.w,detailText.w,model.w,mac.w),height:title.height+2+model.height+registerText.height+1+detailText.height+mac.height+2+notes.length*14*scale};
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

// The printable diagram body of one wireless sheet, in physical paper pixels:
// the planning paper less its margin, generated heading and connection key,
// measured with the same furniture and key placement as the final paper fit.
const bodyCache=new WeakMap();
function paperBody(project,device,edges){
 const plan=project._wirelessPaperPlan,dims=paperDimensions(plan.paper);if(!dims)return null;
 const types=[...new Set(edges.map(e=>mediaInfo(e.media,true).name))].sort().join('|'),key=nameOf(device)+'\n'+types;
 if(!bodyCache.has(plan))bodyCache.set(plan,new Map());const cache=bodyCache.get(plan);if(cache.has(key))return cache.get(key);
 const W=dims.widthMm*96/25.4,H=dims.heightMm*96/25.4,local={...project,_pageGeometry:{...project._pageGeometry,wireless:{width:W,height:H}}},probe=fresh('Wireless Connections','Wireless Connections',nameOf(device)+'  ·  access-point uplinks and physical switch ports',local);
 probe.items.push(...edges.map(e=>({type:'path',editKey:pathKey(project,e),color:mediaInfo(e.media,true).color,weight:pathWeight(project,e),linkType:mediaInfo(e.media,true).name,sourceLink:e,points:[[0,0],[1,0]]})));
 applyLinkStyles(probe,project.layout?.linkStyles,project.layout?.drawingEdits);linkLegend(probe);
 const furniture=paperFurniture(probe,project,W,H,1,pageMarginPx(project)??(plan.paper.locked?24:12)),keyed=paperLinkKey(probe,project,furniture.body,1),body=keyed?.body||furniture.body;
 cache.set(key,body);return body;
}
// AP banks are measured from their real captions and real socket positions.
// Candidate bank splits balance page area against travel distance, without a
// device-height or name-length rule that creates one page for each AP.
function bankLayout(project,db,device,edges,width,spacing,geometry){
 const panel=addDevice({items:[]},project,device,[0,0,width,1],'measure',{fitWidth:true,...spacing}),apSize=72*width/998*apScale(project);
 const ends=edges.map(e=>({e,anchor:getAnchor(panel,e.sp,panel.moduleChannel?'auto':'top',e.idx,{weight:pathWeight(project,e)}),apGeometry:addDevice({items:[]},project,db.devices.get(e.apId),[0,0,apSize,apSize],'measure-ap')}));
 const byHeight=ends.slice().sort((a,b)=>a.anchor.y-b.anchor.y||a.anchor.x-b.anchor.x||a.e.idx-b.e.idx),natural=new Set(ends.filter(v=>v.anchor.y<panel.h/2).map(v=>v.e.idx)),balanced=new Set(byHeight.slice(0,Math.ceil(ends.length/2)).map(v=>v.e.idx)),splits=[natural];
 if([...balanced].some(id=>!natural.has(id))||balanced.size!==natural.size)splits.push(balanced);
 const paperPlan=project._wirelessPaperPlan,cellGap=paperPlan?10:16,compactPaper=!!paperPlan||!geometry.dynamic&&!project._wirelessLegacyPaper&&visibleFitMode(project)==='optimize',body=paperPlan?paperBody(project,device,edges):null;
 const targetAspect=cleanPageSetup(project.layout?.pageSetup).visible.wirelessFit==='readable'?targetPageAspect(project,{name:'Wireless Connections',family:'wireless'}):null,choices=[],captionCache=new Map(),legendCache=new Map(),maxWeight=Math.max(cableWeight,...ends.map(v=>v.anchor.weight)),pitch=Math.max(7,maxWeight+3),margin=Math.max(46,22+Math.ceil(edges.length/2)*pitch);
 // Paper can use narrower, fully measured captions and additional banks.
 // Try that space before splitting; never shrink the source caption fonts.
 for(const topIds of splits)for(const rowCount of paperPlan?(edges.length>4?[1,2,3]:[1]):(geometry.dynamic||compactPaper)&&edges.length>12?[1,2,3]:[1])for(const col of (compactPaper?[104,116,132,180,245,360,680]:[132,180,245,360,680]).map(w=>w*apScale(project)).filter(w=>geometry.dynamic||w<=geometry.width-100)){
  const banks={top:[],bottom:[]};for(const v of ends){const key=v.e.idx+'/'+col;if(!captionCache.has(key))captionCache.set(key,captions(project,db,v.e,col));banks[topIds.has(v.e.idx)?'top':'bottom'].push({...v,caption:captionCache.get(key)});}
  for(const bank of Object.values(banks))bank.sort((a,b)=>a.anchor.x-b.anchor.x||a.anchor.y-b.anchor.y||a.e.idx-b.e.idx);
  // One pitch per lead provides distinct painted lanes on paper. The route
  // validator still rejects collisions and falls back to smaller batches.
  // Keep the established roomier dynamic layout (and its saved coordinates).
  const rows=Object.fromEntries(Object.entries(banks).map(([side,bank])=>{
   // Paper rows deal APs out alternately in port order and stagger each
   // outer card over the gap between two inner cards, spaced so its cable
   // drops straight through clear of captions and AP bodies. Left-to-right
   // order is kept, so outer cables do not cross the inner row's cables.
   if(paperPlan&&rowCount>1&&bank.length>rowCount){
    const cell=Math.max(...bank.map(v=>Math.max(v.apGeometry.w,v.caption.width))),apHalf=Math.max(...bank.map(v=>v.apGeometry.w))/2;
    const clear=Math.max(cell/2+8+pitch/2,apHalf+ROUTE_STYLE.clearance+pitch/2),step=Math.max(cell+cellGap,rowCount*clear),columns=Math.ceil(bank.length/rowCount),width=cell+(columns-1)*step+(rowCount-1)*step/rowCount;
    const rings=Array.from({length:rowCount},(_,ring)=>{const members=bank.map((v,i)=>({v,i})).filter(({i})=>i%rowCount===ring),items=members.map(({v})=>v);return {items,centers:members.map(({i})=>cell/2+Math.floor(i/rowCount)*step+ring*step/rowCount),width,height:Math.max(...items.map(v=>v.caption.height)),apHeight:Math.max(...items.map(v=>v.apGeometry.h)),lanes:ring?28+pitch*2:28+pitch*bank.length,staggered:true};}).filter(row=>row.items.length);
    // Ring 0 sits nearest the switch: last of the top rows, first below.
    return [side,side==='top'?rings.reverse():rings];
   }
   const capacity=Math.max(1,Math.ceil(bank.length/rowCount)),rows=[];for(let i=0;i<bank.length;i+=capacity){const items=bank.slice(i,i+capacity);rows.push({items,width:items.reduce((n,v)=>n+Math.max(v.apGeometry.w,v.caption.width)+cellGap,0),height:Math.max(...items.map(v=>v.caption.height)),apHeight:Math.max(...items.map(v=>v.apGeometry.h)),lanes:28+(compactPaper?1:2)*pitch*items.length});}return [side,rows];}));
  const metrics=Object.fromEntries(Object.entries(rows).map(([side,rows])=>[side,{width:Math.max(0,...rows.map(row=>row.width)),height:rows.reduce((n,row)=>n+row.height+row.apHeight+row.lanes+(side==='top'?6:10),0)}]));
  const W=geometry.dynamic?Math.max(geometry.width,panel.w+margin*2,metrics.top.width+92,metrics.bottom.width+92):geometry.width;
  if(panel.w+margin*2>W+.01||Math.max(metrics.top.width,metrics.bottom.width)>W-92)continue;
  if(!legendCache.has(W)){const preview={width:W,height:geometry.height,items:edges.map(e=>({type:'path',editKey:pathKey(project,e),color:mediaInfo(e.media,true).color,weight:pathWeight(project,e),linkType:mediaInfo(e.media,true).name,sourceLink:e}))};applyLinkStyles(preview,project.layout?.linkStyles,project.layout?.drawingEdits);linkLegend(preview);legendCache.set(W,Math.max(204,(preview.legendBottom||189)+14));}
  const start=legendCache.get(W),switchY=start+metrics.top.height,H=switchY+panel.h+metrics.bottom.height+64;
  if(!geometry.dynamic&&H>geometry.height)continue;
  const travel=ends.reduce((sum,v)=>sum+(topIds.has(v.e.idx)?v.anchor.y:panel.h-v.anchor.y),0);
  const score=(Math.max(W,H)**2+.15*W*H+travel*60)*(targetAspect?1+.75*Math.abs(Math.log((W/H)/targetAspect)):1);
  // On paper, rank by the printed scale this content will receive in the
  // sheet's real diagram body; captions are planned at their source size.
  const fit=body?Math.min(4,body.w/Math.max(panel.w+48,metrics.top.width,metrics.bottom.width),body.h/(metrics.top.height+panel.h+metrics.bottom.height)):null;
  choices.push({W,H,start,switchY,width,...spacing,apSize,pitch,banks,rows,metrics,col,score,panel,rowCount,cellGap,...(body?{fit,wraps:Object.values(banks).flat().reduce((n,v)=>n+v.caption.wraps,0),brokenTitles:Object.values(banks).flat().reduce((n,v)=>n+v.caption.brokenTitle,0),planKey:'paper-rows:'+rowCount+':'+Math.round(col/apScale(project))+':'+(topIds===natural?'n':'b'),kind:'rows'}:{})});
 }
 choices.push(...sideLayoutChoices(project,db,device,edges,width,spacing,geometry,panel,ends,apSize,pitch).map(choice=>body?{...choice,fit:Math.min(4,body.w/Math.max(1,choice.W-72),body.h/Math.max(1,choice.H-choice.start-36)),planKey:'paper-'+choice.planKey}:choice));
 // Each arrangement knows which way every lead turns, so a stack gap only
 // needs the levels its leads cannot share; a shorter stack prints larger.
 const shared=new Map();for(let i=0;i<choices.length;i++)choices[i]=shareChoiceGaps(project,device,edges,width,choices[i],ends,body,shared);
 const retained=wirelessFrame(project)?.wirelessPlan;
 // An explicit "Use side space" choice puts APs beside the stack on paper
 // plans, but they may also use the rows above and below (surround layouts).
 const sideOnly=body&&wirelessSettings(project).wirelessApPlacement==='sides'&&choices.some(choice=>choice.placements)?choices.filter(choice=>choice.placements):choices;
 return (retained?sideOnly.filter(choice=>choice.planKey===retained):sideOnly).sort((a,b)=>body?b.fit-a.fit||a.score-b.score:a.score-b.score||a.col-b.col);
}

// The direction each lead turns, decided as the router decides it: toward the
// side where its socket and AP anchor lie together, from the planned AP
// positions (rows are laid out as renderBankPage lays them out).
function choiceSides(choice,ends,project){
 const switchX=choice.switchX??(choice.W-choice.panel.w)/2,aps=new Map();
 // A saved AP position (a deliberate move) decides its lead's direction.
 const edits=Object.entries(project?.layout?.drawingEdits||{}).filter(([key,edit])=>/Wireless Connections/.test(key)&&Number.isFinite(edit?.x)),moved=v=>edits.find(([key])=>key.endsWith('|device|'+v.e.apId+'|'+v.e.sw+'/'+v.e.sp+'/'+v.e.apPort))?.[1].x;
 if(choice.placements)for(const p of choice.placements){const w=p.apGeometry.w,lateral=p.side==='left'||p.side==='right';aps.set(p.e.idx,{x:p.x,w,anchor:lateral?(p.side==='left'?p.x+w:p.x):p.x+w/2});}
 else for(const side of ['top','bottom'])for(const row of choice.rows?.[side]||[]){let cursor=(choice.W-row.width)/2;const left=cursor;for(const [j,v] of row.items.entries()){const cell=Math.max(v.apGeometry.w,v.caption.width)+(choice.cellGap??16),center=row.centers?left+row.centers[j]:cursor+cell/2;cursor+=cell;aps.set(v.e.idx,{x:center-v.apGeometry.w/2,w:v.apGeometry.w,anchor:center});}}
 const sides=new Map();
 for(const v of ends){const planned=aps.get(v.e.idx);if(!planned)continue;const x=moved(v),ap=Number.isFinite(x)?{...planned,x,anchor:planned.anchor+x-planned.x}:planned,west=Math.min(switchX,ap.x),east=Math.max(switchX+choice.panel.w,ap.x+ap.w);sides.set(v.e.idx,switchX+v.anchor.x+ap.anchor>west+east?'right':'left');}
 return sides;
}
// Re-measure a choice's stack with the gaps its own lead directions need and
// move the content below it up (side columns stay centered on the stack).
function shareChoiceGaps(project,device,edges,width,choice,ends,body,cache){
 if(!device.stackMembers?.length||!Object.keys(choice.memberGaps||{}).length)return choice;
 const sides=choiceSides(choice,ends,project),signature=edges.map(e=>sides.get(e.idx)||'-').join('');
 if(!cache.has(signature)){
  const spacing=equipmentGapPlan(project,device,edges,width,{weight:e=>pathWeight(project,e),side:e=>sides.get(e.idx)}),panel=addDevice({items:[]},project,device,[0,0,width,1],'measure',{fitWidth:true,...spacing});
  cache.set(signature,{spacing,panel});
 }
 const {spacing,panel}=cache.get(signature),shift=panel.h-choice.panel.h;
 if(shift>-.01)return choice;
 const next={...choice,...spacing,panel};
 if(choice.placements){
  const middle=Math.max(panel.h,choice.sideHeight||0),move=middle-choice.middleHeight;
  next.middleHeight=middle;next.switchY=choice.start+choice.topHeight+(middle-panel.h)/2;next.H=choice.H+move;
  next.placements=choice.placements.map(p=>{const dy=p.side==='bottom'?move:p.side==='top'?0:move/2;return dy?{...p,y:p.y+dy,captionY:p.captionY+dy}:p;});
  if(body)next.fit=Math.min(4,body.w/Math.max(1,next.W-72),body.h/Math.max(1,next.H-next.start-36));
 }else{
  next.H=choice.H+shift;
  if(body)next.fit=Math.min(4,body.w/Math.max(panel.w+48,choice.metrics.top.width,choice.metrics.bottom.width),body.h/(choice.metrics.top.height+panel.h+choice.metrics.bottom.height));
 }
 return next;
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
 if(project._wirelessPaperPlan){if(edges.length<4||frozen&&!retained)return [];}
 else if((wirelessSettings(project).wirelessApPlacement!=='sides'&&!project._wirelessAdaptive&&!retained)||!geometry.dynamic||project._wirelessLegacyPaper||edges.length<8||(frozen&&!retained)||(!retained&&Object.entries(edits).some(([key,value])=>key.includes('Wireless Connections')&&['x','y','w','h','angle','points'].some(k=>value[k]!=null))))return [];
 const result=[],ordered=ends.slice().sort((a,b)=>a.anchor.x-b.anchor.x||a.anchor.y-b.anchor.y||a.e.idx-b.e.idx),left=new Set(ordered.slice(0,Math.ceil(ends.length/2)).map(v=>v.e.idx));
 for(const col of (project._wirelessAdaptive?[116,120,132,180,245]:[132,180,245]).map(w=>w*apScale(project)))for(const fraction of project._wirelessPaperPlan?[1,.75,.5,.25]:[1,.5])for(const columns of project._wirelessAdaptive&&fraction===1&&edges.length>=16?[1,2]:[1]){
  const sides={left:[],right:[]};
  const horizontal={top:[],bottom:[]};
  const sideCount=Math.round(ends.length*fraction/2),sideIds=fraction===1?new Set(ends.map(v=>v.e.idx)):new Set([...ordered.slice(0,Math.ceil(ends.length*fraction/2)),...ordered.slice(ends.length-sideCount)].map(v=>v.e.idx));
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
  result.push({topHeight,middleHeight,sideHeight:Math.max(sideHeight(sideColumns.left),sideHeight(sideColumns.right)),wraps:placements.reduce((n,v)=>n+v.caption.wraps,0),brokenTitles:placements.reduce((n,v)=>n+v.caption.brokenTitle,0),planKey:(columns===2?'columns':fraction===1?'sides':'surround')+':'+Math.round(col/apScale(project))+(fraction===1||fraction===.5?'':':'+Math.round(fraction*100)),kind:columns===2?'columns':fraction===1?'sides':'surround',W,H,start,switchX,switchY,width,...spacing,apSize,pitch,panel,col,score,rowCount:columns===2?'columns':fraction===1?'sides':'surround',placements});
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
   let cursor=(layout.W-row.width)/2;const left=cursor;
   for(const [j,v] of row.items.entries()){const {caption,apGeometry}=v,y=top?rowY+row.height+6+row.apHeight-apGeometry.h:rowY+row.lanes,textY=top?rowY:y+apGeometry.h+10,cell=Math.max(apGeometry.w,caption.width)+(layout.cellGap??16),center=row.centers?left+row.centers[j]:cursor+cell/2;cursor+=cell;
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
 portNumbers(page.items,sw,physicalPorts(device),{selected:new Set(edges.map(e=>e.sp.toLowerCase())),fontScale:wirelessNumberScale(project),upright:!!project._wirelessPaperPlan});
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

// Automatic wireless paper: plan every sheet at the size it will print.
// Show only the stack members that carry these AP links, keep port numbers
// readable at the narrowest stack width, then use the fewest balanced sheets
// whose best arrangement (rows, side columns or both around the switch)
// prints AP details at the target size. Never split a sheet unless that is
// what reaches the target or makes the text larger.
function readableWidth(project,device,portNumbers,fallback){
 for(const width of [560,600,640,680,720,760,820,900,998]){const probe=addDevice({items:[]},project,device,[0,0,width,1],'inspect',{fitWidth:true,padding:equipmentPadding});try{portNumbers([],probe,physicalPorts(device),{fontScale:wirelessNumberScale(project),upright:true});return width;}catch(error){if(error.code!=='PORT_LABEL_CAPACITY')throw error;}}
 return fallback;
}
// Equal sheets in port order; a cut moves to a nearby stack-member boundary
// (within a fifth of a sheet) so a member's APs stay together where possible.
function balancedBatches(edges,count){
 const size=edges.length/count,tolerance=Math.floor(size/5),member=i=>portStackMember(edges[i]?.sp),cuts=[0];
 // Never separate one AP's uplinks; prefer a stack-member boundary nearby.
 const apBoundary=j=>edges[j-1]?.apId!==edges[j]?.apId,memberBoundary=j=>apBoundary(j)&&member(j-1)!==member(j);
 for(let i=1;i<count;i++){
  const ideal=Math.round(i*size),near=test=>{for(let d=0;d<=Math.max(tolerance,1);d++){const options=[ideal-d,ideal+d].filter(j=>j>cuts.at(-1)&&j<edges.length&&test(j));if(options.length)return options[0];}return null;};
  const cut=(tolerance?near(memberBoundary):null)??near(apBoundary)??ideal;
  if(cut>cuts.at(-1)&&cut<edges.length)cuts.push(cut);
 }
 cuts.push(edges.length);return cuts.slice(1).map((end,i)=>edges.slice(cuts[i],end)).filter(batch=>batch.length);
}
// Chosen whole-switch plans (view, plan key, width) keyed by every input that
// shapes the choice; the page itself is always re-rendered from current data.
const wholePlans=new Map();
function wholePlanKey(project,db,source,sorted,first){
 const layout=project.layout||{},wireless=([key])=>/Wireless Connections/.test(key),visible=layout.pageSetup?.visible||{};
 return JSON.stringify([first,project._reportPrefix||'',project._wirelessPaperPlan,source,sorted.map(e=>[e.idx,e.sp,e.apId,e.apPort,e.media,e.speed,e.status,db.devices.get(e.apId)]),layout.presentation,layout.linkStyles,layout.hopStyle,layout.lineSpacing,layout.labelBacking,layout.cableCaptions,Object.entries(layout.drawingEdits||{}).filter(entry=>wireless(entry)&&!foreignWirelessEdit(entry[0],source.id,db)),Object.entries({...visible.lockFrames,...visible.editFrames}).filter(wireless),visible.wirelessFit,visible.fitMode,visible.wirelessStack,visible.marginMm]);
}
// Position edits on wireless pages (moved APs, captions, bends): a dynamic
// sheet chooses its arrangement without them, then draws it with them.
const positional=['x','y','w','h','angle','points'];
function withoutWirelessPositions(project){
 const edits=project.layout?.drawingEdits||{},kept=Object.fromEntries(Object.entries(edits).map(([key,edit])=>/Wireless Connections/.test(key)?[key,Object.fromEntries(Object.entries(edit||{}).filter(([k])=>!positional.includes(k)))]:[key,edit]).filter(([,edit])=>Object.keys(edit||{}).length));
 return {...project,layout:{...project.layout,drawingEdits:kept}};
}
function paperPlanPages(project,db,source,sorted,{portNumbers,first,fallbackWidth}){

 // Compare the complete stack (tall: room for AP columns beside it) with only
 // the members that carry these links (flat: room for long AP rows). Keep
 // whichever needs fewer sheets, then prints larger, then crosses less.
 // Each sheet shows the members its own AP links use (balanced batches follow
 // port order, so a sheet usually covers one or two neighbouring members).
 const known=new Set((source.stackMembers||[]).map(m=>String(m.id))),views=new Map();
 const subsetFor=batch=>{const members=new Set(batch.map(e=>portStackMember(e.sp)).filter(Boolean));if(!members.size||![...members].every(id=>known.has(id)))return source;const key=[...members].sort().join(',');if(!views.has(key))views.set(key,memberSubsetView(project,source,members));return views.get(key);};
 const reduced=sorted.some(e=>subsetFor([e])!==source),crossings=plan=>plan.pages.reduce((n,page)=>n+page.wirelessLayout.routingCost[3],0);
 // Every AP of one switch stays on that switch's sheet: plan the members its
 // APs use and the complete stack as one sheet each and keep the larger print
 // (fewer crossings, then the complete stack, on near ties). Continuation is
 // only for a saved preview.51 split plan with authored edits, or a switch
 // whose cables cannot route on one sheet at all.
 if(!project._wirelessPaperSplit){
  // A saved frame (lock or manual edit) reopens exactly its plan: the same
  // stack view, arrangement and width, so authored edits keep their identity.
  // A site with one wireless sheet names it without a number.
  const prefix=project._reportPrefix?project._reportPrefix+'|':'',frameName=prefix+'Wireless Connections '+(first+1),single=prefix+'Wireless Connections',visible=project.layout?.pageSetup?.visible||{},saved=visible.lockFrames?.[frameName]||visible.editFrames?.[frameName]||(first===0?visible.lockFrames?.[single]||visible.editFrames?.[single]:null);
  if(saved?.wirelessPaperPlan===2&&saved.wirelessPlan&&Number.isFinite(saved.wirelessPlanWidth)){
   const view=saved.wirelessSubset===1&&reduced?subsetFor(sorted):source,plan=planPaperView(project,db,()=>view,sorted,{portNumbers,first,fallbackWidth,whole:true,only:{planKey:saved.wirelessPlan,width:saved.wirelessPlanWidth,factor:saved.wirelessApFactor||1}});
   if(plan){for(const page of plan.pages)page.wirelessLayout.wholeSwitch=true;return plan.pages;}
  }
  if(project._wirelessPaperPlan.dynamic&&hasAuthoredWirelessGeometry(project.layout)){
   const chosen=paperPlanPages(withoutWirelessPositions(project),db,source,sorted,{portNumbers,first,fallbackWidth})[0]?.wirelessLayout;
   if(chosen?.planKey){const plan=planPaperView(project,db,()=>source,sorted,{portNumbers,first,fallbackWidth,whole:true,only:{planKey:chosen.planKey,width:chosen.planWidth,factor:chosen.apFactor||1}});if(plan){for(const page of plan.pages)page.wirelessLayout.wholeSwitch=true;return plan.pages;}}
  }
  // A rebuild with the same inputs renders the remembered choice once
  // (validated like any candidate) instead of searching again.
  const key=wholePlanKey(project,db,source,sorted,first),remembered=wholePlans.get(key);
  if(remembered){
   const view=remembered.complete?source:subsetFor(sorted),plan=planPaperView(project,db,()=>view,sorted,{portNumbers,first,fallbackWidth,whole:true,only:remembered});
   if(plan&&!plan.compromise){for(const page of plan.pages)page.wirelessLayout.wholeSwitch=true;return plan.pages;}
  }
  // Paper & print → Wireless stack view: the whole stack (default) or only the
  // members whose ports carry these APs (larger print).
  const membersOnly=cleanPageSetup(project.layout?.pageSetup).visible.wirelessStack==='members';
  // A dynamic page grows to fit, so it always shows the whole stack.
  const views=project._wirelessPaperPlan.dynamic?[source]:[...new Set([reduced?subsetFor(sorted):null,...(membersOnly&&reduced?[]:[source])].filter(Boolean))],whole=[];
  for(const view of views){
   // The same member hardware cannot route narrower than the view already
   // planned, so the complete stack starts its width search there.
   const minWidth=whole.length?whole[0].pages[0].wirelessLayout.planWidth||0:0;
   const plan=planPaperView(project,db,()=>view,sorted,{portNumbers,first,fallbackWidth,whole:true,minWidth});if(plan)whole.push(plan);
  }
  if(whole.length){
   // Show the whole stack unless it prints more than 30% smaller than the
   // members-only view or cannot route cleanly; otherwise the larger print wins.
   // The views are compared by the switch's own printed scale, so larger AP
   // cards on the shorter view do not hide the rest of the stack.
   const best=Math.max(...whole.filter(plan=>!plan.compromise).map(plan=>plan.stackFit??plan.fit),0),wholeStack=plan=>plan.complete&&!plan.compromise&&(plan.stackFit??plan.fit)>=.7*best;
   whole.sort((a,b)=>(a.compromise?1:0)-(b.compromise?1:0)||wholeStack(b)-wholeStack(a)||(Math.abs(a.fit-b.fit)>.05*Math.max(a.fit,b.fit)?b.fit-a.fit:0)||crossings(a)-crossings(b)||b.complete-a.complete);
   const chosen=whole[0].pages[0].wirelessLayout;
   if(!whole[0].compromise){if(wholePlans.size>=200)wholePlans.delete(wholePlans.keys().next().value);wholePlans.set(key,{complete:!!whole[0].complete,planKey:chosen.planKey,width:chosen.planWidth,factor:chosen.apFactor||1});}
   for(const page of whole[0].pages)page.wirelessLayout.wholeSwitch=true;
   return whole[0].pages;
  }
 }
 const primary=planPaperView(project,db,reduced?subsetFor:()=>source,sorted,{portNumbers,first,fallbackWidth});
 // The complete stack only wins with no more sheets, so never explore beyond.
 const alternative=!reduced||!primary?null:planPaperView(project,db,()=>source,sorted,{portNumbers,first,fallbackWidth,counts:[primary.pages.length-1,primary.pages.length].filter(n=>n>=1),beat:primary.fit,optional:true});
 const plans=[primary,alternative].filter(Boolean);
 if(!plans.length)throw capacityError('This wireless page needs more room for its connections.');
 const target=project._wirelessPaperPlan.minimumFit;
 for(const plan of plans)for(const page of plan.pages)page.wirelessLayout.continuedSwitch=true;
 plans.sort((a,b)=>a.pages.length-b.pages.length||(b.fit>=target)-(a.fit>=target)||(Math.abs(a.fit-b.fit)>.05*Math.max(a.fit,b.fit)?b.fit-a.fit:0)||crossings(a)-crossings(b)||b.complete-a.complete);
 return plans[0].pages;
}
// The narrowest readable stack gives the largest predicted print scale.
function planUpperBound(project,db,view,sorted,portNumbers,fallbackWidth){
 const geometry={...pageGeometry(project,'wireless'),dynamic:true},width=readableWidth(project,view,portNumbers,fallbackWidth),choices=bankLayout(project,db,view,sorted,width,stackSpacing(project,view,sorted,width),geometry);
 return Math.max(0,...choices.map(choice=>choice.fit/(1+.015*choice.wraps/Math.max(1,sorted.length))));
}
function planPaperView(project,db,viewFor,sorted,{portNumbers,first,fallbackWidth,counts=null,beat=0,optional=false,whole=false,minWidth=0,only=null}){
 const geometry={...pageGeometry(project,'wireless'),dynamic:true},narrow=new Map(),narrowestFor=view=>{const key=equipmentScope(view);if(!narrow.has(key))narrow.set(key,readableWidth(project,view,portNumbers,fallbackWidth));return narrow.get(key);};
 // Wider stacks give adjacent leads room beside their port numbers but shrink
 // the printed scale, so start narrow and widen only when routing needs it.
 const widthsFor=view=>{if(only)return [only.width];const all=[...new Set(Array.from({length:11},(_,i)=>Math.min(998,Math.round(narrowestFor(view)*(1+.06*i)))))],from=all.filter(w=>w>=minWidth-.5);return from.length?from:all.slice(-1);};
 // The final paper fit may use outside whitespace, so a plan predicted within
 // 3% of the target prints at it; the post-build check verifies real points.
 const target=project._wirelessPaperPlan.minimumFit*.97,limit=Math.max(1,project._wirelessBatchLimit||sorted.length);
 // A whole-switch sheet rarely reaches the target, so rank by printed scale
 // discounted for wrapped caption lines: a name broken mid-word or a 7-line
 // card reads worse than slightly smaller text on whole lines.
 // Whole-switch sheets compare arrangements, not only near-equal sizes: the
 // best two of each kind (rows, side columns, sides, surround) within 75% of
 // the largest, largest first.
 const wholeCandidates=(choices,top)=>{const seen=new Map();return choices.filter(choice=>legible(choice)>=top*.75&&(seen.set(choice.kind,(seen.get(choice.kind)||0)+1).get(choice.kind)<=2));};
 // Printed AP size: the sheet's fit times the AP card factor the choice was
 // planned with (whole-switch sheets may enlarge cards to fill the paper).
 // An AP name broken over two lines reads much worse than smaller text: an
 // arrangement breaking more than a tenth of the names counts 25% smaller.
 const printed=choice=>choice.fit*(choice.factor||1),legible=choice=>whole?printed(choice)/(1+.015*choice.wraps/Math.max(1,sorted.length))*((choice.brokenTitles||0)>sorted.length/10?.75:1):printed(choice);
 const pageProjectFor=index=>{const numberedName=(project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections '+(first+index+1);return {...project,_wirelessFrameName:numberedName,_wirelessAdaptiveFactor:1,...(project.layout?.presentation?.pages?.[numberedName]?{_wirelessPresentationName:numberedName}:{})};};
 // A clean sheet has no obstructed or merged route and no cable through any
 // AP caption (outer-row cables must pass between inner-row cards).
 const clean=page=>{const v=page.wirelessLayout;if(v.routingCost[0]||v.routingCost[1])return false;if(v.captionClear==null){const captions=page.items.filter(i=>i.wirelessCaption);const copy={...page,items:page.items.map(item=>item.type==='path'?{...item,hops:undefined}:item)};bridge(copy,{style:hopStyle(project)});v.captionClear=!copy.items.some(path=>path.type==='path'&&captions.some(text=>pathCrossesText(path,text,0)));}return v.captionClear;};
 // On a whole-switch sheet a tangle costs readability too: discount the
 // printed size by its crossings per AP (7% per crossing per AP, at most 35%).
 const effective=page=>{const v=page.wirelessLayout;return whole?v.legibleFit*Math.max(.65,1-.07*v.routingCost[3]/Math.max(1,v.links.length)):v.legibleFit;};
 // On a whole-switch sheet, no more crossings than APs comes before size.
 const tidy=page=>page.wirelessLayout.routingCost[3]<=page.wirelessLayout.links.length;
 const better=(page,current)=>{if(!current)return true;const a=page.wirelessLayout,b=current.wirelessLayout;if(clean(page)!==clean(current))return clean(page);if(whole&&tidy(page)!==tidy(current))return tidy(page);if(a.meetsTarget!==b.meetsTarget)return a.meetsTarget;if(a.meetsTarget&&a.captionWraps!==b.captionWraps)return a.captionWraps<b.captionWraps;{const x=effective(page),y=effective(current);if(Math.abs(x-y)>.05*Math.max(x,y))return x>y;}if(whole&&a.captionWraps!==b.captionWraps)return a.captionWraps<b.captionWraps;return a.routingCost[3]*55+a.routingCost[4]*8+a.routingCost[2]<b.routingCost[3]*55+b.routingCost[4]*8+b.routingCost[2];};
 // The best clean sheet for one batch: largest printed scale first, fewer
 // crossings on near ties; a wider stack only when narrower ones cannot route.
 const sheet=(batch,index)=>{
  const pageProject=pageProjectFor(index),view=viewFor(batch);let selected=null,error=null,extra=0,rough=null;
  // One project per AP factor for every width, so measured captions are reused.
  // An explicit AP size (Layout & content) is kept exactly: no card factors.
  // The port number size this stack draws at one width (numbers shrink from
  // 10 px toward 8 px where sockets are narrow), measured once per width.
  const numberSizes=new Map(),numberSizeAt=(view,width)=>{const key=equipmentScope(view)+'@'+width;if(!numberSizes.has(key)){let size=8*wirelessNumberScale(pageProject);try{const probe=addDevice({items:[]},pageProject,view,[0,0,width,1],'inspect',{fitWidth:true,padding:equipmentPadding}),items=[];portNumbers(items,probe,physicalPorts(view),{fontScale:wirelessNumberScale(pageProject),upright:true});const sizes=items.filter(i=>i.portNumberRole==='text').map(i=>i.size);if(sizes.length)size=Math.min(...sizes);}catch(error){if(error.code!=='PORT_LABEL_CAPACITY')throw error;}numberSizes.set(key,size);}return numberSizes.get(key);};
  const factors=only?[only.factor||1]:whole&&(wirelessSettings(pageProject).wirelessApScale||1)===1?AP_FACTORS:[1],scaledProjects=new Map(factors.map(factor=>[factor,factor===1?pageProject:{...pageProject,_wirelessAdaptiveFactor:factor}]));
  // The least compromised sheet, kept only when a switch must stay whole.
  const roughCost=page=>{const v=page.wirelessLayout;return [v.routingCost[0]+v.routingCost[1],clean(page)?0:1,-v.legibleFit,v.routingCost[3]];},rougher=(a,b)=>{const x=roughCost(a),y=roughCost(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]>y[i];return false;};
  for(const width of widthsFor(view)){
   // Whole-switch sheets also try larger AP cards: when the stack leaves room,
   // the arrangement that prints the AP text largest on this paper wins.
   const spacing=stackSpacing(pageProject,view,batch,width);
   // Larger cards grow into white space at nearly the same switch scale: a
   // factor is kept only while the stack's port numbers stay readable.
   // Each arrangement only shrinks as its cards grow, so stop at the first
   // factor where none keeps the stack within that bound.
   const planned=[];let baseFit=0;
   for(const factor of factors){
    const scaled=scaledProjects.get(factor),list=bankLayout(scaled,db,view,batch,width,spacing,geometry).filter(choice=>!only||choice.planKey===only.planKey).map(choice=>({...choice,factor,project:scaled}));
    if(factor===1||only)baseFit=Math.max(baseFit,...list.map(choice=>choice.fit));
    // Port numbers print at fit x their measured size at this width x .75 pt:
    // keep 85% of their best size, or 4 pt where that is smaller (large paper
    // has room), and never let larger cards take them below 3.5 pt.
    // Numbers that reach the readable minimum (8 pt by default) stay there.
    const pointFit=pt=>pt/(.75*numberSizeAt(view,width)),readable=pointFit(Math.max(8,wirelessSettings(pageProject).minimumTextPt||8)),floor=Math.max(Math.min(.85*baseFit,pointFit(4)),Math.min(baseFit,pointFit(3.5)),baseFit>=readable?readable:0);
    const kept=only?list:list.filter(choice=>choice.factor===1||choice.fit>=floor);if(!kept.length&&factor>1)break;planned.push(...kept);
   }
   const choices=planned.sort((a,b)=>legible(b)-legible(a)),top=choices[0]?legible(choices[0]):0;
   if(selected&&clean(selected)&&top<selected.wirelessLayout.legibleFit*.98)break;
   // Among arrangements that print at the target size, keep names and details
   // on whole lines; otherwise take the largest printed scale available.
   // Reaching the target size counts only with AP names on whole lines.
   const meets=choice=>printed(choice)>=target&&(!whole||(choice.brokenTitles||0)<=sorted.length/10);
   const meeting=choices.filter(meets).sort((a,b)=>a.wraps-b.wraps||printed(b)-printed(a)),ranked=meeting.length?meeting:whole?wholeCandidates(choices,top):choices.filter(choice=>legible(choice)>=top*.9);
   const attempt=choice=>{
    try{const page=renderBankPage(choice.project,db,view,batch,choice,index,portNumbers);Object.assign(page.wirelessLayout,{paperPlan:true,planWidth:width,predictedFit:printed(choice),legibleFit:legible(choice),captionWraps:choice.wraps,meetsTarget:meets(choice),memberSubset:!!view.stackContinuation,stackFit:choice.fit,...(choice.factor>1?{apFactor:choice.factor}:{})});if(whole&&(!rough||rougher(rough,page)))rough=page;if(better(page,selected))selected=page;}
    catch(e){if(e.code!=='CORE_LAYOUT_CAPACITY')throw e;error=e;if(/around its number/.test(e.message))numberRoom++;}
   };
   let numberRoom=0;
   for(const choice of ranked.slice(0,whole?8:4)){
    // Port-number room depends on the stack width, not the AP arrangement:
    // after two such failures at one width, try the next width.
    if(numberRoom>=2&&!selected)break;
    // A clean sheet already found prints within 5% of anything smaller here.
    if(whole&&selected&&clean(selected)&&tidy(selected)&&legible(choice)<effective(selected)*.95)break;
    attempt(choice);
    if(selected&&clean(selected)&&!selected.wirelessLayout.routingCost[3])break;
   }
   // A tangled whole-switch sheet (more crossings than APs) keeps looking:
   // the next arrangements by printed size, until one is tidy.
   if(whole&&selected&&clean(selected)&&!tidy(selected))for(const choice of choices.filter(choice=>!ranked.slice(0,8).includes(choice)).slice(0,8)){attempt(choice);if(tidy(selected))break;}
   // One wider stack may untangle crossings at nearly the same printed size.
   if(selected&&clean(selected)&&(whole&&(tidy(selected)||++extra>1)||!whole&&(!selected.wirelessLayout.routingCost[3]||++extra>1)))break;
  }
  return {page:selected&&clean(selected)?selected:null,rough,error};
 };
 if(whole){const {page,rough}=sheet(sorted,0),chosen=page||rough;if(chosen&&!page)chosen.wirelessLayout.routingCompromise=true;return chosen?{pages:[chosen],fit:chosen.wirelessLayout.legibleFit,stackFit:chosen.wirelessLayout.stackFit,complete:!chosen.wirelessLayout.memberSubset,compromise:!page}:null;}
 const upper=batch=>{const view=viewFor(batch),narrowest=narrowestFor(view),choices=bankLayout(project,db,view,batch,narrowest,stackSpacing(project,view,batch,narrowest),geometry);return choices.length?choices[0].fit:0;};
 // Fewest balanced sheets whose printed AP details reach the target. The
 // narrowest-stack estimate is an upper bound, so it skips hopeless counts
 // without rendering them; rendered sheets decide the rest.
 let best=null,stale=0;
 const tries=counts?counts.filter(n=>n>=Math.ceil(sorted.length/limit)):Array.from({length:sorted.length-Math.ceil(sorted.length/limit)+1},(_,i)=>Math.ceil(sorted.length/limit)+i);
 // When no count can reach the target (a very large minimum text size, or a
 // stack wider than the sheet), aim for the best size more sheets can buy and
 // stop there, rather than one AP per sheet. One representative batch per
 // count keeps this estimate cheap.
 const estimate=new Map(),estimateFor=count=>{if(!estimate.has(count))estimate.set(count,upper(balancedBatches(sorted,count)[0]));return estimate.get(count);};
 // A one-AP sheet drops a whole bank and would inflate the best case.
 const bestEstimate=counts?target:Math.max(...tries.filter(n=>n<=Math.max(1,Math.ceil(sorted.length/2))).map(estimateFor)),goal=counts?target:bestEstimate>=target?target:.85*bestEstimate;
 for(const count of tries){
  const batches=balancedBatches(sorted,count),bound=Math.min(...batches.map(upper));
  if(counts?bound<Math.max(target,beat*(count===tries.at(-1)?1.1:1)):bound<goal&&count<sorted.length)continue;
  const pages=batches.map((batch,index)=>sheet(batch,index));
  if(pages.some(v=>!v.page)){if(++stale>=3)break;continue;}
  const fit=Math.min(...pages.map(v=>v.page.wirelessLayout.predictedFit)),tangled=pages.some(v=>v.page.wirelessLayout.routingCost[3]>Math.max(4,v.page.wirelessLayout.links.length));
  // A readable count is taken unless its cables tangle (more crossings than
  // APs); then one more sheet is tried and kept only if it is untangled.
  if(best?.met){if(fit>=goal&&!tangled)best={pages:pages.map(v=>v.page),fit,met:true};break;}
  // Short of the target, another sheet must buy at least 10% more size.
  if(!best||fit>=goal||fit>best.fit*(best.fit>=goal?1.02:1.1)){best={pages:pages.map(v=>v.page),fit,met:fit>=goal};stale=0;}else break;
  if(fit>=goal&&!tangled)break;
 }
 if(best)return {...best,complete:best.pages.every(page=>!page.wirelessLayout.memberSubset)};
 if(optional)return null;
 // No balanced split routes cleanly: keep halving only the sheets that fail.
 const batches=[sorted.slice()],out=[];
 for(let index=0;index<batches.length;index++){
  const batch=batches[index],{page,error}=sheet(batch,out.length);
  if(page){out.push(page);continue;}
  if(batch.length>1){const middle=Math.ceil(batch.length/2);batches.splice(index,1,batch.slice(0,middle),batch.slice(middle));index--;continue;}
  if(error)return null;throw capacityError('This wireless page needs more room for its connections.');
 }
 return {pages:out,fit:Math.min(...out.map(page=>page.wirelessLayout.predictedFit)),complete:out.every(page=>!page.wirelessLayout.memberSubset)};
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
 // One chosen preset (e.g. Letter on one page) stays that preset on every
 // continuation sheet; mixed papers plan on their smallest common size.
 const fixed=[base,...numbered].filter(p=>paperDimensions(p)),same=fixed.length&&fixed.every(p=>p.preset===fixed[0].preset&&p.preset!=='custom'&&(p.orientation||'landscape')===(fixed[0].orientation||'landscape'));
 const paper=same?{...fixed[0],locked:false}:dimensions.length?{preset:'custom',widthMm,heightMm,orientation:widthMm<heightMm?'portrait':'landscape'}:base;
 const frames=Object.entries(visible.lockFrames).filter(([name])=>/^Wireless Connections(?: \d+)?$/.test(name)).map(([,frame])=>frame),explicit=['layout','readable','adaptive'].includes(project.layout?.pageSetup?.visible?.wirelessFit);
 const legacy=project._wirelessLegacyPaper===true||!explicit&&frames.some(frame=>!frame.wirelessFit||frame.wirelessFit==='readable-legacy')&&!frames.some(frame=>frame.wirelessFit==='layout');
 const render=planned=>wirelessPages(planned,db,{portNumbers,tablePages,empty}).map(page=>{if(planned._wirelessAdaptive&&paper.preset!=='dynamic')page.wirelessContinuationPaper={...paper,locked:[base,...numbered].some(p=>p.locked)};if(page.wirelessLayout)page.wirelessLayout.paperFit=visible.wirelessFit==='adaptive'?'adaptive':visible.wirelessFit==='readable'?(legacy?'readable-legacy':'readable'):'layout';return page;});
 // Dynamic pages draw the same one-sheet-per-switch plan as paper, planned
 // against the print paper (or Letter landscape), so APs look alike in every
 // mode. Moved objects keep their saved positions on the same arrangement.
 // An explicit Keep complete layout choice, legacy saved frames and a plan
 // that cannot fit keep the established planner.
 const settings=presentation(project,{name:(project._reportPrefix?project._reportPrefix+'|':'')+'Wireless Connections',family:'wireless'});
 // Keep complete layout (the default once wireless geometry is authored)
 // fits that same dynamic arrangement to the paper.
 const explicitLayout=visible.wirelessFit==='layout'&&project.layout?.pageSetup?.visible?.wirelessFitExplicit;
 const dynamicPlan=pageGeometry(project,'wireless').dynamic&&!explicitLayout&&(paper.preset==='dynamic'||visible.wirelessFit==='layout')&&!Object.entries({...visible.lockFrames,...visible.editFrames}).some(([name,frame])=>/^Wireless Connections(?: \d+)?$/.test(name)&&frame.wirelessPaperPlan!==2);
 if(dynamicPlan){
  const minimumPt=Math.max(8,settings.minimumTextPt||8),captionPx=12*(settings.textScale||1);
  const planPaper=cleanPageSetup(project.layout?.pageSetup).printPaper||{preset:'letter',orientation:'landscape'};
  // A dynamic page can grow or continue cleanly, so a plan that could only
  // keep a switch whole by compromising its routes keeps the established one,
  // unless the compromise comes from a deliberate move.
  try{const pages=render({...project,_wirelessAdaptive:true,_wirelessPaperPlan:{paper:{...planPaper,locked:false},minimumFit:minimumPt/(.75*captionPx),dynamic:true}});if(!pages.some(page=>page.wirelessLayout?.routingCompromise)||hasAuthoredWirelessGeometry(project.layout))return pages;}
  catch(error){if(!['CORE_LAYOUT_CAPACITY','PORT_LABEL_CAPACITY','WIRELESS_LAYOUT_CAPACITY'].includes(error.code))throw error;}
 }
 if(visible.wirelessFit==='adaptive'&&paper.preset!=='dynamic'&&visibleFitMode(project)==='optimize'){
  const frames=Object.entries({...visible.lockFrames,...visible.editFrames}).filter(([name])=>/^Wireless Connections(?: \d+)?$/.test(name)).map(([,frame])=>frame);
  // Frames from the earlier enlarge-then-shrink planner remain authoritative
  // only where authored geometry still depends on them (see the defaults
  // migration); otherwise plan at the paper's real printed size.
  if(!frames.some(frame=>frame.wirelessFit==='adaptive'&&!frame.wirelessPaperPlan)){
   const config=presentation(project,{name:'Wireless Connections',family:'wireless'}),minimumPt=Math.max(8,config.minimumTextPt||8),captionPx=12*(config.wirelessApScale||1)*(config.textScale||1);
   // One sheet per switch. A preview.51 split plan (wirelessPaperPlan 1)
   // survives only where authored edits depend on it (see the defaults
   // migration); it reopens with its saved sheet split.
   const split=frames.some(frame=>frame.wirelessPaperPlan===1),savedLimit=Math.min(...frames.filter(frame=>frame.wirelessPaperPlan===1).map(frame=>frame.wirelessBatchLimit).filter(Number.isFinite)),limit=split?project._wirelessBatchLimit||(Number.isFinite(savedLimit)?savedLimit:null):null;
   return render({...project,_wirelessAdaptive:true,_wirelessPaperPlan:{paper:{...paper,locked:[base,...numbered].some(p=>p.locked)},minimumFit:minimumPt/(.75*captionPx)},...(split?{_wirelessPaperSplit:true}:{}),...(limit?{_wirelessBatchLimit:limit}:{})});
  }
  const savedLimits=frames.map(f=>f.wirelessBatchLimit).filter(Number.isFinite),limit=project._wirelessBatchLimit||Math.min(...savedLimits);
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
// Drafted sheets per switch, keyed by the whole project except other devices,
// links and non-wireless drawing edits: the switch, its APs, their links (with
// their global indices), the sheet position and every setting stay in the key.
// Long strings (stencil artwork) are keyed by identity, not re-serialized.
// An edit scoped to another switch's sheets (Wireless Connections|<switch>|…)
// never changes this switch's sheets, so moving an AP re-renders only its own.
function foreignWirelessEdit(key,switchId,db){const m=/(?:^|\|)Wireless Connections\|([^|]+)\|/.exec(key);return !!m&&m[1]!==switchId&&db.devices.has(m[1]);}
const switchDrafts=new Map(),longStrings=new Map();
function switchDraftKey(project,db,sw,records,first,width){
 const {devices,links,evidence,warnings,layout={},...rest}=project,wireless=key=>/Wireless Connections/.test(key);
 const drafting={...layout,textStyles:undefined,drawingEdits:Object.fromEntries(Object.entries(layout.drawingEdits||{}).filter(([key])=>wireless(key)&&!foreignWirelessEdit(key,sw,db)))};
 const apIds=[...new Set(records.map(e=>e.apId))].sort();
 return JSON.stringify([first,width,rest,drafting,db.devices.get(sw),apIds.map(id=>db.devices.get(id)),records.map(e=>[e.idx,e.sw,e.sp,e.apId,e.apPort,e.media,e.speed,e.status,e.a,e.ap,e.b,e.bp])],(key,value)=>{
  if(typeof value!=='string'||value.length<4096)return value;
  if(!longStrings.has(value)){if(longStrings.size>500)longStrings.clear();longStrings.set(value,'#long'+longStrings.size+':'+value.length);}
  return longStrings.get(value);
 });
}
function rememberDrafts(key,pages){if(switchDrafts.size>=100)switchDrafts.delete(switchDrafts.keys().next().value);switchDrafts.set(key,structuredClone(pages));}
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
  // A switch whose own inputs are unchanged reuses its drafted sheets: edits to
  // other devices, links or pages never re-plan it.
  const draftKey=switchDraftKey(project,db,sw,records,out.length,width),drafted=switchDrafts.get(draftKey);
  if(drafted){out.push(...structuredClone(drafted));continue;}
  const before=out.length;
  if(project._wirelessPaperPlan){const source=db.devices.get(sw),sorted=records.slice().sort((a,b)=>cmp(a.sp,b.sp)||cmp(a.apId,b.apId));out.push(...paperPlanPages(project,db,source,sorted,{portNumbers,first:out.length,fallbackWidth:width}));rememberDrafts(draftKey,out.slice(before));continue;}
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
     else pageProject._wirelessAdaptiveFactor=frame?.wirelessApFactor||(batch.length>=16?4:batch.length>=8?2:1);
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
  rememberDrafts(draftKey,out.slice(before));
 }
 const unseen=[...apIds].filter(id=>!linked.has(id)).map(id=>db.devices.get(id));if(unseen.length)out.push(...tablePages(project,'Wireless Connections','Access points with no mapped switch uplink',[['Access point',390],['Model',370],['IP / MAC address',368]],unseen.map(d=>Object.assign([nameOf(d),deviceModel(d),[d.ip,macCaption(d)].filter(Boolean).join(' | ')],{sourceDeviceId:d.id})),''));
 if(!out.length){const layout=project.layout||{},pattern=/(?:^|\|)Wireless Connections(?:\b|\|)/,retained=project._reportPrefix||layout.documentation==='full'||layout.pageSetup?.overrides?.wireless||Object.keys(layout.drawingEdits||{}).some(key=>pattern.test(key))||Object.keys(layout.presentation?.pages||{}).some(key=>pattern.test(key));if(retained){const p=fresh('Wireless Connections','Wireless Connections','Access-point uplinks',project);empty(p,'No access points or switch-to-AP links were supplied.');out.push(p);}}
 return out;
}
