import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {dirname,relative,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../src/web/',import.meta.url));
const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,e.name);if(e.isDirectory())await walk(path);else if(extname(path)==='.mjs')files.push(path);}}
await walk(root);files.sort();const key=p=>'nds/'+relative(root,p).split(sep).join('/');
const imports={};
for(const path of files){
  const source=(await readFile(path,'utf8')).replace(/((?:from|import)\s*['"])(\.\.?\/[^'"]+)(['"])/g,(_,before,spec,after)=>{
    const target=resolve(dirname(path),spec);if(!files.includes(target))throw Error('Missing module '+spec+' in '+key(path));
    return before+key(target)+after;
  });
  imports[key(path)]='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
}
const stylesheet=await readFile(resolve(root,'style.css'),'utf8');
const emf=await readFile(resolve(root,'vendor/emfjs.min.js'),'utf8');
const noticeFiles=['vendor/NOTICE.txt','vendor/EMFJS-LICENSE.txt','imports/NETBOX-LICENSE.txt'];
const notices=(await Promise.all(noticeFiles.map(p=>readFile(resolve(root,p),'utf8')))).join('\n\n');
const html=(await readFile(resolve(root,'index.html'),'utf8'))
  .replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+stylesheet+'</style>')
  .replace('<script src="./vendor/emfjs.min.js"></script>',()=>'<script>'+emf.replace(/<\/script/gi,'<\\/script')+'</script>')
  .replace('<script type="module" src="./app.mjs"></script>',()=>'<script type="importmap">'+JSON.stringify({imports})+'</script>\n<script type="module">import "nds/app.mjs";</script>')
  .replace('</body>',()=>'<script type="text/plain" id="third-party-notices">'+notices.replace(/<\/script/gi,'<\\/script')+'</script>\n</body>');
const target=resolve(process.argv[2]||'dist/NetworkDiagramStudio.html');
await mkdir(dirname(target),{recursive:true});await writeFile(target,html);
console.log('Built offline web application:',target);
