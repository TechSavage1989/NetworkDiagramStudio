import {portMapSheets} from '../../src/web/reports/index.mjs';
const vlans=[{id:10,name:'Lab users'},{id:20,name:'Lab voice'}];
export const standardMapDevices=()=>[
 {id:'chassis',name:'LAB-CHASSIS',kind:'switch',model:'J9850A',modules:['A','B','C','D','E','F'].map((slot,i)=>({slot,model:i%2?'J9987A':'J9993A'})),vlans,ports:['A1','B1','C1','D1','E1','F1'].map(name=>({name,native:10,tagged:[20]}))},
 {id:'stack',name:'LAB-STACK',kind:'switch',model:'JL558A',stackMembers:[1,2,3,4,5].map(id=>({id:String(id),model:'JL558A'})),vlans,ports:[1,2,3,4,5].flatMap(n=>[{name:n+'/1',native:10,tagged:[20]},{name:n+'/49',native:10,tagged:[20]}])},
 {id:'fixed',name:'LAB-FIXED',kind:'switch',model:'JL558A',vlans,ports:[{name:'1',native:10,tagged:[20]}]}
];
export function standardizedMaps(){const devices=standardMapDevices(),project={name:'Synthetic standard sockets',devices,links:[],layout:{}};return [...portMapSheets(project,devices,{width:1056,height:816,widthMm:279.4,heightMm:215.9,fill:true}).values()].flat();}
