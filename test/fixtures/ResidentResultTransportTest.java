package ai.elizaresearch.alphaphone;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.json.*;
public final class ResidentResultTransportTest {
 static void require(boolean value){if(!value)throw new AssertionError();}
 interface Task {void run()throws Exception;}
 static void rejects(Task task)throws Exception {try{task.run();}catch(Exception expected){return;}throw new AssertionError("accepted forbidden request");}
 static final class Channel implements ResidentResultTransport.Channel {
  final List<String> paths=new ArrayList<>();boolean cancelled,acknowledged,loseAck;String owner="owner",agent="agent",token="session";int status=200;AtomicLong clock=new AtomicLong();
  Runnable beforeAck=()->{};boolean cancelResult,oversized,expire;
  public void check(){if(cancelled)throw new SecurityException("cancelled");}
  public JSONObject exchange(String path,String method,JSONObject body,int timeout)throws Exception {
   require(timeout>0&&timeout<=15000);paths.add(method+" "+path);JSONObject value;
   if(path.equals("/api/auth/me"))value=new JSONObject().put("identity",new JSONObject().put("id",owner).put("kind","owner")).put("access",new JSONObject().put("role","OWNER").put("mode","session")).put("session",new JSONObject().put("kind","machine").put("id",token).put("expiresAt",expire?1:System.currentTimeMillis()+60000));
   else if(path.equals("/api/agents"))value=new JSONObject().put("agents",new JSONArray().put(new JSONObject().put("id",agent).put("status","running")));
   else if(path.equals("/api/workflow/status"))value=new JSONObject().put("hostedDigestProtocol",1);
   else if(path.startsWith("/api/workflow/hosted/results?")){value=new JSONObject().put("entries",acknowledged?new JSONArray():new JSONArray().put(result()));if(cancelResult)cancelled=true;}
   else if(path.equals("/api/workflow/hosted/results/ack")){require(method.equals("POST"));beforeAck.run();if(loseAck){loseAck=false;throw new java.io.IOException("lost ack");}acknowledged=true;value=new JSONObject();}
   else throw new AssertionError("Unexpected route "+path);
   return new JSONObject().put("status",status).put("body",oversized?"x".repeat(1100001):value.toString());
  }
  ResidentResultTransport transport(){return new ResidentResultTransport(this,"owner","agent","session",clock::get);}
 }
 static JSONObject result(){String now="2026-10-02T00:00:00Z";return new JSONObject().put("cursor",1).put("runId","run-one").put("workflowId","workflow").put("workflowVersionId","version").put("templateVersion","template").put("scheduledAt",now).put("startedAt",now).put("completedAt",now).put("source",new JSONObject().put("kind","tasks")).put("status","completed").put("output","Synthetic result").put("error",JSONObject.NULL);}
 static final class Store implements HostedInbox.Store,HostedResultNotices.Storage {final Map<String,String> values=new HashMap<>();public String read(String key){return values.get(key);}public void write(String key,String value){values.put(key,value);}public void remove(String key){values.remove(key);}}
 public static void main(String[] args)throws Exception {
  Channel c=new Channel();ResidentResultTransport t=c.transport();
  for(String path:new String[]{"/api/auth/pair","/api/workflow/execute","/api/workflow/hosted/loops","https://other.invalid","/api/workflow/hosted/results?clientId=x&extra=y"})rejects(()->t.request(path,null));require(c.paths.isEmpty());
  JSONObject ack=new JSONObject().put("clientId","client").put("runId","run-one").put("cursor",1);
  for(Object cursor:new Object[]{0,-1,1.5,9007199254740992L,"1"})rejects(()->t.request("/api/workflow/hosted/results/ack",new JSONObject(ack.toString()).put("cursor",cursor)));require(c.paths.isEmpty());
  rejects(()->t.request("/api/workflow/hosted/results/ack",new JSONObject(ack.toString()).put("extra",true)));require(c.paths.isEmpty());
  require(t.request("/api/workflow/hosted/results?clientId=client",null).getJSONArray("entries").length()==1);
  for(String mismatch:new String[]{"owner","agent","session","expired","unauthorized","oversized"}){
   Channel bad=new Channel();if(mismatch.equals("owner"))bad.owner="other";if(mismatch.equals("agent"))bad.agent="other";if(mismatch.equals("session"))bad.token="other";if(mismatch.equals("expired"))bad.expire=true;if(mismatch.equals("unauthorized"))bad.status=401;if(mismatch.equals("oversized"))bad.oversized=true;
   rejects(()->bad.transport().request("/api/workflow/hosted/results/ack",ack));require(!bad.acknowledged);
  }
  c=new Channel();ResidentResultTransport closed=c.transport();closed.close();rejects(closed::verify);require(c.paths.isEmpty());
  c=new Channel();ResidentResultTransport expired=c.transport();c.clock.set(java.util.concurrent.TimeUnit.SECONDS.toNanos(61));rejects(expired::verify);require(c.paths.isEmpty());
  Channel late=new Channel();late.cancelResult=true;rejects(()->late.transport().request("/api/workflow/hosted/results?clientId=client",null));require(!late.acknowledged);
  Store store=new Store();HostedResultNotices notices=new HostedResultNotices(store,new HostedResultNotices.Poster(){public boolean allowed(){return false;}public boolean active(String key){return false;}public void post(String key){throw new AssertionError();}public void cancel(String key){}});
  HostedInbox inbox=new HostedInbox(store,new Object(),notices);String origin="https://device.alpha.invalid",scope=HostedResultNotices.hash(new JSONArray().put(origin).put("owner").put("agent").toString());JSONObject binding=new JSONObject().put("scope",scope).put("origin",origin).put("ownerId","owner").put("agentId","agent");String slot="hosted-digests:v1:"+scope;
  Channel recovery=new Channel();recovery.loseAck=true;recovery.beforeAck=()->{try{require(inbox.history(slot).length()==1);}catch(Exception error){throw new AssertionError(error);}};
  rejects(()->inbox.sync(binding,recovery.transport(),()->{}));String original=store.read(slot+":run-one");require(original!=null&&!recovery.acknowledged);
  require(inbox.sync(binding,recovery.transport(),()->{}).length()==1);require(recovery.acknowledged&&original.equals(store.read(slot+":run-one")));
  System.out.println("PASS resident owner/session/agent checks, bounded IPC, route denial, cancellation, commit-before-ack and lost-ack recovery");
 }
}
