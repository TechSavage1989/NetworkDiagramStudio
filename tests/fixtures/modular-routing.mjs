export function modularChassis(model='J9850A'){
 const count=/J9851|J8698/.test(model)?12:6;
 const modules=Array.from({length:count},(_,i)=>({slot:String.fromCharCode(65+i),model:i===1||i===3?'J9987A':'J9993A'}));
 return {id:'chassis',name:'LAB-CHASSIS',kind:'switch',model,modules,
  ports:modules.flatMap(m=>Array.from({length:m.model==='J9987A'?24:8},(_,i)=>({name:m.slot+(i+1),state:'up'})))};
}
export function modularRoutingFixture(){
 const stack=n=>({id:'stack'+n,name:'LAB-STACK-'+n,kind:'switch',model:'JL558A',
  stackMembers:Array.from({length:n},(_,i)=>({id:String(i+1),model:'JL558A'})),
  ports:Array.from({length:n},(_,i)=>[{name:(i+1)+'/49'},{name:(i+1)+'/50'}]).flat()});
 const links=[['A3','stack5','1/49'],['A5','stack5','5/49'],['A6','stack8','1/49'],['C6','stack8','2/49'],
  ['C7','stack8','5/49'],['E7','stack8','8/49'],['E8','stack5','5/50'],['F8','firewall','x1']];
 return {name:'Modular routing lab',devices:[{id:'firewall',name:'LAB-EDGE',kind:'firewall',model:'FortiGate 200G',ports:[{name:'x1'}]},modularChassis(),stack(5),stack(8)],
  links:links.map(([ap,b,bp])=>({a:'chassis',ap,b,bp,media:'DAC',speed:'10 Gbps'}))};
}
