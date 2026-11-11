import {readableDeviceLabels} from './device-paper-labels.mjs';
import {readableModelScale,paperTextMetrics} from './paper-readability.mjs';
import {paperPanel,paperLinkKey} from './paper-panel.mjs';
import {contentBounds,paperFurniture,placePaperFurniture} from './page-content-fit.mjs';
export function cleanPageNumbers(raw){const p=raw&&typeof raw==='object'?raw:{};return {show:p.show===true,footer:p.footer===true,start:Number.isInteger(p.start)&&p.start>=0&&p.start<=9999?p.start:1,pad:Number.isInteger(p.pad)&&p.pad>=1&&p.pad<=5?p.pad:2,format:typeof p.format==='string'&&p.format.length<=100?p.format:'{page} / {last}'};}
export function pageNumber(raw,index,count){const p=cleanPageNumbers(raw);if(!p.show)return null;const values={page:p.start+index,last:p.start+count-1,total:count};return p.format.replace(/\{(page|last|total)\}/g,(_,key)=>String(values[key]).padStart(p.pad,'0'));}

// Reuse the footer band when neither optional decoration is enabled.
export function footerAllowance(project){const p=cleanPageNumbers(project?.layout?.pageNumbers);return p.show||p.footer?0:42;}

// Scene units are 96 per inch in SVG, printing and native Visio.
export const paperSizes=[['original','Original drawing',317.5,257.96875],['letter','Letter',215.9,279.4],['legal','Legal',215.9,355.6],['tabloid','Tabloid / Ledger',279.4,431.8],['a5','A5',148,210],['a4','A4',210,297],['a3','A3',297,420],['a2','A2',420,594],['a1','A1',594,841],['custom','Custom',297,420]];
export const pageFamilies=[['core','Core network'],['ports','Port maps'],['wireless','Wireless connections'],['logical','VLANs and routing'],['trunk','Trunk VLANs'],['switchports','Switchport reports']];
export function cleanPaper(raw){const p=raw&&typeof raw==='object'?raw:{},preset=p.preset==='dynamic'||paperSizes.some(v=>v[0]===p.preset)?p.preset:'dynamic';return {preset,locked:p.locked===true,orientation:p.orientation==='portrait'?'portrait':'landscape',widthMm:Number.isFinite(+p.widthMm)&&+p.widthMm>=148&&+p.widthMm<=1500?+p.widthMm:297,heightMm:Number.isFinite(+p.heightMm)&&+p.heightMm>=148&&+p.heightMm<=1500?+p.heightMm:420};}
// Creation defaults are separate from cleaning: reopening an older project must
// never silently change its paper or saved drawing coordinates.
export function newPageSetup(){return cleanPageSetup({visible:{wirelessFit:'adaptive',groups:{ports:{preset:'letter',orientation:'landscape'}}}});}
// Optional outside page margin in millimetres (0-50); absent keeps the
// established automatic margins (12 units, 24 on a locked physical sheet).
// Every drawing page keeps a blank border, 5 mm unless Paper & print sets
// another margin (0-50 mm).
export const DEFAULT_PAGE_MARGIN_MM=5;
export function pageMarginMm(project){const mm=project?.layout?.pageSetup?.visible?.marginMm;return Number.isFinite(mm)&&mm>=0&&mm<=50?mm:DEFAULT_PAGE_MARGIN_MM;}
export function pageMarginPx(project){return pageMarginMm(project)*96/25.4;}
export function cleanPageSetup(raw){
 const p=raw&&typeof raw==='object'?raw:{},visible=p.visible&&typeof p.visible==='object'?p.visible:{},groups=visible.groups&&typeof visible.groups==='object'?visible.groups:{},individual=visible.pages&&typeof visible.pages==='object'?visible.pages:{};
 const wirelessFrames=Object.entries(visible.lockFrames||{}).filter(([name])=>/^Wireless Connections(?: \d+)?$/.test(name)).map(([,frame])=>frame);
 const wirelessFit=['layout','readable','adaptive'].includes(visible.wirelessFit)?visible.wirelessFit:wirelessFrames.length&&!wirelessFrames.some(frame=>frame?.wirelessFit==='layout')?'readable':'layout';
 const safe=name=>typeof name==='string'&&name.length>0&&name.length<=300&&!['__proto__','prototype','constructor'].includes(name);
 return {
  default:cleanPaper(p.default),
  overrides:Object.fromEntries(pageFamilies.filter(([key])=>p.overrides?.[key]).map(([key])=>[key,cleanPaper(p.overrides[key])])),
  printPaper:p.printPaper&&p.printPaper.preset!=='dynamic'?cleanPaper(p.printPaper):null,
  visible:{...(visible.wirelessStack==='members'?{wirelessStack:'members'}:{}),...(Number.isFinite(visible.marginMm)&&visible.marginMm>=0&&visible.marginMm<=50?{marginMm:Math.round(visible.marginMm*10)/10}:{}),lockFrames:Object.fromEntries(Object.entries(visible.lockFrames||{}).filter(([name,f])=>safe(name)&&f&&['scale','x','y','originX','originY','width','height'].every(k=>Number.isFinite(f[k])&&Math.abs(f[k])<1e8)&&f.scale>0&&f.scale<=10000&&f.width>0&&f.height>0).slice(0,500).map(([name,f])=>[name,{...Object.fromEntries(['scale','x','y','originX','originY','width','height'].map(k=>[k,f[k]])),...(f.contentFit===1?{contentFit:1}:{}),...(f.portMapFit===1?{portMapFit:1}:{}),...(f.panelFit===1?{panelFit:1}:{}),...(Number.isFinite(f.wirelessApFactor)&&f.wirelessApFactor>=1&&f.wirelessApFactor<=8?{wirelessApFactor:f.wirelessApFactor}:{}),...(Number.isInteger(f.wirelessBatchLimit)&&f.wirelessBatchLimit>=1&&f.wirelessBatchLimit<=4096?{wirelessBatchLimit:f.wirelessBatchLimit}:{}),...(/^(?:(?:sides|surround|columns):(?:116|120|132|180|245)|paper-(?:rows|sides|surround|columns):[0-9a-z:]{1,40})$/.test(f.wirelessPlan||'')?{wirelessPlan:f.wirelessPlan}:{}),...([1,2].includes(f.wirelessPaperPlan)?{wirelessPaperPlan:f.wirelessPaperPlan}:{}),...(Number.isFinite(f.wirelessPlanWidth)&&f.wirelessPlanWidth>0&&f.wirelessPlanWidth<=4000?{wirelessPlanWidth:f.wirelessPlanWidth}:{}),...(f.wirelessSubset===1?{wirelessSubset:1}:{}),...(Number.isFinite(f.wirelessNumberScale)&&f.wirelessNumberScale>1&&f.wirelessNumberScale<=4?{wirelessNumberScale:f.wirelessNumberScale}:{}),...(['layout','readable','readable-legacy','adaptive'].includes(f.wirelessFit)?{wirelessFit:f.wirelessFit}:{})}])),editFrames:Object.fromEntries(Object.entries(visible.editFrames||{}).filter(([name,f])=>safe(name)&&f&&['scale','x','y','originX','originY','width','height'].every(k=>Number.isFinite(f[k])&&Math.abs(f[k])<1e8)&&f.scale>0&&f.scale<=10000&&f.width>0&&f.height>0).slice(0,500).map(([name,f])=>[name,{...Object.fromEntries(['scale','x','y','originX','originY','width','height'].map(k=>[k,f[k]])),...(f.contentFit===1?{contentFit:1}:{}),...(f.portMapFit===1?{portMapFit:1}:{}),...(f.panelFit===1?{panelFit:1}:{}),...(Number.isFinite(f.wirelessApFactor)&&f.wirelessApFactor>=1&&f.wirelessApFactor<=8?{wirelessApFactor:f.wirelessApFactor}:{}),...(Number.isInteger(f.wirelessBatchLimit)&&f.wirelessBatchLimit>=1&&f.wirelessBatchLimit<=4096?{wirelessBatchLimit:f.wirelessBatchLimit}:{}),...(/^(?:(?:sides|surround|columns):(?:116|120|132|180|245)|paper-(?:rows|sides|surround|columns):[0-9a-z:]{1,40})$/.test(f.wirelessPlan||'')?{wirelessPlan:f.wirelessPlan}:{}),...([1,2].includes(f.wirelessPaperPlan)?{wirelessPaperPlan:f.wirelessPaperPlan}:{}),...(Number.isFinite(f.wirelessPlanWidth)&&f.wirelessPlanWidth>0&&f.wirelessPlanWidth<=4000?{wirelessPlanWidth:f.wirelessPlanWidth}:{}),...(f.wirelessSubset===1?{wirelessSubset:1}:{}),...(Number.isFinite(f.wirelessNumberScale)&&f.wirelessNumberScale>1&&f.wirelessNumberScale<=4?{wirelessNumberScale:f.wirelessNumberScale}:{}),...(['layout','readable','readable-legacy','adaptive'].includes(f.wirelessFit)?{wirelessFit:f.wirelessFit}:{})}])),fitMode:visible.fitMode==='preserve'?'preserve':'optimize',wirelessFit,wirelessFitExplicit:visible.wirelessFitExplicit===true,default:cleanPaper(visible.default),groups:Object.fromEntries(pageFamilies.filter(([key])=>groups[key]).map(([key])=>[key,cleanPaper(groups[key])])),pages:Object.fromEntries(Object.entries(individual).filter(([name])=>safe(name)).slice(0,500).map(([name,paper])=>[name,cleanPaper(paper)]))}
 };
}
export function pageFamily(name){return /^Switchport reports/i.test(name)?'switchports':/^(?:MDF Port Map|Port Inventory)/i.test(name)?'ports':/^Wireless Connections/i.test(name)?'wireless':/^VLANs and Routing/i.test(name)?'logical':/^Trunk VLAN/i.test(name)?'trunk':'core';}
export function pageGeometry(project,family='core'){
 // Port maps print on US Letter (landscape) unless their family, or a fixed
 // drawing default, chooses another paper.
 const setup=cleanPageSetup(project?.layout?.pageSetup),preferLetter=family==='ports'&&!setup.overrides[family]&&setup.default.preset==='dynamic'&&!project?._portsDynamic,paper=setup.overrides[family]||(preferLetter?{preset:'letter',orientation:'landscape'}:setup.default);
 if(paper.preset==='dynamic'){
  const size=project?._pageGeometry?.[family]||{width:1200,height:975};
  return {...size,widthMm:size.width*25.4/96,heightMm:size.height*25.4/96,paper,dynamic:true,printPaper:setup.printPaper};
 }
 if(preferLetter)return {...pageGeometry({...project,_portsDynamic:true,layout:{...project?.layout,pageSetup:{default:{preset:'letter',orientation:'landscape'}}}},family),preferred:true};
 const row=paperSizes.find(v=>v[0]===paper.preset);let [w,h]=paper.preset==='custom'?[paper.widthMm,paper.heightMm]:row.slice(2);const short=Math.min(w,h),long=Math.max(w,h);[w,h]=paper.orientation==='portrait'?[short,long]:[long,short];return {width:Math.round(w*96/25.4*1e6)/1e6,height:Math.round(h*96/25.4*1e6)/1e6,widthMm:w,heightMm:h,paper,printPaper:setup.printPaper};
}
export function fitColumns(columns,width){const sum=columns.reduce((n,c)=>n+c[1],0);return columns.map(([name,w])=>[name,w*width/sum]);}
export function printGeometry(page){return page.printPaper?pageGeometry({layout:{pageSetup:{default:page.printPaper}}}):page;}
export function printPageStyles(pages){return pages.map((p,i)=>{const g=printGeometry(p);return '@page nds'+i+'{size:'+Number(g.width*25.4/96).toFixed(4)+'mm '+Number(g.height*25.4/96).toFixed(4)+'mm;margin:0}#print-set>section:nth-of-type('+(i+1)+'){page:nds'+i+';width:'+g.width+'px;height:'+g.height+'px}#print-set>section:nth-of-type('+(i+1)+')>svg{width:100%;height:100%;max-width:none;max-height:none}';}).join('');}

// A visible paper is a viewport/print frame around the completed drawing, not
// a constraint passed into device arrangement or logical pagination.
export function visibleFitMode(project){return cleanPageSetup(project?.layout?.pageSetup).visible.fitMode;}
export function targetPageAspect(project,page){
 if(visibleFitMode(project)!=='optimize')return null;
 return paperDimensions(visiblePagePaper(project,page))?.ratio||null;
}
export function hasManualPageLayout(project,page){
 const name=page?.name||page||'',edits=project?.layout?.drawingEdits||{};
 return Object.entries(edits).some(([key,patch])=>key.startsWith(name+'|')&&(['x','y','points'].some(field=>patch&&field in patch))&&(/\\|device\\||\\|path\\|/.test(key)||/\\|port\\||\\|media\\|/.test(key)));
}
export function visiblePagePaper(project,page){
 const setup=cleanPageSetup(project?.layout?.pageSetup),family=page?.family||pageFamily(page?.name||'');
 const chosen=setup.visible.pages[page?.name]||setup.visible.groups[family]||setup.visible.default;
 // An automatically added wireless continuation inherits the selected
 // physical planning sheet, never an unrelated Dynamic fallback.
 return chosen.preset==='dynamic'&&!setup.visible.pages[page?.name]&&page?.wirelessContinuationPaper?cleanPaper(page.wirelessContinuationPaper):chosen;
}
export function paperDimensions(paper){
 const item=cleanPaper(paper);
 if(item.preset==='dynamic')return null;
 const row=paperSizes.find(([name])=>name===item.preset);
 const pair=item.preset==='custom'?[item.widthMm,item.heightMm]:row.slice(2);
 const short=Math.min(...pair),long=Math.max(...pair),[widthMm,heightMm]=item.orientation==='portrait'?[short,long]:[long,short];
 return {widthMm,heightMm,ratio:widthMm/heightMm};
}
// Fit the completed, measured scene into a page of the selected aspect ratio.
// This is a presentation transform, not a re-layout of saved edit coordinates.
// Core and wireless planners may separately choose arrangements for this ratio.
export function fitVisiblePage(page,project){
 const paper=visiblePagePaper(project,page),dimensions=paperDimensions(paper),visible=cleanPageSetup(project?.layout?.pageSetup).visible;
 if(!dimensions)return page;
 // An adaptive port map was already planned inside this exact paper ratio,
 // including margins, title, complete key and footer. Do not shrink its
 // full page a second time or introduce another border of empty space.
 if(!paper.locked&&!visible.editFrames[page.name]&&page.adaptivePortMap&&visibleFitMode(project)==='optimize'&&Math.abs(page.width/page.height-dimensions.ratio)<1e-7){
  page.visiblePaper=paper;page.visibleFitMode='optimize';
  page.presentationFrame={scale:1,x:0,y:0,originX:page.originX||0,originY:page.originY||0,width:page.width,height:page.height,portMapFit:1};
  // Native adaptive report layouts already enforce their own readable socket
  // minimum and fit every member/key. Never run a second fit merely because
  // the general diagram-label preference is larger; that would shrink them
  // and reinterpret saved absolute edits. Report the actual paper size only.
  const unit=page.width/(dimensions.widthMm*96/25.4),check=readableModelScale(page,project,1,unit,new Set(page.items.filter(i=>i.pageFrame||i.pageHeading)));
  page.paperReadability={minimumPt:check.minimumPt,actualPt:check.metrics.minimum?check.metrics.minimum/unit*.75:null,preserved:true,overflow:false};
  page.printPaper=cleanPageSetup(project?.layout?.pageSetup).printPaper||paper;
  return page;
 }
 const sourceW=page.width,sourceH=page.height,originX=page.originX||0,originY=page.originY||0,ratio=dimensions.ratio;
 const preserve=visibleFitMode(project)==='preserve',locked=paper.locked===true,physicalW=dimensions.widthMm*96/25.4,physicalH=dimensions.heightMm*96/25.4,width=locked?physicalW:Math.max(sourceW,sourceH*ratio),height=locked?physicalH:Math.max(sourceH,sourceW/ratio);
 const editFrame=!locked?visible.editFrames[page.name]:null;
 const frozen=locked?visible.lockFrames[page.name]:editFrame;
 const adaptiveFit=page.adaptivePortMap&&!preserve&&!frozen&&Math.abs(sourceW/sourceH-ratio)<1e-7;
 const contentFit=!adaptiveFit&&!preserve&&(!frozen||frozen.contentFit===1)&&page.items.some(i=>i.pageHeading);
 let furniture=null,measured=null,panel=null,readability=null;
 let factor=1,dx=(width-sourceW)/2,dy=(height-sourceH)/2;
 if(!preserve||frozen){
  // Calculate a size-independent page frame. Scaling to fill it gives an
  // effective fit on either portrait or landscape paper; device proportions,
  // socket glue and exact manual relative positions remain unchanged.
  const area=Math.max(1,sourceW*sourceH);
  const targetW=editFrame?.width??(locked?physicalW:Math.sqrt(area*ratio)),targetH=editFrame?.height??(locked?physicalH:targetW/ratio);
  // Retain the established quarter-inch inset for locked physical sheets.
  const margin=adaptiveFit?0:pageMarginPx(project)??(locked?24:12),fit=Math.min((targetW-2*margin)/sourceW,(targetH-2*margin)/sourceH);
  factor=adaptiveFit?targetW/sourceW:Math.max(.05,Math.min(4,fit));
  dx=originX+margin+(targetW-2*margin-sourceW*factor)/2-originX*factor;
  dy=originY+margin+(targetH-2*margin-sourceH*factor)/2-originY*factor;
  if(contentFit){
   const unit=targetW/physicalW;
   furniture=paperFurniture(frozen?{...page,originX:frozen.originX,originY:frozen.originY}:page,project,targetW,targetH,unit,margin*unit);
   const legacyPanelFrame=frozen&&frozen.panelFit!==1;
   page.panelFitLegacy=!!legacyPanelFrame&&page.items.some(i=>i.panelGroup||page.title==='Wireless Connections'&&i.editKey?.includes('|legend|'));
   if(!legacyPanelFrame)panel=paperPanel(page,project,furniture.body,unit)||paperLinkKey(page,project,furniture.body,unit);
   if(panel){
    const divider=page.items.find(i=>i.pageFrame==='sidebar');
    if(divider&&panel.divider)furniture.placements.set(divider,{...panel.divider,scale:unit/(divider.presentation?.scale||1)});
   }
   measured=contentBounds(page,new Set([...furniture.automatic,...(panel?.items||[])]));
   if(measured){
    let body=panel?.body||furniture.body;factor=Math.min(4,body.w/measured.w,body.h/measured.h);
    readability=readableModelScale(page,project,factor,unit,new Set([...furniture.automatic,...(panel?.items||[])]));
    if(!frozen){
     factor=readability.factor;
     if(measured.w*factor>body.w+1e-6||measured.h*factor>body.h+1e-6){
      // Use disposable outside whitespace before declaring readable content
      // too large. Keep the heading and any panel rail untouched; 2 paper px
      // remains at the content edge. Frozen/manual frames never change here.
      // An explicit Page margin is never reclaimed.
      const edge=(pageMarginPx(project)??2)*unit,left=(page.originX||0)+edge,right=(page.originX||0)+targetW-edge,bottom=(page.originY||0)+targetH-edge;
      const x=Math.abs(body.x-furniture.body.x)<1e-6?left:body.x;
      const end=Math.abs(body.x+body.w-furniture.body.x-furniture.body.w)<1e-6?right:body.x+body.w;
      body={...body,x,w:end-x,h:Math.max(body.h,bottom-body.y)};
     }
     // Selecting paper is an explicit fit request. A text-size preference
     // must never push an automatic diagram beyond that paper. Preserve one
     // proportional transform and disclose any unmet readability target.
     // Frozen frames still permit deliberate manual off-page transformations.
     factor=Math.min(factor,body.w/measured.w,body.h/measured.h);
    }
    readability.body=body;
    dx=body.x+Math.max(0,body.w-measured.w*factor)/2-measured.x*factor;
    // Tables read from the top of the sheet; drawings are centered.
    dy=body.y+(page.portMap?.bookletRole==='inventory'?0:Math.max(0,body.h-measured.h*factor)/2)-measured.y*factor;
   }
  }
  if(frozen){factor=frozen.scale;dx=frozen.x;dy=frozen.y;
  }
  for(const item of page.items){
   if(furniture?.automatic.has(item))continue;
   const transform=panel?.transforms?.get(item)||(panel?.items.has(item)?panel:null);
   const itemFactor=transform?transform.scale:factor,itemDx=transform?transform.x:dx,itemDy=transform?transform.y:dy;
   const prev=item.presentation||{scale:1,x:0,y:0,fontScale:1};
   item.presentation={...prev,scale:(prev.scale||1)*itemFactor,x:(prev.x||0)*itemFactor+itemDx,y:(prev.y||0)*itemFactor+itemDy,fontScale:(prev.fontScale||1)*itemFactor};
   for(const key of ['x','y','w','h','weight','sampleWeight']){
    if(!Number.isFinite(item[key]))continue;
    item[key]=item[key]*itemFactor+(key==='x'?itemDx:key==='y'?itemDy:0);
   }
   if(item.points)item.points=item.points.map(([x,y])=>[x*itemFactor+itemDx,y*itemFactor+itemDy]);
   if(item.commands)item.commands=item.commands.map(([op,...values])=>[op,...values.map((v,i)=>v*itemFactor+(i%2?itemDy:itemDx))]);
   if(item.hops)item.hops=item.hops.map(h=>({...h,x:h.x*itemFactor+itemDx,y:h.y*itemFactor+itemDy,w:h.w*itemFactor,h:h.h*itemFactor}));
   for(const key of ['from','to'])if(item[key])item[key]={...item[key],x:item[key].x*itemFactor+itemDx,y:item[key].y*itemFactor+itemDy};
   if(item.type==='text')item.size*=itemFactor;
   if(item.type==='device'){
    for(const child of item.children||[])if(child.type==='text')child.size*=itemFactor;
    if(itemFactor!==1)item.masterKey+=':visible-fit:'+itemFactor.toFixed(6);
   }
  }
  if(furniture)placePaperFurniture(furniture,factor,dx,dy,measured||{x:0,y:0,w:0,h:0});
  if(page.sidebar)page.sidebar={...page.sidebar,...Object.fromEntries(['divider','contentLeft','titleLeft','bodyLeft'].filter(k=>Number.isFinite(page.sidebar[k])).map(k=>[k,page.sidebar[k]*factor+dx])),...(Number.isFinite(page.sidebar.width)?{width:page.sidebar.width*factor}:{})};
  page.originX=frozen?.originX??originX;page.originY=frozen?.originY??originY;
  page.width=targetW;page.height=targetH;
 }else{
  page.originX=originX-(width-sourceW)/2;page.originY=originY-(height-sourceH)/2;
  page.width=width;page.height=height;
 }
 if(!preserve)readableDeviceLabels(page,project,page.width/physicalW);
 // A lock fixes the sheet and saved presentation frame, not the user's items.
 // Preserve deliberate off-page edits and expose their printable clipping risk.
 const contentX=originX*factor+(preserve&&!frozen?0:dx),contentY=originY*factor+(preserve&&!frozen?0:dy);
 page.pageOverflow=locked&&(contentX<(page.originX||0)-1e-6||contentY<(page.originY||0)-1e-6||contentX+sourceW*factor>(page.originX||0)+page.width+1e-6||contentY+sourceH*factor>(page.originY||0)+page.height+1e-6);
 {const bounds=contentBounds(page);page.pageOverflow=(!contentFit&&page.pageOverflow)||!!(locked||editFrame)&&!!bounds&&(bounds.x<(page.originX||0)-1e-6||bounds.y<(page.originY||0)-1e-6||bounds.x+bounds.w>(page.originX||0)+page.width+1e-6||bounds.y+bounds.h>(page.originY||0)+page.height+1e-6);}
 page.pageOverflow=page.pageOverflow||!!panel?.overflow;
 if(readability){const body=readability.body||panel?.body||furniture.body;const exceeds=frozen?!!page.pageOverflow:measured.w*factor>body.w+1e-6||measured.h*factor>body.h+1e-6;page.pageOverflow||=exceeds;const finalText=paperTextMetrics(page,project,new Set([...furniture.automatic,...(panel?.items||[])]));page.paperReadability={minimumPt:readability.minimumPt,actualPt:finalText.minimum?finalText.minimum/(page.width/physicalW)*.75:null,preserved:!!frozen,overflow:exceeds};}
 page.presentationFrame={scale:factor,x:preserve&&!frozen?0:dx,y:preserve&&!frozen?0:dy,originX:page.originX,originY:page.originY,width:page.width,height:page.height,...(contentFit?{contentFit:1}:{}),...(page.adaptivePortMap&&(!frozen||frozen.portMapFit===1)?{portMapFit:1}:{}),...(contentFit&&!page.panelFitLegacy?{panelFit:1}:{}),...(page.wirelessLayout?{wirelessFit:page.wirelessLayout.paperFit||'layout',...(page.wirelessLayout.adaptiveFactor||page.wirelessLayout.apFactor?{wirelessApFactor:page.wirelessLayout.adaptiveFactor||page.wirelessLayout.apFactor}:{}),...(page.wirelessLayout.batchLimit?{wirelessBatchLimit:page.wirelessLayout.batchLimit}:{}),...(page.wirelessLayout.planKey?{wirelessPlan:page.wirelessLayout.planKey}:{}),...(page.wirelessLayout.paperPlan?{wirelessPaperPlan:page.wirelessLayout.wholeSwitch?2:1}:{}),...(page.wirelessLayout.wholeSwitch&&Number.isFinite(page.wirelessLayout.planWidth)?{wirelessPlanWidth:page.wirelessLayout.planWidth,...(page.wirelessLayout.memberSubset?{wirelessSubset:1}:{})}:{}),...(page.wirelessLayout.numberScale>1?{wirelessNumberScale:page.wirelessLayout.numberScale}:{})}:{})};
 if(locked)page.pageLockFrame={...page.presentationFrame};
 page.widthMm=page.width*25.4/96;page.heightMm=page.height*25.4/96;
 page.visiblePaper=paper;page.visibleFitMode=preserve?'preserve':'optimize';
 page.printPaper=cleanPageSetup(project?.layout?.pageSetup).printPaper||paper;
 if(!readability){const check=readableModelScale(page,project,1,page.width/physicalW,new Set(page.items.filter(i=>i.pageFrame||i.pageHeading||i.panelGroup)));page.paperReadability={minimumPt:check.minimumPt,actualPt:check.metrics.minimum?check.metrics.minimum/(page.width/physicalW)*.75:null,preserved:true,overflow:false};}
 return page;
}
