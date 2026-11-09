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


/**
 * Position the visual centre of a connection label relative to its cable.
 * On-line labels may create a white break; offset labels leave the cable intact.
 * Horizontal segments use above/below; vertical segments use left/right.
 * The rotated text footprint determines the gap, not unrotated box dimensions.
 */
export function labelPositionRelativeToCable(point,{placement='on',width=0,height=0,rotation=point?.angle??0,gap=6}={}){
 if(!point)return null;
 const side=placement==='above'||placement==='below'?placement:'on';
 if(side==='on')return {...point,angle:rotation};
 const vertical=Math.abs(Math.sin(point.angle||0))>.5;
 const a=Number.isFinite(rotation)?rotation:0,w=Math.max(0,width),h=Math.max(0,height);
 const across=vertical?Math.abs(Math.cos(a))*w+Math.abs(Math.sin(a))*h:Math.abs(Math.sin(a))*w+Math.abs(Math.cos(a))*h;
 const offset=across/2+Math.max(0,gap),sign=side==='above'?-1:1;
 return {...point,x:point.x+(vertical?sign*offset:0),y:point.y+(vertical?0:sign*offset),angle:a};
}

export function describeCableEnds(cable,devices=[]){
 const byId=new Map(devices.map(device=>[device.id,device.name||device.id]));
 const link=cable?.sourceLink||{},a={device:link.a,port:link.ap},b={device:link.b,port:link.bp};
 const fromPort=String(cable?.from?.port||'').toLowerCase(),toPort=String(cable?.to?.port||'').toLowerCase();
 const reverse=(fromPort&&fromPort===String(b.port||'').toLowerCase()&&fromPort!==String(a.port||'').toLowerCase())||
  (toPort&&toPort===String(a.port||'').toLowerCase()&&toPort!==String(b.port||'').toLowerCase());
 const ordered=reverse?[b,a]:[a,b];
 const label=value=>[byId.get(value.device)||value.device||'Device',value.port||'port not specified'].join(' / ');
 return {start:label(ordered[0]),end:label(ordered[1])};
}
