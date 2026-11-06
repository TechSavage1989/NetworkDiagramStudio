export function comparePorts(a,b){
 const tuple=v=>(String(v).match(/\d+/g)||[]).map(Number),left=tuple(a.name??a),right=tuple(b.name??b);
 if(left.length&&right.length){for(let i=0;i<Math.min(left.length,right.length);i++)if(left[i]!==right[i])return left[i]-right[i];if(left.length!==right.length)return left.length-right.length;}
 else if(left.length||right.length)return left.length?-1:1;
 return String(a.name??a).localeCompare(String(b.name??b),'en',{numeric:true,sensitivity:'base'});
}
export function hasPortDetails(port,hasPeer=false,filter='assigned'){
 if(filter==='all')return true;
 if(hasPeer||String(port.description||'').trim())return true;
 if(filter==='connected')return false;
 return !!(port.role&&!/^(unknown|other|unassigned|none)$/i.test(port.role)||port.lag||port.handoff||port.sdwanMember||port.native!=null&&String(port.native)!==''||port.tagged?.length||port.allowedExcept?.length||port.voice!=null||port.ip||port.address);
}
export function consecutivePorts(a,b){const left=String(a).match(/^(.*?)(\d+)$/),right=String(b).match(/^(.*?)(\d+)$/);return !!(left&&right&&left[1]===right[1]&&+right[2]===+left[2]+1);}
import {textWidth} from './diagram/labels.mjs';
export function wrapPortText(input,width,size=12,bold=false){
 const lines=[];for(const part of String(input??'').split('\n')){let rest=part.trim();if(!rest){lines.push('');continue;}
  while(textWidth(rest,size,bold)>width){let at=1;while(at<rest.length&&textWidth(rest.slice(0,at+1),size,bold)<=width)at++;const space=rest.lastIndexOf(' ',at);if(space>at*.45)at=space;lines.push(rest.slice(0,at));rest=rest.slice(at).trimStart();}lines.push(rest);
 }return lines;
}
