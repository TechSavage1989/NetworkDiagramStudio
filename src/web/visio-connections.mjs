const children=(e,tag)=>Array.from(e?.children||[]).filter(n=>n.localName===tag);
const cells=e=>Object.fromEntries(children(e,'Cell').map(c=>[c.getAttribute('N'),c.getAttribute('V')]));
const meaningful=name=>name&&!/^(?:Row_?\d+|Connections?\.?\d+)$/i.test(name);

// Keep local coordinates until the artwork's complete group transform is known.
// A Visio connection row does not need a port name or a nonzero shape Height.
export function connectionRows(shape,name=''){
 const sections=children(shape,'Section'),rows=n=>sections.filter(s=>s.getAttribute('N')===n&&s.getAttribute('Del')!=='1').flatMap(s=>children(s,'Row'));
 const ports=rows('Connection').filter(r=>r.getAttribute('Del')!=='1'),controls=rows('Control').filter(r=>r.getAttribute('Del')!=='1');
 return ports.map((row,index)=>{
  const i=Number(row.getAttribute('IX')??index),r=cells(row),raw=row.getAttribute('N')||row.getAttribute('NameU')||'',prompt=(r.Prompt||cells(controls.find(c=>c.getAttribute('N')==='Row_'+(i+1))).Prompt||'').trim();
  const x=r.X==null||r.X.trim()===''?NaN:Number(r.X),y=r.Y==null||r.Y.trim()===''?NaN:Number(r.Y);
  if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('A stencil connection point has no usable cached coordinates. Resave this master with Visio before importing it.');
  let key=meaningful(raw)?raw:prompt||raw||'Connection '+(i+1);
  if(/JL675A/i.test(name)&&ports.length>=60){
   if(i>=12&&i<60)key='1/1/'+(i-11);
   else if([1,4,7,10].includes(i))key='1/1/'+(49+(i-1)/3);
  }else if(/10GE SFP(?:\+| Plus) Slot/i.test(prompt)&&/#\d+/.test(prompt))key='x'+prompt.match(/#(\d+)/)[1];
  else if(/Gigabit Ethernet Port|SFP Slot/i.test(prompt)&&/#\d+/.test(prompt))key='port'+prompt.match(/#(\d+)/)[1];
  else if(/^(HA Port|Management Port|Console Port|USB)#/i.test(prompt))key=({'ha port':'ha','management port':'mgmt','console port':'console','usb':'usb'})[prompt.split('#')[0].toLowerCase()];
  else if(ports.length===1&&/SFP|transceiver|module|DAC/i.test(name)&&!meaningful(raw)&&!prompt)key='cable';
  key=key.trim().slice(0,240)||'Connection '+(index+1);if(['__proto__','constructor','prototype'].includes(key))key='Connection '+(i+1)+' ('+key+')';
  return {key,x,y};
 });
}
