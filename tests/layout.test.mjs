import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('root guard also rejects clutter in extracted source without .git',()=>{
 const folder=mkdtempSync(join(tmpdir(),'nds-layout-'));const command=fileURLToPath(new URL('../scripts/check-repo.mjs',import.meta.url));
 try{writeFileSync(join(folder,'README.md'),'Test');assert.equal(spawnSync(process.execPath,[command,folder]).status,0);writeFileSync(join(folder,'unreviewed.bin'),'bad');assert.equal(spawnSync(process.execPath,[command,folder]).status,1);}
 finally{rmSync(folder,{recursive:true,force:true});}
});
