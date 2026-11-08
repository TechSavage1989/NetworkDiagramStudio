// Inventory-only port of SwitchPort Diagram Builder 1.18.5 MikroTikBackup.
// Archive paths are never extracted. Credential, script and user tables are skipped.
import {device,empty,ensurePort,ensureVlan} from './model.mjs';
import {identify} from './hardware.mjs';
const utf8=new TextDecoder(),safe=s=>String(s??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,400);
class Reader{
 constructor(bytes){this.bytes=bytes;this.at=0;this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);}
 get remaining(){return this.bytes.length-this.at;}
 take(n){if(!Number.isSafeInteger(n)||n<0||n>this.remaining)throw Error('Damaged MikroTik backup record.');const result=this.bytes.subarray(this.at,this.at+n);this.at+=n;return result;}
 uint(n){const at=this.at;this.take(n);return n===1?this.view.getUint8(at):n===2?this.view.getUint16(at,true):n===8?this.view.getBigUint64(at,true):this.view.getUint32(at,true);}
}
function message(bytes,depth=0){
 if(depth>12||bytes.length<2||bytes[0]!==77||bytes[1]!==50)throw Error('Unsupported MikroTik record encoding. Use a RouterOS .rsc export.');
 const r=new Reader(bytes),out=new Map();r.take(2);
 while(r.remaining){const tag=r.uint(4),key=tag&0xffffff,kind=(tag&0xf8000000)>>>0,small=!!(tag&0x01000000);let value;
  if(kind===0)value=small;
  else if(kind===0x08000000)value=r.uint(small?1:4);
  else if(kind===0x10000000)value=r.uint(8);
  else if([0x20000000,0x28000000,0x30000000].includes(kind)){const raw=r.take(r.uint(small?1:2));value=kind===0x28000000?message(raw,depth+1):kind===0x30000000?raw:utf8.decode(raw);}
  else if([0x80000000,0x88000000,0x90000000,0xa0000000].includes(kind)){const count=r.uint(2);value=[];for(let i=0;i<count;i++)value.push(kind===0x80000000?r.uint(1)!==0:kind===0x88000000?r.uint(4):kind===0x90000000?r.uint(8):utf8.decode(r.take(r.uint(2))));}
  else throw Error('Unsupported MikroTik record type. Use a RouterOS .rsc export.');
  const id=(key|kind)>>>0;if(out.has(id))throw Error('Duplicate MikroTik record field.');out.set(id,value);
 }return out;
}
const n=(m,k,fallback=0)=>m.get((k|0x08000000)>>>0)??fallback,b=(m,k)=>m.get(k)===true,s=(m,k)=>safe(m.get((k|0x20000000)>>>0)||''),a=(m,k)=>m.get((k|0x88000000)>>>0)||[];
export function routerosBackupMagic(bytes){return bytes.length>=4?new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0,true):0;}
export function decodeRouterosBackup(bytes){
 if(bytes.length>20_000_000)throw Error('Configuration exceeds the 20 MB limit.');
 const magic=routerosBackupMagic(bytes);if([0x7291a8ef,0x7391a8ef].includes(magic))throw Error('This MikroTik backup is encrypted. Load an unencrypted backup or a RouterOS .rsc export.');
 const r=new Reader(bytes);if(r.uint(4)!==0xb1a1ac88||r.uint(4)!==bytes.length)throw Error('The MikroTik backup is damaged or truncated.');
 const wanted=new Set(['system','net/devices','bridgeports','bridge-vlans','net/switch-vlans','net/music/vlan','net/music/vlan-ingress-trans','net/music/vlan-egress-trans']),tables=new Map();
 while(r.remaining){const length=r.uint(4);if(length>1024)throw Error('Invalid MikroTik backup table.');const name=utf8.decode(r.take(length)),index=r.take(r.uint(4)),data=r.take(r.uint(4));if(!wanted.has(name))continue;
  if(tables.has(name)||index.length%12)throw Error('Unsupported MikroTik backup index.');const idx=new Reader(index),dat=new Reader(data),records=[];
  while(idx.remaining){const id=idx.uint(4),size=idx.uint(4),flags=idx.uint(4);if(size<4||size>65535||size>dat.remaining||dat.uint(2)!==size)throw Error('Damaged MikroTik table entry.');const record=dat.take(size-2);if(!flags&&id<0xffffff00)records.push(message(record));}
  if(dat.remaining)throw Error('MikroTik table length does not match its index.');tables.set(name,records);
 }
 const table=name=>tables.get(name)||[],snapshot={Binary:true,Hostname:table('system').map(m=>s(m,12)).find(Boolean)||'Unknown',Interfaces:[],Bridges:[],BridgePorts:[],Vlans:[],Unsupported:[]};
 for(const m of table('net/devices')){const settings=m.get(0x28010008)||new Map(),type=n(m,0x010001),name=s(m,0x010006),key=String(n(m,0xfe0001));
  if(type===1)snapshot.Interfaces.push({Key:key,Name:name,DefaultName:name,Disabled:b(settings,0xfe000a),Comment:s(m,0xfe0009)});
  else if(type===12)snapshot.Bridges.push({Key:key,Name:name,Filtering:null});
  else if(![30,76].includes(type))snapshot.Unsupported.push('Unsupported RouterOS binary interface type '+type+'. Use a RouterOS .rsc export.');
 }
 for(const m of table('bridgeports')){if(![0x08000003,0x08000004,0x08000013].every(k=>m.has(k)))throw Error('Unsupported MikroTik bridge-port schema.');const frame=n(m,0x14);if(frame>2)throw Error('Unknown MikroTik frame admission mode.');snapshot.BridgePorts.push({Interface:String(n(m,3)),Bridge:String(n(m,4)),Pvid:n(m,0x13),Frames:frame===1?'admit-only-vlan-tagged':frame===2?'admit-only-untagged-and-priority-tagged':'admit-all',Disabled:b(m,0xfe0008),TagStacking:b(m,0x1a)});}
 for(const m of table('bridge-vlans')){const range=a(m,1),ids=[];if(!range.length||range.length%2)throw Error('Unsupported MikroTik VLAN range encoding.');for(let i=0;i<range.length;i+=2){if(range[i]<1||range[i+1]>4094||range[i]>range[i+1])throw Error('Invalid MikroTik VLAN range.');for(let id=range[i];id<=range[i+1];id++)ids.push(id);}snapshot.Vlans.push({Bridge:String(n(m,2)),Ids:ids,Tagged:a(m,3).map(String),Untagged:a(m,4).map(String),Comment:s(m,0xfe0009),Disabled:b(m,0xfe0008)});}
 for(const name of wanted)if(name.startsWith('net/')&&name!=='net/devices'&&table(name).length)snapshot.Unsupported.push('Switch-chip VLAN tables require a RouterOS .rsc export for validation.');
 return snapshot;
}
export function routerosSnapshotModel(snapshot,filename='RouterOS backup'){
 const out=empty(),d=device(safe(snapshot.Hostname||snapshot.hostname||filename),{vendor:'MikroTik',kind:'switch',os:'RouterOS',fromConfig:true}),interfaces=snapshot.Interfaces||[],bridges=new Map((snapshot.Bridges||[]).map(v=>[String(v.Key),v])),byKey=new Map();
 const unsupported=[...(snapshot.Unsupported||[])];
 if(snapshot.Model)Object.assign(d,identify(snapshot.Model));
 const names=new Set();for(const row of interfaces){if(!row.Name||names.has(row.Name.toLowerCase())||byKey.has(String(row.Key)))throw Error('Duplicate or missing MikroTik interface identity.');names.add(row.Name.toLowerCase());const p=ensurePort(d,safe(row.Name));Object.assign(p,{description:safe(row.Comment),admin:row.Disabled?'down':'up',state:'unknown',media:row.DefaultName?.startsWith('ether')?'RJ-45':row.DefaultName?.startsWith('qsfp')?'QSFP+':'SFP+',nativeState:'unknown',notes:[]});byKey.set(String(row.Key),p);}
 for(const row of snapshot.BridgePorts||[]){const p=byKey.get(String(row.Interface)),bridge=bridges.get(String(row.Bridge));if(!p||!bridge){unsupported.push('Unresolved RouterOS bridge-port reference.');continue;}if(row.Pvid<1||row.Pvid>4094){unsupported.push('Invalid RouterOS PVID.');continue;}p.ingressPvid=row.Pvid;p.bridge=bridge.Name;p.bridgeMembershipDisabled=!!row.Disabled;p.notes.push('Configured ingress PVID: '+row.Pvid,'Bridge: '+safe(bridge.Name));if(row.TagStacking)unsupported.push('RouterOS tag-stacking cannot be represented by one native VLAN fill.');}
 for(const row of snapshot.Vlans||[]){if(row.Disabled)continue;const bridge=bridges.get(String(row.Bridge));if(!bridge){unsupported.push('Unresolved RouterOS VLAN bridge.');continue;}for(const id of row.Ids||[])ensureVlan(d,id).name=safe(row.Comment);if(bridge.Filtering===false)continue;
  for(const [kind,ids] of [['tagged',row.Tagged||[]],['native',row.Untagged||[]]])for(const key of ids){if(bridges.has(String(key)))continue;const p=byKey.get(String(key));if(!p){unsupported.push('Unresolved RouterOS interface reference: '+safe(key));continue;}if(!(snapshot.BridgePorts||[]).some(v=>String(v.Interface)===String(key)&&String(v.Bridge)===String(row.Bridge)))unsupported.push('RouterOS VLAN member is not assigned to its bridge: '+p.name);for(const vlan of row.Ids||[]){if(kind==='tagged')p.tagged=[...new Set([...(p.tagged||[]),vlan])];else{if(p.native!=null&&p.native!==vlan)unsupported.push('Multiple untagged RouterOS VLANs on '+p.name);p.native=vlan;p.nativeState='known';}}}
 }
 for(const p of d.ports){if(p.native!=null&&p.tagged?.includes(p.native))unsupported.push('RouterOS VLAN is both tagged and untagged on '+p.name);p.role=p.tagged?.length?'trunk':p.native!=null?'access':'unknown';if(p.native!=null&&p.ingressPvid!=null&&p.native!==p.ingressPvid)unsupported.push('RouterOS ingress PVID and untagged egress VLAN differ on '+p.name);}
 const note='Binary import retains static VLAN-table assignments and configured ingress PVID separately. Dynamic membership, bridge-filtering state, firmware and exact model are not inferred.';
 d.routerosSnapshot=snapshot;d.reportBlockers=[...new Set(unsupported)];d.reportAssumptions=[note];out.devices.push(d);out.warnings.push(...d.reportBlockers.map(v=>filename+': '+v),filename+': '+note);return out;
}
