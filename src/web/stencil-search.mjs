const normalized=value=>String(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
export function filterStencilMasters(items,query){
 const terms=String(query||'').trim().split(/\s+/).map(normalized).filter(Boolean);
 return items.filter(item=>terms.every(term=>normalized(item.name).includes(term)));
}
