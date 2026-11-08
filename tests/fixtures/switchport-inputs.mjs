import {deflateRawSync} from 'node:zlib';
export const arubaConfig='; JL256A Configuration Editor\nhostname LAB-ACCESS\nvlan 10\n name Data\n untagged 1-48\n tagged 49-52\n exit\n';
const u16=value=>{const result=Buffer.alloc(2);result.writeUInt16LE(value);return result;};
const u32=value=>{const result=Buffer.alloc(4);result.writeUInt32LE(value>>>0);return result;};
export const rosString=(key,value)=>{const data=Buffer.from(value);return Buffer.concat([u32(0x20000000|key),u16(data.length),data]);};
export const rosNumber=(key,value)=>Buffer.concat([u32(0x08000000|key),u32(value)]);
export const rosBool=(key,value)=>u32(key|(value?0x01000000:0));
export const rosArray=(key,values)=>Buffer.concat([u32(0x88000000|key),u16(values.length),...values.map(u32)]);
export const rosMessage=(...fields)=>Buffer.concat([Buffer.from('M2'),...fields]);
export const rosNested=(key,message)=>Buffer.concat([u32(0x28000000|key),u16(message.length),message]);
export function routerosBackup(extra={}){
 const tables={'system':[rosMessage(rosString(12,'LAB-ROUTEROS'))],'net/devices':['ether1',...Array.from({length:8},(_,index)=>'sfp-sfpplus'+(index+1))].map((name,index)=>rosMessage(rosNumber(0x010001,1),rosNumber(0xfe0001,index+1),rosString(0x010006,name),rosNested(0x010008,rosMessage(rosBool(0xfe000a,index===0))))),'user':[Buffer.from('NEVER-IMPORT-SECRET')],...extra};
 const parts=[u32(0xb1a1ac88),u32(0)];
 for(const [name,records] of Object.entries(tables)){const key=Buffer.from(name),index=Buffer.concat(records.map((row,index)=>Buffer.concat([u32(index+1),u32(row.length+2),u32(0)]))),data=Buffer.concat(records.flatMap(row=>[u16(row.length+2),row]));parts.push(u32(key.length),key,u32(index.length),index,u32(data.length),data);}
 const result=Buffer.concat(parts);result.writeUInt32LE(result.length,4);return result;
}
export function zipFixture(entries){
 const local=[],central=[];let offset=0,total=0;
 for(const [name,value] of Object.entries(entries)){
  const raw=Buffer.from(value),packed=deflateRawSync(raw),fname=Buffer.from(name);let crc=-1;
  for(const byte of raw){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^-1)>>>0;
  const l=Buffer.alloc(30),c=Buffer.alloc(46);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(8,8);l.writeUInt32LE(crc,14);l.writeUInt32LE(packed.length,18);l.writeUInt32LE(raw.length,22);l.writeUInt16LE(fname.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(fname.length,28);c.writeUInt32LE(offset,42);
  local.push(l,fname,packed);central.push(c,fname);offset+=30+fname.length+packed.length;total+=46+fname.length;
 }
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(total,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,...central,end]);
}
const xml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
export function auvikWorkbook(tables){
 const entries={'xl/workbook.xml':'<workbook><sheets>'+tables.map((table,index)=>'<sheet name="'+xml(table.name)+'" r:id="r'+index+'"/>').join('')+'</sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships>'+tables.map((table,index)=>'<Relationship Id="r'+index+'" Target="xl/worksheets/s'+index+'.xml"/>').join('')+'</Relationships>'};
 tables.forEach((table,index)=>{entries['xl/worksheets/s'+index+'.xml']='<worksheet><sheetData>'+table.rows.map((row,rowIndex)=>'<row>'+row.map((value,column)=>'<c r="'+String.fromCharCode(65+column)+(rowIndex+1)+'" t="inlineStr"><is><t>'+xml(value)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';});return zipFixture(entries);
}
export const auvikTables=()=>[
 {name:'Devices',rows:[['Devices'],['Device Name','Make & Model','IP Address(es)'],['LAB-ACCESS','Aruba JL256A','192.0.2.1']]},
 {name:'Network Elements',rows:[['Elements'],['Device Name','Software Version'],['LAB-ACCESS','WC.16.11']]},
 {name:'Interfaces',rows:[['Interfaces'],['Parent Device','Interface Name','Admin Status','Oper Status','Negotiated Speed','Connected To','Configuration Details'],['LAB-ACCESS','1','Up','Down','1 Gbit/s','LAB-PEER / Gi1/0/1','VLAN 10'],['OTHER-SITE','1','Down','Up','10 Gbit/s','UNRELATED','private key NEVER-IMPORT-SECRET']]},
 {name:'Routes',rows:[['Routes'],['Device Name','Destination','Next Hop','Gateway Interface','Metric'],['LAB-ACCESS','0.0.0.0/0','192.0.2.254','VLAN10','1']]},
 {name:'ARP Entries',rows:[['ARP'],['Device Name','Interface','IP Address','Hardware (MAC) Address'],['LAB-ACCESS','1','192.0.2.2','02:00:00:00:00:02']]},
 {name:'Forwarding Database (FDB)',rows:[['FDB'],['Device Name','Interface','Destination MAC Address','VLAN'],['LAB-ACCESS','1','02:00:00:00:00:02','10']]}
];
