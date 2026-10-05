package ai.elizaresearch.alphaphone;

import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.pdf.PdfRenderer;
import android.os.*;
import android.system.OsConstants;
import java.nio.ByteBuffer;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Untrusted PDF parsing is confined to a permissionless isolated process. */
public final class IsolatedPdfService extends Service {
 static final int MAX_PIXELS=1500000, MAX_PAGES=500, DEADLINE_MS=10000;
 private final Handler main=new Handler(Looper.getMainLooper());
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final AtomicBoolean busy=new AtomicBoolean();
 private final Runnable kill=()->{if(android.os.Process.isIsolated())android.os.Process.killProcess(android.os.Process.myPid());};
 private final Runnable memory=new Runnable(){public void run(){if(!busy.get())return;if(Debug.getPss()>128*1024){kill.run();return;}main.postDelayed(this,250);}};
 private final Messenger endpoint=new Messenger(new Handler(Looper.getMainLooper(),message->{
  if(message.what!=1||message.replyTo==null)return true;
  Bundle data=message.getData();ParcelFileDescriptor descriptor=data.getParcelable("descriptor");
  String request=data.getString("request","");int page=data.getInt("page",-1);Messenger reply=message.replyTo;
  if(!android.os.Process.isIsolated()||descriptor==null||request.length()!=36||page<0||page>=MAX_PAGES||!busy.compareAndSet(false,true)){
   close(descriptor);error(reply,request,"PDF request unavailable");return true;
  }
  main.postDelayed(kill,DEADLINE_MS);main.post(memory);
  boolean block=BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS&&"watchdog".equals(data.getString("fixture"));
  worker.execute(()->render(descriptor,page,request,reply,block));return true;
 }));
 @Override public IBinder onBind(Intent intent){return android.os.Process.isIsolated()?endpoint.getBinder():null;}
 private static void close(ParcelFileDescriptor descriptor){if(descriptor!=null)try{descriptor.close();}catch(Exception ignored){}}
 private static void send(Messenger target,Bundle bundle)throws RemoteException{Message message=Message.obtain(null,1);message.setData(bundle);target.send(message);}
 private static void error(Messenger target,String request,String text){try{Bundle result=new Bundle();result.putString("request",request);result.putString("error",text);send(target,result);}catch(Exception ignored){}}
 private void render(ParcelFileDescriptor descriptor,int index,String request,Messenger reply,boolean block){
  Bitmap bitmap=null;SharedMemory shared=null;ByteBuffer mapping=null;Bundle completed=null;
  try{
   if(block)Thread.sleep(DEADLINE_MS+5000L);
   long size=descriptor.getStatSize();if(size<=0||size>5*1024*1024)throw new IllegalArgumentException();
   try(PdfRenderer renderer=new PdfRenderer(descriptor)){
    int count=renderer.getPageCount();if(count<1||count>MAX_PAGES||index>=count)throw new IllegalArgumentException();
    try(PdfRenderer.Page page=renderer.openPage(index)){
     int pw=page.getWidth(),ph=page.getHeight();if(pw<1||ph<1||pw>20000||ph>20000)throw new IllegalArgumentException();
     double scale=Math.min(Math.min(1024d/pw,1536d/ph),Math.sqrt(MAX_PIXELS/((double)pw*ph)));
     int width=Math.max(1,(int)Math.floor(pw*scale)),height=Math.max(1,(int)Math.floor(ph*scale));
     if((long)width*height>MAX_PIXELS)throw new IllegalArgumentException();
     bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);bitmap.eraseColor(Color.WHITE);
     Matrix transform=new Matrix();transform.setScale(width/(float)pw,height/(float)ph);page.render(bitmap,null,transform,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
     int length=Math.multiplyExact(Math.multiplyExact(width,height),4);if(bitmap.getByteCount()!=length)throw new IllegalStateException();
     shared=SharedMemory.create("reviewed-pdf-page",length);mapping=shared.mapReadWrite();bitmap.copyPixelsToBuffer(mapping);SharedMemory.unmap(mapping);mapping=null;
     if(!shared.setProtect(OsConstants.PROT_READ))throw new IllegalStateException();
     Bundle result=new Bundle();result.putString("request",request);result.putParcelable("pixels",shared);result.putInt("width",width);result.putInt("height",height);result.putInt("pages",count);result.putInt("page",index);result.putInt("uid",android.os.Process.myUid());result.putBoolean("isolated",android.os.Process.isIsolated());result.putBoolean("internetDenied",checkSelfPermission(android.Manifest.permission.INTERNET)==android.content.pm.PackageManager.PERMISSION_DENIED);completed=result;
    }
   }
  }catch(Exception|OutOfMemoryError failure){completed=null;}
  finally{
   if(mapping!=null)SharedMemory.unmap(mapping);if(bitmap!=null)bitmap.recycle();close(descriptor);
   Bundle result=completed;SharedMemory output=shared;
   main.post(()->{main.removeCallbacks(kill);main.removeCallbacks(memory);busy.set(false);try{if(result==null)error(reply,request,"PDF is corrupt, password protected, expired, or exceeds viewer limits.");else send(reply,result);}catch(Exception ignored){}finally{if(output!=null)output.close();}});
  }
 }
 @Override public boolean onUnbind(Intent intent){kill.run();return false;}
 @Override public void onDestroy(){worker.shutdownNow();kill.run();super.onDestroy();}
}
