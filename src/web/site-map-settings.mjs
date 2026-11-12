// Site map options (layout.siteMap), stored only where they differ from the
// defaults: which details each card shows, how access points and other
// devices are grouped, the link captions and the optional rows.
export const SITE_MAP_PAGE='Site Map';
export const SITE_MAP_DETAILS=Object.freeze([['role','Device type'],['model','Model'],['platform','Platform / software'],['ip','Management IP'],['ports','Port count'],['vlans','VLAN count'],['serial','Serial number'],['mac','MAC address'],['notes','Notes']].map(row=>Object.freeze(row)));
const DEFAULT_DETAILS=Object.freeze(['role','model','ip','ports']);

// Stored only where it differs from the defaults.
export function cleanSiteMap(raw){
 const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},out={};
 if(Array.isArray(r.details)){const details=SITE_MAP_DETAILS.map(([key])=>key).filter(key=>r.details.includes(key));if(details.join()!==DEFAULT_DETAILS.join())out.details=details;}
 if(['each','hidden'].includes(r.accessPoints))out.accessPoints=r.accessPoints;
 if(['grouped','hidden'].includes(r.endpoints))out.endpoints=r.endpoints;
 if(['ports','none'].includes(r.linkLabels))out.linkLabels=r.linkLabels;
 if(['down','right'].includes(r.direction))out.direction=r.direction;
 for(const flag of ['wan','unconnected'])if(r[flag]===false)out[flag]=false;
 return Object.keys(out).length?out:undefined;
}
export function siteMapSettings(project){
 const r=cleanSiteMap(project?.layout?.siteMap)||{};
 return {details:r.details||[...DEFAULT_DETAILS],accessPoints:r.accessPoints||'grouped',endpoints:r.endpoints||'each',linkLabels:r.linkLabels||'speed',direction:r.direction||'auto',wan:r.wan!==false,unconnected:r.unconnected!==false};
}
