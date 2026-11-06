import {cidr,device,empty,ensurePort,ensureVlan} from './model.mjs';
import {identify} from './hardware.mjs';
import {at,child,children,parseXML,text} from './config-xml.mjs';

const fallback=name=>name.replace(/\.[^.]+$/,'').slice(0,180);
const words=s=>[...s.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g)].map(m=>m[1]??m[2]??m[3]);
const host=(name,vendor,model='')=>device(name,{kind:'firewall',vendor,model,fromConfig:true});
const result=d=>({devices:[d],links:[],warnings:[]});
const supportedIPv4=s=>/^\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?$/.test(s);
function address(p,ip) {
  if(!ip)return;
  if(!p.ip)p.ip=ip;
  else if(p.ip!==ip)p.ips=[...new Set([p.ip,...(p.ips||[]),ip])];
}
function tagged(d,p,tag,parent) {
  if(!/^\d+$/.test(String(tag))||Number(tag)<1||Number(tag)>4094)return;
  p.vlan=Number(tag);p.parent=parent;p.role='VLAN subinterface';
  const v=ensureVlan(d,p.vlan);v.name||=p.name;
  v.interfaces||=[];let entry=v.interfaces.find(x=>x.name===p.name&&x.parent===parent);
  if(!entry){entry={name:p.name,parent};v.interfaces.push(entry);}
  if(p.ip){entry.ip=p.ip;v.ip||=p.ip;}
}
function route(d,destination,nextHop,iface,options={}) {
  if(destination)d.routes.push({destination,nextHop:nextHop||'',interface:iface||'',type:'static',...options});
}

function panXML(root,filename){
  const nodes=children(child(root,'devices'),'entry');
  if(!nodes.some(n=>child(n,'network')||child(n,'deviceconfig')))return null;
  const output=empty();
  for(const [i,n] of nodes.entries()){
    if(!child(n,'network')&&!child(n,'deviceconfig'))continue;
    const system=at(n,'deviceconfig/system');
    const nodeName=text(system,'hostname')||(n.attrs.name==='localhost.localdomain'?'':n.attrs.name);
    const d=host(nodeName||fallback(filename)+(nodes.length>1?'-'+(i+1):''),'Palo Alto Networks');
    if(text(system,'ip-address'))d.ip=text(system,'ip-address');
    const net=child(n,'network');
    for(const category of child(net,'interface')?.children||[]){
      const physical=children(category,'entry');
      for(const item of physical){
        if(!item.attrs.name)continue;
        const p=ensurePort(d,item.attrs.name);
        const comment=text(item,'comment');if(comment)p.description=comment;
        for(const mode of ['layer3','layer2','virtual-wire','tap','ha','aggregate-group']){
          const segment=child(item,mode);if(!segment)continue;
          p.role=mode;if(mode==='aggregate-group')p.lag=segment.value.trim();
          for(const ip of children(child(segment,'ip'),'entry'))address(p,ip.attrs.name);
          for(const sub of children(child(segment,'units'),'entry')){
            if(!sub.attrs.name)continue;const unit=ensurePort(d,sub.attrs.name);unit.parent=p.name;
            for(const ip of children(child(sub,'ip'),'entry'))address(unit,ip.attrs.name);
            tagged(d,unit,text(sub,'tag'),p.name);
          }
        }
      }
      for(const unit of children(child(category,'units'),'entry')){
        if(!unit.attrs.name)continue;const p=ensurePort(d,unit.attrs.name);p.role=category.name;
        for(const ip of children(child(unit,'ip'),'entry'))address(p,ip.attrs.name);
      }
    }
    for(const vr of children(child(net,'virtual-router'),'entry')){
      for(const r of children(at(vr,'routing-table/ip/static-route'),'entry'))
        route(d,text(r,'destination'),text(r,'nexthop/ip-address')||text(r,'nexthop/next-vr'),text(r,'interface'),{context:vr.attrs.name,metric:text(r,'metric')});
    }
    for(const b of children(child(net,'virtual-wire'),'entry')){
      const members=[text(b,'interface1'),text(b,'interface2')].filter(Boolean);
      if(members.length===2)(d.bridges||=[]).push({name:b.attrs.name,type:'virtual-wire-pair',members});
    }
    output.devices.push(d);
  }
  return output;
}

function panSet(source,filename) {
  if(!/^set (?:deviceconfig system hostname |network (?:interface (?:ethernet|aggregate-ethernet) |virtual-router |virtual-wire ))/m.test(source))return null;
  const name=/^set deviceconfig system hostname (.+)$/m.exec(source)?.[1];
  const d=host(name?words(name)[0]:fallback(filename),'Palo Alto Networks'),routes=new Map(),pairs=new Map();
  for(const raw of source.split(/\r?\n/)){
    const w=words(raw.trim());if(w[0]!=='set')continue;
    const value=k=>{const i=w.indexOf(k);return i<0?'':w[i+1]||'';};
    if(w[1]==='deviceconfig'&&w[2]==='system'&&w[3]==='ip-address'){d.ip=w[4];continue;}
    if(w[1]!=='network')continue;
    if(w[2]==='interface'&&['ethernet','aggregate-ethernet','vlan','loopback','tunnel'].includes(w[3])&&w[4]){
      const isUnit=['vlan','loopback','tunnel'].includes(w[3]);const parent=isUnit?w[3]:w[4],name=value('units')||parent;
      const p=ensurePort(d,name);if(!isUnit&&name!==parent){ensurePort(d,parent);p.parent=parent;}
      if(value('ip') && supportedIPv4(value('ip')))address(p,value('ip'));
      if(value('tag'))tagged(d,p,value('tag'),parent);
      if(w[5]==='comment')p.description=w.slice(6).join(' ');
      if(w.includes('aggregate-group'))p.lag=value('aggregate-group');
      if(name===parent && ['layer2','layer3','virtual-wire','tap','ha'].includes(w[5]))p.role=w[5];
    } else if(w[2]==='virtual-router'&&w[4]==='routing-table'&&w[5]==='ip'&&w[6]==='static-route'&&w[7]){
      const key=JSON.stringify([w[3],w[7]]),r=routes.get(key)||{context:w[3],name:w[7]};
      if(value('destination'))r.destination=value('destination');
      if(value('ip-address')||value('next-vr'))r.nextHop=value('ip-address')||value('next-vr');
      if(value('interface'))r.interface=value('interface');if(value('metric'))r.metric=value('metric');routes.set(key,r);
    }else if(w[2]==='virtual-wire'&&w[3]){
      const pair=pairs.get(w[3])||{};for(const field of ['interface1','interface2'])if(value(field))pair[field]=value(field);
      pairs.set(w[3],pair);
    }
  }
  for(const p of d.ports)if(p.vlan)tagged(d,p,p.vlan,p.parent);
  for(const r of routes.values())route(d,r.destination,r.nextHop,r.interface,{context:r.context,...(r.metric?{metric:r.metric}:{})});
  for(const [name,p] of pairs)if(p.interface1&&p.interface2)(d.bridges||=[]).push({name,type:'virtual-wire-pair',members:[p.interface1,p.interface2]});
  return result(d);
}

function bsdFirewall(root,filename){
  if(root.name!=='pfsense'&&root.name!=='opnsense')return null;
  if(!child(root,'interfaces') && !child(root,'system'))return null;
  const vendor=root.name==='pfsense'?'pfSense':'OPNsense';
  const d=host(text(root,'system/hostname')||fallback(filename),vendor);
  const named=new Map(),groups=new Map();
  for(const v of children(child(root,'vlans'),'vlan')){
    const parent=text(v,'if'),tag=text(v,'tag'),iface=text(v,'vlanif')||text(v,'device');
    if(!parent||!tag)continue;
    const vlan=ensureVlan(d,tag);vlan.name=text(v,'descr')||vlan.name||'';
    if(iface){groups.set(iface,{parent,tag});tagged(d,ensurePort(d,iface),tag,parent);}
  }
  for(const int of child(root,'interfaces')?.children||[]){
    const iface=text(int,'if');if(!iface)continue;named.set(int.name,iface);
    const p=ensurePort(d,iface);p.alias=text(int,'descr')||int.name;
    const ip=text(int,'ipaddr'),prefix=text(int,'subnet');if(supportedIPv4(ip))address(p,prefix?ip+'/'+prefix:ip);
    else if(ip)p.addressMode=ip;
    p.admin=child(int,'enable')&&!/^(0|off|false)$/i.test(text(int,'enable'))?'up':'down';
    const group=groups.get(iface);if(group)tagged(d,p,group.tag,group.parent);
  }
  const gateways=new Map();
  for(const g of [...children(child(root,'gateways'),'gateway_item'),...children(at(root,'OPNsense/Gateways'),'gateway_item')]){
    const gateway={nextHop:text(g,'gateway'),interface:named.get(text(g,'interface'))||text(g,'interface')};
    for(const key of [text(g,'name'),g.attrs.uuid])if(key)gateways.set(key,gateway);
  }
  for(const r of children(child(root,'staticroutes'),'route')){
    const gateway=text(r,'gateway'),g=gateways.get(gateway);
    route(d,text(r,'network'),g?.nextHop||gateway,g?.interface,{...(gateway?{gatewayName:gateway}:{}),...((child(r,'disabled')||text(r,'enabled')==='0')?{status:'disabled'}:{})});
  }
  for(const b of children(child(root,'bridges'),'bridged')){
    const members=text(b,'members').split(',').map(z=>named.get(z.trim())||z.trim()).filter(Boolean);
    if(members.length)(d.bridges||=[]).push({name:text(b,'bridgeif')||text(b,'descr')||'bridge',type:'bridge',members});
  }
  return result(d);
}

function asa(source,filename){
  if(!/^(?:ASA Version\s|Cisco Adaptive Security Appliance|: Hardware:\s+(?:ASA|FPR))|^\s+nameif\s+\S+[\s\S]*?^\s+security-level\s+\d+/im.test(source))return null;
  const name=/^hostname\s+(\S+)/im.exec(source)?.[1]||fallback(filename);
  const hardware=/^:\s*Hardware:\s*([^,\s]+)/im.exec(source)?.[1]||'';
  const d=host(name,'Cisco',hardware),alias=new Map(),pending=[];
  let p=null;
  for(const raw of source.split(/\r?\n/)){
    const s=raw.trim();let m;
    if((m=/^interface\s+(\S+)/i.exec(s))){p=ensurePort(d,m[1]);continue;}
    if(/^!|^exit$/i.test(s)){p=null;continue;}
    if((m=/^route\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\d+))?/i.exec(s))){pending.push(m);p=null;continue;}
    if(!p || !/^\s/.test(raw))continue;
    if((m=/^nameif\s+(\S+)/i.exec(s))){p.alias=m[1];alias.set(m[1],p.name);}
    else if((m=/^description\s+(.+)/i.exec(s)))p.description=m[1];
    else if((m=/^ip address\s+(\d[\d.]+)\s+(\d[\d.]+)/i.exec(s)))p.ip=cidr(m[1],m[2]);
    else if((m=/^vlan\s+(\d+)/i.exec(s))){p.vlan=Number(m[1]);p.parent=p.name.split('.')[0];}
    else if((m=/^channel-group\s+(\d+)/i.exec(s)))p.lag=m[1];
    else if(s==='shutdown'||s==='no shutdown')p.admin=s==='shutdown'?'down':'up';
  }
  for(const p of d.ports)if(p.vlan)tagged(d,p,p.vlan,p.parent);
  for(const m of pending)route(d,cidr(m[2],m[3]),m[4],alias.get(m[1])||m[1],{alias:m[1],...(m[5]?{distance:m[5]}:{})});
  return result(d);
}

// SonicWall documents EXP as Base64-wrapped settings. Decode only recognized,
// bounded settings, never another vendor's opaque backup or arbitrary Base64.
function sonicSettings(source){
  if(source.length>48*1024*1024)return null;
  const encoded=source.replace(/\s/g,'').replace(/&&$/,'');
  if(!encoded.startsWith('Y2hlY2tzdW1WZXJzaW9uP')||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return null;
  try{
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    return /^checksumVersion=\d+&/.test(decoded)&&/(?:^|&)shortProdName=/.test(decoded)&&/(?:^|&)iface_name_\d+=/.test(decoded)?decoded:null;
  }catch{return null;}
}
function sonicFlat(input,filename){
  const source=sonicSettings(input)||input;
  if(!/(?:^|[\r\n&])(?:firewallName|firewallModel|shortProdName)=/i.test(source) ||
     !/(?:^|[\r\n&])(?:iface_(?:name|ifnum|zone|static_ip)_\d+|firewallModel)=/i.test(source))return null;
  const system=new Map(),ports=new Map(),routes=new Map();
  const decode=v=>{try{return decodeURIComponent(v.replace(/\+/g,' '));}catch{return v;}};
  for(const part of source.split(/[\r\n&]+/)){
    const m=/^\s*([a-zA-Z][\w]*)=(.*)$/.exec(part);if(!m)continue;
    const k=m[1].toLowerCase(),v=decode(m[2].trim());
    if(k==='firewallname'||k==='firewallmodel'||k==='shortprodname'){system.set(k,v);continue;}
    const pi=/^iface_(name|ifnum|zone|comment|vlan_tag|vlan_parent|parent_ifnum|static_ip|static_mask|static_netmask|lan_ip|lan_mask|mgmt_ip|mgmt_netmask|port_disabled)_(\d+)$/.exec(k);
    const policy=/^routepolicy(dstnet|dst|mask|gw|gateway|iface|metric|enabled|srcnet|src|svc)_?(\d+)$/.exec(k);
    const rt=/^staticroute(dest|mask|gateway|interface|metric|enabled)_?(\d+)$/.exec(k);
    const key=pi||rt||policy;
    if(key){const map=pi?ports:routes;let index=policy?'policy-'+key[2]:key[2];let record=map.get(index);if(!record){record={};map.set(index,record);}if(policy)record.type='policy';record[key[1]]=v;}
  }
  const d=host(system.get('firewallname')||fallback(filename),'SonicWall',system.get('shortprodname')||system.get('firewallmodel')||'');
  const ifnames=new Map();
  for(const [id,row] of ports)if(row.name){ifnames.set(id,row.name);if(row.ifnum)ifnames.set(row.ifnum,row.name);}
  for(const row of ports.values()){
    if(!row.name)continue;const p=ensurePort(d,row.name);if(row.comment)p.description=row.comment;if(row.zone)p.zone=row.zone;
    const ip=[[row.static_ip,row.static_mask||row.static_netmask],[row.lan_ip,row.lan_mask],[row.mgmt_ip,row.mgmt_netmask]].find(([ip])=>supportedIPv4(ip)&&ip!=='0.0.0.0');if(ip)p.ip=cidr(...ip);
    if(row.port_disabled !== undefined)p.admin=/^(?:1|on|true)$/i.test(row.port_disabled)?'down':'up';
    const numbered=/^(X\d+):V(\d+)$/i.exec(row.name);
    const parent=row.vlan_parent||row.parent_ifnum;
    const parentName=ifnames.get(parent)||(/^(?:X\d+|U\d+)/i.test(parent||'')?parent:numbered?.[1]);
    if(parentName && (row.vlan_tag||numbered))tagged(d,p,row.vlan_tag||numbered[2],parentName);
  }
  for(const r of routes.values()){
    const dest=r.dest||r.dstnet||r.dst,iface=r.interface||r.iface;
    route(d,dest&&supportedIPv4(dest)?cidr(dest,r.mask):dest,r.gateway||r.gw,ifnames.get(iface)||iface,
      {...(r.type?{type:r.type}:{}),...(r.src||r.srcnet?{source:r.src||r.srcnet}:{}),
       ...(r.svc?{service:r.svc}:{}),...(r.metric?{metric:r.metric}:{}),
       ...(/^(off|0|false)$/i.test(r.enabled||'')?{status:'disabled'}:{})});
  }
  return result(d);
}

function sonicCLI(source,filename){
  if(!/\bSonic(?:OS|WALL)\b/i.test(source) &&
     !(/^\s*interface\s+"?X\d+/im.test(source) && /^\s*ip-assignment\s+/im.test(source)))return null;
  if(!/^\s*interface\s+(?:"?(?:X\d+|U\d+|MGMT))/im.test(source))return null;
  const n=/^\s*(?:firewall-name|hostname)\s+(.+)$/im.exec(source);
  const d=host(n?words(n[1])[0]:fallback(filename),'SonicWall');
  let p=null,mask='';
  for(const raw of source.split(/\r?\n/)){
    const w=words(raw.trim());if(!w.length)continue;
    if(w[0].toLowerCase()==='interface' && /^(?:X\d+|U\d+|MGMT)(?::V\d+)?$/i.test(w[1]||'')){
      p=ensurePort(d,w[1]);mask='';const numbered=/^(X\d+):V(\d+)$/i.exec(p.name);if(numbered){p.parent=numbered[1];p.vlan=Number(numbered[2]);}continue;}
    if(!p)continue;
    if(w[0]==='exit'){p=null;continue;}
    if(w[0]==='ip-assignment'){p.zone=w[1];p.addressMode=w[2];}
    else if(w[0]==='zone')p.zone=w[1];
    else if(w[0]==='comment')p.description=w.slice(1).join(' ');
    else if(w[0]==='ip' && w[1]==='address'&&supportedIPv4(w[2]))p.ip=cidr(w[2],w[3]||mask);
    else if((w[0]==='ip'&&w[1]==='subnet-mask')||w[0]==='netmask'){mask=w.at(-1);if(p.ip)p.ip=cidr(p.ip.split('/')[0],mask);}
    else if(w[0]==='ip'&&supportedIPv4(w[1]))p.ip=cidr(w[1],w[2]||mask);
  }
  for(const p of d.ports)if(p.vlan)tagged(d,p,p.vlan,p.parent);
  return result(d);
}

export function parseFirewall(textSource,filename) {
  const s=textSource.trim();
  if(s.startsWith('<')){
    const doc=parseXML(s);
    const root=doc.name==='response'?at(doc,'result/config'):doc;
    if(root?.name==='config'){const parsed=panXML(root,filename);if(parsed)return parsed;}
    const bsd=root&&bsdFirewall(root,filename);if(bsd)return bsd;
    return {devices:[],links:[],warnings:[filename+': unrecognized firewall XML. Supply a supported clear-text configuration or Auvik report, or add devices manually.']};
  }
  return panSet(s,filename)||asa(s,filename)||sonicFlat(s,filename)||sonicCLI(s,filename);
}
