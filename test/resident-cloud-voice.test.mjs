import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {cloudVoiceViewFixture} from './fixtures/cloud-voice-view.mjs';
const until=async(check)=>{for(let count=0;count<200;count++){if(check())return;await new Promise(resolve=>setTimeout(resolve,2));}assert.ok(check(),'Synthetic voice view did not settle');};

test('default and agent speech stay Cloud across every platform, account and development profile',()=>{
 const f=cloudVoiceViewFixture();try{
  for(const platform of ['android','ios','web'])for(const kind of ['resident','remote','cloud','offline'])for(const account of [null,'signed-in'])for(const mocks of [false,true])for(const profile of [false,true]){
   Object.assign(f,{platform,kind,account});f.box.testMocksEnabled=mocks;f.box.browserDevProfile=profile;
   assert.equal(f.box.selectVoiceRoute(),'cloud');assert.equal(f.box.selectVoiceRoute('agent'),'cloud');
   assert.equal(f.box.selectVoiceRoute('device'),mocks?'device':'cloud');assert.equal(f.box.selectVoiceRoute('manual'),mocks?'manual':'cloud');
  }
  assert.equal(f.starts,0);assert.equal(f.uploads,0);assert.equal(f.localFactories,0);
 }finally{f.close();}
});
test('unsigned message Read aloud opens the Cloud account without a local or native speech attempt',async()=>{
 const f=cloudVoiceViewFixture({account:null});try{const row=f.shell.renderVals().msgs[0];assert.equal(row.localSpeechAvailable,true);assert.equal(row.localSpeechLabel,'Read aloud');row.localSpeech();await f.tick();assert.equal(f.accountOpens,1);assert.equal(f.cloudSpeech,0);assert.equal(f.localFactories,0);assert.equal(f.localSpeech,0);assert.equal(f.starts,0);}finally{f.close();}
});
test('Cloud billing and authorization failures stay explicit and never fall back to device speech',async()=>{
 const f=cloudVoiceViewFixture();try{for(const [code,expected]of [['voice-http-402',/Add credits in Settings/],['voice-http-401',/Sign in/],['voice-http-403',/Sign in/]]){f.error={code};f.shell.renderVals().msgs[0].localSpeech();await until(()=>expected.test(f.shell.renderVals().msgs[0].localSpeechMessage));assert.equal(f.localSpeech,0);assert.equal(f.localFactories,0);}assert.equal(f.cloudSpeech,3);assert.equal(f.box.cloudVoiceFailure({code:'voice-http-503'}),null);}finally{f.close();}
});
test('unsigned recorder primary connects Cloud on every platform and never records',async()=>{
 for(const platform of ['android','ios','web'])for(const missing of ['account','credential']){const f=cloudVoiceViewFixture({platform,native:platform!=='web',...(missing==='account'?{account:null}:{credential:null})});try{f.render().record();const rec=f.render().rec;assert.equal(rec.primaryLabel,'Connect Eliza Cloud');assert.equal(rec.primaryDisabled,false);assert.equal(rec.manualChoice,false);assert.equal(rec.routeChoice,false);assert.match(rec.lines[0].t,/Sign in to Eliza Cloud/);rec.stop();await f.tick();assert.equal(f.accountOpens,1);assert.equal(f.starts,0);assert.equal(f.uploads,0);assert.equal(f.localFactories,0);assert.equal(f.pairedFactories,0);}finally{f.close();}}
});
test('signed Cloud recorder uploads only after explicit Transcribe, keeps the transcript and never sends chat',async()=>{
 const f=cloudVoiceViewFixture();try{f.render().record();assert.equal(f.render().rec.primaryLabel,'Start recording');assert.equal(f.render().rec.manualChoice,false);assert.equal(f.render().rec.routeChoice,false);assert.equal(f.starts,0);f.render().rec.stop();await until(()=>f.render().rec?.primaryLabel==='Stop recording');assert.equal(f.starts,1);assert.equal(f.uploads,0);f.render().rec.stop();await until(()=>f.render().rec?.primaryLabel==='Transcribe with Eliza Cloud');assert.equal(f.stops,1);assert.equal(f.uploads,0);f.render().rec.stop();await until(()=>f.render().rec?.review===true);assert.equal(f.uploads,1);assert.equal(f.transcribeInput.credentialId,'cloud-credential');assert.equal(f.render().rec.transcript,'Synthetic Cloud transcript');assert.equal(f.sends,0);assert.equal(f.localFactories,0);assert.equal(f.pairedFactories,0);}finally{f.close();}
});
test('Cloud account replacement retires a pending transcript and no late text reopens review',async()=>{
 const f=cloudVoiceViewFixture({holdTranscript:true});try{f.render().record();f.render().rec.stop();await until(()=>f.starts===1&&f.render().rec?.primaryLabel==='Stop recording');f.render().rec.stop();await until(()=>f.render().rec?.primaryLabel==='Transcribe with Eliza Cloud');f.render().rec.stop();await until(()=>typeof f.releaseTranscript==='function');f.account='replacement-account';f.credential='replacement-credential';f.changed();assert.equal(f.render().rec,undefined);f.releaseTranscript({text:'Late old-account transcript',local:false});await f.tick();assert.equal(f.render().rec,undefined);assert.equal(f.shell.state.draft,'');assert.equal(f.sends,0);assert.equal(f.localFactories,0);}finally{f.close();}
});
test('browser development copy cannot override the Cloud route or reveal manual/local choices',()=>{
 const f=cloudVoiceViewFixture({platform:'web',native:false});try{f.box.browserDevProfile=true;f.box.testMocksEnabled=true;f.render().record();const rec=f.render().rec;assert.equal(rec.primaryLabel,'Start recording');assert.equal(rec.primaryIcon,'official-mic-path');assert.equal(rec.manualChoice,false);assert.equal(rec.routeChoice,false);assert.match(rec.lines[0].t,/Eliza Cloud/);assert.doesNotMatch(rec.lines[0].t,/manually|without signing in|English.*runs on this device/);assert.equal(f.localFactories,0);assert.equal(f.starts,0);}finally{f.close();}
});
test('native HTTP failure retains exact status without returning response bodies',()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaVoiceCloudPlugin.java','utf8');
 const extract=start=>{const at=source.indexOf(start);assert.ok(at>=0);let depth=0;for(let i=source.indexOf('{',at);i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0)return source.slice(at,i+1);}throw Error('Unclosed');};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-voice-status-'));const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const bin=name=>java?path.join(java,'bin',name):name;
 try{fs.writeFileSync(path.join(dir,'VoiceStatusTest.java'),`import java.io.*;import java.net.*;public class VoiceStatusTest {
 ${extract(' private static final class VoiceHttpException')}
 ${extract(' private static void successful(')}
 public static void main(String[] args)throws Exception {for(int status:new int[]{200,204,401,402,403,503}){HttpURLConnection c=new HttpURLConnection(new URL("https://example.invalid")){public int getResponseCode(){return status;}public void connect(){}public void disconnect(){}public boolean usingProxy(){return false;}};try{successful(c);if(status>=300)throw new AssertionError();}catch(VoiceHttpException e){if(e.status!=status||!"Voice HTTP request failed".equals(e.getMessage()))throw new AssertionError();}}}
}`);execFileSync(bin('javac'),['-d',dir,path.join(dir,'VoiceStatusTest.java')],{timeout:15000});execFileSync(bin('java'),['-cp',dir,'VoiceStatusTest'],{timeout:15000});}finally{fs.rmSync(dir,{recursive:true,force:true});}
 assert.match(source,/request.failureCode="voice-http-"\+\(\(VoiceHttpException\)error\).status/);
});
