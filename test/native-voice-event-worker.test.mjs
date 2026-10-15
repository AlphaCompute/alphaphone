import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('actual voice worker refuses repeated admission while a cancelled feed is still enrolling',()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java','utf8');
 const initializer=source.match(/ExecutorService voiceWorkers=([^;]+);/)?.[1];assert.ok(initializer);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'voice-worker-'));
 try{
  fs.copyFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/PluginWorkers.java',path.join(dir,'PluginWorkers.java'));
  fs.writeFileSync(path.join(dir,'VoiceWorkerTest.java'),`package ai.elizaresearch.alphaphone;
import java.util.concurrent.*;
public class VoiceWorkerTest {
 public static void main(String[] args)throws Exception {
  ExecutorService worker=${initializer}; CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);
  try {
   PluginWorkers.submit(worker,()->{entered.countDown();try{release.await();}catch(InterruptedException ignored){}},()->{throw new AssertionError();});
   if(!entered.await(5,TimeUnit.SECONDS))throw new AssertionError("worker never started");
   int[] refused={0};for(int i=0;i<100;i++)PluginWorkers.submit(worker,()->{throw new AssertionError("unbounded admission");},()->refused[0]++);
   if(refused[0]!=100)throw new AssertionError("feed queued or threaded");
  }finally{release.countDown();worker.shutdownNow();}
  if(!worker.awaitTermination(5,TimeUnit.SECONDS))throw new AssertionError("worker leaked");
  boolean[] refused={false};PluginWorkers.submit(worker,()->{throw new AssertionError();},()->refused[0]=true);if(!refused[0])throw new AssertionError();
 }
}`);
  execFileSync('javac',['-d',dir,path.join(dir,'PluginWorkers.java'),path.join(dir,'VoiceWorkerTest.java')]);
  execFileSync('java',['-cp',dir,'ai.elizaresearch.alphaphone.VoiceWorkerTest'],{timeout:15000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
