import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const allowed=new Set(['.gitignore','.github','AGENTS.md','CLAUDE.md','DEVELOPMENT_HANDOFF.md','README.md','desktop','docs','scripts','src','tests']);
const generated=new Set(['.git','dist','node_modules','.artifacts']);
const root=resolve(process.argv[2]||fileURLToPath(new URL('..',import.meta.url)));
let entries;
try{
 const top=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 if(resolve(top)!==root)throw Error('Archive');
 entries=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).map(s=>s.split('/')[0]);
}catch{entries=readdirSync(root).filter(s=>!generated.has(s));}
const extra=[...new Set(entries.filter(s=>!allowed.has(s)))];
if(extra.length){console.error('Unexpected root entries: '+extra.join(', '));process.exitCode=1;}
else console.log('Repository layout OK');
