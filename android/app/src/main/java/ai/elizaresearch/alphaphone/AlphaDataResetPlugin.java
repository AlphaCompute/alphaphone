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
 * "Reset Alpha data" (P-25). The user confirms natively, outside the renderer: with a screen lock,
 * Android's own credential screen must succeed; without one, a native dialog owned by this plugin
 * asks the user to type {@link #TYPED_PHRASE}. Page script cannot answer either. The
 * {@link #CONFIRMATION} value the renderer sends is only an API-shape check, not a user gate.
 */
@CapacitorPlugin(name = "AlphaDataReset")
public final class AlphaDataResetPlugin extends Plugin {
 /** API-shape check only: the renderer sends it with every request. It does not prove a user acted. */
 static final String CONFIRMATION = "reset-alpha-data";
 /** What the user types in the native dialog on a phone without a screen lock. */
 static final String TYPED_PHRASE = "RESET";
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
  if (!deviceSecure()) { confirmByTyping(call); return; }
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

 /**
  * No screen lock: a native dialog (not the WebView) asks the user to type the phrase. Reset starts
  * only from the dialog's own button, enabled only when the typed text matches.
  */
 private void confirmByTyping(PluginCall call) {
  Activity activity = getActivity();
  if (activity == null) { busy.set(false); call.resolve(result("unavailable", "Alpha could not show the reset confirmation. Nothing was erased.")); return; }
  activity.runOnUiThread(() -> {
   try {
    android.widget.EditText typed = new android.widget.EditText(activity);
    typed.setSingleLine(true);
    typed.setHint(TYPED_PHRASE);
    typed.setContentDescription("Type " + TYPED_PHRASE + " to confirm");
    typed.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    android.widget.FrameLayout frame = new android.widget.FrameLayout(activity);
    int pad = Math.round(24 * activity.getResources().getDisplayMetrics().density);
    frame.setPadding(pad, 0, pad, 0);
    frame.addView(typed);
    final AtomicBoolean answered = new AtomicBoolean();
    android.app.AlertDialog dialog = new android.app.AlertDialog.Builder(activity)
     .setTitle("Reset Alpha data")
     .setMessage("This phone has no screen lock, so Alpha asks you to type " + TYPED_PHRASE + ". Alpha's notes, chats, reminders, settings, sign-ins, local agent memory and keys on this phone are erased. This cannot be undone.")
     .setView(frame)
     .setPositiveButton("Erase Alpha data", (d, which) -> {
      if (!answered.compareAndSet(false, true)) return;
      if (TYPED_PHRASE.equals(typed.getText().toString().trim())) begin(call);
      else { busy.set(false); call.resolve(result("declined", "Reset not confirmed. Nothing was erased.")); }
     })
     .setNegativeButton("Cancel", (d, which) -> { if (answered.compareAndSet(false, true)) { busy.set(false); call.resolve(result("declined", "Reset not confirmed. Nothing was erased.")); } })
     .setOnDismissListener(d -> { if (answered.compareAndSet(false, true)) { busy.set(false); call.resolve(result("declined", "Reset not confirmed. Nothing was erased.")); } })
     .create();
    dialog.show();
    android.widget.Button erase = dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE);
    erase.setEnabled(false);
    typed.addTextChangedListener(new android.text.TextWatcher() {
     @Override public void beforeTextChanged(CharSequence text, int start, int count, int after) {}
     @Override public void onTextChanged(CharSequence text, int start, int before, int count) {}
     @Override public void afterTextChanged(android.text.Editable text) { erase.setEnabled(TYPED_PHRASE.equals(text.toString().trim())); }
    });
   } catch (RuntimeException unavailable) {
    busy.set(false); call.resolve(result("unavailable", "Alpha could not show the reset confirmation. Nothing was erased."));
   }
  });
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
   busy.set(false);
   Activity activity = getActivity();
   if (activity == null) return;
   final String text = failureText(failure);
   activity.runOnUiThread(() -> {
    try { if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().loadDataWithBaseURL(null, page(text), "text/html", "utf-8", null); }
    catch (RuntimeException ignored) { /* Reopening resumes the reset. */ }
   });
  });
 }

 /** Wording for a reset that did not finish. Only a reset whose marker was written resumes on reopen. */
 static String failureText(Exception failure) {
  if (failure instanceof AlphaDataResetPlan.NotStarted) return "Reset did not start. Nothing was erased. Close and reopen Alpha to keep using it.";
  return "Alpha data reset is not finished. Close and reopen Alpha to continue it; Alpha stays stopped until then. If it still does not finish, open Android Settings, then Apps, then Alpha, then Storage, and choose Clear storage.";
 }

 private static String page(String text) {
  return "<!doctype html><meta name=viewport content='width=device-width'><body style='font:18px/1.5 sans-serif;padding:32px'><p role=status>" + text + "</p></body>";
 }
}
