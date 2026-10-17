import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('requested Camera capture uses the existing adapter and journal without replay',()=>{
 execFileSync(process.execPath,['--import','tsx','scripts/test-agent-camera-flow.mjs'],{encoding:'utf8',stdio:'pipe',timeout:30000});
});
