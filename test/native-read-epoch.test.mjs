import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
test('delayed provider results cannot cross a lifecycle or permission boundary',()=>{
 const root=resolve(import.meta.dirname,'..'),dir=mkdtempSync(join(tmpdir(),'alpha-native-epoch-'));
 const java=name=>process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',name):name;
 try{
  execFileSync(java('javac'),['--release','11','-d',dir,join(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/NativeReadEpoch.java'),join(root,'test/fixtures/NativeReadEpochTest.java')],{timeout:60000});
  assert.match(execFileSync(java('java'),['-cp',dir,'ai.elizaresearch.alphaphone.NativeReadEpochTest'],{encoding:'utf8',timeout:15000}),/PASS native read publication fences/);
  const photos=readFileSync(join(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaPhotoLibraryPlugin.java'),'utf8');
  for(const method of ['page','inspect','validate','changes']) {
   const body=photos.split('public void '+method+'(')[1].split('\n @PluginMethod')[0];
   assert.match(body,/publish\(call,/);assert.doesNotMatch(body,/call\.resolve\(/);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
