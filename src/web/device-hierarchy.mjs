// Device order from the network's own shape, so a fresh import needs little
// manual reordering: the edge first (firewalls and routers), then switches by
// their distance from the edge (core, distribution, access; better connected
// first), then access points and other endpoints after the switch they
// connect to. Devices joined into a stack stay together in member order.
// Unconnected devices follow, by kind and name.
const infrastructure=new Set(['firewall','router','switch']);
const kindRank=kind=>kind==='firewall'?0:kind==='router'?1:kind==='switch'?2:kind==='ap'?4:3;
const byName=(a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),undefined,{numeric:true,sensitivity:'base'});

export function hierarchyOrder(project){
 const devices=(project?.devices||[]).filter(d=>d?.id!=null),ids=new Set(devices.map(d=>d.id));
 const neighbours=new Map(devices.map(d=>[d.id,new Set()]));
 for(const link of project?.links||[])if(ids.has(link.a)&&ids.has(link.b)&&link.a!==link.b){neighbours.get(link.a).add(link.b);neighbours.get(link.b).add(link.a);}
 const byId=new Map(devices.map(d=>[d.id,d])),infra=devices.filter(d=>infrastructure.has(d.kind));
 const infraDegree=d=>[...neighbours.get(d.id)].filter(id=>infrastructure.has(byId.get(id)?.kind)).length;
 // Start at the edge; without a firewall or router, at the best connected switch.
 let roots=infra.filter(d=>d.kind!=='switch');
 if(!roots.length){const core=infra.slice().sort((a,b)=>infraDegree(b)-infraDegree(a)||byName(a,b))[0];roots=core?[core]:[];}
 const depth=new Map(roots.map(d=>[d.id,0])),queue=roots.map(d=>d.id);
 while(queue.length){const id=queue.shift();for(const next of neighbours.get(id)){if(depth.has(next)||!infrastructure.has(byId.get(next)?.kind))continue;depth.set(next,depth.get(id)+1);queue.push(next);}}
 const infraOrder=infra.slice().sort((a,b)=>(depth.get(a.id)??Infinity)-(depth.get(b.id)??Infinity)||kindRank(a.kind)-kindRank(b.kind)||infraDegree(b)-infraDegree(a)||byName(a,b));
 const position=new Map(infraOrder.map((d,i)=>[d.id,i]));
 // Access points and endpoints follow the switch (or other device) they hang from.
 // Each follows its switch in that switch's port order.
 const uplink=new Map();
 for(const d of devices.filter(d=>!infrastructure.has(d.kind))){let best={position:Infinity,port:''};for(const link of project?.links||[]){const other=link.a===d.id?link.b:link.b===d.id?link.a:null,port=link.a===d.id?link.bp:link.ap;const at=position.get(other);if(at!=null&&(at<best.position||at===best.position&&String(port).localeCompare(best.port,undefined,{numeric:true})<0))best={position:at,port:String(port||'')};}uplink.set(d.id,best);}
 const rest=devices.filter(d=>!infrastructure.has(d.kind)).sort((a,b)=>uplink.get(a.id).position-uplink.get(b.id).position||uplink.get(a.id).port.localeCompare(uplink.get(b.id).port,undefined,{numeric:true})||kindRank(a.kind)-kindRank(b.kind)||byName(a,b));
 let order=[...infraOrder,...rest].map(d=>d.id);
 // Keep stacked devices together, in member order, where the first one falls.
 for(const stack of project?.layout?.deviceStacks||[]){
  const members=(stack.members||[]).slice().sort((a,b)=>a.number-b.number).map(m=>m.deviceId).filter(id=>ids.has(id));if(members.length<2)continue;
  const at=Math.min(...members.map(id=>order.indexOf(id))),set=new Set(members),without=order.filter(id=>!set.has(id)),before=order.slice(0,at).filter(id=>!set.has(id)).length;
  order=[...without.slice(0,before),...members,...without.slice(before)];
 }
 return order;
}

// While the device order is automatic (never moved by hand), new or changed
// imported data re-applies the hierarchy; a manual move keeps the user's
// order from then on.
export function applyAutomaticOrder(project){
 const layout=project.layout||(project.layout={});
 if(layout.order?.length&&layout.orderAuto!==true)return false;
 layout.order=hierarchyOrder(project);layout.orderAuto=true;return true;
}
