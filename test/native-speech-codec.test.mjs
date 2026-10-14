import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
test('native speech adapter compiles against shared engine and validates PCM boundaries',()=>{
 const root=resolve(import.meta.dirname,'..'),out=mkdtempSync(join(tmpdir(),'alpha-native-speech-'));
 const binary=name=>process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',name):name;
 const shared=join(root,'vendor/eliza/packages/app/platforms/android/paradee-voice/src/main/java/ai/eliza/voice');
 try{
  execFileSync(binary('javac'),['--release','17','-d',out,...['VoiceNative','NativeAsr','ParadeeVoice'].map(name=>join(shared,name+'.java')),join(root,'android/local-speech/src/main/java/ai/eliza/speech/LocalSpeechEngine.java'),join(root,'android/local-speech/src/main/java/ai/eliza/speech/LocalSpeechEngineHolder.java'),join(root,'test/fixtures/native-speech/AudioTest.java')],{timeout:60000});
  assert.match(execFileSync(binary('java'),['-cp',out,'AudioTest'],{timeout:30000,encoding:'utf8'}),/PASS PCM roundtrip/);
 }finally{rmSync(out,{recursive:true,force:true});}
});
