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
  delivery.withdrawApproval(first);taps.forget(first);require(poster.cancelled.contains(first)&&!poster.active.containsKey(first),"decision cancels the notice");
  require("withdrawn".equals(delivery.publishApproval(first,binding,now+10*minute,now))&&poster.posted.size()==1,"withdrawn approval never reposts");
  require(taps.token(first)==null,"withdrawn route released");
  // A captured tap whose approval was decided elsewhere is released instead of blocking later taps.
  String secondToken=taps.prepare(second,binding,route("run2"));require("succeeded".equals(delivery.publishApproval(second,binding,now+5*minute,now)),"second approval posts");
  taps.capture(secondToken);delivery.withdrawApproval(second);require(!new WorkflowNoticeTaps(store).pending().getBoolean("retained"),"withdrawn tap is not retained");taps.forget(second);require(taps.pending().length()==0,"stale captured tap released");
  // Expiry: nothing posts for an expired approval and expired receipts are pruned.
  String third="approval-"+"3".repeat(64);require("expired".equals(delivery.publishApproval(third,binding,now,now))&&!poster.posted.contains(third),"expired approval posts nothing");
  taps.prepare(third,binding,route("run3"));require("succeeded".equals(delivery.publishApproval(third,binding,now+minute,now)),"third posts");
  List<String> expired=delivery.expireApprovals(now+10*minute);require(expired.containsAll(List.of(first,second,third))&&expired.size()==3,"expired receipts pruned");for(String id:expired)taps.forget(id);
  require(new JSONObject(store.values.get(WorkflowNoticeDelivery.APPROVAL_SLOT)).length()==0&&taps.token(third)==null,"ledgers bounded after expiry");
  // A muted approval channel records failure without posting; step notices are unaffected.
  Poster muted=new Poster();muted.approvals=false;String fourth="approval-"+"4".repeat(64);require("failed".equals(new WorkflowNoticeDelivery(new Store(),muted).publishApproval(fourth,binding,now+minute,now))&&muted.posted.isEmpty(),"muted channel posts nothing");
  // Bounds.
  rejects(()->delivery.publishApproval("op1",binding,now+minute,now),"only approval IDs");
  rejects(()->delivery.publishApproval(fourth,binding,now+8*86400000L,now),"over-long approval refused");
  rejects(()->taps.forget("op1"),"step routes are never released here");
  require(WorkflowNoticeDelivery.approvalTimeout(now+minute,now)==minute&&WorkflowNoticeDelivery.approvalTimeout(now,now)==-1,"timeout policy");
  require(WorkflowNoticeDelivery.STEP_NOTICE_TIMEOUT_MS==24L*3600000,"step notices time out after a day");
  System.out.println("PASS workflow approval notices: one per approval ID, expiry timeout, tap after restart, withdrawal on decision, pruning and bounds");
 }
}
