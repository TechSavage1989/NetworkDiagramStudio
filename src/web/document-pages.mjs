// Which devices share a VLANs and Routing page or a Port Inventory page.
// By default every switch (or other device with records) has its own page and
// the members of one stack (layout.deviceStacks) share one. layout.documentPages
// holds the user's choices per family: { logical: { id: anchorId }, inventory:
// {...} }, where a device joins the page of its anchor device and an anchor
// equal to the device itself keeps it on its own page (also out of its stack's).
export const DOCUMENT_PAGE_FAMILIES=['logical','inventory'];
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=200;

export function cleanDocumentPages(raw,ids){
 const known=ids?new Set(ids):null,out={};
 for(const family of DOCUMENT_PAGE_FAMILIES){
  const map=raw&&typeof raw==='object'?raw[family]:null;if(!map||typeof map!=='object'||Array.isArray(map))continue;
  const clean={};
  for(const [id,anchor] of Object.entries(map).slice(0,2000))if(validId(id)&&validId(anchor)&&(!known||known.has(id)&&known.has(anchor)))clean[id]=anchor;
  if(Object.keys(clean).length)out[family]=clean;
 }
 return Object.keys(out).length?out:undefined;
}

// The device a stack's page is named after: its lowest-numbered member.
function stackAnchors(project){
 const anchors=new Map();
 for(const stack of Array.isArray(project.layout?.deviceStacks)?project.layout.deviceStacks:[]){
  const members=(stack.members||[]).filter(member=>validId(member.deviceId)).sort((a,b)=>a.number-b.number);
  for(const member of members)anchors.set(member.deviceId,members[0].deviceId);
 }
 return anchors;
}

// The device whose page `id` is drawn on, for one family.
// Choices that point at each other settle on the first of them in id order.
export function documentPageAnchor(project,family,id){
 const map=project.layout?.documentPages?.[family]||{},stacks=stackAnchors(project),path=[];
 let at=id;
 while(true){
  const loop=path.indexOf(at);if(loop>=0)return path.slice(loop).sort()[0];
  path.push(at);
  const chosen=map[at];
  if(chosen===at)return at;
  const next=chosen??(stacks.get(at)!==at?stacks.get(at):undefined);
  if(next==null||next===at)return at;
  at=next;
 }
}

// A section's page group: its device's anchor, or one page for shared records.
export function documentPageKey(project,family,section){
 const ids=section.sourceDeviceIds||[section.id];
 if(section.shared||ids.length!==1)return 'shared';
 return 'device:'+documentPageAnchor(project,family,ids[0]);
}

// The stored choice that puts `id` on `anchor`'s page (null clears it).
export function setDocumentPage(layout,family,id,anchor,project){
 const next=structuredClone(layout||{}),pages=next.documentPages||{},map={...(pages[family]||{})};
 delete map[id];
 const probe={...project,layout:{...next,documentPages:{...pages,[family]:map}}},natural=documentPageAnchor(probe,family,id);
 if(anchor!==natural)map[id]=anchor;
 next.documentPages={...pages,[family]:map};
 if(!Object.keys(map).length)delete next.documentPages[family];
 if(!Object.keys(next.documentPages).length)delete next.documentPages;
 return next;
}
