// Front-panel schematic placement reviewed against the official product photos.
// Exact spacing is schematic, not a manufacturing drawing. Console is never a data port.
const names=(prefix,n)=>Array.from({length:n},(_,i)=>prefix+(i+1));
const bank=(prefix,n,form,positions)=>({names:names(prefix,n),form,rows:1,side:'front',positions});
const paired=(n,start,pitch,gap,group=4)=>Array.from({length:n},(_,i)=>[start+Math.floor(i/2)*pitch+Math.floor(i/(group*2))*gap,i%2===0?.70:.34]);
const single=(n,start,pitch,gap=0)=>Array.from({length:n},(_,i)=>[start+i*pitch+Math.floor(i/4)*gap,.66]);
const spec=[
 ['CRS326-24S+2Q+RM','crs326_24s_2q_rm',443/44,[bank('sfp-sfpplus',24,'SFP+',paired(24,.055,.033,.010)),bank('qsfpplus',2,'QSFP+',[[.490,.70],[.490,.34]]),bank('ether',1,'RJ45',[[.545,.70]])]],
 ['CRS328-24P-4S+RM','crs328_24p_4s_rm',443/44,[bank('ether',24,'RJ45',paired(24,.16,.032,.032)),bank('sfp-sfpplus',4,'SFP+',paired(4,.65,.034,0))]],
 ['CRS317-1G-16S+RM','crs317_1g_16s_rm',443/44,[bank('sfp-sfpplus',16,'SFP+',single(16,.045,.032,.012)),bank('ether',1,'RJ45',[[.605,.66]])]],
 ['CRS309-1G-8S+IN','crs309_1g_8s_in',272/44,[bank('sfp-sfpplus',8,'SFP+',single(8,.105,.073)),bank('ether',1,'RJ45',[[.71,.66]])]],
 ['CRS305-1G-4S+IN','crs305_1g_4s_in',141/28,[bank('ether',1,'RJ45',[[.115,.58]]),bank('sfp-sfpplus',4,'SFP+',single(4,.30,.19).map(([x])=>[x,.58]))]],
 ['CRS326-24G-2S+RM','CRS326-24G-2SplusRM',443/44,[bank('ether',24,'RJ45',paired(24,.105,.031,.018)),bank('sfp-sfpplus',2,'SFP+',single(2,.54,.048))]],
 ['CRS326-24G-2S+IN','crs326_24g_2s_in',285/44,[bank('ether',24,'RJ45',paired(24,.105,.049,.028)),bank('sfp-sfpplus',2,'SFP+',single(2,.82,.075))]]
];
export const mikrotikFaceplates=spec.flatMap(([model,slug,ratio,banks])=>{
 const aliases=Object.fromEntries([1,2].flatMap(q=>[1,2,3,4].map(l=>[`qsfpplus${q}-${l}`,`qsfpplus${q}`])));
 const common={vendor:'MikroTik',source:'https://mikrotik.com/product/'+slug,verified:true,ratio,banks,aliases,bodyFill:'#DCDDDE'};
 return [{...common,models:[model]}, {...common,models:['MIKROTIK-SHARED-'+model],title:'MikroTik shared '+model+' layout',familyOnly:true}];
});
