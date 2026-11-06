const ns='http://www.w3.org/2000/svg';
export function cableControls(svg,item,selected=-1){
 const make=(tag,attrs,parent)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;};
 const group=make('g',{'class':'cable-controls','data-drawing-key':item.editKey},svg);
 item.points.forEach(([x,y],index)=>{
  const endpoint=index===0||index===item.points.length-1;
  const n=make(endpoint?'circle':'rect',endpoint?{cx:x,cy:y,r:4,class:'cable-endpoint'}:{x:x-5,y:y-5,width:10,height:10,rx:2,class:'cable-point'+(selected===index?' selected':''),'data-cable-point':index,tabindex:0,role:'button','aria-label':'Bend point '+index},group);
  make('title',{},n).textContent=endpoint?'Attached port endpoint':'Bend '+index+': drag to move. Select and press Delete to remove.';
 });
 for(let index=0;index<item.points.length-1;index++){
  const a=item.points[index],b=item.points[index+1];if(Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1])<30)continue;
  const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,n=make('g',{class:'cable-add','data-cable-segment':index,tabindex:0,role:'button','aria-label':'Add bends on segment '+(index+1)},group);
  make('circle',{cx:x,cy:y,r:7},n);make('path',{d:'M '+(x-3)+' '+y+' H '+(x+3)+' M '+x+' '+(y-3)+' V '+(y+3)},n);make('title',{},n).textContent='Add bend points on this segment';
 }return group;
}
