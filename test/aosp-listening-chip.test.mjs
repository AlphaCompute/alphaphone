import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {prepareListenerSystemui,verifyListenerSystemui} from '../scripts/aosp-listener-systemui.mjs';
const bundle='android/aosp/listener/systemui/chip';
const manifest=JSON.parse(fs.readFileSync(`${bundle}/manifest.json`));
test('shipped listener marker and staged SystemUI policy enforce exact identity and pause-only capability',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'listener-chip-policy-'));
 try{
  const java=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin'):'';
  execFileSync(path.join(java,'javac'),['--release','11','-d',temp,`${bundle}/source/AlphaListeningPolicy.java`,'android/sense/src/main/java/ai/elizaresearch/alphaphone/sense/ListenerActionContract.java','test/fixtures/ListenerSystemUiPolicyTest.java']);
  assert.match(execFileSync(path.join(java,'java'),['-cp',temp,'ai.elizaresearch.alphaphone.sense.ListenerSystemUiPolicyTest'],{encoding:'utf8'}),/^PASS listener SystemUI policy/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('staged source and exact patch stay bound; independent monitor does not trust notification or app reports for capture',()=>{
 const sha=value=>createHash('sha256').update(value).digest('hex');
 assert.equal(sha(fs.readFileSync(`${bundle}/${manifest.patch}`)),manifest.patchSha256);
 for(const file of fs.readdirSync(`${bundle}/source`)){
  const entry=manifest.files.find(entry=>entry.path.endsWith('/'+file));assert.ok(entry);assert.equal(sha(fs.readFileSync(`${bundle}/source/${file}`)),entry.afterSha256);
 }
 const controller=fs.readFileSync(`${bundle}/source/AlphaListeningController.java`,'utf8');
 assert.match(controller,/registerAudioRecordingCallback/);assert.match(controller,/getClientUid\(\),config.isClientSilenced\(\)/);
 assert.match(controller,/token.getIntent\(\)/);assert.match(controller,/ListenerActionReceiver/);assert.match(controller,/chosen.send\(\)/);
 assert.doesNotMatch(controller,/ContentResolver|LISTENER_CONTROL|RECORD_AUDIO|pcm16|transcript|\.resume\(/);
 assert.equal(manifest.indicatorHealthLeaseImplemented,false);assert.equal(manifest.lockAodIndicatorQualified,false);
});
test('chip overlay applies to exact pinned source and rejects new-file collisions and mutation',{skip:!process.env.ALPHA_SYSTEMUI_TEST_SOURCE},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'listener-chip-exact-'));
 try{
  const output=path.join(temp,'overlay');const receipt=prepareListenerSystemui(process.env.ALPHA_SYSTEMUI_TEST_SOURCE,output,'chip');
  assert.equal(receipt.fullTreeVerified,false);assert.equal(receipt.files.length,manifest.files.length);
  assert.throws(()=>verifyListenerSystemui(output,'before','chip'),/already exists/);
  fs.appendFileSync(path.join(output,'frameworks/base',manifest.files[0].path),'\n//mutation');
  assert.throws(()=>verifyListenerSystemui(output,'after','chip'),/image mismatch/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
