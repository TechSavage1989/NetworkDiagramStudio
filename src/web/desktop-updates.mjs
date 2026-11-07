export function updatePresentation(state={}){
 const phase=state.checking?'checking':state.fetching?(state.progress>=100?'verifying':'downloading'):state.downloaded?'ready':state.available?'available':state.message?.startsWith('Could not')?'error':state.message?'current':'idle';
 const titles={idle:'Application updates',checking:'Checking for updates',current:'Update status',error:'Unable to check for updates',available:'A new version is available',downloading:'Downloading update',verifying:'Verifying download',ready:'Ready to install'};
 return {phase,title:titles[phase],active:phase==='checking'||phase==='downloading'||phase==='verifying',progress:Math.max(0,Math.min(100,Number(state.progress)||0))};
}
const element=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function desktopUpdates({help,modal}){
 const api=window.NDSDesktop;if(!api?.checkUpdates)return;
 help.hidden=false;const banner=element('div','','update-banner');banner.id='desktop-update-banner';banner.hidden=true;
 const bannerCopy=element('div'),bannerTitle=element('strong'),bannerDetail=element('span'),review=element('button','Review update');review.type='button';bannerCopy.append(bannerTitle,bannerDetail);banner.append(bannerCopy,review);document.querySelector('.stage').prepend(banner);
 let panel=null;
 function action(parent,text,call,id){const b=element('button',text);b.type='button';if(id)b.id=id;b.onclick=call;parent.append(b);return b;}
 function open(){
  const body=modal('Help and updates');body.classList.add('update-panel');
  const intro=element('div','','update-intro'),icon=element('img');icon.src=document.querySelector('.brand img')?.src||document.querySelector('link[rel="icon"]')?.href||'';icon.alt='';intro.append(icon);const copy=element('div'),eyebrow=element('div','NETWORKDIAGRAMSTUDIO','eyebrow'),title=element('h2'),status=element('p','','hint');status.id='desktop-update-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');copy.append(eyebrow,title,status);intro.append(copy);body.append(intro);
  const versions=element('div','','update-versions'),installed=element('div'),offered=element('div');versions.append(installed,offered);body.append(versions);
  const progressBox=element('div','','update-progress'),progressLabel=element('div'),progress=element('progress');progress.max=100;progress.setAttribute('aria-label','Update download progress');progressBox.append(progressLabel,progress);body.append(progressBox);
  const notes=element('section','','update-notes'),notesTitle=element('h3','What is changing'),notesText=element('div');notesText.style.whiteSpace='pre-wrap';notes.append(notesTitle,notesText);body.append(notes);
  const reminder=element('p','','update-reminder');body.append(reminder);
  const actions=element('div','','actions update-actions');body.append(actions);const check=action(actions,'Check updates',()=>api.checkUpdates(),'desktop-check-updates'),download=action(actions,'Download update',()=>api.downloadUpdate?.(),'desktop-download-update'),install=action(actions,'Install and restart',()=>api.installUpdate?.(),'desktop-install-update');download.classList.add('primary');install.classList.add('primary');
  const support=element('div','','update-support');body.append(support);action(support,'Update details',()=>api.updateDetails());action(support,'Notices',()=>api.notices());
  panel={body,title,status,installed,offered,progressBox,progressLabel,progress,notes,notesText,reminder,check,download,install};refresh();
 }
 function refresh(){
  const state=api.updateState||{},view=updatePresentation(state);banner.hidden=!state.available;
  bannerTitle.textContent=view.phase==='ready'?'Update ready to install':'Update available';bannerDetail.textContent=state.releaseVersion?state.releaseVersion.replace(/^v/,''):'';review.textContent=state.fetching?'View progress':state.downloaded?'Review and restart':'Review update';
  if(!panel?.body.isConnected||!panel.body.contains(panel.title))return;
  const p=panel;p.body.dataset.phase=view.phase;p.title.textContent=view.title;p.status.textContent=state.message||'Check for the latest published release.';
  p.installed.replaceChildren(element('span','INSTALLED'),element('strong',state.version||'Version unavailable'));p.offered.hidden=!state.available;p.offered.replaceChildren(element('span','AVAILABLE'),element('strong',(state.releaseVersion||'').replace(/^v/,'')));
  p.progressBox.hidden=!state.fetching;p.progressLabel.textContent=view.phase==='verifying'?'Checking file integrity':view.progress+'% downloaded';p.progress.value=view.progress;
  p.notes.hidden=!state.available;p.notesText.textContent=state.notes?.trim()||'No release notes were provided.';
  p.reminder.textContent=state.downloaded?'Save your project before restarting. The downloaded file has passed verification.':state.fetching?'You can keep working while the update downloads.':state.available?'Download size: '+(Number(state.size)/1048576).toFixed(1)+' MB. Downloading will not restart the app.':'Updates are checked automatically. Installation requires your confirmation.';
  p.check.disabled=view.active;p.check.textContent=state.checking?'Checking...':'Check updates';p.download.hidden=!state.available||!!state.downloaded;p.download.disabled=view.active||!api.downloadUpdate;p.install.hidden=!state.downloaded;p.install.disabled=view.active||!!state.busy||!api.installUpdate;
 }
 help.onclick=open;review.onclick=open;window.addEventListener('nds-update-state',refresh);refresh();return {refresh};
}
