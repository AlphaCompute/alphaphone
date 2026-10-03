package ai.elizaresearch.alphaphone;
import java.util.*;
import java.util.concurrent.*;
public final class WorkflowNoticeIoTest {
 public static void main(String[] args)throws Exception {
  Thread caller=Thread.currentThread();List<Integer> order=Collections.synchronizedList(new ArrayList<>());
  CountDownLatch started=new CountDownLatch(1),release=new CountDownLatch(1),finished=new CountDownLatch(1);
  try(WorkflowNoticeIo io=new WorkflowNoticeIo(2)){
   io.execute(()->{if(Thread.currentThread()==caller)throw new AssertionError("Disk work on caller");started.countDown();try{release.await();}catch(InterruptedException e){Thread.currentThread().interrupt();}order.add(1);});
   if(!started.await(5,TimeUnit.SECONDS))throw new AssertionError("Worker did not start");
   io.execute(()->order.add(2));io.execute(()->{order.add(3);finished.countDown();});
   try{io.execute(()->order.add(4));throw new AssertionError("Unbounded queue");}catch(RejectedExecutionException expected){}
   if(!order.isEmpty())throw new AssertionError("Queued work overtook blocked write");
   release.countDown();if(!finished.await(5,TimeUnit.SECONDS))throw new AssertionError("Queue stalled");
   if(!order.equals(Arrays.asList(1,2,3)))throw new AssertionError("Storage ordering changed");
  }finally{release.countDown();}
  System.out.println("PASS bounded notification storage ordering");
 }
}
