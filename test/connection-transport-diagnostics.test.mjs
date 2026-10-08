import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('transport diagnostic emits no exception payload and remains silent outside DEBUG',()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaConnectionPlugin.java','utf8');
 const start=source.indexOf(' private enum RequestOperation'),end=source.indexOf(' @PluginMethod public void request',start);
 assert.ok(start>=0&&end>start);
 const diagnostic=source.slice(start,end);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-connection-diagnostic-'));
 const home=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');
 const bin=name=>home?path.join(home,'bin',name):name;
 try{
 fs.writeFileSync(path.join(dir,'DiagnosticTest.java'),`public class DiagnosticTest {
 static class BuildConfig { static boolean DEBUG; }
 static class android { static class util { static class Log { static String output; static void d(String tag,String message){output=tag+":"+message;} } } }
 ${diagnostic}
 public static void main(String[] args){
  Exception failure=new java.net.SocketTimeoutException("secret-url-session-header-body");
  if(debugRequestFailure(RequestOperation.CLI_POLL,RequestStage.READ,200,failure)!=null)throw new AssertionError("Release code emitted");
  if(android.util.Log.output!=null)throw new AssertionError("Release diagnostic emitted");
  BuildConfig.DEBUG=true;
  String code=debugRequestFailure(RequestOperation.CLI_POLL,RequestStage.READ,200,failure);
  if(!"ALPHA_TRANSPORT:CLI_POLL:READ:200:java.net.SocketTimeoutException".equals(code))throw new AssertionError("Unexpected diagnostic code");
  if(!("AlphaConnection:"+code).equals(android.util.Log.output))throw new AssertionError("Unexpected diagnostic payload");
  if(android.util.Log.output.contains("secret"))throw new AssertionError("Exception payload leaked");
 }
}`);
 execFileSync(bin('javac'),['-d',dir,path.join(dir,'DiagnosticTest.java')],{timeout:15000});
 execFileSync(bin('java'),['-cp',dir,'DiagnosticTest'],{timeout:15000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('public probe admits only the closed transport diagnostic grammar',()=>{
 const source=fs.readFileSync('android/app/src/androidTest/java/ai/elizaresearch/alphaphone/PublicCloudTransportProbeInstrumentedTest.java','utf8');
 const expression=source.match(/&&\/(\^ALPHA_TRANSPORT:[^\n]+?)\/\.test\(error.code\)/);
 assert.ok(expression,'Probe diagnostic grammar exists');
 const allowed=new RegExp(expression[1]);
 assert.ok(allowed.test('ALPHA_TRANSPORT:CLI_POLL:READ:200:java.net.SocketTimeoutException'));
 assert.ok(allowed.test('ALPHA_TRANSPORT:OTHER:STATUS:-1:javax.net.ssl.SSLHandshakeException'));
 for(const code of ['secret', 'ALPHA_TRANSPORT:session-secret:READ:200:java.lang.Exception', 'ALPHA_TRANSPORT:CLI_POLL:URL:200:java.lang.Exception', 'ALPHA_TRANSPORT:CLI_POLL:READ:200:java.lang.Exception secret', 'ALPHA_TRANSPORT:CLI_POLL:READ:200:https://secret.invalid', 'ALPHA_TRANSPORT:CLI_POLL:READ:200:java.lang.Exception\nsecret'])assert.equal(allowed.test(code),false);
});
