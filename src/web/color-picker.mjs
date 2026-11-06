export function parseHex(value){const m=/^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(String(value).trim());if(!m)return null;const h=m[1].length===3?[...m[1]].map(c=>c+c).join(''):m[1];return '#'+h.toUpperCase();}
export function rgb(hex){const h=parseHex(hex);return h?[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)):null;}
export function rgbHex(r,g,b){return '#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('').toUpperCase();}
export function toHSV(hex){const [r,g,b]=rgb(hex).map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=d?max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4:0;return [(h*60+360)%360,max?d/max:0,max];}
export function hsvHex(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgbHex(...parts.map(n=>(n+m)*255));}
export function toHSL(hex){const [h,s,v]=toHSV(hex),l=v*(1-s/2);return [h,l===0||l===1?0:(v-l)/Math.min(l,1-l),l];}
export function hslHex(h,s,l){const v=l+s*Math.min(l,1-l);return hsvHex(h,v?2*(1-l/v):0,v);}
// Keep everyday color choices visible without expanding the properties dialog.
const defaults=[['Red','#FF0000'],['Blue','#00B0F0'],['Black','#000000'],['Yellow','#FFD965'],['Green','#00B050'],['Grey','#707A83'],['Teal','#006775'],['Navy','#17364A'],['Purple','#815AC0'],['Orange','#ED7D31'],['White','#FFFFFF']];
export function colorPicker(parent,{color='#17364A',opacity=1,kind='line'}={}){
 const textMode=kind==='text';
 const make=(tag,attrs={},text='',where=parent)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else n.setAttribute(k,String(v));}n.textContent=text;where.append(n);return n;};
 const root=make('fieldset',{class:'color-picker'});make('legend',{},textMode?'Text color':'Line color',root);
 let value=parseHex(color)||'#17364A',alpha=Number.isFinite(opacity)?Math.max(0,Math.min(1,opacity)):1;
 const row=make('div',{class:'color-choice-row'},'',root),custom=make('label',{class:'color-choice'},'Choose color',row),native=make('input',{type:'color','aria-label':'Color selector'},'',custom);
 const hexWrap=make('label',{class:'color-hex'},'HEX',row),hex=make('input',{type:'text','aria-label':'HEX',maxlength:7,spellcheck:'false',autocomplete:'off'},'',hexWrap);
 const preview=make('div',{class:'line-preview'},'',row),sample=document.createElementNS('http://www.w3.org/2000/svg','svg');sample.setAttribute('viewBox','0 0 140 40');sample.setAttribute('aria-label',textMode?'Selected text color':'Selected line color');preview.append(sample);sample.innerHTML=textMode?'<text x="14" y="29" font-family="Arial" font-size="23">Aa Bb</text>':'<path d="M 12 28 V 12 H 128" fill="none" stroke-width="4" stroke-linejoin="round"/>';
 const swatches=make('div',{class:'color-swatches','aria-label':'Standard colors'},'',root);make('p',{class:'color-caption'},'Standard colors',swatches);
 for(const [name,c] of defaults){const b=make('button',{type:'button',class:'color-swatch',title:name+' '+c,'aria-label':'Use '+name+' '+c},'',swatches);b.style.setProperty('--swatch',c);b.onclick=()=>set(c);}
 let opacityRange=null,opacityNumber=null;
 if(!textMode){const opacityRow=make('div',{class:'color-opacity'},'',root),label=make('label',{},'Opacity',opacityRow);opacityRange=make('input',{type:'range',min:0,max:100,step:1,'aria-label':'Line opacity'},'',opacityRow);opacityNumber=make('input',{type:'number',min:0,max:100,step:1,'aria-label':'Line opacity (%)'},'',opacityRow);make('span',{},'%',opacityRow);label.htmlFor=opacityRange.id='line-opacity';
  for(const n of [opacityRange,opacityNumber])n.oninput=()=>{if(n.value!==''&&+n.value>=0&&+n.value<=100){alpha=+n.value/100;error.textContent='';sync(n);}else error.textContent='Opacity must be between 0 and 100.';};
 }
 const error=make('p',{class:'error color-error',role:'status'},'',root);
 native.oninput=()=>set(native.value);
 hex.oninput=()=>{const c=parseHex(hex.value);hex.setAttribute('aria-invalid',String(!c));error.textContent=c?'':'Enter a 3-digit or 6-digit HEX color.';if(c)set(c,hex);};
 function set(c,source){const next=parseHex(c);if(!next)return;error.textContent='';value=next;sync(source);}
 function sync(source){native.value=value;if(source!==hex){hex.value=value;hex.setAttribute('aria-invalid','false');}if(opacityRange&&source!==opacityRange)opacityRange.value=Math.round(alpha*100);if(opacityNumber&&source!==opacityNumber)opacityNumber.value=Math.round(alpha*100);const item=sample.querySelector(textMode?'text':'path');item.setAttribute(textMode?'fill':'stroke',value);item.setAttribute(textMode?'fill-opacity':'stroke-opacity',textMode?1:alpha);for(const b of root.querySelectorAll('.color-swatch'))b.setAttribute('aria-pressed',String(parseHex(b.style.getPropertyValue('--swatch'))===value));}
 sync();
 return {get value(){if(!parseHex(hex.value))throw Error('Enter a valid HEX color.');if(opacityNumber&&(opacityNumber.value===''||!Number.isFinite(+opacityNumber.value)||+opacityNumber.value<0||+opacityNumber.value>100))throw Error('Opacity must be between 0 and 100.');return value;},get opacity(){return alpha;},remember(){}};
}

export const lineColorPicker=colorPicker;
