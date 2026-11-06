export function movementStep(event,normal=1){return normal*(event.ctrlKey||event.metaKey?0.1:event.shiftKey?10:1);}
export function selectedInBox(anchors,a,b){const left=Math.min(a[0],b[0]),right=Math.max(a[0],b[0]),top=Math.min(a[1],b[1]),bottom=Math.max(a[1],b[1]);return Object.entries(anchors).filter(([,p])=>p[0]>=left&&p[0]<=right&&p[1]>=top&&p[1]<=bottom).map(([key])=>key);}
export function moveAnchors(anchors,keys,dx,dy){
 const selected=[...new Set(keys)].filter(k=>anchors[k]);if(!selected.length)return anchors;
 // Clamp the group as a whole so spacing is retained at the faceplate edge.
 dx=Math.max(-Math.min(...selected.map(k=>anchors[k][0])),Math.min(1-Math.max(...selected.map(k=>anchors[k][0])),dx));
 dy=Math.max(-Math.min(...selected.map(k=>anchors[k][1])),Math.min(1-Math.max(...selected.map(k=>anchors[k][1])),dy));
 const next=Object.fromEntries(Object.entries(anchors).map(([key,p])=>[key,[...p]]));for(const key of selected)next[key]=[next[key][0]+dx,next[key][1]+dy];return next;
}
