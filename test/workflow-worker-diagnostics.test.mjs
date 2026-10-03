import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

const cache=join(homedir(),'.gradle/caches/modules-2/files-2.1/org.json/json/20250517');
const jar=process.env.ALPHA_JSON_JAR||(existsSync(cache)?readdirSync(cache).flatMap(hash=>readdirSync(join(cache,hash)).filter(name=>name==='json-20250517.jar').map(name=>join(cache,hash,name)))[0]:undefined);
test('native tombstone projection rejects foreign or ambiguous identity and never exports trace content',{skip:!jar?'Pinned Gradle JSON dependency is unavailable':false},()=>{
 const source=readFileSync('android/app/src/androidTest/java/ai/elizaresearch/alphaphone/WorkerCrashDiagnostic.java','utf8');
 const start=source.indexOf(' static JSONObject parse(');assert.ok(start>=0);
 const temporary=mkdtempSync(join(tmpdir(),'workflow-tombstone-'));
 const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');
 const binary=name=>java?join(java,'bin',name):name;
 try{
  writeFileSync(join(temporary,'TombstoneTest.java'),`import org.json.*;import java.io.*;import java.nio.charset.StandardCharsets;public class TombstoneTest {
 static final int LIMIT=1024*1024;
 ${source.slice(start,source.lastIndexOf('}'))}
 static byte[] concat(byte[]... parts)throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();for(byte[] part:parts)out.write(part);return out.toByteArray();}
 static byte[] varint(long value){ByteArrayOutputStream out=new ByteArrayOutputStream();while(value>127){out.write((int)(value&127)|128);value>>>=7;}out.write((int)value);return out.toByteArray();}
 static byte[] number(int field,long value)throws Exception{return concat(varint(field*8),varint(value));}
 static byte[] message(int field,byte[] value)throws Exception{return concat(varint(field*8+2),varint(value.length),value);}
 static byte[] text(int field,String value)throws Exception{return message(field,value.getBytes(StandardCharsets.UTF_8));}
 static void reject(byte[] bytes)throws Exception {try{parse(bytes,123,10123);}catch(IllegalArgumentException expected){return;}throw new AssertionError("Malformed or foreign tombstone admitted");}
 public static void main(String[] ignored)throws Exception {
  byte[] identity=concat(number(1,3),number(5,123),number(7,10123));
  byte[] signal=message(10,concat(number(1,31),number(3,1)));
  byte[] cause=message(15,text(1,"seccomp prevented call to disallowed x86_64 system call 435"));
  byte[] payload=concat(identity,signal,cause,text(9,"PRIVATE_SENTINEL argv"),text(14,"PRIVATE_SENTINEL abort"),message(16,text(2,"PRIVATE_SENTINEL memory")));
  JSONObject safe=parse(payload,123,10123);
  if(safe.length()!=5||safe.getInt("seccompSyscall")!=435||safe.getInt("architecture")!=3||safe.toString().contains("PRIVATE_SENTINEL"))throw new AssertionError(safe);
  reject(concat(payload,number(5,123)));reject(concat(payload,number(7,10123)));reject(concat(payload,signal));reject(concat(payload,cause));
  reject(concat(number(5,124),number(7,10123),signal));reject(concat(number(5,123),number(7,10124),signal));
  reject(concat(identity,new byte[]{82,100,1}));reject(new byte[]{0});reject(new byte[LIMIT+1]);
  JSONObject other=parse(concat(identity,message(10,concat(number(1,11),number(3,1))),cause),123,10123);
  if(other.has("seccompSyscall"))throw new AssertionError(other);
  JSONObject arbitrary=parse(concat(identity,signal,message(15,text(1,"PRIVATE_SENTINEL 435"))),123,10123);
  if(arbitrary.has("seccompSyscall")||arbitrary.toString().contains("PRIVATE_SENTINEL"))throw new AssertionError(arbitrary);
  System.out.println("PASS bounded native tombstone projection");
 }
}`);
  execFileSync(binary('javac'),['--release','11','-cp',jar,'-d',temporary,join(temporary,'TombstoneTest.java')],{timeout:20000});
  assert.match(execFileSync(binary('java'),['-cp',temporary+':'+jar,'TombstoneTest'],{encoding:'utf8',timeout:20000}),/^PASS bounded native tombstone projection/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
test('native worker diagnostic retains only bounded exit evidence and identity checks',{skip:!jar?'Pinned Gradle JSON dependency is unavailable':false},()=>{
 const source=readFileSync('android/app/src/androidTest/java/ai/elizaresearch/alphaphone/ResidentWorkflowCrashInstrumentedTest.java','utf8');
 const start=source.indexOf(' static JSONObject safeExecutionDiagnostic'),end=source.indexOf(' private void captureMissingModelRequest',start);
 assert.ok(start>=0&&end>start);
 const temporary=mkdtempSync(join(tmpdir(),'workflow-exit-diagnostic-'));
 const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');
 const binary=name=>java?join(java,'bin',name):name;
 try{
  writeFileSync(join(temporary,'DiagnosticTest.java'),`import org.json.*;import java.util.*;public class DiagnosticTest {
${source.slice(start,end)}
 public static void main(String[] ignored)throws Exception {
  String secret="PRIVATE_SENTINEL";
  JSONObject input=new JSONObject().put("id","run").put("workflowId","workflow").put("workflowVersionId","version").put("status",secret).put("finished",true).put("error",new JSONObject().put("message",secret).put("stack",secret)).put("output",new JSONArray().put(secret)).put("events",new JSONArray().put(secret)).put("approvals",new JSONArray().put(secret)).put("reconciliation",new JSONObject().put("state",secret));
  JSONObject safe=safeExecutionDiagnostic(input,"run","workflow","version");
  if(safe.toString().contains(secret)||!safe.getBoolean("executionMatches")||safe.getInt("outputCount")!=1||!safe.getString("errorCategory").equals("unclassified"))throw new AssertionError(safe);
  for(String[] exit:new String[][]{{"17","none"},{"unknown","SIGKILL"},{"0","none"}}){
   input.put("error",new JSONObject().put("message","Smithers worker exited without a result (exit="+exit[0]+"; signal="+exit[1]+"): "+secret+"\\n"+secret));
   safe=safeExecutionDiagnostic(input,"different","workflow","version");
   if(safe.toString().contains(secret)||safe.getBoolean("executionMatches")||!safe.getString("workerExitCode").equals(exit[0])||!safe.getString("workerExitSignal").equals(exit[1]))throw new AssertionError(safe);
  }
  input.put("error",new JSONObject().put("message","Smithers worker exited without a result (exit=17; signal="+secret+")"));
  safe=safeExecutionDiagnostic(input,"run","workflow","version");
  if(safe.has("workerExitCode")||safe.toString().contains(secret))throw new AssertionError(safe);
  for(Object[] row:new Object[][]{{7,"SIGTERM"},{0,JSONObject.NULL},{999,secret},{secret,new JSONObject().put("secret",secret)}}){
   input.put("error",new JSONObject().put("message",secret).put("workerTermination",new JSONObject().put("exitCode",row[0]).put("signal",row[1]).put("output",secret)));
   safe=safeExecutionDiagnostic(input,"run","workflow","version");
   JSONObject fixed=safe.getJSONObject("workerTermination");
   if(safe.toString().contains(secret)||fixed.length()!=2)throw new AssertionError(safe);
   if(row[0].equals(7)&&(!fixed.get("exitCode").equals(7)||!fixed.getString("signal").equals("SIGTERM")))throw new AssertionError(safe);
   if(row[0].equals(999)&&(!fixed.isNull("exitCode")||!fixed.getString("signal").equals("unrecognized")))throw new AssertionError(safe);
  }
  for(boolean valid:new boolean[]{true,false}){
   JSONObject identity=new JSONObject().put("pid",valid?123:-1).put("uid",10123).put("startedAt",1791025200000L).put("argv",secret);
   input.put("error",new JSONObject().put("message",secret).put("workerTermination",new JSONObject().put("exitCode",JSONObject.NULL).put("signal","SIGSYS").put("identity",identity)));
   safe=safeExecutionDiagnostic(input,"run","workflow","version");JSONObject fixed=safe.getJSONObject("workerTermination");
   if(safe.toString().contains(secret)||fixed.has("identity")!=valid)throw new AssertionError(safe);
   if(valid&&(fixed.getJSONObject("identity").length()!=3||fixed.getJSONObject("identity").getInt("pid")!=123))throw new AssertionError(safe);
  }
  System.out.println("PASS bounded worker exit diagnostics");
 }
}`);
  execFileSync(binary('javac'),['--release','11','-cp',jar,'-d',temporary,join(temporary,'DiagnosticTest.java')],{timeout:20000});
  assert.match(execFileSync(binary('java'),['-cp',temporary+':'+jar,'DiagnosticTest'],{encoding:'utf8',timeout:20000}),/^PASS bounded worker exit diagnostics/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
