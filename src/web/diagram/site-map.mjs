// Site map: a high-level picture of the site's hardware hierarchy and the
// connections between devices, without port detail. The edge (WAN handoffs
// and cloud services) is at the top, then firewalls and routers, then
// switches by their distance from the edge, then access points and other
// devices under the device they connect to. Each card shows the details
// chosen in Site map options; the links between two devices are drawn once,
// labelled with their count and speed.
//
// Rows hold the hierarchy levels (a crowded level wraps onto further rows).
// Connections are orthogonal: they leave a card's bottom, run along a track
// in the band between rows, pass between cards of any rows in between and
// enter the other card's top. Tracks in a band are ordered so a vertical run
// never crosses a horizontal run of the same band where an order exists.
import {C,label,rect,fresh,linkLegend,mediaInfo,rate,physicalPorts} from './scene.mjs';
import {siteHandoffs} from './core.mjs';
import {deviceModel,deviceMacs} from '../device-details.mjs';
import {deviceKindLabel} from '../device-types.mjs';
import {cleanDeviceStacks} from '../device-stacks.mjs';
import {hierarchyOrder} from '../device-hierarchy.mjs';
import {cleanGlobalTextStyles} from '../global-text-styles.mjs';
import {linkWeight} from '../link-styles.mjs';
import {wrapPortText} from '../port-table.mjs';
import {textWidth} from './labels.mjs';
import {pageGeometry} from '../page-options.mjs';

import {SITE_MAP_PAGE,siteMapSettings} from '../site-map-settings.mjs';
export {SITE_MAP_PAGE};

const INFRA=new Set(['firewall','router','switch']),EDGE=new Set(['handoff','cloud']);
const ENDPOINT_PLURAL={server:'servers',hypervisor:'hypervisor hosts','virtual-machine':'virtual machines',hci:'hyperconverged nodes',storage:'storage systems',phone:'phones',workstation:'computers',printer:'printers',camera:'cameras',controller:'controllers',ups:'UPS units','patch-panel':'patch panels',iot:'IoT devices',other:'devices',unknown:'devices'};
const KIND_COLOR={handoff:'#5D6D7E',cloud:'#5D6D7E',firewall:'#B03A2E',router:'#7D3C98',switch:'#166574',ap:'#1E8449',controller:'#1E8449',server:'#2E4053',hypervisor:'#2E4053',hci:'#2E4053','virtual-machine':'#566573',storage:'#7E5109'};
const colorOf=kind=>KIND_COLOR[kind]||'#536779';
const text=v=>typeof v==='string'?v.trim():v==null?'':String(v).trim();
// Wrapped the way the drawing's text layout wraps (it allows 6 units of overhang).
const wrap=(value,width,size,bold)=>wrapPortText(value,width+6,size,bold);
const byNumber=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});

// Layout constants in drawing units (96 per inch).
const GAP=48,PITCH=8,BAND_PAD=12,LABEL_ZONE=17,TILE=34,PAD=10,MIN_W=184,MAX_W=252,NAME=13,DETAIL=10.5;

function textSizes(project){
 const styles=cleanGlobalTextStyles(project.layout?.textStyles),size=(category,base)=>styles[category]?.size?styles[category].size*4/3:styles[category]?.scale?base*styles[category].scale:base;
 return {name:size('deviceNames',NAME),detail:size('deviceDetails',DETAIL),link:size('linkLabels',10)};
}

function plural(n,word){return n+' '+(n===1?word.replace(/s$/,''):word);}
function counted(values,limit=3){
 const counts=new Map();for(const v of values.filter(Boolean))counts.set(v,(counts.get(v)||0)+1);
 const rows=[...counts].sort((a,b)=>b[1]-a[1]||byNumber(a[0],b[0])).map(([v,n])=>(n>1?n+' × ':'')+v);
 return rows.length>limit?rows.slice(0,limit).join(', ')+' +'+(rows.length-limit):rows.join(', ');
}

// The detail lines one card shows, in Site map options order.
function details(node,settings,ports){
 const devices=node.devices,one=devices.length===1?devices[0]:null,lines=[];
 for(const key of settings.details){
  let value='';
  if(key==='role')value=node.group?'':node.stack?deviceKindLabel(node.kind)+' stack · '+plural(node.stack,'members'):deviceKindLabel(node.kind);
  else if(key==='model')value=node.group||node.stack?counted(devices.map(d=>deviceModel(d)||text(d.model))):deviceModel(one)||text(one?.model);
  else if(key==='platform')value=counted(devices.map(d=>text(d.technology)),2);
  else if(key==='ip')value=node.group?'':[...new Set(devices.map(d=>text(d.ip)).filter(Boolean))].slice(0,2).join(', ');
  else if(key==='ports'&&!node.group&&!EDGE.has(node.kind)){const total=devices.reduce((n,d)=>n+physicalPorts(d).length,0),used=devices.reduce((n,d)=>n+(ports.get(d.id)?.size||0),0);value=total?plural(total,'ports')+(used?' · '+used+' connected':''):used?used+' connected':'';}
  else if(key==='vlans'){const ids=new Set(devices.flatMap(d=>(d.vlans||[]).map(v=>text(v.id)).filter(Boolean)));value=ids.size?plural(ids.size,'VLANs'):'';}
  else if(key==='serial'){const serials=[...new Set(devices.flatMap(d=>[text(d.serialNumber||d.serial),...(d.reportDetails||[]).map(r=>text(r.serialNumber??r.SerialNumber))]).filter(Boolean))];value=serials.length?'SN '+serials.slice(0,3).join(', ')+(serials.length>3?' +'+(serials.length-3):''):'';}
  else if(key==='mac'&&one){const mac=deviceMacs(one)[0];value=mac?'MAC '+mac:'';}
  else if(key==='notes'&&one)value=text(one.notes)||text((one.reportDetails||[]).find(r=>text(r.notes??r.Notes))?.notes);
  if(value&&!lines.some(([,v])=>v.toLowerCase()===value.toLowerCase())&&value.toLowerCase()!==text(node.name).toLowerCase())lines.push([key,value]);
 }
 if(node.stack&&!settings.details.includes('role'))lines.unshift(['role','Stack · '+plural(node.stack,'members')]);
 return lines;
}

// Simple role glyphs on a colored tile, as editable rectangles and ellipses.
function glyph(kind,x,y,s){
 const out=[],r=(gx,gy,w,h,fill,radius=0)=>out.push({type:'rect',x:x+gx*s,y:y+gy*s,w:w*s,h:h*s,fill,stroke:'none',weight:0,...(radius?{radius:radius*s}:{})}),e=(gx,gy,w,h,fill)=>out.push({type:'ellipse',x:x+gx*s,y:y+gy*s,w:w*s,h:h*s,fill,stroke:'none',weight:0});
 const W='#FFFFFF',D=colorOf(kind);
 if(kind==='switch'){r(.14,.34,.72,.32,W,.04);for(let i=0;i<5;i++)r(.2+i*.125,.44,.08,.12,D);}
 else if(kind==='firewall'){for(let row=0;row<3;row++){const y0=.24+row*.18;if(row%2){r(.16,y0,.08,.13,W,.02);r(.28,y0,.2,.13,W,.02);r(.52,y0,.2,.13,W,.02);r(.76,y0,.08,.13,W,.02);}else for(let col=0;col<3;col++)r(.16+col*.24,y0,.2,.13,W,.02);}}
 else if(kind==='router'){e(.17,.17,.66,.66,W);r(.3,.47,.4,.06,D);r(.47,.3,.06,.4,D);}
 else if(kind==='ap'||kind==='controller'){e(.14,.44,.72,.26,W);e(.44,.52,.12,.1,D);r(.47,.2,.06,.2,W,.02);r(.3,.26,.06,.1,W,.02);r(.64,.26,.06,.1,W,.02);}
 else if(['server','hypervisor','hci','storage','virtual-machine'].includes(kind)){for(let i=0;i<3;i++){r(.2,.2+i*.21,.6,.16,W,.03);e(.66,.25+i*.21,.06,.06,D);}}
 else if(kind==='handoff'||kind==='cloud'){e(.12,.38,.34,.3,W);e(.3,.24,.4,.4,W);e(.54,.36,.34,.32,W);r(.2,.52,.6,.16,W);}
 else {r(.18,.2,.64,.42,W,.04);r(.24,.26,.52,.3,D);r(.44,.62,.12,.1,W);r(.32,.72,.36,.06,W,.02);}
 return out;
}

// Spread points (sorted by their desired positions) at least `gap` apart
// within [lo, hi], keeping their order. Overfull ranges compress evenly.
function spread(desired,lo,hi,gap){
 const n=desired.length;if(!n)return [];
 if(hi-lo<gap*(n-1))return desired.map((_,i)=>n===1?(lo+hi)/2:lo+(hi-lo)*i/(n-1));
 const x=desired.map(v=>Math.min(hi,Math.max(lo,v)));
 for(let i=1;i<n;i++)x[i]=Math.max(x[i],x[i-1]+gap);
 if(x[n-1]>hi){x[n-1]=hi;for(let i=n-2;i>=0;i--)x[i]=Math.min(x[i],x[i+1]-gap);}
 return x;
}
// Least-squares placement keeping order and spacing: x[i+1] >= x[i] + w[i] + gap.
function isotonic(desired,widths,gap){
 const n=desired.length,prefix=[0];for(let i=1;i<n;i++)prefix[i]=prefix[i-1]+widths[i-1]+gap;
 const blocks=[];
 for(let i=0;i<n;i++){blocks.push({sum:desired[i]-prefix[i],count:1});while(blocks.length>1&&blocks.at(-2).sum/blocks.at(-2).count>blocks.at(-1).sum/blocks.at(-1).count){const last=blocks.pop();blocks.at(-1).sum+=last.sum;blocks.at(-1).count+=last.count;}}
 const out=[];for(const b of blocks)for(let k=0;k<b.count;k++)out.push(b.sum/b.count);
 return out.map((s,i)=>s+prefix[i]);
}
// Track order for one band. A pin is where a run turns up or down out of the
// band. A run whose pin falls inside another run's span must be above it
// (pin up) or below it (pin down); runs whose spans overlap take separate
// tracks. Unavoidable conflicts (cycles) are broken by the earliest run.
function assignTracks(runs,pitch){
 const n=runs.length,above=runs.map(()=>new Set());
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(i===j)continue;const u=runs[j];for(const pin of runs[i].pins)if(pin.x>u.lo+.5&&pin.x<u.hi-.5){if(pin.up)above[j].add(i);else above[i].add(j);}}
 const track=new Array(n).fill(-1);let t=0,left=n;
 while(left){
  const placed=[];let progress=false;
  const order=[...runs.keys()].filter(i=>track[i]<0).sort((a,b)=>runs[a].lo-runs[b].lo||runs[b].hi-runs[a].hi);
  for(const i of order){if([...above[i]].some(k=>track[k]<0||track[k]===t))continue;if(placed.some(k=>runs[k].lo<runs[i].hi+pitch&&runs[i].lo<runs[k].hi+pitch))continue;placed.push(i);}
  if(!placed.length){const i=order.slice().sort((a,b)=>[...above[a]].filter(k=>track[k]<0).length-[...above[b]].filter(k=>track[k]<0).length)[0];placed.push(i);}
  for(const i of placed){track[i]=t;left--;progress=true;}
  if(progress)t++;
 }
 return {track,count:t};
}

export function siteMapPages(project,db){
 const settings=siteMapSettings(project);
 if(!db.devices.size)return [];
 const layout=project.layout||{},edits=layout.drawingEdits||{},baseSizes=textSizes(project);
 const source=settings.wan?siteHandoffs(db,layout.suppressedHandoffs):{devices:db.devices,links:db.links};
 const devices=[...source.devices.values()],links=source.links;
 // Devices in the user's (or the automatic hierarchy) order.
 const order=new Map((layout.order?.length?layout.order:hierarchyOrder(project)).map((id,i)=>[id,i]));
 const rank=d=>order.get(d.id)??(d.owner!=null&&order.has(d.owner)?order.get(d.owner)-.5:1e6);
 // Connected ports per device, for the port counts.
 const ports=new Map();for(const l of links)for(const [id,port] of [[l.a,l.ap],[l.b,l.bp]]){if(!ports.has(id))ports.set(id,new Set());ports.get(id).add(text(port));}

 // 1. Nodes: stacks become one card, every other device its own card.
 const nodes=new Map(),nodeOf=new Map(),deviceIds=new Set(devices.map(d=>d.id));
 for(const stack of cleanDeviceStacks(layout.deviceStacks,[...deviceIds])){
  const members=stack.members.map(m=>source.devices.get(m.deviceId)).filter(Boolean);if(!members.length)continue;
  const id='stack:'+stack.id;nodes.set(id,{id,name:stack.name,kind:members[0].kind,devices:members,stack:members.length});members.forEach(d=>nodeOf.set(d.id,id));
 }
 for(const d of devices)if(!nodeOf.has(d.id)){const id='device:'+d.id;nodes.set(id,{id,name:text(d.name)||d.id,kind:d.kind||'unknown',devices:[d],stack:(d.stackMembers||[]).length>1?d.stackMembers.length:0,sourceId:d.kind==='handoff'?null:d.id});nodeOf.set(d.id,id);}
 for(const node of nodes.values())node.rank=Math.min(...node.devices.map(rank));
 const neighbours=()=>{const map=new Map([...nodes.keys()].map(id=>[id,new Map()]));for(const l of links){const a=nodeOf.get(l.a),b=nodeOf.get(l.b);if(!a||!b||a===b)continue;map.get(a).set(b,(map.get(a).get(b)||0)+1);map.get(b).set(a,(map.get(b).get(a)||0)+1);}return map;};
 let adjacent=neighbours();

 // 2. Levels: the edge at 0, infrastructure by distance from the edge, then
 // everything else one level below the device it connects to.
 const level=new Map();
 for(const node of nodes.values())if(EDGE.has(node.kind))level.set(node.id,0);
 const infra=[...nodes.values()].filter(n=>INFRA.has(n.kind)),seen=new Set();
 for(const start of infra.slice().sort((a,b)=>a.rank-b.rank)){
  if(seen.has(start.id))continue;
  const component=[],queue=[start.id];seen.add(start.id);
  while(queue.length){const id=queue.shift();component.push(id);for(const next of adjacent.get(id).keys())if(!seen.has(next)&&INFRA.has(nodes.get(next).kind)){seen.add(next);queue.push(next);}}
  let roots=component.filter(id=>nodes.get(id).kind!=='switch'||[...adjacent.get(id).keys()].some(k=>EDGE.has(nodes.get(k).kind)));
  if(!roots.length)roots=[component.slice().sort((a,b)=>[...adjacent.get(b).keys()].filter(k=>INFRA.has(nodes.get(k).kind)).length-[...adjacent.get(a).keys()].filter(k=>INFRA.has(nodes.get(k).kind)).length||nodes.get(a).rank-nodes.get(b).rank)[0]];
  const depth=new Map(roots.map(id=>[id,0])),q=[...roots];
  while(q.length){const id=q.shift();for(const next of adjacent.get(id).keys())if(component.includes(next)&&!depth.has(next)){depth.set(next,depth.get(id)+1);q.push(next);}}
  for(const id of component)level.set(id,1+(depth.get(id)??0));
 }
 // Everything else: breadth first from the placed levels.
 let frontier=[...level.keys()].sort((a,b)=>level.get(a)-level.get(b));
 while(frontier.length){
  const next=[];
  for(const id of frontier)for(const other of adjacent.get(id).keys())if(!level.has(other)){level.set(other,level.get(id)+1);next.push(other);}
  frontier=next.sort((a,b)=>level.get(a)-level.get(b));
 }
 // Groups of devices connected only to each other start at level 1.
 for(const node of [...nodes.values()].sort((a,b)=>adjacent.get(b.id).size-adjacent.get(a.id).size||a.rank-b.rank)){
  if(level.has(node.id)||!adjacent.get(node.id).size)continue;
  level.set(node.id,1);const q=[node.id];
  while(q.length){const id=q.shift();for(const other of adjacent.get(id).keys())if(!level.has(other)){level.set(other,level.get(id)+1);q.push(other);}}
 }
 const parentOf=id=>[...adjacent.get(id)].filter(([other])=>level.has(other)&&level.get(other)<level.get(id)).sort((a,b)=>level.get(a[0])-level.get(b[0])||b[1]-a[1]||nodes.get(a[0]).rank-nodes.get(b[0]).rank)[0]?.[0]||null;

 // 3. Access points (and, when chosen, other devices) of one parent share a card.
 const groupable=node=>!node.stack&&node.devices.length===1&&(node.kind==='ap'?settings.accessPoints:INFRA.has(node.kind)||EDGE.has(node.kind)?null:settings.endpoints);
 const groups=new Map();
 for(const node of [...nodes.values()]){
  const mode=groupable(node);if(!mode||mode==='each')continue;
  if(mode==='hidden'){nodes.delete(node.id);continue;}
  const parent=level.has(node.id)?parentOf(node.id):null,key=(node.kind==='ap'?'aps':'kind:'+node.kind)+'/'+(parent||'none');
  if(!groups.has(key))groups.set(key,{parent,kind:node.kind,members:[]});groups.get(key).members.push(node);
 }
 for(const [key,group] of groups){
  if(group.members.length<2)continue;
  const id='group:'+key,members=group.members.sort((a,b)=>a.rank-b.rank),word=group.kind==='ap'?'access points':ENDPOINT_PLURAL[group.kind]||'devices';
  nodes.set(id,{id,name:members.length+' '+word,kind:group.kind,devices:members.flatMap(m=>m.devices),group:members.length,rank:members[0].rank,sourceId:null});
  level.set(id,level.get(members[0].id)??null);if(level.get(id)==null)level.delete(id);
  for(const m of members){nodes.delete(m.id);for(const d of m.devices)nodeOf.set(d.id,id);}
 }
 for(const [deviceId,id] of [...nodeOf])if(!nodes.has(id))nodeOf.delete(deviceId);
 adjacent=neighbours();
 const unconnected=[...nodes.values()].filter(n=>!adjacent.get(n.id).size&&!level.has(n.id));
 if(!settings.unconnected)for(const n of unconnected)nodes.delete(n.id);
 if(!nodes.size)return [];

 // 4. Edges: one per pair of cards, with every link between them.
 const edges=new Map();
 for(const l of links){
  const a=nodeOf.get(l.a),b=nodeOf.get(l.b);if(!a||!b||a===b||!nodes.has(a)||!nodes.has(b))continue;
  const key=[a,b].sort().join('~');if(!edges.has(key))edges.set(key,{key,a,b,links:[]});edges.get(key).links.push(l);
 }

 // Card text, with any saved wording.
 const scope=SITE_MAP_PAGE,keyOf=(node,part)=>scope+'|node|'+node.id+(part?'|'+part:'');
 for(const node of nodes.values()){
  node.lines=details(node,settings,ports);
  node.name=edits[keyOf(node,'name')]?.value??node.name;
  node.lines=node.lines.map(([key,value])=>[key,edits[keyOf(node,'detail|'+key)]?.value??value]).filter(([,value])=>text(value));
 }
 // Levels and their order do not depend on the page; plan() places them.
 const lastLevel=Math.max(0,...[...nodes.values()].filter(n=>level.has(n.id)).map(n=>level.get(n.id)));
 const levelOf=n=>level.has(n.id)?level.get(n.id):lastLevel+1;
 // A card connected only to one device above it (an access point group, a
 // single-homed server) is a leaf: it sits with that device instead of in a
 // row of its own, so its line stays short.
 const leafParent=new Map(),leavesOf=new Map();
 for(const n of [...nodes.values()].sort((a,b)=>a.rank-b.rank)){
  if(INFRA.has(n.kind)||EDGE.has(n.kind)||!level.has(n.id))continue;
  const near=[...adjacent.get(n.id).keys()].filter(k=>nodes.has(k));if(near.length!==1)continue;
  const parent=nodes.get(near[0]);if(!level.has(parent.id)||level.get(parent.id)>=level.get(n.id))continue;
  leafParent.set(n.id,parent.id);if(!leavesOf.has(parent.id))leavesOf.set(parent.id,[]);leavesOf.get(parent.id).push(n);
 }
 for(const [id] of leafParent)if(leavesOf.has(id)){for(const leaf of leavesOf.get(id))leafParent.delete(leaf.id);leavesOf.delete(id);}
 const levels=[...new Set([...nodes.values()].filter(n=>!leafParent.has(n.id)).map(levelOf))].sort((a,b)=>a-b);
 const members=new Map(levels.map(l=>[l,[...nodes.values()].filter(n=>!leafParent.has(n.id)&&levelOf(n)===l).sort((a,b)=>a.rank-b.rank)]));
 // Crossing reduction: order each level by the mean position of its
 // neighbours on the levels already ordered, down then up then down.
 const position=new Map();for(const l of levels)members.get(l).forEach((n,i,all)=>position.set(n.id,(i+.5)/all.length));
 for(const pass of [1,-1,1]){
  for(const l of pass>0?levels:levels.slice().reverse()){
   const row=members.get(l),score=new Map(row.map(n=>{const near=[...adjacent.get(n.id).keys()].filter(k=>nodes.has(k)&&(pass>0?levelOf(nodes.get(k))<l:levelOf(nodes.get(k))>l));return [n.id,near.length?near.reduce((s,k)=>s+position.get(k),0)/near.length:position.get(n.id)];}));
   row.sort((a,b)=>score.get(a.id)-score.get(b.id)||a.rank-b.rank);row.forEach((n,i)=>position.set(n.id,(i+.5)/row.length));
  }
 }
 // Connection types, widths (a line keeps its own saved width) and captions.
 const kindOf=link=>mediaInfo(link.media,[link.a,link.b].some(id=>source.devices.get(id)?.kind==='ap'));
 for(const edge of edges.values()){
  const types=edge.links.map(kindOf),counts=new Map();for(const t of types)counts.set(t.name,(counts.get(t.name)||0)+1);
  const name=[...counts].sort((a,b)=>b[1]-a[1])[0][0];edge.type=types.find(t=>t.name===name);
  edge.editKey=scope+'|line|'+edge.key;const own=edits[edge.editKey]?.weight;edge.ownWeight=Number.isFinite(own)&&own>0&&own<=12000;edge.weight=edge.ownWeight?own:linkWeight(project,edge.type.name);
  edge.caption=edits[scope+'|link|'+edge.key]?.value??caption(edge);
  edge.generated=edge.links.map(l=>[l.a,l.b].map(id=>source.devices.get(id)).find(d=>d?.kind==='handoff'&&!project.devices?.some(x=>x.id===d.id))).find(Boolean)||null;
 }

 // Top-down (levels as rows) or left to right (levels as columns). A fixed
 // drawing page is filled at the largest scale that fits it (text never
 // below 8 units); a dynamic page grows around the full-size map.
 const geometry=pageGeometry(project,'sitemap'),directions=settings.direction==='down'?[false]:settings.direction==='right'?[true]:[false,true];
 // Planned pages carry a shrink helper only while they are being chosen.
 const done=p=>{delete p.shrinkToFit;return [p];};
 if(geometry.dynamic){
  const candidates=directions.map(T=>plan(1,T,false));if(candidates.length===1)return done(candidates[0]);
  // Automatic: left to right only when it is clearly closer to the page shape.
  const miss=p=>Math.abs(Math.log(p.mapWidth/Math.max(1,p.mapHeight)/1.6));
  return done(miss(candidates[1])<miss(candidates[0])*.7?candidates[1]:candidates[0]);
 }
 // The first arrangement that fits at full size wins; otherwise the one that
 // fits at the largest scale (the key may move to a column at the left),
 // found by bisection from the smallest readable scale.
 const arrangements=directions.flatMap(T=>[[T,false],[T,true]]),MIN=.4;
 const full=plan(1,...arrangements[0]);if(full.mapFits)return done(full);
 let best=null,closest=null;
 for(const [T,side] of arrangements){
  const small=plan(MIN,T,side);
  if(!small.mapFits){if(!closest||small.shrink>closest.shrink)closest=small;continue;}
  let lo=MIN,fit=small,hi=1;
  for(let i=0;i<4;i++){const mid=(lo+hi)/2;if(best&&mid<=best.siteMapScale){lo=mid;continue;}const p=plan(mid,T,side);if(p.mapFits){lo=mid;fit=p;}else hi=mid;}
  if(!best||fit.siteMapScale>best.siteMapScale)best=fit;
 }
 // Nothing fits with readable text: the whole map shrinks to the page (the
 // page notice reports the printed text size) instead of running off it.
 if(!best){closest.shrinkToFit();best=closest;}
 return done(best);

 function caption(edge){
  if(settings.linkLabels==='ports')return edge.links.length===1?[edge.links[0].ap,edge.links[0].bp].map(text).filter(Boolean).join(' – '):edge.links.length+' links';
  const speeds=[...new Set(edge.links.map(l=>rate(l.speed)).filter(Boolean))],lag=edge.links.some(l=>text(l.lag||l.aggregate));
  if(!speeds.length)return edge.links.length>1?edge.links.length+' links'+(lag?' (LAG)':''):'';
  return (edge.links.length>1?edge.links.length+' × ':'')+speeds.join(' / ')+(lag?' LAG':'');
 }

 // Layout works in two axes: u runs along a level (across the page for
 // top-down, down the page for left to right) and v across the levels.
 function plan(factor,T,side){
 const GAP=48*factor,PITCH=Math.max(4,8*factor),BAND_PAD=12*factor,TILE=34*factor,PAD=10*factor,MIN_W=184*factor,MAX_W=252,INSET=14*factor;
 const sizes=Object.fromEntries(Object.entries(baseSizes).map(([k,v])=>[k,Math.min(v,Math.max(8,v*factor))]));
 const labels=settings.linkLabels!=='none';
 const page=fresh(SITE_MAP_PAGE,'Site map','Hardware hierarchy and connections between devices',project);
 // The connection key goes under the heading; the map starts below it.
 // A key in a column at the left leaves the map the full height below the heading.
 const keyWidth=side?Math.min(260,Math.max(200,page.width*.26)):0;
 // Line widths follow the map's scale; a line's own saved width stays.
 for(const edge of edges.values())edge.drawn=edge.ownWeight?edge.weight:Math.max(1.5,edge.weight*factor);
 const probe={name:page.name,width:side?keyWidth+72:page.width,editScope:page.editScope,items:[...edges.values()].map(edge=>({type:'path',points:[[0,0],[1,0]],color:edge.type.color,linkType:edge.type.name,weight:edge.drawn,sourceLink:edge.links[0]}))},probes=probe.items.length;
 linkLegend(probe);page.items.push(...probe.items.slice(probes));
 const top=side?160:(Number.isFinite(probe.legendBottom)?probe.legendBottom:146)+(edges.size?34:24),areaLeft=36+(side?keyWidth+24:0),areaWidth=page.width-36-areaLeft;
 // Card sizes from measured text. A grouped or stacked card draws a second
 // card 5 units behind it.
 const needed=Math.max(...[...nodes.values()].map(n=>Math.max(textWidth(n.name,sizes.name,true),...n.lines.map(([,v])=>textWidth(v,sizes.detail,false)))));
 const cardW=Math.min(MAX_W,Math.max(MIN_W,needed+TILE+PAD*3+2));
 const span=(node,w)=>w-TILE-PAD*3-(node.group||node.stack?5:0);
 const measure=(node,w=cardW)=>{const room=span(node,w),name=wrap(node.name,room,sizes.name,true).length,lines=node.lines.reduce((n,[,v])=>n+wrap(v,room,sizes.detail,false).length,0);return Math.ceil(Math.max(TILE+PAD*2,PAD+name*sizes.name*1.25+2+lines*sizes.detail*1.3+PAD-2)+(node.group||node.stack?5:0));};
 for(const n of nodes.values()){n.w=cardW;n.h=measure(n);n.lu=T?n.h:n.w;n.lv=T?n.w:n.h;n.ulu=n.lu;n.ulv=n.lv;}
 // Link captions sit before the card they enter: above it (top-down) or to
 // its left (left to right), which needs room for the widest caption.
 const widest=Math.max(0,...[...edges.values()].map(e=>text(e.caption)?textWidth(e.caption,sizes.link,false):0));
 // Left to right, a caption may wrap onto a second line.
 const LZ=!labels||!widest?6*factor+4:T?Math.min(widest+14,Math.max(64,96*factor)):Math.max(17*factor,sizes.link*1.3+3);

 // Leaf units. Below the parent, leaves stand in columns, each column fed by
 // a spine at its left; beside the parent (when the parent also has devices
 // further down) they stand in one column to its right.
 const SPINE=12*factor,leafGap=labels&&widest?(T?LZ:sizes.link*1.3+7):10*factor;
 for(const [parentId,leaves] of leavesOf){
  const p=nodes.get(parentId),down=[...adjacent.get(parentId).keys()].some(k=>nodes.has(k)&&!leafParent.has(k)&&levelOf(nodes.get(k))>levelOf(p));
  const unit={mode:down?'side':'below',leaves,columns:[]},k=down?1:leaves.length<=4?1:Math.min(4,Math.ceil(leaves.length/4)),per=Math.ceil(leaves.length/k),leafLu=Math.max(...leaves.map(l=>l.lu));
  for(let j=0;j<k;j++)unit.columns.push(leaves.slice(j*per,j*per+per));
  if(down){
   unit.spines=[p.lu+SPINE];unit.cols=[p.lu+SPINE*2];let v=0;unit.columns[0].forEach((leaf,i)=>{leaf.uOff=unit.cols[0];leaf.vOff=v+(i?leafGap:0);v=leaf.vOff+leaf.lv;});
   p.ulu=p.lu+SPINE*2+leafLu;p.ulv=Math.max(p.lv,v);
  }else{
   const step=leafLu+Math.max(GAP,SPINE*2);unit.spines=unit.columns.map((_,j)=>INSET+2+j*step);unit.cols=unit.spines.map(u=>u+SPINE);unit.bus=k>1?p.lv+14*factor:null;
   let depth=0;unit.columns.forEach((column,j)=>{let v=p.lv+(k>1?14*factor:0);for(const leaf of column){leaf.uOff=unit.cols[j];leaf.vOff=v+leafGap;v=leaf.vOff+leaf.lv;}depth=Math.max(depth,v);});
   p.ulu=Math.max(p.lu,unit.cols.at(-1)+leafLu);p.ulv=depth;
  }
  p.unit=unit;
 }
 // Rows: one per level, crowded levels wrapping onto further rows.
 const aspect=geometry.dynamic?1.6:Math.max(.6,areaWidth/Math.max(200,geometry.height-top-24));
 const split=new Map(levels.map(l=>[l,1]));
 const rowsFor=()=>levels.flatMap(l=>{const all=members.get(l),k=split.get(l),per=Math.ceil(all.length/k);return Array.from({length:k},(_,i)=>({level:l,nodes:all.slice(i*per,i*per+per)})).filter(r=>r.nodes.length);});
 let rows,length,depth;
 const place=()=>{
  rows=rowsFor();rows.forEach((row,r)=>row.nodes.forEach(n=>{n.row=r;}));
  // Each card as close as possible to the mean of its neighbours on other
  // rows, keeping order and spacing (least squares).
  rows.forEach(row=>{let u=0;for(const n of row.nodes){n.u=u;u+=n.ulu+GAP;}});
  for(let iteration=0;iteration<4;iteration++){
   for(const row of iteration%2?rows.slice().reverse():rows){
    const desired=row.nodes.map(n=>{const near=[...adjacent.get(n.id).keys()].map(k=>nodes.get(k)).filter(k=>k&&!leafParent.has(k.id)&&k.row!==n.row);return near.length?near.reduce((s,k)=>s+k.u+k.lu/2,0)/near.length-n.lu/2:n.u;});
    isotonic(desired,row.nodes.map(n=>n.ulu),GAP).forEach((u,i)=>{row.nodes[i].u=u;});
   }
  }
  const first=Math.min(...rows.flatMap(r=>r.nodes.map(n=>n.u)));for(const row of rows)for(const n of row.nodes)n.u-=first;
  length=Math.max(...rows.flatMap(r=>r.nodes.map(n=>n.u+n.ulu)));depth=rows.reduce((s,r)=>s+Math.max(...r.nodes.map(n=>n.ulv))+LZ+40*factor,0);
 };
 place();
 // Wrap the longest level while the map is far from the page shape or
 // (fixed pages) longer than the page allows.
 const room=T?geometry.height-top-30:areaWidth;
 for(let i=0;i<40;i++){
  const tooLong=!geometry.dynamic&&length>room,shape=T?length/depth>1.15/aspect:length/depth>aspect*1.15;if(!tooLong&&!shape)break;
  const longest=levels.map(l=>[l,Math.ceil(members.get(l).length/split.get(l))]).sort((a,b)=>b[1]-a[1])[0];
  if(!longest||longest[1]<=(tooLong?1:2))break;split.set(longest[0],split.get(longest[0])+1);place();
 }

 // Routing skeletons. Saved card positions are applied afterwards; their
 // connections use a direct elbow instead of the row channels.
 const rowNodes=rows.map(r=>r.nodes.slice().sort((a,b)=>a.u-b.u));
 const gapsOf=r=>{const list=rowNodes[r],out=[{lo:-Infinity,hi:list[0].u}];for(let i=1;i<list.length;i++)out.push({lo:list[i-1].u+list[i-1].ulu,hi:list[i].u});out.push({lo:list.at(-1).u+list.at(-1).ulu,hi:Infinity});return out;};
 const gapCenter=g=>Number.isFinite(g.lo)&&Number.isFinite(g.hi)?(g.lo+g.hi)/2:Number.isFinite(g.lo)?g.lo+GAP/2:g.hi-GAP/2;
 const moved=new Set([...nodes.values()].filter(n=>['x','y'].some(k=>Number.isFinite(edits[keyOf(n)]?.[k]))).map(n=>n.id));
 const routed=[],direct=[],sideBySide=[],leafEdges=[];
 for(const edge of edges.values()){
  const leaf=leafParent.has(edge.a)?edge.a:leafParent.has(edge.b)?edge.b:null;
  if(leaf){const p=nodes.get(leafParent.get(leaf));Object.assign(edge,{upper:p,lower:nodes.get(leaf),passes:[],runs:[],over:false});(moved.has(leaf)||moved.has(p.id)?direct:leafEdges).push(edge);continue;}
  let a=nodes.get(edge.a),b=nodes.get(edge.b);if(a.row>b.row||a.row===b.row&&a.u>b.u)[a,b]=[b,a];
  Object.assign(edge,{upper:a,lower:b,passes:[],runs:[],over:false});
  if(moved.has(a.id)||moved.has(b.id)){direct.push(edge);continue;}
  if(a.row===b.row&&a.unit?.mode!=='side'){const list=rowNodes[a.row],i=list.indexOf(a),j=list.indexOf(b);if(j===i+1){sideBySide.push(edge);continue;}}
  // Passages between cards of the rows in between, nearest the straight line.
  const au=a.u+a.lu/2,bu=b.u+b.lu/2;
  for(let r=a.row+1;r<b.row;r++){const t=(r-a.row)/(b.row-a.row),want=au+(bu-au)*t,gap=gapsOf(r).sort((g,h)=>Math.abs(gapCenter(g)-want)-Math.abs(gapCenter(h)-want))[0];edge.passes.push({row:r,gap,u:gapCenter(gap)});}
  edge.over=a.row===b.row;routed.push(edge);
 }
 // Card edge points: departures along the far side (the near side for a run
 // over the row), arrivals along the near side, ordered by where each run
 // goes next. Captions before a card need room between arrivals.
 const ends=new Map(),endList=(node,side)=>{const key=node.id+'|'+side;if(!ends.has(key))ends.set(key,[]);return ends.get(key);};
 for(const edge of routed){
  const a=edge.upper,b=edge.lower,first=edge.passes[0]?.u??b.u+b.lu/2,last=edge.passes.at(-1)?.u??a.u+a.lu/2;
  endList(a,edge.over?'near':'far').push({edge,end:'a',toward:edge.over?b.u+b.lu/2:first});
  endList(b,'near').push({edge,end:'b',toward:edge.over?a.u+a.lu/2:last});
 }
 for(const [key,list] of ends){
  const node=nodes.get(key.slice(0,key.lastIndexOf('|')));list.sort((p,q)=>p.toward-q.toward);
  const gap=!labels?14*factor:T?sizes.link*2.6+6:Math.min(56,Math.max(14,(node.lu-24)/Math.max(1,list.length)));
  const us=spread(list.map(p=>p.toward),node.u+INSET,node.u+node.lu-INSET,gap);list.forEach((p,i)=>{p.edge[p.end+'U']=us[i];});
 }
 // A lone link between two cards that nearly line up runs straight.
 for(const edge of routed){
  if(edge.over||edge.passes.length||ends.get(edge.upper.id+'|far')?.length!==1||ends.get(edge.lower.id+'|near')?.length!==1||Math.abs(edge.aU-edge.bU)>24*factor)continue;
  const lo=Math.max(edge.upper.u,edge.lower.u)+INSET,hi=Math.min(edge.upper.u+edge.upper.lu,edge.lower.u+edge.lower.lu)-INSET,u=Math.min(hi,Math.max(lo,(edge.aU+edge.bU)/2));
  if(lo<=hi){edge.aU=u;edge.bU=u;}
 }
 // Passages: several runs through one gap are spread across it.
 const passages=new Map();
 for(const edge of routed)edge.passes.forEach((pass,i)=>{const key=pass.row+'|'+pass.gap.lo+'|'+pass.gap.hi;if(!passages.has(key))passages.set(key,[]);const prev=i?edge.passes[i-1].u:edge.aU,next=edge.passes[i+1]?.u??edge.bU;passages.get(key).push({pass,want:(prev+next)/2});});
 for(const list of passages.values()){
  const {gap}=list[0].pass;list.sort((p,q)=>p.want-q.want);
  const lo=Number.isFinite(gap.lo)?gap.lo+10*factor:gap.hi-INSET-PITCH*(list.length-1),hi=Number.isFinite(gap.hi)?gap.hi-10*factor:gap.lo+INSET+PITCH*(list.length-1);
  const us=list.length===1?[Math.min(hi,Math.max(lo,Number.isFinite(gap.lo)&&Number.isFinite(gap.hi)?(gap.lo+gap.hi)/2:list[0].want))]:spread(list.map(p=>p.want),lo,hi,PITCH);
  list.forEach((p,i)=>{p.pass.u=us[i];});
 }
 // Runs per band: band r lies before row r. A run over the row uses the band
 // before its row; a run across uses the bands after its upper card's row.
 const bands=new Map(),band=r=>{if(!bands.has(r))bands.set(r,[]);return bands.get(r);};
 for(const edge of routed){
  if(edge.over){const run={lo:Math.min(edge.aU,edge.bU),hi:Math.max(edge.aU,edge.bU),pins:[{x:edge.aU,up:false},{x:edge.bU,up:false}]};band(edge.upper.row).push(run);edge.runs.push({band:edge.upper.row,run});continue;}
  const us=[edge.aU,...edge.passes.map(p=>p.u),edge.bU];
  for(let k=0;k<us.length-1;k++){const r=edge.upper.row+1+k,run={lo:Math.min(us[k],us[k+1]),hi:Math.max(us[k],us[k+1]),pins:[{x:us[k],up:true},{x:us[k+1],up:false}],from:us[k],to:us[k+1]};edge.runs.push({band:r,run});if(Math.abs(us[k]-us[k+1])>.5)band(r).push(run);else run.straight=true;}
 }
 const trackCount=new Map();
 for(const [r,runs] of bands){const {track,count}=assignTracks(runs,PITCH);runs.forEach((run,i)=>{run.track=track[i];});trackCount.set(r,count);}
 // Positions across the levels: band depths from their tracks and captions.
 const bandDepth=r=>BAND_PAD+(trackCount.get(r)||0)*PITCH+LZ+6*factor;
 let v=0;const bandStart=new Map();
 rows.forEach((row,r)=>{bandStart.set(r,v);v+=r===0?(trackCount.get(0)?bandDepth(0):0):Math.max(bandDepth(r),36*factor);for(const n of row.nodes)n.v=v;v+=Math.max(...row.nodes.map(n=>n.ulv));});
 for(const [id,leaves] of leavesOf){const p=nodes.get(id);for(const leaf of leaves){leaf.u=p.u+leaf.uOff;leaf.v=p.v+leaf.vOff;leaf.row=p.row;}}
 const mapDepth=v,trackV=(r,t)=>bandStart.get(r)+BAND_PAD+t*PITCH;
 // Page coordinates: centered across the page, below the key.
 const mapW=T?mapDepth:length,mapH=T?length:mapDepth,left=areaLeft+Math.max(0,(areaWidth-mapW)/2);
 const real=(u,vv)=>T?[left+vv,top+u]:[left+u,top+vv];
 for(const n of nodes.values()){[n.x,n.y]=real(n.u,n.v);}
 for(const n of nodes.values()){const own=edits[keyOf(n)];if(own){for(const k of ['x','y','w','h'])if(Number.isFinite(own[k]))n[k]=own[k];if(Number.isFinite(own.w)||Number.isFinite(own.h))n.h=Math.max(measure(n,n.w),Number.isFinite(own.h)?own.h:0);}}

 // Cards, with their name and details as editable text.
 const items=[],cards=new Map();
 for(const n of [...nodes.values()].sort((a,b)=>a.row-b.row||a.u-b.u)){
  const stacked=n.group||n.stack,w=n.w,h=n.h,border='#9FB4BE',children=[],radius=Math.max(4,8*factor);
  if(stacked)children.push({type:'rect',x:5,y:5,w:w-5,h:h-5,fill:'#F4F8F9',stroke:border,weight:1.2,radius,name:'Stacked card'});
  children.push({type:'rect',x:0,y:0,w:stacked?w-5:w,h:stacked?h-5:h,fill:C.white,stroke:border,weight:1.2,radius,name:'Card'});
  children.push({type:'rect',x:PAD,y:PAD,w:TILE,h:TILE,fill:colorOf(n.kind),stroke:'none',weight:0,radius:radius*.85,name:deviceKindLabel(n.kind)+' icon'});
  children.push(...glyph(n.kind,PAD,PAD,TILE));
  const card={type:'device',key:keyOf(n),editKey:keyOf(n),sourceId:n.sourceId??undefined,...(n.sourceId?{}:{memberIds:n.devices.map(d=>d.id)}),siteMapNode:n.id,name:n.name,kind:n.kind,model:'',x:n.x,y:n.y,w,h,asset:null,fallback:false,ports:Object.create(null),
   children:children.map((c,i)=>({...c,x:c.x/w,y:c.y/h,w:c.w/w,h:c.h/h,editSlot:i})),masterKey:''};
  cards.set(n.id,card);items.push(card);
  let ty=n.y+PAD-1;const tx=n.x+PAD*2+TILE,room=span(n,w),nameLines=wrap(n.name,room,sizes.name,true);
  label(items,tx,ty,room,nameLines.length*sizes.name*1.25,n.name,sizes.name,true,C.ink);Object.assign(items.at(-1),{editKey:keyOf(n,'name'),siteMapSlot:'name',siteMapOwner:n.id,...(n.sourceId?{deviceOwner:n.sourceId}:{}),full:true});
  ty+=nameLines.length*sizes.name*1.25+2;
  for(const [key,value] of n.lines){const lines=wrap(value,room,sizes.detail,false);label(items,tx,ty,room,lines.length*sizes.detail*1.3,value,sizes.detail,false,C.muted);Object.assign(items.at(-1),{editKey:keyOf(n,'detail|'+key),siteMapSlot:'detail',siteMapOwner:n.id,...(n.sourceId?{deviceOwner:n.sourceId}:{}),full:true});ty+=lines.length*sizes.detail*1.3;}
 }
 // Connections.
 const paths=[];
 const attach=(edge,end,[x,y])=>{const card=cards.get((end==='a'?edge.upper:edge.lower).id),port='c:'+edge.key+':'+end;card.ports[port]=[(x-card.x)/card.w,(y-card.y)/card.h];return {device:card.key,port,x,y,weight:edge.drawn};};
 const draw=points=>edge=>{
  const clean=points.filter((p,i)=>!i||p[0]!==points[i-1][0]||p[1]!==points[i-1][1]);
  paths.push({type:'path',editKey:edge.editKey,from:attach(edge,'a',clean[0]),to:attach(edge,'b',clean.at(-1)),points:clean,color:edge.type.color,name:edge.upper.name+' – '+edge.lower.name,linkType:edge.type.name,sourceLink:edge.links[0],generatedDevice:edge.generated,weight:edge.drawn,siteMapEdge:edge.key,siteMapLinks:edge.links.length,...(leafParent.has(edge.lower.id)?{siteMapLeaf:true}:{})});
 };
 // A caption keeps to its own room: it may shrink a little, or wrap onto two
 // lines where the room allows (left to right); otherwise it is left out.
 const linkLabel=(edge,x,y,w,align='left',lines=1)=>{const value=edge.caption;if(!labels||!text(value)||w<18)return;let size=sizes.link;const fits=sz=>lines>1?wrap(value,w,sz,false).length<=lines&&wrap(value,w,sz,false).every(l=>textWidth(l,sz,false)<=w+6):textWidth(value,sz,false)<=w;while(size>8.5&&!fits(size))size-=.5;if(!fits(size))return;const n=lines>1?wrap(value,w,size,false).length:1;label(items,align==='center'?x-w/2:x,y-(n-1)*size*1.3,w,n*size*1.3,value,size,false,C.muted,align);Object.assign(items.at(-1),{editKey:scope+'|link|'+edge.key,siteMapSlot:'link',full:true});};
 for(const edge of routed){
  const a=edge.upper,b=edge.lower,pts=[];
  if(edge.over){const tv=trackV(a.row,edge.runs[0].run.track);pts.push([edge.aU,a.v],[edge.aU,tv],[edge.bU,tv],[edge.bU,b.v]);}
  else{pts.push([edge.aU,a.v+a.lv]);for(const {band:r,run} of edge.runs)if(!run.straight){const tv=trackV(r,run.track);pts.push([run.from,tv],[run.to,tv]);}pts.push([edge.bU,b.v]);}
  // Join consecutive points orthogonally, then map to the page.
  const orth=[pts[0]];for(const p of pts.slice(1)){const q=orth.at(-1);if(q[0]!==p[0]&&q[1]!==p[1])orth.push([q[0],p[1]]);orth.push(p);}
  draw(orth.map(([u,vv])=>real(u,vv)))(edge);
  // The caption sits beside the run entering the lower card.
  const [ex,ey]=real(edge.bU,b.v);
  if(T)linkLabel(edge,ex-LZ+3,ey-sizes.link*1.3-1,LZ-6,'left',2);
  else{const next=(ends.get(b.id+'|near')||[]).map(p=>real(p.edge[p.end+'U'],0)[0]).filter(x=>x>ex+.5).sort((p,q)=>p-q)[0]??b.x+b.w;linkLabel(edge,ex+4,ey-LZ+1,Math.min(next,b.x+b.w)-ex-8);}
 }
 for(const edge of leafEdges){
  const p=edge.upper,leaf=edge.lower,unit=p.unit,j=unit.columns.findIndex(c=>c.includes(leaf)),spine=p.u+unit.spines[j],entry=leaf.v+PAD+TILE/2,pts=[];
  if(unit.mode==='side'){const at=p.v+PAD+TILE/2;pts.push([p.u+p.lu,at],[spine,at],[spine,entry],[leaf.u,entry]);}
  else{pts.push([p.u+unit.spines[0],p.v+p.lv]);if(unit.bus!=null)pts.push([p.u+unit.spines[0],p.v+unit.bus],[spine,p.v+unit.bus]);pts.push([spine,entry],[leaf.u,entry]);}
  draw(pts.map(([u,vv])=>real(u,vv)))(edge);
  if(T)linkLabel(edge,leaf.x-LZ+3,leaf.y+2,LZ-6,'left',2);else linkLabel(edge,leaf.x+2,leaf.y-sizes.link*1.3-2,leaf.w-4);
 }
 for(const edge of sideBySide){
  const a=edge.upper,b=edge.lower,mid=Math.min(a.v+a.lv/2,b.v+b.lv/2),p=real(a.u+a.lu,mid),q=real(b.u,mid);
  draw([p,q])(edge);
  if(T)linkLabel(edge,p[0]+5,(p[1]+q[1])/2-sizes.link*.65,a.w/2-10);else linkLabel(edge,(p[0]+q[0])/2,p[1]-sizes.link*1.3-3,q[0]-p[0]-6,'center');
 }
 for(const edge of direct){
  const a=edge.upper,b=edge.lower,acx=a.x+a.w/2,bcx=b.x+b.w/2,pts=b.y>=a.y+a.h+16?[[acx,a.y+a.h],[acx,(a.y+a.h+b.y)/2],[bcx,(a.y+a.h+b.y)/2],[bcx,b.y]]:a.y>=b.y+b.h+16?[[acx,a.y],[acx,(a.y+b.y+b.h)/2],[bcx,(a.y+b.y+b.h)/2],[bcx,b.y+b.h]]:a.x+a.w<=b.x?[[a.x+a.w,a.y+a.h/2],[(a.x+a.w+b.x)/2,a.y+a.h/2],[(a.x+a.w+b.x)/2,b.y+b.h/2],[b.x,b.y+b.h/2]]:[[a.x,a.y+a.h/2],[(a.x+b.x+b.w)/2,a.y+a.h/2],[(a.x+b.x+b.w)/2,b.y+b.h/2],[b.x+b.w,b.y+b.h/2]];
  draw(pts)(edge);
 }
 // Devices without a recorded connection.
 const loose=rows.at(-1)?.nodes.filter(n=>!level.has(n.id))||[];
 if(loose.length&&!loose.some(n=>moved.has(n.id))){const first=loose.reduce((m,n)=>n.u<m.u?n:m);label(items,first.x,first.y-20*Math.max(.8,factor),T?cardW:Math.max(240,cardW),16,'Devices without a recorded connection',Math.max(8,11*factor),true,C.muted);Object.assign(items.at(-1),{editKey:scope+'|unconnected-heading',full:true});}
 // Each card's master is specific to its size, icon and connection points.
 for(const card of cards.values()){let hash=0;for(const c of JSON.stringify([card.kind,Math.round(card.w),Math.round(card.h),card.children.length,Object.entries(card.ports)]))hash=Math.imul(hash,31)+c.charCodeAt(0)|0;card.masterKey='sitemap:'+card.kind+':'+(hash>>>0).toString(36);}

 // Cards and their text are drawn over the connections that enter them.
 page.items.push(...paths,...items);
 page.siteMap={direction:T?'right':'down',nodes:[...nodes.values()].map(n=>({id:n.id,name:n.name,kind:n.kind,devices:n.devices.map(d=>d.id),level:level.get(n.id)??null,group:n.group||0,stack:n.stack||0})),edges:[...edges.values()].map(e=>({key:e.key,a:e.a,b:e.b,links:e.links.length}))};
 const solid=page.items.filter(i=>i.type!=='path'),right=Math.max(...solid.map(i=>i.x+(i.w||0))),bottom=Math.max(...solid.map(i=>i.y+(i.h||0)));
 // The map's own items (not the heading or key) and their bounds.
 const own=[...paths,...items],points=own.flatMap(i=>i.type==='path'?i.points:[[i.x,i.y],[i.x+(i.w||0),i.y+(i.h||0)]]),box={x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1]))};box.w=Math.max(...points.map(p=>p[0]))-box.x;box.h=Math.max(...points.map(p=>p[1]))-box.y;
 const shrink=Math.min(1,(page.width-30-areaLeft)/Math.max(1,box.w),(page.height-24-top)/Math.max(1,box.h));
 Object.assign(page,{mapWidth:mapW,mapHeight:mapH,mapBottom:top+mapH,siteMapScale:factor,shrink,mapFits:right<=page.width-30&&bottom<=page.height-24,overflow:Math.max(0,right-page.width+30)+Math.max(0,bottom-page.height+24)});
 page.shrinkToFit=()=>{
  const k=shrink,x0=areaLeft+Math.max(0,(page.width-30-areaLeft-box.w*k)/2),at=([x,y])=>[x0+(x-box.x)*k,top+(y-box.y)*k];
  for(const i of own){if(i.type==='path'){i.points=i.points.map(at);for(const end of [i.from,i.to]){[end.x,end.y]=at([end.x,end.y]);end.weight*=k;}i.weight*=k;}else{[i.x,i.y]=at([i.x,i.y]);i.w*=k;i.h*=k;if(i.size)i.size*=k;}}
  page.siteMapScale=factor*k;page.mapFits=true;page.mapBottom=top+box.h*k;delete page.shrinkToFit;
 };
 return page;
 }
}
