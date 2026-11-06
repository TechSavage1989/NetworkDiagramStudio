import {unzip} from '../zip.mjs';
import {device, deviceId, empty, ensurePort, ensureVlan, portName, rate} from './model.mjs';
import {identify} from './hardware.mjs';
import {classifyDeviceKind} from '../device-types.mjs';

const missing = v => ['','0','n/a','unknown','none','-'].includes(String(v??'').trim().toLowerCase());
const split = v => String(v||'').split(/[,;\n]/).map(t=>t.trim()).filter(t=>!missing(t));
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
function readRows(xml,strings) {
  const rows=[];
  for(const match of children(xml,'row')){
    if(rows.length>200000)throw new Error('Worksheet exceeds the row limit.');
    const row=[];
    for(const c of match[1].matchAll(/<(?:\w+:)?c(?=[\s>])([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)){
      const a=attrs(c[1]);let col=0;const letters=/^([A-Z]+)\d+$/.exec(a.r||'')?.[1];
      if(letters)for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;
      col=letters?col-1:row.length;if(col>=1024)continue;
      const body=c[2]||'', value=children(body,'v').next().value?.[1]||'';
      row[col]=a.t==='s'?strings[Number(value)]||'':a.t==='inlineStr'?richText(body):unescapeXML(value);
    }
    rows.push(row);
  }
  return rows;
}
export async function workbookTables(file) {
  const files=await unzip(file,{maxBytes:128*1024*1024,maxEntries:3000});const decoder=new TextDecoder();
  const xml=path=>{const value=files.get(path);if(!value)return '';const text=decoder.decode(value);if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('DTD declarations are unsupported.');return text;};
  const wb=xml('xl/workbook.xml');if(!wb)throw new Error('Missing XLSX workbook.');
  const rids=new Map();
  for(const m of xml('xl/_rels/workbook.xml.rels').matchAll(/<(?:\w+:)?Relationship\s([^>]+)>/g)){
    const a=attrs(m[1]);if(a.TargetMode==='External'||!a.Target||a.Target.includes('..'))continue;
    rids.set(a.Id,a.Target.startsWith('/')?a.Target.slice(1):'xl/'+a.Target);
  }
  const strings=[...children(xml('xl/sharedStrings.xml'),'si')].map(m=>richText(m[1]));
  const tables=[];
  for(const m of wb.matchAll(/<(?:\w+:)?sheet\s([^>]+)>/g)){
    const a=attrs(m[1]);if(!/^(Devices|Interfaces|Routes)$/i.test(a.name||''))continue;
    const rid=a['r:id']??Object.entries(a).find(([k])=>k.endsWith(':id'))?.[1];
    const content=xml(rids.get(rid));if(content) tables.push({name:a.name,rows:readRows(content,strings)});
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
  const ipCount=new Map();
  if(type==='devices')for(const r of rows.slice(i+1))for(const ip of split(r[headers.indexOf('ip address(es)')]))ipCount.set(ip,(ipCount.get(ip)||0)+1);
  for(const row of rows.slice(i+1)){
    const val=k=>String(row[headers.indexOf(k)]??'').trim();
    const name=val(type==='ports'?'parent device':'device name');
    if(missing(name))continue; const d=get(name);
    if(type==='devices'){
      const spec=identify(val('make & model'),val('description')); Object.assign(d,spec);
      const kind=classifyDeviceKind(val('type')); if(kind!=='unknown')d.kind=kind;
      const ips=split(val('ip address(es)'));if(ips.length) d.ips=ips;
      const single=ips.filter(ip=>ipCount.get(ip)===1);
      if(ips.length===1)d.ip=ips[0];else if(single.length===1)d.ip=single[0];
    }else if(type==='routes'){
      const destination=val('destination');if(destination)d.routes.push({destination,nextHop:val('next hop'),interface:val('gateway interface'),metric:val('metric'),type:'observed'});
    }else{
      const full=val('interface name');if(missing(full))continue;
      const p=ensurePort(d,full);p.type=val('type');
      const alias=/\s\(([^)]+)\)$/.exec(full)?.[1];if(alias)p.reportedDescription=alias;
      const oper=val('oper status').toLowerCase();if(oper==='up'||oper==='down')p.state=oper;
      const admin=val('admin status').toLowerCase();if(admin==='up'||admin==='down')p.admin=admin;
      const speed=rate(val('negotiated speed'));if(speed)p.speed=speed;
      for(const m of val('configuration details').matchAll(/\bVLAN\s+(\d+)(?:\s+\(([^)]*)\))?/gi)){
        const v=ensureVlan(d,m[1]);if(m[2])v.name ||=m[2];(p.reportedVlans||=[]).push(Number(m[1]));
      }
      for(const piece of split(val('connected to'))){
        const match=/^(.+?)\s+on\s+(.+)$/i.exec(piece);if(!match)continue;
        const peer=match[2].trim(),remote=portName(match[1]); if(missing(remote)||missing(peer))continue;
        const b=get(peer);
        out.links.push({a:d.id,ap:p.name,b:b.id,bp:remote,media:'unknown',speed,status:'observed'});
      }
    }
  }
  out.devices=[...map.values()]; return out;
}
