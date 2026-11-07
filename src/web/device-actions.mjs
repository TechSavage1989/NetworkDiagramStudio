import {cleanLayout} from './layout.mjs';

export function withoutDevices(project,ids){
 const removed=new Set(ids),devices=project.devices.filter(d=>!removed.has(d.id)),links=project.links.filter(l=>!removed.has(l.a)&&!removed.has(l.b));
 const layout=cleanLayout(project.layout,devices.map(d=>d.id));
 for(const link of project.links)for(const [id,other,port] of [[link.a,link.b,link.bp],[link.b,link.a,link.ap]])if(removed.has(id)&&!removed.has(other)&&project.devices.find(d=>d.id===id)?.kind==='handoff')layout.suppressedHandoffs.push('handoff:'+other+'/'+port);
 layout.corePages=layout.corePages.filter(page=>page.devices.length);
 for(const key of Object.keys(layout.drawingEdits))if([...removed].some(id=>key.includes('|device|'+id+'|')||key.endsWith('|title|'+id)||key.endsWith('|detail|'+id)))delete layout.drawingEdits[key];
 return {...project,devices,links,layout};
}
