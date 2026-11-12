// These are editable description presets, not a hardware capability matrix.
// Persist the selected text in the existing link.media and link.speed fields.
export const customConnectionValue='__custom__';
const catalog=entries=>Object.freeze(entries.map(entry=>Object.freeze(entry)));

export const cableTypes=catalog([
 ['unknown','Unspecified'],
 ['copper','Copper / twisted pair'],
 ['fiber','Fiber / reach unspecified'],
 ['MMF','Multimode fiber / MMF'],
 ['SMF','Single-mode fiber / SMF'],
 ['SR','SR fiber'],
 ['LR','LR fiber'],
 ['ER','ER fiber'],
 ['ZR','ZR fiber'],
 ['DAC','DAC / type unspecified'],
 ['passive DAC','Passive DAC'],
 ['active DAC','Active DAC'],
 ['AOC','AOC / active optical cable'],
 ['AEC','AEC / active electrical cable'],
 ['coax','Coaxial'],
 ['serial','Serial'],
 [customConnectionValue,'Custom']
]);

export const linkSpeeds=catalog([
 ['','Unspecified'],
 ['10 Mbps','10 Mbps'],
 ['100 Mbps','100 Mbps'],
 ['1 Gbps','1 Gbps'],
 ['2.5 Gbps','2.5 Gbps'],
 ['4 Gbps','4 Gbps'],
 ['5 Gbps','5 Gbps'],
 ['8 Gbps','8 Gbps'],
 ['10 Gbps','10 Gbps'],
 ['16 Gbps','16 Gbps'],
 ['25 Gbps','25 Gbps'],
 ['32 Gbps','32 Gbps'],
 ['40 Gbps','40 Gbps'],
 ['50 Gbps','50 Gbps'],
 ['64 Gbps','64 Gbps'],
 ['100 Gbps','100 Gbps'],
 ['200 Gbps','200 Gbps'],
 ['400 Gbps','400 Gbps'],
 ['800 Gbps','800 Gbps'],
 [customConnectionValue,'Custom']
]);

// Retain spelling, case, units and labels from older projects or imports. A
// value that is not a preset remains a real selectable option when reopening.
export function connectionValue(choices,current){
 const value=current==null?'':String(current);
 return value===''?choices[0]?.[0]??'':value;
}
export function connectionChoices(choices,current){
 const result=choices.map(([value,label])=>[value,label]),value=connectionValue(choices,current);
 if(!result.some(([option])=>option===value)){
  const custom=result.findIndex(([option])=>option===customConnectionValue);
  result.splice(custom<0?result.length:custom,0,[value,value+' (custom)']);
 }
 return result;
}

function detail(value,label,maxLength,fallback){
 if(value==null)value='';
 if(typeof value!=='string'&&!(typeof value==='number'&&Number.isFinite(value)))throw Error('Enter a valid '+label.toLowerCase()+'.');
 const text=String(value).trim();
 if(/[\u0000-\u001F\u007F-\u009F]/.test(String(value)))throw Error(label+' must be on one line without control characters.');
 if(text.length>maxLength)throw Error(label+' must be '+maxLength+' characters or fewer.');
 return text||fallback;
}
export function cleanConnectionDetails({media,mediaCustom,speed,speedCustom}={}){
 const customMedia=media===customConnectionValue,customSpeed=speed===customConnectionValue;
 const result={media:detail(customMedia?mediaCustom:media,'Cable type',160,'unknown'),speed:detail(customSpeed?speedCustom:speed,'Link speed',80,'')};
 if(customMedia&&!String(mediaCustom??'').trim())throw Error('Enter a custom cable type or select Unspecified.');
 if(customSpeed&&!result.speed)throw Error('Enter a custom link speed or select Unspecified.');
 if(result.media===customConnectionValue||result.speed===customConnectionValue)throw Error('Enter a custom value instead of the selection placeholder.');
 return result;
}

// This controls captions and colors only. Generic fiber descriptions do not
// establish reach, and new cable families do not assert an optic form factor.
// Connection types the user added (layout.connectionTypes): a link whose
// cable type names one of them takes that type and its color, before any
// built-in match ("Fiber backbone" stays its own type, not generic fiber).
let customTypes=[];
const hexColor=/^#[0-9a-f]{6}$/i;
export function cleanConnectionTypes(raw){
 const seen=new Set(),out=[];
 for(const row of Array.isArray(raw)?raw.slice(0,100):[]){const name=typeof row?.name==='string'?row.name.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g,'').slice(0,60):'';if(!name||seen.has(name.toLowerCase())||name===customConnectionValue)continue;seen.add(name.toLowerCase());out.push({name,color:hexColor.test(row.color||'')?row.color.toUpperCase():'#707A83'});}
 return out;
}
export function setCustomConnectionTypes(raw){customTypes=cleanConnectionTypes(raw);}
export function customConnectionTypes(){return customTypes.slice();}
// The cable type choices, with the user's own types before "Custom".
export function cableTypeChoices(){const custom=customTypes.map(type=>[type.name,type.name]);return [...cableTypes.slice(0,-1),...custom,cableTypes.at(-1)];}
export function connectionMediaInfo(input,access=false){
 const scalar=value=>Array.isArray(value)?value.map(scalar).join(', '):value!=null&&typeof value!=='object'?String(value):'',text=scalar(input).trim(),media=text.toLowerCase();
 const own=customTypes.find(type=>type.name.toLowerCase()===media);if(own)return {name:own.name,color:own.color};
 if(/\baoc\b|active[ -]+optical[ -]+cable/.test(media))return {name:'AOC',color:'#815AC0'};
 if(/\baec\b|active[ -]+electrical[ -]+cable/.test(media))return {name:'AEC',color:'#000000'};
 if(/(?:\bactive[ -]*(?:dac|direct[ .-]?attach|twinax)|(?:dac|direct[ .-]?attach|twinax)[ -]*active\b)/.test(media))return {name:'Active DAC',color:'#000000',plug:'DAC',slot:'dac'};
 if(/(?:\bpassive[ -]*(?:dac|direct[ .-]?attach|twinax)|(?:dac|direct[ .-]?attach|twinax)[ -]*passive\b)/.test(media))return {name:'Passive DAC',color:'#000000',plug:'DAC',slot:'dac'};
 if(/dac|direct[ .-]?attach|twinax/.test(media))return {name:'DAC',color:'#000000',plug:'DAC',slot:'dac'};
 if(/coax/.test(media))return {name:'Coaxial',color:'#8D6E63'};
 if(/\bserial\b|\brs[ -]?(?:232|422|485)\b/.test(media))return {name:'Serial',color:'#546E7A'};
 if(/\bzr\d*\b|base[ -]?zr\d*\b/.test(media))return {name:'ZR fiber',color:'#9B3F93'};
 if(/\ber\d*\b|base[ -]?er\d*\b/.test(media))return {name:'ER fiber',color:'#C57B33'};
 if(/\bsr\d*\b|base[ -]?sr\d*\b|short[ .-]?reach/.test(media))return {name:'SR fiber',color:'#FF0000',plug:'SFP',slot:'sr'};
 if(/\blr\d*\b|base[ -]?lr\d*\b|long[ .-]?reach/.test(media))return {name:'LR fiber',color:'#00B0F0',plug:'SFP',slot:'lr'};
 if(/\bmmf\b|multi[ .-]?mode/.test(media))return {name:'Multimode fiber',color:'#707A83'};
 if(/\bsmf\b|single[ .-]?mode/.test(media))return {name:'Single-mode fiber',color:'#707A83'};
 if(/fiber|fibre|optical/.test(media))return {name:'Fiber, reach unspecified',color:'#707A83',plug:'SFP'};
 if(/sfp/.test(media))return {name:'SFP, media unspecified',color:'#707A83'};
 if(/copper|rj.?45|twisted|base[ -]?t|cat[5-8]/.test(media))return {name:access?'AP copper':'Copper',color:access?'#00B050':'#FFD965'};
 return {name:!text||/^(?:unknown|unspecified|not specified|n\/?a|none|auto)$/i.test(text)?'Media unspecified':text,color:'#707A83'};
}
