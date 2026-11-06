// Session history stores changed JSON values, not repeated copies of stencil images.
export function copyValue(value){return Array.isArray(value)?value.map(copyValue):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copyValue(v)])):value;}
export function changesBetween(before,after){
 const changes=[];
 function visit(a,b,path,hasA=true,hasB=true){
  if(hasA===hasB&&a===b)return;
  const objects=hasA&&hasB&&a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b);
  if(objects&&(!Array.isArray(a)||a.length===b.length)){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))visit(a[key],b[key],[...path,key],Object.hasOwn(a,key),Object.hasOwn(b,key));}
  else changes.push({path,before:copyValue(a),after:copyValue(b),hasBefore:hasA,hasAfter:hasB});
 }visit(before,after,[]);return changes;
}
export function applyChanges(state,changes,redo=false){
 const shallow=value=>Array.isArray(value)?value.slice():value&&typeof value==='object'?{...value}:value;let next=shallow(state);const copied=new WeakSet();if(next&&typeof next==='object')copied.add(next);
 for(const change of changes){const path=change.path;if(path.some(k=>['__proto__','constructor','prototype'].includes(String(k))))throw Error('Invalid history path.');const value=redo?change.after:change.before,has=redo?change.hasAfter:change.hasBefore;
  if(!path.length){next=copyValue(value);continue;}let parent=next;for(const key of path.slice(0,-1)){if(!copied.has(parent[key])){parent[key]=shallow(parent[key]);copied.add(parent[key]);}parent=parent[key];}const key=path.at(-1);if(has)parent[key]=copyValue(value);else delete parent[key];
 }return next;
}
export class ProjectHistory {
 constructor(state,limit=200){this.limit=limit;this.reset(state);}
 reset(state){this.base=copyValue(state);this.past=[];this.future=[];this.nextId=1;this.floor=0;this.saved=0;}
 get revision(){return this.past.at(-1)?.id??this.floor;}
 get dirty(){return this.revision!==this.saved;}
 markSaved(){this.saved=this.revision;}
 record(state,scope='project'){
  const changes=changesBetween(this.base,state);this.base=copyValue(state);if(!changes.length)return false;this.past.push({id:this.nextId++,scope,changes});if(this.past.length>this.limit)this.floor=this.past.shift().id;this.future=[];return true;
 }
 canUndo(scope){return !!this.past.length&&(!scope||this.past.at(-1).scope===scope);}
 canRedo(scope){return !!this.future.length&&(!scope||this.future.at(-1).scope===scope);}
 travel(state,{redo=false,all=false,scope,validate}={}){
  const from=redo?this.future:this.past,to=redo?this.past:this.future,entries=[];let next=state;
  for(let i=from.length-1;i>=0;i--){const entry=from[i];if(scope&&entry.scope!==scope)break;next=applyChanges(next,entry.changes,redo);entries.push(entry);if(!all)break;}
  if(!entries.length)return state;validate?.(next);from.splice(from.length-entries.length,entries.length);to.push(...entries);this.base=copyValue(next);return next;
 }
}
