export function orderedDevices(project){
 const order=new Map((project.layout?.order||[]).map((id,i)=>[id,i]));
 return (project.devices||[]).slice().sort((a,b)=>(order.get(a.id)??1e6)-(order.get(b.id)??1e6));
}
export function moveDevice(project,id,before){
 project.layout||={};const order=orderedDevices(project).map(d=>d.id).filter(v=>v!==id);
 const at=before==null?order.length:order.indexOf(before);order.splice(at<0?order.length:at,0,id);project.layout.order=order;
}
export function moveStep(project,id,step){
 const ids=orderedDevices(project).map(d=>d.id),i=ids.indexOf(id),j=i+step;
 if(i<0||j<0||j>=ids.length)return;
 [ids[i],ids[j]]=[ids[j],ids[i]];project.layout||={};project.layout.order=ids;
}
export function cleanLayout(raw,ids){
 const p=raw&&typeof raw==='object'?raw:{},known=new Set(ids),used=new Set(),pages=[];
 for(const v of Array.isArray(p.corePages)?p.corePages.slice(0,100):[]){
  if(!v||typeof v.id!=='string'||used.has(v.id))continue;used.add(v.id);
  pages.push({id:v.id.slice(0,120),name:String(v.name||'Core Network').slice(0,80),devices:[...new Set((Array.isArray(v.devices)?v.devices:[]).filter(id=>known.has(id)))]});
 }
 return {order:[...new Set((Array.isArray(p.order)?p.order:[]).filter(id=>known.has(id)))],corePages:pages,
  coreExclude:[...new Set((Array.isArray(p.coreExclude)?p.coreExclude:[]).filter(id=>known.has(id)))],includeAPs:p.includeAPs===true};
}
