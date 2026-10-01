package ai.elizaresearch.alphaphone;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.os.*;
import android.service.notification.StatusBarNotification;
import android.util.AtomicFile;
import com.getcapacitor.*;
import org.json.*;
import java.util.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import android.security.keystore.*;

/** Local opt-in boundary. No notification text, PendingIntent or foreign key is persisted. */
final class NotificationAccess {
 static final Object LOCK=new Object();
 private static final Map<String,Entry> entries=new LinkedHashMap<>();
 static AlphaNotificationListener listener;
 private static volatile long generation;
 private static final Set<String> historyFailures=new HashSet<>();
 private static final class Entry {final String key,id=UUID.randomUUID().toString(),revision=UUID.randomUUID().toString();final long at;Entry(StatusBarNotification n){key=n.getKey();at=n.getPostTime();}}
 static ComponentName component(Context c){return new ComponentName(c,AlphaNotificationListener.class);}
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("alpha-notification-access",0);}
 static boolean granted(Context c){return c.getSystemService(NotificationManager.class).isNotificationListenerAccessGranted(component(c));}
 private static JSONObject policy(Context c)throws Exception{return new JSONObject(prefs(c).getString("policy","{\"revision\":\"initial\",\"enabled\":false,\"history\":false,\"apps\":[]}"));}
 private static boolean active(Context c,JSONObject p){return p.optBoolean("enabled")&&!prefs(c).getBoolean("paused",false)&&granted(c);}
 static void connected(AlphaNotificationListener service){synchronized(LOCK){listener=service;generation++;entries.clear();try{JSONObject p=policy(service);if(!active(service,p)){if(!granted(service))clearHistory(service);return;}pruneHistory(service,p);}catch(Exception failure){historyFailures.add(service.getPackageName());}}}
 private static void invalidate(){generation++;entries.clear();}
 private static boolean locked(Context c){return c.getSystemService(KeyguardManager.class).isDeviceLocked();}
 static String signature(Context c,String name)throws Exception{
  PackageInfo info=c.getPackageManager().getPackageInfo(name,PackageManager.GET_SIGNING_CERTIFICATES);if(info.signingInfo==null)throw new IllegalStateException();
  java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");for(Signature cert:info.signingInfo.getApkContentsSigners())digest.update(cert.toByteArray());return android.util.Base64.encodeToString(digest.digest(),android.util.Base64.NO_WRAP);
 }
 static JSArray apps(Context c)throws Exception{JSArray out=new JSArray();Set<String> seen=new HashSet<>();for(ResolveInfo r:c.getPackageManager().queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),0)){
  String pkg=r.activityInfo.packageName;if(pkg.equals(c.getPackageName())||!seen.add(pkg))continue;if(out.length()>=200)break;JSObject item=new JSObject();item.put("packageName",pkg);item.put("label",bounded(r.loadLabel(c.getPackageManager()),120));out.put(item);
 }return out;}
 private static JSONObject allowed(Context c,JSONObject p,StatusBarNotification n)throws Exception{
  if(!n.getUser().equals(android.os.Process.myUserHandle())||n.getPackageName().equals(c.getPackageName()))return null;
  try{if(c.getPackageManager().getApplicationInfo(n.getPackageName(),0).uid!=n.getUid())return null;}catch(PackageManager.NameNotFoundException missing){return null;}
  JSONArray apps=p.getJSONArray("apps");for(int i=0;i<apps.length();i++){JSONObject a=apps.getJSONObject(i);if(a.getString("packageName").equals(n.getPackageName())&&validSignature(c,a))return a;}return null;
 }
 private static boolean validSignature(Context c,JSONObject app){try{return app.getString("signature").equals(signature(c,app.getString("packageName")));}catch(Exception missing){return false;}}
 static JSObject status(Context c)throws Exception{synchronized(LOCK){JSONObject p=policy(c);if(!granted(c)){invalidate();clearHistory(c);}try{pruneHistory(c,p);}catch(Exception unavailable){historyFailures.add(c.getPackageName());}JSObject out=new JSObject();out.put("revision",p.getString("revision"));out.put("enabled",p.optBoolean("enabled"));out.put("accessGranted",granted(c));out.put("connected",listener!=null);out.put("paused",prefs(c).getBoolean("paused",false));out.put("history",p.optBoolean("history"));out.put("historyUnavailable",historyFailures.contains(c.getPackageName()));JSArray selected=new JSArray();JSONArray stored=p.getJSONArray("apps");for(int i=0;i<stored.length();i++){JSONObject a=stored.getJSONObject(i);JSObject row=new JSObject();row.put("packageName",a.getString("packageName"));row.put("label",a.getString("label"));row.put("preview",a.optBoolean("preview"));row.put("available",validSignature(c,a));selected.put(row);}out.put("apps",selected);return out;}}
 static JSObject update(Context c,JSObject input)throws Exception{synchronized(LOCK){JSONObject p=policy(c);if(!p.getString("revision").equals(input.getString("expectedRevision")))throw new IllegalStateException("Notification settings changed. Refresh Settings.");
  if(input.has("apps")){JSONArray next=input.getJSONArray("apps"),valid=new JSONArray();if(next.length()>20)throw new IllegalArgumentException("Choose at most 20 apps");Set<String> visible=new HashSet<>(),seen=new HashSet<>();JSArray choices=apps(c);for(int i=0;i<choices.length();i++)visible.add(choices.getJSONObject(i).getString("packageName"));for(int i=0;i<next.length();i++){JSONObject a=next.getJSONObject(i);String name=a.getString("packageName");if(!visible.contains(name)||!seen.add(name))throw new IllegalArgumentException("This app is unavailable");JSONArray previous=p.getJSONArray("apps");for(int j=0;j<previous.length();j++){JSONObject prior=previous.getJSONObject(j);if(name.equals(prior.getString("packageName"))&&!validSignature(c,prior))throw new IllegalArgumentException("Remove and select this changed app again");}valid.put(new JSONObject().put("packageName",name).put("signature",signature(c,name)).put("label",bounded(c.getPackageManager().getApplicationLabel(c.getPackageManager().getApplicationInfo(name,0)),120)).put("preview",a.optBoolean("preview",false)));}p.put("apps",valid);}
  if(input.has("enabled"))p.put("enabled",input.getBoolean("enabled"));if(input.has("history"))p.put("history",input.getBoolean("history"));p.put("revision",UUID.randomUUID().toString());
  // Purge before acknowledging a new policy, including queued callback revisions.
  invalidate();clearHistory(c);if(!prefs(c).edit().putString("policy",p.toString()).commit())throw new IOException();if(!p.optBoolean("enabled")&&listener!=null)listener.requestUnbind();else if(active(c,p))android.service.notification.NotificationListenerService.requestRebind(component(c));return status(c);
 }}
 static void pause(Context c,boolean paused)throws Exception{synchronized(LOCK){invalidate();if(!prefs(c).edit().putBoolean("paused",paused).commit())throw new IOException();if(paused){clearHistory(c);if(listener!=null)listener.requestUnbind();}else if(active(c,policy(c)))android.service.notification.NotificationListenerService.requestRebind(component(c));}}
 static void invalidateKey(String key){synchronized(LOCK){entries.remove(key);}}
 static long eventGeneration(){return generation;}
 static void changed(Context c,StatusBarNotification n,boolean removed,long observed){synchronized(LOCK){if(observed!=generation||listener!=c)return;entries.remove(n.getKey());try{JSONObject p=policy(c);if(!active(c,p)){entries.clear();if(!granted(c))clearHistory(c);return;}JSONObject app=allowed(c,p,n);if(app==null)return;if(!removed&&!locked(c))entries.put(n.getKey(),new Entry(n));trim();if(p.optBoolean("history"))record(c,app,n.getPostTime(),removed?"Removed":"Posted");}catch(Exception failure){entries.clear();}}}
 static void disconnected(Context c){synchronized(LOCK){if(listener!=c)return;listener=null;invalidate();if(!granted(c))clearHistory(c);}}
 static void redact(){synchronized(LOCK){invalidate();}}
 private static void trim(){while(entries.size()>100)entries.remove(entries.keySet().iterator().next());}
 static JSArray list(Context c)throws Exception{synchronized(LOCK){JSArray out=new JSArray();JSONObject p=policy(c);if(!active(c,p)||listener==null||locked(c)){entries.clear();if(!granted(c))clearHistory(c);return out;}
  StatusBarNotification[] current=listener.getActiveNotifications();if(current==null)throw new IllegalStateException();Arrays.sort(current,Comparator.comparingLong(StatusBarNotification::getPostTime).reversed());Set<String> live=new HashSet<>();
  for(StatusBarNotification n:current){JSONObject app=allowed(c,p,n);if(app==null)continue;live.add(n.getKey());if(out.length()>=100)continue;Entry e=entries.get(n.getKey());if(e==null||e.at!=n.getPostTime()){e=new Entry(n);entries.put(n.getKey(),e);}Notification notice=n.getNotification();boolean hidden=!app.optBoolean("preview")||notice.visibility==Notification.VISIBILITY_SECRET;
   JSObject row=new JSObject();row.put("id",e.id);row.put("revision",e.revision);row.put("source","external");row.put("appLabel",app.getString("label"));row.put("title",hidden?app.getString("label"):bounded((notice.extras==null?null:notice.extras.getCharSequence(Notification.EXTRA_TITLE)),200));row.put("text",hidden?"Content hidden":bounded((notice.extras==null?null:notice.extras.getCharSequence(Notification.EXTRA_BIG_TEXT,notice.extras.getCharSequence(Notification.EXTRA_TEXT))),2000));row.put("redacted",hidden);row.put("at",n.getPostTime());row.put("clearable",n.isClearable());row.put("canOpen",notice.visibility!=Notification.VISIBILITY_SECRET&&notice.contentIntent!=null&&notice.contentIntent.getCreatorUid()==n.getUid());out.put(row);
  }entries.keySet().retainAll(live);trim();return out;
 }}
 static void action(Context c,String id,String revision,boolean open)throws Exception{synchronized(LOCK){JSONObject p=policy(c);if(!active(c,p)||listener==null||locked(c))throw new IllegalStateException();Entry e=null;for(Entry item:entries.values())if(item.id.equals(id)&&item.revision.equals(revision))e=item;if(e==null)throw new IllegalStateException();StatusBarNotification found=null;for(StatusBarNotification n:listener.getActiveNotifications(new String[]{e.key}))if(n.getPostTime()==e.at&&allowed(c,p,n)!=null)found=n;if(found==null)throw new IllegalStateException();Notification n=found.getNotification();
  if(open){if(n.visibility==Notification.VISIBILITY_SECRET||n.contentIntent==null||n.contentIntent.getCreatorUid()!=found.getUid())throw new IllegalStateException();n.contentIntent.send();if((n.flags&Notification.FLAG_AUTO_CANCEL)!=0)listener.cancelNotification(found.getKey());}
  else{if(!found.isClearable())throw new IllegalStateException();listener.cancelNotification(found.getKey());}
 }}
 private static String bounded(CharSequence value,int max){String s=value==null?"":value.toString();return s.length()>max?s.substring(0,max):s;}
 private static AtomicFile historyFile(Context c){return new AtomicFile(new File(c.getNoBackupFilesDir(),"notification-history.enc"));}
 private static javax.crypto.SecretKey key()throws Exception{java.security.KeyStore store=java.security.KeyStore.getInstance("AndroidKeyStore");store.load(null);String alias="alpha.notification.history.v1";if(!store.containsAlias(alias)){KeyGenerator g=KeyGenerator.getInstance("AES","AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}return (javax.crypto.SecretKey)store.getKey(alias,null);}
 private static JSONArray readHistory(Context c)throws Exception{AtomicFile f=historyFile(c);if(!f.getBaseFile().exists())return new JSONArray();byte[] data=f.readFully();if(data.length<29||data.length>128*1024)throw new IOException();Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Arrays.copyOf(data,12)));cipher.updateAAD("alpha.notification.history.v1".getBytes(StandardCharsets.UTF_8));JSONArray all=new JSONArray(new String(cipher.doFinal(Arrays.copyOfRange(data,12,data.length)),StandardCharsets.UTF_8)),kept=new JSONArray();for(int i=0;i<all.length();i++)if(all.getJSONObject(i).getLong("at")>System.currentTimeMillis()-86400000L)kept.put(all.getJSONObject(i));return kept;}
 private static void writeHistory(Context c,JSONArray data)throws Exception{Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());cipher.updateAAD("alpha.notification.history.v1".getBytes(StandardCharsets.UTF_8));byte[] sealed=cipher.doFinal(data.toString().getBytes(StandardCharsets.UTF_8));AtomicFile f=historyFile(c);FileOutputStream out=null;try{out=f.startWrite();out.write(cipher.getIV());out.write(sealed);out.getFD().sync();f.finishWrite(out);}catch(Exception fail){if(out!=null)f.failWrite(out);throw fail;}}
 private static void record(Context c,JSONObject app,long posted,String state)throws Exception{JSONArray old=readHistory(c),next=new JSONArray();next.put(new JSONObject().put("id",UUID.randomUUID().toString()).put("packageName",app.getString("packageName")).put("signature",app.getString("signature")).put("appLabel",app.getString("label")).put("at",System.currentTimeMillis()).put("postedAt",posted).put("state",state));for(int i=0;i<old.length()&&next.length()<100;i++)next.put(old.getJSONObject(i));writeHistory(c,next);}
 private static void pruneHistory(Context c,JSONObject p)throws Exception{
  if(!granted(c)||!p.optBoolean("enabled")||!p.optBoolean("history")||prefs(c).getBoolean("paused",false)){clearHistory(c);return;}
  if(!historyFile(c).getBaseFile().exists())return;
  try{JSONArray old=readHistory(c),kept=new JSONArray(),selected=p.getJSONArray("apps");for(int i=0;i<old.length()&&kept.length()<100;i++){JSONObject row=old.getJSONObject(i);for(int j=0;j<selected.length();j++){JSONObject app=selected.getJSONObject(j);if(row.optString("packageName").equals(app.optString("packageName"))&&row.optString("signature").equals(app.optString("signature"))&&validSignature(c,app)){kept.put(row);break;}}}writeHistory(c,kept);}catch(Exception unavailable){historyFailures.add(c.getPackageName());throw unavailable;}
 }
 static JSArray history(Context c)throws Exception{synchronized(LOCK){JSONObject p=policy(c);pruneHistory(c,p);if(!active(c,p)||!p.optBoolean("history")||locked(c))return new JSArray();JSONArray kept=readHistory(c);writeHistory(c,kept);JSArray out=new JSArray();for(int i=0;i<kept.length();i++){JSONObject row=kept.getJSONObject(i);out.put(new JSONObject().put("id",row.getString("id")).put("appLabel",row.getString("appLabel")).put("at",row.getLong("at")).put("state",row.getString("state")));}return out;}}
 /** User Clear is an event boundary: queued observations from before it cannot repopulate history. */
 static void clearHistoryBoundary(Context c){synchronized(LOCK){invalidate();clearHistory(c);}}
 static void clearHistory(Context c){synchronized(LOCK){AtomicFile file=historyFile(c);file.delete();if(file.getBaseFile().exists()||new File(file.getBaseFile().getPath()+".bak").exists()||new File(file.getBaseFile().getPath()+".new").exists())throw new IllegalStateException("History cleanup unavailable");historyFailures.remove(c.getPackageName());}}
}
