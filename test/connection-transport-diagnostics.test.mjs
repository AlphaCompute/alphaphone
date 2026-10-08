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
  debugRequestFailure(RequestOperation.CLI_POLL,RequestStage.READ,200,failure);
  if(android.util.Log.output!=null)throw new AssertionError("Release diagnostic emitted");
  BuildConfig.DEBUG=true;
  debugRequestFailure(RequestOperation.CLI_POLL,RequestStage.READ,200,failure);
  if(!"AlphaConnection:operation=CLI_POLL stage=READ status=200 exception=java.net.SocketTimeoutException".equals(android.util.Log.output))throw new AssertionError("Unexpected diagnostic payload");
  if(android.util.Log.output.contains("secret"))throw new AssertionError("Exception payload leaked");
 }
}`);
 execFileSync(bin('javac'),['-d',dir,path.join(dir,'DiagnosticTest.java')],{timeout:15000});
 execFileSync(bin('java'),['-cp',dir,'DiagnosticTest'],{timeout:15000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
