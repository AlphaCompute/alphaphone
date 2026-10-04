package ai.elizaresearch.alphaphone;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.Parcel;
import android.os.Process;
import android.os.SystemClock;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import static org.junit.Assert.*;

/** Real Android kernel peer UID check, controlled socket only; no provider/runtime start. */
public final class ResidentPeerUidInstrumentedTest {
 private static final class Status {int uid,accepted,bytes,eof;String error;}
 private static Status status(IBinder peer,String runId)throws Exception{
  Parcel input=Parcel.obtain(),output=Parcel.obtain();try{input.writeString(runId);assertTrue(peer.transact(IBinder.FIRST_CALL_TRANSACTION,input,output,0));Status s=new Status();s.uid=output.readInt();s.accepted=output.readInt();s.bytes=output.readInt();s.eof=output.readInt();s.error=output.readString();assertEquals("Peer run identity",runId,output.readString());return s;}finally{input.recycle();output.recycle();}
 }
 private static String request()throws Exception{return new JSONObject().put("path","/api/peer-fixture").put("method","POST").put("timeoutMs",5000).put("headers",new JSONObject().put("Authorization","Bearer synthetic-peer-credential-"+UUID.randomUUID())).put("body","synthetic-private-body-"+UUID.randomUUID()).toString();}
 private static void sameUidSuccess()throws Exception{
  java.util.concurrent.atomic.AtomicReference<Throwable> failure=new java.util.concurrent.atomic.AtomicReference<>();
  try(android.net.LocalServerSocket server=new android.net.LocalServerSocket("ai.elizaresearch.alphaphone.agent.v1")){
   Thread worker=new Thread(()->{try{for(int i=0;i<2;i++)try(android.net.LocalSocket socket=server.accept()){
    socket.setSoTimeout(5000);assertEquals(Process.myUid(),socket.getPeerCredentials().getUid());
    java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();int b;while((b=socket.getInputStream().read())!=-1&&b!='\n'){assertTrue(bytes.size()<16384);bytes.write(b);}assertEquals('\n',b);
    JSONObject frame=new JSONObject(bytes.toString("UTF-8"));assertTrue(frame.getJSONObject("payload").getJSONObject("headers").getString("Authorization").startsWith("Bearer synthetic-peer-credential-"));assertTrue(frame.getJSONObject("payload").getString("body").startsWith("synthetic-private-body-"));assertEquals(i==0?"http_request":"http_request_stream",frame.getString("method"));
    String response=i==0?"{\"ok\":true,\"result\":{\"status\":200,\"body\":\"same-uid\"}}\n":"{\"stream\":\"response\",\"status\":200,\"headers\":{}}\n{\"stream\":\"complete\"}\n";
    socket.getOutputStream().write(response.getBytes(java.nio.charset.StandardCharsets.UTF_8));socket.getOutputStream().flush();
   }}catch(Throwable error){failure.set(error);}},"same-uid-positive-control");worker.start();
   try{
    assertEquals("same-uid",new JSONObject(ElizaAgentService.requestLocalAgent(request())).getString("body"));
    List<JSONObject> events=new ArrayList<>();ElizaAgentService.requestLocalAgentStream(request(),event->{try{events.add(new JSONObject(event));}catch(Exception error){throw new AssertionError(error);}},new ElizaAgentService.LocalStreamHandle());
    assertEquals(2,events.size());assertEquals("response",events.get(0).getString("type"));assertEquals("complete",events.get(1).getString("type"));assertFalse(events.get(1).has("error"));
   }finally{server.close();worker.join(5000);assertFalse(worker.isAlive());assertNull(failure.get());}
  }
 }
 @Test public void wrongUidReceivesZeroBytesThenSameUidSucceeds()throws Exception{
  Assume.assumeTrue("Explicit supervisor only","1".equals(InstrumentationRegistry.getArguments().getString("residentPeerFixture")));
  assertTrue(BuildConfig.DEBUG);assertTrue("Disposable user required",Process.myUid()/100000>0);
  String runId=InstrumentationRegistry.getArguments().getString("residentPeerRunId","");assertTrue(runId.matches("[0-9a-f-]{36}"));
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();JSONObject boot=ElizaAgentService.getLocalAgentBootState(context);assertFalse(boot.getBoolean("serviceActive"));assertFalse(boot.getBoolean("socketListening"));
  CountDownLatch connected=new CountDownLatch(1),disconnected=new CountDownLatch(1);IBinder[] peer=new IBinder[1];
  ServiceConnection connection=new ServiceConnection(){public void onServiceConnected(ComponentName name,IBinder binder){peer[0]=binder;connected.countDown();}public void onServiceDisconnected(ComponentName name){disconnected.countDown();}};
  Intent intent=new Intent().setClassName("ai.elizaresearch.alphaphone.peerfixture","ai.elizaresearch.alphaphone.peerfixture.ResidentHostileSocketService").putExtra("residentPeerFixture",true).putExtra("runId",runId);
  boolean bound=context.bindService(intent,connection,Context.BIND_AUTO_CREATE);assertTrue("Bind ordinary separate UID debug fixture",bound);
  Throwable primary=null;
  try{
   assertTrue(connected.await(10,TimeUnit.SECONDS));Status before=status(peer[0],runId);assertNotEquals("Actual different kernel UID",Process.myUid(),before.uid);assertEquals(0,before.bytes);assertEquals(0,before.accepted);assertNull(before.error);
   try{ElizaAgentService.requestLocalAgent(request());fail("Wrong UID buffered request accepted");}catch(SecurityException expected){}
   List<JSONObject> events=new ArrayList<>();ElizaAgentService.requestLocalAgentStream(request(),event->{try{events.add(new JSONObject(event));}catch(Exception error){throw new AssertionError(error);}},new ElizaAgentService.LocalStreamHandle());
   assertEquals("Exactly one terminal, no response data",1,events.size());assertEquals("complete",events.get(0).getString("type"));assertTrue(events.get(0).has("error"));
   java.lang.reflect.Method probe=ElizaAgentService.class.getDeclaredMethod("isLocalAgentSocketListening");probe.setAccessible(true);assertEquals("Wrong UID is not an adoptable runtime",false,probe.invoke(null));
   long deadline=SystemClock.elapsedRealtime()+5000;Status observed=status(peer[0],runId);while(observed.eof<3&&SystemClock.elapsedRealtime()<deadline){SystemClock.sleep(20);observed=status(peer[0],runId);}
   assertNull(observed.error);assertEquals("One connection per API and liveness probe; no retry",3,observed.accepted);assertEquals("All clients closed",3,observed.eof);assertEquals("No credential, body or protocol byte released",0,observed.bytes);
  }catch(Exception|AssertionError failure){
   primary=failure;
   if(peer[0]!=null)try{Status diagnostic=status(peer[0],runId);failure.addSuppressed(new AssertionError("Peer counters uid="+diagnostic.uid+" accepted="+diagnostic.accepted+" bytes="+diagnostic.bytes+" eof="+diagnostic.eof+" error="+diagnostic.error));}catch(Throwable diagnosticFailure){failure.addSuppressed(diagnosticFailure);}
   throw failure;
  }finally{
   try{
   if(peer[0]!=null){Parcel in=Parcel.obtain(),out=Parcel.obtain();try{in.writeString(runId);assertTrue(peer[0].transact(IBinder.FIRST_CALL_TRANSACTION+1,in,out,0));assertEquals("Hostile fixture worker stopped",1,out.readInt());}finally{in.recycle();out.recycle();context.unbindService(connection);}}
   else context.unbindService(connection);
   }catch(Exception|AssertionError cleanupFailure){if(primary!=null)primary.addSuppressed(cleanupFailure);else throw cleanupFailure;}
  }
  sameUidSuccess();
 }
}
