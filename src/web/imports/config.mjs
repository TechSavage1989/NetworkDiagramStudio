import {cidr, device, empty, ensurePort, ensureVlan, portName, vlans} from './model.mjs';
import {identify} from './hardware.mjs';
import {parseFirewall} from './firewalls.mjs';
import {completeConfigHardware} from './config-hardware.mjs';

const words = s => [...String(s).matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);
const scalar = s => words(s).join(' ');
const cleanBase = name => name.replace(/\.[^.]+$/,'').slice(0,180);
const pushRoute = (d,destination,nextHop,iface,more={}) => { if(destination) d.routes.push({destination,nextHop:nextHop||'',interface:iface||'',...more}); };

function fortios(text, filename) {
  const output = empty(), header = /^#config-version=([^-\s]+)/im.exec(text)?.[1] || '';
  const hostname = /(?:^|\n)config system global\s*\r?\n[\s\S]*?\bset hostname\s+([^\r\n]+)/i.exec(text)?.[1];
  const d = device(hostname ? scalar(hostname) : cleanBase(filename),{kind:'firewall',vendor:'Fortinet',model:identify(header).model});
  let scope = [], vdom = '';
  function finish(frame) {
    const f = frame.values, name = frame.name, area = frame.section;
    if (area === 'system interface') {
      const p = ensurePort(d,name);
      if (f.alias || f.description) p.description=scalar(f.alias||f.description);
      if(f.status) p.admin=scalar(f.status);
      if(f.speed) {p.configuredSpeed=scalar(f.speed); if (/10g.*sr/i.test(p.configuredSpeed)) p.media='10GBASE-SR';}
      if(f.type) p.configuredType=scalar(f.type);
      if(f.role)p.role=scalar(f.role);
      if(f.mediatype){p.configuredMedia=scalar(f.mediatype);if(/^(sr|lr|dac|copper)$/i.test(p.configuredMedia))p.media=p.configuredMedia.toUpperCase();}
      if(f.vdom) p.vdom=scalar(f.vdom);
      if(f.ip) { let [ip,mask]=words(f.ip); if(ip!=='0.0.0.0') p.ip=cidr(ip,mask); }
      if(f.vlanid) {p.vlan=Number(f.vlanid);p.parent=scalar(f.interface||'');p.role='VLAN subinterface';
        const v=ensureVlan(d,p.vlan); v.name ||= name;
        v.interfaces ||= []; v.interfaces.push({name,parent:p.parent,...(p.ip?{ip:p.ip}:{})}); if(p.ip)v.ip=p.ip;
      } else if(f.member) {p.members=words(f.member);p.role=f.type==='aggregate'?'aggregate':'logical';}
    } else if(area==='system sdwan members' && f.interface) {
      const p=ensurePort(d,scalar(f.interface));p.sdwanMember=true;
      if(f.gateway && f.gateway!=='0.0.0.0')p.gateway=scalar(f.gateway);
      if(f.zone)p.zone=scalar(f.zone);
      if(f.status)p.sdwanStatus=scalar(f.status);
    } else if(area==='system virtual-wire-pair' || area==='system switch-interface') {
      if(f.member) (d.bridges||=[]).push({name,type:area.endsWith('wire-pair')?'virtual-wire-pair':'switch-interface',members:words(f.member),...(vdom?{vdom}:{})});
    } else if(area==='router static') {
      let [ip,mask]=words(f.dst||'0.0.0.0 0.0.0.0');
      pushRoute(d,f.dstaddr?scalar(f.dstaddr):cidr(ip,mask),scalar(f.gateway||''),scalar(f.device||f['sdwan-zone']||''),{type:'static',...(f.status?{status:f.status}:{}),...(vdom?{vdom}:{}),...(f['dstaddr']?{addressObject:scalar(f.dstaddr)}:{})});
    }
  }
  for (const line of text.split(/\r?\n/)) {
    const s=line.trim(); let m;
    if((m=/^config (.+)$/i.exec(s))) { let area=m[1].toLowerCase();
      if(area==='members' && ['system sdwan','system virtual-wan-link'].includes(scope.at(-1)?.section))area='system sdwan members';
      scope.push({section:area}); continue; }
    if((m=/^edit (.+)$/i.exec(s))) { const area=scope.at(-1)?.section; if(!area)continue; const name=scalar(m[1]);
      if(area==='vdom')vdom=name;scope.push({section:area,name,values:{}}); continue; }
    if(s==='next') { const frame=scope.at(-1); if(frame?.values){ finish(frame); if(frame.section==='vdom')vdom=''; scope.pop();}continue; }
    if(s==='end') {if(scope.at(-1)?.values)finish(scope.pop());scope.pop();continue;}
    const frame=scope.at(-1);
    if(frame?.values && (m=/^set (member|alias|description|role|zone|vdom|status|speed|type|mediatype|ip|vlanid|interface|dst|dstaddr|gateway|device|sdwan-zone) (.*)$/i.exec(s))) frame.values[m[1].toLowerCase()]=m[2];
  }
  d.fromConfig=true;output.devices.push(d);return output;
}

function interfaceNames(value,warn=()=>{}) {
  const names=[];
  for(const item of value.replace(/\s+(?:to|-)\s+/ig,'-').split(',')){
    const part=item.trim(), m=/^(.*?)(\d+)\s*-\s*(.*?)(\d+)$/.exec(part);
    if(m){
      if((m[3]&&portName(m[3]).toLowerCase()!==portName(m[1]).toLowerCase())||+m[4]<+m[2]||+m[4]-+m[2]>=256){warn(part);continue;}
      for(let n=+m[2];n<=+m[4];n++)names.push(m[1]+n);
    }
    else if(part) names.push(part);
    if(names.length>1024){warn(value);return [];}
  }
  return names;
}
function switchCLI(text,filename) {
  const out=empty(); let hostname=/^(?:hostname|sysname)\s+(.+)$/im.exec(text)?.[1];
  const ranges=value=>interfaceNames(value,part=>{const note=filename+': unsupported interface range '+part+'. Review its individual ports.';if(!out.warnings.includes(note))out.warnings.push(note);});
  const aruba=/AOS-CX|ArubaOS-CX|^(?:vsf member|interface lag|\s*vlan trunk (?:native|allowed))\b/im.test(text);
  const classic=/ProCurve|ArubaOS-Switch|hpStack_|^;\s*[A-Z]+\d+[A-Z]\s+Configuration|^\s*(?:untagged|tagged)\s+\d/im.test(text);
  const huawei=/^sysname\s+/im.test(text);
  const cisco=/^\s*(?:switchport|channel-group)|^version\s+\d|^!\s*(?:Cisco|IOS)|IOS[- ](?:XE|XR)|NX-OS/im.test(text);
  if(!hostname && !aruba && !classic && !huawei && !cisco) return null;
  const modelMatch=/\bPID:\s*([\w-]+)|^\s*(?:type|switch\s+\d+\s+provision|member\s+\d+\s+type)\s+"?([\w-]+)|^;\s*([A-Z]+\d+[A-Z])\s+Configuration/im.exec(text);
  const model=identify(modelMatch?.slice(1).find(Boolean)||'');const vendor=aruba||classic?'HPE Aruba':huawei?(/Comware/i.test(text)?'HPE':'Huawei'):cisco?(/Arista|EOS version/i.test(text)?'Arista':'Cisco'):'';
  const kind=aruba||classic||model.kind==='switch'||/^\s*(?:switchport|port (?:link-type|access vlan|trunk pvid)|vlan batch)\b/im.test(text)?'switch':'unknown';
  const d=device(hostname?scalar(hostname):cleanBase(filename),{kind,vendor,model:model.model});
  const stackMembers=new Map(),modules=[];let member='';
  for(const raw of text.split(/\r?\n/)){
    const s=raw.trim();let m;
    if((m=/^(?:vsf\s+)?member\s+(\d+)(?:\s+type\s+"?([\w-]+))?/i.exec(s))){member=m[1];if(m[2])stackMembers.set(member,{id:member,model:identify(m[2]).model});}
    else if(member&&(m=/^type\s+"?([\w-]+)/i.exec(s)))stackMembers.set(member,{id:member,model:identify(m[1]).model});
    else if((m=/^switch\s+(\d+)\s+provision\s+(\S+)/i.exec(s)))stackMembers.set(m[1],{id:m[1],model:identify(m[2]).model});
    else if((m=/^module\s+(?:(\d+)\/)?([A-Z])\s+type\s+"?([\w-]+)/i.exec(s)))modules.push({member:m[1]||'',slot:m[2].toUpperCase(),model:identify(m[3]).model});
    if(/^(?:exit|!|interface\b)/i.test(s))member='';
  }
  if(stackMembers.size)d.stackMembers=[...stackMembers.values()];if(modules.length)d.modules=modules;
  let ports=[],section='', vids=[];
  for(const raw of text.split(/\r?\n/)){
    const s=raw.trim();let m;
    if(!s)continue;
    if((m=/^interface\s+(range\s+)?(.+)$/i.exec(s))){section='port';ports=[];vids=[];
      const label=m[2];const svi=/^(?:vlan(?:-interface|if)?\s*)(\d+)$/i.exec(label);
      if(svi){section='svi';vids=[Number(svi[1])];ensureVlan(d,svi[1]);}
      else for(const n of ranges(label)) ports.push(ensurePort(d,n));
      continue;
    }
    if((m=/^trunk\s+(.+?)\s+(trk\d+)\s+(lacp|trunk)$/i.exec(s))){
      const members=ranges(m[1]);for(const n of members)ensurePort(d,n).lag=m[2];
      Object.assign(ensurePort(d,m[2]),{role:'aggregate',type:'aggregate',members});continue;
    }
    if(!/^\s/.test(raw) && (m=/^vlan\s+([\d, -]+)$/i.exec(s))){section='vlan';ports=[];vids=vlans(m[1]);vids.forEach(id=>ensureVlan(d,id));continue;}
    if((m=/^ip route(?:-static)?\s+(\S+)\s+(.+)$/i.exec(s))){let tail=words(m[2]),dst=m[1];if(!dst.includes('/')&&/^\d+\.\d+\.\d+\.\d+$/.test(tail[0]) && tail.length>1)dst=cidr(dst,tail.shift());
      const hop=tail.find(x=>/^\d+\.\d+\.\d+\.\d+$/.test(x));const intf=tail[0]!==hop?tail[0]:'';pushRoute(d,dst,hop,intf,{type:'static'});continue;}
    if(/^(?:exit|quit|!|#)$/.test(s)){section='';ports=[];vids=[];continue;}
    if(!/^\s/.test(raw) && /^(?:hostname|router |line |spanning-tree|snmp|aaa |ntp |ip dns|https-|vlan batch)/i.test(s)){section='';ports=[];vids=[];continue;}
    if(section==='vlan' || section==='svi'){
      if((m=/^(?:name|description)\s+(.+)$/i.exec(s)))vids.forEach(id=>{ensureVlan(d,id).name=scalar(m[1]);});
      if((m=/^ip address\s+(\d[\d./]*)(?:\s+(\d[\d.]*))?/i.exec(s)))vids.forEach(id=>{ensureVlan(d,id).ip=cidr(m[1],m[2]);});
      if((m=/^(tagged|untagged)\s+(.+)$/i.exec(s)))for(const n of ranges(m[2])){const p=ensurePort(d,n);if(m[1]==='untagged')p.native=vids[0];else p.tagged=[...new Set([...(p.tagged||[]),...vids])];}
    }
    if(section!=='port')continue;
    for(const p of ports){
      if((m=/^(?:description|name)\s+(.+)$/i.exec(s)))p.description=scalar(m[1]);
      else if(/^(?:no shutdown|undo shutdown|enable)$/i.test(s))p.admin='up';
      else if(/^(?:shutdown|disable)$/i.test(s))p.admin='down';
      else if((m=/^(?:vlan access|switchport access vlan|port default vlan|port access vlan)\s+(\d+)/i.exec(s))){p.native=Number(m[1]);p.role='access';}
      else if((m=/^(?:vlan trunk native|switchport trunk native vlan|port trunk pvid vlan)\s+(\d+)/i.exec(s))){p.native=Number(m[1]);p.nativeTagged=/\btag\s*$/i.test(s);p.role='trunk';}
      else if((m=/^(?:vlan trunk allowed|switchport trunk allowed vlan|port trunk (?:allow-pass|permit) vlan)\s+(?:(add|remove|except)\s+)?(.+)/i.exec(s))){
        const values=vlans(m[2].replace(/\s+to\s+/ig,'-'));p.role='trunk';
        if(m[1]==='except') {p.allowedExcept=values;p.allowed=['all'];}
        else if(m[1]==='remove' && !p.allowed){p.allowedExcept=values;p.allowed=['all'];}
        else if(m[1]==='remove')p.allowed=p.allowed.filter(n=>!values.includes(n));
        else p.allowed=m[1]==='add'?[...new Set([...(p.allowed||[]),...values])]:values;
      }else if((m=/^(?:switchport mode|port link-type)\s+(access|trunk|hybrid)/i.exec(s)))p.role=m[1].toLowerCase();
      else if((m=/^(?:lag|channel-group|eth-trunk|port link-aggregation group)\s+(\d+)/i.exec(s)))p.lag=m[1];
      else if((m=/^ip address\s+(\d[\d./]*)(?:\s+(\d[\d.]*))?/i.exec(s)))p.ip=cidr(m[1],m[2]);
      else if((m=/^(?:speed|speed-duplex)\s+(\S+)/i.exec(s)))p.configuredSpeed=m[1];
      else if((m=/^switchport voice vlan\s+(\d+)/i.exec(s)))p.voice=Number(m[1]);
    }
  }
  for(const p of d.ports)if(p.allowed) p.tagged=p.allowed.filter(n=>p.nativeTagged||n!==p.native);
  completeConfigHardware(d,text,filename,out.warnings);
  d.fromConfig=true;out.devices.push(d);return out;
}

function junos(text,filename){
  if(!/^set (?:system host-name|interfaces |vlans |routing-options )/m.test(text))return null;
  const out=empty();const name=/^set system host-name\s+(\S+)/m.exec(text)?.[1]||cleanBase(filename);const d=device(name,{vendor:'Juniper',kind:'unknown'});
  const named=new Map(), units=new Map();
  for(const line of text.split(/\r?\n/)){
    const m=/^set vlans (\S+) vlan-id (\d+)/.exec(line);if(m){const v=ensureVlan(d,m[2]);v.name=m[1];named.set(v.name,v.id);}
  }
  for(const line of text.split(/\r?\n/)){
    let m;
    if((m=/^set interfaces (\S+) (.+)/.exec(line))){const p=ensurePort(d,m[1]);const rest=m[2];let a;
      if((a=/^description (.+)/.exec(rest)))p.description=scalar(a[1]);
      if((a=/interface-mode (access|trunk)/.exec(rest)))p.role=a[1];
      if((a=/vlan members (.+)/.exec(rest))){const ids=words(a[1].replace(/[\[\]]/g,'')).map(n=>named.get(n)??(/[^0-9]/.test(n)?n:Number(n)));p.vlanMembers=[...new Set([...(p.vlanMembers||[]),...ids])];}
      if((a=/802\.3ad (ae\d+)/.exec(rest)))p.lag=a[1];
      if((a=/unit (\d+) family inet address (\S+)/.exec(rest))){units.set(m[1]+'.'+a[1],a[2]);}
    }else if((m=/^set vlans (\S+) l3-interface (\S+)/.exec(line))&&named.has(m[1]))ensureVlan(d,named.get(m[1])).l3=m[2];
    else if((m=/^set routing-options static route (\S+) next-hop (\S+)/.exec(line)))pushRoute(d,m[1],m[2],'',{type:'static'});
  }
  for(const v of d.vlans)if(units.has(v.l3))v.ip=units.get(v.l3);
  for(const [key,ip] of units)ensurePort(d,key).ip=ip;
  if(d.ports.some(p=>p.role==='trunk'||p.role==='access'))d.kind='switch';
  for(const p of d.ports)if(p.vlanMembers){if(p.role==='access'&&p.vlanMembers.length===1&&Number.isInteger(p.vlanMembers[0]))p.native=p.vlanMembers[0];if(p.role==='trunk')p.tagged=p.vlanMembers.filter(Number.isInteger);}
  d.fromConfig=true;out.devices.push(d);return out;
}

function routerOS(text,filename){
  if(!/^\/(?:system identity|interface bridge|interface ethernet|ip address|ip route)(?:\s|$)/m.test(text))return null;
  const out=empty(), d=device(cleanBase(filename),{vendor:'MikroTik',kind:'unknown',fromConfig:true});
  let section='';
  for(const raw of text.replace(/\\\r?\n\s*/g,'').split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith('#'))continue;
    let command=line;
    if(line.startsWith('/')){
      const m=/^\/([^=]+?)(?:\s+(add|set)\s+(.*))?$/.exec(line);
      if(!m)continue;section=m[1];if(!m[2])continue;command=m[2]+' '+m[3];
    }
    if(!/^(add|set)\s/.test(command))continue;
    const f=Object.create(null);
    for(const m of command.matchAll(/(?:^|\s)([\w-]+)=(?:"((?:[^"\\]|\\.)*)"|([^\s\]]+))/g))f[m[1]]=m[2]??m[3];
    if(section==='system identity' && f.name){d.name=f.name;d.id=f.name.toLowerCase();}
    else if(section==='interface bridge'&&f.name){(d.bridges||=[]).push({name:f.name,type:'bridge',members:[]});}
    else if(section==='interface bridge port'&&f.interface&&f.bridge){const b=d.bridges?.find(b=>b.name===f.bridge);
      if(b)b.members.push(f.interface);const p=ensurePort(d,f.interface);if(f.pvid)p.native=Number(f.pvid);}
    else if(section==='interface bridge vlan'&&f['vlan-ids'])for(const vid of vlans(f['vlan-ids'])){
      ensureVlan(d,vid);for(const n of (f.tagged||'').split(',').filter(Boolean)){
        const p=ensurePort(d,n);p.tagged=[...new Set([...(p.tagged||[]),vid])];}
      for(const n of (f.untagged||'').split(',').filter(Boolean)){const p=ensurePort(d,n);p.untagged=[...new Set([...(p.untagged||[]),vid])];}
    }else if(section==='interface vlan' && f.name && f['vlan-id']){const p=ensurePort(d,f.name);p.parent=f.interface;p.vlan=Number(f['vlan-id']);ensureVlan(d,p.vlan).name=f.name;}
    else if(section==='ip address'&&f.address&&f.interface){const p=ensurePort(d,f.interface);p.ip=f.address;if(p.vlan)ensureVlan(d,p.vlan).ip=f.address;}
    else if(section==='ip route' && f.gateway)pushRoute(d,f['dst-address']||'0.0.0.0/0',f.gateway,'',{type:'static',...(f.disabled==='yes'?{status:'disabled'}:{})});
  }
  const model=/^#\s*model\s*=\s*(.+)$/im.exec(text)?.[1];
  if(model)Object.assign(d,identify(model.trim()));
  out.devices.push(d);return out;
}

export function parseConfig(text,filename='configuration.txt') {
  const s=String(text).replace(/^\uFEFF/,'');
  if(s.includes('\0'))return {devices:[],links:[],warnings:[filename+': '+(/r5\/version|net\/devices/.test(s.slice(0,65536))?'MikroTik binary backup detected. In RouterOS, run /export file=diagram and import diagram.rsc. Keep sensitive-data export disabled.':'Binary configuration detected. Export a readable text configuration instead of a device restore backup.')]};
  if(/^#config-version=/im.test(s) && !/^\s*config (?:system |vdom|global)/im.test(s))
    return {devices:[],links:[],warnings:[filename+': FortiOS header without clear-text configuration blocks. Supply an unencrypted export, Auvik report, or manual device.']};
  if(/^#config-version=|^config system (?:global|interface|virtual-wire-pair)\s*$/im.test(s))return fortios(s,filename);
  return parseFirewall(s,filename)||routerOS(s,filename)||junos(s,filename)||switchCLI(s,filename)||{devices:[],links:[],warnings:[filename+': unrecognized or opaque configuration. Supply a clear-text export or Auvik report, or add devices and ports manually.']};
}
