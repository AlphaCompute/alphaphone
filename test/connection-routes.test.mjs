import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

// Plain-JVM compile and run of the native renderer-transport route policy. This does not build an
// APK, run on Android, or contact Eliza Cloud or any agent.
test('native transport refuses production pairing and admits DELETE only for Cloud self-revocation',()=>{
 const root=resolve(import.meta.dirname,'..'),temporary=mkdtempSync(join(tmpdir(),'connection-routes-'));
 const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const binary=name=>java?join(java,'bin',name):name;
 try{
  execFileSync(binary('javac'),['--release','11','-d',temporary,join(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/ConnectionRoutes.java'),join(root,'test/fixtures/ConnectionRoutesTest.java')],{timeout:60000});
  assert.match(execFileSync(binary('java'),['-cp',temporary,'ai.elizaresearch.alphaphone.ConnectionRoutesTest'],{encoding:'utf8',timeout:60000}),/^PASS connection routes/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
