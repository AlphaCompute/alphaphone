package ai.elizaresearch.alphaphone;

import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.app.KeyguardManager;
import android.os.UserManager;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.*;
import java.util.concurrent.*;

/** Agent album facade over the same permission and exact-revision catalog as Photos.
 * It owns no index and never uses URI-only destructive MediaStore requests. */
@CapacitorPlugin(name="AlphaPhotoLibrary")
public class AlphaPhotoLibraryPlugin extends Plugin {
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private PermittedMediaCatalog catalog;
 private PermittedMediaReview review;
 private volatile boolean destroyed,watching;
 @Override public void load(){
  catalog=new PermittedMediaCatalog(getContext(),false,()->{if(watching&&!destroyed)notifyListeners("libraryChanged",new JSObject());});
  review=new PermittedMediaReview(getBridge(),catalog,worker);
 }
 private void submit(PluginCall call,Runnable action){
  if(destroyed){call.reject("Device library closed");return;}
  try{worker.execute(()->{if(destroyed)call.reject("Device library closed");else action.run();});}
  catch(RejectedExecutionException stopped){call.reject("Device library closed");}
 }
 private boolean locked(){KeyguardManager keyguard=getContext().getSystemService(KeyguardManager.class);UserManager users=getContext().getSystemService(UserManager.class);return keyguard==null||users==null||keyguard.isDeviceLocked()||!users.isUserUnlocked();}
 private JSObject scopeResult(){
  JSObject access=catalog.access(),out=new JSObject();String scope=access.getString("scope");
  // The model contract expresses a one-kind full grant using its per-kind flags.
  out.put("scope","partial".equals(scope)?"full":scope);
  out.put("images","full".equals(access.getString("images")));out.put("videos","full".equals(access.getString("videos")));
  out.put("canSelectMore",Build.VERSION.SDK_INT>=34);out.put("canEditOthers",Build.VERSION.SDK_INT>=30);out.put("locked",locked());
  try{out.put("version",catalog.fence().cursorIdentity());}catch(Exception unavailable){out.put("version","");}return out;
 }
 private boolean readable(PluginCall call){
  if(locked()){call.reject("Unlock the phone to use the device library","LIBRARY_LOCKED");return false;}
  if("denied".equals(catalog.access().getString("scope"))){call.reject("Photo library access is not allowed","LIBRARY_DENIED");return false;}return true;
 }
 @PluginMethod public void scope(PluginCall call){call.resolve(scopeResult());}
 @PluginMethod public void requestAccess(PluginCall call){((AlphaPhotosPlugin)getBridge().getPlugin("AlphaPhotos").getInstance()).requestLibraryAccess(call);}
 @PluginMethod public void watch(PluginCall call){watching=call.getBoolean("active",false);catalog.watch(watching);JSObject out=new JSObject();out.put("active",watching);call.resolve(out);}
 private JSObject item(JSObject row){row.put("takenAt",row.optLong("date",0L));return row;}
 @PluginMethod public void page(PluginCall call){submit(call,()->{
  if(!readable(call))return;
  try{
   JSObject page=catalog.list(call.getString("before",""),call.getString("query",""),call.getString("kind","all"),call.getBoolean("thumbnails",false),call.getBoolean("favorites",false)?"favorites":"all",call.getLong("from",0L),call.getLong("to",Long.MAX_VALUE),Math.min(24,Math.max(1,call.getInt("limit",24))));
   JSArray rows=new JSArray();org.json.JSONArray source=page.getJSONArray("items");for(int i=0;i<source.length();i++)rows.put(item(JSObject.fromJSONObject(source.getJSONObject(i))));
   JSObject out=scopeResult();out.put("items",rows);out.put("next",page.getString("next"));out.put("generation",1);call.resolve(out);
  }catch(Exception failure){call.reject("Photo library changed. Reload before continuing.");}
 });}
 @PluginMethod public void inspect(PluginCall call){submit(call,()->{if(!readable(call))return;try{call.resolve(item(catalog.read(call.getString("id"),null,call.getBoolean("pixels",true))));}catch(Exception failure){call.reject("That item is unavailable","LIBRARY_MISSING");}});}
 @PluginMethod public void validate(PluginCall call){submit(call,()->{
  if(!readable(call))return;try{
   JSArray requested=call.getArray("items"),results=new JSArray();if(requested==null||requested.length()>200)throw new IllegalArgumentException();
   PermittedMediaCatalog.Fence fence=catalog.fence();
   for(int i=0;i<requested.length();i++){
    org.json.JSONObject expected=requested.getJSONObject(i);String id=expected.getString("id");JSObject result=new JSObject();result.put("id",id);
    try{JSObject row=item(catalog.read(id,null,false));boolean same=row.getString("revision").equals(expected.getString("revision"));result.put("status",same?"current":"changed");if(!same)result.put("item",row);}catch(Exception missing){result.put("status","missing");}results.put(result);
   }
   catalog.requireCurrent(fence);JSObject out=new JSObject();out.put("items",results);call.resolve(out);
  }catch(Exception unavailable){call.reject("Library validation unavailable. Reload Photos.");}
 });}
 /** A full bounded page refresh avoids a second unqualified incremental index. */
 @PluginMethod public void changes(PluginCall call){JSObject out=new JSObject();out.put("reset",true);call.resolve(out);}
 @PluginMethod public void requestChange(PluginCall call){submit(call,()->{
  if(!readable(call))return;try{
   String action=call.getString("operation","");if(!Set.of("favorite","unfavorite","trash").contains(action)){call.reject("Manage permanent deletion in Android Photos.");return;}
   JSArray requested=call.getArray("items");if(requested==null||requested.length()<1||requested.length()>20)throw new IllegalArgumentException();
   List<String> ids=new ArrayList<>(),revisions=new ArrayList<>();for(int i=0;i<requested.length();i++){org.json.JSONObject row=requested.getJSONObject(i);ids.add(row.getString("id"));revisions.add(row.getString("revision"));}
   review.request(call,ids,revisions,!action.equals("trash"),!action.equals("unfavorite"),true);
  }catch(Exception unavailable){call.reject("Select current permitted items before review.");}
 });}
 @PluginMethod public void share(PluginCall call){((AlphaPhotosPlugin)getBridge().getPlugin("AlphaPhotos").getInstance()).shareMany(call);}
 @Override protected void handleOnPause(){watching=false;catalog.watch(false);catalog.invalidate();}
 @Override protected void handleOnResume(){catalog.invalidate();notifyListeners("scopeChanged",scopeResult());}
 @Override protected void handleOnDestroy(){destroyed=true;watching=false;review.close();catalog.close();worker.shutdown();}
}
