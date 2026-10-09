import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {nativeViewDeclarationsJson,nativeViewPolicyPath} from '../scripts/native-view-policy.mjs';

test('native launch applies exactly the packaged navigation-only policy and bounds its input',()=>{
 const policy=JSON.parse(nativeViewDeclarationsJson);assert.deepEqual(policy.map(row=>row.id),['photos','maps','camera']);for(const row of policy){assert.deepEqual(Object.keys(row).sort(),['fallbackFor','id','label','path']);assert.equal(row.path,'/'+row.id);}
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java','utf8'),start=source.indexOf(' static void configureNativeViews('),end=source.indexOf(' static void configureEnvironment(',start);assert.ok(start>=0&&end>start);const method=source.slice(start,end);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-native-views-'));const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const bin=name=>java?path.join(java,'bin',name):name;
 try{fs.writeFileSync(path.join(dir,'NativeViewsTest.java'),`import java.util.*;import java.io.*;import java.nio.file.*;public class NativeViewsTest {${method}\npublic static void main(String[] args)throws Exception{String expected=Files.readString(Path.of(args[0]));Map<String,String> env=new HashMap<>();env.put("ELIZA_NATIVE_VIEW_DECLARATIONS","untrusted inherited policy");configureNativeViews(new ByteArrayInputStream(expected.getBytes(java.nio.charset.StandardCharsets.UTF_8)),env);if(!expected.equals(env.get("ELIZA_NATIVE_VIEW_DECLARATIONS")))throw new AssertionError("Policy did not match product asset");try{configureNativeViews(new ByteArrayInputStream(new byte[16385]),env);throw new AssertionError("Oversized policy accepted");}catch(IOException correct){}if(!expected.equals(env.get("ELIZA_NATIVE_VIEW_DECLARATIONS")))throw new AssertionError("Rejected policy changed environment");System.out.println("PASS");}}`);execFileSync(bin('javac'),[path.join(dir,'NativeViewsTest.java')],{stdio:'pipe'});assert.equal(execFileSync(bin('java'),['-cp',dir,'NativeViewsTest',fileURLToPath(nativeViewPolicyPath)],{encoding:'utf8'}).trim(),'PASS');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
