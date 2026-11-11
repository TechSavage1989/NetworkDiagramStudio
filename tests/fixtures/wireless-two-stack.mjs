// Fictional site shaped like a reported dense wireless project; never customer
// data. A firewall and chassis core, an 8-member access stack with 32 APs on
// member 7 and a 5-member stack with 28 APs on member 3. Some APs are named only
// by MAC address, two are outdoor models and every AP caption carries a MAC
// (mac:false drops the interface MACs, so cards are four lines, as in the
// owner's screenshots).
export function wirelessTwoStackSite({preset='dynamic',orientation='landscape',fit,locked=false,mac:withMac=true}={}){
 const port=(name,o={})=>({name,state:'up',...o});
 const stack=(id,name,members,apMember,count,ip)=>({id,name,kind:'switch',vendor:'HPE Aruba',model:'JL558A',ip,stackMembers:Array.from({length:members},(_,i)=>({id:String(i+1),model:'JL558A'})),ports:[...Array.from({length:members},(_,i)=>[port((i+1)+'/49'),port((i+1)+'/50')]).flat(),...Array.from({length:count},(_,i)=>port(apMember+'/'+(i+1),{native:30}))]});
 const fw={id:'fw',name:'LAB-FG200G-TOP',kind:'firewall',vendor:'Fortinet',model:'FortiGate 200G',ip:'10.0.0.1',ports:[port('port1'),port('port2'),port('x1')]};
 const mdf={id:'mdf',name:'LAB-SW01-MDF',kind:'switch',vendor:'HPE Aruba',model:'J9850A',ip:'10.0.10.1',modules:[{slot:'A',model:'J9993A'},{slot:'C',model:'J9986A'}],ports:['A1','A2','A3','C1'].map(n=>port(n))};
 const aps=[],links=[{a:'fw',ap:'x1',b:'mdf',bp:'A1',media:'SR',speed:'10 Gbps'},{a:'mdf',ap:'A2',b:'s2',bp:'1/49',media:'SR',speed:'10 Gbps'},{a:'mdf',ap:'A3',b:'s1',bp:'1/49',media:'SR',speed:'10 Gbps'}];
 const add=(sw,member,count,floor,base)=>{for(let i=0;i<count;i++){
  const id='ap'+floor+'-'+(i+1),mac='d0:d3:e0:'+(0x10+floor).toString(16)+':'+(0x20+i).toString(16).padStart(2,'0')+':'+(0x40+i).toString(16),outdoor=floor===1&&i>=26,unnamed=floor===1&&(i===3||i===18);
  aps.push({id,name:unnamed?mac:outdoor?'LAB-AP-Outdoor-'+(i-25):'LAB-AP-'+floor+'-'+(i+1),kind:'ap',vendor:'HPE Aruba',model:outdoor?'Aruba AP-375':'AP-515',ip:'192.168.30.'+(base+i),ports:[withMac?{name:'eth0',mac}:{name:'eth0'}]});
  links.push({a:sw,ap:member+'/'+(i+1),b:id,bp:'eth0',media:'copper',speed:outdoor&&i===27?'100 Mbps':'1 Gbps'});
 }};
 add('s2',7,32,2,20);add('s1',3,28,1,100);
 return {name:'Fictional wireless lab',devices:[fw,mdf,{...stack('s2','LAB-2FL-IDF-STACK',8,7,32,'10.0.10.13')},stack('s1','LAB-1FL-IDF-STACK',5,3,28,'10.0.10.12'),...aps],links,layout:{pageSetup:{visible:{default:{preset,orientation,...(locked?{locked:true}:{})},...(fit?{wirelessFit:fit}:{})}}}};
}
