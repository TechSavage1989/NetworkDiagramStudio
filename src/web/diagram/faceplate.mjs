import {faceplates} from '../imports/faceplates.mjs';
const normalize=v=>String(v||'').toUpperCase().replace(/[\s_]/g,'').replace(/^(?:FORTINET|SONICWALL|SOPHOS|CISCO(?:CATALYST)?|JUNIPER(?:NETWORKS)?|PALOALTO(?:NETWORKS)?)/,'').replace(/^(?:FORTIGATE|FGT?)-?(\d+[A-Z])$/,'FG-$1');
const profiles=new Map();for(const p of faceplates)for(const m of p.models)profiles.set(normalize(m),p);
export function faceplateProfile(d){return profiles.get(normalize(d.sku))||profiles.get(normalize(d.model));}
const canon=v=>String(v).toLowerCase().replace(/^gigabitethernet/,'gi').replace(/^tengigabitethernet/,'te').replace(/^management$/,'mgmt');
const rectangle=(a,x,y,w,h,fill,stroke='none',weight=.5)=>a.push({type:'rect',x,y,w,h,fill,stroke,weight});
const text=(a,x,y,w,h,value,size=5,color='#33434A',bold=false)=>a.push({type:'text',x,y,w,h,value,size,color,bold,align:'left'});
function socket(a,ports,name,x,y,form,view='front',w=.024,h=.23,primary=true){
 const first=a.length;
 const rj=/RJ|copper/i.test(form),wide=/QSFP|CX4|X2/.test(form),width=w*(wide?1.45:1),height=h*(rj?1:.86);
 rectangle(a,x-width/2,y-height/2,width,height,rj?'#1D282D':'#6F777B',rj?'#66757B':'#39484F',.5);
 if(rj){rectangle(a,x-width*.36,y-height*.28,width*.72,height*.49,'#101A1E');rectangle(a,x-width*.18,y+height*.13,width*.36,height*.30,'#879296');for(let j=0;j<4;j++)rectangle(a,x-width*.29+j*width*.17,y-height*.3,width*.05,height*.13,'#D3B266');}
 else {rectangle(a,x-width*.4,y-height*.35,width*.8,height*.7,'#182D36');rectangle(a,x-width*.3,y+height*.23,width*.6,height*.05,'#D7DCDE');}
 for(let i=first;i<a.length;i++)a[i].name='Port '+name+' '+form;
 if(primary){ports[name]=[x,y];Object.assign(a[first],{anchorName:name,anchorOrigin:[x,y]});}return {name,x,y,form,view};
}
function banksFor(p){return p.banks?.filter(b=>!b.optional)||[];}
function baseLayout(p){
 if(!p?.verified)return null;
 const ports=Object.create(null),children=[],sockets=[];let ratio=p.ratio||(p.module?5:10.2);
 const forti=p.vendor==='Fortinet',desktop=/FG-60F|FG-61F|XGS1\d\d|PA-4[1456]0/.test(p.models.join(' '));
 if(desktop&&!p.ratio)ratio=5.2;if(p.models.includes('JL679A'))ratio=5.8;
 rectangle(children,0,0,1,1,p.bodyFill||(forti?'#F3F3F0':p.vendor==='SonicWall'?'#D8DADD':'#D9DDDF'),'#52636B',1);
 rectangle(children,.008,.07,.006,.86,'#899397');rectangle(children,.985,.07,.006,.86,'#899397');
 if(p.vents)for(let x=.025;x<.97;x+=.018)for(let y=.06;y<.45;y+=.09)rectangle(children,x,y,.011,.045,'#303A3F');
 const add=(...args)=>{sockets.push(socket(children,ports,...args));};
 if(p.sockets){
  const max=Math.max(p.module?1:29,...p.sockets.map(s=>s[1]));
  for(const [n,col,row,form,suffix] of p.sockets){let x=.052+col*(.91/(max+1)),y=row===0?.32:.70;
   if(p.models.some(m=>['JL675A','JL676A','R9Y04A'].includes(m))){if(n>=49)x=n<=50?.03386:.08466;else x=.138056+Math.floor((n-1)/2)*(.770069/23);y=n>=49?(row===0?.33153:.70476):(row===0?.34575:.69055);}
   const name=String(n);add(name,x,y,form,'front',p.module?.05:.022,.25,!suffix);
  }
  if(!p.module){rectangle(children,.937,.2,.033,.53,'#ECEFEE','#8B979D',.6);for(let n=0;n<4;n++)rectangle(children,.944,.27+n*.1,.007,.04,n===0?'#699B58':'#899799');}
 }else if(forti&&p.models.some(m=>/^FG-12[01]G$/.test(m))){
  text(children,.035,.22,.23,.32,'FORTINET',7,'#59716C',true);rectangle(children,.27,.23,.022,.15,'#16272D');rectangle(children,.296,.26,.022,.24,'#26383F');
  add('ha',.339,.36,'RJ45');add('mgmt',.339,.69,'RJ45');
  for(let n=1;n<=16;n++)add('port'+n,.385+Math.floor((n-1)/2)*.0334,n%2?.36:.69,'RJ45');
  for(let n=1;n<=4;n++)add('x'+n,.6648+Math.floor((n-1)/2)*.0308,n%2?.36:.69,'SFP+');
  for(let n=17;n<=24;n++)add('port'+n,.7339+Math.floor((n-17)/2)*.0300,n%2?.36:.69,'SFP');
 }else if(forti&&p.models.some(m=>/^FG-20[01]G$/.test(m))){
  ratio=9.8;text(children,.025,.17,.15,.30,'FORTINET',7,'#59716C',true);rectangle(children,.14,.40,.025,.27,'#203139');rectangle(children,.14,.76,.025,.09,'#17262D');
  add('ha',.203,.43,'RJ45');add('mgmt',.203,.71,'RJ45');
  for(let n=1;n<=8;n++)add('port'+n,.324+Math.floor((n-1)/2)*.0335,n%2?.42:.70,'RJ45');
  for(let n=9;n<=16;n++)add('port'+n,.477+Math.floor((n-9)/2)*.0335,n%2?.42:.70,'RJ45');
  for(let n=1;n<=8;n++)add('x'+n,.670+Math.floor((n-1)/2)*.0338,n%2?.42:.70,'SFP+');
  for(let n=17;n<=20;n++)add('port'+n,.821+Math.floor((n-17)/2)*.034,n%2?.42:.70,'SFP');
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
    b.names.forEach((n,i)=>{const row=i%b.rows+(b.rowOffset||0),pos=b.positions?.[i],y=Array.isArray(pos)?pos[1]:(b.rows===1&&!b.rowOffset?.5:(p.rowsY||[.32,.70])[row]),x=Array.isArray(pos)?pos[0]:pos??at+step*(Math.floor(i/b.rows)+.5);add(n,x,paneY+y*paneH,b.displayForm||b.form,b.side,b.positions?(b.socketWidth||.026):w,(p.rowsY?.[0]>.5?.15:.25)*paneH,!b.mirror);});
    if(!b.positions)at+=step*(widths[bi]+.7);
   });
  });
  if(forti)text(children,.025,.30,.17,.32,'FORTINET',7,'#59716C',true);
  if(views.length===1&&views[0]==='rear')text(children,.025,.03,.16,.18,'Rear',5);
  if(p.unconfirmedUplinkModules){for(const y of [.21,.60])rectangle(children,.87,y,.08,.29,'#A5ADB1','#596B73',.5);}
 }
 return {ratio,ports,children,sockets,verified:true,source:p.source,profile:p};
}
function localName(p,name){
 let s=canon(name),m;
 if(p.aliases?.[s])s=canon(p.aliases[s]);
 if(p.naming==='cx')return s.match(/^\d+\/\d+\/(\d+)$/)?.[1]||s;
 if(p.naming==='classic')return s.match(/^\d+\/(\d+)$/)?.[1]||s;
 if(p.naming==='cisco'){
  if((m=/^(gi|te|twentyfivegige|tw|fortygigabitethernet|fo|hundredgige|hu|eth|ethernet)(\d+)\/(\d+)\/(\d+)$/i.exec(s)))return (m[3]==='1'&&!/C9500/.test(p.models[0])?'uplink':'')+m[4];
  return s.match(/^(?:gi|te|eth|ethernet)\d+\/(\d+)$/)?.[1]||s;
 }
 if(p.naming==='junos'&&(m=/^(?:ge|xe|et)-(\d+)\/(\d+)\/(\d+)$/.exec(s)))return (m[2]==='1'?'uplink':m[2]==='2'?'vcp':'')+m[3];
 return s;
}
function mapObserved(layout,p,device){
 const points=new Map(Object.entries(layout.ports).map(([k,v])=>[canon(k),v]));
 for(const port of device.ports||[]){const point=points.get(canon(localName(p,port.name)));if(point)layout.ports[port.name]=[...point];}
 return layout;
}
export function deviceFaceplate(device){
 const p=faceplateProfile(device),members=device.stackMembers||[],modules=device.modules||[];
 if(/^J985[01]A$/i.test(device.model||'')||/^J869[78]A$/i.test(device.model||'')){
  const count=/J9851|J8698/i.test(device.model)?12:6,rows=count/2,children=[],ports=Object.create(null),sockets=[];
  rectangle(children,0,0,1,1,'#D8DDDE','#5D7079',1);text(children,.05,.025,.8,.07,device.model,6);
  for(let i=0;i<count;i++){
   const slot=String.fromCharCode(65+i),x=.04+(i%2)*.48,y=.16+Math.floor(i/2)*(.8/rows),w=.45,h=.72/rows;
   rectangle(children,x,y,w,h,'#C2CCCF','#7A8B92',.7);text(children,x+.004,y+.004,.04,.05,slot,5);
   const module=modules.find(m=>m.slot===slot&&!m.member),profile=module&&faceplateProfile({model:module.model}),panel=baseLayout(profile);
   if(panel){for(const c of panel.children)children.push({...c,name:'Slot '+slot+': '+(c.name||c.type),x:x+c.x*w,y:y+c.y*h,w:c.w*w,h:c.h*h,...(c.anchorOrigin?{anchorOrigin:[x+c.anchorOrigin[0]*w,y+c.anchorOrigin[1]*h]}:{})});for(const [n,pt] of Object.entries(panel.ports))ports[slot+n]=[x+pt[0]*w,y+pt[1]*h];}
  }
  return {ratio:count===12?1.15:2.25,ports,children,sockets,verified:true,source:p?.source};
 }
 if(members.length>1){
  const children=[],ports=Object.create(null),sockets=[];let verified=true;
  const list=[...members].sort((a,b)=>Number(a.id)-Number(b.id));
  for(const [i,member] of list.entries()){
   const profile=faceplateProfile({model:member.model}),panel=baseLayout(profile),top=i/list.length,height=.93/list.length;
   if(!panel){verified=false;rectangle(children,0,top,1,height,'#E4E8EA','#819198',1);continue;}
   const localPorts=(device.ports||[]).filter(o=>{const m=String(o.name).match(/^(?:(?:Gi|Te|TwentyFiveGigE|HundredGigE|Ethernet|Eth))?(\d+)\//i);return m&&m[1]===String(member.id);});
   mapObserved(panel,profile,{ports:localPorts});
   for(const c of panel.children)children.push({...c,name:'Member '+member.id+': '+(c.name||c.type),x:c.x,y:top+c.y*height,w:c.w,h:c.h*height,...(c.anchorOrigin?{anchorOrigin:[c.anchorOrigin[0],top+c.anchorOrigin[1]*height]}:{})});
   for(const port of localPorts){const pt=panel.ports[port.name];if(pt)ports[port.name]=[pt[0],top+pt[1]*height];}
  }
  return {ratio:10.2/list.length,children,ports,sockets,verified,source:p?.source};
 }
 const result=baseLayout(p);return result?mapObserved(result,p,device):null;
}
