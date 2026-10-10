package ai.elizaresearch.alphaphone;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Read-only device facts and an allowlisted handoff to Android-owned settings. */
@CapacitorPlugin(name="AlphaDevice")
public final class AlphaDevicePlugin extends Plugin {
 static int textScalePercent(Context context){int value=context.getSharedPreferences("alpha-appearance",Context.MODE_PRIVATE).getInt("text-scale-percent",100);return value>=75&&value<=150?value:100;}
 static int effectiveTextZoom(Context context,int percent){float scale=context.getResources().getConfiguration().fontScale;if(!Float.isFinite(scale)||scale<=0)scale=1;return Math.max(1,Math.round(percent*scale));}
 static void applyTextScale(MainActivity activity){activity.getBridge().getWebView().getSettings().setTextZoom(effectiveTextZoom(activity,textScalePercent(activity)));}
 @PluginMethod public void setTextScale(PluginCall call){
  Integer percent=call.getInt("percent");if(percent==null||percent<75||percent>150){call.reject("Text size must be between75 and150 percent");return;}
  getActivity().runOnUiThread(()->{
   if(!(getActivity() instanceof MainActivity)||getActivity().isFinishing()){call.reject("Alpha view is unavailable");return;}
   if(!getContext().getSharedPreferences("alpha-appearance",Context.MODE_PRIVATE).edit().putInt("text-scale-percent",percent).commit()){call.reject("Text size could not be saved");return;}
   applyTextScale((MainActivity)getActivity());JSObject out=new JSObject();out.put("textScalePercent",textScalePercent(getContext()));out.put("effectiveTextZoom",getBridge().getWebView().getSettings().getTextZoom());call.resolve(out);
  });
 }
 @PluginMethod public void snapshot(PluginCall call) {
  JSObject out=new JSObject();
  Intent battery=getContext().registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
  if(battery!=null){
   int level=battery.getIntExtra(BatteryManager.EXTRA_LEVEL,-1),scale=battery.getIntExtra(BatteryManager.EXTRA_SCALE,-1);
   if(level>=0&&scale>0)out.put("batteryPercent",Math.max(0,Math.min(100,Math.round(level*100f/scale))));
   int status=battery.getIntExtra(BatteryManager.EXTRA_STATUS,-1);
   out.put("charging",status==BatteryManager.BATTERY_STATUS_CHARGING||status==BatteryManager.BATTERY_STATUS_FULL);
  }
  PowerManager power=(PowerManager)getContext().getSystemService(Context.POWER_SERVICE);
  if(power!=null)out.put("powerSave",power.isPowerSaveMode());
  ConnectivityManager connectivity=(ConnectivityManager)getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
  NetworkCapabilities network=connectivity==null?null:connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
  out.put("wifiActive",network!=null&&network.hasTransport(NetworkCapabilities.TRANSPORT_WIFI));
  out.put("cellularActive",network!=null&&network.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR));
  out.put("internetValidated",network!=null&&network.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED));
  out.put("model",Build.MODEL);out.put("manufacturer",Build.MANUFACTURER);
  out.put("androidRelease",Build.VERSION.RELEASE);out.put("securityPatch",Build.VERSION.SECURITY_PATCH);
  out.put("build",Build.DISPLAY);out.put("appVersion",BuildConfig.VERSION_NAME);
  out.put("readAt",System.currentTimeMillis());
  out.put("textScalePercent",textScalePercent(getContext()));out.put("effectiveTextZoom",effectiveTextZoom(getContext(),textScalePercent(getContext())));
  NotificationManager notifications=(NotificationManager)getContext().getSystemService(Context.NOTIFICATION_SERVICE);
  out.put("notificationsEnabled",notifications!=null&&notifications.areNotificationsEnabled());
  JSObject grants=new JSObject();
  boolean fine=getContext().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED,coarse=getContext().checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
  out.put("locationAccess",fine?"precise":coarse?"approximate":"denied");
  // Only permissions Alpha declares. Contacts is removed from the manifest, so it is not reported.
  String[][] permissions={{"Microphone",Manifest.permission.RECORD_AUDIO},{"Location",Manifest.permission.ACCESS_FINE_LOCATION},{"Camera",Manifest.permission.CAMERA},{"Calendar",Manifest.permission.READ_CALENDAR}};
  for(String[] p:permissions)grants.put(p[0],getContext().checkSelfPermission(p[1])==PackageManager.PERMISSION_GRANTED);
  grants.put("Location",fine||coarse);out.put("permissions",grants);
  out.put("passwordProvider",PasswordProviderSupport.status(getContext()));call.resolve(out);
 }
 @PluginMethod public void openPasswordProvider(PluginCall call) {
  String action=call.getString("action","");
  getActivity().runOnUiThread(()->{
   try {
    Intent target=PasswordProviderSupport.intent(getContext(),action);
    String destination=Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE.equals(target.getAction())?"provider-picker":"external";
    try { getActivity().startActivity(target); }
    catch(android.content.ActivityNotFoundException missing) {
     if(!"settings".equals(action)||!Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE.equals(target.getAction()))throw missing;
     getActivity().startActivity(new Intent(Settings.ACTION_SETTINGS));destination="system-settings";
    }
    if(Settings.ACTION_SETTINGS.equals(target.getAction()))destination="system-settings";
    JSObject out=new JSObject();out.put("status","opened");out.put("destination",destination);call.resolve(out);
   } catch(RuntimeException unavailable) { call.reject("Password provider setup could not be opened. No provider change is confirmed."); }
  });
 }
 @PluginMethod public void openSettings(PluginCall call) {
  String page=call.getString("page","");String action;
  switch(page){
   case "accounts":action=Settings.ACTION_SYNC_SETTINGS;break;
   case "wifi":action=Settings.ACTION_WIFI_SETTINGS;break;
   case "bluetooth":action=Settings.ACTION_BLUETOOTH_SETTINGS;break;
   case "mobile":action=Settings.ACTION_WIRELESS_SETTINGS;break;
   case "display":action=Settings.ACTION_DISPLAY_SETTINGS;break;
   case "sound":action=Settings.ACTION_SOUND_SETTINGS;break;
   case "battery":action=Settings.ACTION_BATTERY_SAVER_SETTINGS;break;
   case "about":action=Settings.ACTION_DEVICE_INFO_SETTINGS;break;
   case "developer":action=Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS;break;
   case "notifications":action=Settings.ACTION_APP_NOTIFICATION_SETTINGS;break;
   case "privacy":action=Settings.ACTION_APPLICATION_DETAILS_SETTINGS;break;
   case "default-apps":action=Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS;break;
   // Do not disturb: the platform Zen mode page; an image without it rejects and the tile falls back to Settings.
   case "dnd":action="android.settings.ZEN_MODE_SETTINGS";break;
   default:call.reject("Unsupported settings page");return;
  }
  Intent intent=new Intent(action);
  if(page.equals("privacy"))intent.setData(Uri.parse("package:"+getContext().getPackageName()));
  if(page.equals("notifications"))intent.putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName());
  getActivity().runOnUiThread(()->{
   try{getActivity().startActivity(intent);JSObject out=new JSObject();out.put("status","opened");call.resolve(out);}
   catch(RuntimeException error){call.reject("This Android settings page is unavailable");}
  });
 }

 private final java.util.concurrent.ExecutorService diagnosticsWorker=java.util.concurrent.Executors.newSingleThreadExecutor();
 /** Local problem log: failure classes only, never messages, stacks or content. */
 @PluginMethod public void crashLog(PluginCall call){
  diagnosticsWorker.execute(()->{
   try{
    try{AlphaCrashLog.collectExitReasons(getContext());}catch(Exception unavailable){/* Exit history is best effort. */}
    JSObject out=new JSObject();out.put("entries",AlphaCrashLog.read(getContext()).getJSONArray("entries"));out.put("exitHistory",Build.VERSION.SDK_INT>=Build.VERSION_CODES.R);call.resolve(out);
   }catch(Exception error){call.reject("Problem log is unavailable");}
  });
 }
 @PluginMethod public void recordRendererFailure(PluginCall call){
  diagnosticsWorker.execute(()->{try{AlphaCrashLog.recordRenderer(getContext(),call.getString("kind"),call.getString("errorClass"));call.resolve();}catch(Exception error){call.reject("Problem was not recorded");}});
 }
 @PluginMethod public void clearCrashLog(PluginCall call){
  diagnosticsWorker.execute(()->{try{AlphaCrashLog.clear(getContext());call.resolve();}catch(Exception error){call.reject("Problem log could not be cleared");}});
 }
 /** Non-secret build identity for diagnostics: variant, pin and packaged runtime hashes. */
 @PluginMethod public void diagnosticsFacts(PluginCall call){
  diagnosticsWorker.execute(()->{
   try{
    JSObject out=new JSObject();
    out.put("appVersion",BuildConfig.VERSION_NAME);out.put("versionCode",BuildConfig.VERSION_CODE);
    out.put("variant",BuildConfig.IS_LAUNCHER?"launcher":"standalone");out.put("buildType",BuildConfig.BUILD_TYPE);
    out.put("testMocks",BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS);out.put("sdkInt",Build.VERSION.SDK_INT);
    out.put("androidRelease",Build.VERSION.RELEASE);out.put("securityPatch",Build.VERSION.SECURITY_PATCH);
    JSObject hashes=new JSObject();
    for(String asset:new String[]{"agent/alpha-source.json","agent/agent-bundle.js","agent/workflow-worker/manifest.json","agent/workflow-worker/files.sha256"}){String hash=assetSha256(asset);if(hash!=null)hashes.put(asset,hash);}
    out.put("runtimeHashes",hashes);
    try(java.io.InputStream in=getContext().getAssets().open("agent/alpha-source.json")){
     java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[8192];int count,total=0;
     while((count=in.read(buffer))!=-1){total+=count;if(total>64*1024)throw new java.io.IOException();bytes.write(buffer,0,count);}
     String base=new org.json.JSONObject(new String(bytes.toByteArray(),java.nio.charset.StandardCharsets.UTF_8)).optString("base","");
     if(base.matches("[0-9a-f]{40}"))out.put("upstreamPin",base);
    }catch(Exception notPackaged){/* Developer APKs may omit the packaged runtime. */}
    call.resolve(out);
   }catch(Exception error){call.reject("Diagnostics are unavailable");}
  });
 }
 private String assetSha256(String asset){
  try(java.io.InputStream in=getContext().getAssets().open(asset)){
   java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[65536];int count;
   while((count=in.read(buffer))!=-1)digest.update(buffer,0,count);
   StringBuilder hex=new StringBuilder();for(byte b:digest.digest())hex.append(String.format(java.util.Locale.ROOT,"%02x",b));return hex.toString();
  }catch(Exception absent){return null;}
 }
 /** User-initiated share of already redacted diagnostics. Android's chooser decides the destination. */
 @PluginMethod public void shareDiagnostics(PluginCall call){
  String text=call.getString("text");
  if(text==null||text.length()>256*1024){call.reject("Diagnostics are too large");return;}
  try{Object parsed=new org.json.JSONTokener(text).nextValue();if(!(parsed instanceof org.json.JSONObject)||!"alpha-diagnostics/v1".equals(((org.json.JSONObject)parsed).optString("format")))throw new IllegalArgumentException();}
  catch(Exception invalid){call.reject("Diagnostics are not valid");return;}
  getActivity().runOnUiThread(()->{
   try{
    Intent send=new Intent(Intent.ACTION_SEND);send.setType("text/plain");send.putExtra(Intent.EXTRA_TEXT,text);send.putExtra(Intent.EXTRA_SUBJECT,"Alpha Phone diagnostics");
    getActivity().startActivity(Intent.createChooser(send,"Share diagnostics"));JSObject out=new JSObject();out.put("status","opened");call.resolve(out);
   }catch(RuntimeException unavailable){call.reject("Sharing is unavailable");}
  });
 }
 @Override protected void handleOnDestroy(){diagnosticsWorker.shutdown();super.handleOnDestroy();}
}
