// Which devices share a VLANs and Routing page or a Port Inventory page.
// By default every switch, router, firewall or network controller has its own
// page, the members of one stack (layout.deviceStacks) share one, and every
// other device (servers, printers, access points...) shares the "other
// devices" pages. layout.documentPages holds the user's choices per family:
// { logical: { id: anchorId }, inventory: {...} }, where a device joins the
// page of its anchor device, OTHER_DEVICES puts it with the other devices and
// an anchor equal to the device itself keeps it on its own page (also out of
// its stack's or the other devices').
export const DOCUMENT_PAGE_FAMILIES=['logical','inventory'];
export const OTHER_DEVICES='*other';
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=200;
const OWN_PAGE_KINDS=new Set(['switch','router','firewall','controller']);

export function cleanDocumentPages(raw,ids){
 const known=ids?new Set(ids):null,out={};
 for(const family of DOCUMENT_PAGE_FAMILIES){
  const map=raw&&typeof raw==='object'?raw[family]:null;if(!map||typeof map!=='object'||Array.isArray(map))continue;
  const clean={};
  for(const [id,anchor] of Object.entries(map).slice(0,2000))if(validId(id)&&validId(anchor)&&(!known||known.has(id)&&(anchor===OTHER_DEVICES||known.has(anchor))))clean[id]=anchor;
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

// A device listed in the project that is not network infrastructure shares
// the other devices' pages unless it is in a stack. A device of unknown kind
// imported from its own configuration or show commands (a router or switch
// whose kind the import could not tell) keeps its own page.
function sharesOtherPages(project,id){
 const device=(project.devices||[]).find(d=>d.id===id);
 if(!device||OWN_PAGE_KINDS.has(device.kind))return false;
 return !((device.kind||'unknown')==='unknown'&&(device.fromConfig||device.operational));
}

// The device whose page `id` is drawn on, for one family, or OTHER_DEVICES.
// Choices that point at each other settle on the first of them in id order.
export function documentPageAnchor(project,family,id){
 const map=project.layout?.documentPages?.[family]||{},stacks=stackAnchors(project),path=[];
 let at=id;
 while(true){
  const loop=path.indexOf(at);if(loop>=0)return path.slice(loop).sort()[0];
  path.push(at);
  const chosen=map[at];
  if(chosen===at||chosen===OTHER_DEVICES)return chosen;
  const stack=stacks.get(at)!==at?stacks.get(at):undefined,next=chosen??stack;
  if(next==null||next===at)return chosen==null&&!stacks.has(at)&&sharesOtherPages(project,at)?OTHER_DEVICES:at;
  at=next;
 }
}

// A section's page group: its device's anchor, the other devices' pages, or
// one page for records several devices share.
export function documentPageKey(project,family,section){
 const ids=section.sourceDeviceIds||[section.id];
 if(section.shared||ids.length!==1)return 'shared';
 const anchor=documentPageAnchor(project,family,ids[0]);
 return anchor===OTHER_DEVICES?'other':'device:'+anchor;
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

// Several choices at once (the dialog's rows). A stack member's default
// follows its stack's first member, so the choices are applied until they
// settle; the result does not depend on their order.
export function setDocumentPages(layout,family,choices,project){
 let next=layout;
 for(let pass=0;pass<=choices.length;pass++){
  const before=JSON.stringify(next?.documentPages||null);
  for(const {id,anchor} of choices)next=setDocumentPage(next,family,id,anchor,{...project,layout:next});
  if(JSON.stringify(next?.documentPages||null)===before)break;
 }
 return next;
}

