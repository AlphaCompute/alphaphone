import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java','utf8');
function method(start){const at=source.indexOf(start);assert.ok(at>=0,start);let depth=0;for(let i=source.indexOf('{',at);i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0)return source.slice(at,i+1);}throw Error('Unclosed method');}
test('resident Cloud binding validates credentials and keeps provider environments exclusive',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-cloud-provider-'));
 const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');
 const bin=name=>java?path.join(java,'bin',name):name;
 const jars=fs.globSync(path.join(os.homedir(),'.gradle/caches/modules-2/files-2.1/org.json/json/*/*/json-*.jar'));
 assert.ok(jars.length,'Existing cached org.json JVM dependency required');
 const constants=['CLOUD_PROVIDER_MODEL','CLOUD_PROVIDER_BASE','PROVIDER_MODEL_PATTERN'].map(name=>source.match(new RegExp(' static final String '+name+'=[^;]+;'))[0]).join('\n');
 try{
 fs.writeFileSync(path.join(dir,'CloudProviderTest.java'),`import java.util.*;import org.json.JSONObject;
public class CloudProviderTest {
${constants}
${method(' static boolean validProviderToken(')}
${method(' static String cloudProviderToken(')}
${method(' static void bindCloudProvider(')}
${method(' static void applyProviderEnvironment(')}
 static class AlphaCredentialStore {
  String provider,cloud; int cloudReads=0,exchanges=0; boolean initialConflict=false;
  java.util.function.IntConsumer beforeRead=n->{};
  AlphaCredentialStore(String provider,String cloud){this.provider=provider;this.cloud=cloud;}
  String readCredentialSlot(String slot){if(slot.equals("cloud:production")){beforeRead.accept(++cloudReads);return cloud;}return provider;}
  boolean compareExchangeCredentialSlot(String slot,String expected,String value){
   exchanges++;if(initialConflict&&exchanges==1){provider="concurrent-selection";return false;}
   if(!Objects.equals(provider,expected))return false;provider=value;return true;
  }
 }
 static final String ID="d32f7f34-962b-47b7-8f0d-f2fe7f12610a";
 static final long NOW=10000;
 interface Checked {void run()throws Exception;}
 static void refuses(Checked check)throws Exception{try{check.run();}catch(Exception expected){return;}throw new AssertionError("Invalid input admitted");}
 static JSONObject credential()throws Exception{return new JSONObject().put("credentialId",ID).put("token","synthetic-cloud-token").put("expiresAt",NOW+1);}
 static JSONObject binding()throws Exception{return new JSONObject().put("provider","elizacloud").put("credentialId",ID).put("model",CLOUD_PROVIDER_MODEL);}
 public static void main(String[] args)throws Exception {
  if(!"synthetic-cloud-token".equals(cloudProviderToken(credential().toString(),ID,NOW)))throw new AssertionError();
  refuses(()->cloudProviderToken(null,ID,NOW));
  refuses(()->cloudProviderToken(credential().toString(),"not-an-id",NOW));
  refuses(()->cloudProviderToken(credential().toString(),"72475cd0-e135-4c42-a9e2-fb5fe0820ada",NOW));
  for(Object expiry:new Object[]{NOW,NOW-1,"10001",JSONObject.NULL})refuses(()->cloudProviderToken(credential().put("expiresAt",expiry).toString(),ID,NOW));
  for(Object token:new Object[]{"", "short", "token with spaces", "token\\nline", "valid-token\\nrest\\nend", "valid-token\\r\\nrest\\nend", "token\\twith-tab", "token"+(char)0+"control", "token"+(char)127+"control", "token"+(char)0xA0+"space", 123, JSONObject.NULL})refuses(()->cloudProviderToken(credential().put("token",token).toString(),ID,NOW));
  JSONObject noExpiry=credential();noExpiry.remove("expiresAt");cloudProviderToken(noExpiry.toString(),ID,NOW);
  Map<String,String> env=new HashMap<>();
  for(String key:new String[]{"CEREBRAS_API_KEY","CEREBRAS_BASE_URL","CEREBRAS_MODEL","CEREBRAS_SMALL_MODEL","CEREBRAS_LARGE_MODEL","OPENAI_API_KEY","OPENAI_BASE_URL","ELIZA_PROVIDER"})env.put(key,"stale-direct-provider");
  env.put("UNRELATED","preserved");
  applyProviderEnvironment(binding(),credential().toString(),env,NOW);
  if(!"true".equals(env.get("ELIZAOS_CLOUD_USE_INFERENCE"))||!CLOUD_PROVIDER_BASE.equals(env.get("ELIZAOS_CLOUD_BASE_URL"))||!CLOUD_PROVIDER_MODEL.equals(env.get("ELIZAOS_CLOUD_SMALL_MODEL"))||!CLOUD_PROVIDER_MODEL.equals(env.get("ELIZAOS_CLOUD_LARGE_MODEL"))||!"synthetic-cloud-token".equals(env.get("ELIZAOS_CLOUD_API_KEY"))||!"preserved".equals(env.get("UNRELATED")))throw new AssertionError("Wrong cloud configuration");
  if(env.containsValue("stale-direct-provider"))throw new AssertionError("Direct provider retained");
  Map<String,String> before=new HashMap<>(env);
  refuses(()->applyProviderEnvironment(binding(),null,env,NOW));
  refuses(()->applyProviderEnvironment(binding().put("model","unsupported"),credential().toString(),env,NOW));
  if(!before.equals(env))throw new AssertionError("Rejected configuration mutated environment");
  applyProviderEnvironment(new JSONObject().put("key","synthetic-cerebras").put("model","direct-model"),null,env,NOW);
  if(env.containsKey("ELIZAOS_CLOUD_API_KEY")||env.containsKey("ELIZAOS_CLOUD_BASE_URL")||!"false".equals(env.get("ELIZAOS_CLOUD_USE_INFERENCE"))||!"synthetic-cerebras".equals(env.get("CEREBRAS_API_KEY")))throw new AssertionError("Direct path lost exclusivity");
  refuses(()->applyProviderEnvironment(new JSONObject().put("provider","unknown").put("model","direct-model"),null,env,NOW));
  String original=new JSONObject().put("key","synthetic-cerebras").put("model","direct-model").toString();
  String current=credential().put("expiresAt",System.currentTimeMillis()+60000).toString();
  AlphaCredentialStore success=new AlphaCredentialStore(original,current);
  bindCloudProvider(success,ID,CLOUD_PROVIDER_MODEL);
  JSONObject admitted=new JSONObject(success.provider);
  if(!"elizacloud".equals(admitted.getString("provider"))||!ID.equals(admitted.getString("credentialId"))||!admitted.has("revision")||admitted.has("token")||admitted.has("key"))throw new AssertionError("Invalid binding contents");
  for(String previous:new String[]{null,original}){
   AlphaCredentialStore logout=new AlphaCredentialStore(previous,current);
   logout.beforeRead=n->{if(n==2)logout.cloud=null;};
   refuses(()->bindCloudProvider(logout,ID,CLOUD_PROVIDER_MODEL));
   if(!Objects.equals(previous,logout.provider))throw new AssertionError("Lost original provider after failed admission");
  }
  for(String invalid:new String[]{credential().put("expiresAt",1).toString(),credential().put("credentialId","72475cd0-e135-4c42-a9e2-fb5fe0820ada").toString()}){
   AlphaCredentialStore stale=new AlphaCredentialStore(original,current);
   stale.beforeRead=n->{if(n==2)stale.cloud=invalid;};
   refuses(()->bindCloudProvider(stale,ID,CLOUD_PROVIDER_MODEL));
   if(!original.equals(stale.provider))throw new AssertionError("Failed account admission lost prior provider");
  }
  AlphaCredentialStore replaced=new AlphaCredentialStore(original,current);
  replaced.beforeRead=n->{if(n==2){replaced.cloud=null;replaced.provider="newer-provider";}};
  refuses(()->bindCloudProvider(replaced,ID,CLOUD_PROVIDER_MODEL));
  if(!"newer-provider".equals(replaced.provider))throw new AssertionError("Rollback overwrote newer provider");
  AlphaCredentialStore conflict=new AlphaCredentialStore(original,current);conflict.initialConflict=true;
  refuses(()->bindCloudProvider(conflict,ID,CLOUD_PROVIDER_MODEL));
  if(!"concurrent-selection".equals(conflict.provider))throw new AssertionError("Initial CAS replaced newer provider");
  AlphaCredentialStore validButReplaced=new AlphaCredentialStore(original,current);
  validButReplaced.beforeRead=n->{if(n==2)validButReplaced.provider="later-success";};
  refuses(()->bindCloudProvider(validButReplaced,ID,CLOUD_PROVIDER_MODEL));
  if(!"later-success".equals(validButReplaced.provider))throw new AssertionError("Late CAS replaced newer provider");
  AlphaCredentialStore absent=new AlphaCredentialStore(original,null);
  refuses(()->bindCloudProvider(absent,ID,CLOUD_PROVIDER_MODEL));
  if(absent.exchanges!=0||!original.equals(absent.provider))throw new AssertionError("Unauthenticated binding changed provider");
  for(String bad:new String[]{"key\\nwith\\nlines","key"+(char)0+"control"})refuses(()->applyProviderEnvironment(new JSONObject().put("key",bad).put("model","direct-model"),null,env,NOW));
  System.out.println("PASS native Cloud credential and provider boundaries");
 }
}`);
 execFileSync(bin('javac'),['--release','17','-cp',jars[0],'-d',dir,path.join(dir,'CloudProviderTest.java')],{timeout:20000});
 assert.match(execFileSync(bin('java'),['-cp',dir+path.delimiter+jars[0],'CloudProviderTest'],{encoding:'utf8',timeout:20000}),/^PASS native Cloud credential and provider boundaries/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Cloud configuration takes a credential reference and stores no copied token',()=>{
 const configure=method(' @PluginMethod public void configureCloudProvider(');
 assert.match(configure,/call.getString\("credentialId"/);
 assert.match(configure,/bindCloudProvider\(/);
 const binding=method(' static void bindCloudProvider(');
 assert.match(binding,/readCredentialSlot\("cloud:production"\)/);
 assert.doesNotMatch(configure,/call.getString\("(?:apiKey|token)"/);
 assert.doesNotMatch(configure,/\.put\("(?:apiKey|token|key)"/);
 assert.equal((binding.match(/cloudProviderToken\(/g)||[]).length,2);
 assert.match(binding,/compareExchangeCredentialSlot\("local-agent-provider:v1",binding,previous\)/);
 const environment=method(' static void configureEnvironment(');
 assert.match(environment,/readCredentialSlot\("cloud:production"\)/);
 assert.match(environment,/applyProviderEnvironment\(/);
});
