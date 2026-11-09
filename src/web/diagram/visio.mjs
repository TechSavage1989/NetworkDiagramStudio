import {labelBackingItems} from './label-backings.mjs';
import {normalizedPage} from './dynamic-page.mjs';
import {cleanNativeArt} from '../native-art.mjs';
import {xml,round,textLayout} from './scene.mjs';
import {zip} from './zip.mjs';
const main='http://schemas.microsoft.com/office/visio/2012/main',doc='http://schemas.openxmlformats.org/officeDocument/2006/relationships',vr='http://schemas.microsoft.com/visio/2010/relationships/',pr='http://schemas.openxmlformats.org/package/2006/relationships';
const head='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',ns=' xmlns="'+main+'" xmlns:r="'+doc+'"';
const attr=(k,v)=>v==null?'':' '+k+'="'+xml(v)+'"';
const cell=(n,v,f,u)=>'<Cell N="'+n+'" V="'+xml(typeof v==='number'?round(v):v)+'"'+attr('U',u)+attr('F',f)+'/>';
const relation=i=>'<Rel r:id="rId'+i+'"/>';
function rels(rows){return head+'<Relationships xmlns="'+pr+'">'+rows.map(([i,t,target])=>'<Relationship Id="rId'+i+'" Type="'+t+'" Target="'+xml(target)+'"/>').join('')+'</Relationships>';}
const inch=n=>n/96;
// V is always cached in Visio's internal inches, including typography cells.
// Keep the point-valued formula explicit when Visio recalculates the document.
const lineWeight=pixels=>cell('LineWeight',inch(pixels),round(pixels*72/96)+' pt','PT');
function box(x,y,w,h,H){return cell('PinX',inch(x+w/2))+cell('PinY',inch(H-y-h/2))+size(w,h);}
function size(w,h){return cell('Width',inch(w))+cell('Height',inch(h))+cell('LocPinX',inch(w/2),'Width*0.5')+cell('LocPinY',inch(h/2),'Height*0.5')+cell('Angle',0);}
function xyRow(ix,t,x,y,fx,fy,a){return '<Row IX="'+ix+'" T="'+t+'">'+cell('X',x,fx)+cell('Y',y,fy)+(a==null?'':cell('A',a))+'</Row>';}
// A hidden outline draws nothing unless filled: connector text on its own
// cable needs its white background painted, still without a border.
function outline(w,h,hidden=false,filled=false){
  const uv=[[0,0],[1,0],[1,1],[0,1],[0,0]];
  return '<Section N="Geometry" IX="0">'+cell('NoFill',hidden&&!filled?1:0)+cell('NoLine',hidden?1:0)+uv.map(([x,y],i)=>xyRow(i+1,i?'LineTo':'MoveTo',inch(x*w),inch(y*h),'Width*'+x,'Height*'+y)).join('')+'</Section>';
}
function ellipseOutline(w,h){
  return '<Section N="Geometry" IX="0"><Row IX="1" T="Ellipse">'+cell('X',inch(w/2),'Width*0.5')+cell('Y',inch(h/2),'Height*0.5')+cell('A',inch(w),'Width')+cell('B',inch(h/2),'Height*0.5')+cell('C',inch(w/2),'Width*0.5')+cell('D',inch(h),'Height')+'</Row></Section>';
}
function rectShape(i,id,H,masterChild,relative){
  const transform=relative||box(i.x,i.y,i.w,i.h,H).replace(cell('Angle',0),cell('Angle',i.angle||0));
  return '<Shape ID="'+id+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0"'+attr('Name',i.name)+attr('MasterShape',masterChild)+'>'+transform+(relative&&i.angle?cell('Angle',i.angle):'')+
    cell('LinePattern',i.stroke==='none'?0:1)+cell('LineColor',i.stroke==='none'?'#FFFFFF':i.stroke)+lineWeight(i.weight||1)+
    cell('FillPattern',i.fill==='none'?0:1)+cell('FillForegnd',i.fill==='none'?'#FFFFFF':i.fill)+cell('FillForegndTrans',1-(i.opacity??1))+(i.type==='ellipse'?ellipseOutline(i.w,i.h):outline(i.w,i.h))+'</Shape>';
}
function vectorShape(i,id,H){
  const points=i.commands.filter(command=>command.length===3).map(command=>command.slice(1)),x=Math.min(...points.map(point=>point[0])),y=Math.min(...points.map(point=>point[1])),w=Math.max(.001,Math.max(...points.map(point=>point[0]))-x),h=Math.max(.001,Math.max(...points.map(point=>point[1]))-y);let first=null,row=0;
  const geometry=i.commands.map(([op,px,py])=>{if(op==='Z'){if(!first)return '';[px,py]=first;op='L';}else if(op==='M')first=[px,py];return xyRow(++row,op==='M'?'MoveTo':'LineTo',inch(px-x),inch(h-py+y),'Width*'+round((px-x)/w),'Height*'+round((h-py+y)/h));}).join('');
  return '<Shape ID="'+id+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0"'+attr('Name',i.name)+'>'+box(x,y,w,h,H)+cell('LinePattern',!i.stroke||i.stroke==='none'?0:1)+cell('LineColor',!i.stroke||i.stroke==='none'?'#FFFFFF':i.stroke)+lineWeight(i.weight||1)+cell('FillPattern',!i.fill||i.fill==='none'?0:1)+cell('FillForegnd',!i.fill||i.fill==='none'?'#FFFFFF':i.fill)+cell('FillForegndTrans',1-(i.opacity??1))+'<Section N="Geometry" IX="0">'+geometry+'</Section></Shape>';
}
function captionOutline(i){
  if(!i.backingPieces)return outline(i.w,i.h,true,!!i.background);
  if(!i.backingPieces.length)return outline(i.w,i.h,true,false);
  let row=0;
  // Keep cutouts inside the editable text shape, so native movement, rotation
  // and resizing carry the backing together with its caption.
  return '<Section N="Geometry" IX="0">'+cell('NoFill',0)+cell('NoLine',1)+i.backingPieces.map(({x,y,w,h})=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]].map(([px,py],n)=>xyRow(++row,n?'LineTo':'MoveTo',inch(px),inch(i.h-py),'Width*'+round(px/i.w),'Height*'+round(1-py/i.h))).join('')).join('')+'</Section>';
}
function textShape(i,id,H,masterChild,relative){
  const {lines,size:fontSize}=textLayout(i),shown=lines.join('\n');
  const transform=relative||box(i.x,i.y,i.w,i.h,H).replace(cell('Angle',0),cell('Angle',i.angle||0));
  return '<Shape ID="'+id+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0"'+attr('Name',i.name)+attr('MasterShape',masterChild)+'>'+transform+(relative&&i.angle?cell('Angle',i.angle):'')+cell('LinePattern',0)+cell('FillPattern',i.background?1:0)+(i.background?cell('FillForegnd',i.background):'')+
    ['LeftMargin','RightMargin','TopMargin','BottomMargin'].map(n=>cell(n,0)).join('')+cell('VerticalAlign',1)+
    '<Section N="Character"><Row IX="0">'+cell('Font','Calibri')+cell('Size',inch(fontSize))+cell('Color',i.color)+cell('Style',i.bold?1:0)+'</Row></Section>'+
    '<Section N="Paragraph"><Row IX="0">'+cell('HorzAlign',i.align==='right'?2:i.align==='center'?1:0)+'</Row></Section>'+captionOutline(i)+
    '<Text><cp IX="0"/><pp IX="0"/>'+xml(shown)+'</Text></Shape>';
}
function connectionRows(ports,w,h,keys){
  if(!keys.length)return '';
  return '<Section N="Connection">'+keys.map((k,i)=>{
    const p=ports[k];if(!p)return '';
    return '<Row IX="'+i+'" T="Connection">'+cell('X',inch(w*p[0]),'Width*'+round(p[0]))+cell('Y',inch(h*(1-p[1])),'Height*'+round(1-p[1]))+cell('DirX',0)+cell('DirY',0)+cell('Type',0)+cell('Prompt',k)+'</Row>';
  }).join('')+'</Section>';
}
function childXform(child,w,h,owner){
  const parent='Sheet.'+owner+'!',cx=child.x+child.w/2,cy=1-child.y-child.h/2;
  return cell('PinX',inch(w*cx),parent+'Width*'+round(cx))+cell('PinY',inch(h*cy),parent+'Height*'+round(cy))+
    cell('Width',inch(w*child.w),parent+'Width*'+round(child.w))+cell('Height',inch(h*child.h),parent+'Height*'+round(child.h))+
    cell('LocPinX',inch(w*child.w/2),'Width*0.5')+cell('LocPinY',inch(h*child.h/2),'Height*0.5');
}
function group(i,id,H,m,allocate,rid,asMaster=false,mount=''){
  // Masters stay in local unrotated coordinates; only page instances rotate.
  const xform=(mount||box(asMaster?0:i.x,asMaster?0:i.y,i.w,i.h,asMaster?i.h:H)).replace(cell('Angle',0),cell('Angle',asMaster?0:i.angle||0));
  let children='';
  if(i.asset?.native){
    const art=cleanNativeArt(i.asset.native);let nativeIndex=6;
    children=art.paths.map(p=>{
      const child=allocate();let row=0,start=null;
      const geometry=p.commands.map(([op,x,y])=>{
        if(op==='Z'){if(!start)return '';[x,y]=start;op='L';}else if(op==='M')start=[x,y];
        return xyRow(++row,op==='M'?'MoveTo':'LineTo',inch(x*i.w),inch((1-y)*i.h),'Width*'+round(x),'Height*'+round(1-y));
      }).join('');
      return '<Shape ID="'+child+'" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0"'+attr('Name',p.name)+attr('MasterShape',asMaster?null:nativeIndex++)+'>'+childXform({x:0,y:0,w:1,h:1},i.w,i.h,id)+cell('LinePattern',p.stroke==='none'?0:1)+cell('LineColor',p.stroke==='none'?'#FFFFFF':p.stroke)+lineWeight(p.weight*i.w)+cell('FillPattern',p.fill==='none'?0:1)+cell('FillForegnd',p.fill==='none'?'#FFFFFF':p.fill)+'<Section N="Geometry" IX="0">'+geometry+'</Section></Shape>';
    }).join('');
    children+=art.texts.map(t=>{
      const size=t.size*i.w,tw=Math.max(t.w*i.w,size),th=size*1.4;
      return textShape({x:t.x*i.w-tw/2,y:t.y*i.h-th/2,w:tw,h:th,value:t.text,size,bold:t.bold||false,color:t.color,align:t.align||'center',angle:t.angle,art:true},allocate(),i.h,asMaster?null:nativeIndex++,childXform({x:t.x-tw/(2*i.w),y:t.y-th/(2*i.h),w:tw/i.w,h:th/i.h},i.w,i.h,id));
    }).join('');
  }else if(i.asset){
    const child=allocate(),fx=childXform({x:0,y:0,w:1,h:1},i.w,i.h,id);
    children='<Shape ID="'+child+'" Type="Foreign" LineStyle="0" FillStyle="0" TextStyle="0"'+attr('MasterShape',asMaster?null:6)+'>'+fx+
      cell('ImgOffsetX',0)+cell('ImgOffsetY',0)+cell('ImgWidth',inch(i.w),'Width')+cell('ImgHeight',inch(i.h),'Height')+
      cell('LinePattern',0)+cell('FillPattern',0)+outline(i.w,i.h)+
      '<ForeignData ForeignType="Bitmap" CompressionType="'+(m.media.ext==='png'?'PNG':'JPEG')+'" CompressionLevel="1">'+relation(rid)+'</ForeignData></Shape>';
  }else{
    children=i.children.map((c,j)=>{
      const ci={...c,x:c.x*i.w,y:c.y*i.h,w:c.w*i.w,h:c.h*i.h};
      return c.type==='text'?textShape(ci,allocate(),i.h,asMaster?null:6+j,childXform(c,i.w,i.h,id)):rectShape(ci,allocate(),i.h,asMaster?null:6+j,childXform(c,i.w,i.h,id));
    }).join('');
  }
  return '<Shape ID="'+id+'" Type="Group" LineStyle="0" FillStyle="0" TextStyle="0"'+attr('Name',asMaster?m.title:i.name)+attr('NameU',asMaster?'Panel.'+m.id:'Device.'+id)+attr('Master',asMaster?null:m.id)+'>'+xform+cell('SelectMode',0)+cell('HideText',1)+
    connectionRows(asMaster?m.ports:i.ports,i.w,i.h,m.keys)+'<Shapes>'+children+'</Shapes></Shape>';
}
function lineStyleKey(line){
  return JSON.stringify([line.linkType,(line.color||line.fill).toUpperCase(),line.opacity??1,line.sampleWeight??line.weight]);
}
function nativeLineStyle(id,line){
  return '<StyleSheet ID="'+id+'" NameU="CableStyle.'+id+'"'+attr('Name',line.linkType+' ('+round((line.sampleWeight??line.weight)*.75)+' pt)')+'>'+
    cell('EnableLineProps',1)+cell('LineColor',(line.color||line.fill).toUpperCase())+cell('LineColorTrans',1-(line.opacity??1))+
    lineWeight(line.sampleWeight??line.weight)+cell('LinePattern',1)+cell('BeginArrow',0)+cell('EndArrow',0)+'</StyleSheet>';
}
function connector(i,id,H,byKey,connects,styleId,sampleId){
  const [x0,y0]=i.points[0], [xn,yn]=i.points.at(-1),w=xn-x0,h=y0-yn;
  let data=cell('PinX',inch((x0+xn)/2),'(BeginX+EndX)*0.5')+cell('PinY',inch(H-(y0+yn)/2),'(BeginY+EndY)*0.5')+
    cell('Width',inch(w),'GUARD(EndX-BeginX)')+cell('Height',inch(h),'GUARD(EndY-BeginY)')+cell('LocPinX',inch(w/2),'Width*0.5')+cell('LocPinY',inch(h/2),'Height*0.5')+cell('Angle',0);
  for(const [end,a,part] of [['Begin',i.from,9],['End',i.to,12]]){
    if(!a){data+=cell(end+'X',inch(end==='Begin'?x0:xn))+cell(end+'Y',inch(H-(end==='Begin'?y0:yn)));continue;}
    const target=byKey.get(a.device),ix=target.m.keys.indexOf(a.port);if(ix<0)throw Error('Missing Visio attachment: '+a.port);
    const ref='Sheet.'+target.id+'!Connections.',f='PAR(PNT('+ref+'X'+(ix+1)+','+ref+'Y'+(ix+1)+'))';
    data+=cell(end+'X',inch(a.x),f)+cell(end+'Y',inch(H-a.y),f)+cell(end==='Begin'?'BegTrigger':'EndTrigger',2,'_XFTRIGGER(Sheet.'+target.id+'!EventXFMod)');
    connects.push('<Connect FromSheet="'+id+'" FromCell="'+end+'X" FromPart="'+part+'" ToSheet="'+target.id+'" ToCell="Connections.X'+(ix+1)+'" ToPart="'+(100+ix)+'"/>');
  }
  data+=cell('ObjType',2)+cell('GlueType',2)+cell('ConFixedCode',1)+cell('ShapeRouteStyle',1)+cell('ConLineJumpCode',i.legendEntry?4:0)+cell('ConLineJumpStyle',1)+cell('FillPattern',0);
  if(sampleId){
    const ref='Sheet.'+sampleId+'!';
    data+=cell('LineColor',i.color.toUpperCase(),ref+'LineColor')+cell('LineColorTrans',1-(i.opacity??1),ref+'LineColorTrans')+
      cell('LineWeight',inch(i.weight),ref+'LineWeight','PT')+cell('LinePattern',1,ref+'LinePattern');
  }
  // The planner's jumps are written into the connector geometry, as Visio
  // saves its own routed connectors, so they show on open. Each jump is an
  // EllipticalArcTo through its apex: a semicircle for one crossing, a flatter
  // bridge over a tight bundle. Visio replaces the geometry (and draws its own
  // jumps) only when it reroutes the connector.
  const commands=i.commands?.length&&!i.legendEntry?i.commands:i.points.map((p,j)=>[j?'L':'M',...p]);
  let previous=null;
  const geom=commands.map(([t,x,y,ex,ey],j)=>{
    const end=j===commands.length-1,follow=(d,total,dim)=>end?dim:Math.abs(d-total)<Math.abs(d)?dim+(d>=total?'+':'')+round(inch(d-total)):undefined;
    if(t==='A'&&previous){
      const chord=Math.hypot(ex-previous[0],ey-previous[1])/2,apex=Math.hypot(x-(previous[0]+ex)/2,y-(previous[1]+ey)/2)||chord,vertical=Math.abs(ey-previous[1])>Math.abs(ex-previous[0]);
      const ratio=vertical?apex/chord:chord/apex,ox=ex-x0,oy=y0-ey;previous=[ex,ey];
      return '<Row IX="'+(j+1)+'" T="EllipticalArcTo">'+cell('X',inch(ox),follow(ox,w,'Width'))+cell('Y',inch(oy),follow(oy,h,'Height'))+cell('A',inch(x-x0))+cell('B',inch(y0-y))+cell('C',0)+cell('D',round(ratio))+'</Row>';
    }
    const ox=x-x0,oy=y0-y;previous=[x,y];
    return xyRow(j+1,t==='M'?'MoveTo':'LineTo',inch(ox),inch(oy),follow(ox,w,'Width'),follow(oy,h,'Height'));
  }).join('');
  return '<Shape ID="'+id+'" NameU="'+(i.legendEntry?'CableLegend.':'Connector.')+id+'" Name="'+xml(i.name)+'" Type="Shape" LineStyle="'+styleId+'" FillStyle="0" TextStyle="0">'+data+'<Section N="Geometry" IX="0">'+cell('NoFill',1)+geom+'</Section></Shape>';
}
function guid(seed){
  const chunk=n=>{let h=n;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16).padStart(8,'0');};
  const a=chunk(2166136261),b=chunk(2),c=chunk(3),d=chunk(4);
  return '{'+[a,b.slice(0,4),'5'+b.slice(5),'8'+c.slice(1,4),c.slice(4)+d].join('-').toUpperCase()+'}';
}
function imageBytes(uri){const str=atob(uri.slice(uri.indexOf(',')+1));return Uint8Array.from(str,c=>c.charCodeAt(0));}
// Native Visio recomputes arc jumps from the editable orthogonal connector geometry.
// https://learn.microsoft.com/en-us/office/client-developer/visio/linejumpcode-cell-page-layout-section
function sheet(w,h,jumps=false,paper=null,fitPrint=false){return '<PageSheet LineStyle="0" FillStyle="0" TextStyle="0">'+cell('PageWidth',inch(w))+cell('PageHeight',inch(h))+cell('PageScale',1)+cell('DrawingScale',1)+cell('DrawingSizeType',0)+cell('DrawingScaleType',0)+(paper?cell('PrintPageOrientation',paper.orientation==='portrait'?1:2)+(fitPrint?cell('OnPage',1)+cell('PagesX',1)+cell('PagesY',1):'')+({letter:1,tabloid:3,legal:5,a3:8,a4:9,a5:11,a2:66}[paper.preset]?cell('PaperKind',{letter:1,tabloid:3,legal:5,a3:8,a4:9,a5:11,a2:66}[paper.preset]):''):'')+(jumps?cell('LineJumpCode',4)+cell('LineJumpStyle',1)+cell('LineToLineX',inch(14))+cell('LineToLineY',inch(14))+cell('LineJumpFactorX',.5)+cell('LineJumpFactorY',.5):'')+'</PageSheet>';}
export const exportVisio=(project,pages)=>writePackage(pages,false);
export const exportStencil=(project,pages)=>writePackage(pages,true);
function writePackage(pages,stencil){
  if(!Array.isArray(pages)||!pages.length)throw Error('Build at least one diagram page before exporting.');
  const parts=Object.create(null), records=new Map(),media=new Map(),overrides=[];
  function put(path,body,type){parts[path]=body;if(type)overrides.push([path,type]);}
  for(const p of pages)for(const i of p.items)if(i.type==='device'&&(!stencil||i.kind!=='handoff')){
    let m=records.get(i.masterKey);
    if(!m){
      m={id:records.size+1,first:i,title:i.asset?.name||[i.model,i.kind==='plug'?i.name:i.kind+' schematic'].filter(Boolean).join(' '),ports:Object.create(null)};records.set(i.masterKey,m);
      if(i.asset&&!i.asset.native){
        let ref=media.get(i.asset.dataUrl);
        if(!ref){
          const ext=i.asset.dataUrl.toLowerCase().startsWith('data:image/png;')?'png':'jpg';
          ref={ext,file:'image'+(media.size+1)+'.'+ext};media.set(i.asset.dataUrl,ref);put('visio/media/'+ref.file,imageBytes(i.asset.dataUrl));
        }
        m.media=ref;
      }
    }
    for(const [k,pos] of Object.entries(i.ports))if(!Object.hasOwn(m.ports,k))m.ports[k]=pos;
  }
  const masters=[...records.values()];
  if(stencil&&!masters.length)throw Error('There are no hardware shapes in this drawing.');
  const mime='application/vnd.ms-visio.'+(stencil?'stencil':'drawing');
  for(const m of masters)m.keys=Object.keys(m.ports);
  put('_rels/.rels',rels([[1,vr+'document','visio/document.xml'],[2,doc+'/custom-properties','docProps/custom.xml']]));
  put('docProps/custom.xml',head+'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="RecalcDocument"><vt:bool>true</vt:bool></property></Properties>','application/vnd.openxmlformats-officedocument.custom-properties+xml');
  const lineStyles=new Map();
  if(!stencil)for(const page of pages)for(const item of page.items){
    if(item.type!=='path'&&!(item.legendEntry&&item.type==='rect'))continue;
    const key=lineStyleKey(item);
    if(!lineStyles.has(key))lineStyles.set(key,{id:lineStyles.size+1,item});
  }
  const cableStyles=[...lineStyles.values()].map(({id,item})=>nativeLineStyle(id,item)).join('');
  put('visio/document.xml',head+'<VisioDocument'+ns+' xml:space="preserve"><DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0"/><Colors><ColorEntry IX="0" RGB="#000000"/><ColorEntry IX="1" RGB="#FFFFFF"/></Colors><FaceNames><FaceName NameU="Calibri"/><FaceName NameU="Arial"/></FaceNames><StyleSheets><StyleSheet ID="0" Name="No Style" NameU="No Style">'+cell('LinePattern',1)+cell('LineColor','#000000')+lineWeight(1)+cell('FillPattern',0)+'<Section N="Character"><Row IX="0">'+cell('Font','Calibri')+cell('Size',inch(12))+cell('Color','#16364A')+'</Row></Section></StyleSheet>'+cableStyles+'</StyleSheets><DocumentSheet NameU="TheDoc" LineStyle="0" FillStyle="0" TextStyle="0"/></VisioDocument>',mime+'.main+xml');
  put('visio/_rels/document.xml.rels',rels([[1,vr+'pages','pages/pages.xml'],...(masters.length?[[2,vr+'masters','masters/masters.xml']]:[]),...(!stencil?[[3,vr+'windows','windows.xml']]:[])]));
  if(!stencil)put('visio/windows.xml',head+'<Windows'+ns+' ClientWidth="1200" ClientHeight="975"><Window ID="0" WindowType="Drawing" WindowState="268435456" WindowLeft="0" WindowTop="0" WindowWidth="1200" WindowHeight="975" ContainerType="Page" Page="0" ViewScale="0.75" ViewCenterX="'+round(inch(pages[0].width/2))+'" ViewCenterY="'+round(inch(pages[0].height/2))+'"><ShowRulers>1</ShowRulers><ShowGrid>0</ShowGrid><ShowPageBreaks>0</ShowPageBreaks><ShowGuides>1</ShowGuides><ShowConnectionPoints>1</ShowConnectionPoints></Window></Windows>','application/vnd.ms-visio.windows+xml');
  if(masters.length){
    const rows=[];
    for(const m of masters){
      rows.push('<Master ID="'+m.id+'" NameU="Panel.'+m.id+'" Name="'+xml(m.title)+'" IsCustomNameU="1" IsCustomName="1" IconSize="1" AlignName="2" MatchByName="0" IconUpdate="1" UniqueID="'+guid('unique:'+m.first.masterKey)+'" BaseID="'+guid('base:'+m.first.masterKey)+'" PatternFlags="0" Hidden="0" MasterType="1">'+sheet(m.first.w,m.first.h)+relation(m.id)+'</Master>');
      let n=5;
      put('visio/masters/master'+m.id+'.xml',head+'<MasterContents'+ns+' xml:space="preserve"><Shapes>'+group(m.first,5,m.first.h,m,()=>++n,1,true)+'</Shapes></MasterContents>','application/vnd.ms-visio.master+xml');
      if(m.media)put('visio/masters/_rels/master'+m.id+'.xml.rels',rels([[1,doc+'/image','../media/'+m.media.file]]));
    }
    put('visio/masters/masters.xml',head+'<Masters'+ns+'>'+rows.join('')+'</Masters>','application/vnd.ms-visio.masters+xml');
    put('visio/masters/_rels/masters.xml.rels',rels(masters.map(m=>[m.id,vr+'master','master'+m.id+'.xml'])));
  }
  let pagesXml='';
  const drawingPages=stencil?[]:pages;
  drawingPages.forEach((source,index)=>{
    const normalized=normalizedPage(source),p={...normalized,items:labelBackingItems(normalized.items,{...normalized.labelBacking,nativeText:true})};
    const n=index+1,name=p.displayName||p.name;
    pagesXml+='<Page ID="'+index+'" Name="'+xml(name)+'" NameU="'+xml(name)+'" IsCustomName="1" IsCustomNameU="1" ViewScale="0.75" ViewCenterX="'+round(inch(p.width/2))+'" ViewCenterY="'+round(inch(p.height/2))+'">'+sheet(p.width,p.height,true,p.printPaper||p.paper,!!p.printPaper)+relation(n)+'</Page>';
    const rel=[],relKeys=new Map(),byKey=new Map(),connect=[];
    function relId(type,target){if(!relKeys.has(target)){relKeys.set(target,rel.length+1);rel.push([rel.length+1,type,target]);}return relKeys.get(target);}
    let seq=p.items.length;
    p.items.forEach((i,j)=>{if(i.type==='device'){const m=records.get(i.masterKey);byKey.set(i.key,{id:j+1,m});relId(vr+'master','../masters/master'+m.id+'.xml');}});
    const legendIds=new Map();
    p.items.forEach((item,j)=>{if(item.legendEntry&&item.type==='rect')legendIds.set(lineStyleKey(item),j+1);});
    const shapes=p.items.map((i,j)=>{
      if(i.type==='rect'&&i.legendEntry){
        const y=i.y+i.h/2,styleId=lineStyles.get(lineStyleKey(i)).id;
        return connector({...i,points:[[i.x,y],[i.x+i.w,y]]},j+1,p.height,byKey,connect,styleId);
      }
      if(i.type==='rect'||i.type==='ellipse')return rectShape(i,j+1,p.height);
      if(i.type==='vector')return vectorShape(i,j+1,p.height);
      if(i.type==='text')return textShape(i,j+1,p.height);
      if(i.type==='path'){const key=lineStyleKey(i);return connector(i,j+1,p.height,byKey,connect,lineStyles.get(key).id,legendIds.get(key));}
      const m=byKey.get(i.key).m;
      const rid=m.media?relId(doc+'/image','../media/'+m.media.file):null;
      let mount='';
      if(i.host){
        const host=byKey.get(i.host.device),ix=host.m.keys.indexOf(i.host.port)+1;
        const s='Sheet.'+host.id+'!',dx='('+s+'Connections.X'+ix+'-'+s+'LocPinX)',dy='('+s+'Connections.Y'+ix+'-'+s+'LocPinY)',angle=s+'Angle';
        const pf=a=>s+'Pin'+a+'+'+(a==='X'?dx+'*COS('+angle+')-'+dy+'*SIN('+angle+')':dx+'*SIN('+angle+')+'+dy+'*COS('+angle+')');
        mount=cell('PinX',inch(i.x+i.w/2),pf('X'))+cell('PinY',inch(p.height-i.y-i.h/2),pf('Y'))+size(i.w,i.h);
      }
      return group(i,j+1,p.height,m,()=>++seq,rid,false,mount);
    }).join('');
    put('visio/pages/page'+n+'.xml',head+'<PageContents'+ns+' xml:space="preserve"><Shapes>'+shapes+'</Shapes>'+(connect.length?'<Connects>'+connect.join('')+'</Connects>':'')+'</PageContents>','application/vnd.ms-visio.page+xml');
    if(rel.length)put('visio/pages/_rels/page'+n+'.xml.rels',rels(rel));
  });
  put('visio/pages/pages.xml',head+'<Pages'+ns+'>'+pagesXml+'</Pages>','application/vnd.ms-visio.pages+xml');
  if(drawingPages.length)put('visio/pages/_rels/pages.xml.rels',rels(drawingPages.map((_,i)=>[i+1,vr+'page','page'+(i+1)+'.xml'])));
  parts['[Content_Types].xml']=head+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>'+overrides.map(([k,t])=>'<Override PartName="/'+k+'" ContentType="'+t+'"/>').join('')+'</Types>';
  return zip({'[Content_Types].xml':parts['[Content_Types].xml'],...parts},mime);
}
