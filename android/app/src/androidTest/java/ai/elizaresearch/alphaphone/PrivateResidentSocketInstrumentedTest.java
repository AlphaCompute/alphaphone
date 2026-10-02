package ai.elizaresearch.alphaphone;

import android.content.*;
import android.net.*;
import android.os.*;
import android.os.Process;
import android.system.*;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.file.Files;
import java.util.concurrent.*;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

/** Actual ordinary cross-UID denial at the production filesystem endpoint. No real runtime/provider. */
public final class PrivateResidentSocketInstrumentedTest {
 private static void mode(String path,int bits,boolean socket)throws Exception{
  StructStat st=Os.lstat(path);assertEquals(Process.myUid(),st.st_uid);assertEquals(bits,st.st_mode&0777);
  assertTrue(socket?OsConstants.S_ISSOCK(st.st_mode):OsConstants.S_ISDIR(st.st_mode));
 }
 private static void positive(LocalServerSocket server,String path)throws Exception{
  try(LocalSocket client=new LocalSocket()){
   client.connect(new LocalSocketAddress(path,LocalSocketAddress.Namespace.FILESYSTEM),2000);
   try(LocalSocket accepted=server.accept()){
    assertEquals(Process.myUid(),accepted.getPeerCredentials().getUid());
    assertEquals(Process.myUid(),client.getPeerCredentials().getUid());
    client.getOutputStream().write(73);client.getOutputStream().flush();accepted.setSoTimeout(2000);
    assertEquals("Live same-UID control byte",73,accepted.getInputStream().read());
   }
  }
 }
 @Test public void ordinaryOtherUidCannotReachPrivateEndpoint()throws Exception{
  assertEquals("Explicit supervisor required","1",InstrumentationRegistry.getArguments().getString("privatePeerFixture"));
  assertTrue(BuildConfig.DEBUG);assertTrue(Process.myUid()/100000>0);
  String runId=InstrumentationRegistry.getArguments().getString("privatePeerRunId","");assertTrue(runId.matches("[0-9a-f-]{36}"));
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  JSONObject boot=ElizaAgentService.getLocalAgentBootState(context);assertFalse(boot.getBoolean("serviceActive"));assertFalse(boot.getBoolean("socketListening"));
  File home=context.getFilesDir().getCanonicalFile();File directory=new File(home,"ipc");
  assertEquals(directory.getPath(),directory.getCanonicalPath());mode(directory.getPath(),0700,false);
  String path=new File(directory,"a.sock").getPath();
  java.lang.reflect.Method endpoint=ElizaAgentService.class.getDeclaredMethod("localSocketPath");endpoint.setAccessible(true);assertEquals(path,endpoint.invoke(null));
  try{Os.lstat(path);fail("Preserve existing endpoint");}catch(ErrnoException missing){assertEquals(OsConstants.ENOENT,missing.errno);}
  LocalSocket bound=new LocalSocket();LocalServerSocket server=null;long inode=-1;
  CountDownLatch ready=new CountDownLatch(1);IBinder[] peer=new IBinder[1];boolean binding=false;
  ServiceConnection connection=new ServiceConnection(){public void onServiceConnected(ComponentName name,IBinder binder){peer[0]=binder;ready.countDown();}public void onServiceDisconnected(ComponentName name){peer[0]=null;}};
  Throwable primary=null;
  try{
   bound.bind(new LocalSocketAddress(path,LocalSocketAddress.Namespace.FILESYSTEM));Os.chmod(path,0600);mode(path,0600,true);inode=Os.lstat(path).st_ino;
   server=new LocalServerSocket(bound.getFileDescriptor());positive(server,path);
   Intent intent=new Intent().setClassName("ai.elizaresearch.alphaphone.peerfixture","ai.elizaresearch.alphaphone.peerfixture.PrivateSocketProbeService").putExtra("privatePeerFixture",true).putExtra("runId",runId);
   binding=context.bindService(intent,connection,Context.BIND_AUTO_CREATE);assertTrue(binding);assertTrue(ready.await(10,TimeUnit.SECONDS));assertNotNull(peer[0]);
   Parcel in=Parcel.obtain(),out=Parcel.obtain();
   try{
    in.writeString(runId);assertTrue(peer[0].transact(IBinder.FIRST_CALL_TRANSACTION,in,out,0));
    int uid=out.readInt();assertNotEquals(Process.myUid(),uid);assertEquals(Process.myUid()/100000,uid/100000);
    assertEquals(context.getPackageManager().getPackageUid("ai.elizaresearch.alphaphone.peerfixture",0),uid);
    assertEquals(runId,out.readString());assertEquals(path,out.readString());int errno=out.readInt();
    assertTrue("Actual filesystem permission rejection, errno="+errno,errno==OsConstants.EACCES||errno==OsConstants.EPERM);
    assertEquals("Cross-UID socket connect must fail",0,out.readInt());
   }finally{in.recycle();out.recycle();}
   StructPollfd poll=new StructPollfd();poll.fd=server.getFileDescriptor();poll.events=(short)OsConstants.POLLIN;
   assertEquals("No hostile connection queued after synchronous probe returned",0,Os.poll(new StructPollfd[]{poll},100));
   mode(directory.getPath(),0700,false);mode(path,0600,true);assertEquals(inode,Os.lstat(path).st_ino);
   positive(server,path);
  }catch(Exception|AssertionError failure){primary=failure;throw failure;}finally{
   java.util.List<Throwable> failures=new java.util.ArrayList<>();
   try{if(binding)context.unbindService(connection);}catch(Throwable error){failures.add(error);}
   try{if(server!=null)server.close();}catch(Throwable error){failures.add(error);}
   try{bound.close();}catch(Throwable error){failures.add(error);}
   try{if(inode!=-1){mode(path,0600,true);assertEquals("Only owned socket removed",inode,Os.lstat(path).st_ino);Files.delete(new File(path).toPath());}}catch(Throwable error){failures.add(error);}
   if(!failures.isEmpty()){
    if(primary!=null){for(Throwable error:failures)primary.addSuppressed(error);}
    else{AssertionError cleanup=new AssertionError("Owned fixture cleanup failed");for(Throwable error:failures)cleanup.addSuppressed(error);throw cleanup;}
   }
  }
 }
}
