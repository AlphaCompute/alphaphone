import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
test('new email preserves unfinished emails as separate account-scoped local drafts',()=>{execFileSync(process.execPath,['scripts/test-inbox-multiple-drafts.mjs'],{stdio:'pipe',timeout:30000});});
