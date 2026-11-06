import {parseHex} from './color-picker.mjs';
export function inlineTextEditor(svg,{box,value,size=14,bold=false,color='#17364A',align='left',onSave,onClose,onMore}){
 const ns='http://www.w3.org/2000/svg',html='http://www.w3.org/1999/xhtml',foreign=document.createElementNS(ns,'foreignObject');
 const pageWidth=svg.viewBox.baseVal.width,pageHeight=svg.viewBox.baseVal.height,width=Math.max(240,Math.min(box.w+30,pageWidth-72)),height=Math.max(110,Math.min(260,box.h+85)),left=Math.max(36,Math.min(box.x-5,pageWidth-36-width)),top=Math.max(4,Math.min(box.y-5,pageHeight-64-height));
 for(const [name,v] of Object.entries({x:left,y:top,width,height,'data-inline-editor':'true'}))foreign.setAttribute(name,String(v));
 const wrap=document.createElementNS(html,'div');wrap.className='inline-text-editor';const input=document.createElementNS(html,'textarea');input.value=value;input.setAttribute('aria-label','Edit diagram text');input.spellcheck=false;input.maxLength=10000;
 Object.assign(input.style,{fontFamily:'Calibri,Carlito,Arial,sans-serif',fontSize:size+'px',fontWeight:bold?'700':'400',color,textAlign:align,minHeight:Math.max(30,Math.min(box.h+8,height-70))+'px'});
 const bar=document.createElementNS(html,'div');bar.className='inline-text-actions';const status=document.createElementNS(html,'span');status.textContent='Enter saves. Escape cancels.';const error=document.createElementNS(html,'div');error.className='inline-text-error';error.setAttribute('role','status');
 let closed=false,chosenColor=color;
 function finish(){if(closed)return;closed=true;foreign.remove();onClose?.();}
 function save(){if(closed)return true;try{onSave(input.value,chosenColor);finish();return true;}catch(e){error.textContent=e.message;input.setAttribute('aria-invalid','true');input.focus();return false;}}
 for(const [label,action] of [['Save',save],['Cancel',finish]]){const button=document.createElementNS(html,'button');button.type='button';button.textContent=label;button.onclick=action;bar.append(button);}const colorInput=document.createElementNS(html,'input');colorInput.type='color';colorInput.value=parseHex(color)||'#17364A';colorInput.setAttribute('aria-label','Text color');colorInput.title='Text color';colorInput.oninput=()=>{chosenColor=colorInput.value.toUpperCase();input.style.color=chosenColor;};bar.append(colorInput);if(onMore){const more=document.createElementNS(html,'button');more.type='button';more.textContent='Text options';more.onclick=()=>{if(save())onMore();};bar.append(more);}bar.append(status);wrap.append(input,bar,error);foreign.append(wrap);svg.append(foreign);
 input.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();finish();}else if(e.key==='Enter'){e.preventDefault();save();}};
 input.onblur=()=>setTimeout(()=>{if(!closed&&!foreign.contains(document.activeElement))save();},0);
 input.focus();input.select();return {save,cancel:finish};
}
