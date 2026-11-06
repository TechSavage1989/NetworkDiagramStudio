const code = x => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
export function modelKey(vendor, model) {
  return code(model) ? code(vendor)+'/'+code(model) : '';
}
export function matchesHardware(shape,device) {
  if(shape.view==='rear')return false;
  if(shape.models?.includes(modelKey(device.vendor,device.model)))return true;
  const tokens=String(shape.name||'').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const candidates=new Set();
  for(let i=0;i<tokens.length;i++){
    let key='';for(let j=i;j<Math.min(i+6,tokens.length);j++){key+=tokens[j];candidates.add(key);}
  }
  for(const model of [device.sku,device.model]){
    const key=code(model);
    if(key.length>=4 && /\d/.test(key) && candidates.has(key))return true;
  }
  // Fortinet combination masters use e.g. FG-120/121G for both chassis.
  const pair=/\b(?:FGT?|FortiGate)[- ]*(\d+)([A-Z]?)\/(\d+)([A-Z])\b/i.exec(shape.name);
  const model=/^(?:FORTIGATE|FGT?)(\d+[A-Z])$/.exec(code(device.model));
  return Boolean(pair && model && [pair[1]+(pair[2]||pair[4]),pair[3]+pair[4]].includes(model[1]));
}
