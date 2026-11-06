export function parseHex(value){const m=/^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(String(value).trim());if(!m)return null;const h=m[1].length===3?[...m[1]].map(c=>c+c).join(''):m[1];return '#'+h.toUpperCase();}
export function rgb(hex){const h=parseHex(hex);return h?[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)):null;}
export function rgbHex(r,g,b){return '#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('').toUpperCase();}
export function toHSV(hex){const [r,g,b]=rgb(hex).map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=d?max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4:0;return [(h*60+360)%360,max?d/max:0,max];}
export function hsvHex(h,s,v){const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgbHex(...parts.map(n=>(n+m)*255));}
export function toHSL(hex){const [h,s,v]=toHSV(hex),l=v*(1-s/2);return [h,l===0||l===1?0:(v-l)/Math.min(l,1-l),l];}
export function hslHex(h,s,l){const v=l+s*Math.min(l,1-l);return hsvHex(h,v?2*(1-l/v):0,v);}
const defaults=[['SR fiber','#FF0000'],['LR fiber','#00B0F0'],['DAC','#000000'],['Copper','#FFD965'],['AP copper','#00B050'],['Unspecified','#707A83'],['Teal','#006775'],['Navy','#17364A'],['Purple','#815AC0'],['Orange','#ED7D31'],['White','#FFFFFF']];
const storageKey='NetworkDiagramStudio.colorPalette';
export function colorPicker(parent,{color='#17364A',opacity=1,used=[],kind='line'}={}){
 const textMode=kind==='text';
 const make=(tag,attrs={},text='',where=parent)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else n.setAttribute(k,String(v));}n.textContent=text;where.append(n);return n;};
 const root=make('fieldset',{class:'color-picker'});make('legend',{},textMode?'Text color':'Line color',root);
 let value=parseHex(color)||'#17364A',alpha=Math.max(0,Math.min(1,opacity)),hsv=toHSV(value),saved={recent:[],custom:[]};
 try{const raw=JSON.parse(localStorage.getItem(storageKey)||'{}');saved.recent=(raw.recent||[]).map(parseHex).filter(Boolean).slice(0,16);saved.custom=(raw.custom||[]).filter(s=>typeof s.name==='string'&&parseHex(s.color)).slice(0,20).map(s=>({name:s.name.slice(0,40),color:parseHex(s.color)}));}catch{}
 const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}};
 const visual=make('div',{class:'color-visual'},'',root),spectrum=make('div',{class:'color-spectrum',tabindex:0,role:'slider','aria-label':'Saturation and brightness','aria-valuemin':0,'aria-valuemax':100},'',visual),cursor=make('span',{class:'color-cursor'},'',spectrum),side=make('div',{class:'color-side'},'',visual);
 const native=make('input',{type:'color','aria-label':'System color chooser'},'',side);native.addEventListener('input',()=>set(native.value));
 const preview=make('div',{class:'line-preview'},'',side),sample=document.createElementNS('http://www.w3.org/2000/svg','svg');sample.setAttribute('viewBox','0 0 140 54');sample.setAttribute('aria-label',textMode?'Live text color preview':'Live line color preview');preview.append(sample);sample.innerHTML=textMode?'<text x="12" y="35" font-family="Arial" font-size="23">Aa Bb 123</text>':'<path d="M 10 41 V 14 H 130" fill="none" stroke-width="5" stroke-linejoin="round"/>';
 const back=make('select',{'aria-label':'Color preview background'},'',side);for(const [v,n] of [['#FFFFFF','White paper'],['#E4ECEE','Grey'],['#17364A','Dark']])make('option',{value:v},n,back);back.onchange=()=>preview.style.background=back.value;
 const hueLabel=make('label',{},'Hue',root),hue=make('input',{type:'range',min:0,max:359,step:1,class:'color-hue','aria-label':'Hue'},'',root);hueLabel.htmlFor=hue.id='color-hue';
 hue.oninput=()=>{error.textContent='';hsv[0]=+hue.value;value=hsvHex(...hsv);sync();};
 const fields=make('div',{class:'color-values'},'',root);
 function input(label,min,max){const wrap=make('label',{},label,fields),n=make('input',{type:min==null?'text':'number','aria-label':label},'',wrap);if(min!=null){n.min=min;n.max=max;n.step=1;}return n;}
 const hex=input('HEX'),rs=['Red','Green','Blue'].map(n=>input(n,0,255)),hs=[input('HSL hue',0,359),input('HSL saturation (%)',0,100),input('HSL lightness (%)',0,100)];
 const error=make('p',{class:'error color-error',role:'status'},'',root);
 function validGroup(inputs){return inputs.every(n=>n.value!==''&&Number.isFinite(+n.value)&&+n.value>=+n.min&&+n.value<=+n.max);}
 hex.oninput=()=>{const c=parseHex(hex.value);hex.setAttribute('aria-invalid',String(!c));error.textContent=c?'':'Enter a 3-digit or 6-digit HEX color.';if(c)set(c,hex);};
 for(const n of rs)n.oninput=()=>{if(validGroup(rs)){error.textContent='';set(rgbHex(...rs.map(n=>+n.value)),n);}else error.textContent='RGB values must be between 0 and 255.';};
 for(const n of hs)n.oninput=()=>{if(validGroup(hs)){error.textContent='';set(hslHex(+hs[0].value,+hs[1].value/100,+hs[2].value/100),n);}else error.textContent='Use hue 0-359 and saturation/lightness 0-100.';};
 const opacityLabel=make('label',{},'Opacity',root),opacityRow=make('div',{class:'color-opacity'},'',root),opacityRange=make('input',{type:'range',min:0,max:100,step:1,'aria-label':'Line opacity'},'',opacityRow),opacityNumber=make('input',{type:'number',min:0,max:100,step:1,'aria-label':'Line opacity (%)'},'',opacityRow);opacityLabel.htmlFor=opacityRange.id='line-opacity';
 if(textMode){opacityLabel.hidden=true;opacityRow.hidden=true;}
 for(const n of [opacityRange,opacityNumber])n.oninput=()=>{if(n.value!==''&&+n.value>=0&&+n.value<=100){alpha=+n.value/100;error.textContent='';sync(n);}else error.textContent='Opacity must be between 0 and 100.';};
 function swatches(title,items,where=root){const box=make('div',{class:'color-swatches'},'',where);make('p',{class:'color-caption'},title,box);for(const s of items){const [name,c]=Array.isArray(s)?s:[s,s],b=make('button',{type:'button',class:'color-swatch',title:name+' '+c,'aria-label':'Use '+name+' '+c},'',box);b.style.setProperty('--swatch',c);b.onclick=()=>set(c);}return box;}
 swatches('Network colors',defaults);const unique=[...new Set(used.map(parseHex).filter(Boolean))];if(unique.length)swatches('Colors in this drawing',unique);
 const palettes=make('div',{},'',root);function renderPalettes(){palettes.replaceChildren();if(saved.recent.length)swatches('Recent colors',saved.recent,palettes);if(saved.custom.length){const box=make('div',{class:'saved-colors'},'',palettes);make('p',{class:'color-caption'},'Saved swatches',box);saved.custom.forEach((s,i)=>{const row=make('div',{class:'saved-color'},'',box);swatches('',[[s.name,s.color]],row);make('span',{},s.name,row);const b=make('button',{type:'button','aria-label':'Remove swatch '+s.name},'Remove',row);b.onclick=()=>{saved.custom.splice(i,1);persist();renderPalettes();};});}}
 const saveRow=make('div',{class:'save-color'},'',root),name=make('input',{type:'text',maxlength:40,placeholder:'Swatch name','aria-label':'Swatch name'},'',saveRow),save=make('button',{type:'button'},'Save swatch',saveRow);save.onclick=()=>{if(!name.value.trim()){error.textContent='Enter a name for the saved swatch.';return;}saved.custom=saved.custom.filter(s=>s.name!==name.value.trim());saved.custom.unshift({name:name.value.trim(),color:value});saved.custom=saved.custom.slice(0,20);persist();renderPalettes();error.textContent='';};
 if(window.EyeDropper){const pick=make('button',{type:'button'},'Pick from screen',saveRow);pick.onclick=async()=>{try{set((await new window.EyeDropper().open()).sRGBHex);}catch(e){if(e.name!=='AbortError')error.textContent='Screen color picking is unavailable.';}};}
 function set(c,source){error.textContent='';value=parseHex(c);hsv=toHSV(value);sync(source);}
 function sync(source){
  spectrum.style.backgroundColor=hsvHex(hsv[0],1,1);cursor.style.left=hsv[1]*100+'%';cursor.style.top=(1-hsv[2])*100+'%';spectrum.setAttribute('aria-valuetext','Saturation '+Math.round(hsv[1]*100)+'%, brightness '+Math.round(hsv[2]*100)+'%');spectrum.setAttribute('aria-valuenow',Math.round(hsv[1]*100));
  hue.value=hsv[0];native.value=value;if(source!==hex){hex.value=value;hex.setAttribute('aria-invalid','false');}rgb(value).forEach((v,i)=>{if(source!==rs[i])rs[i].value=v;});toHSL(value).forEach((v,i)=>{if(source!==hs[i])hs[i].value=Math.round(v*(i?100:1))% (i?101:360);});
  if(source!==opacityRange)opacityRange.value=Math.round(alpha*100);if(source!==opacityNumber)opacityNumber.value=Math.round(alpha*100);const previewElement=sample.querySelector(textMode?'text':'path');previewElement.setAttribute(textMode?'fill':'stroke',value);previewElement.setAttribute(textMode?'fill-opacity':'stroke-opacity',textMode?1:alpha);
  for(const b of root.querySelectorAll('.color-swatch'))b.setAttribute('aria-pressed',String(parseHex(b.style.getPropertyValue('--swatch'))===value));
 }
 function fromPointer(e){const r=spectrum.getBoundingClientRect();hsv[1]=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));hsv[2]=1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));value=hsvHex(...hsv);error.textContent='';sync();}
 spectrum.onpointerdown=e=>{spectrum.setPointerCapture(e.pointerId);fromPointer(e);};spectrum.onpointermove=e=>{if(spectrum.hasPointerCapture(e.pointerId))fromPointer(e);};spectrum.onpointerup=e=>{if(spectrum.hasPointerCapture(e.pointerId))spectrum.releasePointerCapture(e.pointerId);};
 spectrum.onkeydown=e=>{const step=e.shiftKey?0.1:0.01;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();hsv[1]=Math.max(0,Math.min(1,hsv[1]+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)));hsv[2]=Math.max(0,Math.min(1,hsv[2]+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0)));value=hsvHex(...hsv);sync();}};
 renderPalettes();sync();
 return {get value(){if(!parseHex(hex.value)||!validGroup(rs)||!validGroup(hs)||!validGroup([opacityNumber]))throw Error('Enter valid HEX/RGB/HSL values and an opacity from 0 to 100.');return value;},get opacity(){return alpha;},remember(){saved.recent=[value,...saved.recent.filter(c=>c!==value)].slice(0,16);persist();}};
}

export const lineColorPicker=colorPicker;
