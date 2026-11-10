import {textLayout} from './diagram/scene.mjs';
import {presentation} from './presentation.mjs';

// Text must be measured after wrapping, in paper points, never screen pixels.
// Enlarge the entire model transform, not isolated letters that would collide
// with neighbouring ports/cables. Authored font sizes remain user choices.
export function paperTextMetrics(page,project,exclude=new Set(),scale=1){
 const edits=project.layout?.drawingEdits||{},sizes=[],manual=[];
 for(const item of page.items||[]){
  if(item.type!=='text'||item.hidden||exclude.has(item)||!String(item.value||'').trim())continue;
  const size=textLayout(scale===1?item:{...item,w:item.w*scale,h:item.h*scale,size:item.size*scale,presentation:{...item.presentation,fontScale:(item.presentation?.fontScale||1)*scale}}).size;
  if(Number.isFinite(edits[item.editKey]?.size))manual.push(size);else sizes.push(size);
 }
 return {minimum:sizes.length?Math.min(...sizes):null,manualMinimum:manual.length?Math.min(...manual):null};
}
export function readableModelScale(page,project,factor,unit,exclude){
 const config=presentation(project,page),minimumPt=config.minimumTextPt,metrics=paperTextMetrics(page,project,exclude);
 const requested=minimumPt*(config.textScale||1)*4/3*unit;
 const required=metrics.minimum&&requested?requested/metrics.minimum:0;
 let fitted=Math.max(factor,required);
 // textLayout has fixed padding and a wrapped-line fit, so its final size is
 // not perfectly linear in the outer transform. Refine against the exact
 // would-be rendered boxes, never mutate/re-layout individual glyphs.
 if(required){let low=fitted,changed=false;
  for(let pass=0;pass<16;pass++){const actual=paperTextMetrics(page,project,exclude,fitted).minimum;if(actual>=requested-1e-8)break;low=fitted;changed=true;fitted*=requested/actual*(1+1e-7);}
  // Keep only the enlargement needed by the final wrap thresholds. A ratio
  // step can cross a line-break boundary and otherwise waste useful space.
  if(changed)for(let pass=0;pass<16;pass++){const middle=(low+fitted)/2;if(paperTextMetrics(page,project,exclude,middle).minimum>=requested)fitted=middle;else low=middle;}
 }
 return {factor:fitted,minimumPt:minimumPt*(config.textScale||1),required,metrics};
}
