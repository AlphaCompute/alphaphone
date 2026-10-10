package ai.elizaresearch.alphaphone;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.os.Build;
import android.os.Looper;
import android.util.AtomicFile;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Privacy-bounded local problem log. It keeps only failure classes: the uncaught exception's
 * class names, Android's recorded process exit reason, and renderer failure kinds. It never
 * keeps messages, stack traces, exit descriptions, trace files, URLs or user content, because
 * any of them can carry note text, addresses or account data. Stored in the no-backup
 * directory, bounded to {@link #MAX_ENTRIES} entries and {@link #RETENTION_MS}.
 */
final class AlphaCrashLog {
 static final int MAX_ENTRIES=50;
 static final long RETENTION_MS=30L*24*60*60*1000;
 private static final Object LOCK=new Object();
 private static final Pattern CLASS_NAME=Pattern.compile("[A-Za-z_$][A-Za-z0-9_$.]{0,159}");
 private static final Pattern RENDERER_KIND=Pattern.compile("render|startup|uncaught");
 private static final Pattern RENDERER_CLASS=Pattern.compile("[A-Za-z][A-Za-z0-9]{0,63}");
 private AlphaCrashLog(){}

 static File file(Context context){return new File(new File(context.getApplicationContext().getNoBackupFilesDir(),"crash-log"),"v1.json");}

 /** Main process only: records the failure class first, then lets Android's handler crash the app as usual. */
 static void install(Context context){
  Thread.UncaughtExceptionHandler previous=Thread.getDefaultUncaughtExceptionHandler();
  Thread.setDefaultUncaughtExceptionHandler(handler(context.getApplicationContext(),previous));
 }
 static Thread.UncaughtExceptionHandler handler(Context context,Thread.UncaughtExceptionHandler next){
  return (thread,error)->{
   try{
    JSONObject entry=new JSONObject();
    entry.put("source","uncaught");entry.put("errorClass",errorClass(error));
    Throwable root=error;for(int depth=0;root!=null&&root.getCause()!=null&&root.getCause()!=root&&depth<16;depth++)root=root.getCause();
    if(root!=null&&root!=error)entry.put("rootClass",errorClass(root));
    entry.put("thread",Looper.getMainLooper()!=null&&thread==Looper.getMainLooper().getThread()?"main":"background");
    entry.put("process","main");
    record(context,entry,System.currentTimeMillis());
   }catch(Throwable ignored){/* Never mask the original crash. */}
   if(next!=null)next.uncaughtException(thread,error);
  };
 }
 static String errorClass(Throwable error){
  String name=error==null?"":error.getClass().getName();
  return CLASS_NAME.matcher(name).matches()?name:"Throwable";
 }

 /** Renderer failure classes reported by the error boundary. Anything else is refused. */
 static void recordRenderer(Context context,String kind,String errorClass)throws Exception{
  if(kind==null||!RENDERER_KIND.matcher(kind).matches())throw new IllegalArgumentException("kind");
  String cls=errorClass!=null&&RENDERER_CLASS.matcher(errorClass).matches()?errorClass:"Error";
  JSONObject entry=new JSONObject();entry.put("source","renderer");entry.put("kind",kind);entry.put("errorClass",cls);entry.put("process","main");
  record(context,entry,System.currentTimeMillis());
 }

 /** Android 11+: reads the system's recorded exits of this package's processes once each. */
 static void collectExitReasons(Context context)throws Exception{
  if(Build.VERSION.SDK_INT<Build.VERSION_CODES.R)return;
  ActivityManager manager=(ActivityManager)context.getSystemService(Context.ACTIVITY_SERVICE);
  if(manager==null)return;
  List<ApplicationExitInfo> exits=manager.getHistoricalProcessExitReasons(null,0,16);
  synchronized(LOCK){
   JSONObject doc=readLocked(context);long last=doc.optLong("lastExitAt",0),newest=last;boolean changed=false;
   for(ApplicationExitInfo exit:exits){
    long at=exit.getTimestamp();if(at<=last)continue;newest=Math.max(newest,at);
    String reason=exitReason(exit.getReason(),exit.getStatus());if(reason==null)continue;
    JSONObject entry=new JSONObject();entry.put("source","exit");entry.put("reason",reason);entry.put("process",processLabel(context,exit.getProcessName()));entry.put("at",at);
    append(doc,entry);changed=true;
   }
   if(newest!=last){doc.put("lastExitAt",newest);changed=true;}
   if(changed)writeLocked(context,doc,System.currentTimeMillis());
  }
 }
 /** Ordinary exits (user, update, clean self-exit) are not problems; their reasons are skipped. */
 static String exitReason(int reason,int status){
  switch(reason){
   case ApplicationExitInfo.REASON_CRASH:return "crash";
   case ApplicationExitInfo.REASON_CRASH_NATIVE:return "native-crash";
   case ApplicationExitInfo.REASON_ANR:return "anr";
   case ApplicationExitInfo.REASON_LOW_MEMORY:return "low-memory";
   case ApplicationExitInfo.REASON_SIGNALED:return "signaled";
   case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE:return "initialization-failure";
   case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE:return "excessive-resource-usage";
   case ApplicationExitInfo.REASON_DEPENDENCY_DIED:return "dependency-died";
   case ApplicationExitInfo.REASON_FREEZER:return "freezer";
   case ApplicationExitInfo.REASON_OTHER:return "other";
   case ApplicationExitInfo.REASON_UNKNOWN:return "unknown";
   case ApplicationExitInfo.REASON_EXIT_SELF:return status==0?null:"exit-self";
   default:return null;
  }
 }
 /** Process identity without user data: the main process, a named suffix such as ":isolated_pdf", or "other". */
 static String processLabel(Context context,String process){
  String pkg=context.getPackageName();
  if(process==null||process.equals(pkg))return "main";
  if(process.startsWith(pkg+":")){String suffix=process.substring(pkg.length());if(suffix.matches(":[A-Za-z0-9_]{1,40}"))return suffix;}
  return "other";
 }

 static JSONObject read(Context context)throws Exception{synchronized(LOCK){JSONObject doc=readLocked(context);prune(doc,System.currentTimeMillis());return doc;}}
 static void clear(Context context)throws Exception{
  synchronized(LOCK){JSONObject doc=readLocked(context);JSONObject next=new JSONObject();next.put("version",1);next.put("lastExitAt",doc.optLong("lastExitAt",0));next.put("entries",new JSONArray());writeLocked(context,next,System.currentTimeMillis());}
 }
 static void record(Context context,JSONObject entry,long now)throws Exception{
  synchronized(LOCK){if(!entry.has("at"))entry.put("at",now);JSONObject doc=readLocked(context);append(doc,entry);writeLocked(context,doc,now);}
 }
 private static void append(JSONObject doc,JSONObject entry)throws Exception{doc.getJSONArray("entries").put(entry);}
 private static void prune(JSONObject doc,long now)throws Exception{
  JSONArray entries=doc.getJSONArray("entries"),kept=new JSONArray();
  for(int i=0;i<entries.length();i++){JSONObject e=entries.optJSONObject(i);if(e!=null&&e.optLong("at",0)>now-RETENTION_MS&&e.optLong("at",0)<=now+RETENTION_MS)kept.put(e);}
  JSONArray bounded=new JSONArray();for(int i=Math.max(0,kept.length()-MAX_ENTRIES);i<kept.length();i++)bounded.put(kept.get(i));
  doc.put("entries",bounded);
 }
 private static JSONObject readLocked(Context context){
  AtomicFile file=new AtomicFile(file(context));
  try(InputStream in=file.openRead()){
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int total=0,count;
   while((count=in.read(buffer))!=-1){total+=count;if(total>256*1024)throw new IOException("Crash log too large");bytes.write(buffer,0,count);}
   JSONObject doc=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
   if(doc.optInt("version")!=1||doc.optJSONArray("entries")==null)throw new IOException("Unrecognized crash log");
   return doc;
  }catch(Exception missingOrDamaged){
   // A missing or damaged log starts again; it holds no user data worth recovering.
   try{JSONObject doc=new JSONObject();doc.put("version",1);doc.put("lastExitAt",0);doc.put("entries",new JSONArray());return doc;}catch(Exception impossible){throw new IllegalStateException(impossible);}
  }
 }
 private static void writeLocked(Context context,JSONObject doc,long now)throws Exception{
  prune(doc,now);
  File target=file(context);File parent=target.getParentFile();if(parent!=null&&!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Crash log directory unavailable");
  AtomicFile file=new AtomicFile(target);FileOutputStream out=null;
  try{out=file.startWrite();out.write(doc.toString().getBytes(StandardCharsets.UTF_8));file.finishWrite(out);}
  catch(Exception error){if(out!=null)file.failWrite(out);throw error;}
 }
}
