export function cleanPageNumbers(raw){const p=raw&&typeof raw==='object'?raw:{};return {show:p.show!==false,start:Number.isInteger(p.start)&&p.start>=0&&p.start<=9999?p.start:1,pad:Number.isInteger(p.pad)&&p.pad>=1&&p.pad<=5?p.pad:2,format:typeof p.format==='string'&&p.format.length<=100?p.format:'{page} / {last}'};}
export function pageNumber(raw,index,count){const p=cleanPageNumbers(raw);if(!p.show)return null;const values={page:p.start+index,last:p.start+count-1,total:count};return p.format.replace(/\{(page|last|total)\}/g,(_,key)=>String(values[key]).padStart(p.pad,'0'));}

// Scene units are 96 per inch in SVG, printing and native Visio.
export const paperSizes=[['original','Original drawing',317.5,257.96875],['letter','Letter',215.9,279.4],['legal','Legal',215.9,355.6],['tabloid','Tabloid / Ledger',279.4,431.8],['a5','A5',148,210],['a4','A4',210,297],['a3','A3',297,420],['a2','A2',420,594],['a1','A1',594,841],['custom','Custom',297,420]];
export const pageFamilies=[['core','Core network'],['ports','Port maps'],['wireless','Wireless connections'],['logical','VLANs and routing'],['trunk','Trunk VLANs'],['switchports','Switchport reports']];
export function cleanPaper(raw){const p=raw&&typeof raw==='object'?raw:{},preset=p.preset==='dynamic'||paperSizes.some(v=>v[0]===p.preset)?p.preset:'dynamic';return {preset,orientation:p.orientation==='portrait'?'portrait':'landscape',widthMm:Number.isFinite(+p.widthMm)&&+p.widthMm>=148&&+p.widthMm<=1500?+p.widthMm:297,heightMm:Number.isFinite(+p.heightMm)&&+p.heightMm>=148&&+p.heightMm<=1500?+p.heightMm:420};}
export function cleanPageSetup(raw){
 const p=raw&&typeof raw==='object'?raw:{},visible=p.visible&&typeof p.visible==='object'?p.visible:{},groups=visible.groups&&typeof visible.groups==='object'?visible.groups:{},individual=visible.pages&&typeof visible.pages==='object'?visible.pages:{};
 const safe=name=>typeof name==='string'&&name.length>0&&name.length<=300&&!['__proto__','prototype','constructor'].includes(name);
 return {
  default:cleanPaper(p.default),
  overrides:Object.fromEntries(pageFamilies.filter(([key])=>p.overrides?.[key]).map(([key])=>[key,cleanPaper(p.overrides[key])])),
  printPaper:p.printPaper&&p.printPaper.preset!=='dynamic'?cleanPaper(p.printPaper):null,
  visible:{fitMode:visible.fitMode==='preserve'?'preserve':'optimize',default:cleanPaper(visible.default),groups:Object.fromEntries(pageFamilies.filter(([key])=>groups[key]).map(([key])=>[key,cleanPaper(groups[key])])),pages:Object.fromEntries(Object.entries(individual).filter(([name])=>safe(name)).slice(0,500).map(([name,paper])=>[name,cleanPaper(paper)]))}
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
 return setup.visible.pages[page?.name]||setup.visible.groups[family]||setup.visible.default;
}
export function paperDimensions(paper){
 const item=cleanPaper(paper);
 if(item.preset==='dynamic')return null;
 const row=paperSizes.find(([name])=>name===item.preset);
 const pair=item.preset==='custom'?[item.widthMm,item.heightMm]:row.slice(2);
 const short=Math.min(...pair),long=Math.max(...pair),[widthMm,heightMm]=item.orientation==='portrait'?[short,long]:[long,short];
 return {widthMm,heightMm,ratio:widthMm/heightMm};
}
export function fitVisiblePage(page,project){
 const paper=visiblePagePaper(project,page),dimensions=paperDimensions(paper);
 if(!dimensions)return page;
 const W=page.width,H=page.height,ratio=dimensions.ratio;
 // Expand only the otherwise empty margin. No object or port coordinates are
 // transformed, so drag edits, socket glue, and page numbering retain identity.
 const width=Math.max(W,H*ratio),height=Math.max(H,W/ratio);
 page.originX=(page.originX||0)-(width-W)/2;
 page.originY=(page.originY||0)-(height-H)/2;
 page.width=width;page.height=height;
 page.widthMm=width*25.4/96;page.heightMm=height*25.4/96;
 page.visiblePaper=paper;
 page.printPaper=cleanPageSetup(project?.layout?.pageSetup).printPaper||paper;
 return page;
}
