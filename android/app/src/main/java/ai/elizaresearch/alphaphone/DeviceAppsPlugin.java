package ai.elizaresearch.alphaphone;
import android.content.Intent;
import ai.eliza.plugins.system.SystemLauncherApps;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceApps")
public class DeviceAppsPlugin extends Plugin {
 @PluginMethod public void buildInfo(PluginCall call) {
  JSObject value = new JSObject(); value.put("launcher", BuildConfig.IS_LAUNCHER); value.put("version", BuildConfig.VERSION_NAME); call.resolve(value);
 }
 @PluginMethod public void list(PluginCall call) {
  JSArray apps = new JSArray();
  for (SystemLauncherApps.App item : SystemLauncherApps.list(getContext())) {
   JSObject app = new JSObject(); app.put("packageName", item.packageName); app.put("label", item.label); apps.put(app);
  }
  JSObject result = new JSObject(); result.put("apps", apps); call.resolve(result);
 }
 @PluginMethod public void launch(PluginCall call) {
  String name = call.getString("packageName");
  Intent intent;
  try { intent = SystemLauncherApps.launchIntent(getContext(), name); }
  catch (IllegalArgumentException error) { call.reject("Choose an installed app"); return; }
  if (intent == null) { call.reject("App is unavailable"); return; }
  try { getActivity().startActivity(intent); call.resolve(); }
  catch (android.content.ActivityNotFoundException | SecurityException error) { call.reject("App could not be opened", error); }
 }
}
