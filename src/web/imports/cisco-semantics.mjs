import {ensurePort,ensureVlan,portName} from './model.mjs';

// Banner/certificate payloads are not configuration evidence. Never let text
// inside them create interfaces, hardware identities, VLANs or retained notes.
export function ciscoEvidenceText(text){
 let delimiter='',certificate=false;const output=[];
 for(const raw of text.split('\n')){const line=raw.trim();
  if(certificate){if(/^quit$/i.test(line))certificate=false;continue;}
  if(delimiter){if(line.includes(delimiter))delimiter='';continue;}
  if(/^crypto pki certificate chain\b/i.test(line)){certificate=true;continue;}
  const banner=/^banner\s+\S+\s+(\^.|.)(.*)$/i.exec(line);
  if(banner){delimiter=banner[2].includes(banner[1])?'':banner[1];continue;}
  output.push(raw);
 }
 return output.join('\n');
}
const channelKey=name=>String(name).replace(/^(?:port-channel|po)/i,'Po').toLowerCase();
const sorted=set=>[...set].sort((a,b)=>a-b);
export function applyCiscoSemantics(device,text,rangeNames){
 const states=new Map(),channels=new Map();let current=[];
 const blockers=device.reportBlockers||=[],assumptions=device.reportAssumptions||=[];
 const block=message=>{if(!blockers.includes(message))blockers.push(message);};
 const note=(port,message)=>{const notes=port.notes||=[];if(!notes.includes(message))notes.push(message);};
 const stateFor=name=>{const key=channelKey(portName(name)),map=/^(?:port-channel|po)\d+$/i.test(name)?channels:states;
  if(!map.has(key))map.set(key,{port:ensurePort(device,name),mode:'',routed:false,allowed:new Set(),all:true,allowedSet:false});return map.get(key);};
 const ids=value=>{const values=new Set();for(const token of value.split(',')){
  const match=/^(\d+)(?:\s*-\s*(\d+))?$/.exec(token.trim()),first=Number(match?.[1]),last=Number(match?.[2]??first);
  if(!match||first<1||last>4094||last<first){block('Unrecognized or out-of-range Cisco VLAN list.');return null;}
  for(let id=first;id<=last;id++)values.add(id);
 }return values;};
 const tagNative=/^vlan dot1q tag native\s*$/im.test(text);
 for(const raw of text.split('\n')){const line=raw.trim();let match;
  if(!line||line.startsWith('!')){current=[];continue;}
  if(/\b(?:password|passwd|secret|community|private-key|credential|token|cipher|certificate|key-string)\b/i.test(line))continue;
  if(!/^\s/.test(raw))current=[];
  if((match=/^interface\s+(?:range\s+)?(.+)$/i.exec(line))){
   const spec=match[1];if(/^(?:vlan|loopback|tunnel|null|nvi|appgigabit|bluetooth|gi(?:gabitEthernet)?0\/0|fa(?:stEthernet)?0$)/i.test(spec))continue;
   const names=rangeNames(spec);if(!names.length)block('Unsupported Cisco interface range.');
   for(const name of names){if(/[:.]/.test(name)){block('Unsupported Cisco breakout or subinterface configuration on '+name+'.');continue;}current.push(stateFor(name));}
   continue;
  }
  for(const state of current){const port=state.port;
   if((match=/^channel-group\s+(\d+)\s+mode\s+(active|passive|on|auto|desirable)$/i.exec(line))){
    const id='Po'+match[1];if(state.aggregate&&state.aggregate!==id)block('Cisco port belongs to more than one port channel: '+port.name+'.');state.aggregate=id;state.channelMode=match[2].toLowerCase();continue;
   }
   if(/^no switchport$/i.test(line)){state.routed=true;continue;}
   if(/^switchport$/i.test(line)){state.routed=false;continue;}
   if(/^switchport trunk encapsulation dot1q$/i.test(line))continue;
   if((match=/^switchport mode (access|trunk|dynamic auto|dynamic desirable)$/i.exec(line))){state.mode=match[1].toLowerCase();state.routed=false;continue;}
   if((match=/^switchport (access|trunk native|voice) vlan (\d+)$/i.exec(line))){const values=ids(match[2]);if(!values)continue;const id=Number(match[2]);ensureVlan(device,id);state[match[1].toLowerCase()==='access'?'access':match[1].toLowerCase()==='voice'?'voice':'native']=id;if(match[1].toLowerCase()==='voice')ensureVlan(device,id).voice=true;continue;}
   if((match=/^switchport trunk allowed vlan\s+(?:(add|remove|except)\s+)?(.+)$/i.exec(line))){
    const operation=(match[1]||'').toLowerCase(),value=match[2].toLowerCase(),all=value==='all',none=value==='none';
    if(operation&&(all||none)){block('Unsupported Cisco allowed-VLAN operation with all/none on '+port.name+'.');continue;}
    const values=all||none?new Set():ids(value);if(!values)continue;
    if(operation==='except'){state.all=true;state.allowed=values;}
    else if(operation==='remove'||operation==='add'){for(const id of values){if((operation==='remove')===state.all)state.allowed.add(id);else state.allowed.delete(id);}}
    else{state.all=all;state.allowed=values;}
    if(!['remove','except'].includes(operation))for(const id of values)ensureVlan(device,id);
    state.allowedSet=true;continue;
   }
   if(/^(?:no )?switchport (?:access|trunk (?:allowed|native|encapsulation)|voice|mode|private-vlan)|^channel-group\b|^encapsulation\b/i.test(line))block('Unsupported Cisco VLAN, aggregation or encapsulation command on '+port.name+'.');
  }
 }
 for(const state of [...states.values(),...channels.values()]){if(state.mode==='trunk')ensureVlan(device,state.native??1);if(state.mode==='access')ensureVlan(device,state.access??1);}
 function finish(state){const port=state.port;port.configurationResolved=true;
  for(const field of ['native','nativeTagged','allowed','allowedExcept','voice','taggedVlanPolicy'])delete port[field];port.nativeState='Unknown';port.tagged=[];port.role='';
  if(state.routed){port.role='routed';port.nativeState='None';return;}
  if(state.mode==='trunk'){
   port.role='trunk';const native=state.native??1,allowed=id=>state.all?!state.allowed.has(id):state.allowed.has(id);
   if(!tagNative&&allowed(native)){port.native=native;port.nativeState='Known';}else port.nativeState='None';
   port.tagged=(state.all?device.vlans.map(v=>v.id).filter(allowed):sorted(state.allowed)).filter(id=>tagNative||id!==native).sort((a,b)=>a-b);
   if(state.all)port.taggedVlanPolicy='All'+(state.allowed.size?' except '+sorted(state.allowed).join(','):'')+(tagNative?' (native tagged)':' ; native VLAN '+native+' is untagged if allowed');
   if(state.native==null)note(port,'Native VLAN 1 is the documented IOS trunk default.');
  }else if(state.mode==='access'||state.access!=null){port.role=state.mode==='access'?'access':'Dynamic (configured access VLAN; verify operational mode)';port.native=state.access??1;port.nativeState='Known';if(state.mode!=='access')note(port,'Static access mode is not configured. DTP negotiated mode is not established by this backup.');}
  else if(state.mode.startsWith('dynamic')){port.role=state.mode;note(port,'DTP operational mode and VLAN membership are unconfirmed.');}
  if(state.voice!=null&&state.mode!=='trunk'){port.voice=state.voice;if(state.voice!==port.native&&!port.tagged.includes(state.voice))port.tagged.push(state.voice);}
  else if(state.voice!=null)note(port,'Configured access-mode voice VLAN is not applied to a static trunk; trunk allowed membership is authoritative.');
  if(state.allowedSet&&state.mode!=='trunk')note(port,'Configured trunk allowed VLANs are inactive or unconfirmed without static trunk mode.');
  port.tagged.sort((a,b)=>a-b);
 }
 for(const state of states.values()){
  if(state.aggregate){state.port.lag=state.aggregate;const aggregate=channels.get(channelKey(state.aggregate));
   if(!aggregate){block('Cisco port channel has no explicit configuration: '+state.aggregate+'.');finish(state);continue;}
   const effective={...state,mode:aggregate.mode||state.mode,access:aggregate.access??state.access,native:aggregate.native??state.native,voice:aggregate.voice??state.voice,routed:aggregate.routed||state.routed,all:aggregate.allowedSet?aggregate.all:state.all,allowed:aggregate.allowedSet?aggregate.allowed:state.allowed,allowedSet:aggregate.allowedSet||state.allowedSet};
   finish(effective);state.port.aggregationMode=(['active','passive'].includes(state.channelMode)?'LACP':['auto','desirable'].includes(state.channelMode)?'PAgP':'static')+' ('+state.channelMode+')';
   note(state.port,'Aggregation mode: '+state.port.aggregationMode);note(state.port,'Port-channel configuration applied from '+state.aggregate+'.');if(!state.port.description&&aggregate.port.description)state.port.description=aggregate.port.description;
  }else finish(state);
 }
 for(const state of channels.values()){finish(state);state.port.type='aggregate';}
 if(!assumptions.includes('Saved Cisco configuration does not establish DTP negotiation, live links or forwarding state.'))assumptions.push('Saved Cisco configuration does not establish DTP negotiation, live links or forwarding state.');
 if(blockers.length)device.reportBlockers=blockers;device.reportAssumptions=assumptions;
}
