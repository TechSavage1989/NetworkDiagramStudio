// Bounded, non-validating reader for the named topology fields of firewall exports.
// No entity definitions, external resources, processing instructions, or object-to-code conversion.
const named = {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'"};
function decode(s) {
  return s.replace(/&([^;\s<&]{1,24});/g, (_, code) => {
    if (Object.hasOwn(named,code)) return named[code];
    if (!/^#(?:x[\da-f]+|\d+)$/i.test(code)) throw new Error('Unsupported XML entity.');
    const cp=code[1].toLowerCase()==='x'?parseInt(code.slice(2),16):Number(code.slice(1));
    if(!Number.isInteger(cp)||cp<=0||cp>0x10ffff) throw new Error('Invalid XML character.');
    return String.fromCodePoint(cp);
  });
}
export function parseXML(xml) {
  if(xml.length>24*1024*1024)throw new Error('XML configuration exceeds the 24 MiB limit.');
  const top={name:'',children:[],value:''}, stack=[top]; let count=0, offset=0;
  const tokens=/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[\w:.-]+(?:[^<>"']|"[^"]*"|'[^']*')*>|[^<]+/gy;
  for(const match of xml.matchAll(tokens)){
    const s=match[0];offset=match.index+s.length;const owner=stack.at(-1);
    if(s.startsWith('<?')||s.startsWith('<!--'))continue;
    if(s.startsWith('<![CDATA[')){owner.value+=s.slice(9,-3);continue;}
    if(s.startsWith('</')) {
      if(stack.length<=1||s.slice(2,-1).trim()!==owner.name)throw new Error('Mismatched XML elements.');
      stack.pop();continue;
    }
    if(s[0]!=='<'){owner.value+=decode(s);continue;}
    const tag=/^<([\w:.-]+)([\s\S]*?)\/?\s*>$/.exec(s);
    if(!tag || ++count>250000 || stack.length>100)throw new Error('Malformed or overly complex XML.');
    const attrs=Object.create(null);
    for(const m of tag[2].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[m[1]]=decode(m[2]??m[3]);
    const node={name:tag[1],attrs,children:[],value:''};owner.children.push(node);
    if(!s.endsWith('/>'))stack.push(node);
  }
  if(offset!==xml.length||stack.length!==1||top.children.length!==1||top.value.trim())throw new Error('Invalid XML or unsupported declarations. Use an unencrypted XML export.');
  return top.children[0];
}
export const children=(node,name)=>node?.children.filter(c=>c.name===name)||[];
export const child=(node,name)=>children(node,name)[0];
export const at=(node,path)=>path.split('/').reduce((n,tag)=>child(n,tag),node);
export const text=(node,path)=>at(node,path)?.value.trim()||'';
