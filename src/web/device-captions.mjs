// Network-page device captions sit next to their device: the name above and
// the details below on the left by default, or any corner chosen in Layout &
// content. Only non-default choices are stored. No imports: the planners,
// the layout cleaner and the paper pass all read it.
export const CAPTION_CORNERS=['above-left','above-right','below-left','below-right'];
const CAPTION_DEFAULTS={name:'above-left',info:'below-left'};
export function deviceCaptionPlacement(project){const v=project?.layout?.deviceCaptions||{};return {name:CAPTION_CORNERS.includes(v.name)?v.name:CAPTION_DEFAULTS.name,info:CAPTION_CORNERS.includes(v.info)?v.info:CAPTION_DEFAULTS.info};}
export function cleanDeviceCaptions(raw){const v=deviceCaptionPlacement({layout:{deviceCaptions:raw}}),out={};for(const k of ['name','info'])if(v[k]!==CAPTION_DEFAULTS[k])out[k]=v[k];return Object.keys(out).length?{deviceCaptions:out}:{};}
// A caption corner: the box sits above or below the body, aligned with its
// left or right edge.
export function captionCorner(node,corner,w,h,gap){const above=corner.startsWith('above'),right=corner.endsWith('right');return {x:right?node.x+node.w-w:node.x,y:above?node.y-h-(gap??6):node.y+node.h+(gap??5),align:right?'right':'left',above,right};}
