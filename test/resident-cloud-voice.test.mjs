import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {execFileSync} from 'node:child_process';
function load(file,name,box){const source=fs.readFileSync('apps/app/src/'+file,'utf8').replace(/^import .*;\n/gm,'').replaceAll('export function','function').replaceAll('export type','type');vm.runInNewContext('{'+stripTypeScriptTypes(source,{mode:'transform'})+'\nglobalThis.'+name+'='+name+';}',box);}
function fixture(){
 const f={kind:'resident',account:true,platform:'android',localCalls:0,cloudCalls:0,error:null};
 const box={testMocksEnabled:false,browserDevProfile:false,Capacitor:{getPlatform:()=>f.platform},connectionController:{getCloudEnvironment:()=>f.account?'production':null,getCloudClient:()=>f.account?{sessionId:'account',credentialId:'credential'}:null,getSnapshot:()=>({kind:f.kind})},registerPlugin:()=>({}),AbortController,DOMException,console};
 load('runtime/voice-selection.ts','selectVoiceRoute',box);load('runtime/cloud-voice.ts','cloudVoiceFailure',box);
 box.createCloudVoice=()=>({speak:async()=>{f.cloudCalls++;if(f.error)throw f.error;}});
 box.createOnDeviceVoice=()=>({ready:async()=>true,speak:async()=>{f.localCalls++;}});box.planLocalSpeech=()=>[];
 load('prototype/local-speech-playback.ts','installLocalSpeechPlayback',box);
 class Shell{S(){return {chat:'sheet',msgs:[{id:'message',from:'agent',text:'Synthetic reply'}]};}setState(){}renderVals(){return {msgs:[{text:'Synthetic reply'}]};}}
 box.installLocalSpeechPlayback(Shell);f.shell=new Shell();f.box=box;return f;
}
test('production resident chooses Cloud only with a bound account; explicit local/manual and development remain',()=>{
 const f=fixture(),route=f.box.selectVoiceRoute;
 assert.equal(route(),'cloud');assert.equal(route('device'),'device');assert.equal(route('manual'),'manual');
 f.account=false;assert.equal(route(),'device');assert.equal(route('agent'),'agent');
 f.account=true;f.kind='remote';assert.equal(route(),'device');assert.equal(route('agent'),'cloud');
 f.kind='resident';f.platform='web';assert.equal(route(),'device');f.platform='android';f.box.testMocksEnabled=true;assert.equal(route(),'device');
});
test('message Listen uses Cloud and a billing error never falls back to device speech',async()=>{
 const f=fixture();f.error={code:'voice-http-402'};
 const row=f.shell.renderVals().msgs[0];assert.equal(row.localSpeechLabel,'Listen with Cloud');row.localSpeech();
 await new Promise(r=>setImmediate(r));assert.equal(f.cloudCalls,1);assert.equal(f.localCalls,0);assert.match(f.shell.renderVals().msgs[0].localSpeechMessage,/Add credits in Settings/);
});
test('local message playback remains when Cloud is not selected; auth recovery stays distinct',async()=>{
 const f=fixture();f.account=false;const row=f.shell.renderVals().msgs[0];assert.equal(row.localSpeechLabel,'Listen on phone');row.localSpeech();await new Promise(r=>setImmediate(r));assert.equal(f.localCalls,1);assert.equal(f.cloudCalls,0);
 assert.match(f.box.cloudVoiceFailure({code:'voice-http-401'}),/Sign in/);assert.match(f.box.cloudVoiceFailure({code:'voice-http-403'}),/Sign in/);assert.equal(f.box.cloudVoiceFailure({code:'voice-http-503'}),null);
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
