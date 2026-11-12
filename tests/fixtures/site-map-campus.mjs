// Fictional campus for the site map: two edge firewalls with two WAN handoffs,
// two cores, eight dual-homed access switches with access points, three
// dual-homed hosts, one storage system and one unconnected printer.
export function fictionalCampus(){
 const devices=[],links=[];let n=0;
 const sw=(id,name,model,ports=52)=>{devices.push({id,name,kind:'switch',model,vendor:'HPE Aruba',ip:'10.20.0.'+(++n),ports:Array.from({length:ports},(_,i)=>({name:String(i+1)}))});};
 devices.push({id:'fw1',name:'CAMPUS-FW-A',kind:'firewall',vendor:'Fortinet',model:'FortiGate 200G',ip:'10.20.0.1',ports:[{name:'wan1',role:'wan',gateway:'198.51.100.1',description:'Provider A'},{name:'wan2',role:'wan',gateway:'203.0.113.1',description:'Provider B'},{name:'x1'},{name:'x2'},{name:'ha'}]});
 devices.push({id:'fw2',name:'CAMPUS-FW-B',kind:'firewall',vendor:'Fortinet',model:'FortiGate 200G',ip:'10.20.0.2',ports:[{name:'x1'},{name:'x2'},{name:'ha'}]});
 sw('core1','CORE-1','JL363A');sw('core2','CORE-2','JL363A');
 links.push({a:'fw1',ap:'ha',b:'fw2',bp:'ha',media:'copper',speed:'1 Gbps'});
 for(const [f,c] of [['fw1','core1'],['fw2','core2']])links.push({a:f,ap:'x1',b:c,bp:'49',media:'sr',speed:'10 Gbps'});
 links.push({a:'core1',ap:'51',b:'core2',bp:'51',media:'dac',speed:'40 Gbps'},{a:'core1',ap:'52',b:'core2',bp:'52',media:'dac',speed:'40 Gbps',lag:'trk1'});
 for(let i=1;i<=8;i++){
  const id='acc'+i;sw(id,'IDF-'+String(i).padStart(2,'0')+'-ACCESS','JL356A');
  links.push({a:'core1',ap:String(i),b:id,bp:'49',media:'sr',speed:'10 Gbps',lag:'lag'+i},{a:'core2',ap:String(i),b:id,bp:'50',media:'sr',speed:'10 Gbps',lag:'lag'+i});
  for(let k=1;k<=(i%3)+2;k++){const ap='ap'+i+'-'+k;devices.push({id:ap,name:'AP-'+i+'-'+k,kind:'ap',vendor:'HPE Aruba',model:k%2?'AP-515':'AP-635',ports:[{name:'eth0'}]});links.push({a:id,ap:String(k),b:ap,bp:'eth0',media:'copper',speed:'1 Gbps'});}
 }
 for(let k=1;k<=3;k++){devices.push({id:'srv'+k,name:'SRV-HOST-0'+k,kind:'hypervisor',vendor:'Fictional',model:'2U host',ip:'10.20.10.'+k,ports:[{name:'nic1'},{name:'nic2'}]});links.push({a:'core1',ap:String(20+k),b:'srv'+k,bp:'nic1',media:'dac',speed:'25 Gbps'},{a:'core2',ap:String(20+k),b:'srv'+k,bp:'nic2',media:'dac',speed:'25 Gbps'});}
 devices.push({id:'nas',name:'NAS-01',kind:'storage',vendor:'Fictional',model:'NAS 8-bay',ip:'10.20.10.20',ports:[{name:'e1'}]});links.push({a:'core1',ap:'30',b:'nas',bp:'e1',media:'copper',speed:'10 Gbps'});
 devices.push({id:'prn',name:'PRINTER-LOBBY',kind:'printer',model:'Laser',ports:[]});
 return {name:'Fictional campus',devices,links,layout:{}};
}
