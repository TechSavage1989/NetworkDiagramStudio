export function updatePresentation(state={}){
 const phase=state.checking?'checking':state.fetching?(state.progress>=100?'verifying':'downloading'):state.downloaded?'ready':state.available?'available':state.message?.startsWith('Could not')?'error':state.message?'current':'idle';
 const version=(state.releaseVersion||'').replace(/^v/,'');
 const titles={idle:'Application updates',checking:'Checking for updates',current:'Application updates',error:'Unable to check for updates',available:'Update NetworkDiagramStudio',downloading:'Downloading your update',verifying:'Verifying your update',ready:version?'Install NetworkDiagramStudio '+version+'?':'Install NetworkDiagramStudio?'};
 const subtitles={idle:'Keep your diagram tools up to date.',checking:'Looking for the latest published release.',current:'Your installed version and update status.',error:'Review the result below, then try again.',available:'See what is new before downloading.',downloading:'You can keep working while the download finishes.',verifying:'Checking the downloaded file before installation.',ready:'Review the update before restarting.'};
 return {phase,title:titles[phase],subtitle:subtitles[phase],active:phase==='checking'||phase==='downloading'||phase==='verifying',progress:Math.max(0,Math.min(100,Number(state.progress)||0))};
}
// Release content is untrusted. These blocks and inline spans are always rendered as text, never HTML.
export function releaseNotesBlocks(notes=''){
 const blocks=[];let current=null;
 for(const raw of String(notes).replace(/\r/g,'').split('\n')){
  const line=raw.trim();if(!line){current=null;continue;}
  if(/^#\s+NetworkDiagramStudio\b/i.test(line)){current=null;continue;}
  const heading=line.match(/^#{1,6}\s+(.+)$/),bullet=line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
  if(heading){blocks.push({type:'heading',text:heading[1].replace(/\s+#+$/,'')});current=null;}
  else if(bullet){current={type:'item',text:bullet[1]};blocks.push(current);}
  else if(current){current.text+=' '+line;}
  else{current={type:'paragraph',text:line};blocks.push(current);}
 }
 return blocks;
}
const element=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
function inlineText(parent,text){
 const pattern=/(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;let start=0;
 for(const m of text.matchAll(pattern)){parent.append(document.createTextNode(text.slice(start,m.index)));parent.append(m[2]?element('strong',m[2]):m[3]?element('code',m[3]):document.createTextNode(m[4]+' ('+m[5]+')'));start=m.index+m[0].length;}
 parent.append(document.createTextNode(text.slice(start)));
}
function renderNotes(parent,text){
 parent.replaceChildren();let list=null;
 for(const block of releaseNotesBlocks(text)){
  if(block.type==='item'){if(!list){list=element('ul');parent.append(list);}const item=element('li');inlineText(item,block.text);list.append(item);}
  else{list=null;const node=element(block.type==='heading'?'h3':'p');inlineText(node,block.text);parent.append(node);}
 }
 if(!parent.childNodes.length)parent.append(element('p','No release notes were provided.'));
}
function icon(kind){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',kind==='restart'?'M16.5 6.5A7 7 0 1 0 17 12M16.5 2.5v4h-4':kind==='download'?'M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4':'m5 10 3 3 7-7');p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.6');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');svg.append(p);return svg;
}
export function desktopUpdates({help,modal}){
 const api=window.NDSDesktop;if(!api?.checkUpdates)return;
 help.hidden=false;const banner=element('div','','update-banner');banner.id='desktop-update-banner';banner.hidden=true;
 const bannerCopy=element('div'),bannerTitle=element('strong'),bannerDetail=element('span'),review=element('button','Review update');review.type='button';bannerCopy.append(bannerTitle,bannerDetail);banner.append(bannerCopy,review);document.querySelector('.stage').prepend(banner);
 let panel=null;
 function action(parent,text,call,id){const b=element('button',text);b.type='button';if(id)b.id=id;b.onclick=call;parent.append(b);return b;}
 function open(){
  const body=modal('Application updates','update-dialog');body.classList.add('update-panel');
  const heading=document.getElementById('dialog-title'),subtitle=element('p','','update-subtitle'),content=element('div','','update-content');body.append(subtitle,content);
  const notes=element('section','','update-notes'),notesHead=element('div','','update-notes-head'),notesTitle=element('h2','What’s new'),versions=element('div','','update-versions'),installed=element('span','','update-version'),to=element('span','to','update-version-to'),offered=element('span','','update-version update-version-new');installed.setAttribute('aria-label','Installed version');offered.setAttribute('aria-label','Available version');versions.append(installed,to,offered);notesHead.append(notesTitle,versions);const notesText=element('div','','update-release-notes');notes.append(notesHead,notesText);content.append(notes);
  const statusBox=element('div','','update-state'),status=element('p');status.id='desktop-update-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const progressBox=element('div','','update-progress'),progressLabel=element('div'),progress=element('progress');progress.max=100;progress.setAttribute('aria-label','Update download progress');progressBox.append(progressLabel,progress);statusBox.append(status,progressBox);content.append(statusBox);
  const promises=element('ul','','update-assurances');for(const text of ['The app closes, installs the verified update, and reopens.','Saved project files and application preferences stay in place.','The previous app version is kept for recovery.']){const row=element('li'),mark=element('span','','update-check');mark.append(icon('check'));row.append(mark,document.createTextNode(text));promises.append(row);}content.append(promises);
  const reminder=element('p','','update-reminder');content.append(reminder);
  const support=element('div','','update-support');content.append(support);action(support,'Update details',()=>api.updateDetails());action(support,'Notices',()=>api.notices());
  const footer=element('div','','update-footer'),actions=element('div','','update-actions');body.append(footer);const check=action(footer,'Check updates',()=>api.checkUpdates(),'desktop-check-updates');check.className='update-check-action';footer.append(actions);
  const cancel=action(actions,'Cancel',()=>document.getElementById('close').click(),'desktop-update-cancel'),download=action(actions,'Download update',()=>api.downloadUpdate?.(),'desktop-download-update'),install=action(actions,'Install and restart',()=>api.installUpdate?.(),'desktop-install-update');download.prepend(icon('download'));install.prepend(icon('restart'));download.classList.add('primary');install.classList.add('primary');
  panel={body,heading,subtitle,content,statusBox,status,installed,to,offered,progressBox,progressLabel,progress,notes,notesTitle,notesText,promises,reminder,check,download,install,cancel,lastNotes:null};refresh();
 }
 function refresh(){
  const state=api.updateState||{},view=updatePresentation(state);banner.hidden=!state.available;
  bannerTitle.textContent=view.phase==='ready'?'Update ready to install':'Update available';bannerDetail.textContent=state.releaseVersion?state.releaseVersion.replace(/^v/,''):'';review.textContent=state.fetching?'View progress':state.downloaded?'Review and restart':'Review update';
  if(!panel?.body.isConnected||!panel.body.contains(panel.content))return;
  const p=panel;p.body.dataset.phase=view.phase;p.heading.textContent=view.title;p.subtitle.textContent=view.subtitle;p.status.textContent=state.message||'Check for the latest published release.';
  p.installed.textContent=state.version||'Version unavailable';p.installed.title='Installed version';p.to.hidden=p.offered.hidden=!state.available;p.offered.textContent=(state.releaseVersion||'').replace(/^v/,'');p.offered.title='Available version';p.notesTitle.textContent=state.available?'What’s new':'Installed version';
  p.progressBox.hidden=!state.fetching;p.progressLabel.textContent=view.phase==='verifying'?'Checking file integrity':view.progress+'% downloaded';p.progress.value=view.progress;
  p.notesText.hidden=!state.available;const notes=state.notes?.trim()||'';if(notes!==p.lastNotes){renderNotes(p.notesText,notes);p.lastNotes=notes;}
  const routineStatus=/^(Installed |Verified and ready|Downloading |Verifying download)/.test(state.message||'');
  p.statusBox.hidden=!!state.available&&!view.active&&(!state.message||routineStatus);
  p.promises.hidden=!state.downloaded;p.reminder.classList.toggle('update-reminder-save',!!state.downloaded);
  p.reminder.textContent=state.downloaded?(state.busy?'Finish the current import or export, then save your project before restarting.':'Save your project before restarting. Unsaved diagram changes are not restored.'):state.fetching?'The download is verified before installation. Closing this window lets you continue working.':state.available?'Download size: '+(Number(state.size)/1048576).toFixed(1)+' MB. Downloading will not restart the app.':'Updates are checked automatically. You choose when to download and install.';
  p.check.disabled=view.active;p.check.textContent=state.checking?'Checking...':'Check updates';p.download.hidden=!state.available||!!state.downloaded;p.download.disabled=view.active||!api.downloadUpdate;p.install.hidden=!state.downloaded;p.install.disabled=view.active||!!state.busy||!api.installUpdate;p.cancel.textContent=view.active?'Keep working':state.available?'Cancel':'Close';
 }
 help.onclick=open;review.onclick=open;window.addEventListener('nds-update-state',refresh);refresh();return {refresh};
}
