import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
test('native production playback methods distinguish completion, replacement and scoped stop',()=>{
 const source=fs.readFileSync(new URL('../android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaVoiceCloudPlugin.java',import.meta.url),'utf8');
 const extract=signature=>{const start=source.indexOf(signature);assert.ok(start>=0);let cursor=source.indexOf('{',start),depth=1;while(depth&&++cursor<source.length){if(source[cursor]==='{')depth++;else if(source[cursor]==='}')depth--;}assert.equal(depth,0);return source.slice(start,cursor+1);};
 const methods=['public void play(PluginCall call)','private void clearPlayback()','private void clearPlayback(boolean stopped)','public void stopPlayback(PluginCall call)','public void synthesizeLocal(PluginCall call)'].map(extract).join('\n');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-native-speech-'));
 try{fs.writeFileSync(path.join(directory,'NativeSpeechHarness.java'),`import java.io.*;import java.util.*;
public class NativeSpeechHarness {
 static class JSObject extends HashMap<String,Object>{}
 static class PluginCall {String playback,request,code;boolean replace=true,resolved,rejected;String getString(String key){return key.equals("requestId")?request:playback;}Boolean getBoolean(String key,boolean fallback){return replace;}void resolve(){resolved=true;}void reject(String message){rejected=true;}void reject(String message,String value){rejected=true;code=value;}}
 static class Queue {Deque<Runnable> work=new ArrayDeque<>();void post(Runnable run){work.add(run);}void flush(){while(!work.isEmpty())work.remove().run();}}
 static class MediaPlayer {interface Complete{void run(MediaPlayer p);}interface Failure{boolean run(MediaPlayer p,int a,int b);}Complete ended,prepared;Failure failed;boolean released;void setDataSource(String p){}void setOnCompletionListener(Complete c){ended=c;}void setOnErrorListener(Failure f){failed=f;}void setOnPreparedListener(Complete c){prepared=c;}void prepareAsync(){}void start(){}void release(){released=true;}}
 Queue main=new Queue();Map<String,Object> pending=new HashMap<>();List<String> events=new ArrayList<>();File playbackFile;String playbackId,playbackRequestId;PluginCall preparingPlayback;MediaPlayer player;boolean destroyed;int syntheses;
 void notifyListeners(String event,JSObject data){events.add(event+":"+data.get("playbackId"));}
 void synthesizeLocalNow(PluginCall call){syntheses++;}
 void prepare(String id)throws Exception{playbackFile=File.createTempFile("native-speech-",".wav");playbackId=id;playbackRequestId="request-"+id;}
 static void check(boolean v){if(!v)throw new AssertionError();}
 ${methods}
 public static void main(String[] args)throws Exception{
  NativeSpeechHarness h=new NativeSpeechHarness();h.prepare("one");PluginCall play=new PluginCall();play.playback="one";h.play(play);h.main.flush();MediaPlayer first=h.player;first.prepared.run(first);check(play.resolved);first.ended.run(first);check(h.events.equals(List.of("playbackEnded:one")));check(h.player==null&&h.playbackId==null&&first.released);
  h.prepare("two");play=new PluginCall();play.playback="two";h.play(play);h.main.flush();MediaPlayer second=h.player;second.prepared.run(second);second.failed.run(second,0,0);check(h.events.get(1).equals("playbackFailed:two"));check(h.events.size()==2);
  h.prepare("three");h.clearPlayback();check(h.events.get(2).equals("playbackStopped:three"));h.clearPlayback();check(h.events.size()==3);
  h.prepare("new");PluginCall stop=new PluginCall();stop.request="request-old";h.stopPlayback(stop);h.main.flush();check(h.playbackId.equals("new"));check(h.events.size()==3);stop.request="request-new";h.stopPlayback(stop);h.main.flush();check(h.events.get(3).equals("playbackStopped:new"));
  h.prepare("other");PluginCall queued=new PluginCall();queued.replace=false;h.synthesizeLocal(queued);h.main.flush();check(queued.code.equals("playback-busy")&&h.syntheses==0&&h.playbackId.equals("other"));h.clearPlayback();queued=new PluginCall();queued.replace=false;h.pending.put("other",new Object());h.synthesizeLocal(queued);h.main.flush();check(queued.code.equals("playback-busy")&&h.syntheses==0);h.pending.clear();queued=new PluginCall();queued.replace=false;h.synthesizeLocal(queued);h.main.flush();check(h.syntheses==1);
  System.out.println("PASS native terminal ownership");
 }
}`);
 const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const binary=name=>java?path.join(java,'bin',name):name;
 execFileSync(binary('javac'),['--release','11','-d',directory,path.join(directory,'NativeSpeechHarness.java')],{timeout:15000,stdio:'pipe'});assert.match(execFileSync(binary('java'),['-cp',directory,'NativeSpeechHarness'],{encoding:'utf8',timeout:10000}),/^PASS native terminal ownership/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
