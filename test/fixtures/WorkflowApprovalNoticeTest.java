package ai.elizaresearch.alphaphone;
import org.json.*;
import java.util.*;
public final class WorkflowApprovalNoticeTest {
 static void require(boolean value,String message){if(!value)throw new AssertionError(message);}
 interface Work {void run()throws Exception;}
 static void rejects(Work work,String message)throws Exception{try{work.run();}catch(Exception expected){return;}throw new AssertionError(message);}
 static class Store implements WorkflowNoticeDelivery.Storage {Map<String,String> values=new HashMap<>();public String read(String slot){return values.get(slot);}public void write(String slot,String value){values.put(slot,value);}}
 static class Poster implements WorkflowNoticeDelivery.Poster {
  boolean steps=true,approvals=true;List<String> posted=new ArrayList<>(),cancelled=new ArrayList<>();Map<String,String> active=new HashMap<>();Map<String,Long> timeouts=new HashMap<>();
  public boolean allowed(){return steps;}public boolean approvalsAllowed(){return approvals;}
  public void post(String id,String title,String body){throw new AssertionError("Approval notices never use the step channel");}
  public void postApproval(String id,String title,String body,long timeout){posted.add(id);active.put(id,title+"\n"+body);timeouts.put(id,timeout);}
  public void cancel(String id){cancelled.add(id);active.remove(id);}
  public boolean matches(String id,String title,String body){return Objects.equals(active.get(id),title+"\n"+body);}
 }
 static JSONObject route(String run)throws Exception{return new JSONObject().put("scope","a".repeat(64)).put("origin","https://agent.invalid").put("ownerId","owner").put("agentId","agent").put("workflowId","workflow").put("runId",run).put("versionId","v1");}
 public static void main(String[] args)throws Exception{
  long now=1_760_000_000_000L,minute=60000L;String binding="b".repeat(64),first="approval-"+"1".repeat(64),second="approval-"+"2".repeat(64);
  Store store=new Store();Poster poster=new Poster();WorkflowNoticeDelivery delivery=new WorkflowNoticeDelivery(store,poster);WorkflowNoticeTaps taps=new WorkflowNoticeTaps(store);
  // One notice per pending approval ID, timed out at the approval's expiry, never reposted.
  String token=taps.prepare(first,binding,route("run1"));
  require("succeeded".equals(delivery.publishApproval(first,binding,now+10*minute,now)),"first approval posts");
  require(poster.timeouts.get(first)==10*minute,"notice times out when the approval expires");
  require("succeeded".equals(delivery.publishApproval(first,binding,now+10*minute,now+minute))&&poster.posted.size()==1,"same approval never posts twice");
  rejects(()->delivery.publishApproval(first,"c".repeat(64),now+10*minute,now),"binding change refused");
  rejects(()->delivery.publishApproval(first,binding,now+20*minute,now),"expiry change refused");
  String raw=store.values.get(WorkflowNoticeDelivery.APPROVAL_SLOT);require(!raw.contains("run1")&&!raw.contains(WorkflowNoticeDelivery.APPROVAL_TITLE),"receipt holds no route or text");
  // A well-shaped but different persisted digest must not count as the original receipt.
  JSONObject damaged=new JSONObject(raw);damaged.getJSONObject(first).put("digest","0".repeat(64));
  store.values.put(WorkflowNoticeDelivery.APPROVAL_SLOT,damaged.toString());
  rejects(()->new WorkflowNoticeDelivery(store,poster).publishApproval(first,binding,now+10*minute,now),"changed receipt digest refused");
  require(poster.posted.size()==1,"corrupt receipt never reposts");store.values.put(WorkflowNoticeDelivery.APPROVAL_SLOT,raw);
  // Tap after process death: a fresh ledger instance still resolves the exact run.
  taps.capture(token);JSONObject pending=new WorkflowNoticeTaps(store).pending();require("run1".equals(pending.getString("runId"))&&pending.getBoolean("retained"),"tap opens that run");
  new WorkflowNoticeTaps(store).consume(token);require(new WorkflowNoticeTaps(store).pending().length()==0,"tap consumed once");
  // Decision withdraws the notice and frees its route; it is never reposted.
  delivery.withdrawApproval(first,now+minute);taps.forget(first);require(poster.cancelled.contains(first)&&!poster.active.containsKey(first),"decision cancels the notice");
  require("withdrawn".equals(delivery.publishApproval(first,binding,now+10*minute,now))&&poster.posted.size()==1,"withdrawn approval never reposts");
  require(taps.token(first)==null,"withdrawn route released");
  // The plugin's whole post prepares the route before the receipt answers; a repeated request for the
  // decided approval must not leave that route behind (found on the emulator: "Route released").
  require("withdrawn".equals(delivery.postApproval(taps,first,binding,route("run1"),now+10*minute,now))&&poster.posted.size()==1,"repeated post of a decided approval never reposts");
  require(taps.token(first)==null,"repeated post of a decided approval keeps no route");
  {Store s2=new Store();Poster p2=new Poster();WorkflowNoticeDelivery d2=new WorkflowNoticeDelivery(s2,p2);WorkflowNoticeTaps t2=new WorkflowNoticeTaps(s2);
   String fifth="approval-"+"5".repeat(64),sixth="approval-"+"6".repeat(64),seventh="approval-"+"7".repeat(64);
   require("succeeded".equals(d2.postApproval(t2,fifth,binding,route("run5"),now+10*minute,now))&&t2.token(fifth)!=null,"a live approval keeps its route");
   require("succeeded".equals(d2.postApproval(t2,fifth,binding,route("run5"),now+10*minute,now))&&p2.posted.size()==1,"whole post is at most once");
   require("expired".equals(d2.postApproval(t2,sixth,binding,route("run6"),now,now))&&t2.token(sixth)==null,"an expired approval prepares no route");
   p2.approvals=false;require("failed".equals(d2.postApproval(t2,seventh,binding,route("run7"),now+minute,now))&&t2.token(seventh)==null&&p2.posted.size()==1,"a muted channel keeps no route");}
  // A captured tap whose approval was decided elsewhere is released instead of blocking later taps.
  String secondToken=taps.prepare(second,binding,route("run2"));require("succeeded".equals(delivery.publishApproval(second,binding,now+5*minute,now)),"second approval posts");
  taps.capture(secondToken);delivery.withdrawApproval(second,now+minute);require(!new WorkflowNoticeTaps(store).pending().getBoolean("retained"),"withdrawn tap is not retained");taps.forget(second);require(taps.pending().length()==0,"stale captured tap released");
  // Expiry: nothing posts for an expired approval and expired receipts are pruned.
  String third="approval-"+"3".repeat(64);require("expired".equals(delivery.publishApproval(third,binding,now,now))&&!poster.posted.contains(third),"expired approval posts nothing");
  taps.prepare(third,binding,route("run3"));require("succeeded".equals(delivery.publishApproval(third,binding,now+minute,now)),"third posts");
  List<String> expired=delivery.expireApprovals(now+10*minute);require(expired.containsAll(List.of(first,second,third))&&expired.size()==3,"expired receipts pruned");for(String id:expired)taps.forget(id);
  require(new JSONObject(store.values.get(WorkflowNoticeDelivery.APPROVAL_SLOT)).length()==0&&taps.token(third)==null,"ledgers bounded after expiry");
  // A muted approval channel records failure without posting; step notices are unaffected.
  Poster muted=new Poster();muted.approvals=false;String fourth="approval-"+"4".repeat(64);require("failed".equals(new WorkflowNoticeDelivery(new Store(),muted).publishApproval(fourth,binding,now+minute,now))&&muted.posted.isEmpty(),"muted channel posts nothing");
  // Receipts written before the shared ledger was adopted (same slots, same record shapes) still read:
  // these literals are the stored format of the retired in-app ledger, not output of the code under test.
  {Store old=new Store();Poster quiet=new Poster();String digest="5ad03d9c2f0a4ce9b3d1bd36b6ba0e7a6f3a5a3b3ba0a5d8bbd1c7d7e3b0c1aa";
   String posted="approval-"+"8".repeat(64),decided="approval-"+"9".repeat(64);
   String approvalDigest=new JSONObject(raw).getJSONObject(first).getString("digest");
   old.values.put("workflow-approval-notices:v1","{\""+posted+"\":{\"binding\":\""+binding+"\",\"digest\":\""+approvalDigest+"\",\"status\":\"succeeded\",\"expiresAt\":"+(now+5*minute)+"},\""+decided+"\":{\"binding\":\""+binding+"\",\"digest\":\""+approvalDigest+"\",\"status\":\"withdrawn\",\"expiresAt\":"+(now+5*minute)+"}}");
   WorkflowNoticeDelivery upgraded=new WorkflowNoticeDelivery(old,quiet);quiet.active.put(posted,WorkflowNoticeDelivery.APPROVAL_TITLE+"\n"+WorkflowNoticeDelivery.APPROVAL_BODY);
   require("succeeded".equals(upgraded.publishApproval(posted,binding,now+5*minute,now))&&"withdrawn".equals(upgraded.publishApproval(decided,binding,now+5*minute,now))&&quiet.posted.isEmpty(),"stored approval receipts read without reposting");
   old.values.put("workflow-notice-delivery:v1","{\"op1\":{\"binding\":\""+binding+"\",\"digest\":\""+digest+"\",\"status\":\"succeeded\"}}");
   rejects(()->upgraded.publish("op1",binding,"Other title","Other body"),"stored step receipt keeps its digest check");
   require(WorkflowNoticeDelivery.SLOT.equals("workflow-notice-delivery:v1")&&WorkflowNoticeDelivery.APPROVAL_SLOT.equals("workflow-approval-notices:v1"),"deployed slot names unchanged");
   require(upgraded.expireApprovals(now+5*minute).size()==2&&new JSONObject(old.values.get("workflow-approval-notices:v1")).length()==0,"stored approval receipts expire");}
  // A decision that reaches the phone before any publish is retained: the late publish never posts,
  // the prepared route is released, an unpublished withdrawal cannot open a tap, and expiry prunes it.
  {Store s3=new Store();Poster p3=new Poster();WorkflowNoticeDelivery d3=new WorkflowNoticeDelivery(s3,p3);WorkflowNoticeTaps t3=new WorkflowNoticeTaps(s3);String early="approval-"+"a".repeat(64);
   d3.withdrawApproval(early,now);require(p3.cancelled.contains(early),"early decision cancels");
   JSONObject kept=new JSONObject(s3.values.get(WorkflowNoticeDelivery.APPROVAL_SLOT)).getJSONObject(early);
   require(kept.length()==2&&"withdrawn".equals(kept.getString("status"))&&kept.getLong("expiresAt")==now+WorkflowNoticeDelivery.MAXIMUM_APPROVAL_MS,"early withdrawal holds only the opaque ID for the approval bound");
   require("withdrawn".equals(d3.postApproval(t3,early,binding,route("run9"),now+10*minute,now+minute))&&p3.posted.isEmpty()&&t3.token(early)==null,"late publish after an early decision posts nothing and keeps no route");
   d3.withdrawApproval(early,now+2*minute);require(new JSONObject(s3.values.get(WorkflowNoticeDelivery.APPROVAL_SLOT)).getJSONObject(early).getLong("expiresAt")==now+WorkflowNoticeDelivery.MAXIMUM_APPROVAL_MS,"repeated withdrawal keeps the first expiry");
   require(d3.expireApprovals(now+WorkflowNoticeDelivery.MAXIMUM_APPROVAL_MS).equals(List.of(early))&&"expired".equals(d3.postApproval(t3,early,binding,route("run9"),now+10*minute,now+WorkflowNoticeDelivery.MAXIMUM_APPROVAL_MS)),"early withdrawal is pruned at its bound");}
  // Bounds.
  rejects(()->delivery.publishApproval("op1",binding,now+minute,now),"only approval IDs");
  rejects(()->delivery.publishApproval(fourth,binding,now+8*86400000L,now),"over-long approval refused");
  rejects(()->taps.forget("op1"),"step routes are never released here");
  require(delivery.approvalTimeout(now+minute,now)==minute&&delivery.approvalTimeout(now,now)==-1,"timeout policy");
  require(WorkflowNoticeDelivery.STEP_NOTICE_TIMEOUT_MS==24L*3600000,"step notices time out after a day");
  System.out.println("PASS workflow approval notices: one per approval ID, expiry timeout, tap after restart, withdrawal on decision (also before publish), stored receipts, pruning and bounds");
 }
}
