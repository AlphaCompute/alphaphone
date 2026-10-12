package ai.elizaresearch.alphaphone;
import org.json.*;
import java.util.concurrent.atomic.AtomicInteger;
public final class DeferredDeletionJournalTest {
 static final class Store implements DeferredDeletionJournal.Store{String saved;boolean fail;public String read(){return saved;}public void save(String value){if(fail)throw new IllegalStateException("disk unavailable");saved=value;}}
 static JSONObject object(String value)throws Exception{return new JSONObject().put("id",value);}
 static void check(boolean value){if(!value)throw new AssertionError();}
 public static void main(String[] args)throws Exception{
  Store store=new Store();JSONObject owner=object("owner"),target=object("exact-event-revision");DeferredDeletionJournal j=new DeferredDeletionJournal(store);
  j.stage("undo",owner,target,new DeletionDeadline("boot",100,1000));j=new DeferredDeletionJournal(store);
  check(j.undo("undo",owner,"boot",9999).getString("phase").equals("undone"));AtomicInteger effects=new AtomicInteger();
  j.expire("undo","boot",20000,(a,b)->null,t->{effects.incrementAndGet();return object("bad");});check(effects.get()==0);
  j.stage("expiry",owner,target,new DeletionDeadline("boot",100,1000));
  j.expire("expiry","other-boot",999999,(a,b)->null,t->{effects.incrementAndGet();return object("bad");});check(effects.get()==0);
  j.expire("expiry","boot",10100,(a,b)->"owner-changed",t->{effects.incrementAndGet();return object("bad");});check(effects.get()==0);
  store.fail=true;try{j.expire("expiry","boot",10100,(a,b)->null,t->{effects.incrementAndGet();return object("bad");});throw new AssertionError();}catch(IllegalStateException expected){}check(effects.get()==0);store.fail=false;
  try{j.expire("expiry","boot",10100,(a,b)->null,t->{effects.incrementAndGet();store.fail=true;return new JSONObject().put("status","deleted");});throw new AssertionError();}catch(IllegalStateException expected){}store.fail=false;
  check(effects.get()==1);j=new DeferredDeletionJournal(store);
  j.expire("expiry","boot",50000,(a,b)->null,t->{effects.incrementAndGet();return new JSONObject().put("status","deleted");});check(effects.get()==1);
  check(j.list("boot",50000).getJSONObject(1).getString("phase").equals("unknown")||j.list("boot",50000).getJSONObject(0).getString("phase").equals("unknown"));
  j.stage("reboot",owner,target,new DeletionDeadline("boot",100,1000));check(j.undo("reboot",owner,"new-boot",1).getString("phase").equals("undone"));
  j.stage("foreign",owner,target,new DeletionDeadline("boot",100,1000));try{j.undo("foreign",object("other"),"boot",101);throw new AssertionError();}catch(SecurityException expected){}
  check(j.expire("foreign","boot",10100,(a,b)->null,t->{effects.incrementAndGet();throw new IllegalStateException("unknown transport");}).getString("phase").equals("unknown"));
  j.expire("foreign","boot",50100,(a,b)->null,t->{effects.incrementAndGet();return object("bad");});check(effects.get()==2);
  for(int n=0;n<20;n++){
   Store raceStore=new Store();DeferredDeletionJournal race=new DeferredDeletionJournal(raceStore);race.stage("race",owner,target,new DeletionDeadline("boot",100,1000));
   java.util.concurrent.CountDownLatch start=new java.util.concurrent.CountDownLatch(1);AtomicInteger writes=new AtomicInteger();java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
   Thread undo=new Thread(()->{try{start.await();race.undo("race",owner,"boot",10099);}catch(Throwable e){failure.set(e);}});
   Thread expiry=new Thread(()->{try{start.await();race.expire("race","boot",10100,(a,b)->null,t->{writes.incrementAndGet();return new JSONObject().put("status","deleted");});}catch(Throwable e){failure.set(e);}});
   undo.start();expiry.start();start.countDown();undo.join();expiry.join();if(failure.get()!=null)throw new AssertionError(failure.get());
   String phase=race.list("boot",20000).getJSONObject(0).getString("phase");check(phase.equals("undone")?writes.get()==0:phase.equals("deleted")&&writes.get()==1);
  }
  System.out.println("PASS durable deletion claims, recovery and no replay");
 }
}
