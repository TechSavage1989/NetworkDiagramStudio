import {rect} from '../diagram/scene.mjs';
import {portMapPrimitives as P,ReportCapacityError,validateReportScene} from './scene.mjs';

// Follows Switchport Diagram Builder's measured side/below-key search. Keep
// physical banks in order, reserve readable text, then maximize socket size.
// Never mistake landscape paper for a requirement to split a stack in half.
const GAP=12;
const styles=[
 {scale:1,numberFont:12,groupFont:12,markerRadius:2.1,compact:false},
 {scale:1,numberFont:10,groupFont:11,markerRadius:2.1,compact:false},
 ...[10,9,8].map(numberFont=>({scale:.55,numberFont,groupFont:10,markerRadius:1.5,compact:true}))
];
function arrange(plan,columns){
 if(columns===1)return plan;
 // Only complete stack members may wrap. Chassis slots retain their real
 // paired geometry; configured alternatives and rear panels stay with owners.
 const groups=plan.item.inventory.groups;
 if(groups.length<3||groups.length>8||groups.some(group=>group.slot||group.rear||group.configuredInterfaces)||plan.bands.some(band=>band.panels.length!==1))return null;
 const count=Math.ceil(plan.bands.length/columns),width=Math.max(...plan.bands.map(band=>band.width)),bands=[];
 for(let row=0;row<count;row++){
  const members=Array.from({length:columns},(_,column)=>({band:plan.bands[column*count+row],column})).filter(({band})=>band);
  bands.push({height:Math.max(...members.map(({band})=>band.height)),width:columns*width+(columns-1)*GAP,
   panels:members.flatMap(({band,column})=>band.panels.map(panel=>({...panel,x:panel.x+column*(width+GAP)})))});
 }
 return {...plan,bands,width:columns*width+(columns-1)*GAP,height:bands.reduce((sum,band)=>sum+band.height+plan.gap,0)};
}
// VLANs and LAGs each have their own heading.
function keyPlan(inv,palette,width){
 const sections=P.keySections(inv,palette,width,true,true);
 return {width,sections,height:sections.reduce((sum,section)=>sum+22+section.rows.reduce((total,row)=>total+row.height,0)+2,0)};
}
function drawKey(p,plan,x,y){
 const a=p.items;
 for(const section of plan.sections){
 P.text(a,x,y,plan.width,section.title,11,true,'#16364a','left',{editKey:p.name+'|key-heading|'+section.key,reportKeyHeading:section.key});y+=22;
 for(const row of section.rows){
  for(const [column,entry] of row.entries.entries()){
   const left=x+column*row.columnWidth;
   rect(a,left,y+1,14,12,entry.fill,entry.stroke||'#536779',entry.stroke?2:.7);
   if(entry.vlan){
    const extra={editKey:p.name+'|key|'+entry.id+'|marker',reportKeyMarker:entry.id};
    if(entry.voice)P.diamond(a,left+18,y+1.5,11,entry.fill,'#263c49',.5,extra);
    else P.ellipse(a,left+18.5,y+2,10,10,entry.fill,'#263c49',.5,extra);
   }
   const marked=entry.vlan;
   P.text(a,left+(marked?36:22),y,row.columnWidth-(marked?44:30),entry.title,entry.font||10,false,'#16364a','left',{reportKeyTitle:entry.id});
  }
  y+=row.height;
 }
 y+=2;
 }
}
function preserveLegacyKeys(page,previous){
 // Repacking changes incidental item indexes. Keep semantic text/header
 // identities, but never let an old indexed edit attach to a different shape.
 const indexed=key=>key?.startsWith(page.name+'|item|'),textKey=item=>item.reportKeyTitle!=null?'key:'+item.reportKeyTitle:'text:'+item.value;
 const donors=new Map(),used=new Set(page.items.filter(item=>!indexed(item.editKey)).map(item=>item.editKey));
 for(const item of previous.items||[])if(item.type==='text'&&indexed(item.editKey)){
  const key=textKey(item);if(!donors.has(key))donors.set(key,[]);donors.get(key).push(item.editKey);
 }
 for(const [index,item] of page.items.entries()){
  if(!indexed(item.editKey))continue;
  let key;
  if(index<3&&previous.items?.[index]?.type===item.type)key=previous.items[index].editKey;
  else if(item.type==='text')key=donors.get(textKey(item))?.find(candidate=>!used.has(candidate));
  item.editKey=key||page.name+'|adaptive-item|'+index;used.add(item.editKey);
 }
}
export function adaptivePortMap(item,palette,request,identity){
 const sheet=request.paper,inv=item.inventory;
 // Page lock fixes the paper boundary, not the printable artwork size.
 // Leave only enough room for the chassis frame stroke; saved frames are
 // preserved by the presentation layer rather than shrinking new layouts.
 const legacy=sheet?.legacyAdaptive===true,margin=legacy?(sheet?.locked?24:12):Number.isFinite(request.margin)?request.margin:4;
 if(!sheet||!(sheet.width>0&&sheet.height>0))throw new ReportCapacityError('Adaptive port maps require measured paper dimensions.');
 const make=()=>{
  const p=P.page(request,item.id+'|adaptive',P.displayName(inv),[P.modelLabel(inv),inv.ports.length+' interfaces'].filter(Boolean).join(' | '),identity.role,[item.id],sheet.width,sheet.height,true);
  p.name=identity.name;p.displayName=identity.displayName||p.displayName;p.reportMargin=legacy?24:margin;if(!legacy)p.contentTop-=4;return p;
 };
 const sample=make(),top=sample.contentTop,contentWidth=sheet.width-2*margin;
 const footerSpace=request.pageFooter&&!request.pageFooter.footer&&!request.pageFooter.show?margin:65,guideHeight=P.symbolKeyHeight(inv,legacy?sheet.width-48:contentWidth),bottom=sheet.height-footerSpace-guideHeight,available=bottom-top;
 const keys=[{side:false,key:keyPlan(inv,palette,contentWidth)},...[160,190,220,260].filter(width=>width<contentWidth*.4).map(width=>({side:true,key:keyPlan(inv,palette,width)}))];
 const candidates=[];
 for(const style of styles){
  let base;try{base=P.devicePlan(item,style,Math.max(16,style.numberFont*1.2+4),true);}catch(error){if(error.code!=='SWITCHPORT_REPORT_CAPACITY')throw error;continue;}
  for(const columns of [1,2])for(const {side,key} of keys){
   const roomWidth=contentWidth-(side?key.width+GAP:0),roomHeight=available-(side?0:key.height+GAP);
   if(side&&key.height>available)continue;
   const at=width=>arrange(P.devicePlan(item,style,width,true),columns);
   const fits=plan=>plan&&plan.width<=roomWidth+.001&&plan.height<=roomHeight+.001;
   if(!fits(at(base.portWidth)))continue;
   // A reference socket size is a starting point, not an Auto-fit ceiling.
   // The measured paper, complete key and physical bank proportions bound growth.
   let low=base.portWidth,high=Math.max(low,legacy&&sheet.locked?(item.standardPortWidth??56):roomWidth);
   for(let step=0;step<15;step++){const mid=(low+high)/2;if(fits(at(mid)))low=mid;else high=mid;}
   const plan=at(low),radius=P.fillRadius(inv,plan);
   if(radius==null)continue;
   candidates.push({plan,radius,key,side,columns,roomWidth,roomHeight});
  }
 }
 const largest=Math.max(0,...candidates.map(candidate=>candidate.plan.portWidth));
 // Favor readable numbers near a size tie, and original one-column ordering
 // before wrapping a stack. No geometry is stretched or silently omitted.
 candidates.sort((a,b)=>(b.plan.portWidth>=largest*.97)-(a.plan.portWidth>=largest*.97)||
  b.plan.style.numberFont-a.plan.style.numberFont||b.plan.portWidth-a.plan.portWidth||a.columns-b.columns||Number(b.side)-Number(a.side));
 for(const candidate of candidates){
  const {plan,radius,key,side,columns,roomWidth}=candidate,p=make();
  if(radius!=null)for(const band of plan.bands)for(const panel of band.panels)if(panel.plan)panel.plan.markerRadius=radius;
  // Center the measured bank/key pair, not a page-sized mostly-empty canvas.
  const occupied=side?plan.width+GAP+key.width:contentWidth;
  const x=side?margin+(contentWidth-occupied)/2:margin+(roomWidth-plan.width)/2;
  try{
   const bankBottom=P.drawBlock(p,plan,x,top,palette,{heading:false});
   drawKey(p,key,side?x+plan.width+GAP:margin,side?top:bankBottom+GAP);
   P.symbolKey(p,sheet.height-footerSpace-guideHeight,palette,inv);
   P.finish(p,request,palette,inv);preserveLegacyKeys(p,identity);
   const errors=validateReportScene(p);if(errors.length)continue;
   p.adaptivePortMap={columns,keyPosition:side?'side':'below',socketWidth:plan.portWidth,numberFont:plan.style.numberFont};
   p.reportGeometryScale=plan.portWidth/30;p.reportNumberFont=plan.style.numberFont;
   p.reportMarkerRadius=radius??plan.style.markerRadius;p.reportMarkerFit=radius;
   return p;
  }catch(error){if(error.code!=='SWITCHPORT_REPORT_CAPACITY')throw error;}
 }
 throw new ReportCapacityError('The complete map and key cannot fit this paper at readable size.',{deviceId:item.id});
}
