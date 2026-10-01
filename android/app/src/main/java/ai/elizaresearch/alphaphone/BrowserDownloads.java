package ai.elizaresearch.alphaphone;

import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.URLUtil;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.*;
import java.util.function.BooleanSupplier;

/** OS-owned public downloads. No browser cookies, bearer tokens, referer or
 * form bodies are copied to DownloadManager; authenticated/blob downloads are
 * outside this slice. Completion always comes from the provider's actual row. */
final class BrowserDownloads {
 private final Context context;
 private final DownloadManager manager;
 private final SharedPreferences preferences;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private AlertDialog pending,listing;
 private String pendingTab;
 private Runnable update;
 private final LinkedHashMap<Long,JSONObject> owned=new LinkedHashMap<>();
 BrowserDownloads(Context context){
  this.context=context;manager=context.getSystemService(DownloadManager.class);
  preferences=context.getSharedPreferences("alpha-browser-downloads",Context.MODE_PRIVATE);
  try{JSONArray saved=new JSONArray(preferences.getString("owned","[]"));for(int i=0;i<saved.length()&&i<50;i++){JSONObject item=saved.getJSONObject(i);long id=item.getLong("id");if(id>0)owned.put(id,item);}}catch(Exception ignored){/* No outside IDs are queried. */}
 }
 private void persist(){JSONArray records=new JSONArray();for(JSONObject item:owned.values())records.put(item);preferences.edit().putString("owned",records.toString()).apply();}
 static String safeName(String raw,String disposition,String mime){
  String name=URLUtil.guessFileName(raw,disposition,mime).replaceAll("[^A-Za-z0-9._ -]","_").replaceAll("^[. ]+","").trim();
  if(name.isEmpty())name="download";
  return name.length()>100?name.substring(0,100):name;
 }
 private static String size(long bytes){return bytes<0?"Size unknown":bytes+" bytes";}
 private boolean allowed(Uri uri){
  if(uri.getHost()==null||uri.getUserInfo()!=null)return false;
  if("https".equalsIgnoreCase(uri.getScheme()))return true;
  // Only disposable instrumentation can use the existing debug loopback policy.
  return BuildConfig.DEBUG && "http".equals(uri.getScheme()) && ("127.0.0.1".equals(uri.getHost())||"localhost".equals(uri.getHost()));
 }
 private void message(String text){new AlertDialog.Builder(context).setTitle("Download").setMessage(text).setPositiveButton("Close",null).show();}
 void request(String tab,String raw,String disposition,String mime,long length,BooleanSupplier current){
  Uri uri;try{uri=Uri.parse(raw);if(raw.length()>8192||raw.matches("(?s).*[\\x00-\\x1f\\x7f].*")||!allowed(uri))throw new IllegalArgumentException();}catch(Exception invalid){message("Only public HTTPS file downloads are supported.");return;}
  if(manager==null){message("Android downloads are unavailable.");return;}
  if(pending!=null){message("Finish the current download review first.");return;}
  if(owned.size()>=50){message("Download history is full. Remove an entry from Downloads first.");return;}
  String name=safeName(raw,disposition,mime);
  String origin=uri.getScheme()+"://"+uri.getHost()+(uri.getPort()<0?"":":"+uri.getPort());
  String details="From: "+origin+"\nFile: "+name+"\nAdvertised size: "+size(length)+"\n\nSave to Downloads? The final size may differ. Website sign-in is not shared.";
  pendingTab=tab;
  pending=new AlertDialog.Builder(context).setTitle("Download file?").setMessage(details).setNegativeButton("Cancel",null).setPositiveButton("Download",(dialog,which)->{
   if(!current.getAsBoolean()){message("The source page changed. Start the download again.");return;}
   try{
    String destination=UUID.randomUUID().toString().substring(0,8)+"-"+name;
    DownloadManager.Request request=new DownloadManager.Request(uri).setTitle(name).setDescription(origin)
     .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,destination)
     .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
    if(mime!=null&&mime.matches("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+"))request.setMimeType(mime);
    long id=manager.enqueue(request);
    JSONObject item=new JSONObject();item.put("id",id);item.put("name",name);item.put("origin",origin);owned.put(id,item);persist();
    show();
   }catch(Exception error){message("The download could not be queued. Check Android storage and try again.");}
  }).create();
  AlertDialog review=pending;review.setOnDismissListener(dialog->{if(pending==review){pending=null;pendingTab=null;}});review.show();
 }
 void cancelReview(String tab){if(Objects.equals(pendingTab,tab)&&pending!=null)pending.dismiss();}
 void show(){
  if(listing!=null){listing.dismiss();listing=null;}
  LinearLayout rows=new LinearLayout(context);rows.setOrientation(LinearLayout.VERTICAL);int padding=(int)(16*context.getResources().getDisplayMetrics().density);rows.setPadding(padding,padding,padding,padding);
  android.widget.ScrollView scroll=new android.widget.ScrollView(context);scroll.addView(rows);
  listing=new AlertDialog.Builder(context).setTitle("Downloads").setView(scroll).setPositiveButton("Close",null).create();
  AlertDialog list=listing;
  Runnable poll=new Runnable(){public void run(){if(listing!=list)return;render(rows);handler.postDelayed(this,1000);}};
  list.setOnDismissListener(dialog->{handler.removeCallbacks(poll);if(listing==list){update=null;listing=null;}});
  update=poll;list.show();poll.run();
 }
 private void render(LinearLayout rows){
  rows.removeAllViews();
  if(owned.isEmpty()){TextView empty=new TextView(context);empty.setText("No downloads yet.");rows.addView(empty);return;}
  for(Map.Entry<Long,JSONObject> entry:new ArrayList<>(owned.entrySet())){
   long id=entry.getKey();JSONObject item=entry.getValue();int status=0,reason=0;long bytes=0,total=-1;
   try(Cursor cursor=manager.query(new DownloadManager.Query().setFilterById(id))){if(cursor!=null&&cursor.moveToFirst()){
    status=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));reason=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
    bytes=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));total=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
   }}catch(Exception unavailable){status=-1;}
   String label;
   switch(status){case DownloadManager.STATUS_SUCCESSFUL:label="Complete · "+size(bytes);break;case DownloadManager.STATUS_FAILED:label="Failed · Android reason "+reason;break;case DownloadManager.STATUS_PAUSED:label="Waiting · Android reason "+reason;break;case DownloadManager.STATUS_RUNNING:label="Downloading · "+size(bytes)+" / "+size(total);break;case DownloadManager.STATUS_PENDING:label="Queued";break;case -1:label="Status unavailable";break;default:label="Removed from Android downloads";}
   TextView text=new TextView(context);text.setText(item.optString("name")+"\n"+item.optString("origin")+"\n"+label);text.setPadding(0,12,0,8);rows.addView(text);
   boolean active=status==DownloadManager.STATUS_PENDING||status==DownloadManager.STATUS_RUNNING||status==DownloadManager.STATUS_PAUSED;
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
 void destroy(){dismissDialogs();}
}
