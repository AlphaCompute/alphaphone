package ai.elizaresearch.alphaphone;

import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import androidx.webkit.JavaScriptExecutionException;
import androidx.webkit.JavaScriptExecutionWorld;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.ScriptHandler;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebViewOutcomeReceiver;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;

/** Browser downloads, always after an explicit native review.
 * HTTPS files go to the OS DownloadManager. Only the requesting tab's own
 * profile cookie for the exact same origin as its committed page is attached,
 * read at confirmation while that tab is still open; no bearer tokens, referer
 * or form bodies are copied. blob: and data: links are captured into an
 * app-owned cache file (blob: through an isolated script world that page
 * scripts cannot reach) and copied to Downloads only after review.
 * Private-tab downloads are never written to the persisted download list.
 * Completion always comes from the provider's actual row. */
final class BrowserDownloads {
 static final long MAX_CAPTURE=64L*1024*1024;
 static final int MAX_ENTRIES=50;
 private final Context context;
 private final DownloadManager manager;
 private final SharedPreferences preferences;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private AlertDialog pending,listing;
 private String pendingTab;
 private Runnable update;
 /** Positive keys are DownloadManager IDs; negative keys are captured files saved to MediaStore. */
 private final LinkedHashMap<Long,JSONObject> owned=new LinkedHashMap<>();
 private long localSequence;
 /** The requesting tab, captured by the plugin at download start. */
 static final class Source {
  final String tab,pageOrigin;final boolean priv;final Supplier<String> cookies;final String userAgent;
  Source(String tab,boolean priv,String pageOrigin,Supplier<String> cookies,String userAgent){this.tab=tab;this.priv=priv;this.pageOrigin=pageOrigin;this.cookies=cookies;this.userAgent=userAgent;}
 }
 BrowserDownloads(Context context){
  this.context=context;manager=context.getSystemService(DownloadManager.class);
  preferences=context.getSharedPreferences("alpha-browser-downloads",Context.MODE_PRIVATE);
  try{JSONArray saved=new JSONArray(preferences.getString("owned","[]"));for(int i=0;i<saved.length()&&i<MAX_ENTRIES;i++){JSONObject item=saved.getJSONObject(i);long id=item.getLong("id");
   // A private entry can only exist in a store written by an older build; never restore it.
   if(id!=0&&!item.optBoolean("private",false))owned.put(id,item);if(id<localSequence)localSequence=id;}}catch(Exception ignored){/* No outside IDs are queried. */}
 }
 /** Persist only normal-tab entries. Private-tab entries live in memory until their tab closes. */
 private void persist(){JSONArray records=new JSONArray();for(JSONObject item:owned.values())if(!item.optBoolean("private",false))records.put(item);preferences.edit().putString("owned",records.toString()).apply();}
 static String safeName(String raw,String disposition,String mime){
  String name=URLUtil.guessFileName(raw,disposition,mime).replaceAll("[^A-Za-z0-9._ -]","_").replaceAll("^[. ]+","").trim();
  if(name.isEmpty())name="download";
  return name.length()>100?name.substring(0,100):name;
 }
 private static String size(long bytes){return bytes<0?"Size unknown":bytes+" bytes";}
 static boolean validMime(String mime){return mime!=null&&mime.length()<=200&&mime.matches("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+");}
 private static boolean loopbackAllowed(Uri uri){
  // Only test-mocks debug builds (ELIZA_DEV_ALLOW_TEST_MOCKS=1) may use the loopback policy.
  return BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS && "http".equals(uri.getScheme()) && ("127.0.0.1".equals(uri.getHost())||"localhost".equals(uri.getHost()));
 }
 static boolean allowed(Uri uri){
  if(uri.getHost()==null||uri.getUserInfo()!=null)return false;
  return "https".equalsIgnoreCase(uri.getScheme())||loopbackAllowed(uri);
 }
 /** scheme://host[:port], lower case with the default port elided; null when not a web origin. */
 static String origin(String raw){
  try{Uri uri=Uri.parse(raw);String scheme=uri.getScheme(),host=uri.getHost();if(scheme==null||host==null||uri.getUserInfo()!=null)return null;
   scheme=scheme.toLowerCase(Locale.ROOT);if(!"https".equals(scheme)&&!"http".equals(scheme))return null;
   int port=uri.getPort();boolean standard=port<0||("https".equals(scheme)&&port==443)||("http".equals(scheme)&&port==80);
   return scheme+"://"+host.toLowerCase(Locale.ROOT)+(standard?"":":"+port);}catch(Exception invalid){return null;}
 }
 /** Cookies go only to the exact origin of the requesting tab's committed page. */
 static boolean cookieAllowed(String download,String pageOrigin){String target=origin(download);return target!=null&&pageOrigin!=null&&target.equals(pageOrigin);}
 /** blob:https://host/uuid belongs to its embedded origin. */
 static String blobOrigin(String raw){if(raw==null||!raw.regionMatches(true,0,"blob:",0,5))return null;return origin(raw.substring(5));}
 private void message(String text){new AlertDialog.Builder(context).setTitle("Download").setMessage(text).setPositiveButton("Close",null).show();}
 private static String privateNote(boolean priv){return priv?"\n\nPrivate tab: the file stays in Downloads after you close this tab, but it is not kept in the browser's download list.":"";}
 private boolean reviewable(){
  if(pending!=null){message("Finish the current download review first.");return false;}
  if(owned.size()>=MAX_ENTRIES){message("Download history is full. Remove an entry from Downloads first.");return false;}
  return true;
 }
 private void review(String tab,String title,String details,Runnable confirm){
  pendingTab=tab;
  pending=new AlertDialog.Builder(context).setTitle(title).setMessage(details).setNegativeButton("Cancel",null).setPositiveButton("Download",(dialog,which)->confirm.run()).create();
  AlertDialog review=pending;review.setOnDismissListener(dialog->{if(pending==review){pending=null;pendingTab=null;}});review.show();
 }
 void request(Source source,String raw,String disposition,String mime,long length,BooleanSupplier current){
  if(raw!=null&&raw.regionMatches(true,0,"data:",0,5)){requestData(source,raw,disposition,mime,current);return;}
  Uri uri;try{uri=Uri.parse(raw);if(raw.length()>8192||raw.matches("(?s).*[\\x00-\\x1f\\x7f].*")||!allowed(uri))throw new IllegalArgumentException();}catch(Exception invalid){message("Only HTTPS file downloads are supported.");return;}
  if(manager==null){message("Android downloads are unavailable.");return;}
  if(!reviewable())return;
  String name=safeName(raw,disposition,mime);
  String origin=origin(raw);
  boolean signedIn=cookieAllowed(raw,source.pageOrigin);
  String details="From: "+origin+"\nFile: "+name+"\nAdvertised size: "+size(length)+"\n\nSave to Downloads? The final size may differ. "
   +(signedIn?"Your sign-in for this site is used for this download only.":"Website sign-in is not shared with other sites.")+privateNote(source.priv);
  review(source.tab,"Download file?",details,()->{
   if(!current.getAsBoolean()){message("The source page changed. Start the download again.");return;}
   try{
    String destination=UUID.randomUUID().toString().substring(0,8)+"-"+name;
    DownloadManager.Request request=new DownloadManager.Request(uri).setTitle(name).setDescription(origin)
     .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,destination)
     .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
    if(validMime(mime))request.setMimeType(mime);
    if(source.userAgent!=null&&!source.userAgent.isEmpty()&&source.userAgent.length()<1024)request.addRequestHeader("User-Agent",source.userAgent);
    // Read now, from the still-open requesting tab's own profile. A closed tab supplies nothing.
    if(signedIn){String cookie=source.cookies==null?null:source.cookies.get();if(cookie!=null&&!cookie.isEmpty()&&cookie.length()<8192&&!cookie.matches("(?s).*[\\r\\n].*"))request.addRequestHeader("Cookie",cookie);}
    long id=manager.enqueue(request);
    owned.put(id,entry(id,name,origin,source));persist();
    show();
   }catch(Exception error){message("The download could not be queued. Check Android storage and try again.");}
  });
 }
 private static JSONObject entry(long id,String name,String origin,Source source)throws Exception{
  JSONObject item=new JSONObject();item.put("id",id);item.put("name",name);item.put("origin",origin);
  if(source.priv){item.put("private",true);item.put("tab",source.tab);}
  return item;
 }
 /** data: URLs carry their bytes inline; decode natively, never through page script. */
 static byte[] decodeData(String raw){
  int comma=raw.indexOf(',');if(comma<5||raw.length()>MAX_CAPTURE*4/3+1024)throw new IllegalArgumentException();
  String meta=raw.substring(5,comma),body=raw.substring(comma+1);boolean base64=false;
  for(String part:meta.split(";"))if("base64".equalsIgnoreCase(part.trim()))base64=true;
  byte[] bytes=base64?Base64.decode(Uri.decode(body),Base64.DEFAULT):Uri.decode(body).getBytes(java.nio.charset.StandardCharsets.UTF_8);
  if(bytes.length>MAX_CAPTURE)throw new IllegalArgumentException();
  return bytes;
 }
 static String dataMime(String raw){int comma=raw.indexOf(',');if(comma<5)return null;String type=raw.substring(5,comma).split(";")[0].trim();return validMime(type)?type.toLowerCase(Locale.ROOT):null;}
 private void requestData(Source source,String raw,String disposition,String mime,BooleanSupplier current){
  byte[] bytes;try{bytes=decodeData(raw);}catch(Exception invalid){message("This embedded file is invalid or larger than "+(MAX_CAPTURE/1048576)+" MB.");return;}
  String type=validMime(mime)?mime:dataMime(raw);
  File file;try{file=captureFile();try(OutputStream out=new FileOutputStream(file)){out.write(bytes);}}catch(Exception unavailable){message("The file could not be prepared. Check Android storage and try again.");return;}
  reviewCaptured(source,file,safeName("download",disposition,type),type,current);
 }
 private File captureFile()throws Exception{File directory=new File(context.getCacheDir(),"browser-captures");if(!directory.isDirectory()&&!directory.mkdirs())throw new IllegalStateException();return new File(directory,UUID.randomUUID().toString());}
 /** Review an app-owned captured file, then copy it to Downloads. The capture is deleted either way. */
 void reviewCaptured(Source source,File file,String name,String mime,BooleanSupplier current){
  if(!reviewable()){file.delete();return;}
  String origin=source.pageOrigin==null?"this page":source.pageOrigin;
  String details="From: "+origin+" (file created by the page)\nFile: "+name+"\nSize: "+size(file.length())+"\n\nSave to Downloads?"+privateNote(source.priv);
  boolean[] used={false};
  review(source.tab,"Download file?",details,()->{
   used[0]=true;
   if(!current.getAsBoolean()){file.delete();message("The source page changed. Start the download again.");return;}
   io.execute(()->{
    Uri saved=null;String failure=null;
    try{saved=publish(file,name,mime);}catch(Exception error){failure="The file could not be saved to Downloads. Check Android storage and try again.";}
    finally{file.delete();}
    Uri result=saved;String error=failure;
    handler.post(()->{
     if(result==null){message(error);return;}
     try{long id=--localSequence;JSONObject item=entry(id,name,origin,source);item.put("uri",result.toString());owned.put(id,item);persist();show();}catch(Exception ignored){message("Saved to Downloads.");}
    });
   });
  });
  AlertDialog review=pending;if(review!=null)review.setOnDismissListener(dialog->{if(pending==review){pending=null;pendingTab=null;}if(!used[0])file.delete();});
 }
 private Uri publish(File file,String name,String mime)throws Exception{
  ContentResolver resolver=context.getContentResolver();ContentValues values=new ContentValues();
  values.put(MediaStore.MediaColumns.DISPLAY_NAME,UUID.randomUUID().toString().substring(0,8)+"-"+name);
  values.put(MediaStore.MediaColumns.MIME_TYPE,validMime(mime)?mime:"application/octet-stream");
  values.put(MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS);
  values.put(MediaStore.MediaColumns.IS_PENDING,1);
  Uri uri=resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);if(uri==null)throw new IllegalStateException();
  try(InputStream in=new FileInputStream(file);OutputStream out=resolver.openOutputStream(uri)){
   if(out==null)throw new IllegalStateException();byte[] buffer=new byte[65536];int count;while((count=in.read(buffer))!=-1)out.write(buffer,0,count);
  }catch(Exception failure){resolver.delete(uri,null,null);throw failure;}
  ContentValues done=new ContentValues();done.put(MediaStore.MediaColumns.IS_PENDING,0);resolver.update(uri,done,null,null);
  return uri;
 }
 void cancelReview(String tab){if(Objects.equals(pendingTab,tab)&&pending!=null)pending.dismiss();}
 /** A private tab closed: forget its in-memory entries. The files stay in Downloads. */
 void forgetPrivate(String tab){boolean changed=owned.values().removeIf(item->item.optBoolean("private",false)&&tab.equals(item.optString("tab")));if(changed&&update!=null)update.run();}
 /** Clear browsing data: the browser's download list (normal and private). Files and OS transfers remain. */
 void clearHistory(){owned.clear();persist();if(listing!=null){listing.dismiss();listing=null;}}
 /** Clear data for this site: entries whose origin host is the cleared site or its subdomain. */
 void clearSite(String site){
  if(site==null||site.isEmpty())return;String domain=site.toLowerCase(Locale.ROOT);
  owned.values().removeIf(item->{String host=Uri.parse(item.optString("origin")).getHost();return host!=null&&(host.equals(domain)||host.endsWith("."+domain));});persist();
 }
 void show(){
  if(listing!=null){listing.dismiss();listing=null;}
  LinearLayout rows=new LinearLayout(context);rows.setOrientation(LinearLayout.VERTICAL);int padding=(int)(16*context.getResources().getDisplayMetrics().density);rows.setPadding(padding,padding,padding,padding);
  android.widget.ScrollView scroll=new android.widget.ScrollView(context);scroll.addView(rows);
  listing=new AlertDialog.Builder(context).setTitle("Downloads").setView(scroll).setPositiveButton("Close",null).create();
  AlertDialog list=listing;
  Runnable poll=new Runnable(){public void run(){if(listing!=list)return;render(rows);handler.removeCallbacks(this);handler.postDelayed(this,1000);}};
  list.setOnDismissListener(dialog->{handler.removeCallbacks(poll);if(listing==list){update=null;listing=null;}});
  update=poll;list.show();poll.run();
 }
 private String localLabel(JSONObject item){
  try(Cursor cursor=context.getContentResolver().query(Uri.parse(item.optString("uri")),new String[]{MediaStore.MediaColumns.SIZE},null,null,null)){
   if(cursor!=null&&cursor.moveToFirst())return "Saved to Downloads · "+size(cursor.getLong(0));
  }catch(Exception unavailable){return "Status unavailable";}
  return "Removed from Android downloads";
 }
 private void render(LinearLayout rows){
  rows.removeAllViews();
  if(owned.isEmpty()){TextView empty=new TextView(context);empty.setText("No downloads yet.");rows.addView(empty);return;}
  for(Map.Entry<Long,JSONObject> entry:new ArrayList<>(owned.entrySet())){
   long id=entry.getKey();JSONObject item=entry.getValue();int status=0,reason=0;long bytes=0,total=-1;String label;
   if(id<0)label=localLabel(item);
   else{
    try(Cursor cursor=manager.query(new DownloadManager.Query().setFilterById(id))){if(cursor!=null&&cursor.moveToFirst()){
     status=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));reason=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
     bytes=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));total=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
    }}catch(Exception unavailable){status=-1;}
    switch(status){case DownloadManager.STATUS_SUCCESSFUL:label="Complete · "+size(bytes);break;case DownloadManager.STATUS_FAILED:label="Failed · Android reason "+reason;break;case DownloadManager.STATUS_PAUSED:label="Waiting · Android reason "+reason;break;case DownloadManager.STATUS_RUNNING:label="Downloading · "+size(bytes)+" / "+size(total);break;case DownloadManager.STATUS_PENDING:label="Queued";break;case -1:label="Status unavailable";break;default:label="Removed from Android downloads";}
   }
   if(item.optBoolean("private",false))label+=" · Private tab";
   TextView text=new TextView(context);text.setText(item.optString("name")+"\n"+item.optString("origin")+"\n"+label);text.setPadding(0,12,0,8);rows.addView(text);
   boolean active=id>0&&(status==DownloadManager.STATUS_PENDING||status==DownloadManager.STATUS_RUNNING||status==DownloadManager.STATUS_PAUSED);
   Button control=new Button(context);control.setText(active?"Cancel download":"Remove entry");control.setContentDescription((active?"Cancel download ":"Remove download entry ")+item.optString("name"));
   control.setOnClickListener(view->{try{if(active)manager.remove(id);owned.remove(id);persist();render(rows);}catch(Exception error){message("Android could not cancel this download. Try again.");}});rows.addView(control);
  }
 }
 // Dismiss only UI; OS-owned transfers and durable history remain intact.
 void dismissDialogs(){
  if(update!=null)handler.removeCallbacks(update);update=null;
  AlertDialog review=pending,list=listing;pending=null;pendingTab=null;listing=null;
  if(review!=null)review.dismiss();if(list!=null)list.dismiss();
 }
 void destroy(){dismissDialogs();io.shutdown();}

 /** Captures a page-created blob: download into an app-owned file. The script
  * runs in a dedicated isolated JavaScript world: page scripts cannot see its
  * message channel or replace its fetch, and native code accepts only chunks
  * for the one capture it started, from the main frame of the same origin. */
 static final class BlobCapture {
  private static final String CHANNEL="__alphaBrowserCapture";
  private static final int CHUNK=384*1024;
  interface Done{void accept(File file,String mime);}
  private final WebView web;
  private final File directory;
  private JavaScriptExecutionWorld world;
  private ScriptHandler script;
  private JavaScriptReplyProxy proxy;
  private String proxyOrigin;
  private String nonce;
  private File file;
  private OutputStream out;
  private long written;
  private int nextChunk;
  private Done done;
  private java.util.function.Consumer<String> failed;
  private boolean closed;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final Runnable timeout=()->fail("The page did not provide the file in time.");
  BlobCapture(WebView web,File directory){
   this.web=web;this.directory=directory;
   if(!WebViewFeature.isFeatureSupported(WebViewFeature.JS_INJECTION_IN_FRAME_AND_WORLD))return;
   try{
    world=WebViewCompat.getExecutionWorld(web,"alpha-browser-capture-v1");
    // The wildcard exists only in this isolated world, never in the page world.
    WebViewCompat.addWebMessageListener(web,CHANNEL,Set.of("*"),world,(view,message,source,isMainFrame,reply)->receive(view,message,source.toString(),isMainFrame,reply));
    // Registered before the tab loads any document, so every later main-frame document announces itself.
    script=WebViewCompat.addJavaScriptOnEvent(web,"if(window===window.top){"+CHANNEL+".postMessage('ready');}",WebViewCompat.INJECTION_EVENT_DOCUMENT_END,Set.of("*"),world);
   }catch(RuntimeException unavailable){close();}
  }
  boolean supported(){return !closed&&world!=null;}
  private static String pageOrigin(String url){return origin(url);}
  private void receive(WebView view,WebMessageCompat message,String source,boolean main,JavaScriptReplyProxy reply){
   if(closed||view!=web||!main||message.getType()!=WebMessageCompat.TYPE_STRING)return;
   String data=message.getData(),sender=pageOrigin(source),actual=pageOrigin(web.getUrl());
   if(data==null||sender==null||!sender.equals(actual))return;
   if("ready".equals(data)){if(nonce!=null&&!sender.equals(proxyOrigin))fail("The page changed before the file was saved.");proxy=reply;proxyOrigin=sender;return;}
   if(nonce==null||reply!=proxy||!sender.equals(proxyOrigin))return;
   String[] parts=data.split(":",4);if(parts.length<3||!nonce.equals(parts[1]))return;
   try{
    if("c".equals(parts[0])&&parts.length==4){
     if(Integer.parseInt(parts[2])!=nextChunk){fail("The file was not received in order.");return;}
     byte[] bytes=Base64.decode(parts[3],Base64.NO_WRAP);written+=bytes.length;nextChunk++;
     if(written>MAX_CAPTURE){fail("The file is larger than "+(MAX_CAPTURE/1048576)+" MB.");return;}
     out.write(bytes);handler.removeCallbacks(timeout);handler.postDelayed(timeout,30000);
    }else if("e".equals(parts[0])&&parts.length==4){
     if(Integer.parseInt(parts[2])!=nextChunk){fail("The file was incomplete.");return;}
     out.close();out=null;File result=file;Done callback=done;String mime=validMime(parts[3])?parts[3].toLowerCase(Locale.ROOT):null;reset(false);
     if(callback!=null)callback.accept(result,mime);
    }else if("x".equals(parts[0])){
     fail("size".equals(parts[2])?"The file is larger than "+(MAX_CAPTURE/1048576)+" MB.":"The website removed this file before it could be saved. Try the download again.");
    }
   }catch(Exception invalid){fail("The file could not be saved.");}
  }
  /** Start capturing one blob URL of the current document's own origin. */
  void capture(String blobUrl,Done onDone,java.util.function.Consumer<String> onFailure){
   String owner=blobOrigin(blobUrl),actual=pageOrigin(web.getUrl());
   if(!supported()){onFailure.accept("This Android System WebView cannot save files created by the page. Update Android System WebView.");return;}
   if(nonce!=null){onFailure.accept("Another file from this page is still being prepared.");return;}
   if(owner==null||!owner.equals(actual)||proxy==null||!owner.equals(proxyOrigin)||blobUrl.length()>2048||!blobUrl.matches("(?i)blob:[A-Za-z0-9:/._%\\[\\]-]+")){onFailure.accept("This file could not be saved from this page.");return;}
   try{file=new File(directory,UUID.randomUUID().toString());if(!directory.isDirectory()&&!directory.mkdirs())throw new IllegalStateException();out=new FileOutputStream(file);}catch(Exception unavailable){reset(true);onFailure.accept("The file could not be prepared. Check Android storage and try again.");return;}
   nonce=UUID.randomUUID().toString().replace("-","");written=0;nextChunk=0;done=onDone;failed=onFailure;
   String js="(async()=>{const n='"+nonce+"',p=m=>"+CHANNEL+".postMessage(m);try{const r=await fetch("+JSONObject.quote(blobUrl)+");const b=await r.blob();"
    +"if(b.size>"+MAX_CAPTURE+"){p('x:'+n+':size');return;}let i=0;for(let o=0;o<b.size;o+="+CHUNK+",i++){const u=new Uint8Array(await b.slice(o,o+"+CHUNK+").arrayBuffer());let s='';"
    +"for(let j=0;j<u.length;j+=32768)s+=String.fromCharCode.apply(null,u.subarray(j,j+32768));p('c:'+n+':'+i+':'+btoa(s));}p('e:'+n+':'+i+':'+(b.type||''));}catch(e){p('x:'+n+':fetch');}})();'started'";
   handler.postDelayed(timeout,30000);
   try{proxy.executeJavaScript(js,new WebViewOutcomeReceiver<String,JavaScriptExecutionException>(){
    @Override public void onResult(String value){}
    @Override public void onError(JavaScriptExecutionException error){fail("This file could not be saved from this page.");}
   });}catch(RuntimeException unavailable){fail("This file could not be saved from this page.");}
  }
  private void fail(String reason){java.util.function.Consumer<String> callback=failed;boolean active=nonce!=null;reset(true);if(active&&callback!=null)callback.accept(reason);}
  private void reset(boolean delete){
   handler.removeCallbacks(timeout);nonce=null;done=null;failed=null;written=0;nextChunk=0;
   if(out!=null){try{out.close();}catch(Exception ignored){}out=null;}
   if(delete&&file!=null)file.delete();file=null;
  }
  /** Navigation or tab change: abandon a capture in progress. */
  void cancel(){reset(true);}
  void close(){
   if(closed)return;closed=true;reset(true);proxy=null;proxyOrigin=null;
   if(script!=null){try{script.remove();}catch(RuntimeException ignored){}script=null;}
   if(world!=null){try{WebViewCompat.removeWebMessageListener(web,world,CHANNEL);}catch(RuntimeException ignored){}world=null;}
  }
 }
 File captureDirectory(){return new File(context.getCacheDir(),"browser-captures");}
 /** Startup: remove captures abandoned by a previous process. */
 void purgeStaleCaptures(){File[] stale=captureDirectory().listFiles();if(stale!=null)for(File file:stale)file.delete();}
}
