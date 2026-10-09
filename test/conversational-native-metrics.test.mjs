import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('native metrics rejects retired capture before consuming amplitude window and exposes genuine bounded peak only',()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaVoiceCloudPlugin.java','utf8'),from=source.indexOf(' synchronized JSObject metrics('),to=source.indexOf(' synchronized JSObject stop()',from);assert.ok(from>=0&&to>from);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-voice-metrics-')),home=process.env.JAVA_HOME||'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
 try{fs.writeFileSync(path.join(dir,'MetricsTest.java'),`import java.util.HashMap; public class MetricsTest {
 static class JSObject extends HashMap<String,Object>{} static class Recorder {int reads;int amplitude=16384;int getMaxAmplitude(){reads++;return amplitude;}}
 Recorder recorder=new Recorder();String id="capture2";
 ${source.slice(from,to)}
 public static void main(String[]args){MetricsTest f=new MetricsTest();try{f.metrics("capture1");throw new AssertionError("Stale read admitted");}catch(IllegalStateException expected){}if(f.recorder.reads!=0)throw new AssertionError("Stale read consumed capture2 window");JSObject value=f.metrics("capture2");if(f.recorder.reads!=1||!"capture2".equals(value.get("recordingId")))throw new AssertionError("Wrong capture");double peak=(double)value.get("peak");if(peak<=.5||peak>=.501||value.containsKey("rms"))throw new AssertionError("Fake metrics");f.recorder.amplitude=65535;if((double)f.metrics("capture2").get("peak")!=1)throw new AssertionError("Unbounded peak");f.recorder=null;try{f.metrics("capture2");throw new AssertionError("Stopped read admitted");}catch(IllegalStateException expected){} }
}`);execFileSync(path.join(home,'bin/javac'),['-d',dir,path.join(dir,'MetricsTest.java')],{timeout:15000});execFileSync(path.join(home,'bin/java'),['-cp',dir,'MetricsTest'],{timeout:15000});}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
