package ai.elizaresearch.alphaphone;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.util.Base64;
import java.net.*;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.GZIPInputStream;

/** Debug regional-data bridge only. No cookies, auth, arbitrary proxy or TLS bypass.
 * Release Maps uses its explicitly configured HTTPS endpoint directly. */
@CapacitorPlugin(name="AlphaMapsTransport")
public final class AlphaMapsTransportPlugin extends Plugin {
 private final ConcurrentHashMap<String,Pending> pending=new ConcurrentHashMap<>();
 private final ThreadPoolExecutor workers=new ThreadPoolExecutor(3,3,30,TimeUnit.SECONDS,new ArrayBlockingQueue<>(24));
 private final ScheduledThreadPoolExecutor deadlines=new ScheduledThreadPoolExecutor(1);
 { deadlines.setRemoveOnCancelPolicy(true); }
 private final ExecutorService closers=new ThreadPoolExecutor(1,1,30,TimeUnit.SECONDS,new ArrayBlockingQueue<>(32));
 private volatile boolean destroyed;
 private final ConcurrentHashMap<String,Long> earlyCancelled=new ConcurrentHashMap<>();
 private final class Pending {
  final PluginCall call;final AtomicBoolean settled=new AtomicBoolean();volatile boolean cancelled;volatile HttpURLConnection connection;volatile FutureTask<Void> task;volatile ScheduledFuture<?> deadline;
  Pending(PluginCall call){this.call=call;}
  void reject(String reason){if(settled.compareAndSet(false,true)){if(deadline!=null)deadline.cancel(false);call.reject(reason);}}
  void resolve(JSObject value){if(settled.compareAndSet(false,true)){if(deadline!=null)deadline.cancel(false);call.resolve(value);}}
  void cancel(String reason){cancelled=true;reject(reason);FutureTask<Void> queued=task;if(queued!=null){workers.remove(queued);queued.cancel(true);}HttpURLConnection active=connection;if(active!=null)try{closers.execute(active::disconnect);}catch(RejectedExecutionException ignored){/* The owning worker also closes in finally. */}}
 }
 @PluginMethod public void request(PluginCall call){
  if(!BuildConfig.DEBUG||destroyed){call.reject("Regional development transport is unavailable in this build");return;}
  String path=call.getString("path"),id=call.getString("requestId");
  try{URI uri=new URI(path==null?"":path);String p=uri.getRawPath();
   if(id==null||!id.matches("[a-zA-Z0-9_-]{1,80}")||path.length()>4096||uri.isAbsolute()||uri.getRawAuthority()!=null||uri.getFragment()!=null||p==null||!(p.matches("/tiles/[0-9]{1,2}/[0-9]{1,6}/[0-9]{1,6}\\.pbf")||p.equals("/capabilities")||p.equals("/search")||p.equals("/place")||p.equals("/route")))throw new IllegalArgumentException();
  }catch(Exception invalid){call.reject("Invalid regional request");return;}
  if(earlyCancelled.remove(id)!=null){call.reject("Regional request cancelled");return;}
  Pending job=new Pending(call);if(pending.putIfAbsent(id,job)!=null){call.reject("Duplicate regional request");return;}
  if(earlyCancelled.remove(id)!=null){job.cancel("Regional request cancelled");pending.remove(id,job);return;}
  try{
   // Admission deadline includes queue time, connection and decoding. Rejection
   // must not wait behind blocked tiles or a blocking disconnect operation.
   job.deadline=deadlines.schedule(()->{job.cancel("Regional service timed out");pending.remove(id,job);},15,TimeUnit.SECONDS);
   FutureTask<Void> task=new FutureTask<>(()->{try{
   if(job.cancelled||destroyed)throw new IOException();
   HttpURLConnection connection=(HttpURLConnection)new URL("http://10.0.2.2:47850"+path).openConnection();job.connection=connection;
   connection.setUseCaches(false);connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(10000);connection.setReadTimeout(15000);connection.setRequestProperty("Accept-Encoding","identity");connection.setRequestProperty("User-Agent","AlphaPhone-RegionalMaps/0.1");
   if(job.cancelled||destroyed)throw new IOException();int status=connection.getResponseCode();
   if(status>=300&&status<400)throw new IOException();
   InputStream raw=status>=400?connection.getErrorStream():connection.getInputStream();
   try(InputStream body="gzip".equalsIgnoreCase(connection.getContentEncoding())?new GZIPInputStream(raw):raw;ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
    byte[] buffer=new byte[8192];int n;long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(15);
    while(body!=null&&(n=body.read(buffer))!=-1){if(job.cancelled||destroyed||System.nanoTime()>deadline||bytes.size()+n>2*1024*1024)throw new IOException();bytes.write(buffer,0,n);}
    if(job.cancelled||destroyed)throw new IOException();JSObject result=new JSObject();result.put("status",status);result.put("data",Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP));job.resolve(result);
   }
  }catch(Exception unavailable){job.reject(job.cancelled?"Regional request cancelled":"Regional service unavailable");}
  finally{if(job.deadline!=null)job.deadline.cancel(false);if(job.connection!=null)job.connection.disconnect();pending.remove(id,job);}return null;});
   job.task=task;if(job.cancelled){task.cancel(false);return;}workers.execute(task);
  }catch(RejectedExecutionException busy){pending.remove(id,job);job.cancel("Regional service is busy; try again");}
 }
 @PluginMethod public void cancel(PluginCall call){String id=call.getString("requestId");Pending job=id==null?null:pending.get(id);if(job!=null){job.cancel("Regional request cancelled");pending.remove(id,job);}else if(id!=null&&id.matches("[a-zA-Z0-9_-]{1,80}")){long now=android.os.SystemClock.elapsedRealtime();earlyCancelled.entrySet().removeIf(e->now-e.getValue()>30000);if(earlyCancelled.size()<64)earlyCancelled.put(id,now);}call.resolve();}
 @Override protected void handleOnDestroy(){destroyed=true;for(Pending job:pending.values())job.cancel("Regional transport closed");workers.shutdownNow();deadlines.shutdownNow();closers.shutdown();pending.clear();earlyCancelled.clear();}
}
