// Family drawings are deliberately separate from exact SKU identification.
// Only complete interface signatures plus platform evidence select a shared
// layout. Filenames alone, descriptions of peers and port counts cannot do so.
export function completeConfigHardware(d,text,filename,warnings){
 const names=new Set(d.ports.map(p=>p.name.toLowerCase())),hasRange=(prefix,lo,hi)=>{
  for(let n=lo;n<=hi;n++)if(!names.has((prefix+n).toLowerCase()))return false;
  return true;
 };
 const physical=d.ports.filter(p=>!p.parent&&!/^(?:vlan|loopback|port-channel|lag |trk|mgmt|gi0\/0|fa0$)/i.test(p.name));
 const hint=[d.name,filename,...text.split(/\r?\n/).filter(l=>/^boot config /i.test(l))].join(' ');
 let family='',basis='';
 if(!d.model&&!d.stackMembers?.length){
  if(d.vendor==='Cisco'&&/c9500/i.test(hint)){
   for(const count of [24,48])if(physical.length===count+4&&hasRange('TwentyFiveGigE1/0/',1,count)&&hasRange('HundredGigE1/0/',count+1,count+4)){
    family='Catalyst 9500 '+count+'Y4C family';basis='Catalyst 9500 family name and complete 25G/100G interface signature';
   }
  }else if(d.vendor==='Cisco'&&(/^version 15\./im.test(text)||/3560[\W_E-]/i.test(hint))&&physical.length===54&&hasRange('Gi0/',1,52)&&hasRange('Te0/',1,2)&&names.has('fa0')){
   family=/3560[-_ ]?E/i.test(hint)?'Catalyst 3560-E 48-port family':'Cisco 48-port access family';basis='Complete 48-port copper access signature with four gigabit uplink aliases, two 10G aliases and rear management';
  }else if(d.vendor==='HPE Aruba'&&/^!Version ArubaOS-CX PL\./im.test(text)){
   for(const [count,label] of [[16,'12G'],[28,'24G'],[52,'48G']])if(physical.length===count&&hasRange('1/1/',1,count)){
    family='Aruba CX 6000/6100 '+label+' family';basis='AOS-CX PL platform and complete front-panel interface signature';
   }
  }
  if(family){
   d.model=family;d.kind='switch';d.hardwareEvidence={kind:'family-layout',model:family,basis};
   warnings.push(filename+': using the shared '+family+' layout. The exact SKU is not declared; confirm it in Edit device before relying on model-specific capabilities.');
  }
 }
 // A configured module interface proves a bay is used, not the fitted connector.
 if(/^J(?:972[6-9]|9836)A$/i.test(d.model)){
  const bays=new Set(d.ports.map(p=>p.name.match(/^(?:(\d+)\/)?([AB])[12]$/i)).filter(Boolean).map(m=>(m[1]||'')+'/'+m[2].toUpperCase()));
  for(const bay of bays)if(!d.modules?.some(m=>(m.member||'')+'/'+m.slot===bay))warnings.push(filename+': rear bay '+bay.replace(/^\//,'')+' is configured but its card type is unspecified. Confirm J9731A (SFP+) or J9732A (10GBASE-T) in Edit device to attach links to its physical sockets.');
 }
 if(d.model==='Cisco 48-port access family')warnings.push(filename+': select the exact Cisco model in Edit device before mapping uplinks. This interface signature does not establish the uplink module form factor.');
 if(/3560.?E.*48/i.test(d.model)&&d.ports.some(p=>/^Te\d+\/[12]$|^Gi\d+\/5[12]$|^Gi\d+\/49$|^Gi\d+\/50$/i.test(p.name))&&!d.modules?.length)
  warnings.push(filename+': confirm the installed X2 or TwinGig adapters in Edit device. Configured uplink aliases alone do not identify the fitted jacks.');
}
