import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {resolveCloudSignatureClassifier,verifyCloudRecordingSignatures} from '../scripts/check-cloud-recording-signature.mjs';
import {voiceFakeClock} from './fixtures/shared-batch-voice.mjs';
import {cloudVoiceViewFixture} from './fixtures/cloud-voice-view.mjs';

test('production Cloud conversation discloses uploads before mic, avoids local models, and stops on account change',async()=>{
 const f=cloudVoiceViewFixture({cloudProfile:true});
 try {
  f.box.React={createElement:()=>null};f.box.VoiceActivity=()=>null;f.shell.state.chat='hidden';
  await f.shell.startVoice();
  assert.equal(f.shell.state.chat,'sheet','hidden Home entry must reveal the consent sheet');
  let view=f.renderChat();assert.equal(view.state,'idle');assert.equal(view.cloudDisclosure,true);
  assert.match(view.lines[0].t,/uploads your recordings.*plan allowance/);
  assert.equal(view.recoveryLabel,'Start Cloud voice');assert.equal(f.starts,0);assert.equal(f.localFactories,0);assert.equal(f.box.testMocksEnabled,false);
  view.recover();for(let i=0;i<20&&!f.starts;i++)await f.tick();
  assert.equal(f.starts,1);assert.equal(f.localFactories,0);assert.equal(f.pairedFactories,0);
  f.credential='different-credential';f.changed();for(let i=0;i<20;i++)await f.tick();
  assert.equal(f.uploads,0);assert.equal(f.cloudSpeech,0);assert.equal(f.sends,0);
 } finally {f.close();await f.tick();}
});
test('signed-out production Cloud speech offers sign-in without microphone or local fallback',async()=>{
 const f=cloudVoiceViewFixture({cloudProfile:true,account:null});
 try {f.box.React={createElement:()=>null};f.box.VoiceActivity=()=>null;await f.shell.startVoice();const view=f.renderChat();assert.equal(view.recoveryLabel,'Connect Eliza Cloud');view.recover();await f.tick();assert.equal(f.accountOpens,1);assert.equal(f.starts,0);assert.equal(f.localFactories,0);}finally{f.close();await f.tick();}
});
test('native production Cloud voice pins host and Cartesia; staging and other output providers fail closed',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-cloud-speech-'));
 try {const binary=name=>process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin',name):name;
 execFileSync(binary('javac'),['--release','11','-d',out,'android/app/src/main/java/ai/elizaresearch/alphaphone/CloudSpeechPolicy.java','test/fixtures/CloudSpeechPolicyTest.java']);
 assert.match(execFileSync(binary('java'),['-cp',out,'ai.elizaresearch.alphaphone.CloudSpeechPolicyTest'],{encoding:'utf8'}),/PASS Cloud speech production host and Cartesia admission/);
 const native=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaVoiceCloudPlugin.java','utf8');
 const upload=native.slice(native.indexOf('@PluginMethod public void transcribeRecording('),native.indexOf('private void submitLocal('));
 assert.match(upload,/AlphaVoicePcm\.decode\(file,\(\)->request\.cancelled\|\|destroyed\)/,'Cloud uploads real decoded PCM rather than relabelling the MPEG_4 recorder');
 assert.match(upload,/filename=\\"recording\.wav\\"\\r\\nContent-Type: audio\/wav/);
 assert.match(upload,/finally\{Arrays\.fill\(audio,\(byte\)0\);\}/,'uploaded PCM is cleared after the request body write');
 assert.match(native,/CloudSpeechPolicy\.host\(BuildConfig\.ELIZA_RUNTIME_PROFILE,BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS,environment\)/);
 assert.match(native,/if\(!paired\)CloudSpeechPolicy\.requireTtsProvider\(BuildConfig\.ELIZA_RUNTIME_PROFILE,c\.getHeaderField\("X-Eliza-TTS-Provider"\)\)/);
 const paired=native.slice(native.indexOf('private HttpURLConnection connectPaired(PluginCall call,boolean status,Pending request,boolean asr)'));
 assert.match(paired,/if\(!BuildConfig\.ELIZA_DEV_ALLOW_TEST_MOCKS\)throw new IOException\("Network speech is not enabled"\)/);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});

let fileTypeModule;
try{fileTypeModule=resolveCloudSignatureClassifier();}
catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
test('Cloud signature classifier rejects actual Android mp42 header and accepts PCM WAV',{skip:!fileTypeModule?'Prepared Cloud file-type dependency unavailable':false},async()=>{
 await verifyCloudRecordingSignatures();
});

test('real native multipart method uploads decoded WAV and clears it on credential, setup, cancellation and write failures',()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaVoiceCloudPlugin.java','utf8');
 const method=source.slice(source.indexOf('@PluginMethod public void transcribeRecording('),source.indexOf('private void submitLocal(')).replace('@PluginMethod ','');
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-cloud-wav-upload-'));
 try{
 const file=path.join(out,'CloudWavUploadTest.java');
 fs.writeFileSync(file,`import java.io.*;import java.net.*;import java.util.*;import java.nio.charset.StandardCharsets;import java.util.function.BooleanSupplier;
public class CloudWavUploadTest {
 boolean destroyed;String failure="";Exception error;Pending pending;Connection connection;Capture capture=new Capture();
 static class PluginCall{String getString(String key){return "selected-recording";}}
 static class Pending{boolean cancelled;JSObject result;}
 static class JSObject{void put(String key,Object value){}}
 static class JSONObject{JSONObject(String value){}Object get(String key){return "transcript";}}
 static class Capture{File file=new File("opaque-selected-recording");File selected(String id){return file;}}
 interface Work{void run(Pending request)throws Exception;}
 void submit(PluginCall call,Work work){pending=new Pending();try{work.run(pending);}catch(Exception e){error=e;}}
 String required(String value,int limit){return value;}
 static class AlphaVoicePcm{static byte[] last;static File selected;static byte[] decode(File file,BooleanSupplier cancelled)throws Exception{if(cancelled.getAsBoolean())throw new IOException();selected=file;last=new byte[]{82,73,70,70,0,0,0,0,87,65,86,69};return last;}}
 class Connection extends HttpURLConnection {
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();Connection()throws Exception{super(new URL("http://fixture.invalid"));}
  public void setRequestProperty(String key,String value){if(failure.equals("properties"))throw new IllegalStateException();super.setRequestProperty(key,value);}
  public OutputStream getOutputStream()throws IOException{if(failure.equals("output"))throw new IOException();if(failure.equals("write"))return new OutputStream(){public void write(int value)throws IOException{throw new IOException();}};return bytes;}
  public InputStream getInputStream(){return new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8));}
  public void connect(){}public void disconnect(){}public boolean usingProxy(){return false;}
 }
 HttpURLConnection connect(PluginCall call,String route,Pending request)throws Exception{if(!route.equals("stt"))throw new AssertionError();if(failure.equals("connect"))throw new IOException();if(failure.equals("cancel"))request.cancelled=true;return connection=new Connection();}
 void successful(HttpURLConnection c){}
 byte[] read(InputStream in,int max,Pending request)throws Exception{return in.readAllBytes();}
 ${method}
 public static void main(String[] args)throws Exception{
  for(String mode:new String[]{"","connect","properties","output","write","cancel"}){
   CloudWavUploadTest host=new CloudWavUploadTest();host.failure=mode;host.transcribeRecording(new PluginCall());
   if(AlphaVoicePcm.selected!=host.capture.file)throw new AssertionError("Selected recording changed");
   for(byte value:AlphaVoicePcm.last)if(value!=0)throw new AssertionError("Decoded PCM not cleared on "+mode);
   if(mode.isEmpty()){
    if(host.error!=null||host.pending.result==null)throw new AssertionError("Upload failed");
    String wire=host.connection.bytes.toString("ISO-8859-1");if(!wire.contains("filename=\\\"recording.wav\\\"")||!wire.contains("Content-Type: audio/wav")||!wire.contains("RIFF")||!wire.contains("WAVE")||wire.contains("ftyp"))throw new AssertionError("Wrong multipart format");
   }else if(host.error==null)throw new AssertionError("Failure was swallowed");
  }
  System.out.println("PASS real native multipart WAV upload and cleanup");
 }
}`);
 const binary=name=>process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin',name):name;
 execFileSync(binary('javac'),['--release','11','-d',out,file]);
 assert.match(execFileSync(binary('java'),['-cp',out,'CloudWavUploadTest'],{encoding:'utf8'}),/PASS real native multipart WAV upload and cleanup/);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});

test('Cloud Notes exposes only read while idle, only Stop while live, and cancels reviewed text on leaving',async()=>{
 const f=cloudVoiceViewFixture({cloudProfile:true,holdPlayback:true});
 try {
  f.box.pendingAudioDeletions=async()=>({});
  f.shell.notes={open:'qa-note',list:[{id:'qa-note',title:'QA note',body:'Reviewed text.',updatedAt:1}]};
  let view=f.render().ed;assert.equal(view.stopReading,undefined);assert.equal(typeof view.readAloud,'function');assert.match(view.cloudSpeechDisclosure,/uploads this note/);
  view.readAloud();for(let i=0;i<20&&!f.cloudSpeech;i++)await f.tick();
  assert.equal(f.cloudSpeech,1);assert.equal(f.localFactories,0);assert.equal(f.speechInputs[0].credentialId,'cloud-credential');
  view=f.render().ed;assert.equal(typeof view.stopReading,'function');assert.equal(view.readAloud,undefined);
  view.stopReading();for(let i=0;i<10;i++)await f.tick();
  assert.equal(f.activePlayback,null);view=f.render().ed;assert.equal(view.stopReading,undefined);assert.equal(typeof view.readAloud,'function');
 }finally{f.close();await f.tick();}
});

test('Cloud profile sends one credential-bound recorded turn and speaks its matching reply without local models',async()=>{
 const clock=voiceFakeClock(),f=cloudVoiceViewFixture({cloudProfile:true,clock,peak:0.5});
 try {
  f.box.React={createElement:()=>null};f.box.VoiceActivity=()=>null;
  await f.shell.startVoice();f.renderChat().recover();await clock.flush();
  await clock.advance(700);f.peak=0;await clock.advance(1200);
  assert.equal(f.uploads,1);assert.equal(f.sends,1);assert.equal(f.cloudSpeech,1);
  assert.equal(f.transcribeInput.environment,'production');assert.equal(f.transcribeInput.credentialId,'cloud-credential');
  assert.equal(f.speechInputs[0].credentialId,'cloud-credential');assert.equal(f.speechInputs[0].text,'Synthetic matching reply.');
  assert.equal(f.localFactories,0);assert.equal(f.pairedFactories,0);assert.equal(f.box.testMocksEnabled,false);
 }finally{f.close();await clock.flush();}
});
