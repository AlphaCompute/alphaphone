package ai.elizaresearch.alphaphone;
import org.json.*;
import java.util.*;
public final class WorkflowNoticeTapsTest {
 static void check(boolean value){if(!value)throw new AssertionError();}
 static void rejects(Throwing action)throws Exception{try{action.run();throw new AssertionError("Expected refusal");}catch(IllegalStateException|IllegalArgumentException expected){}}
 interface Throwing{void run()throws Exception;}
 static class Store implements WorkflowNoticeDelivery.Storage {Map<String,String> values=new HashMap<>();boolean fail;public String read(String key){return values.get(key);}public void write(String key,String value){if(fail)throw new IllegalStateException("disk");values.put(key,value);}}
 static JSONObject route(String run)throws Exception{return new JSONObject().put("scope","a".repeat(64)).put("origin","https://agent.invalid").put("ownerId","owner").put("agentId","agent").put("workflowId","workflow").put("runId",run).put("versionId","v1");}
 static void receipt(Store s,String id,String status)throws Exception{JSONObject ledger=new JSONObject(s.values.getOrDefault(WorkflowNoticeDelivery.SLOT,"{}"));ledger.put(id,new JSONObject().put("binding","b".repeat(64)).put("digest","c".repeat(64)).put("status",status));s.values.put(WorkflowNoticeDelivery.SLOT,ledger.toString());}
 public static void main(String[] ignored)throws Exception{
  Store s=new Store();WorkflowNoticeTaps taps=new WorkflowNoticeTaps(s);String first=taps.prepare("op1","b".repeat(64),route("run1")),second=taps.prepare("op2","b".repeat(64),route("run2"));check(!first.equals(second));check(taps.prepare("op1","b".repeat(64),route("run1")).equals(first));
  rejects(()->taps.prepare("op1","b".repeat(64),route("changed")));
  receipt(s,"op1","unknown");rejects(()->taps.capture(first));check(taps.pending().length()==0);
  receipt(s,"op1","succeeded");s.fail=true;rejects(()->taps.capture(first));s.fail=false;check(taps.pending().length()==0);
  taps.capture(first);receipt(s,"op2","succeeded");taps.capture(second);WorkflowNoticeTaps current=new WorkflowNoticeTaps(s);check(current.pending().getString("runId").equals("run2"));check(current.pending().getBoolean("retained"));
  receipt(s,"op2","unknown");check(!current.pending().getBoolean("retained"));rejects(()->current.consume(second));receipt(s,"op2","succeeded");
  s.fail=true;rejects(()->current.consume(second));s.fail=false;check(current.pending().getString("token").equals(second));current.consume(second);current.capture(second);check(current.pending().getString("runId").equals("run1"));current.consume(first);check(current.pending().length()==0);
  for(int i=2;i<512;i++)current.prepare("op"+(i+1),"b".repeat(64),route("run"+(i+1)));rejects(()->current.prepare("full","b".repeat(64),route("full")));check(current.token("op1").equals(first));
  System.out.println("PASS workflow tap durable queue, canonical receipts, failed writes, recreation, no replay and bounded retention");
 }
}
