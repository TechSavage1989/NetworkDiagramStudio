// Select whole diagram objects, not their nested artwork or information panel.
// Do not expand saved groups here: a mixed group may also contain panel items.
export function diagramContentKeys(page){
 return new Set((page?.items||[]).filter(item=>item.editKey&&!item.panelGroup&&!item.pageFrame).map(item=>item.editKey));
}

export function textEditingTarget(target){
 return !!(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-inline-editor]'));
}
