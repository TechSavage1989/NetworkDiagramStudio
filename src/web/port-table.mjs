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
// A common member/slot prefix belongs in the column heading, rather than being
// repeated for every range. Mixed members retain their complete interface names.
export function portColumnPrefix(names){
 const prefixes=names.map(name=>String(name).match(/^(.*[/:])\d+$/)?.[1]);
 return prefixes.length&&prefixes[0]&&prefixes.every(prefix=>prefix===prefixes[0])?prefixes[0]:'';
}
export function portRanges(names,prefix=''){
 const sorted=[...new Set(names.map(String))].sort(comparePorts),ranges=[];
 for(let i=0;i<sorted.length;){let end=i;while(end+1<sorted.length&&consecutivePorts(sorted[end],sorted[end+1]))end++;
  const start=prefix&&sorted[i].startsWith(prefix)?sorted[i].slice(prefix.length):sorted[i],last=sorted[end].match(/\d+$/)?.[0];
  ranges.push(end===i?start:start+'-'+last);i=end+1;
 }return ranges.join(', ');
}
// One measured size is shared by every number on a faceplate, including its
// optical cages. Aliases at the same socket do not reduce the available pitch.
export function portNumberBox(entries){
 const longest=Math.max(1,...entries.map(entry=>String(entry.text).length));let horizontal=Infinity,vertical=Infinity;
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const dx=Math.abs(entries[i].x-entries[j].x),dy=Math.abs(entries[i].y-entries[j].y);
  if(dy<12&&dx>.1)horizontal=Math.min(horizontal,dx);
  if(dx<Math.max(18,longest*6.2+5)&&dy>.1)vertical=Math.min(vertical,dy);
 }
 const w=Math.min(Math.max(18,longest*6.2+5),horizontal-2),h=Math.min(16,vertical-2),size=Math.min(10,(w-4)/(longest*.62),(h-3)/1.1);
 return {w,h,size,readable:w>=10&&h>=10&&size>=6};
}
import {wrapText} from './diagram/labels.mjs';
export function wrapPortText(input,width,size=12,bold=false){return wrapText(input,width,size,bold);}
