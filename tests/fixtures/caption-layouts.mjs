export function parallelUplinks(textScale=1){
 const devices=[5,8].map((count,i)=>({id:i?'b':'a',name:'LAB-STACK-'+(i?'B':'A'),kind:'switch',model:'JL558A',stackMembers:Array.from({length:count},(_,j)=>({id:String(j+1),model:'JL558A'})),ports:[]}));
 const links=Array.from({length:8},(_,i)=>({a:'a',ap:Math.floor(i/4)+1+'/'+(49+i%4),b:'b',bp:Math.floor(i/4)+1+'/'+(49+i%4),media:'unknown',speed:'10 Gbps'}));
 devices.forEach(d=>d.ports=links.map(e=>({name:d.id==='a'?e.ap:e.bp})));
 return {name:'Parallel uplinks lab',devices,links,layout:{presentation:{defaults:{textScale}}}};
}

export function tallWirelessCaptions(){
 return {name:'Wireless caption lab',devices:[
  {id:'chassis',name:'LAB-CHASSIS',kind:'switch',model:'J9850A',modules:[{slot:'A',model:'J9986A'},{slot:'F',model:'J9986A'}],ports:[{name:'A1'},{name:'F24'}]},
  ...['a','b'].map(id=>({id,name:'LAB-AP-'+id+' Wireless area'.repeat(30),kind:'ap',model:'AP-515',ports:[{name:'eth0'}]}))
 ],links:['A1','F24'].map((port,i)=>({a:'chassis',ap:port,b:i?'b':'a',bp:'eth0',media:'copper',speed:'1 Gbps'}))};
}
