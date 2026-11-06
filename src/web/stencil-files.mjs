export const visioExtensions=['vss','vssx','vssm','vsx','vst','vstx','vstm','vtx','vsd','vsdx','vsdm','vdx'];
export const visioFile=name=>visioExtensions.includes(String(name).split('.').pop().toLowerCase());
export const binaryVisio=name=>/\.(vss|vst|vsd)$/i.test(name);
export const xmlVisio=name=>/\.(vsx|vtx|vdx)$/i.test(name);
export const filePath=file=>file.webkitRelativePath||file.relativePath||file.name;
export function stencilFiles(files){return Array.from(files).filter(f=>visioFile(f.name)).sort((a,b)=>filePath(a).localeCompare(filePath(b),'en',{numeric:true}));}
export async function droppedFiles(items,fallback=[]){
 const entries=Array.from(items||[]).filter(i=>i.kind==='file').map(i=>i.webkitGetAsEntry?.()).filter(Boolean);
 if(!entries.length)return Array.from(fallback);
 const files=[];
 async function walk(entry,path=''){
  if(entry.isFile){const file=await new Promise((yes,no)=>entry.file(yes,no));Object.defineProperty(file,'relativePath',{value:path+file.name});files.push(file);return;}
  if(entry.isDirectory){
   const reader=entry.createReader();
   // Chromium returns directory entries in batches, commonly 100 at a time.
   for(;;){const batch=await new Promise((yes,no)=>reader.readEntries(yes,no));if(!batch.length)break;for(const child of batch)await walk(child,path+entry.name+'/');}
  }
 }
 for(const entry of entries)await walk(entry);
 return files;
}
