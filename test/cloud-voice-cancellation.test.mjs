import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');

test('Cloud playback actual renderer cancels despite stalled native cleanup and rejects stale completions',()=>{
  execFileSync(process.execPath,['--experimental-transform-types','scripts/test-cloud-voice-cancellation-flow.mjs'],{cwd:root,timeout:15000,stdio:'pipe'});
});

test('queued production native scoped stop cannot clear a newer playback request',()=>{
  const source=fs.readFileSync(path.join(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaVoiceCloudPlugin.java'),'utf8');
  const signature='public void stopPlayback(PluginCall call)';
  const start=source.indexOf(signature);assert.ok(start>=0);
  let cursor=source.indexOf('{',start),depth=1;
  while(depth&&++cursor<source.length){if(source[cursor]==='{')depth++;else if(source[cursor]==='}')depth--;}
  assert.equal(depth,0);
  const method=source.slice(start,cursor+1);
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-cloud-stop-'));
  try {
    fs.writeFileSync(path.join(fixture,'ScopedStopHarness.java'),`import java.util.*;
public class ScopedStopHarness {
 static class PluginCall {String id;PluginCall(String id){this.id=id;}String getString(String key){return id;}void resolve(){}}
 static class Queue {Runnable next;void post(Runnable run){next=run;}void flush(){next.run();}}
 Queue main=new Queue();String playbackRequestId="old";int clears=0;
 void clearPlayback(){clears++;}
 ${method}
 public static void main(String[] args){var h=new ScopedStopHarness();h.stopPlayback(new PluginCall("old"));h.playbackRequestId="new";h.main.flush();if(h.clears!=0)throw new AssertionError("late old stop cleared new audio");h.stopPlayback(new PluginCall("new"));h.main.flush();if(h.clears!=1)throw new AssertionError("owned stop failed");h.stopPlayback(new PluginCall(null));h.main.flush();if(h.clears!=2)throw new AssertionError("legacy stop changed");}
}`);
    execFileSync('javac',['-d',fixture,path.join(fixture,'ScopedStopHarness.java')],{timeout:10000,stdio:'pipe'});
    execFileSync('java',['-cp',fixture,'ScopedStopHarness'],{timeout:5000,stdio:'pipe'});
  } finally {fs.rmSync(fixture,{recursive:true,force:true});}
});
