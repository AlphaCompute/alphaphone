import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {preparePatchedNative} from '../scripts/prepare-patched-native.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('pinned recovery and lifecycle sources match the reviewed upstream repair',()=>{
 for(const [name,expected] of [
 ['ElizaAgentService','f2377edd144e45365479783ad61acf47077519c6604ad0bf0c11862ad2a988a4'],
 ['IpcStartupRecovery','d77ea0883554991622a5a0b044a7cf373686eec15c5a705abbd69aaf5b94e80f'],
 ['WorkflowSurvivorInventory','72568e8f859c0453606100d0f94d26c4cec4c3b7811ad62b0eaea8ea76a66820'],
 ])assert.equal(sha(fs.readFileSync(`vendor/eliza/packages/app/platforms/android/app/src/main/java/ai/elizaos/app/${name}.java`)),expected);
});
test('obsolete resident patch slot is refused rather than reapplied',()=>{
 assert.throws(()=>preparePatchedNative({manifestFile:'resident-native-manifest.json'}),/Unknown native patch slot/);
 assert.equal(fs.existsSync('patches/eliza/resident-ipc-recovery.patch'),false);
});
