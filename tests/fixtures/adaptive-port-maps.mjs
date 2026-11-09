// Entirely fictional fixtures. No customer configurations, names or addresses.
export function adaptiveStack(members=8){
 const vlans=[{id:1,name:'Default'},{id:10,name:'Management'},{id:110,name:'Voice',voice:true},{id:120,name:'Workstations'},{id:140,name:'Building controls'},{id:150,name:'Security systems'},{id:160,name:'Information displays'},{id:300,name:'Infrastructure'},{id:500,name:'Staff wireless'},{id:600,name:'Visitor wireless'}];
 return {id:'lab-stack-'+members,name:'LAB-'+members+'-MEMBER-STACK',kind:'switch',vendor:'Aruba',model:'JL558A',
  stackMembers:Array.from({length:members},(_,i)=>({id:String(i+1),model:i===members-1?'JL256A':'JL558A'})),vlans,
  ports:Array.from({length:members},(_,i)=>Array.from({length:52},(_,j)=>{
   const member=i+1,number=j+1,trunk=member===members-1&&number<=32,security=member===members&&number>=21&&number<=44;
   return {name:member+'/'+number,state:'up',native:security?150:120,tagged:number===50?vlans.map(v=>v.id).filter(id=>id!==120):trunk?[110,500,600]:security?[]:[110],lag:trunk?'trk'+(Math.floor((number-1)/2)+2):number===50?'trk1':null};
  })).flat()};
}
export function adaptiveProject(preset='a4',orientation='landscape',members=8){
 return {name:'Fictional page-fit validation',devices:[adaptiveStack(members)],links:[],layout:{portMap:{presentation:'separate'},pageSetup:{visible:{fitMode:'optimize',groups:{ports:{preset,orientation}}}}}};
}
