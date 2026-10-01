package ai.elizaresearch.alphaphone;

import android.app.Activity;
import android.Manifest;
import android.os.Build;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
// MVP-DEFERRED: import android.provider.ContactsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

/** Product handoffs only. Opening another app never proves that a write completed. */
@CapacitorPlugin(name = "DailyApps", permissions = {@Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})})
public class DailyAppsPlugin extends Plugin {
 private static final String[] ACTIONS = {"camera", "photos", "files", "maps", "calendar", "calendar-create", "reminder", "email", "inbox", "browser", "notifications", "settings", "autofill", "voice"}; // MVP-DEFERRED: "phone", "messages", "contacts".
 private boolean selectionPending;

 @Override public void load() {
  SelectedDocumentAccess.initialize(getContext());
  ReminderStore.restore(getContext());
  openReminder(getActivity().getIntent());
  openAssistant();
 }
 @Override protected void handleOnNewIntent(Intent intent) { openReminder(intent); openAssistant(); }
 @Override protected void handleOnResume() { notifyListeners("appResumed", new JSObject(), true); }
 private void openAssistant() {
  if (!(getActivity() instanceof AlphaAssistActivity)) return;
  JSObject value = new JSObject(); value.put("source", "android-assist"); value.put("surface", "assistant");
  notifyListeners("assistantInvoked", value, true);
 }
 @PluginMethod public void surfaceInfo(PluginCall call) {
  JSObject value = new JSObject(); value.put("assistant", getActivity() instanceof AlphaAssistActivity); value.put("developmentBuild", BuildConfig.DEBUG);
  value.put("topInset", getActivity() instanceof MainActivity ? ((MainActivity)getActivity()).getTopInsetDp() : 0);
  value.put("bottomInset", getActivity() instanceof MainActivity ? ((MainActivity)getActivity()).getBottomInsetDp() : 0); call.resolve(value);
 }
 @PluginMethod public void closeAssistant(PluginCall call) {
  boolean assistant = getActivity() instanceof AlphaAssistActivity;
  JSObject value = new JSObject(); value.put("closed", assistant); call.resolve(value);
  if (assistant) getActivity().runOnUiThread(() -> getActivity().finish());
 }
 private void openReminder(Intent intent) {
  if (intent == null) return;
  String id = intent.getStringExtra(ReminderStore.OPEN_ID);
  if (ReminderStore.validId(id)) {
   JSObject result = new JSObject(); result.put("id", id); result.put("occurrenceId",intent.getStringExtra(ReminderStore.OCCURRENCE));
   notifyListeners("reminderOpened", result, true);
   intent.removeExtra(ReminderStore.OPEN_ID);intent.removeExtra(ReminderStore.OCCURRENCE);
  }
 }
 @PluginMethod public void scheduleReminder(PluginCall call) {
  String id = call.getString("id", ""), title = call.getString("title", ""), body = call.getString("body", "");
  Double at = number(call, "at");
  if (!ReminderStore.validId(id) || title.trim().isEmpty() || title.length() > 200 || body.length() > 4000 || at == null || !Double.isFinite(at) || at > Long.MAX_VALUE) {
   reminderResult(call, "failed", "Enter a valid reminder ID, title, and date"); return;
  }
  if (at <= System.currentTimeMillis()) { reminderResult(call, "past", "Choose a future reminder time"); return; }
  ReminderStore.channel(getContext());
  if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
   requestPermissionForAlias("notifications", call, "reminderPermissionResult"); return;
  }
  completeReminder(call);
 }
 @PermissionCallback private void reminderPermissionResult(PluginCall call) { completeReminder(call); }
 private void completeReminder(PluginCall call) {
  if (!ReminderStore.allowed(getContext())) { reminderResult(call, "permission-denied", "Enable Alpha Phone notifications and its Local reminders channel in Android settings"); return; }
  Double at = number(call, "at");
  if (at == null || at <= System.currentTimeMillis()) { reminderResult(call, "past", "Choose a future reminder time"); return; }
  try {
   ReminderStore.schedule(getContext(), call.getString("id"), call.getString("title"), call.getString("body", ""), at.longValue(),call.getObject("recurrence"));
   JSObject value = new JSObject(); value.put("status", "scheduled"); value.put("id", call.getString("id")); value.put("at", at.longValue()); value.put("mode", "inexact");
   value.put("message", "Saved on this device. Android may delay this reminder to conserve battery."); call.resolve(value);
  } catch (RuntimeException | org.json.JSONException error) { reminderResult(call, "failed", "The reminder could not be saved or scheduled"); }
 }
 @PluginMethod public void reminderDecision(PluginCall call) {
  try { call.resolve(JSObject.fromJSONObject(ReminderStore.decide(getContext(),call.getString("id"),call.getString("occurrenceId"),call.getString("action")))); }
  catch(RuntimeException|org.json.JSONException error){reminderResult(call,"failed","The reminder action could not be saved");}
 }
 @PluginMethod public void selectedReminder(PluginCall call) {
  try{call.resolve(JSObject.fromJSONObject(ReminderStore.selected(getContext(),call.getString("id"))));}catch(RuntimeException|org.json.JSONException error){call.reject("Selected reminder is unavailable");}
 }
 @PluginMethod public void reminderOperationReceipt(PluginCall call) {
  try{call.resolve(JSObject.fromJSONObject(ReminderStore.operationReceipt(getContext(),call.getString("operationId"),call.getString("bindingHash"),call.getObject("operation"))));}catch(RuntimeException|org.json.JSONException error){call.reject("Reminder receipt binding unavailable");}
 }
 @PluginMethod public void operateReminder(PluginCall call) {
  try{call.resolve(JSObject.fromJSONObject(ReminderStore.operate(getContext(),call.getString("operationId"),call.getString("bindingHash"),call.getObject("operation"))));}catch(RuntimeException|org.json.JSONException error){call.reject("Reminder operation could not be confirmed; review saved state before retrying");}
 }
 @PluginMethod public void listReminders(PluginCall call) {
  try { JSObject value = new JSObject(); value.put("reminders", ReminderStore.list(getContext())); value.put("notificationsEnabled", ReminderStore.allowed(getContext())); call.resolve(value); }
  catch (RuntimeException | org.json.JSONException error) { call.reject("Saved reminders could not be read"); }
 }
 @PluginMethod public void cancelReminder(PluginCall call) {
  try { reminderResult(call, ReminderStore.cancel(getContext(), call.getString("id")) ? "cancelled" : "not-found", ""); }
  catch (RuntimeException | org.json.JSONException error) { reminderResult(call, "failed", "The reminder could not be cancelled"); }
 }
 private void reminderResult(PluginCall call, String status, String message) {
  JSObject value = new JSObject(); value.put("id", call.getString("id", "")); value.put("status", status); value.put("mode", "inexact"); value.put("message", message); call.resolve(value);
 }
 @PluginMethod public void restoreSelected(PluginCall call) {try{call.resolve(SelectedDocumentAccess.restore(getContext()));}catch(RuntimeException error){call.reject("Saved document access is unavailable");}}
 @PluginMethod public void renameSelected(PluginCall call) {call.resolve(SelectedDocumentAccess.rename(getContext(),call.getString("selectionId"),call.getString("name")));}
 @PluginMethod public void pdfSelected(PluginCall call) {call.resolve(SelectedDocumentAccess.pdf(getContext(),call.getString("selectionId"),call.getInt("page",0)));}
 @PluginMethod public void readSelected(PluginCall call) {
  call.resolve(SelectedDocumentAccess.read(getContext(), call.getString("selectionId")));
 }
 @PluginMethod public void openSelected(PluginCall call) {
  call.resolve(SelectedDocumentAccess.open(getActivity(), call.getString("selectionId")));
 }
 @PluginMethod public void shareSelected(PluginCall call) {
  call.resolve(SelectedDocumentAccess.share(getActivity(), call.getString("selectionId")));
 }
 @PluginMethod public void forgetSelected(PluginCall call) {
  try{SelectedDocumentAccess.forget(call.getString("selectionId"));call.resolve();}catch(RuntimeException error){call.reject("Document access could not be released");}
 }
 private Integer clockInteger(JSObject data,String key) {
  Object value=data.opt(key);if(value==null||value==org.json.JSONObject.NULL)return null;
  if(!(value instanceof Number))throw new IllegalArgumentException("Invalid Clock number");
  double number=((Number)value).doubleValue();if(!Double.isFinite(number)||number!=Math.rint(number)||number<Integer.MIN_VALUE||number>Integer.MAX_VALUE)throw new IllegalArgumentException("Invalid Clock number");
  return (int)number;
 }
 @PluginMethod public void clockHandoff(PluginCall call) {
  try {
   JSObject data=call.getData();java.util.Iterator<String> keys=data.keys();
   while(keys.hasNext()){String key=keys.next();if(!java.util.Arrays.asList("action","hour","minute","label","snoozeMinutes","reviewed").contains(key))throw new IllegalArgumentException("Unexpected Clock option");}
   Object label=data.opt("label");if(label!=null&&label!=org.json.JSONObject.NULL&&!(label instanceof String))throw new IllegalArgumentException("Invalid Clock label");
   call.resolve(ClockHandoff.launch(getActivity(),call.getString("action"),clockInteger(data,"hour"),clockInteger(data,"minute"),label instanceof String?(String)label:null,clockInteger(data,"snoozeMinutes"),Boolean.TRUE.equals(data.opt("reviewed"))));
  }catch(IllegalArgumentException invalid){call.resolve(ClockHandoff.result(call.getString("action"),"failed",invalid.getMessage()));}
 }
 @PluginMethod public void capabilities(PluginCall call) {
  JSArray actions = new JSArray();
  for (String action : ACTIONS) {
   JSObject item = new JSObject(); item.put("action", action);
   try { item.put("available", intent(action, null).resolveActivity(getContext().getPackageManager()) != null); }
   catch (IllegalArgumentException error) { item.put("available", false); }
   item.put("mode", isSelection(action) ? "selection" : "handoff"); actions.put(item);
  }
  JSObject result = new JSObject(); result.put("platform", "android"); result.put("actions", actions); call.resolve(result);
 }
 private boolean isSelection(String action) { return "photos".equals(action) || "files".equals(action) || "voice".equals(action); }
 private Double number(PluginCall call, String key) {
  // Capacitor getDouble does not accept org.json's Long representation of epoch ms.
  Object value = call.getData().opt(key);
  return value instanceof Number ? ((Number)value).doubleValue() : null;
 }
 private String string(PluginCall call, String key, String fallback) { return call == null ? fallback : call.getString(key, fallback); }
 private Intent intent(String action, PluginCall call) {
  switch (action) {
   // MVP-DEFERRED: case "phone": return new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(string(call, "query", ""))));
   // MVP-DEFERRED: case "messages": return new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(string(call, "query", "")))).putExtra("sms_body", string(call, "body", ""));
   // MVP-DEFERRED: case "contacts": return new Intent(Intent.ACTION_VIEW).setDataAndType(ContactsContract.Contacts.CONTENT_URI, ContactsContract.Contacts.CONTENT_TYPE);
   case "camera": return new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA);
   case "photos": return new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
   case "files": return new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
   case "maps": return new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(string(call, "query", ""))));
   case "calendar": return new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_CALENDAR);
   case "calendar-create": case "reminder": {
    Intent result = new Intent(Intent.ACTION_INSERT).setDataAndType(CalendarContract.Events.CONTENT_URI, "vnd.android.cursor.dir/event");
    result.putExtra(CalendarContract.Events.TITLE, string(call, "title", ""));
    result.putExtra(CalendarContract.Events.DESCRIPTION, string(call, "body", ""));
    if (call != null) {
     Double start = number(call, "startTime"), end = number(call, "endTime");
     if (start != null && (!Double.isFinite(start) || start < 0)) throw new IllegalArgumentException("Choose a valid start time");
     if (end != null && (!Double.isFinite(end) || end < 0 || (start != null && end <= start))) throw new IllegalArgumentException("End time must follow start time");
     if (start != null) result.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start.longValue());
     if (end != null) result.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end.longValue());
    }
    return result;
   }
   case "email": {
    String recipient = string(call, "query", "").trim();
    if (!recipient.isEmpty() && !android.util.Patterns.EMAIL_ADDRESS.matcher(recipient).matches()) throw new IllegalArgumentException("Enter one valid email address");
    Intent result = new Intent(Intent.ACTION_SENDTO, Uri.fromParts("mailto", recipient, null)).putExtra(Intent.EXTRA_SUBJECT, string(call, "title", "")).putExtra(Intent.EXTRA_TEXT, string(call, "body", ""));
    if (!recipient.isEmpty()) result.putExtra(Intent.EXTRA_EMAIL, new String[]{recipient});
    return result;
   }
   case "inbox": return new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_EMAIL);
   case "browser": {
    Uri uri = Uri.parse(string(call, "url", "https://example.com"));
    if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme())) || uri.getHost() == null || uri.getHost().isEmpty() || uri.getUserInfo() != null) throw new IllegalArgumentException("Enter an http or https address without embedded credentials");
    return new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE);
   }
   case "notifications": return new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
   case "settings": return new Intent(Settings.ACTION_SETTINGS);
   // Android has no public generic autofill-picker intent. Provider enablement
   // intents require an installed provider package, which Alpha Phone is not.
   case "autofill": return new Intent(Settings.ACTION_SETTINGS);
   case "voice": return new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_PROMPT, "Dictate your note. Review the transcript before saving.").putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
   default: throw new IllegalArgumentException("Unsupported daily app action");
  }
 }
 @PluginMethod public void perform(PluginCall call) {
  String action = call.getString("action", "");
  try {
   Intent target = intent(action, call);
   if (target.resolveActivity(getContext().getPackageManager()) == null) { finish(call, "unavailable", "No installed app handles this action"); return; }
   if (isSelection(action)) {
    if (selectionPending) { finish(call, "failed", "Finish the current selection first"); return; }
    selectionPending = true;
    startActivityForResult(call, target, "selectionResult");
   } else { getActivity().startActivity(target); finish(call, "opened", "autofill".equals(action) ? "Opened Android settings. Search for passwords or autofill to choose your installed provider." : "Opened the system app. Review and complete the action there."); }
  } catch (ActivityNotFoundException error) { selectionPending = false; finish(call, "unavailable", "The app is no longer available"); }
  catch (SecurityException error) { selectionPending = false; finish(call, "failed", "Android did not allow this action"); }
  catch (IllegalArgumentException error) { finish(call, "failed", error.getMessage()); }
 }
 @ActivityCallback private void selectionResult(PluginCall call, ActivityResult result) {
  selectionPending = false;
  if (call == null) return;
  if (result.getResultCode() != Activity.RESULT_OK) { finish(call, "cancelled", "Nothing was selected or saved"); return; }
  Intent data = result.getData();
  if ("voice".equals(call.getString("action"))) {
   ArrayList<String> words = data == null ? null : data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
   if (words == null || words.isEmpty() || words.get(0).trim().isEmpty()) { finish(call, "failed", "No speech was recognized"); return; }
   JSObject value = base(call, "selected"); value.put("transcript", words.get(0)); resolveResult(call, value); return;
  }
  Uri uri = data == null ? null : data.getData();
  if (uri == null || !"content".equals(uri.getScheme())) { finish(call, "failed", "The provider did not return an accessible document"); return; }
  String selectedId=null;
  try {
   int retainedFlags=0;
   if ((data.getFlags() & Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION) != 0 && (data.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0) {
    final int offered=(data.getFlags() & Intent.FLAG_GRANT_WRITE_URI_PERMISSION)!=0 ? Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION : Intent.FLAG_GRANT_READ_URI_PERMISSION;
    getContext().getContentResolver().takePersistableUriPermission(uri, offered);retainedFlags=offered;
   }
   selectedId=SelectedDocumentAccess.authorize(getContext(),uri,retainedFlags);
   JSObject value = base(call, "selected"); value.put("uri", uri.toString()); value.put("mimeType", getContext().getContentResolver().getType(uri));
   try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
    if (cursor != null && cursor.moveToFirst()) value.put("name", cursor.getString(0));
   }
   value.put("selectionId", selectedId);
   resolveResult(call, value);
  } catch (RuntimeException error) { if(selectedId!=null)try{SelectedDocumentAccess.forget(selectedId);}catch(RuntimeException ignored){} finish(call, "failed", "The document provider could not grant access or read this selection"); }
 }
 private void resolveResult(PluginCall call, JSObject value) {
  if (PluginCall.CALLBACK_ID_DANGLING.equals(call.getCallbackId())) notifyListeners("restoredResult", value, true);
  call.resolve(value);
 }
 private JSObject base(PluginCall call, String status) { JSObject value = new JSObject(); value.put("action", call.getString("action", "")); value.put("status", status); return value; }
 private void finish(PluginCall call, String status, String message) { JSObject value = base(call, status); value.put("message", message); resolveResult(call, value); }
}
