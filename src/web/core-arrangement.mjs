import {CORE_ARRANGEMENTS,coreArrangement} from './layout.mjs';

// User-facing names for the automatic network page arrangements. Every one
// keeps the saved device order, reading down each column and then across.
export const CORE_ARRANGEMENT_CHOICES=Object.freeze([
 ['compact','Compact - least area'],
 ['vertical','Vertical stack - one column'],
 ['columns-2','2 columns'],
 ['columns-3','3 columns'],
 ['columns-4','4 columns']
]);

// Positional patches that pin automatic placement on a network page: device
// and card bodies, their captions, cable labels and cable bends. Sizes, text,
// colors and cable widths are not positions and stay as edited.
const POSITIONED=['device','title','detail','media','port','reference','path'];
function clearPositions(edits,names){
 const result={...edits};
 for(const [key,patch] of Object.entries(edits||{})){
  const name=[...names].find(n=>key.startsWith(n+'|'));
  if(!name||!POSITIONED.includes(key.slice(name.length+1).split('|')[0])||!patch||typeof patch!=='object')continue;
  const next={...patch};delete next.x;delete next.y;delete next.points;
  if(Object.keys(next).length)result[key]=next;else delete result[key];
 }
 return result;
}

// The rendered network pages that follow one arrangement setting: a named
// page with its own choice, or every page that uses the drawing default.
export function arrangementPages(project,pages,corePageId=null){
 const own=id=>project.layout?.corePages?.find(p=>p.id===id)?.arrangement;
 return (pages||[]).filter(p=>p.coreDeviceIds&&(corePageId&&own(corePageId)?p.corePageId===corePageId:!own(p.corePageId)));
}

// Returns a new layout; the project is not mutated. Changing an arrangement
// clears the positions that would otherwise keep the previous placement.
// A named page may also return to the drawing default (mode null).
export function arrangeCoreLayout(project,pages,{mode,corePageId=null,scope='page'}={}){
 const custom=scope==='page'&&corePageId?project.layout?.corePages?.find(p=>p.id===corePageId):null;
 if(!CORE_ARRANGEMENTS.includes(mode)&&!(custom&&mode==null))throw Error('Choose a supported page arrangement.');
 const layout=structuredClone(project.layout||{}),target=custom&&layout.corePages.find(p=>p.id===corePageId);
 const targets=custom?(pages||[]).filter(p=>p.corePageId===corePageId):arrangementPages(project,pages);
 if(target){if(mode==null)delete target.arrangement;else target.arrangement=mode;}else layout.coreArrangement=mode;
 const names=new Set(targets.flatMap(p=>[p.name,p.baseName].filter(Boolean)));
 layout.drawingEdits=clearPositions(layout.drawingEdits||{},names);
 return layout;
}

// The value shown for a page: its own choice, or the drawing default.
export function pageArrangement(project,page){return coreArrangement(project,page?.corePageId);}
