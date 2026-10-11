package ai.elizaresearch.alphaphone;
import org.json.JSONObject;
/** JVM contract for the production attach decision. Not emulator or device evidence. */
public final class ResidentAttachmentTest {
 static void require(boolean value,String message){if(!value)throw new AssertionError(message);}
 static JSONObject running()throws Exception{return new JSONObject().put("state","listening").put("serviceActive",true).put("socketListening",true);}
 static ResidentAttachment.Facts admitted(long now){
  ResidentAttachment.Facts f=new ResidentAttachment.Facts();
  f.accepting=true;f.currentRoot="root-1";f.enrolledRoot="root-1";f.ownerToken="owner-session";f.ownerIdentity="owner";
  f.now=now;f.expiresAt=now+600_000;f.launchedGeneration="generation-1";f.currentGeneration="generation-1";
  return f;
 }
 interface Change {void apply(ResidentAttachment.Facts facts);}
 static void refused(String expected,Change change)throws Exception{
  ResidentAttachment.Facts facts=admitted(1_760_000_000_000L);change.apply(facts);
  String actual=ResidentAttachment.refusal(running(),facts);
  require(expected.equals(actual),"expected "+expected+" but got "+actual);
 }
 public static void main(String[] args)throws Exception{
  long now=1_760_000_000_000L;
  // The one admitted case: running, enrolled against this runtime, launched under the stored admission.
  require(ResidentAttachment.refusal(running(),admitted(now))==null,"admitted running resident attaches");
  require(ResidentAttachment.describe(null).getBoolean("attachable")&&!ResidentAttachment.describe(null).has("reason"),"attachable result has no reason");
  // Every doubt falls back to the ordinary start path.
  refused("lifecycle-retiring",f->f.accepting=false);
  refused("lifecycle-retiring",f->f.stopping=true);
  refused("provider-changing",f->f.credentialMutating=true);
  refused("provider-changing",f->f.credentialShutdownPending=true);
  refused("attach-unverified",f->f.attachUnverified=true);
  refused("runtime-token-unavailable",f->f.currentRoot=null);
  refused("not-enrolled",f->f.enrolledRoot=null);
  refused("not-enrolled",f->f.ownerToken="");
  refused("not-enrolled",f->f.ownerIdentity=null);
  // A restarted runtime has a new token: its old enrollment is never reused.
  refused("runtime-changed",f->f.currentRoot="root-2");
  refused("enrollment-expiring",f->f.expiresAt=f.now+ResidentAttachment.ENROLLMENT_MARGIN_MS);
  refused("enrollment-expiring",f->f.expiresAt=0);
  // Provider/account change: a process launched under another admission is not attached to.
  refused("provider-changed",f->f.currentGeneration="generation-2");
  refused("provider-unadmitted",f->f.launchedGeneration=null);
  refused("provider-unadmitted",f->f.currentGeneration=null);
  for(JSONObject state:new JSONObject[]{null,new JSONObject(),running().put("state","booting"),running().put("state","restarting"),running().put("state","dead"),running().put("serviceActive",false),running().put("socketListening",false)})
   require("runtime-not-running".equals(ResidentAttachment.refusal(state,admitted(now))),"only a listening service attaches: "+state);
  require("unavailable".equals(ResidentAttachment.refusal(running(),null)),"missing facts refuse");
  JSONObject described=ResidentAttachment.describe("provider-changed");
  require(!described.getBoolean("attachable")&&"provider-changed".equals(described.getString("reason"))&&described.length()==2,"refusal carries only its reason");
  // Reasons are diagnostics: never a token, identity or generation.
  for(String secret:new String[]{"root-1","owner-session","generation-1"})for(Change change:new Change[]{f->f.currentRoot="root-2",f->f.currentGeneration="other",f->f.expiresAt=0}){
   ResidentAttachment.Facts facts=admitted(now);change.apply(facts);
   require(!ResidentAttachment.refusal(running(),facts).contains(secret),"reason leaks a private value");
  }
  // Attached start requests: cancellation is recognised exactly once and the memory stays bounded.
  ResidentAttachment.Requests requests=new ResidentAttachment.Requests();
  requests.add(null);require(requests.size()==0&&!requests.remove(null),"anonymous starts are not tracked");
  requests.add("first");require(requests.remove("first")&&!requests.remove("first"),"an attached start is cancelled once");
  for(int index=0;index<ResidentAttachment.Requests.LIMIT+8;index++)requests.add("request-"+index);
  require(requests.size()==ResidentAttachment.Requests.LIMIT,"attached start memory is bounded");
  require(!requests.remove("request-0")&&requests.remove("request-"+(ResidentAttachment.Requests.LIMIT+7)),"oldest attached starts are forgotten first");
  System.out.println("PASS resident attachment: admitted running resident attaches; retirement, runtime, enrollment and provider changes restart; bounded cancellation memory");
 }
}
