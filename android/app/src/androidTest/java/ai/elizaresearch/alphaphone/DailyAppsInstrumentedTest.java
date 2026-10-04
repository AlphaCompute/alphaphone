package ai.elizaresearch.alphaphone;
import ai.eliza.plugins.reminders.ReminderTestAccess;

import android.os.SystemClock;
import android.view.KeyEvent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Real bundled WebView -> Capacitor -> Android activity flows. No mocked plugins. */
@RunWith(AndroidJUnit4.class)
public class DailyAppsInstrumentedTest {
 private String evaluate(BoundedActivityScenario<MainActivity> scenario, String js) throws Exception {
  return WebViewTestDriver.evaluate(js);
 }
 private void ready(BoundedActivityScenario<MainActivity> scenario) throws Exception {
  for (int i = 0; i < 100; i++) {
   if ("true".equals(evaluate(scenario, "Boolean(document.querySelector('[data-screen]') && window.Capacitor?.Plugins?.DailyApps)"))) return;
   SystemClock.sleep(100);
  }
  fail("DailyApps bridge did not mount");
 }
 private JSONObject result(BoundedActivityScenario<MainActivity> scenario) throws Exception {
  for (int i = 0; i < 100; i++) {
   String value = evaluate(scenario, "window.__dailyTestResult || null");
   if (!"null".equals(value)) return new JSONObject((String)new JSONTokener(value).nextValue());
   SystemClock.sleep(100);
  }
  fail("DailyApps did not resolve"); return null;
 }
 private void begin(BoundedActivityScenario<MainActivity> scenario, String expression) throws Exception {
  evaluate(scenario, "window.__dailyTestResult=null; (" + expression + ").then(v=>window.__dailyTestResult=JSON.stringify(v)).catch(e=>window.__dailyTestResult=JSON.stringify({error:String(e)}))");
 }
 private void uiWait(BoundedActivityScenario<MainActivity> scenario, String condition) throws Exception {
  for(int i=0;i<100;i++){if("true".equals(evaluate(scenario,"Boolean("+condition+")")))return;SystemClock.sleep(100);}
  fail("Calendar flow condition missing: "+condition);
 }
 @Test public void calendarFormCreatesAndDeletesRealReminder() throws Exception {
  android.content.Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  if(android.os.Build.VERSION.SDK_INT>=33) InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(),android.Manifest.permission.POST_NOTIFICATIONS);
  String title="Calendar reminder "+java.util.UUID.randomUUID();
  String reminderId=null;
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)) {
   ready(scenario);evaluate(scenario,AppNavigation.request("Calendar"));uiWait(scenario,AppNavigation.selected("Calendar"));
   evaluate(scenario,"document.querySelector('button[aria-label=\"New event\"]').click()");
   uiWait(scenario,"document.querySelector('input[aria-label=Title]')");
   evaluate(scenario,"(()=>{const e=document.querySelector('input[aria-label=Title]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,"+JSONObject.quote(title)+");e.dispatchEvent(new Event('input',{bubbles:true}));})()");
   uiWait(scenario,"document.querySelector('button[aria-label=Tomorrow]')");
   evaluate(scenario,"document.querySelector('button[aria-label=Tomorrow]').click()");
   evaluate(scenario,"[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Reminders').click()");
   evaluate(scenario,"document.querySelector('button[aria-label=\"Save event\"]').click()");
   uiWait(scenario,"!document.querySelector('button[aria-label=\"Save event\"]')");
   begin(scenario,"Capacitor.Plugins.DailyApps.listReminders()");
   JSONArray rows=result(scenario).getJSONArray("reminders");
   for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(title.equals(row.getString("title"))){reminderId=row.getString("id");assertEquals("scheduled",row.getString("status"));assertTrue(row.getLong("at")>System.currentTimeMillis());}}
   assertNotNull("Real native record created from Calendar form",reminderId);
   // Saving returns to Calendar; select the record's civil day before opening it.
   long due=ReminderTestAccess.read(context,reminderId).getLong("dueAt");
   evaluate(scenario,"document.querySelector('button[aria-label=\"Month view\"]').click()");
   evaluate(scenario,"(()=>{const d=new Date("+due+");const now=new Date();if(d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear())document.querySelector('button[aria-label=\"Next month\"]').click();})()");
   String day="(()=>{const d=new Date("+due+");const label=d.toLocaleDateString('en-US',{weekday:'long'})+' '+d.toLocaleDateString('en-US',{month:'long'})+' '+d.getDate();return [...document.querySelectorAll('button[aria-label]')].find(b=>b.getAttribute('aria-label')===label);})()";
   uiWait(scenario,day);evaluate(scenario,"("+day+").click()");
   String selected="[...document.querySelectorAll('button[aria-label]')].find(b=>b.getAttribute('aria-label').startsWith("+JSONObject.quote(title+", ")+"))";
   uiWait(scenario,selected);evaluate(scenario,"("+selected+").click()");
   uiWait(scenario,"[...document.querySelectorAll('[data-screen] h1')].some(h=>h.textContent==="+JSONObject.quote(title)+")");
   evaluate(scenario,"document.querySelector('button[aria-label=\"Delete event\"]').click()");
   uiWait(scenario,"!document.querySelector('button[aria-label=\"Delete event\"]')");
   begin(scenario,"Capacitor.Plugins.DailyApps.listReminders()");rows=result(scenario).getJSONArray("reminders");
   boolean cancelled=false;
   for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(reminderId.equals(row.getString("id")))cancelled="cancelled".equals(row.getString("status"));}
   assertTrue("Calendar Delete cancels the real native reminder",cancelled);
  } finally {
   JSONArray rows=ReminderTestAccess.list(context);
   for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(title.equals(row.optString("title")))ReminderTestAccess.cancel(context,row.getString("id"));}
  }
 }
 @Test public void nativeCapabilityInventoryIsExplicit() throws Exception {
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   ready(scenario); begin(scenario, "Capacitor.Plugins.DailyApps.capabilities()");
   JSONObject value = result(scenario); assertEquals("android", value.getString("platform"));
   JSONArray actions = value.getJSONArray("actions");
   java.util.Set<String> expected = new java.util.HashSet<>(java.util.Arrays.asList("camera", "photos", "files", "maps", "calendar", "calendar-create", "reminder", "email", "inbox", "browser", "notifications", "settings", "autofill", "voice"));
   java.util.Set<String> actual = new java.util.HashSet<>();
   boolean files = false;
   for (int i = 0; i < actions.length(); i++) {
    JSONObject item = actions.getJSONObject(i); item.getBoolean("available");
    assertTrue("Duplicate native action", actual.add(item.getString("action")));
    assertTrue(item.getString("mode").equals("handoff") || item.getString("mode").equals("selection"));
    if (item.getString("action").equals("files")) { files = true; assertTrue("AOSP document picker exists",item.getBoolean("available")); }
   }
   assertEquals("Exact MVP handoff and selection inventory", expected, actual);
   for (String deferred : new String[]{"phone", "messages", "contacts"}) assertFalse("Deferred action must remain absent: " + deferred, actual.contains(deferred));
   assertTrue(files);
  }
 }
 @Test public void dangerousBrowserTargetsAndInvalidCalendarTimesAreRejected() throws Exception {
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   ready(scenario);
   for (String url : new String[]{"javascript:alert(1)", "file:///data/local/tmp/private", "content://com.android.contacts/contacts", "intent://settings", "https://user:password@example.com"}) {
    begin(scenario, "Capacitor.Plugins.DailyApps.perform({action:'browser',url:" + JSONObject.quote(url) + "})");
    assertEquals(url, "failed", result(scenario).getString("status"));
   }
   begin(scenario, "Capacitor.Plugins.DailyApps.perform({action:'calendar-create',startTime:1000,endTime:1})");
   assertEquals("failed", result(scenario).getString("status"));
   begin(scenario, "Capacitor.Plugins.DailyApps.perform({action:'unknown'})");
   assertEquals("failed", result(scenario).getString("status"));
  }
 }
 @Test public void documentPickerCancellationReturnsWithoutInventedSelection() throws Exception {
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   ready(scenario); begin(scenario, "Capacitor.Plugins.DailyApps.perform({action:'files'})");
   boolean opened = false;
   for (int i = 0; i < 50; i++) {
    android.os.ParcelFileDescriptor pipe = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("dumpsys activity activities");
    String state;
    try (java.io.InputStream input = new android.os.ParcelFileDescriptor.AutoCloseInputStream(pipe)) {
     state = new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
    }
    opened = state.lines().anyMatch(line -> (line.contains("mResumedActivity") || line.contains("topResumedActivity")) && (line.contains("documentsui") || line.contains("DocumentsActivity")));
    if (opened) break;
    SystemClock.sleep(100);
   }
   assertTrue("Real Android document picker opened", opened);
   WebViewTestDriver.cancelDocumentPicker();
   SystemClock.sleep(300);
   JSONObject value = result(scenario); assertEquals("cancelled", value.getString("status")); assertFalse(value.has("uri"));
  }
 }
 @Test public void localReminderPostsRealNotificationAndTapOpensItsContext() throws Exception {
  android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
  if (android.os.Build.VERSION.SDK_INT >= 33) InstrumentationRegistry.getInstrumentation().getUiAutomation()
   .grantRuntimePermission(context.getPackageName(), android.Manifest.permission.POST_NOTIFICATIONS);
  String id = "e2e_reminder_" + System.currentTimeMillis();
  android.app.NotificationManager notifications = context.getSystemService(android.app.NotificationManager.class);
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   ready(scenario);
   AppNavigation.liveMode();
   begin(scenario, "(async()=>{window.__pendingReminderSignals=0;window.__reminderTapListener=await Capacitor.Plugins.DailyApps.addListener('pendingReminderTap',()=>window.__pendingReminderSignals++);return {ready:true};})()");
   assertTrue(result(scenario).getBoolean("ready"));
   long at = System.currentTimeMillis() + 2000;
   begin(scenario, "Capacitor.Plugins.DailyApps.scheduleReminder({id:" + JSONObject.quote(id) + ",title:" + JSONObject.quote("Device flow test " + id) + ",body:'Local reminder delivery',at:" + at + "})");
   JSONObject scheduled = result(scenario); assertEquals(scheduled.toString(), "scheduled", scheduled.getString("status")); assertEquals("inexact", scheduled.getString("mode"));
   android.service.notification.StatusBarNotification posted = null;
   for (int i = 0; i < 120; i++) {
    for (android.service.notification.StatusBarNotification item : notifications.getActiveNotifications()) if (id.equals(item.getTag())) posted = item;
    if (posted != null) break;
    SystemClock.sleep(500);
   }
   assertNotNull("Real inexact AlarmManager delivery posts a notification", posted);
   assertEquals("Device flow test " + id, posted.getNotification().extras.getString(android.app.Notification.EXTRA_TITLE));
   begin(scenario, "Capacitor.Plugins.DailyApps.listReminders()");
   JSONArray records = result(scenario).getJSONArray("reminders"); boolean found = false;
   for (int i = 0; i < records.length(); i++) if (records.getJSONObject(i).getString("id").equals(id)) {
    found = true; assertEquals("posted",records.getJSONObject(i).getString("status")); assertTrue(records.getJSONObject(i).getLong("postedAt") >= at);
   }
   assertTrue(found);
   posted.getNotification().contentIntent.send();
   boolean opened = false;
   for (int i = 0; i < 50; i++) {
    if ("true".equals(evaluate(scenario, "window.__pendingReminderSignals>0"))) { opened = true; break; }
    SystemClock.sleep(100);
   }
   assertTrue("Durable notification tap signals pending delivery", opened);
   boolean detailOpened = false;
   for (int i = 0; i < 80; i++) {
    if ("true".equals(evaluate(scenario,"document.documentElement.dataset.activeView==='calendar' && [...document.querySelectorAll('[data-screen] h1')].some(h=>h.textContent==="+JSONObject.quote("Device flow test " + id)+") && !!document.querySelector('button[aria-label=\"Edit event\"]')"))) { detailOpened=true; break; }
    SystemClock.sleep(100);
   }
   assertTrue("Notification tap opens this reminder's real Calendar detail", detailOpened);
   begin(scenario, "(async()=>{const d=Capacitor.Plugins.DailyApps,id="+JSONObject.quote(id)+";const target=await d.selectedReminder({id});const operation={type:\"reminder_cancel\",target};const bindingHash=Array.from(new Uint8Array(await crypto.subtle.digest(\"SHA-256\",new TextEncoder().encode(JSON.stringify(operation))))).map(v=>v.toString(16).padStart(2,\"0\")).join(\"\");return d.cancelReminder({id,target,operationId:crypto.randomUUID(),bindingHash});})()");
   assertEquals("cancelled", result(scenario).getString("status"));
   for (android.service.notification.StatusBarNotification item : notifications.getActiveNotifications()) assertNotEquals(id,item.getTag());
   begin(scenario, "Capacitor.Plugins.DailyApps.scheduleReminder({id:'past_test',title:'Past',at:1})");
   assertEquals("past", result(scenario).getString("status"));
  } finally { ReminderTestAccess.cancel(context,id); }
 }

 @Test public void rootBackFinishesStandaloneAndKeepsLauncherHome() throws Exception {
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   ready(scenario);
   for (int i = 0; i < 30; i++) {
    if ("\"false\"".equals(evaluate(scenario,"document.documentElement.dataset.alphaCanGoBack"))) break;
    SystemClock.sleep(100);
   }
   assertEquals("Home has no in-app back history", "\"false\"", evaluate(scenario,"document.documentElement.dataset.alphaCanGoBack"));
   WebViewTestDriver.pressBack();
   if (BuildConfig.IS_LAUNCHER) {
    SystemClock.sleep(300);
    assertEquals(androidx.lifecycle.Lifecycle.State.RESUMED, scenario.getState());
    assertEquals("true",evaluate(scenario,"Boolean(document.querySelector('[data-screen]'))"));
   } else {
    for (int i = 0; i < 50 && scenario.getState() != androidx.lifecycle.Lifecycle.State.DESTROYED; i++) SystemClock.sleep(100);
    assertEquals(androidx.lifecycle.Lifecycle.State.DESTROYED, scenario.getState());
   }
  }
 }

}
