import {buildReportPackage,reportRequest} from './reports/index.mjs';
import {supplementaryCsv} from './reports/supplementary.mjs';
import {reportFileStem,reportPageLabel} from './reports/paper.mjs';

const safe=value=>String(value||'Report').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').trim().slice(0,100)||'Report';
const json=value=>JSON.stringify(value,null,2);
const sha256=async value=>{
 const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
};
// Build each file independently so a capacity or encoding failure cannot discard
// another device's complete package. The manifest records the actual outcomes.
export async function browserReportPackage(project,{png,pdf,progress=()=>{}}){
 const request=reportRequest(project),report=buildReportPackage(project),parts={},used=new Set(),items=[],paperStem=reportFileStem(request.paper);
 for(const [index,item] of report.items.entries()){
  const stem=safe(item.folder||item.name);let directory=stem;for(let suffix=2;used.has(directory.toLowerCase());suffix++)directory=stem+'-'+suffix;used.add(directory.toLowerCase());
  const base=directory+'/',errors=[],written=[];
  const put=(name,value)=>{parts[base+name]=value;written.push(name);};
  put('port-map.csv',item.csv);put('inventory.json',item.inventoryJson||json(item.inventory));put('technician-summary.txt',item.summary);
  if(item.supplementary?.length){put('supplementary-data.json',json(item.supplementary));put('supplementary-data.csv',supplementaryCsv(item.supplementary));}
  const attempt=async(name,render)=>{try{put(name,await render());}catch(error){errors.push(name+': '+error.message);}};
  progress('Exporting '+(index+1)+' of '+report.items.length+': '+item.name);
  if(item.pages.wall.length)await attempt('wall-chart.png',()=>png(item.pages.wall[0]));
  if(item.pages.onePage.length){await attempt(paperStem+'-one-page.png',()=>png(item.pages.onePage[0]));await attempt(paperStem+'-one-page.pdf',()=>pdf(item.pages.onePage,{title:item.name}));}
  if(item.pages.booklet.length)await attempt(paperStem+'-booklet.pdf',()=>pdf(item.pages.booklet,{title:item.name}));
  if(item.capacityError)errors.push(item.capacityError);
  errors.push(...item.validation.errors);
  const complete=item.filenames.filter(name=>name!=='validation-report.txt').every(name=>written.includes(name));
  if(!complete&&!errors.length)errors.push('One or more visual outputs could not fit at a readable size.');
  const hashes=await Promise.all(written.map(async name=>name+' SHA-256 '+await sha256(parts[base+name])));
  put('validation-report.txt',item.validationText+'\nInventory SHA-256 '+await sha256(parts[base+'inventory.json'])+'\n'+hashes.join('\n')+'\n'+errors.map(error=>'EXPORT BLOCKER: '+error).join('\n')+'\n');
  items.push({id:item.id,name:item.name,directory,success:complete&&!errors.length,files:written,errors});
 }
 const shared=report.combined,combinedErrors=[];
 const combinedAttempt=async(name,render)=>{try{parts[name]=await render();}catch(error){combinedErrors.push(name+': '+error.message);}};
 if(shared.pages.length){
  await combinedAttempt('workspace-'+paperStem+'-diagrams.pdf',()=>pdf(shared.pages,{title:request.title||project.name}));
  for(const [index,page] of shared.pages.entries())await combinedAttempt('workspace-sheet-'+String(index+1).padStart(3,'0')+'.png',()=>png(page));
  if(shared.booklet.length)await combinedAttempt('workspace-'+paperStem+'-booklets.pdf',()=>pdf(shared.booklet,{title:request.title||project.name}));
  parts['workspace-layout.json']=json(shared.pages.map(page=>({name:page.name,width:page.width,height:page.height,deviceIds:page.sourceDeviceIds,role:page.role})));
  parts['workspace-palette.json']=json(request.palette);
 }
 if(request.combined)parts['workspace-validation-report.txt']=shared.validationText+combinedErrors.map(error=>'EXPORT BLOCKER: '+error).join('\n')+'\n';
 const summary=report.summary+'\nEXPORT RESULTS\n'+items.map(item=>item.name+': '+(item.success?'complete':item.errors.join(' '))).join('\n')+'\n'+combinedErrors.join('\n');
 parts['workspace-summary.txt']=summary;
 const manifest={format:'NetworkDiagramStudio.SwitchportReports',sourceVersion:'1.18.5',outputLabel:request.outputLabel,paper:request.paper,paperDescription:reportPageLabel(request.paper),items,combinedErrors};
 parts['workspace-export.json']=json(manifest);
 return {parts,summary,items,combinedErrors,success:items.some(item=>item.success),complete:items.every(item=>item.success)&&!combinedErrors.length};
}
