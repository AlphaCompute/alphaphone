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
 // Source-level lease only: never compiled in SystemUI, built into an image or qualified on a device.
 assert.equal(manifest.indicatorHealthLeaseImplemented,true);assert.equal(manifest.lockAodIndicatorQualified,false);
 assert.deepEqual([manifest.fullTreeVerified,manifest.imageBuilt,manifest.indicatorHealthLease.systemUiCompiled,manifest.indicatorHealthLease.qualified],[false,false,false,false]);
 const lease=fs.readFileSync(`${bundle}/source/AlphaListeningLease.java`,'utf8');
 assert.match(lease,/content:\/\/"\+AlphaListeningPolicy\.LEASE_AUTHORITY/);assert.match(lease,/new Binder\(\)/);assert.match(lease,/leaseTarget\(/);
 assert.doesNotMatch(lease.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,''),/sense\.control|LISTENER_CONTROL|RECORD_AUDIO|pcm|transcript|resume|consent|turnOn|enable/i,'acknowledgements carry visibility only');
 const view=fs.readFileSync(`${bundle}/source/AlphaListeningChipView.java`,'utf8');
 // The consumer's shade check matches the producer's indicator notification.
 const producer=fs.readFileSync('android/sense/src/main/java/ai/elizaresearch/alphaphone/sense/ListenerNotifications.java','utf8');
 assert.match(producer,/CHANNEL_ACTIVE="listening-indicator"/);assert.match(producer,/ACTIVE_ID=1,/);assert.match(producer,/\.setOngoing\(true\)/);
 const policy=fs.readFileSync(`${bundle}/source/AlphaListeningPolicy.java`,'utf8');
 assert.match(policy,/notificationId==1&&"listening-indicator"\.equals\(channel\)&&ongoing/);
 for(const hook of [/onVisibilityAggregated/,/onWindowVisibilityChanged/,/onDetachedFromWindow\(\)\{AlphaListeningController\.detach/,/getGlobalVisibleRect/,/isShown\(\)/])assert.match(view,hook);
});
const java=name=>path.join(javaHome(),'bin',name);
function javaHome(){return process.env.JAVA_HOME||(process.platform==='darwin'&&fs.existsSync('/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home')?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');}
const stubs=dir=>fs.readdirSync(dir,{recursive:true}).filter(name=>name.endsWith('.java')).map(name=>path.join(dir,name));
test('prepared Java chip sources type-check against SystemUI stubs and the lease client fails closed on the JVM',()=>{
 // Hand-written stubs (test/fixtures/systemui-chip-jvm), not the pinned SystemUI tree; the Kotlin binder is not compiled.
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'listener-chip-lease-'));
 try{
  const sources=fs.readdirSync(`${bundle}/source`).filter(name=>name.endsWith('.java')).map(name=>`${bundle}/source/${name}`);
  assert.equal(sources.length,4);
  execFileSync(java('javac'),['--release','11','-Xlint:all','-Werror','-Xlint:-serial','-d',temp,...stubs('test/fixtures/systemui-chip-jvm'),...sources,
   'android/sense/src/main/java/ai/elizaresearch/alphaphone/sense/IndicatorLease.java','test/fixtures/SystemUiLeaseClientTest.java','test/fixtures/SystemUiAcknowledgementTest.java'],{timeout:60000});
  assert.match(execFileSync(java('java'),['-cp',temp,'com.android.systemui.privacy.SystemUiLeaseClientTest'],{encoding:'utf8',timeout:60000}),/^PASS SystemUI lease client/);
  // Lock screen/AOD keyguard chip, unlocked status bar, expanded shade, immersive mode and display state.
  assert.match(execFileSync(java('java'),['-cp',temp,'com.android.systemui.privacy.SystemUiAcknowledgementTest'],{encoding:'utf8',timeout:60000}),/^PASS SystemUI acknowledgement/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('the exact patch creates the staged chip sources byte for byte',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'listener-chip-newfiles-'));
 try{
  execFileSync('git',['init','-q'],{cwd:temp});
  execFileSync('git',['apply','--whitespace=error','--include=packages/SystemUI/src/com/android/systemui/privacy/Alpha*',path.resolve(bundle,manifest.patch)],{cwd:temp});
  const created=fs.readdirSync(path.join(temp,'packages/SystemUI/src/com/android/systemui/privacy')).sort();
  assert.deepEqual(created,fs.readdirSync(`${bundle}/source`).sort());
  for(const file of created)assert.ok(fs.readFileSync(path.join(temp,'packages/SystemUI/src/com/android/systemui/privacy',file)).equals(fs.readFileSync(`${bundle}/source/${file}`)),file);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
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
