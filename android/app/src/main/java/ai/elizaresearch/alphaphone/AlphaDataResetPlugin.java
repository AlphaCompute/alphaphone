package ai.elizaresearch.alphaphone;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * "Reset Alpha data" (P-25). The renderer collects an explicit confirmation; when the device has a
 * screen lock, Android's own credential screen must also succeed. Nothing is erased before both.
 */
@CapacitorPlugin(name = "AlphaDataReset")
public final class AlphaDataResetPlugin extends Plugin {
 static final String CONFIRMATION = "reset-alpha-data";
 private final AtomicBoolean busy = new AtomicBoolean();

 private static JSObject result(String status, String message) {
  JSObject value = new JSObject();
  value.put("status", status);
  value.put("message", message);
  return value;
 }

 private boolean deviceSecure() {
  KeyguardManager keyguard = getContext().getSystemService(KeyguardManager.class);
  return keyguard != null && keyguard.isDeviceSecure();
 }

 @PluginMethod public void describe(PluginCall call) {
  JSObject value = new JSObject();
  value.put("available", true);
  value.put("deviceSecure", deviceSecure());
  value.put("pending", AlphaDataReset.blocked(getContext()));
  call.resolve(value);
 }

 @PluginMethod public void reset(PluginCall call) {
  if (!CONFIRMATION.equals(call.getString("confirmation"))) { call.resolve(result("refused", "Reset needs explicit confirmation. Nothing was erased.")); return; }
  if (!busy.compareAndSet(false, true)) { call.resolve(result("busy", "A reset request is already open.")); return; }
  if (!deviceSecure()) { begin(call); return; }
  KeyguardManager keyguard = getContext().getSystemService(KeyguardManager.class);
  @SuppressWarnings("deprecation")
  Intent confirm = keyguard == null ? null : keyguard.createConfirmDeviceCredentialIntent("Reset Alpha data", "Confirm it's you to erase Alpha's data on this phone.");
  if (confirm == null) { busy.set(false); call.resolve(result("unavailable", "Android could not confirm your screen lock. Nothing was erased.")); return; }
  try { startActivityForResult(call, confirm, "authenticated"); }
  catch (RuntimeException unavailable) { busy.set(false); call.resolve(result("unavailable", "Android could not confirm your screen lock. Nothing was erased.")); }
 }

 @ActivityCallback private void authenticated(PluginCall call, ActivityResult response) {
  if (call == null) { busy.set(false); return; }
  if (response.getResultCode() != Activity.RESULT_OK) { busy.set(false); call.resolve(result("cancelled", "Screen lock not confirmed. Nothing was erased.")); return; }
  begin(call);
 }

 /** From here the reset cannot be cancelled: the marker makes every later start finish it. */
 private void begin(PluginCall call) {
  call.resolve(result("resetting", "Resetting Alpha data. Alpha closes when it is done."));
  // Unload the renderer so no page script writes storage while it is being erased.
  getActivity().runOnUiThread(() -> {
   try { if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().loadDataWithBaseURL(null, page("Resetting Alpha data. Alpha closes when it is done; open it again to start fresh."), "text/html", "utf-8", null); }
   catch (RuntimeException ignored) { /* The reset proceeds; the process ends either way. */ }
  });
  AlphaDataReset.start(getContext(), (outcome, failure) -> {
   if (failure == null) return;
   Activity activity = getActivity();
   if (activity == null) return;
   activity.runOnUiThread(() -> {
    try { if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().loadDataWithBaseURL(null, page("Alpha data reset is not finished. Close and reopen Alpha to continue it; Alpha stays stopped until then."), "text/html", "utf-8", null); }
    catch (RuntimeException ignored) { /* Reopening resumes the reset. */ }
   });
  });
 }

 private static String page(String text) {
  return "<!doctype html><meta name=viewport content='width=device-width'><body style='font:18px/1.5 sans-serif;padding:32px'><p role=status>" + text + "</p></body>";
 }
}
