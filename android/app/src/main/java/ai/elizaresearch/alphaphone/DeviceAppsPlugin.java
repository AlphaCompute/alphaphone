package ai.elizaresearch.alphaphone;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.util.Base64;
import ai.eliza.plugins.system.SystemLauncherApps;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;

/** Installed-app discovery and launch for Alpha Home. Resolution never launches; a launch
 * or default-handler hand-off happens only from an explicit renderer call. */
@CapacitorPlugin(name = "DeviceApps")
public class DeviceAppsPlugin extends Plugin {
 /** Launcher icon edge in pixels; small enough that a full drawer stays well under 1 MB. */
 static final int ICON_PX = 96;

 @PluginMethod public void buildInfo(PluginCall call) {
  JSObject value = new JSObject(); value.put("launcher", BuildConfig.IS_LAUNCHER); value.put("version", BuildConfig.VERSION_NAME); call.resolve(value);
 }
 /** Intent extra set when the Activity was opened for ACTION_ASSIST (AlphaAssistActivity). */
 static final String EXTRA_ASSISTANT = "alpha.assistant";
 /** How this Activity was opened: `assistant` is true only for the ACTION_ASSIST entry. */
 @PluginMethod public void launchInfo(PluginCall call) {
  android.app.Activity activity = getActivity();
  Intent intent = activity == null ? null : activity.getIntent();
  boolean assistant = intent != null && (Intent.ACTION_ASSIST.equals(intent.getAction()) || intent.getBooleanExtra(EXTRA_ASSISTANT, false));
  JSObject value = new JSObject(); value.put("assistant", assistant); call.resolve(value);
 }
 @PluginMethod public void localeInfo(PluginCall call) {
  JSObject value = new JSObject();
  value.put("locale", java.util.Locale.getDefault().toLanguageTag());
  value.put("hour24", android.text.format.DateFormat.is24HourFormat(getContext()));
  call.resolve(value);
 }
 @PluginMethod public void list(PluginCall call) {
  boolean icons = Boolean.TRUE.equals(call.getBoolean("icons", false));
  PackageManager packages = getContext().getPackageManager();
  JSArray apps = new JSArray();
  for (SystemLauncherApps.App item : SystemLauncherApps.list(getContext())) {
   JSObject app = new JSObject(); app.put("packageName", item.packageName); app.put("label", item.label);
   if (icons) { String icon = iconFor(packages, item.packageName); if (icon != null) app.put("icon", icon); }
   apps.put(app);
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
 @PluginMethod public void resolveDefault(PluginCall call) {
  String role = call.getString("role");
  Intent intent = roleIntent(role);
  if (intent == null) { call.reject("Choose a supported default app"); return; }
  PackageManager packages = getContext().getPackageManager();
  JSObject value = new JSObject(); value.put("role", role);
  DefaultHandler handler = resolve(packages, intent, getContext().getPackageName());
  value.put("available", handler.available);
  if (handler.packageName != null) {
   value.put("packageName", handler.packageName);
   value.put("label", handler.label);
   String icon = iconFor(packages, handler.packageName);
   if (icon != null) value.put("icon", icon);
  }
  call.resolve(value);
 }
 @PluginMethod public void openDefault(PluginCall call) {
  Intent intent = roleIntent(call.getString("role"));
  if (intent == null) { call.reject("Choose a supported default app"); return; }
  if (!resolve(getContext().getPackageManager(), intent, getContext().getPackageName()).available) { call.reject("No app on this phone handles this"); return; }
  try { getActivity().startActivity(intent); call.resolve(); }
  catch (android.content.ActivityNotFoundException | SecurityException error) { call.reject("App could not be opened", error); }
 }

 /** The role's hand-off intent carries no number, contact or other data. */
 static Intent roleIntent(String role) {
  if ("dial".equals(role)) return new Intent(Intent.ACTION_DIAL, Uri.parse("tel:"));
  return null;
 }

 static final class DefaultHandler {
  final boolean available; final String packageName; final String label;
  DefaultHandler(boolean available, String packageName, String label) { this.available = available; this.packageName = packageName; this.label = label; }
 }
 /** A chooser (several handlers, no default) is available but has no single package. Alpha itself
  * never counts as the handler. */
 static DefaultHandler resolve(PackageManager packages, Intent intent, String self) {
  ResolveInfo preferred = packages.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY);
  java.util.List<ResolveInfo> all = packages.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
  boolean other = false;
  for (ResolveInfo item : all) if (item.activityInfo != null && item.activityInfo.exported && !self.equals(item.activityInfo.packageName)) other = true;
  if (preferred == null || preferred.activityInfo == null || !other) return new DefaultHandler(false, null, null);
  String name = preferred.activityInfo.packageName;
  boolean single = false;
  for (ResolveInfo item : all) if (item.activityInfo != null && name.equals(item.activityInfo.packageName)) single = true;
  if (!single || self.equals(name)) return new DefaultHandler(true, null, null);
  CharSequence label = preferred.loadLabel(packages);
  return new DefaultHandler(true, name, label == null ? name : label.toString());
 }

 static String iconFor(PackageManager packages, String packageName) {
  Bitmap bitmap = null;
  try {
   // A copy: the package manager may share one Drawable, and its bounds must not change for others.
   Drawable drawable = packages.getApplicationIcon(packageName).mutate();
   bitmap = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888);
   Canvas canvas = new Canvas(bitmap);
   drawable.setBounds(0, 0, ICON_PX, ICON_PX);
   drawable.draw(canvas);
   ByteArrayOutputStream out = new ByteArrayOutputStream();
   if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)) return null;
   return "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
  } catch (PackageManager.NameNotFoundException | RuntimeException error) {
   // A removed package or an unrenderable drawable keeps its label-only entry.
   return null;
  } finally {
   if (bitmap != null) bitmap.recycle();
  }
 }
}
