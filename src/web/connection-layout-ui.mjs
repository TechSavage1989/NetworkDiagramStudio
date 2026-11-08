import {analyzeConnections,organizeConnections} from './connection-layout.mjs';
import {LINE_SPACING,lineSpacing} from './layout.mjs';

export function connectionLayoutEditor({project,page,pages,buildPages,modal,el,button,actions,run,apply,close}){
 const body=modal('Organize connections','connection-layout-dialog'),dialog=body.closest('dialog'),before=analyzeConnections(page);
 if(!before.connections)throw Error('Open a network or wireless page with connections first.');
 const check=(label,checked)=>{const row=el('label','','organize-check'),input=el('input');input.type='checkbox';input.checked=checked;row.append(input,document.createTextNode(label));body.append(row);return input;};
 body.append(el('p','Analyze this page for shorter routes, fewer bends and crossings, consistent parallel cables, and a compact footprint. Review the proposed layout before applying it.','hint'));
 const compact=check('Compact device positions',true),manual=check('Keep manual cable bends',true),current=lineSpacing(project,page.name),even=check('Even line spacing',!!current);
 // One spacing for every parallel run on this page: no wide gaps beside tight ones.
 const spacingRow=el('label','','organize-spacing'),spacing=el('input');spacing.type='number';spacing.min=LINE_SPACING.min;spacing.max=LINE_SPACING.max;spacing.step=1;spacing.value=current||LINE_SPACING.default;spacing.setAttribute('aria-label','Spacing between lines');
 spacingRow.append(document.createTextNode('Spacing between lines '),spacing,document.createTextNode(' drawing units'));body.append(spacingRow);spacing.disabled=!even.checked;
 const spacingValue=()=>{if(!even.checked)return 0;const value=+spacing.value;if(spacing.value===''||!Number.isFinite(value)||value<LINE_SPACING.min||value>LINE_SPACING.max)throw Error('Use a line spacing of '+LINE_SPACING.min+'-'+LINE_SPACING.max+' drawing units.');return value;};
 body.append(el('p','Device sizes, port attachments and other pages are preserved. Applying a layout creates one undo step.','hint'));
 const progress=el('p','Ready to analyze '+before.connections+' connections.','organize-status');progress.setAttribute('role','status');progress.setAttribute('aria-live','polite');body.append(progress);
 const output=el('section','','organize-results');output.hidden=true;body.append(output);
 const bar=actions(body);bar.classList.add('organize-footer');
 let result=null,controller=null,running=false;
 const cancel=()=>{controller?.abort();};dialog.addEventListener('close',cancel,{once:true});
 const analyze=button(bar,'Analyze connections',async()=>{
  const chosenSpacing=spacingValue();controller=new AbortController();running=true;analyze.disabled=true;compact.disabled=manual.disabled=even.disabled=spacing.disabled=true;applyButton.disabled=true;output.hidden=true;cancelButton.textContent='Cancel analysis';
  try{
   result=await organizeConnections(project,page,{buildPages,currentPages:pages,compact:compact.checked,keepManualBends:manual.checked,spacing:chosenSpacing,signal:controller.signal,maxCandidates:before.connections>60?6:10,
    onProgress:status=>{progress.textContent=status.completed===status.total?'Analysis complete.':'Checking layout '+(status.completed+1)+' of '+status.total+'...';}});
   if(!dialog.open||controller.signal.aborted)return;
   render(result);applyButton.disabled=!result.changed||!result.metrics.valid;
  }catch(error){if(error.name==='AbortError')progress.textContent='Analysis cancelled. The drawing has not changed.';else throw error;}
  finally{running=false;analyze.disabled=false;compact.disabled=manual.disabled=even.disabled=false;spacing.disabled=!even.checked;cancelButton.textContent='Close';}
 },'primary');
 const applyButton=button(bar,'Apply layout',()=>{if(!result?.changed)return;apply(result);close();},'primary');applyButton.disabled=true;
 const cancelButton=el('button','Close');cancelButton.type='button';cancelButton.onclick=()=>{if(running)cancel();else close();};bar.append(cancelButton);
 for(const input of [compact,manual,even,spacing])input.onchange=()=>{spacing.disabled=!even.checked;result=null;applyButton.disabled=true;output.hidden=true;progress.textContent='Options changed. Analyze to preview a new layout.';};
 const number=n=>Math.round(n).toLocaleString(),percent=(next,old)=>old?(next-old)/old*100:0;
 function render(value){
  output.replaceChildren();output.hidden=false;
  progress.textContent=value.changed&&value.spacing?'Evenly spaced lines are ready to review.':value.changed?'A clear, more compact layout is ready to review.':value.metrics.valid?'The current layout is already the best clear result among the checked arrangements.':'No clear improvement fits the current objects and manual edits. Try allowing manual bends to be rerouted or increasing the available room.';
  const table=el('table','','organize-metrics'),head=el('thead'),header=el('tr');for(const label of ['Measure','Current','Proposed'])header.append(el('th',label));head.append(header);table.append(head);const rows=el('tbody');
  const metric=(label,current,next,suffix='')=>{const row=el('tr');row.append(el('th',label),el('td',number(current)+suffix),el('td',number(next)+suffix));rows.append(row);};
  metric('Connection length',value.before.length,value.metrics.length,' drawing px');metric('Bends',value.before.bends,value.metrics.bends);metric('Crossings',value.before.crossings,value.metrics.crossings);
  const footprint=el('tr'),change=percent(value.metrics.area,value.before.area);footprint.append(el('th','Drawing footprint'),el('td',number(value.before.footprint.w)+' × '+number(value.before.footprint.h)),el('td',number(value.metrics.footprint.w)+' × '+number(value.metrics.footprint.h)+(Math.abs(change)>=.1?' ('+(change>0?'+':'')+change.toFixed(1)+'%)':'')));rows.append(footprint);table.append(rows);output.append(table);
  const tabs=el('div','','organize-preview-tabs'),preview=el('div','','organize-preview');preview.setAttribute('aria-label','Connection layout preview');output.append(tabs,preview);
  const choose=(source,selected)=>{preview.innerHTML=source.svg;for(const b of tabs.children)b.setAttribute('aria-pressed',String(b===selected));};
  const old=el('button','Current'),next=el('button','Proposed');old.type=next.type='button';old.onclick=()=>choose(page,old);next.onclick=()=>choose(value.page,next);tabs.append(old,next);choose(value.changed?value.page:page,value.changed?next:old);
  output.append(el('p',!value.metrics.valid?'No valid proposal was accepted. The current drawing is unchanged.':value.manualBends&&value.keepManualBends?value.manualBends+' manual cable route'+(value.manualBends===1?' was':'s were')+' retained.':'All proposed routes passed port attachment, equipment, text and cable clearance checks.','hint'));
 }
 return {cancel};
}
