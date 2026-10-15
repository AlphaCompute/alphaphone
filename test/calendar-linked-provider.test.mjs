import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('Calendar sync uses the authenticated Cloud transport and keeps provider outcomes and owner fences',()=>{
 execFileSync(process.execPath,['--import','tsx','scripts/test-calendar-sync-provider.ts'],{cwd:new URL('..',import.meta.url),timeout:30000,stdio:'pipe'});
});
