// Common illustrative socket envelopes at the shared faceplate width. The
// chassis-module reference defines the visual scale; model-specific centers,
// aliases, numbering and orientation remain untouched. These are drawing
// envelopes, not manufacturing dimensions or inferred interface capabilities.
export function connectorEnvelope(form){
 if(/RJ|copper/i.test(form))return {w:.025,h:.020};
 if(/QSFP/i.test(form))return {w:.029,h:.029*8.5/18.35};
 if(/CX4|X2/i.test(form))return {w:.052,h:.029};
 return {w:.028,h:.028*8.6/13.7};
}
export function consistentSockets(panel){
 if(!panel)return panel;
 const children=panel.children;
 for(let i=0;i<children.length;i++){
  const outer=children[i];if(outer.socketPart!==0)continue;
  const size=connectorEnvelope(outer.socketForm),cx=outer.x+outer.w/2,cy=outer.y+outer.h/2,sx=size.w/outer.w,sy=size.h*panel.ratio/outer.h;
  for(let j=i;j<children.length&&(j===i||children[j].socketPart>0);j++){
   const child=children[j];child.x=cx+(child.x-cx)*sx;child.y=cy+(child.y-cy)*sy;child.w*=sx;child.h*=sy;
  }
 }
 return panel;
}
