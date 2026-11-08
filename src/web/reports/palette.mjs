// Shared VLAN and LAG identities follow SwitchPort Diagram Builder 1.18.5.
// Colors are measured in CIELAB D65; CIEDE2000 follows the source engine's
// Sharma/Wu/Dalal implementation. It is a separation measure, not an
// accessibility certification or a claim about printed color accuracy.
const hex=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value.toLowerCase():null;
const linear=value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
const rgb=color=>[1,3,5].map(at=>parseInt(color.slice(at,at+2),16)/255);
export const aggregateKey=value=>String(value??'').trim().normalize('NFC').toUpperCase();
export const luminance=color=>rgb(color).map(linear).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
export function lab(color){
 const [r,g,b]=rgb(color).map(linear),f=value=>value>216/24389?Math.cbrt(value):value*841/108+4/29;
 const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
 return [116*y-16,500*(x-y),200*(y-z)];
}
export const labDistance=(a,b)=>Math.hypot(...a.map((value,index)=>value-b[index]));
export function colorDifference(first,second){
 const a=typeof first==='string'?lab(first):first,b=typeof second==='string'?lab(second):second,rad=value=>value*Math.PI/180,degrees=(x,y)=>(Math.atan2(y,x)*180/Math.PI+360)%360;
 const c1=Math.hypot(a[1],a[2]),c2=Math.hypot(b[1],b[2]),c7=((c1+c2)/2)**7,g=.5*(1-Math.sqrt(c7/(c7+6103515625))),a1=(1+g)*a[1],a2=(1+g)*b[1],cp1=Math.hypot(a1,a[2]),cp2=Math.hypot(a2,b[2]),h1=degrees(a1,a[2]),h2=degrees(a2,b[2]);
 let dh=h2-h1;if(cp1*cp2===0)dh=0;else if(dh>180)dh-=360;else if(dh< -180)dh+=360;
 const deltaL=b[0]-a[0],deltaC=cp2-cp1,deltaH=2*Math.sqrt(cp1*cp2)*Math.sin(rad(dh/2)),l=(a[0]+b[0])/2,c=(cp1+cp2)/2;
 const h=cp1*cp2===0?h1+h2:Math.abs(h1-h2)<=180?(h1+h2)/2:(h1+h2+(h1+h2<360?360:-360))/2,t=1-.17*Math.cos(rad(h-30))+.24*Math.cos(rad(2*h))+.32*Math.cos(rad(3*h+6))-.20*Math.cos(rad(4*h-63));
 const sl=1+.015*(l-50)**2/Math.sqrt(20+(l-50)**2),sc=1+.045*c,sh=1+.015*c*t,theta=30*Math.exp(-(((h-275)/25)**2)),cp7=c**7,rt=-2*Math.sqrt(cp7/(cp7+6103515625))*Math.sin(rad(2*theta)),dl=deltaL/sl,dc=deltaC/sc,dH=deltaH/sh;
 return Math.sqrt(Math.max(0,dl*dl+dc*dc+dH*dH+rt*dc*dH));
}
function hsl(hue,saturation,lightness){
 const h=hue/60,c=(1-Math.abs(2*lightness-1))*saturation,x=c*(1-Math.abs(h%2-1)),m=lightness-c/2;
 const values=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
 return '#'+values.map(value=>Math.round((value+m)*255).toString(16).padStart(2,'0')).join('');
}
let vlanCandidates,lagCandidates;
function candidates(lag=false){
 if(lag?lagCandidates:vlanCandidates)return lag?lagCandidates:vlanCandidates;
 const colors=new Set();
 for(const lightness of lag?[.24,.28,.32,.36,.42,.48,.54,.60,.66]:[.52,.58,.64,.70,.76,.82,.87])for(const saturation of lag?[.45,.55,.65,.75,.85,.95]:[.32,.45,.58,.72,.86])for(let hue=0;hue<360;hue+=lag?5:6)colors.add(hsl(hue,saturation,lightness));
 const values=[...colors].sort().map(color=>({color,lab:lab(color)})).filter(({color,lab:[l,a,b]})=>lag?l>=40&&l<=82&&Math.hypot(a,b)>=32&&Math.hypot(a,b)<=80&&1.05/(luminance(color)+.05)>=3:l>=60&&l<=91&&Math.hypot(a,b)>=14&&Math.hypot(a,b)<=70&&Math.min(...rgb(color))*255>=95);
 if(lag)lagCandidates=values;else vlanCandidates=values;return values;
}
export function validateVlanColor(value){
 const color=hex(value);if(!color)throw Error('Use a six-digit #RRGGBB color.');
 const [l]=lab(color);if(l<60||l>91||Math.min(...rgb(color))*255<95||['#ffffff','#e6e6e6','#000000'].some(reference=>colorDifference(color,reference)<=7))throw Error('VLAN colors must remain soft and distinct from the reserved None, Unknown and Stack colors.');
 return color;
}
export function nativeFill(port,palette){return port.stackLink?'#000000':port.untaggedState==='None'?'#ffffff':port.untaggedVlan!=null?palette.vlans[port.untaggedVlan]||'#e6e6e6':'#e6e6e6';}
export function vlanIds(inventory){return [...new Set([...(inventory.vlans||[]).map(vlan=>vlan.id),...(inventory.ports||[]).flatMap(port=>[port.untaggedVlan,...(port.taggedVlans||[]),port.voiceVlan])].filter(id=>Number.isInteger(id)&&id>=1&&id<=4094))].sort((a,b)=>a-b);}
export function markerVlans(inventory,port){return [...new Set([...(port.taggedVlans||[]),port.voiceVlan,...(inventory.vlans||[]).filter(vlan=>vlan.voice&&vlan.id===port.untaggedVlan).map(vlan=>vlan.id)].filter(id=>Number.isInteger(id)))].sort((a,b)=>a-b);}
export const voiceVlan=(inventory,port,id)=>port.voiceVlan===id||(inventory.vlans||[]).some(vlan=>vlan.id===id&&vlan.voice);

export function sharedReportPalette(items,overrides={}){
 const vlans={},aggregates={},warnings=[],valid=items.filter(item=>!item.inventory.blockers.length),ids=[...new Set(valid.flatMap(item=>vlanIds(item.inventory)))].sort((a,b)=>a-b),known=new Set(ids),aliases={};
 const rawVlans=overrides.vlans||overrides.Vlans||{},rawAggregates=overrides.aggregates||overrides.Aggregates||{},pinned={};
 for(const [key,value] of Object.entries(rawVlans)){
  const match=/^(?:vlan:)?(\d+)(?::(?:name|item):.*)?$/.exec(key),id=match?Number(match[1]):null;
  if(!match)throw Error('A saved VLAN color has an invalid identity: '+key);if(!known.has(id))continue;
  const color=validateVlanColor(value);if(pinned[id]&&pinned[id]!==color)throw Error('Conflicting saved colors for VLAN '+id+'. Choose one color for that VLAN ID.');pinned[id]=color;
 }
 for(const item of valid)for(const [id,color] of Object.entries(item.inventory.vlanColorOverrides||{}))if(known.has(+id)){const override=Object.entries(rawVlans).some(([name])=>new RegExp('^(?:vlan:)?'+id+'(?::|$)').test(name)),chosen=validateVlanColor(color);if(!override&&pinned[id]&&pinned[id]!==chosen)throw Error('Saved inventories have conflicting colors for VLAN '+id+'. Choose one shared override.');if(!pinned[id])pinned[id]=chosen;}
 if(new Set(Object.values(pinned)).size!==Object.keys(pinned).length)throw Error('Distinct VLAN IDs cannot share an overridden color.');
 const reserved=['#ffffff','#e6e6e6','#000000'].map(lab);if(known.has(1)&&!pinned[1])pinned[1]='#9faab5';
 Object.assign(vlans,pinned);const selected=Object.values(vlans).map(lab),used=new Set(Object.values(vlans)),pool=candidates().filter(candidate=>reserved.every(reference=>colorDifference(candidate.lab,reference)>=10));
 const nearest=pool.map(candidate=>selected.length?Math.min(...selected.map(reference=>colorDifference(candidate.lab,reference))):Math.min(...reserved.map(reference=>colorDifference(candidate.lab,reference))));
 for(const id of ids.filter(id=>!vlans[id])){
  let index=-1,score=-1;for(let i=0;i<pool.length;i++)if(!used.has(pool[i].color)&&nearest[i]>score){index=i;score=nearest[i];}
  if(index<0)throw Error('There are more VLAN identities than available distinct soft colors. Split the report into smaller selections.');
  const chosen=pool[index];vlans[id]=chosen.color;used.add(chosen.color);selected.push(chosen.lab);for(let i=0;i<pool.length;i++)nearest[i]=Math.min(nearest[i],colorDifference(pool[i].lab,chosen.lab));
 }
 let minimum=100;
 for(let i=0;i<ids.length;i++)for(let j=0;j<i;j++)minimum=Math.min(minimum,colorDifference(vlans[ids[i]],vlans[ids[j]]));
 if(ids.length>1&&minimum<10)warnings.push('This large VLAN palette has closely spaced colors. Use the VLAN IDs and complete key together.');
 for(const id of ids){aliases[id]=[...new Set(valid.flatMap(item=>item.inventory.vlans.filter(vlan=>vlan.id===id).map(vlan=>String(vlan.name||'').trim().normalize('NFC'))).filter(Boolean))].sort();if(aliases[id].length>1)warnings.push('VLAN '+id+' uses name aliases ('+aliases[id].join(' / ')+'). One shared color is used by VLAN ID; connectivity is not inferred.');}
 const allPorts=valid.flatMap(item=>item.inventory.ports),lagNames=[...new Set(allPorts.map(port=>aggregateKey(port.aggregate)).filter(Boolean))].sort((a,b)=>a.length-b.length||a.localeCompare(b)),native=[...new Set([...Object.values(vlans),...allPorts.map(port=>nativeFill(port,{vlans}))])].map(lab),selectedLags=[];
 const fillFor=port=>lab(nativeFill(port,{vlans}));
 const accept=(key,color)=>{
  const current=hex(color);if(!current)throw Error('Use a six-digit #RRGGBB LAG color.');const measured=lab(current),member=allPorts.filter(port=>aggregateKey(port.aggregate)===key);
  if(member.some(port=>labDistance(measured,fillFor(port))<35)||native.some(reference=>labDistance(measured,reference)<18)||selectedLags.some(reference=>labDistance(measured,reference)<22)||1.05/(luminance(current)+.05)<3)throw Error('The LAG color for '+key+' needs more contrast against its member fills and the shared palette.');
  aggregates[key]=current;selectedLags.push(measured);
 };
 const lagOverrides={};for(const [key,color] of Object.entries(rawAggregates)){const canonical=aggregateKey(key);if(!lagNames.includes(canonical))continue;if(lagOverrides[canonical]&&lagOverrides[canonical]!==hex(color))throw Error('Conflicting saved colors for LAG '+canonical);lagOverrides[canonical]=color;}
 for(const item of valid)for(const [key,color] of Object.entries(item.inventory.aggregateColorOverrides||{})){const canonical=aggregateKey(key);if(lagNames.includes(canonical)&&!lagOverrides[canonical])lagOverrides[canonical]=color;}
 for(const key of lagNames.filter(key=>lagOverrides[key]))accept(key,lagOverrides[key]);
 for(const key of lagNames.filter(key=>!aggregates[key])){
  const member=allPorts.filter(port=>aggregateKey(port.aggregate)===key).map(fillFor),ranked=candidates(true).map(candidate=>({candidate,own:Math.min(...member.map(color=>labDistance(candidate.lab,color))),global:native.length?Math.min(...native.map(color=>labDistance(candidate.lab,color))):100,previous:selectedLags.length?Math.min(...selectedLags.map(color=>labDistance(candidate.lab,color))):80})).filter(row=>row.own>=35&&row.global>=18&&row.previous>=22);
  ranked.sort((a,b)=>Math.min(b.own/35,b.global/18,b.previous/22)-Math.min(a.own/35,a.global/18,a.previous/22)||b.previous-a.previous||a.candidate.color.localeCompare(b.candidate.color));
  if(!ranked.length)throw Error('Cannot assign a sufficiently distinct outline to LAG '+key+'. Adjust the palette or split the report selection.');accept(key,ranked[0].candidate.color);
 }
 if(lagNames.length&&valid.length>1)warnings.push('Matching LAG labels share outline colors only; they do not establish a physical link between devices.');
 return {vlans,aggregates,aliases,warnings,minimumVlanDifference:ids.length>1?minimum:null,overrides:{vlans:Object.fromEntries(Object.entries(vlans).map(([id,color])=>['vlan:'+id,color])),aggregates:{...aggregates}}};
}
