import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The desktop window reopens at its last size and position. The placement is
// a local preference beside the update cache, restored only onto a connected
// screen, and the native test host keeps its deterministic default window.
test('the desktop host restores and saves its window placement',()=>{
 const program=readFileSync(new URL('../desktop/Program.cs',import.meta.url),'utf8'),placement=readFileSync(new URL('../desktop/WindowPlacement.cs',import.meta.url),'utf8');
 assert.match(program,/#if !NDS_TEST_HOST\s+\/\/[^\n]*\n\s+WindowPlacement\.Restore\(this\);\s+FormClosing \+= \(_, _\) => WindowPlacement\.Save\(this\);\s+#endif/);
 assert.match(placement,/Path\.Combine\(Policy\.Home, "window\.json"\)/,'stored with the other local preferences');
 assert.match(placement,/Screen\.AllScreens/,'restored only onto a connected screen');
 assert.match(placement,/RestoreBounds/,'a maximized window saves its normal bounds');
 assert.match(placement,/FormWindowState\.Maximized/,'the maximized state is kept');
});
