package ai.elizaresearch.alphaphone;

import android.app.Service;
import android.content.Intent;
import android.net.LocalServerSocket;
import android.net.LocalSocket;
import android.os.Binder;
import android.os.IBinder;
import android.os.Parcel;
import android.os.Process;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

/** DEBUG SOURCE SET ONLY. Isolated UID socket peer; reads counters, never records received data. */
public final class ResidentHostileSocketService extends Service {
 public static final int STATUS=IBinder.FIRST_CALL_TRANSACTION, RELEASE=STATUS+1;
 private static final String NAME="ai.elizaresearch.alphaphone.agent.v1";
 private final Object lock=new Object();
 private final List<LocalSocket> sockets=new ArrayList<>();
 private LocalServerSocket listener;
 private Thread worker;
 private int accepted,bytes,eof;
 private volatile boolean stopped;
 private String failure;
 private final Binder binder=new Binder(){
  @Override protected boolean onTransact(int code,Parcel data,Parcel reply,int flags){
   if(code==RELEASE){shutdown();reply.writeInt(worker==null||!worker.isAlive()?1:0);return true;}
   if(code!=STATUS)return false;
   synchronized(lock){reply.writeInt(Process.myUid());reply.writeInt(accepted);reply.writeInt(bytes);reply.writeInt(eof);reply.writeString(failure);}
   return true;
  }
 };
 @Override public IBinder onBind(Intent intent){
  if(!BuildConfig.DEBUG||intent==null||!intent.getBooleanExtra("residentPeerFixture",false)||!(intent.getStringExtra("runId")==null?"":intent.getStringExtra("runId")).matches("[0-9a-f-]{36}"))throw new SecurityException("Explicit fixture admission required");
  try{listener=new LocalServerSocket(NAME);}catch(Exception error){throw new IllegalStateException("Fixture socket not available",error);}
  worker=new Thread(()->{
   try{while(!stopped){
    android.system.StructPollfd poll=new android.system.StructPollfd();poll.fd=listener.getFileDescriptor();poll.events=(short)android.system.OsConstants.POLLIN;if(android.system.Os.poll(new android.system.StructPollfd[]{poll},100)==0)continue;if(stopped)break;
    LocalSocket socket=listener.accept();socket.setSoTimeout(5000);
    synchronized(lock){sockets.add(socket);accepted++;}
    // A wrong-UID client must close without writing even one protocol byte.
    // Never retain input bytes: only a bounded count for a failing assertion.
    int value;while((value=socket.getInputStream().read())!=-1){synchronized(lock){bytes++;if(bytes>65536)throw new IllegalStateException("Fixture input limit");}}
    synchronized(lock){eof++;}socket.close();
   }}catch(Exception error){if(!stopped)synchronized(lock){failure=error.getClass().getSimpleName();}}
  },"resident-hostile-peer");worker.start();return binder;
 }
 private void shutdown(){
  stopped=true;
  try{if(listener!=null)listener.close();}catch(Exception ignored){}
  synchronized(lock){for(LocalSocket socket:sockets)try{socket.close();}catch(Exception ignored){}}
  if(worker!=null)try{worker.join(5000);}catch(InterruptedException error){Thread.currentThread().interrupt();}
 }
 @Override public void onDestroy(){shutdown();super.onDestroy();
 }
}
