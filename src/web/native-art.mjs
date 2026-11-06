// Keep supported vector masters as editable geometry as well as a preview PNG.
// The recorder uses the canvas's actual transform, exactly as the preview does.
export function recordArtwork(context,width,height){
 const paths=[],texts=[];let commands=[],current=null,image=false,last=null;
 const point=(x,y)=>{const m=context.getTransform();return [(m.a*x+m.c*y+m.e)/width,(m.b*x+m.d*y+m.f)/height];};
 const add=(op,x,y)=>{const p=point(x,y);commands.push([op,...p]);last=[x,y];};
 function path(){if(!current){current={commands,fill:'none',stroke:'none',weight:0};paths.push(current);}return current;}
 const hooks={
  beginPath(){commands=[];current=null;last=null;},
  moveTo(x,y){add('M',x,y);},lineTo(x,y){add('L',x,y);},closePath(){commands.push(['Z']);},
  rect(x,y,w,h){add('M',x,y);add('L',x+w,y);add('L',x+w,y+h);add('L',x,y+h);add('L',x,y);},
  quadraticCurveTo(cx,cy,x,y){const [sx,sy]=last||[0,0];for(let i=1;i<=48;i++){const t=i/48,u=1-t;add('L',u*u*sx+2*u*t*cx+t*t*x,u*u*sy+2*u*t*cy+t*t*y);}},
  bezierCurveTo(ax,ay,bx,by,x,y){const [sx,sy]=last||[0,0];for(let i=1;i<=48;i++){const t=i/48,u=1-t;add('L',u**3*sx+3*u*u*t*ax+3*u*t*t*bx+t**3*x,u**3*sy+3*u*u*t*ay+3*u*t*t*by+t**3*y);}},
  ellipse(x,y,rx,ry,angle,start,end,ccw=false){
   const tau=Math.PI*2;let span=end-start;
   if(!ccw){if(span>=tau)span=tau;else span=(span%tau+tau)%tau;}else{if(span<=-tau)span=-tau;else span=-((-span%tau+tau)%tau);}
   const count=Math.max(4,Math.ceil(Math.abs(span)/tau*128));
   for(let i=0;i<=count;i++){const a=start+span*i/count,c=Math.cos(a)*rx,s=Math.sin(a)*ry;add(i||last?'L':'M',x+c*Math.cos(angle)-s*Math.sin(angle),y+c*Math.sin(angle)+s*Math.cos(angle));}
  },
  fill(){if(commands.length)path().fill=String(context.fillStyle);},
  stroke(){if(commands.length){const p=path(),m=context.getTransform();p.stroke=String(context.strokeStyle);p.weight=context.lineWidth*Math.sqrt((m.a*m.a+m.b*m.b+m.c*m.c+m.d*m.d)/2)/width;}},
  drawImage(){image=true;},
  fillText(value,x,y,max){const m=context.getTransform(),[px,py]=point(x,y),size=parseFloat(context.font)||12,scale=Math.hypot(m.a,m.b),w=Math.min(context.measureText(String(value)).width,max||Infinity)*scale/width;texts.push({text:String(value),x:px,y:py,w,size:size*scale/width,color:String(context.fillStyle),angle:Math.atan2(-m.b,m.a)});}
 };
 const ctx=new Proxy(context,{get(target,key){const value=target[key];if(typeof value!=='function')return value;return (...args)=>{hooks[key]?.(...args);return value.apply(target,args);};},set(target,key,value){target[key]=value;return true;}});
 return {ctx,result:()=>image?undefined:{paths,texts}};
}
export function cleanNativeArt(value){
 if(!value)return undefined;
 const color=s=>typeof s==='string'&&/^(?:none|#[0-9a-f]{6}|rgba?\([\d.,% ]+\))$/i.test(s);
 const numeric=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=10000;
 if(!Array.isArray(value.paths)||value.paths.length>20000||!Array.isArray(value.texts)||value.texts.length>5000)throw Error('Invalid editable artwork.');
 let count=0;
 const paths=value.paths.map(p=>{if(!Array.isArray(p.commands)||!color(p.fill)||!color(p.stroke)||!numeric(p.weight)||p.commands.some(c=>!Array.isArray(c)||!['M','L','Z'].includes(c[0])||c.length!==(c[0]==='Z'?1:3)||c.slice(1).some(n=>!numeric(n)))||(count+=p.commands.length)>500000)throw Error('Invalid editable vector path.');return {commands:p.commands,fill:p.fill,stroke:p.stroke,weight:p.weight,...(typeof p.name==='string'?{name:p.name.slice(0,300)}:{})};});
 const texts=value.texts.map(t=>{if(typeof t.text!=='string'||t.text.length>20000||![t.x,t.y,t.w,t.size,t.angle].every(numeric)||!color(t.color))throw Error('Invalid editable artwork text.');return {text:t.text,x:t.x,y:t.y,w:t.w,size:t.size,color:t.color,angle:t.angle,...(typeof t.bold==='boolean'?{bold:t.bold}:{}),...(['left','center','right'].includes(t.align)?{align:t.align}:{})};});
 return {paths,texts};
}
