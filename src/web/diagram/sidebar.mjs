// The sidebar gives width back to the diagram only during a fit retry.
// Fonts have separate readable floors; cable sample weights are never scaled.
export function coreSidebar(width=244){
 const scale=Math.max(.84,width/244);
 return {width,scale,divider:56+width,contentLeft:62+width,titleLeft:74+width,bodyLeft:430-(244-width)/2};
}
