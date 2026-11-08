const rows=value=>Array.isArray(value)?value:[];
export function reportText(value,limit=20000){
 const text=String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,'').trim();
 if(text.length>limit)throw Error('A report value exceeds '+limit+' characters.');
 return /\b(password|passwd|secret|private.key|credential|token|psk|encrypted)\b/i.test(text)?'[REDACTED]':text;
}
export function cleanSwitchportSettings(raw={}){
 raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};if(new Set(rows(raw.deviceIds).map(String)).size>100)throw Error('Select up to 100 devices for one switchport report package.');
 const palette=raw.palette||{},view=raw.reportType||raw.view||'workspace';
 const logo=String(raw.logoDataUrl||'');if(logo&&(!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/i.test(logo)||logo.length>14_000_000))throw Error('Choose a PNG or JPEG report logo smaller than 10 MB.');
 return {enabled:raw.enabled===true,deviceIds:[...new Set(rows(raw.deviceIds).map(String))].slice(0,100),combined:raw.combined!==false,title:reportText(raw.title||'',400),showWorkspaceTitle:raw.showWorkspaceTitle!==false,outputLabel:reportText(raw.outputLabel||'Switchport reports',100),logoDataUrl:logo,reportType:['workspace','onePage','wall','booklet'].includes(view)?view:'workspace',palette:{vlans:{...(palette.vlans||palette.Vlans||{})},aggregates:{...(palette.aggregates||palette.Aggregates||{})}}};
}
