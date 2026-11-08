// Fictional site shaped like a common MDF: a firewall with five WAN circuits,
// a modular chassis and 8- and 5-member stacks uplinked on their x/50 ports.
import {modularChassis} from './modular-routing.mjs';
export function mdfLookalike(){
 const wan=(name,handoff,gateway)=>({name,role:'wan',state:'up',handoff,gateway,media:'copper',speed:'1 Gbps'});
 const fw={id:'fw',name:'LAB-FW-TOP',kind:'firewall',vendor:'Fortinet',model:'FortiGate 200G',ip:'10.0.0.1',ports:[wan('port1','Untrusted','192.0.2.1'),wan('port11','Provider A 1G','198.51.100.1'),wan('port13','Voice WAN','203.0.113.1'),wan('port14','Provider A 150','198.51.100.65'),wan('port15','Provider B 1G','203.0.113.129'),{name:'port2',state:'up'},{name:'port4',state:'up'}]};
 const core={...modularChassis(),id:'mdf',name:'LAB-SW01-MDF',vendor:'HPE Aruba'};
 const stack=(id,name,n)=>({id,name,kind:'switch',vendor:'HPE Aruba',model:'JL558A',ip:'10.0.10.'+n,stackMembers:Array.from({length:n},(_,i)=>({id:String(i+1),model:'JL558A'})),ports:Array.from({length:n},(_,i)=>[{name:(i+1)+'/49',state:'up'},{name:(i+1)+'/50',state:'up'}]).flat()});
 const L=(a,ap,b,bp,media='unknown',speed='10 Gbps')=>({a,ap,b,bp,media,speed,status:'confirmed'});
 return {name:'MDF lookalike lab',devices:[fw,core,stack('idf2','LAB-2FL-IDF-STACK',8),stack('idf1','LAB-1FL-IDF-STACK',5)],links:[
  L('fw','port2','mdf','B11','copper','1 Gbps'),L('fw','port4','mdf','A6','copper','1 Gbps'),
  L('mdf','A1','idf2','1/50'),L('mdf','A2','idf2','2/50'),L('mdf','C1','idf2','4/50'),L('mdf','C2','idf2','5/50'),L('mdf','E1','idf2','7/50'),L('mdf','B1','idf2','3/50','copper','1 Gbps'),
  L('mdf','A3','idf1','1/50'),L('mdf','C3','idf1','2/50'),L('mdf','E2','idf1','3/50'),L('mdf','F1','idf1','5/50')]};
}
