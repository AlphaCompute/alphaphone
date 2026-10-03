import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('notification storage never runs on caller and preserves bounded FIFO under a blocked write',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-notice-io-'));
 const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const binary=name=>java?path.join(java,'bin',name):name;
 try{
  execFileSync(binary('javac'),['--release','11','-d',dir,'android/app/src/main/java/ai/elizaresearch/alphaphone/WorkflowNoticeIo.java','test/fixtures/WorkflowNoticeIoTest.java'],{timeout:20000});
  assert.match(execFileSync(binary('java'),['-cp',dir,'ai.elizaresearch.alphaphone.WorkflowNoticeIoTest'],{encoding:'utf8',timeout:15000}),/^PASS bounded notification storage ordering/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
