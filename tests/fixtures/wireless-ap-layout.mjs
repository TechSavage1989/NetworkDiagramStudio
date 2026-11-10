// Fictional AP arrangement and scaling fixture; never customer topology.
export function wirelessApLab(count=8,members=3,scale=1,placement='rows'){
 const member=members===5?3:2,ports=Array.from({length:count},(_,i)=>({name:member+'/'+(i+1)})),sw={id:'sw',name:'LAB-STACK',kind:'switch',model:'JL558A',stackMembers:Array.from({length:members},(_,i)=>({id:String(i+1),model:'JL558A'})),ports};
 const aps=ports.map((_,i)=>({id:'ap'+i,name:'LAB-AP-'+(i+1),kind:'ap',vendor:'HPE Aruba',model:'AP-515',ip:'192.0.2.'+(i+1),ports:[{name:'eth0'}]}));
 return {name:'Fictional AP scale lab',devices:[sw,...aps],links:ports.map((p,i)=>({a:'sw',ap:p.name,b:'ap'+i,bp:'eth0',media:'copper',speed:'1 Gbps'})),layout:{presentation:{defaults:{wirelessApScale:scale,wirelessApPlacement:placement}},pageSetup:{visible:{default:{preset:'dynamic'}}}}};
}
