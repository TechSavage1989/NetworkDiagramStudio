import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseNotesBlocks} from '../src/web/desktop-updates.mjs';

test('release notes retain complete wrapped content and inert markup in readable sections',()=>{
 const blocks=releaseNotesBlocks('# NetworkDiagramStudio 0.1.0-preview.23\r\n\r\n## Improvements\r\n- **Layout:** Complete text\r\n  continues on the next source line.\r\n- A second item.\r\n\r\n### Recovery\r\nSave the project first.\r\nUnsaved edits are not restored.\r\n\r\n- <img src=x onerror="run()">\r\n- [Link](javascript:run())\r\n');
 assert.deepEqual(blocks,[{type:'heading',text:'Improvements'},{type:'item',text:'**Layout:** Complete text continues on the next source line.'},{type:'item',text:'A second item.'},{type:'heading',text:'Recovery'},{type:'paragraph',text:'Save the project first. Unsaved edits are not restored.'},{type:'item',text:'<img src=x onerror="run()">'},{type:'item',text:'[Link](javascript:run())'}]);
 assert.deepEqual(releaseNotesBlocks(''),[]);
});
