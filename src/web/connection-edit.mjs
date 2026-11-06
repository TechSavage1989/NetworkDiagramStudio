import {physicalPorts} from './diagram/scene.mjs';
import {deviceFaceplate} from './diagram/faceplate.mjs';
import {comparePorts} from './port-table.mjs';
const norm=v=>String(v||'').trim().toLowerCase();
export const sameConnection=(a,b)=>!!(a&&b&&(a.a===b.a&&norm(a.ap)===norm(b.ap)&&a.b===b.b&&norm(a.bp)===norm(b.bp)||a.a===b.b&&norm(a.ap)===norm(b.bp)&&a.b===b.a&&norm(a.bp)===norm(b.ap)));
function anchors(project,device){return project.stencils?.[device.stencilId]?.anchors||device.stencil?.anchors||deviceFaceplate(device)?.ports||{};}
export function connectionPorts(project,device){
 const imported=physicalPorts(device),map=anchors(project,device),byName=new Map(imported.map(p=>[norm(p.name),p])),occupied=new Set(imported.map(p=>map[p.name]?.join(',')).filter(Boolean)),prefix=imported.map(p=>p.name.match(/^(\d+\/\d+\/)\d+$/)?.[1]).find(Boolean);
 for(const [name,point] of Object.entries(map)){if(occupied.has(point.join(',')))continue;const port=prefix&&/^\d+$/.test(name)?prefix+name:name;if(!byName.has(norm(port)))byName.set(norm(port),{name:port});occupied.add(point.join(','));}
 return [...byName.values()].sort(comparePorts);
}
function portKey(project,id,port){const device=project.devices.find(d=>d.id===id);if(!device)return norm(port);const map=anchors(project,device),name=Object.keys(map).find(n=>norm(n)===norm(port)),point=map[name];return point?'jack:'+point.join(','):norm(port);}
export function checkConnection(project,link,except=-1){
 if(link.a===link.b||!String(link.ap||'').trim()||!String(link.bp||'').trim())throw Error('Select distinct devices and choose a port at both ends.');
 if(![link.a,link.b].every(id=>project.devices.some(d=>d.id===id)))throw Error('The endpoint device is unavailable.');
 for(const [id,port] of [[link.a,link.ap],[link.b,link.bp]]){
  const key=portKey(project,id,port);
  if(project.links.some((l,i)=>i!==except&&[[l.a,l.ap],[l.b,l.bp]].some(([d,p])=>d===id&&portKey(project,d,p)===key)))throw Error('Port '+port+' is already connected. Choose an unused port or edit its existing connection.');
 }
}
export function prepareConnection(project,link,index=-1,generatedDevice=null){
 if(!Number.isInteger(index)||index< -1||index>=project.links.length)throw Error('The connection is unavailable.');
 const next={...(index>=0?project.links[index]:{}),...link},devices=project.devices.slice(),links=project.links.slice();
 next.ap=String(next.ap||'').trim();next.bp=String(next.bp||'').trim();
 if(generatedDevice&&[next.a,next.b].includes(generatedDevice.id)&&!devices.some(d=>d.id===generatedDevice.id))devices.push({...generatedDevice,scopeOverride:true});
 checkConnection({...project,devices,links},next,index);
 for(const [id,name] of [[next.a,next.ap],[next.b,next.bp]]){
  const at=devices.findIndex(d=>d.id===id),device=devices[at],ports=(device.ports||[]).slice();
  if(!ports.some(p=>norm(p.name)===norm(name)))ports.push({name});
  devices[at]={...device,ports};
 }
 if(index<0)links.push(next);else links[index]=next;
 return {devices,links};
}
