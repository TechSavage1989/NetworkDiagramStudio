export function sampleSite() {
  const vlan=(id,name)=>({id,name});
  const switchDevice=(n)=>({id:'sw-'+n,name:'SW-'+n,kind:'switch',vendor:'Aruba',model:'CX 6100',ip:'10.24.8.'+n,
    vlans:[vlan(8,'Users'),vlan(20,'Voice'),vlan(34,'Wireless'),vlan(90,'Guest')],
    routes:[{destination:'0.0.0.0/0',gateway:'10.24.8.254'}],
    ports:Array.from({length:28},(_,i)=>{const p=i+1;return {name:'1/1/'+p,role:p<21?'wired':p<25?'ap':'uplink',state:p===28?'down':'up',native:8,tagged:p<21?[20]:[20,34,90],speed:p>=25?'10 Gbps':'1 Gbps',...(p===27||p===28?{lag:'1'}:{})};})});
  const f={id:'edge',name:'EDGE-01',kind:'firewall',vendor:'Fortinet',model:'FortiGate',ip:'10.24.8.254',vlans:[vlan(8,'Users')],routes:[],ports:[{name:'wan1',role:'wan',state:'up',speed:'1 Gbps'},{name:'x1',role:'uplink',state:'up',speed:'10 Gbps'}]};
  const aps=['Library','Studio','Workshop','Gallery'].map((name,i)=>({id:'ap-'+i,name:'AP-'+name,kind:'ap',vendor:'Aruba',model:'Access point',ip:'10.24.8.'+(41+i),ports:[{name:'eth0',state:'up'}],vlans:[],routes:[]}));
  return {name:'Harbor Workshop', devices:[f,switchDevice(1),switchDevice(2),...aps],stencils:{},optics:{},warnings:[],
    links:[{a:'edge',ap:'x1',b:'sw-1',bp:'1/1/25',media:'SR',speed:'10 Gbps',status:'confirmed'},
      {a:'sw-1',ap:'1/1/27',b:'sw-2',bp:'1/1/27',media:'DAC',speed:'10 Gbps',status:'confirmed'},
      ...aps.map((d,i)=>({a:'sw-'+(i<2?'1':'2'),ap:'1/1/'+(21+i%2),b:d.id,bp:'eth0',media:'copper',speed:i===3?'100 Mbps':'1 Gbps',status:'confirmed'}))]};
}
