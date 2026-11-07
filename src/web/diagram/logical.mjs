import {C,fresh,label,rect} from './scene.mjs';
import {wrapPortText} from '../port-table.mjs';
import {applyDrawingEdits} from '../drawing-edits.mjs';

const COLS=[['Record',156],['Name / destination',364],['Address / next hop / type',340],['Egress / members',268]];
const TOP=160,BOTTOM=906,NAME='VLANs and Routing';
const hash=value=>{let n=14695981039346656037n;for(const c of value)n=BigInt.asUintN(64,(n^BigInt(c.codePointAt(0)))*1099511628211n);return n.toString(36);};
function legacyChanges(project,sections){
 const edits=project.layout?.drawingEdits||{},result=new Map();
 if(!Object.keys(edits).some(k=>/^VLANs and Routing(?: \d+)?\|text\|/.test(k)))return result;
 const columns=[['Device',250],['Record',138],['Name / destination',283],['Address / next hop / type',281],['Egress / members',176]],lines=[];
 for(const section of sections)for(const [record,values] of section.rows.entries()){
  const fields=[section.name,...values].map((v,i)=>wrapPortText(v,columns[i][1]-18,13,i===0));
  for(let line=0;line<Math.max(...fields.map(f=>f.length));line++)lines.push({section,record,values:fields.map(f=>f[line]||'')});
 }
 for(let start=0;start<lines.length;start+=23){
  const page=fresh(NAME,NAME,'Configured VLANs, interface addresses and routing entries',project);if(lines.length>23)page.name+=' '+(start/23+1);
  rect(page.items,36,174,1128,32,C.ink);let x=36;for(const [title,w] of columns){label(page.items,x+8,174,w-16,32,title,14,true,C.white);x+=w;}
  lines.slice(start,start+23).forEach((row,i)=>{rect(page.items,36,206+i*28,1128,28,i%2?C.pale:C.white);let x=36;row.values.forEach((value,j)=>{label(page.items,x+8,206+i*28,columns[j][1]-12,28,value,13,j===0);Object.assign(page.items.at(-1),{legacyCell:{section:row.section.id,record:row.record,column:j,original:value}});x+=columns[j][1];});});
  applyDrawingEdits(page,project);
  for(const item of page.items){if(!item.legacyCell||!edits[item.editKey])continue;const {section,record,column,original}=item.legacyCell,key=JSON.stringify([section,record,column]),change=result.get(key)||[];change.push({original,patch:edits[item.editKey]});result.set(key,change);}
 }
 return result;
}
export function logicalPages(project,sections){
 const pages=[],edits=project.layout?.drawingEdits||{},legacy=legacyChanges(project,sections);let page,y;
 const next=()=>{page=fresh(NAME,NAME,'Configured VLANs, interface addresses and routing entries',project);page.logicalSections=[];pages.push(page);y=TOP;};
 next();
 for(const section of sections){
  const prefix=NAME+'|device|'+hash(String(section.id)),seen=new Map();
  const rows=section.rows.map((values,record)=>{
   const identity=JSON.stringify(values.slice(0,2)),count=seen.get(identity)||0;seen.set(identity,count+1);
   const key=prefix+'|record|'+hash(identity)+'|'+count;
   const cells=values.map((value,i)=>{const editKey=key+'|cell|'+i,old=legacy.get(JSON.stringify([section.id,record,i+1]))||[],inherited={...old[0]?.patch};let prior=String(value);for(const c of old)if(c.patch.value!=null)prior=prior.replace(c.original,c.patch.value);if(old.length)inherited.value=prior;const patch=edits[editKey]||inherited,size=patch.size||13,w=patch.w||COLS[i][1]-18,bold=patch.bold??(i===0),text=patch.value??value;return {value:String(text),editKey,size,w,bold,lines:wrapPortText(text,w,size,bold),height:patch.h||0,patch};});
   const lineHeight=Math.max(...cells.map(c=>c.size*1.25)),lines=Math.max(...cells.map(c=>c.lines.length));
   return {cells,lineHeight,lines,height:Math.max(28,lines*lineHeight+12,...cells.map(c=>c.height+12))};
  });
  const headingHeight=part=>{const key=prefix+'|heading|'+part,patch=edits[key]||{},value=patch.value??(section.name+(part?' (continued)':'')),size=patch.size||18,w=patch.w||1128;return {key,value,size,w,height:Math.max(32,patch.h||0,wrapPortText(value,w,size,true).length*size*1.25+10)};};
  let part=0,at=0,offset=0;
  const full=headingHeight(0).height+32+rows.reduce((n,r)=>n+r.height,0);
  if(y>TOP&&y+full>BOTTOM&&full<=BOTTOM-TOP)next();
  while(at<rows.length){
   const head=headingHeight(part),minimum=head.height+32+(offset===0&&rows[at].height<=BOTTOM-TOP-head.height-32?rows[at].height:rows[at].lineHeight+12);
   if(minimum>BOTTOM-TOP)throw Error('This device heading or record needs more room on the VLANs and Routing page.');
   if(y+minimum>BOTTOM)next();
   const start=y;
   label(page.items,36,y,head.w,head.height-8,head.value,head.size,true,C.teal);Object.assign(page.items.at(-1),{editKey:head.key,logicalDeviceId:section.id,logicalHeading:true,full:true});y+=head.height;
   rect(page.items,36,y,1128,32,C.ink);let x=36;
   COLS.forEach(([name,width],i)=>{label(page.items,x+8,y,width-16,32,name,14,true,C.white);page.items.at(-1).editKey=prefix+'|columns|'+part+'|'+i;x+=width;});y+=32;
   let painted=0;
   while(at<rows.length){
    const row=rows[at],remaining=row.lines-offset,whole=offset===0&&row.height<=BOTTOM-y;
    if(!whole&&offset===0&&row.height<=BOTTOM-TOP-head.height-32)break;
    const take=whole?remaining:Math.min(remaining,Math.floor((BOTTOM-y-12)/row.lineHeight));if(take<1)break;
    const height=whole?row.height:take*row.lineHeight+12;rect(page.items,36,y,1128,height,at%2?C.pale:C.white);x=36;
    row.cells.forEach((cell,i)=>{const text=whole?cell.value:cell.lines.slice(offset,offset+take).join('\n'),editKey=cell.editKey+(!whole?'|continued|'+offset:'');label(page.items,x+8,y+6,cell.w,height-12,text,cell.size,cell.bold);const style={...cell.patch};delete style.value;delete style.h;if(!whole){delete style.x;delete style.y;}Object.assign(page.items.at(-1),style,{editKey,logicalDeviceId:section.id,logicalRecord:at,logicalColumn:i,full:true});x+=COLS[i][1];});
    y+=height;painted++;offset+=take;if(offset>=row.lines){at++;offset=0;}
   }
   page.logicalSections.push({deviceId:section.id,name:section.name,continued:part>0,y:start,h:y-start});
   part++;y+=18;if(at<rows.length)next();
   if(!painted)throw Error('This VLAN or route record needs more room on its page.');
  }
 }
 if(!sections.length){rect(page.items,36,168,1128,88,C.pale);label(page.items,57,187,1082,48,'No VLAN or route records were supplied.',18,false,C.muted);}
 return pages;
}
