// OPC parts use ZIP's stored method. No native executable, compression worker or network call.
const encoder=new TextEncoder();
const crcTable=Uint32Array.from({length:256},(_,n)=>{
  for(let i=0;i<8;i++)n=(n&1)?0xEDB88320^(n>>>1):n>>>1;
  return n>>>0;
});
function crc(bytes){let v=-1;for(const c of bytes)v=crcTable[(v^c)&255]^(v>>>8);return (v^-1)>>>0;}
function header(length,fields){
  const b=new Uint8Array(length),d=new DataView(b.buffer);
  for(const [pos,bits,v] of fields)if(bits===4)d.setUint32(pos,v,true);else d.setUint16(pos,v,true);
  return b;
}
export function zip(parts,mime){
  const entries=Object.entries(parts);if(entries.length>65535)throw Error('Too many parts for standard ZIP.');
  let cursor=0,cdSize=0;const local=[],directory=[];
  for(const [path,body] of entries){
    const name=encoder.encode(path),data=typeof body==='string'?encoder.encode(body):body,size=data.byteLength,sum=crc(data);
    if(cursor+size>0xFFFFFF00)throw Error('Drawing exceeds the standard ZIP file limit.');
    const entry=header(30,[[0,4,0x04034b50],[4,2,20],[6,2,0x800],[12,2,33],[14,4,sum],[18,4,size],[22,4,size],[26,2,name.length]]);
    const cen=header(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x800],[14,2,33],[16,4,sum],[20,4,size],[24,4,size],[28,2,name.length],[42,4,cursor]]);
    local.push(entry,name,data);directory.push(cen,name);cursor+=entry.length+name.length+size;cdSize+=cen.length+name.length;
  }
  return new Blob([...local,...directory,header(22,[[0,4,0x06054b50],[8,2,entries.length],[10,2,entries.length],[12,4,cdSize],[16,4,cursor]])],{type:mime});
}
