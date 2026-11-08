// Measured, deterministic shelves. All sizes are world coordinates; no equipment
// is scaled to make a candidate fit. Reading order remains the saved order.
export function compactLayouts(boxes,{gap=24,gapX=gap,gapY=gap,left=0,top=0,maxColumns=4}={}){
 const result=[];
 for(let columns=1;columns<=Math.min(maxColumns,boxes.length);columns++){
  const widths=Array.from({length:columns},(_,column)=>Math.max(0,...boxes.filter((_,i)=>i%columns===column).map(b=>b.w)));
  const offsets=widths.map((_,i)=>widths.slice(0,i).reduce((a,b)=>a+b,0)+gapX*i);
  const positions=new Map();let y=top;
  for(let row=0;row<boxes.length;row+=columns){
   const members=boxes.slice(row,row+columns),height=Math.max(...members.map(b=>b.h));
   members.forEach((box,column)=>positions.set(box.id,{x:left+offsets[column],y,w:box.w,h:box.h}));
   y+=height+(row+columns<boxes.length?gapY:0);
  }
  result.push({columns,positions,w:widths.reduce((a,b)=>a+b,0)+gapX*(columns-1),h:y-top});
 }
 return result;
}

export function compactLayout(boxes,links=[],options={}){
 const {minimumWidth=0,minimumHeight=0,frameWidth=0,frameHeight=0}=options;
 const score=layout=>{
  const w=Math.max(minimumWidth,layout.w+frameWidth),h=Math.max(minimumHeight,layout.h+frameHeight);
  let distance=0,count=0;
  for(const link of links){const a=layout.positions.get(link.a),b=layout.positions.get(link.b);if(!a||!b)continue;distance+=Math.abs(a.x+a.w/2-b.x-b.w/2)+Math.abs(a.y+a.h/2-b.y-b.h/2);count++;}
  return Math.max(w,h)*.55+Math.sqrt(w*h)*.25+(count?distance/count:0)*.2;
 };
 return compactLayouts(boxes,options).sort((a,b)=>score(a)-score(b)||a.columns-b.columns)[0]||{columns:0,positions:new Map(),w:0,h:0};
}

export function automaticDeviceGap(page,devices=page.items.filter(i=>i.type==='device'&&i.kind!=='plug'),side='below'){
 const shapes=new Map(page.items.filter(item=>item.type==='device').map(item=>[item.key,item])),opposite={above:'below',below:'above',left:'right',right:'left'},paths=page.items.filter(path=>path.type==='path'&&path.from&&path.to),occupied=[];
 const departure=(path,device)=>{
  const owns=end=>end.device===device.key||shapes.get(end.device)?.host?.device===device.key;
  const from=owns(path.from),to=owns(path.to);if(!from&&!to)return null;
  const points=from?path.points:[...path.points].reverse(),contains=([x,y])=>x>=device.x-.01&&x<=device.x+device.w+.01&&y>=device.y-.01&&y<=device.y+device.h+.01;
  for(let i=1;i<points.length;i++)if(contains(points[i-1])&&!contains(points[i])){const [x,y]=points[i];return x<device.x?'left':x>device.x+device.w?'right':y<device.y?'above':'below';}
  return null;
 };
 const counts=devices.map((device,index)=>{const facing=index===devices.length-1?side:opposite[side],bank=paths.filter(path=>departure(path,device)===facing);occupied.push(...bank);return bank.length;}),weight=Math.max(4,...occupied.map(path=>path.weight||4)),tracks=Math.max(0,...counts);
 const labels=page.items.filter(text=>text.type==='text'&&devices.some(device=>[text.titleOwner,text.deviceTextOwner].includes(device.sourceId))),textSpace=Math.max(20,...labels.map(text=>Math.min(48,text.h)));
 return Math.ceil(Math.max(side==='left'||side==='right'?32:36+textSpace,12+tracks*(weight+3)));
}
