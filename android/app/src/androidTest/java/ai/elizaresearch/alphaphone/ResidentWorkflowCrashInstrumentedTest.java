package ai.elizaresearch.alphaphone;

import android.content.Context;
import android.os.Build;
import android.os.Process;
import android.os.SystemClock;
import android.system.Os;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;
import org.junit.Assume;
import org.junit.Test;
import static org.junit.Assert.*;

/** Opt-in service-only resident test. No Activity, WebView, UI acceptance, or ordinary background-start claim. */
public final class ResidentWorkflowCrashInstrumentedTest {
 private static String readUtf8(java.nio.file.Path path)throws IOException{return new String(Files.readAllBytes(path),StandardCharsets.UTF_8);}
 private Context context;
 private JSONObject fixture;
 private JSONObject readinessTimeoutDiagnostic;
 private JSONObject apiFailureDiagnostic;

 private static String hash(byte[] bytes)throws Exception {StringBuilder value=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))value.append(String.format(Locale.ROOT,"%02x",b&255));return value.toString();}
 private static byte[] bounded(InputStream input,int max)throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;while((n=input.read(buf))!=-1){assertTrue("Input exceeds bound",out.size()+n<=max);out.write(buf,0,n);}return out.toByteArray();}
 private static String boundedHash(InputStream input,long max)throws Exception {
  MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[65536];long total=0;int count;
  while((count=input.read(buffer))!=-1){assertTrue("Input exceeds bound",count<=max-total);total+=count;digest.update(buffer,0,count);}
  StringBuilder value=new StringBuilder();for(byte b:digest.digest())value.append(String.format(Locale.ROOT,"%02x",b&255));return value.toString();
 }
 private static String fileHash(File file)throws Exception {try(InputStream in=new FileInputStream(file)){MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1)digest.update(buf,0,n);StringBuilder s=new StringBuilder();for(byte b:digest.digest())s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}}
 private String ownerBearer, ownerIdentityId;
 private JSONObject nativeCall(String path,String method,JSONObject body,String bearer)throws Exception {
  JSONObject headers=new JSONObject();if(bearer!=null)headers.put("Authorization","Bearer "+bearer);
  JSONObject args=new JSONObject().put("path",path).put("method",method).put("headers",headers).put("timeoutMs",path.startsWith("/api/auth/")?10000:120000);
  if(body!=null)args.put("body",body.toString());
  JSONObject result=new JSONObject(ElizaAgentService.requestLocalAgent(args.toString()));
  if(result.getInt("status")<200||result.getInt("status")>=300){
   String category="unrecognized";
   try{String error=new JSONObject(result.getString("body")).optString("error","");if("Not found".equals(error))category="route-not-found";else if(error.startsWith("Workflow not found"))category="workflow-record-not-found";else if("Workflow route not found".equals(error))category="workflow-route-not-found";else if("Workflow service is unavailable".equals(error)||"Workflow runtime is unavailable".equals(error))category="workflow-service-unavailable";}catch(JSONException malformed){category="non-json-error";}
   apiFailureDiagnostic=new JSONObject().put("status",result.getInt("status")).put("method",method).put("route","/api/workflow/workflows".equals(path)?"workflow-collection":"other").put("category",category);
   throw new IOException("Resident API status "+result.getInt("status")+" ("+category+")");
  }return new JSONObject(result.getString("body"));
 }
 private JSONObject request(String path,JSONObject body)throws Exception {return nativeCall(path,body==null?"GET":"POST",body,ownerBearer);}
 private static String safeBootReason(String reason) {
  if(Arrays.asList("unknown","starting","running","restarting","fatal","extract-failed","spawn-failed","missing-bun","missing-bundle","missing-launcher","missing-loader","provider-unavailable","ipc-recovery-required","ipc-recovery-retention-limit","runtime-identity-unavailable").contains(reason))return reason;
  if("request socket is accepting connections".equals(reason))return "socket-listening";
  if("local agent service is not booting and the request socket is closed".equals(reason))return "service-not-booting";
  if(reason.startsWith("agent exited:"))return "agent-exited";
  if(reason.startsWith("agent startup blocked:"))return "agent-startup-blocked";
  return "unrecognized";
 }
 private static String safeIpcRefusal(String reason) {
  String prefix="IPC recovery required: ";
  if(!reason.startsWith(prefix))return "unrecognized";
  String label=reason.substring(prefix.length());
  return Arrays.asList("IPC directory alias","IPC directory replaced","IPC entries changed","IPC entry replaced","ambiguous authenticated worker owner","another same-UID process is alive; preserve it","another startup supervisor owns the lock","current process UID mismatch","current process absent","current process changed during inventory","incomplete native worker journal","incomplete or oversized worker maps","incomplete process inventory","incomplete resident argv","incomplete resident stop inventory","invalid mapped Bun address range","invalid mapped Bun device","invalid process identity","invalid worker endpoint","invalid worker executable","invalid worker generation","malformed worker maps","malformed worker process","mapped Bun changed after challenge","mapped Bun file identity differs","mapped Bun path alias","mapped Bun was deleted","missing process start time","missing worker start time","multiple resident processes; preserve all","oversized IPC metadata","oversized process identity","packaged Bun changed during observation","packaged Bun exceeds bound","packaged Bun executable mapping absent","process identity changed","resident PID changed after signal","resident changed before signal","resident deployment alias","resident stop inventory deadline","resident stop unconfirmed; preserve processes","same-UID process identity changed","same-UID process inventory changed","supervisor lock changed","supervisor lock changed before publication","supervisor lock lost","supervisor lock replaced","too many active worker journals","too many same-UID processes","unexpected IPC entry","unreadable IPC directory","unreadable app directory","unreadable process argv","unregistered same-UID process; preserve it","untrusted owner/type/mode","untrusted packaged Bun file","untrusted process executable","untrusted recovery publication directory","untrusted worker journal","untrusted workflow state directory","worker PID/start identity differs","worker deployment differs","worker endpoint changed","worker executable identity differs","worker executable/source exceeds bound","worker inventory deadline","worker journal changed","worker journal changed before challenge","worker journal too large","worker lease challenge differs","worker lease deadline","worker lease did not reply","worker maps exceeds bound","worker metadata exceeds bound","worker path alias","worker peer identity differs","worker process changed","worker process changed after challenge","worker response exceeds bound","worker run scope differs","worker source changed","worker source hash differs","worker source scope differs","workflow inventory unavailable","workflow journal inventory exceeds bound","writable executable Bun mapping").contains(label)?label:"unrecognized";
 }
 private void captureReadinessTimeout(long started,AssertionError primary) {
  try {
   JSONObject safe=new JSONObject().put("elapsedMs",Math.max(0L,SystemClock.elapsedRealtime()-started)).put("instrumentationPid",Process.myPid()).put("bootSnapshotAvailable",false);
   readinessTimeoutDiagnostic=safe;
   JSONObject boot=ElizaAgentService.getLocalAgentBootState(context);
   String state=boot.optString("state","");safe.put("state",Arrays.asList("listening","restarting","dead","booting").contains(state)?state:"unrecognized");
   safe.put("reason",safeBootReason(boot.optString("reason","")));
   for(String key:new String[]{"socketListening","serviceActive"})if(boot.opt(key) instanceof Boolean)safe.put(key,boot.getBoolean(key));
   Object age=boot.opt("ageMs");if((age instanceof Long||age instanceof Integer)&&((Number)age).longValue()>=0)safe.put("ageMs",((Number)age).longValue());
   safe.put("bootSnapshotAvailable",true);
   // Export only known structural refusal labels, never arbitrary log details.
   File journal=new File(context.getFilesDir(),"agent/agent-restart-diagnostics.jsonl");
   if(journal.isFile()&&journal.length()<=1048576){
    String latest=null;
    try(InputStream input=new FileInputStream(journal)){
     for(String line:new String(bounded(input,1048576),StandardCharsets.UTF_8).split("\\n")){
      try{JSONObject event=new JSONObject(line);if("ipc-recovery-required".equals(event.optString("event")))latest=event.optJSONObject("details")==null?null:event.getJSONObject("details").optString("reason","");}catch(JSONException incomplete){/* Partial final journal line is not evidence. */}
     }
    }
    if(latest!=null)safe.put("ipcRefusal",safeIpcRefusal(latest));
   }
  } catch(Throwable unavailable) {
   // Diagnostic collection must not replace the original readiness assertion.
   primary.addSuppressed(new AssertionError("Sanitized readiness snapshot unavailable"));
  }
 }
 private void reportRamAdmission() {
  // Read-only fixture evidence; unavailable diagnostics must not replace service admission.
  try {
   android.app.ActivityManager manager=context.getSystemService(android.app.ActivityManager.class);
   JSONObject diagnostic=new JSONObject().put("runtimeMode",context.getSharedPreferences("CapacitorStorage",Context.MODE_PRIVATE).getString("eliza:mobile-runtime-mode",""));
   diagnostic.put("memoryInfoAvailable",manager!=null);
   if(manager!=null){
    android.app.ActivityManager.MemoryInfo memory=new android.app.ActivityManager.MemoryInfo();
    manager.getMemoryInfo(memory);
    diagnostic.put("totalMemBytes",memory.totalMem).put("availableMemBytes",memory.availMem).put("lowMemory",memory.lowMemory);
    diagnostic.put("marketedRamGb",DeviceRamTierPolicy.marketedRamGb(memory.totalMem));
    diagnostic.put("hybridAllowedByPolicy",DeviceRamTierPolicy.allowsHybridAgent(memory.totalMem));
   }
   android.os.Bundle status=new android.os.Bundle();status.putString("stream","\nResident RAM admission: "+diagnostic+"\n");
   InstrumentationRegistry.getInstrumentation().sendStatus(2,status);
  } catch(Exception unavailable) {
   // The real start below remains responsible for enforcing the production policy.
  }
 }
 /** Auth listening does not prove optional workflow routes have been registered. */
 private void awaitWorkflowRoutes(long deadline)throws Exception {
  while(SystemClock.elapsedRealtime()<deadline){
   try{request("/api/workflow/workflows",null).getJSONArray("workflows");apiFailureDiagnostic=null;return;}
   catch(IOException unavailable){int status=apiFailureDiagnostic==null?0:apiFailureDiagnostic.optInt("status");if(status!=404&&status!=503)throw unavailable;}
   SystemClock.sleep(250);
  }
  throw new AssertionError("Workflow read-only readiness deadline; creation was not attempted");
 }
 private void startAndEnroll()throws Exception {
  assertTrue(context.getSharedPreferences("CapacitorStorage",Context.MODE_PRIVATE).edit().putString("eliza:mobile-runtime-mode","cloud-hybrid").commit());
  reportRamAdmission();
  ElizaAgentService.start(context);
  long started=SystemClock.elapsedRealtime(),deadline=started+90000;
  String root=null;JSONObject status=null;
  while(SystemClock.elapsedRealtime()<deadline){
   try {
    root=ElizaAgentService.localAgentToken(context);
    if(root!=null&&!root.isEmpty()){
     status=nativeCall("/api/auth/status","GET",null,ownerBearer==null?root:ownerBearer);
     // Authenticate the current boot, retaining the already paired owner on restart.
     if(Boolean.TRUE.equals(status.opt("authenticated"))&&root.equals(ElizaAgentService.localAgentToken(context))){status.getString("instanceId");break;}
     status=null;
    }
   } catch(IOException|JSONException unavailable){status=null;}
   SystemClock.sleep(250);
  }
  if(status==null){AssertionError failure=new AssertionError("Resident service readiness deadline; inspect OS FGS admission and boot diagnostics, do not retry blindly");captureReadinessTimeout(started,failure);throw failure;}
  // Restart preserves the owner session. A bootstrap bearer cannot mint another
  // owner session after the first owner has claimed the runtime.
  if(ownerBearer!=null){
   JSONObject who=request("/api/auth/me",null);
   assertTrue("Restarted native session must match",ownerBearer.equals(who.getJSONObject("session").getString("id")));
   assertEquals(ownerIdentityId,who.getJSONObject("identity").getString("id"));
   assertEquals("owner",who.getJSONObject("identity").getString("kind"));
   awaitWorkflowRoutes(deadline);return;
  }
  // Pair-code issuance and pairing are deliberately outside readiness polling: never replay an ambiguous enrollment.
  JSONObject code=nativeCall("/api/auth/pair-code","GET",null,root);
  JSONObject paired=nativeCall("/api/auth/pair","POST",new JSONObject().put("code",code.getString("code")).put("instanceId",status.getString("instanceId")),root);
  assertEquals("owner",paired.getString("access"));assertEquals(status.getString("instanceId"),paired.getString("instanceId"));
  ownerBearer=paired.getString("token");ownerIdentityId=paired.getString("identityId");JSONObject who=request("/api/auth/me",null);
  assertTrue("Paired native session must match",ownerBearer.equals(who.getJSONObject("session").getString("id")));
  assertEquals(paired.getString("identityId"),who.getJSONObject("identity").getString("id"));
  awaitWorkflowRoutes(deadline);
 }

 private JSONObject nativeGet(String path,String bearer)throws Exception {
  JSONObject headers=new JSONObject();if(bearer!=null)headers.put("Authorization","Bearer "+bearer);
  return new JSONObject(ElizaAgentService.requestLocalAgent(new JSONObject().put("path",path).put("method","GET").put("headers",headers).put("timeoutMs",10000).toString()));
 }
 private String processStart(int pid)throws Exception {String stat=new String(Files.readAllBytes(new File("/proc/"+pid+"/stat").toPath()),StandardCharsets.UTF_8);String[] columns=stat.substring(stat.lastIndexOf(')')+2).split(" ");return columns[19];}
 private JSONObject ownedChild()throws Exception {
  List<JSONObject> matches=new ArrayList<>();File[] processes=new File("/proc").listFiles();assertNotNull(processes);
  String bundle=new File(context.getFilesDir(),"agent/agent-bundle.js").getCanonicalPath();
  for(File proc:processes){if(!proc.getName().matches("[0-9]+"))continue;
   try {if(Os.stat(proc.getPath()).st_uid!=Process.myUid())continue;
    String command=new String(Files.readAllBytes(new File(proc,"cmdline").toPath()),StandardCharsets.UTF_8);
    if(!Arrays.asList(command.split(String.valueOf((char)0))).contains(bundle))continue;
    String executable=Os.readlink(new File(proc,"exe").getPath());
    if(!fileHash(new File(executable)).equals(fixture.getString("processExecutableSha256")))continue;
    int pid=Integer.parseInt(proc.getName());matches.add(new JSONObject().put("pid",pid).put("start",processStart(pid)).put("uid",Process.myUid()).put("executableSha256",fixture.getString("processExecutableSha256")));
   } catch(IOException|android.system.ErrnoException raced) { /* Other processes may exit during observation. */ }
  }
  assertEquals("Require exactly one verified native runtime process",1,matches.size());return matches.get(0);
 }
 private void stopped(JSONObject child)throws Exception {
  long end=SystemClock.elapsedRealtime()+30000;
  while(SystemClock.elapsedRealtime()<end){boolean gone=child==null||!new File("/proc/"+child.getInt("pid")).exists();if(!gone)try{gone=!processStart(child.getInt("pid")).equals(child.getString("start"));}catch(IOException raced){gone=true;}
   JSONObject status=ElizaAgentService.getLocalAgentBootState(context);if(gone&&!status.optBoolean("socketListening")&&!status.optBoolean("serviceActive"))return;SystemClock.sleep(100);}
  fail("Resident process/socket did not stop within30s");
 }
 private JSONObject owner()throws Exception {JSONObject who=request("/api/auth/me",null);assertEquals("owner",who.getJSONObject("identity").getString("kind"));assertEquals("OWNER",who.getJSONObject("access").getString("role"));assertTrue("Native owner session mismatch",ownerBearer.equals(who.getJSONObject("session").getString("id")));who.getJSONObject("session").put("id","native-service-session");return who;}
 private JSONObject agent()throws Exception {JSONArray agents=request("/api/agents",null).getJSONArray("agents");assertEquals(1,agents.length());JSONObject agent=agents.getJSONObject(0);assertEquals("running",agent.getString("status"));return agent;}
 private static final class HeldModel implements AutoCloseable {
  final java.net.ServerSocket server=new java.net.ServerSocket(0,4,java.net.InetAddress.getByName("127.0.0.1"));
  final java.util.concurrent.CountDownLatch received=new java.util.concurrent.CountDownLatch(1),release=new java.util.concurrent.CountDownLatch(1);
  final java.util.concurrent.atomic.AtomicInteger calls=new java.util.concurrent.atomic.AtomicInteger();
  final boolean trustedResponse;volatile String requestRunId;volatile boolean expectRequest,closed;volatile Throwable failure;volatile java.net.Socket active;
  final Thread thread;
  HeldModel()throws Exception {this(false);}
  HeldModel(boolean trusted)throws Exception {trustedResponse=trusted;server.setSoTimeout(1000);thread=new Thread(()->{try{while(!closed){
   java.net.Socket accepted;try{accepted=server.accept();}catch(java.net.SocketTimeoutException wait){continue;}
   try(java.net.Socket socket=accepted){active=socket;socket.setSoTimeout(10000);ByteArrayOutputStream header=new ByteArrayOutputStream();int next,tail=0;
    while((next=socket.getInputStream().read())!=-1){header.write(next);tail=(tail<<8)|next;if(tail==0x0d0a0d0a)break;if(header.size()>16384)throw new IOException("Synthetic model header bound");}
    String text=header.toString("US-ASCII");if(!text.startsWith(trustedResponse?"POST /synthetic-survivor ":"POST /v1/chat/completions "))throw new IOException("Unexpected synthetic model route");
    int length=-1;boolean auth=false;for(String line:text.split("\r\n")){if(line.toLowerCase(Locale.ROOT).startsWith("content-length:"))length=Integer.parseInt(line.substring(15).trim());if(line.equalsIgnoreCase("Authorization: Bearer synthetic-resident-recovery-only"))auth=true;}
    if(!expectRequest||!auth||length<1||length>1048576)throw new IOException("Unexpected synthetic model envelope");
    byte[] body=socket.getInputStream().readNBytes(length);if(body.length!=length)throw new EOFException("Incomplete synthetic request");if(trustedResponse)requestRunId=new JSONObject(new String(body,StandardCharsets.UTF_8)).getString("runId");
    if(calls.incrementAndGet()!=1)throw new IOException("Lost request replayed");received.countDown();
    if(!release.await(240,java.util.concurrent.TimeUnit.SECONDS))throw new IOException("Synthetic model hold deadline");
    if(trustedResponse){byte[] bodyOut="{\"value\":1}".getBytes(StandardCharsets.US_ASCII);socket.getOutputStream().write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "+bodyOut.length+"\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));socket.getOutputStream().write(bodyOut);socket.getOutputStream().flush();}
    // Real authored RPC branch closes without success after parent death.
   } finally {active=null;}
  }}catch(Throwable error){if(!closed)failure=error;received.countDown();}},"resident-recovery-loopback");thread.setDaemon(true);thread.start();}
  public void close()throws Exception{closed=true;release.countDown();server.close();if(active!=null)active.close();thread.join(5000);assertFalse("Loopback worker stopped",thread.isAlive());}
 }
 private File control;
 private void write(File file,String value)throws Exception {try(FileOutputStream out=new FileOutputStream(file)){out.write(value.getBytes(StandardCharsets.UTF_8));out.getFD().sync();}Os.chmod(file.getPath(),0600);}
 private void untilFile(File file,long ms)throws Exception {long end=SystemClock.elapsedRealtime()+ms;while(!file.isFile()&&SystemClock.elapsedRealtime()<end)SystemClock.sleep(100);assertTrue("Fixture witness deadline",file.isFile());}
 private String source(boolean rpc) {return rpc?"/** @jsxImportSource smthrs */\nimport {createSmithers} from 'smthrs/create';\nimport {z} from 'zod';\nconst {Workflow,Task,smithers,outputs}=createSmithers({output:z.object({value:z.number()})},{dbPath:process.env.ELIZA_SMTHRS_DB_PATH});\nexport default smithers(()=><Workflow name=\"pending-rpc\"><Task id=\"effect\" output={outputs.output} agent={globalThis.__elizaSmithers.agent} retries={0}>synthetic-resident-recovery-only return value one</Task></Workflow>);\n":"/** @jsxImportSource smthrs */\nimport {createSmithers} from 'smthrs/create';\nimport {read,write} from 'smthrs';\nimport {z} from 'zod';\nconst {Workflow,Task,smithers,outputs}=createSmithers({output:z.object({value:z.number()})},{dbPath:process.env.ELIZA_SMTHRS_DB_PATH});\nconst agent={id:'synthetic-local-tools',generate:async()=>{\n if(!read.execute||!write.execute)throw Error('Public file tools unavailable');\n const options={toolCallId:'synthetic-recovery',messages:[],context:{}};\n const previous=await read.execute({path:'recovery-effect'},options);\n if(typeof previous!=='string'||!/^[0-9]+$/.test(previous))throw Error('Invalid effect witness');\n await write.execute({path:'recovery-effect',content:String(Number(previous)+1)},options);\n await write.execute({path:'recovery-ready',content:'ready'},options);\n const release=await read.execute({path:'recovery-release'},options);\n if(release!=='release')throw Error('Invalid fixture release');\n return {text:JSON.stringify({value:1})};\n}};\nexport default smithers(()=><Workflow name=\"survivor\"><Task id=\"effect\" output={outputs.output} agent={agent} retries={0}>Synthetic local tool effect</Task></Workflow>);\n";}
 private void releaseLocal(boolean required)throws Exception {
  if(control==null){if(required)throw new IOException("Missing workflow control root");return;}
  File fifo=new File(control,"recovery-release");if(!fifo.exists()){if(required)throw new IOException("Missing release FIFO");return;}
  long end=SystemClock.elapsedRealtime()+(required?10000:2000);
  do {java.io.FileDescriptor fd=null;try{fd=Os.open(fifo.getPath(),android.system.OsConstants.O_WRONLY|android.system.OsConstants.O_NONBLOCK,0);byte[] data="release".getBytes(StandardCharsets.US_ASCII);assertEquals(data.length,Os.write(fd,data,0,data.length));return;}
   catch(android.system.ErrnoException error){if(error.errno!=android.system.OsConstants.ENXIO)throw error;if(!required)return;SystemClock.sleep(50);}finally{if(fd!=null)Os.close(fd);}
  }while(SystemClock.elapsedRealtime()<end);throw new IOException("Release FIFO reader deadline");
 }
 // Only fixed-schema diagnostic values cross into retained CI evidence. Never retain prompts,
 // model bodies, credential-bearing errors, stacks, event payloads or arbitrary owner paths.
 static JSONObject safeExecutionDiagnostic(JSONObject value,String executionId,String workflowId,String version)throws Exception {
  JSONObject safe=new JSONObject().put("executionMatches",executionId.equals(value.optString("id")))
   .put("workflowMatches",workflowId.equals(value.optString("workflowId")))
   .put("versionMatches",version.equals(value.optString("workflowVersionId")));
  String status=value.optString("status","");safe.put("status",Arrays.asList("cancelled","continued","failed","finished","paused","queued","running","waiting-approval","waiting-event","waiting-quota","waiting-timer").contains(status)?status:"unrecognized");
  if(value.opt("finished") instanceof Boolean)safe.put("finished",value.getBoolean("finished"));
  JSONObject reconciliation=value.optJSONObject("reconciliation");String state=reconciliation==null?"":reconciliation.optString("state","");
  safe.put("reconciliation",Arrays.asList("worker-running","outcome-unknown").contains(state)?state:"absent-or-unrecognized");
  for(String key:new String[]{"events","output","approvals"}){JSONArray items=value.optJSONArray(key);if(items!=null)safe.put(key+"Count",items.length());}
  JSONObject error=value.optJSONObject("error");safe.put("errorPresent",error!=null);
  if(error!=null){String message=error.optString("message","");String category="unclassified";
   for(String known:new String[]{"Smithers worker exited without a result","Workflow source digest mismatch","Default export is not a Smithers workflow","Workflow source publication identity mismatch","Workflow device dispatcher unavailable","Parent unavailable; model request not sent"})if(known.equals(message)){category=known;break;}
   safe.put("errorCategory",category);
  }
  return safe;
 }
 private void captureMissingModelRequest(JSONObject proof,HeldModel model,String executionId,String workflowId,String version,AssertionError primary) {
  try {
   JSONObject safe=new JSONObject().put("requestCount",model.calls.get()).put("loopbackFailurePresent",model.failure!=null).put("executionReadAvailable",false);
   proof.put("missingModelRequest",safe);
   // Inspect only the exact submitted workflow journal, never recursively scan or adopt a worker.
   try {
    File journal=new File(control,".worker-owners/"+hash(executionId.getBytes(StandardCharsets.UTF_8))+"/owner.json");
    if(!journal.getCanonicalPath().equals(journal.getAbsolutePath()))throw new IOException("Journal alias");
    safe.put("ownerJournalPresent",journal.isFile());
    if(journal.isFile()){
     JSONObject record;try(InputStream in=new FileInputStream(journal)){record=new JSONObject(new String(bounded(in,16384),StandardCharsets.UTF_8));}
     safe.put("ownerJournalRunMatches",executionId.equals(record.optString("runId"))).put("ownerJournalVersionMatches",version.equals(record.optString("versionId")))
      .put("ownerJournalUidMatches",record.optInt("uid",-1)==Process.myUid());
     JSONObject identity=record.optJSONObject("nativeIdentity");int pid=record.optInt("pid",-1);
     if(identity!=null&&pid>0&&identity.optInt("pid",-1)==pid&&identity.optInt("uid",-1)==Process.myUid()){
      File proc=new File("/proc/"+pid);safe.put("ownerProcessPresent",proc.isDirectory());
      if(proc.isDirectory())safe.put("ownerProcessUidMatches",Os.stat(proc.getPath()).st_uid==Process.myUid()).put("ownerProcessStartMatches",processStart(pid).equals(identity.optString("startTicks")));
     }
    }
   }catch(Throwable unavailable){safe.put("ownerJournalObservationUnavailable",true);}
   JSONObject args=new JSONObject().put("path","/api/workflow/executions/"+executionId).put("method","GET")
    .put("headers",new JSONObject().put("Authorization","Bearer "+ownerBearer)).put("timeoutMs",3000);
   JSONObject response=new JSONObject(ElizaAgentService.requestLocalAgent(args.toString()));
   safe.put("httpStatus",response.getInt("status"));
   String body=response.optString("body","");if(body.length()>65536){safe.put("bodyExceedsDiagnosticBound",true);return;}
   if(response.getInt("status")==200){JSONObject value=new JSONObject(body).getJSONObject("execution");safe.put("execution",safeExecutionDiagnostic(value,executionId,workflowId,version)).put("executionReadAvailable",true);}
  } catch(Throwable unavailable){primary.addSuppressed(new AssertionError("Sanitized execution snapshot unavailable"));}
 }
 private JSONObject execution(String id)throws Exception{return request("/api/workflow/executions/"+id,null).getJSONObject("execution");}
 private File findOwner(File root,String run)throws Exception {
  File[] children=root.listFiles();if(children==null)return null;String key=hash(run.getBytes(StandardCharsets.UTF_8));
  for(File file:children){if(Files.isSymbolicLink(file.toPath()))throw new IOException("Fixture state alias");if(file.isDirectory()){File candidate=new File(file,".worker-owners/"+key+"/owner.json");if(candidate.isFile())return candidate;}}
  for(File file:children)if(file.isDirectory()){File candidate=findOwner(file,run);if(candidate!=null)return candidate;}return null;
 }
 private String executableLabel(String value)throws Exception {
  if(value==null)return "<unavailable>";
  String nativeRoot=new File(context.getApplicationInfo().nativeLibraryDir).getCanonicalPath();
  String base=new File(value).getName();
  if(value.length()<=768&&value.matches("[A-Za-z0-9_./=+~-]+")&&value.startsWith(nativeRoot+"/")&&Arrays.asList("libeliza_bun.so","libeliza_ld_musl_aarch64.so","libeliza_ld_musl_aarch64_real.so","libeliza_ld_musl_x86_64.so","libeliza_ld_musl_x86_64_real.so").contains(base))return value;
  if(Arrays.asList("/apex/com.android.runtime/bin/linker64","/system/bin/linker64","/system/bin/app_process64").contains(value))return value;
  return "<unrecognized executable path; chars="+value.length()+">";
 }
 private JSONObject workerDiagnostic(JSONObject record,WorkflowSurvivorInventory.Identity worker,File bun,File loader,String expectedHash)throws Exception {
  JSONObject out=new JSONObject().put("schemaVersion",1).put("runId",fixture.getString("runId")).put("phase","worker-witness-binding").put("guardRelaxed",false);
  out.put("ownerExecutable",executableLabel(record==null?null:record.optString("executable",null)));
  out.put("expectedBun",executableLabel(bun.getCanonicalPath())).put("expectedLoader",executableLabel(loader.getCanonicalPath())).put("expectedLoaderSha256",expectedHash==null?JSONObject.NULL:expectedHash);
  if(worker==null)return out.put("observedIdentity","unavailable");
  out.put("deploymentComparisons",new JSONObject().put("ownerExecutableEqualsExpectedBun",record!=null&&bun.getCanonicalPath().equals(record.optString("executable"))).put("observedExecutableEqualsExpectedLoader",loader.getCanonicalPath().equals(worker.executable)).put("observedHashEqualsExpectedLoader",expectedHash!=null&&expectedHash.equals(worker.sha256)));
  out.put("observed",new JSONObject().put("pid",worker.pid).put("uid",worker.uid).put("startTicks",worker.start).put("executable",executableLabel(worker.executable)).put("device",worker.device).put("inode",worker.inode).put("sha256",worker.sha256));
  // Never serialize the owner journal, capability, environment, inline script, or arbitrary argv.
  JSONArray argv=new JSONArray();byte[] bytes;try(InputStream in=new FileInputStream(new File("/proc/"+worker.pid+"/cmdline"))){bytes=in.readNBytes(8193);}catch(Exception unavailable){return out.put("argvUnavailable",true);}
  boolean truncated=bytes.length>8192;int limit=Math.min(bytes.length,8192),start=0,entries=0;String workflowRoot=null;
  if(record!=null){String sourcePath=record.optString("sourcePath","");File sourceFile=new File(sourcePath);if(sourcePath.startsWith(new File(context.getFilesDir(),".eliza/smthrs").getCanonicalPath()+"/")&&sourcePath.length()<1024)workflowRoot=sourceFile.getParent();}
  for(int i=0;i<limit&&entries<16;i++)if(bytes[i]==0){String arg=new String(bytes,start,i-start,StandardCharsets.UTF_8),label=executableLabel(arg);JSONObject item=new JSONObject().put("index",entries).put("bytes",i-start);
   if(!label.startsWith("<"))item.put("kind","known-executable").put("value",label);
   else if(Arrays.asList("-e","--eval","--library-path","--no-install").contains(arg))item.put("kind","known-flag").put("value",arg);
   else if(workflowRoot!=null&&(arg.equals(workflowRoot+"/trusted-worker.mjs")||arg.equals(workflowRoot+"/trusted-payload.json")||arg.equals(workflowRoot+"/trusted-replay-payload.json")))item.put("kind","expected-test-file").put("basename",new File(arg).getName());
   else item.put("kind","redacted");argv.put(item);entries++;start=i+1;
  }
  out.put("argv",argv).put("argvTruncated",truncated||start<limit||entries>=16).put("expectedTestArgv",new JSONArray().put("packaged loader wrapper").put("packaged Bun").put("trusted-worker.mjs").put("trusted-payload.json or trusted-replay-payload.json"));return out;
 }
 private WorkflowSurvivorInventory.Identity witness(File journal)throws Exception {
  JSONObject record=null;WorkflowSurvivorInventory.Identity worker=null;String expectedHash=null;
  File bun=new File(context.getApplicationInfo().nativeLibraryDir,"libeliza_bun.so"),loader=new File(context.getApplicationInfo().nativeLibraryDir,Build.SUPPORTED_ABIS[0].equals("arm64-v8a")?"libeliza_ld_musl_aarch64_real.so":"libeliza_ld_musl_x86_64_real.so");
  try {
   record=new JSONObject(readUtf8(journal.toPath()));worker=WorkflowSurvivorInventory.processIdentity(record.getInt("pid"));expectedHash=fileHash(loader);
   WorkflowSurvivorInventory.verify(journal,record,worker,context.getFilesDir().getCanonicalFile(),bun.getCanonicalPath(),loader.getCanonicalPath(),expectedHash,SystemClock.elapsedRealtime()+5000);return worker;
  }catch(Exception failure){
   try{write(new File(context.getFilesDir(),"resident-recovery-identity.json"),workerDiagnostic(record,worker,bun,loader,expectedHash).toString());}catch(Exception diagnosticFailure){failure.addSuppressed(diagnosticFailure);}throw failure;
  }
 }
 private void exactAlive(WorkflowSurvivorInventory.Identity worker)throws Exception {assertEquals(worker.key(),WorkflowSurvivorInventory.processIdentity(worker.pid).key());}
 private void crash(JSONObject resident)throws Exception {
  int pid=resident.getInt("pid");assertTrue(pid!=Process.myPid());assertEquals(Process.myUid(),Os.stat("/proc/"+pid).st_uid);assertEquals(resident.getString("start"),processStart(pid));assertEquals(fixture.getString("processExecutableSha256"),fileHash(new File("/proc/"+pid+"/exe")));
  assertEquals(resident.getString("start"),processStart(pid));assertEquals(Process.myUid(),Os.stat("/proc/"+pid).st_uid);String bundle=new File(context.getFilesDir(),"agent/agent-bundle.js").getCanonicalPath();assertTrue(Arrays.asList(new String(Files.readAllBytes(new File("/proc/"+pid+"/cmdline").toPath()),StandardCharsets.UTF_8).split(String.valueOf((char)0))).contains(bundle));
  Os.kill(pid,android.system.OsConstants.SIGKILL);
  long end=SystemClock.elapsedRealtime()+10000;while(SystemClock.elapsedRealtime()<end){if(!new File("/proc/"+pid).exists())return;try{if(!resident.getString("start").equals(processStart(pid)))return;}catch(IOException gone){return;}SystemClock.sleep(100);}throw new AssertionError("Owned resident did not die");
 }
 private void effectOnce()throws Exception{assertEquals("1",readUtf8(new File(control,"recovery-effect").toPath()));}
 // Deferred: read/write unsupported by mobile authoring facade; retained historical design, not an executable test.
 public void residentCrashPreservesWorkerAndCanonicalResult()throws Throwable {runCase(false);}
 @Test public void lostParentModelRpcRemainsUnknownWithoutReplay()throws Throwable {runCase(true);}
 private void runCase(boolean rpc)throws Throwable {
  Assume.assumeTrue("Explicit resident crash fixture", "1".equals(InstrumentationRegistry.getArguments().getString("residentCrash")));
  assertTrue(BuildConfig.DEBUG);assertTrue(Process.myUid()/100000>0);assertTrue(Arrays.asList("arm64-v8a","x86_64").contains(Build.SUPPORTED_ABIS[0]));
  context=InstrumentationRegistry.getInstrumentation().getTargetContext();assertTrue(context.getSystemService(android.os.UserManager.class).isUserUnlocked());
  String run=InstrumentationRegistry.getArguments().getString("residentRunId","");assertTrue(run.matches("[0-9a-f-]{36}"));
  File input=new File(context.getFilesDir(),"resident-recovery-input.json");assertEquals(Process.myUid(),Os.stat(input.getPath()).st_uid);assertEquals(0,Os.stat(input.getPath()).st_mode&0077);try(InputStream in=new FileInputStream(input)){fixture=new JSONObject(new String(bounded(in,16384),StandardCharsets.UTF_8));}assertEquals(run,fixture.getString("runId"));assertEquals(Build.SUPPORTED_ABIS[0],fixture.getString("abi"));assertTrue(input.delete());
  File bun=new File(context.getApplicationInfo().nativeLibraryDir,"libeliza_bun.so");assertEquals(fixture.getString("bunSha256"),fileHash(bun));try(InputStream in=context.getAssets().open("agent/agent-bundle.js")){assertEquals(fixture.getString("bundleSha256"),boundedHash(in,128L*1024*1024));}try(InputStream in=context.getAssets().open("agent/alpha-source.json")){assertEquals(fixture.getString("sourceSha256"),boundedHash(in,8L*1024*1024));}
  assertNull(new AlphaCredentialStore(context).readCredentialSlot("local-agent-provider:v1"));assertFalse(ElizaAgentService.getLocalAgentBootState(context).optBoolean("socketListening"));
  control=null;
  JSONObject proof=new JSONObject().put("passed",false).put("runId",run).put("case",rpc?"lost-rpc":"local-survivor");Throwable failure=null;JSONObject resident=null;WorkflowSurvivorInventory.Identity worker=null;boolean submitted=false;
  java.lang.reflect.Field hook=AlphaLocalAgentPlugin.class.getDeclaredField("instrumentationRecoveryEndpoint");hook.setAccessible(true);assertNull(hook.get(null));
  try(HeldModel model=new HeldModel()) {
   hook.set(null,model.server);
   try {
    new AlphaCredentialStore(context).writeCredentialSlot("local-agent-provider:v1",new JSONObject().put("key","synthetic-resident-recovery-only").put("model","qwen-3.8-27b").toString());
    startAndEnroll();resident=ownedChild();String ownerId=owner().getJSONObject("identity").getString("id"),agentId=agent().getString("id");
    String module=source(rpc),digest=hash(module.getBytes(StandardCharsets.UTF_8));JSONObject workflow=request("/api/workflow/workflows",new JSONObject().put("name","Synthetic crash "+run).put("source",module).put("language","tsx").put("steps",new JSONArray()).put("widgets",new JSONArray()).put("activate",true));
    String workflowId=workflow.getString("id"),version=workflow.getString("versionId"),submission=UUID.randomUUID().toString();model.expectRequest=rpc;
    assertTrue(agentId.matches("[a-zA-Z0-9_.-]+")&&workflowId.matches("[a-zA-Z0-9_.-]+"));control=new File(context.getFilesDir(),".eliza/smthrs/"+agentId+"/"+workflowId);assertEquals(control.getPath(),control.getCanonicalPath());if(!control.isDirectory())assertTrue(control.mkdirs());Os.chmod(control.getPath(),0700);assertFalse(new File(control,"recovery-effect").exists());write(new File(control,"recovery-effect"),"0");if(!rpc)Os.mkfifo(new File(control,"recovery-release").getPath(),0600);
    submitted=true;JSONObject accepted=request("/api/workflow/workflows/"+workflowId+"/run",new JSONObject().put("submissionId",submission).put("expectedVersionId",version).put("input",new JSONObject())).getJSONObject("execution");String executionId=accepted.getString("id");
    if(rpc){if(!model.received.await(60,java.util.concurrent.TimeUnit.SECONDS)){AssertionError timeout=new AssertionError("Synthetic model request deadline; inspect sanitized execution snapshot");captureMissingModelRequest(proof,model,executionId,workflowId,version,timeout);throw timeout;}assertNull(model.failure);assertEquals(1,model.calls.get());}else{untilFile(new File(control,"recovery-ready"),60000);effectOnce();}File journal=findOwner(new File(context.getFilesDir(),".eliza/smthrs"),executionId);assertNotNull("Real owner journal",journal);worker=witness(journal);JSONObject ownerRecord=new JSONObject(readUtf8(journal.toPath()));assertEquals(digest,ownerRecord.getString("sourceSha256"));assertEquals(version,ownerRecord.getString("versionId"));assertEquals(executionId,ownerRecord.getString("runId"));
    if(rpc){assertTrue(model.received.await(30,java.util.concurrent.TimeUnit.SECONDS));assertNull(model.failure);assertEquals(1,model.calls.get());}else {assertEquals(0,model.calls.get());assertNull(model.failure);}
    long oldIpc=Os.lstat(new File(context.getFilesDir(),"ipc").getPath()).st_ino;JSONObject oldResident=resident;assertNotEquals(worker.pid,resident.getInt("pid"));crash(resident);resident=null;
    if(!rpc)exactAlive(worker);else model.release.countDown();
    startAndEnroll();resident=ownedChild();assertNotEquals(oldResident.getInt("pid"),resident.getInt("pid"));assertEquals(ownerId,owner().getJSONObject("identity").getString("id"));assertEquals(agentId,agent().getString("id"));assertNotEquals(oldIpc,Os.lstat(new File(context.getFilesDir(),"ipc").getPath()).st_ino);
    boolean retained=false;File[] evidence=context.getFilesDir().listFiles(f->f.getName().startsWith("ipc-recovery-"));assertNotNull(evidence);for(File directory:evidence)if(Os.lstat(directory.getPath()).st_ino==oldIpc)retained=true;assertTrue("Old IPC generation preserved",retained);
    if(!rpc){assertEquals(worker.key(),witness(journal).key());exactAlive(worker);
     JSONObject repeated=request("/api/workflow/workflows/"+workflowId+"/run",new JSONObject().put("submissionId",submission).put("expectedVersionId",version).put("input",new JSONObject())).getJSONObject("execution");assertEquals(executionId,repeated.getString("id"));effectOnce();releaseLocal(true);}
    long deadline=SystemClock.elapsedRealtime()+45000;JSONObject result=null;
    while(SystemClock.elapsedRealtime()<deadline){result=execution(executionId);if(rpc?"outcome-unknown".equals(result.optJSONObject("reconciliation")==null?"":result.getJSONObject("reconciliation").optString("state")):result.optBoolean("finished"))break;SystemClock.sleep(250);}
    assertNotNull(result);assertEquals(workflowId,result.getString("workflowId"));assertEquals(version,result.getString("workflowVersionId"));if(!rpc)effectOnce();
    if(rpc){assertEquals("outcome-unknown",result.getJSONObject("reconciliation").getString("state"));assertEquals(1,model.calls.get());assertFalse(result.optBoolean("finished"));}
    else {assertTrue(result.getBoolean("finished"));assertFalse(result.has("reconciliation"));assertEquals(1,result.getJSONArray("output").length());JSONObject row=result.getJSONArray("output").getJSONObject(0);assertEquals(1,row.getInt("value"));assertEquals(executionId,row.getString("runId"));assertEquals("effect",row.getString("nodeId"));assertEquals(0,row.getInt("iteration"));assertEquals(0,model.calls.get());}
    assertNull(model.failure);String output=rpc?null:result.get("output").toString();
    // Wait for worker exit before any service stop; never stop a legitimate survivor.
    long workerDeadline=SystemClock.elapsedRealtime()+15000;while(new File("/proc/"+worker.pid).exists()&&SystemClock.elapsedRealtime()<workerDeadline){if(!worker.start.equals(processStart(worker.pid)))break;SystemClock.sleep(100);}if(new File("/proc/"+worker.pid).exists())assertNotEquals("Original worker must settle before stop",worker.start,processStart(worker.pid));
    // Second native restart proves durable projection instead of a first-process in-memory result.
    ElizaAgentService.stop(context);stopped(resident);resident=null;startAndEnroll();resident=ownedChild();JSONObject persisted=execution(executionId);if(!rpc)effectOnce();
    if(rpc){assertEquals("outcome-unknown",persisted.getJSONObject("reconciliation").getString("state"));assertEquals(1,model.calls.get());}else assertEquals(output,persisted.get("output").toString());
    proof.put("firstProcess",oldResident).put("secondProcess",resident).put("oldIpcPreserved",retained).put("workflowId",workflowId).put("workflowVersionId",version).put("executionId",executionId).put("sourceSha256",digest).put("workerPid",worker.pid).put("workerStartTicks",worker.start).put("effectCount",rpc?JSONObject.NULL:1).put("modelRequests",model.calls.get()).put("passed",true);
   } catch(Throwable error){failure=error;}
   finally {
    try {if(!rpc)releaseLocal(false);model.release.countDown();if(submitted&&worker==null)throw new IOException("Submitted worker identity unobserved; preserve for disposable-user teardown");boolean workerGone=worker==null;long end=SystemClock.elapsedRealtime()+20000;while(!workerGone&&SystemClock.elapsedRealtime()<end){try{workerGone=!worker.key().equals(WorkflowSurvivorInventory.processIdentity(worker.pid).key());}catch(Exception gone){workerGone=!new File("/proc/"+worker.pid).exists();}if(!workerGone)SystemClock.sleep(100);}if(!workerGone)throw new IOException("Owned worker remains alive; preserve for disposable-user teardown");ElizaAgentService.stop(context);stopped(resident);proof.put("cleanupComplete",true);}
    catch(Throwable cleanup){if(failure==null)failure=cleanup;else failure.addSuppressed(cleanup);proof.put("cleanupFailed",true);}
    finally {hook.set(null,null);ownerBearer=null;ownerIdentityId=null;}
   }
  } catch(Throwable outer){if(failure==null)failure=outer;else failure.addSuppressed(outer);}
  proof.put("passed",failure==null&&proof.optBoolean("passed"));try{if(readinessTimeoutDiagnostic!=null)proof.put("readinessTimeoutDiagnostic",readinessTimeoutDiagnostic);if(apiFailureDiagnostic!=null)proof.put("apiFailureDiagnostic",apiFailureDiagnostic);write(new File(context.getFilesDir(),"resident-recovery-complete.json"),proof.toString());}catch(Throwable outputFailure){if(failure==null)failure=outputFailure;else failure.addSuppressed(outputFailure);}if(failure!=null)throw failure;
 }
 @Test public void trustedPackagedWorkerSurvivesResidentRestart()throws Throwable {
  Assume.assumeTrue("Explicit trusted worker fixture", "1".equals(InstrumentationRegistry.getArguments().getString("residentCrash")));
  assertTrue(BuildConfig.DEBUG);assertTrue(Process.myUid()/100000>0);assertTrue(Arrays.asList("arm64-v8a","x86_64").contains(Build.SUPPORTED_ABIS[0]));
  context=InstrumentationRegistry.getInstrumentation().getTargetContext();assertTrue(context.getSystemService(android.os.UserManager.class).isUserUnlocked());
  String run=InstrumentationRegistry.getArguments().getString("residentRunId","");assertTrue(run.matches("[0-9a-f-]{36}"));File input=new File(context.getFilesDir(),"resident-recovery-input.json");assertEquals(Process.myUid(),Os.stat(input.getPath()).st_uid);assertEquals(0,Os.stat(input.getPath()).st_mode&0077);try(InputStream in=new FileInputStream(input)){fixture=new JSONObject(new String(bounded(in,16384),StandardCharsets.UTF_8));}assertEquals(run,fixture.getString("runId"));assertEquals(Build.SUPPORTED_ABIS[0],fixture.getString("abi"));assertTrue(input.delete());
  File bun=new File(context.getApplicationInfo().nativeLibraryDir,"libeliza_bun.so");assertEquals(fixture.getString("bunSha256"),fileHash(bun));try(InputStream in=context.getAssets().open("agent/agent-bundle.js")){assertEquals(fixture.getString("bundleSha256"),boundedHash(in,128L*1024*1024));}try(InputStream in=context.getAssets().open("agent/alpha-source.json")){assertEquals(fixture.getString("sourceSha256"),boundedHash(in,8L*1024*1024));}
  assertNull(new AlphaCredentialStore(context).readCredentialSlot("local-agent-provider:v1"));assertFalse(ElizaAgentService.getLocalAgentBootState(context).optBoolean("socketListening"));
  JSONObject proof=new JSONObject().put("passed",false).put("runId",run).put("case","trusted-survivor").put("scope","instrumentation-created worker; no resident-created ancestry or authored parent-RPC survival claim");Throwable failure=null;JSONObject resident=null,replacement=null;TrustedPackagedWorker trusted=null;
  java.lang.reflect.Field hook=AlphaLocalAgentPlugin.class.getDeclaredField("instrumentationRecoveryEndpoint");hook.setAccessible(true);assertNull(hook.get(null));
  try(HeldModel model=new HeldModel(true)){
   hook.set(null,model.server);
   try{
    new AlphaCredentialStore(context).writeCredentialSlot("local-agent-provider:v1",new JSONObject().put("key","synthetic-resident-recovery-only").put("model","qwen-3.8-27b").toString());startAndEnroll();resident=ownedChild();String ownerId=owner().getJSONObject("identity").getString("id"),agentId=agent().getString("id");
    String module=source(true);JSONObject workflow=request("/api/workflow/workflows",new JSONObject().put("name","Trusted survivor source "+run).put("source",module).put("language","tsx").put("steps",new JSONArray()).put("widgets",new JSONArray()).put("activate",false));
    String script;try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("trusted-worker.mjs")){script=new String(bounded(in,524288),StandardCharsets.UTF_8);}assertEquals(fixture.getString("trustedWorkerSha256"),hash(script.getBytes(StandardCharsets.UTF_8)));
    File workerResources=new File(context.getFilesDir(),"agent/workflow-worker");assertEquals(fixture.getString("workerIndexSha256"),fileHash(new File(workerResources,"files.sha256")));assertEquals(fixture.getString("workerManifestSha256"),fileHash(new File(workerResources,"manifest.json")));assertEquals(fixture.getString("compilerManifestSha256"),fileHash(new File(workerResources,"compiler/compiler.json")));
    model.expectRequest=true;trusted=new TrustedPackagedWorker(context,new File(context.getFilesDir(),"agent/workflow-worker"),module,script,fixture.getString("trustedWorkerSha256"),model.server,workflow.getString("id"));
    assertTrue(model.received.await(45,java.util.concurrent.TimeUnit.SECONDS));assertNull(model.failure);assertEquals(1,model.calls.get());assertEquals(trusted.runId,model.requestRunId);untilFile(trusted.journal,5000);WorkflowSurvivorInventory.Identity worker=witness(trusted.journal);assertNotEquals(resident.getInt("pid"),worker.pid);
    long oldIpc=Os.lstat(new File(context.getFilesDir(),"ipc").getPath()).st_ino;JSONObject original=resident;crash(resident);resident=null;exactAlive(worker);startAndEnroll();resident=ownedChild();replacement=resident;assertEquals(ownerId,owner().getJSONObject("identity").getString("id"));assertEquals(agentId,agent().getString("id"));assertNotEquals(original.getInt("pid"),resident.getInt("pid"));assertEquals(worker.key(),witness(trusted.journal).key());assertNotEquals(oldIpc,Os.lstat(new File(context.getFilesDir(),"ipc").getPath()).st_ino);
    boolean retained=false;File[] generations=context.getFilesDir().listFiles(f->f.getName().startsWith("ipc-recovery-"));assertNotNull(generations);for(File generation:generations)if(Os.lstat(generation.getPath()).st_ino==oldIpc)retained=true;assertTrue(retained);assertEquals(1,model.calls.get());
    // Explicit service stop must preserve the same live shared-runtime worker too.
    ElizaAgentService.stop(context);stopped(resident);resident=null;exactAlive(worker);
    startAndEnroll();resident=ownedChild();assertEquals(worker.key(),witness(trusted.journal).key());
    assertEquals(ownerId,owner().getJSONObject("identity").getString("id"));assertEquals(agentId,agent().getString("id"));
    proof.put("explicitStopPreservedWorker",true);
    model.release.countDown();JSONObject result=trusted.finish();assertNull(model.failure);assertEquals(1,model.calls.get());String output=result.getJSONArray("output").toString();trusted.close();
    ElizaAgentService.stop(context);stopped(resident);resident=null;startAndEnroll();resident=ownedChild();JSONObject replay=trusted.replay();assertEquals(output,replay.getJSONArray("output").toString());assertEquals(0,replay.getInt("calls"));assertEquals(1,model.calls.get());assertNull(model.failure);
    proof.put("firstProcess",original).put("secondProcess",replacement).put("finalProcess",resident).put("oldIpcPreserved",retained).put("workflowVersionId","trusted-v1").put("executionId",trusted.runId).put("sourceSha256",hash(module.getBytes(StandardCharsets.UTF_8))).put("workerPid",worker.pid).put("workerStartTicks",worker.start).put("modelRequests",1).put("canonicalOutput",result.getJSONArray("output")).put("workerIndexSha256",fixture.getString("workerIndexSha256")).put("workerManifestSha256",fixture.getString("workerManifestSha256")).put("compilerManifestSha256",fixture.getString("compilerManifestSha256")).put("freshCanonicalReplay",true).put("passed",true);
   }catch(Throwable error){failure=error;}
   finally{try{model.release.countDown();if(trusted!=null){if(trusted.process.isAlive())trusted.finish();trusted.close();}ElizaAgentService.stop(context);stopped(resident);proof.put("cleanupComplete",true);}catch(Throwable cleanup){if(failure==null)failure=cleanup;else failure.addSuppressed(cleanup);proof.put("cleanupFailed",true);}finally{hook.set(null,null);ownerBearer=null;ownerIdentityId=null;}}
  }catch(Throwable outer){if(failure==null)failure=outer;else failure.addSuppressed(outer);}
  proof.put("passed",failure==null&&proof.optBoolean("passed"));try{if(readinessTimeoutDiagnostic!=null)proof.put("readinessTimeoutDiagnostic",readinessTimeoutDiagnostic);if(apiFailureDiagnostic!=null)proof.put("apiFailureDiagnostic",apiFailureDiagnostic);write(new File(context.getFilesDir(),"resident-recovery-complete.json"),proof.toString());}catch(Throwable outputFailure){if(failure==null)failure=outputFailure;else failure.addSuppressed(outputFailure);}if(failure!=null)throw failure;
 }
}
