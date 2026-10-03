package ai.elizaresearch.alphaphone;
import java.util.concurrent.*;
/** Bounded FIFO for durable notification work; never executes on the caller. */
final class WorkflowNoticeIo implements AutoCloseable {
 private final ThreadPoolExecutor executor;
 WorkflowNoticeIo(){this(512);}
 WorkflowNoticeIo(int capacity){
  executor=new ThreadPoolExecutor(1,1,30,TimeUnit.SECONDS,new ArrayBlockingQueue<>(capacity),task->{Thread thread=new Thread(task,"alpha-notice-storage");thread.setDaemon(true);return thread;},new ThreadPoolExecutor.AbortPolicy());
  executor.allowCoreThreadTimeOut(true);
 }
 void execute(Runnable task){executor.execute(task);}
 public void close(){executor.shutdownNow();}
}
