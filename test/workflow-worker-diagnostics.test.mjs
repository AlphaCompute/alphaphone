import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

const cache=join(homedir(),'.gradle/caches/modules-2/files-2.1/org.json/json/20250517');
const jar=process.env.ALPHA_JSON_JAR||(existsSync(cache)?readdirSync(cache).flatMap(hash=>readdirSync(join(cache,hash)).filter(name=>name==='json-20250517.jar').map(name=>join(cache,hash,name)))[0]:undefined);
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
  System.out.println("PASS bounded worker exit diagnostics");
 }
}`);
  execFileSync(binary('javac'),['--release','11','-cp',jar,'-d',temporary,join(temporary,'DiagnosticTest.java')],{timeout:20000});
  assert.match(execFileSync(binary('java'),['-cp',temporary+':'+jar,'DiagnosticTest'],{encoding:'utf8',timeout:20000}),/^PASS bounded worker exit diagnostics/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
