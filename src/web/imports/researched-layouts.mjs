import {mikrotikFaceplates} from './mikrotik-faceplates.mjs';
// Normalized drawing geometry transcribed from the cited manufacturer guides.
// Family-only records describe common geometry, never an inferred orderable SKU.
export function refineFaceplates(input){
 const plates=input.map(p=>({...p}));
 for(const p of plates){
  if(p.family==='6100'||p.family==='6000'){
   const count=p.sockets?.filter(s=>!s[4]).length;
   if([16,28,52].includes(count)){
    p.ratio=count===16?25.4/4.4:44.25/4.4;p.panelBrand='aruba';p.bodyFill='#535554';p.socketPoints={};
    for(const [n,,row] of p.sockets){
     let x,y=row===0?.34575:.69055;
     if(count===16){x=n<=12?.498+Math.floor((n-1)/2)*.057:n<=14?.307+(n-13)*.111:.092+(n-15)*.107;y=n<=12?(row===0?.37:.65):.70;}
     else if(count===28)x=n<=24?.541+Math.floor((n-1)/2)*.0334+(n>12?.008:0):n<=26?.03386:.08466;
     else {const col=Math.floor((n-1)/2);x=n<=48?.138056+col*.0319+Math.floor(col/6)*.012123:n<=50?.03386:.08466;}
     if(count!==16&&n>count-4)y=row===0?.33153:.70476;
     p.socketPoints[n]=[x,y,count===16?.045:.022];
    }
   }
  }
  if(p.family==='2930F'&&p.sockets?.length===52){
   p.ratio=44.25/4.39;p.panelBrand='aruba';p.bodyFill='#535554';p.socketPoints={};
   for(const [n,,row] of p.sockets){const col=Math.floor((n-1)/2);p.socketPoints[n]=[n<=48?.122+col*.0325+Math.floor(col/6)*.017:n<=50?.034:.075,row===0?.34:.70,.022];}
  }
  if(p.models.some(m=>/^JL72[6789][AB]$/.test(m))&&p.sockets?.length===52){
   p.ratio=44.2/4.39;p.panelBrand='aruba';p.bodyFill='#535554';p.socketPoints={};
   for(const [n,,row] of p.sockets){const col=Math.floor((n-1)/2);p.socketPoints[n]=[n<=48?.043+col*.0316+Math.floor(col/6)*.014:n<=50?.855:.890,row===0?.34:.70,.022];}
   p.frontManagement=true;
  }
  if(p.models.some(m=>/^J998[67]A$/.test(m)))p.socketWidth=.059;
  if(p.models.includes('J9993A'))p.socketWidth=.080;
 }
 const family=(base,name,edit={})=>{const p=plates.find(p=>p.models.includes(base));if(p)plates.push({...p,...edit,models:[name],title:name,familyOnly:true});};
 for(const [sku,count] of [['C9500-24Y4C',24],['C9500-48Y4C',48]])family(sku,'Catalyst 9500 '+count+'Y4C family');
 family('WS-C3560E-48PD-SF','Catalyst 3560-E 48-port family');
 family('WS-C3560E-48PD-SF','Cisco 48-port access family',{unknownUplinkType:true});
 for(const [sku,count] of [['JL679A','12G'],['JL677A','24G'],['JL675A','48G']]){
  const p=plates.find(p=>p.models.includes(sku));
  family(sku,'Aruba CX 6000/6100 '+count+' family',{sockets:p.sockets.map(s=>[...s.slice(0,3),s[3]==='SFP+'?'SFP cage':s[3],s[4]])});
 }
 return [...plates.filter(p=>p.vendor!=='MikroTik'),...mikrotikFaceplates];
}
