import {physicalLink} from '../physical-links.mjs';
import {hardwareProfile,portCapability} from './hardware.mjs';

export const deviceId = name => String(name ?? '').trim().toLowerCase();
export const empty = () => ({devices: [], links: [], warnings: []});
export function device(name, fields = {}) {
  return {id: deviceId(name), name, kind: 'unknown', vendor: '', model: '', ports: [], vlans: [], routes: [], ...fields};
}
export function portName(value) {
  return String(value ?? '').trim().replace(/\s+\([^)]*\)\s*$/, '').replace(/^GigabitEthernet(?=\d)/i, 'Gi')
    .replace(/^TenGigabitEthernet(?=\d)/i, 'Te').replace(/^FastEthernet(?=\d)/i, 'Fa')
    .replace(/^Port-channel\s*(?=\d)/i, 'Port-channel').replace(/^lag\s*(?=\d)/i, 'lag ');
}
export function ensurePort(d, value) {
  const name = portName(value);
  let p = d.ports.find(p => deviceId(p.name) === deviceId(name));
  if (!p) { p = {name}; d.ports.push(p); }
  return p;
}
export function ensureVlan(d, id) {
  id = Number(id);
  if (!Number.isInteger(id) || id < 1 || id > 4094) return {};
  let vlan = d.vlans.find(v => v.id === id);
  if (!vlan) { vlan = {id}; d.vlans.push(vlan); }
  return vlan;
}
export function vlans(value) {
  const set = new Set();
  for (const part of String(value).trim().split(/[\s,]+/)) {
    if (part.toLowerCase() === 'all') return ['all'];
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) continue;
    const lo = Number(match[1]), hi = Number(match[2] || lo);
    if (lo < 1 || hi > 4094 || hi < lo) continue;
    for (let n = lo; n <= hi; n++) set.add(n);
  }
  return [...set].sort((a,b) => a-b);
}
export function cidr(ip, mask) {
  if (!ip) return '';
  if (ip.includes('/')) return ip;
  if (!mask) return ip;
  const octets = mask.split('.').map(Number);
  if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return ip;
  const bits = octets.map(n => n.toString(2).padStart(8,'0')).join('');
  return /^1*0*$/.test(bits) ? ip + '/' + bits.split('0')[0].length : ip;
}
export function rate(text) {
  const m = /^(\d+(?:\.\d+)?)\s*(T|G|M|K)?(?:bit\/s|bps|b\/s)$/i.exec(String(text).trim());
  return m && +m[1] > 0 ? Number(m[1]) + ' ' + (m[2]?.toUpperCase() ?? '') + 'bps' : '';
}
const meaningful = v => v !== '' && v !== null && v !== undefined && v !== 'unknown';
const key = row => JSON.stringify(row);
const uniq = rows => [...new Map(rows.map(x => [key(x),x])).values()];
function assign(target, input, ignore, warnings, label) {
  for (const [k,v] of Object.entries(input)) {
    if (ignore.includes(k) || !meaningful(v) || (Array.isArray(v) && !v.length)) continue;
    if (meaningful(target[k]) && key(target[k]) !== key(v)) {
      if (k === 'name' && deviceId(v) === deviceId(target[k])) continue;
      warnings.add(label + ' has conflicting ' + k + '. Review the sources before relying on this value.');
      continue;
    }
    target[k] = v;
  }
}
function mergeRoutes(routes, incoming) {
  for(const r of incoming) {
    const ix=routes.findIndex(old=>old.destination===r.destination && old.nextHop===r.nextHop &&
      (old.vdom||'')===(r.vdom||'') && (old.context||'')===(r.context||'') &&
      (old.source||'')===(r.source||'') && (old.service||'')===(r.service||'') &&
      (old.type==='policy')===(r.type==='policy') &&
      (old.status||'')===(r.status||'') && (old.interface===r.interface ||
      ((!old.interface||!r.interface) && old.type!==r.type)) &&
      (!old.metric || !r.metric || old.metric===r.metric));
    if(ix===-1) { routes.push({...r}); continue; }
    const old=routes[ix];
    if(!old.interface && r.interface) old.interface=r.interface;
    if(!old.metric && r.metric) old.metric=r.metric;
    if(old.type!==r.type) {
      old.evidence=[...new Set([...(old.evidence||[]),old.type,r.type].filter(Boolean))];
      if(old.type==='observed')old.type=r.type;
    }
  }
}
export function mergeModels(...models) {
  const devices = new Map(), links = new Map(), occupied = new Map(), warnings = new Set(), reported=[];
  for (const model of models.flat()) {
    for (const warning of model.warnings || []) warnings.add(warning);
    for (const input of model.devices || []) {
      if (!input.name || !input.id) continue;
      const id = deviceId(input.id);
      if (!devices.has(id)) devices.set(id, device(input.name,{id}));
      const d = devices.get(id);
      const inferred=v=>v.hardwareEvidence?.kind==='family-layout'&&v.hardwareEvidence.model===v.model;
      const declared=v=>meaningful(v.model)&&!/^unknown$/i.test(v.model)&&!inferred(v);
      if(inferred(d)&&declared(input)){d.model=input.model;delete d.hardwareEvidence;delete d.sku;}
      const ignore=['id','ports','vlans','routes','bridges','ips',...(declared(d)&&inferred(input)?['model','sku','hardwareEvidence']:[])];
      assign(d,input,ignore,warnings,d.name);
      for (const entry of input.ports || []) {
        const p = ensurePort(d,entry.name);
        assign(p,entry,['name'],warnings,d.name + ' ' + p.name);
      }
      for (const entry of input.vlans || []) assign(ensureVlan(d,entry.id),entry,[],warnings,d.name + ' VLAN ' + entry.id);
      mergeRoutes(d.routes,input.routes||[]);
      if (input.bridges) d.bridges = uniq([...(d.bridges||[]),...input.bridges]);
      if (input.ips) d.ips = [...new Set([...(d.ips||[]),...input.ips])];
    }
    for (const entry of model.links || []) {
      const e = {...entry, a:deviceId(entry.a), b:deviceId(entry.b), ap:portName(entry.ap), bp:portName(entry.bp)};
      if (!e.a || !e.b || !e.ap || !e.bp) continue;
      reported.push(e);
    }
  }
  // Reconcile only an existing adjacency with an explicit description naming a
  // known device AND a known far-end jack. Keep the original report for review.
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  for(const e of reported){
    for(const [local,lp,remote,rp,field] of [[e.a,e.ap,e.b,e.bp,'bp'],[e.b,e.bp,e.a,e.ap,'ap']]){
      const from=devices.get(local),to=devices.get(remote),description=from?.ports.find(p=>deviceId(p.name)===deviceId(lp))?.description;
      if(!to?.fromConfig||!description)continue;
      const desc=norm(description),stem=norm(to.name.replace(/(?:[-_ ](?:\d+[A-Z]|FG-?\d+[A-Z]))$/i,''));
      if(stem.length<6)continue;
      const candidates=to.ports.filter(p=>{const n=norm(p.name);return n&&desc.endsWith(stem+n)&&!['logical','aggregate','virtual'].includes(p.type)&&!p.parent;});
      if(candidates.length!==1||deviceId(candidates[0].name)===deviceId(rp))continue;
      e.reportedEndpoints||=[];e.reportedEndpoints.push({a:e.a,ap:e.ap,b:e.b,bp:e.bp});
      e[field]=candidates[0].name;e.endpointSource='configuration description';e.status='inferred';
      warnings.add(from.name+' '+lp+': reported peer '+to.name+' '+rp+' differs from the explicit configuration description. Drawing uses '+e[field]+'; verify the connection.');
    }
      let ends = [[e.a,deviceId(e.ap)],[e.b,deviceId(e.bp)]].map(key);
      if (ends[0] === ends[1]) continue;
      const id = key([...ends].sort());
      if (!links.has(id)) links.set(id,e);
      else assign(links.get(id),e,['a','ap','b','bp'],warnings,e.a+' '+e.ap+' / '+e.b+' '+e.bp);
      for (const endpoint of physicalLink(e,devices)?ends:[]) {
        if (!occupied.has(endpoint)) occupied.set(endpoint,new Set());
        occupied.get(endpoint).add(id);
      }
  }
  for (const [endpoint,ids] of occupied) if (ids.size > 1) {
    warnings.add(JSON.parse(endpoint).join(' ') + ' has multiple reported peers. Verify physical adjacency.');
    for (const id of ids) links.get(id).status = 'conflict';
  }
  for (const e of links.values()) {
    const physical=[];
    for (const [id,port] of [[e.a,e.ap],[e.b,e.bp]]) {
      const d=devices.get(id);
      if (!d) { devices.set(id,device(id)); ensurePort(devices.get(id),port); continue; }
      const p=ensurePort(d,port);
      const capability = portCapability(hardwareProfile(d),port);
      if(capability){p.capability=capability;physical.push(capability);}
      if(p.media && !meaningful(e.media) && e.status!=='conflict')e.media=p.media;
      if (p.state === 'down') {
        e.status = 'conflict';
        warnings.add(d.name+' '+port+' is reported down but has a reported peer.');
      }
    }
    if(!meaningful(e.media) && e.status!=='conflict' && physical.some(p=>/(?:base-t$|^RJ.?45$)/i.test(p)) &&
       physical.every(p=>/(?:base-t$|^RJ.?45$)/i.test(p))) e.media='copper';
    e.media ||= 'unknown'; e.speed ||= ''; e.status ||= 'observed';
  }
  return {devices:[...devices.values()], links:[...links.values()],warnings:[...warnings]};
}
