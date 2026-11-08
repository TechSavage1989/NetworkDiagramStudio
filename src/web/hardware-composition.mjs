// Validate user-confirmed chassis composition independently of imported port state.
export function hardwareComposition(members=[],modules=[]){
 const seenMembers=new Set(),seenSlots=new Set();
 const memberId=value=>{const id=String(value??'').trim();if(!/^\d+$/.test(id)||+id<1||+id>256)throw Error('Use a member number from 1 to 256.');return String(+id);};
 const model=value=>{const text=String(value??'').trim();if(!text||text.length>120)throw Error('Enter a model or SKU for each hardware row.');return text;};
 const stackMembers=members.map(row=>{
  const id=memberId(row.id);if(seenMembers.has(id))throw Error('Each stack member needs a unique number.');seenMembers.add(id);return {id,model:model(row.model)};
 }).sort((a,b)=>Number(a.id)-Number(b.id));
 const cards=modules.map(row=>{
  const member=String(row.member??'').trim()?memberId(row.member):'',slot=String(row.slot??'').trim().toUpperCase();
  if(!/^(?:[A-L]|NM|X2-[12])$/.test(slot))throw Error('Use a module slot from A to L, NM, or X2-1 / X2-2.');
  if(stackMembers.length&&(!member||!seenMembers.has(member)))throw Error('Choose an existing stack member for each module.');
  const key=member+'/'+slot;if(seenSlots.has(key))throw Error('Each member and module slot must be unique.');seenSlots.add(key);
  return {member,slot,model:model(row.model)};
 });
 return {stackMembers,modules:cards};
}
