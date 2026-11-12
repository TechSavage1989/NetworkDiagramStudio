import {footerAllowance,pageGeometry,fitColumns} from '../page-options.mjs';
import {C,fresh,label,rect} from './scene.mjs';
import {wrapPortText} from '../port-table.mjs';
import {applyDrawingEdits} from '../drawing-edits.mjs';

const TOP=160,NAME='VLANs and Routing';
export const logicalHash=value=>{let n=14695981039346656037n;for(const c of value)n=BigInt.asUintN(64,(n^BigInt(c.codePointAt(0)))*1099511628211n);return n.toString(36);};
export const logicalDevicePrefix=(project,id)=>(project._reportPrefix?project._reportPrefix+'|':'')+NAME+'|device|'+logicalHash(String(id));
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
export function logicalPages(project,sections,options={}){
 const name=options.name||NAME,{width:W,height:H}=pageGeometry(project,options.family||'logical'),BOTTOM=H-69+Math.min(33,footerAllowance(project)),columns=options.columns||[['Record',132],['Name / destination',330],['Address / next hop / type',302],['Egress / members / details',364]];
 const pages=[],edits=project.layout?.drawingEdits||{},legacy=name===NAME?legacyChanges(project,sections):new Map(),compact=options.compact===true,dense=compact&&options.typography==='inventory',PAD=dense?3.2:compact?6:12,FONT=dense?8.6:compact?11:13,HEAD=dense?8.6:compact?11:14,HEAD_LINE=dense?10.2:compact?14:17,MIN_ROW=dense?13.4:compact?19:28,TITLE=dense?13:compact?14:18,GAP=dense?8:compact?10:18;let page,y;
 const next=()=>{page=fresh(name,name,options.subtitle||'VLAN definitions, interfaces, bridges and routing entries',project);page.logicalSections=[];page.sourceDeviceIds=[];pages.push(page);y=TOP;};
 next();
 // Measure every device section first, then place them in order. A device
 // that does not fit in the room left on a page starts the next page whole,
 // unless a later device fits that room: it is drawn there first, so pages
 // fill up without splitting a device. Only a device taller than a page
 // continues onto another page.
 const prepare=section=>{
  const prefix=section.keyPrefix||logicalDevicePrefix(project,section.id),seen=new Map(),sourceDeviceIds=section.sourceDeviceIds||[section.id];
  const allColumns=section.columns||columns,visible=allColumns.map((_,i)=>i).filter(i=>!options.omitEmpty||i===0||section.rows.some((values,record)=>String(values[i]??'').length||legacy.has(JSON.stringify([section.id,record,i+1])))||Object.keys(edits).some(key=>key.startsWith(prefix+'|')&&key.includes('|cell|'+i))),COLS=fitColumns(visible.map(i=>allColumns[i]),W-72),HEADER=Math.max(dense?18:compact?24:32,...COLS.map(([title,width])=>wrapPortText(title,width-16,HEAD,true).length*HEAD_LINE+(dense?6:compact?8:10)));
  const rows=section.rows.map((values,record)=>{
   const identity=JSON.stringify(values.slice(0,2)),count=seen.get(identity)||0;seen.set(identity,count+1);
   const key=section.recordKeys?.[record]||prefix+'|record|'+logicalHash(identity)+'|'+count;
   const cells=visible.map((i,index)=>{const value=values[i]??'',editKey=key+'|cell|'+i,old=legacy.get(JSON.stringify([section.id,record,i+1]))||[],inherited={...old[0]?.patch};let prior=String(value);for(const c of old)if(c.patch.value!=null)prior=prior.replace(c.original,c.patch.value);if(old.length)inherited.value=prior;const patch=edits[editKey]||inherited,size=patch.size||FONT,w=patch.w||COLS[index][1]-18,bold=patch.bold??(i===0),text=patch.value??value;return {column:i,value:String(text),editKey,size,w,bold,lines:wrapPortText(text,w,size,bold),height:patch.h||0,patch};});
   const lineHeight=Math.max(...cells.map(c=>c.size*(compact?1.22:1.25))),lines=Math.max(...cells.map(c=>c.lines.length));
   return {cells,lineHeight,lines,height:Math.max(MIN_ROW,lines*lineHeight+PAD,...cells.map(c=>c.height+PAD))};
  });
  const headingHeight=part=>{const key=prefix+'|heading|'+part,patch=edits[key]||{},value=patch.value??(section.name+(part?' (continued)':'')),size=patch.size||TITLE,w=patch.w||W-72;return {key,value,size,w,height:Math.max(dense?18:compact?24:32,patch.h||0,wrapPortText(value,w,size,true).length*size*1.25+(compact?6:8))};};
  const notes=(section.notes||[]).map(note=>{const key=prefix+'|'+note.key,patch=edits[key]||{},value=patch.value??note.value,size=patch.size||FONT,w=patch.w||W-88;return {key,value,size,w,height:Math.max(size*1.2+8,patch.h||0,wrapPortText(value,w,size).length*size*1.2+8)};}),notesHeight=notes.reduce((sum,note)=>sum+note.height,0);
  const full=headingHeight(0).height+notesHeight+HEADER+rows.reduce((n,r)=>n+r.height,0);
  return {section,prefix,sourceDeviceIds,visible,COLS,HEADER,rows,headingHeight,notes,notesHeight,full};
 };
 const queue=sections.map(prepare);
 while(queue.length){
  let index=0;
  if(y>TOP&&y+queue[0].full>BOTTOM&&queue[0].full<=BOTTOM-TOP){const filler=queue.findIndex(entry=>y+entry.full<=BOTTOM);if(filler>0)index=filler;else next();}
  const [{section,prefix,sourceDeviceIds,visible,COLS,HEADER,rows,headingHeight,notes,notesHeight}]=queue.splice(index,1);
  let part=0,at=0,offset=0;
  while(at<rows.length){
   const head=headingHeight(part),minimum=head.height+notesHeight+HEADER+(offset===0&&rows[at].height<=BOTTOM-TOP-head.height-notesHeight-HEADER?rows[at].height:rows[at].lineHeight+PAD);
   if(minimum>BOTTOM-TOP)throw Error('This device heading or record needs more room on the VLANs and Routing page.');
   if(y+minimum>BOTTOM)next();
   const start=y;
   label(page.items,36,y,head.w,head.height-8,head.value,head.size,true,C.teal);Object.assign(page.items.at(-1),{editKey:head.key,logicalDeviceId:section.id,logicalSourceDeviceIds:sourceDeviceIds,logicalHeading:true,full:true});y+=head.height;
   for(const note of notes){label(page.items,44,y+4,note.w,note.height-8,note.value,note.size,false,C.muted);Object.assign(page.items.at(-1),{editKey:note.key,logicalDeviceId:section.id,logicalSourceDeviceIds:sourceDeviceIds,logicalProfile:true,full:true});y+=note.height;}
   rect(page.items,36,y,W-72,HEADER,C.ink);let x=36;
   COLS.forEach(([name,width],i)=>{label(page.items,x+8,y,width-16,HEADER,name,HEAD,true,C.white);Object.assign(page.items.at(-1),{editKey:prefix+'|columns|'+part+'|'+visible[i]},compact?{compactTable:true}:{});x+=width;});y+=HEADER;
   let painted=0;
   while(at<rows.length){
    const row=rows[at],remaining=row.lines-offset,whole=offset===0&&row.height<=BOTTOM-y;
    if(!whole&&offset===0&&row.height<=BOTTOM-TOP-head.height-notesHeight-HEADER)break;
    const take=whole?remaining:Math.min(remaining,Math.floor((BOTTOM-y-PAD)/row.lineHeight));if(take<1)break;
    const height=whole?row.height:take*row.lineHeight+PAD;rect(page.items,36,y,W-72,height,at%2?C.pale:C.white);x=36;
    row.cells.forEach((cell,i)=>{const text=whole?cell.value:cell.lines.slice(offset,offset+take).join('\n'),editKey=cell.editKey+(!whole?'|continued|'+offset:'');label(page.items,x+8,y+PAD/2,cell.w,height-PAD,text,cell.size,cell.bold);const style={...cell.patch};delete style.value;delete style.h;if(!whole){delete style.x;delete style.y;}Object.assign(page.items.at(-1),style,{editKey,logicalDeviceId:section.id,logicalSourceDeviceIds:sourceDeviceIds,logicalRecord:at,logicalColumn:cell.column,full:true},compact?{compactTable:true}:{});x+=COLS[i][1];});
    y+=height;painted++;offset+=take;if(offset>=row.lines){at++;offset=0;}
   }
   page.logicalSections.push({deviceId:section.id,sourceDeviceIds,name:section.name,shared:section.shared===true,continued:part>0,y:start,h:y-start});page.sourceDeviceIds=[...new Set([...page.sourceDeviceIds,...sourceDeviceIds])];
   part++;y+=GAP;if(at<rows.length)next();
   if(!painted)throw Error('This VLAN or route record needs more room on its page.');
  }
  }
 if(!sections.length){rect(page.items,36,168,W-72,88,C.pale);label(page.items,57,187,W-118,48,'No VLAN or route records were supplied.',18,false,C.muted);}
 return pages;
}
