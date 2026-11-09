// Padding is per side in drawing pixels before whole-page scaling.
export const LABEL_BACKING=Object.freeze({padding:.5,min:0,max:20,mode:'white'});
export function cleanLabelBacking(raw){
 const padding=raw?.padding;
 return {padding:Number.isFinite(padding)&&padding>=LABEL_BACKING.min&&padding<=LABEL_BACKING.max?padding:LABEL_BACKING.padding,mode:raw?.mode==='transparent'?'transparent':'white'};
}
