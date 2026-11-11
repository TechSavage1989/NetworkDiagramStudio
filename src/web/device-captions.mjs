// Network-page device captions sit next to their device: the name above and
// the details below on the left by default, or any corner chosen for the
// drawing (Layout & content) or for one device (device editor or Edit
// drawing). Only non-default choices are stored. No imports: the planners,
// the layout cleaner and the paper pass all read it.
export const CAPTION_CORNERS=['above-left','above-right','below-left','below-right'];
export const CAPTION_CORNER_LABELS={'above-left':'Above, left','above-right':'Above, right','below-left':'Below, left','below-right':'Below, right'};
const CAPTION_DEFAULTS={name:'above-left',info:'below-left'};
const corner=value=>CAPTION_CORNERS.includes(value)?value:null;
// The corners for the drawing, or for one device when its id is given (its
// own choice first, then the drawing's).
export function deviceCaptionPlacement(project,deviceId){
 const v=project?.layout?.deviceCaptions||{},own=deviceId!=null&&v.devices&&typeof v.devices==='object'?v.devices[deviceId]||{}:{};
 return {name:corner(own.name)||corner(v.name)||CAPTION_DEFAULTS.name,info:corner(own.info)||corner(v.info)||CAPTION_DEFAULTS.info};
}
export function cleanDeviceCaptions(raw,ids){
 const v=raw&&typeof raw==='object'?raw:{},out={},known=ids?new Set(ids):null;
 for(const k of ['name','info'])if(corner(v[k])&&v[k]!==CAPTION_DEFAULTS[k])out[k]=v[k];
 const devices={};
 if(v.devices&&typeof v.devices==='object')for(const [id,choice] of Object.entries(v.devices).slice(0,5000)){
  if(known&&!known.has(id)||!choice||typeof choice!=='object')continue;
  const own={};for(const k of ['name','info'])if(corner(choice[k]))own[k]=choice[k];
  if(Object.keys(own).length)devices[id]=own;
 }
 if(Object.keys(devices).length)out.devices=devices;
 return Object.keys(out).length?{deviceCaptions:out}:{};
}
// Set (or clear, with an empty value) one device's corners in a layout copy.
// A name or detail line the user had dragged follows its new corner.
export function setDeviceCaptionCorners(layout,id,choice){
 const before=deviceCaptionPlacement({layout},id),captions={...(layout.deviceCaptions||{})},devices={...(captions.devices||{})},own={};
 for(const k of ['name','info'])if(corner(choice[k]))own[k]=choice[k];
 if(Object.keys(own).length)devices[id]=own;else delete devices[id];
 if(Object.keys(devices).length)captions.devices=devices;else delete captions.devices;
 layout.deviceCaptions=captions;
 const after=deviceCaptionPlacement({layout},id),moved=[before.name!==after.name?'title':null,before.info!==after.info?'detail':null].filter(Boolean);
 if(!moved.length||!layout.drawingEdits)return layout;
 const edits={...layout.drawingEdits};
 for(const [key,edit] of Object.entries(edits)){
  const parts=key.split('|');if(parts.length<3||parts.at(-1)!==id||!moved.includes(parts.at(-2))||!edit||typeof edit!=='object')continue;
  const {x,y,...rest}=edit;if(Object.keys(rest).length)edits[key]=rest;else delete edits[key];
 }
 layout.drawingEdits=edits;return layout;
}
// A caption corner: the box sits above or below the body, aligned with its
// left or right edge.
export function captionCorner(node,corner,w,h,gap){const above=corner.startsWith('above'),right=corner.endsWith('right');return {x:right?node.x+node.w-w:node.x,y:above?node.y-h-(gap??6):node.y+node.h+(gap??5),align:right?'right':'left',above,right};}
