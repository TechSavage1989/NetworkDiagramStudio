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
 for(const [id,port] of [[link.a,link.ap],[link.b,link.bp]]){
  const key=portKey(project,id,port);
  if(project.links.some((l,i)=>i!==except&&[[l.a,l.ap],[l.b,l.bp]].some(([d,p])=>d===id&&portKey(project,d,p)===key)))throw Error('Port '+port+' is already connected. Choose an unused port or edit its existing connection.');
 }
}
