import {faceplates} from '../imports/faceplates.mjs';
import {genericDeviceSymbol} from '../device-symbols.mjs';
import {consistentSockets} from './connector-geometry.mjs';
const normalize=v=>String(v||'').toUpperCase().replace(/[\s_]/g,'').replace(/^(?:FORTINET|SONICWALL|SOPHOS|CISCO(?:CATALYST)?|JUNIPER(?:NETWORKS)?|PALOALTO(?:NETWORKS)?)/,'').replace(/^(?:FORTIGATE|FGT?)-?(\d+[A-Z])$/,'FG-$1');
const profiles=new Map();for(const p of faceplates)for(const m of p.models)profiles.set(normalize(m),p);
export function faceplateProfile(d){
 let p=profiles.get(normalize(d.sku))||profiles.get(normalize(d.model));
 // Fortinet's Rev2 shared interfaces are named x1/x2, in the same physical bay.
 if(p?.models.some(m=>/^FG-9[01]G$/.test(m))&&(d.ports||[]).some(o=>/^x[12]$/i.test(o.name)&&!o.parent))
  return {...p,banks:p.banks.map(b=>({...b,names:b.names.map(n=>n.replace(/^wan([12])$/,'x$1'))}))};
 if(p?.unconfirmedUplinkModules&&!p.unknownUplinkType){
  const banks=[...p.banks],confirmed=[];
  for(const [slot,y] of [['X2-1',.32],['X2-2',.70]]){
   const card=d.modules?.find(m=>m.slot?.toUpperCase()===slot&&!m.member);if(!card)continue;
   const number=slot.endsWith('1')?1:2;
   if(/^CVR-X2-SFP$/i.test(card.model)){const first=number===1?49:51;banks.push({names:[String(first),String(first+1)],form:'SFP',rows:1,positions:[[.89,y],[.94,y]],socketWidth:.028});confirmed.push(number);}
   else if(/^X2-10GB-(?:SR|LR|ER|CX4|LX4|LRM|ZR)$/i.test(card.model)){banks.push({names:['uplink'+number],form:'X2',rows:1,positions:[[.915,y]],socketWidth:.036});confirmed.push(number);}
  }
  p={...p,banks,confirmedUplinkSlots:confirmed};
 }
 return p;
}
const canon=v=>String(v).toLowerCase().replace(/^gigabitethernet/,'gi').replace(/^tengigabitethernet/,'te').replace(/^management$/,'mgmt');
const rectangle=(a,x,y,w,h,fill,stroke='none',weight=.5)=>a.push({type:'rect',x,y,w,h,fill,stroke,weight});
const text=(a,x,y,w,h,value,size=5,color='#33434A',bold=false)=>a.push({type:'text',x,y,w,h,value,size,color,bold,align:'left'});
function socket(a,ports,name,x,y,form,view='front',w=.024,h=.23,primary=true,orientation='down'){
 const first=a.length;
 const rj=/RJ|copper/i.test(form),wide=/QSFP|CX4|X2/.test(form),width=w*(wide?1.45:1),height=h*(rj?1:.86);
 rectangle(a,x-width/2,y-height/2,width,height,rj?'#1D282D':'#6F777B',rj?'#66757B':'#39484F',.5);
 if(rj){rectangle(a,x-width*.36,y-height*.28,width*.72,height*.49,'#101A1E');rectangle(a,x-width*.18,y+height*.13,width*.36,height*.30,'#879296');for(let j=0;j<4;j++)rectangle(a,x-width*.29+j*width*.17,y-height*.3,width*.05,height*.13,'#D3B266');}
 else {rectangle(a,x-width*.4,y-height*.35,width*.8,height*.7,'#182D36');rectangle(a,x-width*.3,y+height*.23,width*.6,height*.05,'#D7DCDE');}
 if(orientation==='up')for(let i=first;i<a.length;i++)a[i].y=2*y-a[i].y-a[i].h;
 for(let i=first;i<a.length;i++)Object.assign(a[i],{name:'Port '+name+' '+form,socketForm:form,socketPart:i-first});
 if(primary){ports[name]=[x,y];Object.assign(a[first],{anchorName:name,anchorOrigin:[x,y]});}return {name,x,y,form,view,orientation,primary};
}
function banksFor(p){return p.banks?.filter(b=>!b.optional)||[];}
function baseLayout(p){
 if(!p?.verified)return null;
 const ports=Object.create(null),children=[],sockets=[];let ratio=p.ratio||(p.module?5:10.2);
 const forti=p.vendor==='Fortinet',desktop=/FG-60F|FG-61F|XGS1\d\d|PA-4[1456]0/.test(p.models.join(' '));
 if(desktop&&!p.ratio)ratio=5.2;
 rectangle(children,0,0,1,1,p.bodyFill||(forti?'#F3F3F0':p.vendor==='SonicWall'?'#D8DADD':'#D9DDDF'),'#52636B',1);
 rectangle(children,.008,.07,.006,.86,'#899397');rectangle(children,.985,.07,.006,.86,'#899397');
 if(p.vents)for(let x=.025;x<.97;x+=.018)for(let y=.06;y<.45;y+=.09)rectangle(children,x,y,.011,.045,'#303A3F');
 const add=(...args)=>{sockets.push(socket(children,ports,...args));};
 if(p.sockets){
  const max=Math.max(p.module?1:29,...p.sockets.map(s=>s[1]));
  for(const [n,col,row,form,suffix] of p.sockets){const lastRow=Math.max(...p.sockets.filter(s=>s[3]===form).map(s=>s[2]));let x=.052+col*(.91/(max+1)),y=lastRow>1?.18+.62*row/lastRow:row===0?.32:.70;
   if(p.models.some(m=>['JL675A','JL676A','R9Y04A'].includes(m))){if(n>=49)x=n<=50?.03386:.08466;else x=.138056+Math.floor((n-1)/2)*(.770069/23);y=n>=49?(row===0?.33153:.70476):(row===0?.34575:.69055);}
   if(p.models.some(m=>/^J973[12]A$/.test(m))){x=.33+(Number(n)-1)*.137;y=.58;}
   const measured=p.socketPoints?.[n];if(measured)[x,y]=measured;
   const name=String(n);add(name,x,y,form,'front',measured?.[2]||p.socketWidth||(p.models.some(m=>/^J973[12]A$/.test(m))?.11:p.module?.05:.022),.25,suffix!=='M',row===0?'up':'down');
  }
  if(p.frontManagement){add('mgmt',.935,.34,'RJ45','front',.022,.25,true,'up');rectangle(children,.925,.66,.022,.09,'#A2B1B8');rectangle(children,.970,.30,.012,.30,'#111A20');}
  else if(!p.module){rectangle(children,.937,.2,.033,.53,'#ECEFEE','#8B979D',.6);for(let n=0;n<4;n++)rectangle(children,.944,.27+n*.1,.007,.04,n===0?'#699B58':'#899799');}
 }else if(forti&&p.models.some(m=>/^FG-12[01]G$/.test(m))){
  text(children,.035,.22,.23,.32,'FORTINET',7,'#59716C',true);rectangle(children,.27,.23,.022,.15,'#16272D');rectangle(children,.296,.26,.022,.24,'#26383F');
  add('ha',.339,.36,'RJ45','front',.024,.23,true,'up');add('mgmt',.339,.69,'RJ45');
  for(let n=1;n<=16;n++)add('port'+n,.385+Math.floor((n-1)/2)*.0334,n%2?.36:.69,'RJ45','front',.024,.23,true,n%2?'up':'down');
  for(let n=1;n<=4;n++)add('x'+n,.6648+Math.floor((n-1)/2)*.0308,n%2?.36:.69,'SFP+','front',.024,.23,true,n%2?'up':'down');
  for(let n=17;n<=24;n++)add('port'+n,.7339+Math.floor((n-17)/2)*.0300,n%2?.36:.69,'SFP','front',.024,.23,true,n%2?'up':'down');
 }else if(forti&&p.models.some(m=>/^FG-20[01]G$/.test(m))){
  ratio=9.8;text(children,.025,.17,.15,.30,'FORTINET',7,'#59716C',true);rectangle(children,.14,.40,.025,.27,'#203139');rectangle(children,.14,.76,.025,.09,'#17262D');
  add('ha',.203,.43,'RJ45','front',.024,.23,true,'up');add('mgmt',.203,.71,'RJ45');
  for(let n=1;n<=8;n++)add('port'+n,.324+Math.floor((n-1)/2)*.0335,n%2?.42:.70,'RJ45','front',.024,.23,true,n%2?'up':'down');
  for(let n=9;n<=16;n++)add('port'+n,.477+Math.floor((n-9)/2)*.0335,n%2?.42:.70,'RJ45','front',.024,.23,true,n%2?'up':'down');
  for(let n=1;n<=8;n++)add('x'+n,.670+Math.floor((n-1)/2)*.0338,n%2?.42:.70,'SFP+','front',.024,.23,true,n%2?'up':'down');
  for(let n=17;n<=20;n++)add('port'+n,.821+Math.floor((n-17)/2)*.034,n%2?.42:.70,'SFP','front',.024,.23,true,n%2?'up':'down');
  for(const x of [.243,.261,.279,.613,.628])for(let y=.28;y<.8;y+=.1)rectangle(children,x,y,.01,.035,'#34464F');
 }else{
  const banks=banksFor(p),views=[...new Set(banks.map(b=>b.side||'front'))],front=banks.filter(b=>b.side!=='rear'),rear=banks.filter(b=>b.side==='rear');
  // Separate rear connectors instead of presenting them as front-panel data ports.
  const panes=front.length&&rear.length?[front,rear]:[banks];if(panes.length>1)ratio/=2.15;
  panes.forEach((pane,pi)=>{
   const paneY=pi/panes.length,paneH=1/panes.length;
   if(panes.length>1){rectangle(children,.01,paneY+.01,.98,paneH-.025,'#D8DEE0','#637780',.8);text(children,.025,paneY+.025,.22,paneH*.16,pi?'Rear':'Front',5);}
   const left=p.left??(forti?.23:p.vendor==='SonicWall'?.17:.07),right=p.right||.96;
   const widths=pane.map(b=>b.positions?0:Math.ceil(b.names.length/b.rows)*( /QSFP|CX4|X2/.test(b.form)?1.5:1)),total=widths.reduce((n,v)=>n+v,0)+.7*(pane.filter(b=>!b.positions).length-1);
   let at=left;
   pane.forEach((b,bi)=>{
    const step=(right-left)/Math.max(8,total),w=step*.74;
    b.names.forEach((n,i)=>{const row=i%b.rows+(b.rowOffset||0),pos=b.positions?.[i],y=Array.isArray(pos)?pos[1]:(b.rows===1&&!b.rowOffset?.5:(p.rowsY||[.32,.70])[row]),x=Array.isArray(pos)?pos[0]:pos??at+step*(Math.floor(i/b.rows)+.5);add(n,x,paneY+y*paneH,b.displayForm||b.form,b.side,b.positions?(b.socketWidth||.026):w,(p.rowsY?.[0]>.5?.15:.25)*paneH,!b.mirror,b.orientation||(b.rows===2&&row===0?'up':'down'));});
    if(!b.positions)at+=step*(widths[bi]+.7);
   });
  });
  if(forti)text(children,.025,.30,.17,.32,'FORTINET',7,'#59716C',true);
  if(views.length===1&&views[0]==='rear')text(children,.025,.03,.16,.18,'Rear',5);
  if(p.unknownUplinkType){rectangle(children,.87,.21,.08,.67,'#A5ADB1','#596B73',.5);}
  else if(p.unconfirmedUplinkModules){for(const [i,y] of [.21,.60].entries())if(!p.confirmedUplinkSlots?.includes(i+1))rectangle(children,.87,y,.08,.29,'#A5ADB1','#596B73',.5);}
 }
 if(p.panelBrand)text(children,.935,.04,.044,.12,p.panelBrand,4,'#F3C46F',true);
 return {ratio,ports,children,sockets,regions:[{y:0,h:1}],verified:true,source:p.source,profile:p};
}
function localName(p,name){
 let s=canon(name),m;
 if(p.aliases?.[s])s=canon(p.aliases[s]);
 if(p.naming==='cx')return s.match(/^\d+\/\d+\/(\d+)$/)?.[1]||s;
 if(p.naming==='classic')return s.match(/^\d+\/([ab]?\d+)$/)?.[1]||s;
 if(p.naming==='cisco'){
  if((m=/^(gi|te|twentyfivegige|tw|fortygigabitethernet|fo|hundredgige|hu|eth|ethernet)(\d+)\/(\d+)\/(\d+)$/i.exec(s)))return (m[3]==='1'&&!/C9500/.test(p.models[0])?'uplink':'')+m[4];
  if(p.unconfirmedUplinkModules&&(m=/^te\d+\/(\d+)$/.exec(s)))return 'uplink'+m[1];
  return s.match(/^(?:gi|te|eth|ethernet)\d+\/(\d+)$/)?.[1]||s;
 }
 if(p.naming==='junos'&&(m=/^(?:ge|xe|et)-(\d+)\/(\d+)\/(\d+)$/.exec(s)))return (m[2]==='1'?'uplink':m[2]==='2'?'vcp':'')+m[3];
 return s;
}
function mapObserved(layout,p,device){
 const points=new Map(Object.entries(layout.ports).map(([k,v])=>[canon(k),v]));
 for(const port of device.ports||[]){
  const name=canon(localName(p,port.name)),shared=layout.sockets.filter(s=>canon(s.name)===name);
  const media=String(port.configuredMedia||port.media||'');
  const selected=/copper|rj.?45|base-t|sgmii/i.test(media)?shared.find(s=>/RJ|copper/i.test(s.form)):/fiber|sfp|^(sr|lr|er|dac)$/i.test(media)?shared.find(s=>!/RJ|copper/i.test(s.form)):null;
  const point=selected?[selected.x,selected.y]:points.get(name);if(point){layout.ports[port.name]=[...point];if(selected){
   layout.ports[shared[0].name]=[...point];
   for(const s of shared)s.primary=s===selected;
   for(const c of layout.children)if(c.anchorName&&canon(c.anchorName)===name){delete c.anchorName;delete c.anchorOrigin;}
   const c=layout.children.find(c=>c.type==='rect'&&Math.abs(c.x+c.w/2-selected.x)<1e-8&&Math.abs(c.y+c.h/2-selected.y)<1e-8);
   if(c)Object.assign(c,{anchorName:shared[0].name,anchorOrigin:[...point]});
  }}
 }
 return layout;
}
function rearExpansion(panel,p,device){
 if(!p.models.some(m=>/^J(?:972[6-9]|9836)A$/.test(m)))return panel;
 const cards=(device.modules||[]).filter(m=>/^[AB]$/i.test(m.slot)),present=new Set((device.ports||[]).map(o=>String(o.name).match(/(?:^|\/)([AB])[12]$/i)?.[1]?.toUpperCase()).filter(Boolean));
 if(!cards.length&&!present.size)return panel;
 for(const c of panel.children){c.y*=.44;c.h*=.44;if(c.anchorOrigin)c.anchorOrigin=[c.anchorOrigin[0],c.anchorOrigin[1]*.44];}
 for(const pt of Object.values(panel.ports))pt[1]*=.44;
 for(const s of panel.sockets)s.y*=.44;
 rectangle(panel.children,0,.54,1,.44,'#D8DDDE','#5D7079',1);text(panel.children,.015,.55,.1,.08,'Rear',5);
 for(const [slot,x] of [['A',.11],['B',.34]]){
  const card=cards.find(c=>c.slot.toUpperCase()===slot),form=/^J9731A$/i.test(card?.model)?'SFP+':/^J9732A$/i.test(card?.model)?'RJ45':null;
  rectangle(panel.children,x,.59,.225,.33,'#BAC4C8','#71828A',.6);
  text(panel.children,x+.01,.60,.2,.07,slot+' '+(form?card.model:present.has(slot)?'module unspecified':'empty bay'),5);
  if(!form)continue;
  for(let n=1;n<=2;n++)panel.sockets.push(socket(panel.children,panel.ports,slot+n,x+(.33+(n-1)*.137)*.225,.805,form,'rear',.025,.12,true,form==='RJ45'?'up':'down'));
 }
 rectangle(panel.children,.58,.61,.13,.27,'#BAC4C8','#71828A',.6);text(panel.children,.59,.69,.11,.07,'Stacking bay',4);
 panel.regions=[{y:0,h:.44},{y:.54,h:.44}];panel.ratio/=2.15;return panel;
}
function buildFaceplate(device,options={}){
 const p=faceplateProfile(device),members=device.stackMembers||[],modules=device.modules||[];
 if(/^J985[01]A$/i.test(device.model||'')||/^J869[78]A$/i.test(device.model||'')){
  const count=/J9851|J8698/i.test(device.model)?12:6,rows=count/2,children=[],ports=Object.create(null),sockets=[],unit=.94/(rows+1),firstRow=.04+unit;
  const modern=/^J985[01]A$/i.test(device.model),ratio=modern?44.45/(count===12?30.73:17.53):count===12?1.15:2.25;
  rectangle(children,0,0,1,1,'#D8DDDE','#5D7079',1);text(children,.05,.015,.20,.045,device.model,6);
  if(modern){for(const x of [.055,.525]){rectangle(children,x,.06,.445,unit*.72,'#C5CED1','#7A8B92',.7);text(children,x+.012,.07,.25,.04,x<.1?'Management module':'Optional management bay',5);}
  for(let row=0;row<2;row++)for(let j=0;j<7;j++)rectangle(children,.075+j*.032,.09+unit*(.18+row*.17),.012,unit*.075,j%3?'#8D9DA3':'#6C925E');
  const managementY=.06+unit*.43;socket(children,ports,'oobm',.355,managementY,'RJ45','front',.027,unit*.30);socket(children,ports,'console',.43,managementY,'RJ45','front',.027,unit*.30,false);rectangle(children,.481,.06+unit*.23,.009,unit*.32,'#20313A');
  rectangle(children,.012,.10,.018,.72,'#8D9C9F');}
  for(let i=0;i<count;i++){
   const slot=String.fromCharCode(65+i),x=.04+(i%2)*.48,y=modern?firstRow+Math.floor(i/2)*unit:.16+Math.floor(i/2)*(.8/rows),w=.45,h=modern?unit*.91:.72/rows;
   rectangle(children,x,y,w,h,'#C2CCCF','#7A8B92',.7);text(children,x+.004,y+.004,.04,.05,slot,5);
   const module=modules.find(m=>m.slot===slot&&!m.member),profile=module&&faceplateProfile({model:module.model}),panel=baseLayout(profile);
   if(panel){for(const c of panel.children)children.push({...c,name:'Slot '+slot+': '+(c.name||c.type),x:x+c.x*w,y:y+c.y*h,w:c.w*w,h:c.h*h,...(c.anchorOrigin?{anchorName:slot+c.anchorName,anchorOrigin:[x+c.anchorOrigin[0]*w,y+c.anchorOrigin[1]*h]}:{})});for(const [n,pt] of Object.entries(panel.ports))ports[slot+n]=[x+pt[0]*w,y+pt[1]*h];for(const socket of panel.sockets)sockets.push({...socket,name:slot+socket.name,x:x+socket.x*w,y:y+socket.y*h});}
   else if(module)text(children,x+.055,y+h*.3,w-.075,h*.4,module.model+' / layout unconfirmed',6);
  }
  return {ratio,ports,children,sockets,regions:[{y:0,h:1}],verified:true,source:modern?'https://support.hpe.com/hpesc/public/api/document/emr_na-c04655001?docLocale=en_US':p?.source};
 }
 if(members.length>1||device.stackContinuation){
  const children=[],ports=Object.create(null),sockets=[],regions=[];let verified=true;
  const list=[...members].sort((a,b)=>Number(a.id)-Number(b.id));
  const panels=list.map(member=>{
   const profile=faceplateProfile({model:member.model}),localPorts=(device.ports||[]).filter(o=>{const m=String(o.name).match(/^(?:(?:GigabitEthernet|TenGigabitEthernet|Gi|Te|TwentyFiveGigE|HundredGigE|Ethernet|Eth))?(\d+)\//i);return m&&m[1]===String(member.id);});
   let panel=baseLayout(profile);if(panel)panel=rearExpansion(panel,profile,{ports:localPorts,modules:modules.filter(m=>String(m.member)===String(member.id))});
   return {member,profile,panel,localPorts,units:1/(panel?.ratio||10.2)};
  });
  const gap=.035*Math.max(.49,Math.min(1,options.padding??1))**2,total=panels.reduce((n,p)=>n+p.units,0)+gap*(panels.length-1);let cursor=0;
  for(const {member,profile,panel,localPorts,units} of panels){
   const top=cursor/total,height=units/total;cursor+=units+gap;
   if(!panel){verified=false;regions.push({y:top,h:height});for(const c of genericDeviceSymbol('switch').children)children.push({...c,name:'Member '+member.id+': '+c.name,y:top+c.y*height,h:c.h*height});text(children,.24,top+height*.12,.67,height*.18,[device.vendor,member.model].filter(Boolean).join(' ')+' / layout unconfirmed',6);continue;}
   mapObserved(panel,profile,{ports:localPorts});
   for(const region of panel.regions)regions.push({y:top+region.y*height,h:region.h*height});
   for(const c of panel.children)children.push({...c,name:'Member '+member.id+': '+(c.name||c.type),x:c.x,y:top+c.y*height,w:c.w,h:c.h*height,...(c.anchorOrigin?{anchorOrigin:[c.anchorOrigin[0],top+c.anchorOrigin[1]*height]}:{})});
   for(const port of localPorts){const pt=panel.ports[port.name];if(pt)ports[port.name]=[pt[0],top+pt[1]*height];}
   if(['cx','classic'].includes(profile.naming))for(const s of panel.sockets.filter(s=>s.primary&&/^(?:[AB])?\d+$/.test(s.name))){
    const name=member.id+(profile.naming==='cx'?'/1/':'/')+s.name;
    ports[name]=[s.x,top+s.y*height];sockets.push({...s,name,y:top+s.y*height});
   }
  }
  return {ratio:1/total,children,ports,sockets,regions,verified,source:p?.source};
 }
 const result=baseLayout(p);return result?mapObserved(rearExpansion(result,p,device),p,device):null;
}
export function deviceFaceplate(device,options={}){return consistentSockets(buildFaceplate(device,options));}
