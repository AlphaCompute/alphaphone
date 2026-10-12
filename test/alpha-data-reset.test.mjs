import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

test('Reset Alpha data runs in order, resumes after process death, gates late callbacks and never follows links out of private storage',()=>{
 const root=resolve(import.meta.dirname,'..'),temporary=mkdtempSync(join(tmpdir(),'alpha-reset-'));
 const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const binary=name=>java?join(java,'bin',name):name;
 try{
  execFileSync(binary('javac'),['--release','11','-d',temporary,join(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaDataResetPlan.java'),join(root,'test/fixtures/AlphaDataResetPlanTest.java')],{timeout:120000});
  assert.match(execFileSync(binary('java'),['-cp',temporary,'ai.elizaresearch.alphaphone.AlphaDataResetPlanTest'],{encoding:'utf8',timeout:120000}),/^PASS alpha data reset plan/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
