// Link/label/port selection is based on actual normalized link identities.
// These helpers have no DOM dependency and can be validated on synthetic pages.
export function relatedConnectionItems(page,{key=null,sourceId=null,portName=null}={}){
 const items=page?.items||[],selected=items.find(item=>item.editKey===key);
 const paths=items.filter(item=>item.type==='path'&&item.sourceLink);
 const matches=portName&&sourceId?paths.filter(path=>{
  const link=path.sourceLink;return link.a===sourceId&&link.ap===portName||link.b===sourceId&&link.bp===portName;
 }):selected?.type==='path'?[selected]:selected?.relatedCableKey?paths.filter(path=>path.editKey===selected.relatedCableKey):
  selected?.linkId!=null?paths.filter(path=>path.linkId===selected.linkId):[];
 const linkIds=new Set(matches.filter(path=>path.linkId!=null).map(path=>path.linkId));
 const labels=items.filter(item=>item.labelRole&&((item.relatedCableKey&&matches.some(path=>path.editKey===item.relatedCableKey))||linkIds.has(item.linkId)));
 const endpoints=matches.flatMap(path=>[path.from,path.to].filter(point=>point&&Number.isFinite(point.x)&&Number.isFinite(point.y)));
 return {paths:matches,labels,endpoints,selected};
}
export function nearestOnCable(points,point){
 let best=null,distance=Infinity,along=0,progress=0,length=0;
 for(let i=1;i<(points?.length||0);i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
 for(let i=1;i<(points?.length||0);i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],segment= Math.hypot(dx,dy);
  if(segment<.001)continue;
  const t=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.y-a[1])*dy)/(segment*segment)));
  const x=a[0]+t*dx,y=a[1]+t*dy,dist=Math.hypot(point.x-x,point.y-y);
  if(dist<distance){best={x,y,angle:Math.abs(dy)>Math.abs(dx)?Math.PI/2:0,ratio:(progress+t*segment)/(length||1),segment:i-1};distance=dist;}
  progress+=segment;
 }
 return best;
}
export function positionOnCable(points,fraction){
 const length=(points||[]).slice(1).reduce((sum,point,i)=>sum+Math.hypot(point[0]-points[i][0],point[1]-points[i][1]),0);
 const target=Math.max(0,Math.min(1,fraction))*length;
 let soFar=0;
 for(let i=1;i<(points?.length||0);i++){
  const a=points[i-1],b=points[i],segment=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(soFar+segment>=target&&segment){const t=(target-soFar)/segment;return {x:a[0]+t*(b[0]-a[0]),y:a[1]+t*(b[1]-a[1]),angle:Math.abs(b[1]-a[1])>Math.abs(b[0]-a[0])?Math.PI/2:0,ratio:fraction};}
  soFar+=segment;
 }
 return points?.length?{x:points.at(-1)[0],y:points.at(-1)[1],angle:0,ratio:fraction}:null;
}
