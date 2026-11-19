import {macAddresses} from '../device-details.mjs';
import {unzip} from '../zip.mjs';
import {device, deviceId, empty, ensurePort, ensureVlan, portDescription, portName, rate} from './model.mjs';
import {identify} from './hardware.mjs';
import {classifyDeviceKind} from '../device-types.mjs';

const missing = v => ['','0','n/a','unknown','none','-'].includes(String(v??'').trim().toLowerCase());
const split = v => String(v||'').split(/[,;\n]/).map(t=>t.trim()).filter(t=>!missing(t));
// Auvik lists neighbors as "<interface>  on <device>", separated by ", ".
// An interface name can contain commas of its own (printer JetDirect cards
// report "HP ETHERNET MULTI-ENVIRONMENT,ROM none,JETDIRECT,..."), so a comma
// with no space after it never separates entries, unless a piece then holds
// two entries ("48  on SW-B,7  on SW-C"). A piece without " on " ends the
// previous entry's device name when that makes the name of a device the sheet
// knows ("on Front Desk, Lobby"); otherwise it starts the next entry's
// interface name ("Xerox Ethernet, 10/100/1000 Mbps  on PRN"). Entries never
// run across a semicolon or a line break.
const ON=/\s+on\s+\S/i;
const entriesIn=piece=>{
  if((piece.match(/\s+on\s+\S/gi)||[]).length<2)return [piece];
  const out=[];let pending='';
  for(const part of piece.split(',')){pending=pending?pending+','+part:part;if(ON.test(pending)){out.push(pending);pending='';}}
  if(pending)out[out.length-1]+=','+pending;
  return out;
};
const neighbors=(v,known=new Set())=>{
  const out=[];
  for(const line of String(v||'').split(/[;\n]/)){
    const entries=[];let lead='';
    for(const piece of line.split(/,(?=\s)/)){
      if(ON.test(piece)){for(const entry of entriesIn(piece)){entries.push((lead?lead+',':'')+entry);lead='';}continue;}
      const previous=entries.at(-1),device=previous&&/^(.+?)\s+on\s+(.+)$/i.exec(previous)?.[2].trim();
      if(previous&&!known.has(device.toLowerCase())&&known.has((device+','+piece).trim().toLowerCase()))entries[entries.length-1]+=','+piece;
      else lead=lead?lead+','+piece:piece;
    }
    if(lead&&entries.length)entries[entries.length-1]+=','+lead;
    out.push(...entries.map(t=>t.trim()));
  }
  return out.filter(t=>!missing(t));
};
// Auvik's names for devices it could not identify. Several rows with one of
// these names are different devices.
const placeholder=name=>/^(?:unidentified device|unknown name|unknown device|unnamed device)$/i.test(String(name||'').trim());
export function readCSV(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"' && (quoted || !cell)){if(quoted && text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted;}
    else if(!quoted && c===','){row.push(cell);cell='';}
    else if(!quoted && (c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);cell='';row=[];}
    else cell+=c;
    if(row.length>1500||rows.length>200000)throw new Error('Table exceeds the import limit.');
  }
  if(quoted)throw new Error('CSV contains an unclosed quoted field.');
  if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
const xmlEntities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
function unescapeXML(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(entity,code)=>{
    if(code[0]!=='#')return xmlEntities[code]??entity;
    const cp=code[1].toLowerCase()==='x'?parseInt(code.slice(2),16):Number(code.slice(1));
    return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):'';
  });
}
function attrs(s) {
  const a=Object.create(null);
  for(const m of s.matchAll(/(?:^|\s)([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))a[m[1]]=unescapeXML(m[2]??m[3]);
  return a;
}
// Read the OOXML tables only. Fields with formulae are treated as values; no formula is evaluated.
function* children(s,tag) {
  const re=new RegExp('<(?:[\\w]+:)?'+tag+'(?=[\\s/>])[^>]*?(?:\\s*\\/>|>([\\s\\S]*?)</(?:[\\w]+:)?'+tag+'>)','g');
  for(const m of s.matchAll(re)) yield [m[0],m[1]||''];
}
function richText(xml) { return [...children(xml,'t')].map(t=>unescapeXML(t[1])).join(''); }
function readRows(xml,strings,{maxRows=200000,maxColumns=1024}={}) {
  const rows=[];
  for(const match of children(xml,'row')){
    if(rows.length>=maxRows)throw new Error('Worksheet exceeds the row limit.');
    const row=[];
    for(const c of match[1].matchAll(/<(?:\w+:)?c(?=[\s>])([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)){
      const a=attrs(c[1]);let col=0;const letters=/^([A-Z]+)\d+$/.exec(a.r||'')?.[1];
      if(letters)for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;
      col=letters?col-1:row.length;if(col>=maxColumns)continue;
      const body=c[2]||'', value=children(body,'v').next().value?.[1]||'';
      row[col]=a.t==='s'?strings[Number(value)]||'':a.t==='inlineStr'?richText(body):unescapeXML(value);
    }
    rows.push(row);
  }
  return rows;
}
export async function workbookTables(file,worksheetNames=['Devices','Interfaces','Routes'],limits={}) {
  const {maxBytes=128*1024*1024,maxEntries=3000,maxPartBytes=128*1024*1024}=limits;
  const selected=new Set(worksheetNames.map(name=>String(name).toLowerCase()));
  const files=await unzip(file,{maxBytes,maxEntries});const decoder=new TextDecoder();
  const xml=path=>{const value=files.get(path);if(!value)return '';if(value.length>maxPartBytes)throw new Error('Workbook section is too large.');const text=decoder.decode(value);if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('DTD declarations are unsupported.');return text;};
  const wb=xml('xl/workbook.xml');if(!wb)throw new Error('Missing XLSX workbook.');
  const rids=new Map();
  for(const m of xml('xl/_rels/workbook.xml.rels').matchAll(/<(?:\w+:)?Relationship\s([^>]+)>/g)){
    const a=attrs(m[1]);if(a.TargetMode==='External'||!a.Target||a.Target.includes('..'))continue;
    const part=a.Target.startsWith('/')?a.Target.slice(1):a.Target.startsWith('xl/')?a.Target:'xl/'+a.Target;
    if(part.startsWith('xl/worksheets/'))rids.set(a.Id,part);
  }
  const strings=[...children(xml('xl/sharedStrings.xml'),'si')].map(m=>richText(m[1]));
  const tables=[];
  for(const m of wb.matchAll(/<(?:\w+:)?sheet\s([^>]+)>/g)){
    const a=attrs(m[1]);if(!selected.has((a.name||'').toLowerCase()))continue;
    const rid=a['r:id']??Object.entries(a).find(([k])=>k.endsWith(':id'))?.[1];
    const content=xml(rids.get(rid));if(content) tables.push({name:a.name,rows:readRows(content,strings,limits)});
  }
  return tables;
}

export function parseTable(rows, filename='report.csv') {
  const out=empty(), map=new Map();let headers=[],i=0,type='';
  for(;i<Math.min(rows.length,32);i++){
    headers=rows[i].map(c=>String(c??'').trim().toLowerCase().replace(/^\uFEFF/,''));
    if(headers.includes('interface name') && headers.includes('parent device')){type='ports';break;}
    if(headers.includes('device name') && headers.includes('destination') && headers.includes('next hop')){type='routes';break;}
    if(headers.includes('device name') && (headers.includes('make & model')||headers.includes('type'))){type='devices';break;}
  }
  if(!type){out.warnings.push(filename+': no supported Auvik Devices, Interfaces or Routes header found.');return out;}
  const get=n=>{const id=deviceId(n);if(!map.has(id))map.set(id,device(n));return map.get(id);};
  const ipCount=new Map(),knownDevices=new Set(type==='ports'?rows.slice(i+1).map(r=>String(r[headers.indexOf('parent device')]??'').trim().toLowerCase()).filter(Boolean):[]);
  if(type==='devices')for(const r of rows.slice(i+1))for(const ip of split(r[headers.indexOf('ip address(es)')]))ipCount.set(ip,(ipCount.get(ip)||0)+1);
  for(const row of rows.slice(i+1)){
    const val=k=>String(row[headers.indexOf(k)]??'').trim();
    const mac=macAddresses(['mac address','mac address(es)','mac addresses','mac','physical address','hardware address'].flatMap(key=>macAddresses(val(key)))).join(', ');
    let name=val(type==='ports'?'parent device':'device name');
    if(missing(name))continue;
    // Unidentified devices are told apart by their address: the Devices sheet
    // lists it, and their own Interfaces rows carry it in the configuration
    // details (or as the interface MAC). The switch ports Auvik lists for one
    // let a neighbor report naming the placeholder find the right device.
    const label=placeholder(name)&&(type==='devices'?split(val('ip address(es)'))[0]:type==='ports'?/\b(\d{1,3}(?:\.\d{1,3}){3})\s*\(\/\d+\)/.exec(val('configuration details'))?.[1]:'')||placeholder(name)&&type!=='routes'&&mac.split(', ')[0];
    const original=name;if(label)name+=' ('+label+')';
    const d=get(name);
    if(label)d.placeholderOf=deviceId(original);
    if(type==='devices'){
      if(label){
        const uplinks=split(val('connected to')).map(entry=>/^(.+?)\s+through\s+(.+)$/i.exec(entry)).filter(Boolean).map(m=>({device:m[1].trim(),port:m[2].trim()}));
        if(uplinks.length)d.placeholderUplinks=uplinks;
      }
      if(mac)d.mac=mac;
      const spec=identify(val('make & model'),val('description')); Object.assign(d,spec);
      const kind=classifyDeviceKind(val('type')); if(kind!=='unknown')d.kind=kind;
      const ips=split(val('ip address(es)'));if(ips.length) d.ips=ips;
      const single=ips.filter(ip=>ipCount.get(ip)===1);
      if(ips.length===1)d.ip=ips[0];else if(single.length===1)d.ip=single[0];
    }else if(type==='routes'){
      const destination=val('destination');if(destination)d.routes.push({destination,nextHop:val('next hop'),interface:val('gateway interface'),metric:val('metric'),type:'observed'});
    }else{
      const full=val('interface name');if(missing(full))continue;
      const p=ensurePort(d,full);p.type=val('type');if(mac)p.mac=mac;
      const alias=portDescription(full);if(alias)p.reportedDescription=alias;
      const oper=val('oper status').toLowerCase();if(oper==='up'||oper==='down')p.state=oper;
      const admin=val('admin status').toLowerCase();if(admin==='up'||admin==='down')p.admin=admin;
      const speed=rate(val('negotiated speed'));if(speed)p.speed=speed;
      for(const m of val('configuration details').matchAll(/\bVLAN\s+(\d+)(?:\s+\(([^)]*)\))?/gi)){
        const v=ensureVlan(d,m[1]);if(m[2])v.name ||=m[2];(p.reportedVlans||=[]).push(Number(m[1]));
      }
      for(const piece of neighbors(val('connected to'),knownDevices)){
        const match=/^(.+?)\s+on\s+(.+)$/i.exec(piece);if(!match)continue;
        const peer=match[2].trim(),remote=portName(match[1]); if(missing(remote)||missing(peer))continue;
        const b=get(peer);
        out.links.push({a:d.id,ap:p.name,b:b.id,bp:remote,media:'unknown',speed,status:'observed'});
      }
    }
  }
  out.devices=[...map.values()]; return out;
}
