package ai.elizaresearch.alphaphone;

import android.app.*;
import android.content.*;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Actual Android notifications -> exact prototype shade -> native open/dismiss. */
@RunWith(AndroidJUnit4.class)
public class NotificationsInstrumentedTest {
 private void until(String condition)throws Exception{long end=SystemClock.elapsedRealtime()+20000;while(SystemClock.elapsedRealtime()<end){if("true".equals(WebViewTestDriver.evaluate("Boolean("+condition+")")))return;SystemClock.sleep(100);}fail("Notification state: "+condition);}
 private void shade()throws Exception{
  WebViewTestDriver.evaluate("(()=>{const s=document.querySelector('[data-screen]'),r=s.getBoundingClientRect(),scale=r.width/412;for(const [type,y] of [['pointerdown',50],['pointerup',200]])s.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+200*scale,clientY:r.top+y*scale,pointerId:1,pointerType:'touch'}));})()");
  until("document.querySelector('[data-alpha-layer=shade]').getAttribute('aria-hidden')==='false'");
 }
 private String button(String title){return "document.querySelector('[data-alpha-layer=shade] button[aria-label='+"+JSONObject.quote(JSONObject.quote("Open "+title))+"+']')";}
 @Test public void actualNotificationsRenderRecreateOpenAndClear()throws Exception{
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();NotificationManager manager=context.getSystemService(NotificationManager.class);
  InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(),android.Manifest.permission.POST_NOTIFICATIONS);
  ReminderStore.channel(context);String token=java.util.UUID.randomUUID().toString(),title="Synthetic notification "+token,tag="notification-fixture-"+token;
  Intent intent=new Intent(context,MainActivity.class).setAction("alpha.synthetic.notification.open").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
  PendingIntent tap=PendingIntent.getActivity(context,token.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();WebViewTestDriver.evaluate(AppNavigation.request("Home"));until("document.querySelector('[data-screen]')&&!document.querySelector('.alpha-connection-scrim')");
   manager.notify(tag,1,new Notification.Builder(context,ReminderStore.CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle(title).setContentText("Actual Android fixture body").setContentIntent(tap).setAutoCancel(true).build());
   WebViewTestDriver.evaluate("window.__missingNoticeRejected=undefined;Capacitor.Plugins.AlphaNotifications.open({}).then(()=>window.__missingNoticeRejected=false,()=>window.__missingNoticeRejected=true)");
   until("window.__missingNoticeRejected===true");
   WebViewTestDriver.evaluate("window.__missingDismissFinished=false;Capacitor.Plugins.AlphaNotifications.dismiss({}).then(()=>window.__missingDismissFinished=true)");until("window.__missingDismissFinished===true");
   boolean fixtureStillPresent=false;for(android.service.notification.StatusBarNotification row:manager.getActiveNotifications())if(tag.equals(row.getTag())&&row.getId()==1)fixtureStillPresent=true;
   assertTrue("Missing opaque ID cannot open or dismiss an unseen notification",fixtureStillPresent);
   shade();until(button(title));assertEquals("true",WebViewTestDriver.evaluate("document.querySelector('[data-alpha-layer=shade]').innerText.includes('Actual Android fixture body')"));
   scenario.recreate();WebViewTestDriver.evaluate(AppNavigation.request("Home"));until("document.querySelector('[data-screen]')&&!document.querySelector('.alpha-connection-scrim')");shade();until(button(title));
   WebViewTestDriver.evaluate("("+button(title)+").click()");
   boolean removed=false;for(int i=0;i<100;i++){removed=true;for(android.service.notification.StatusBarNotification row:manager.getActiveNotifications())if(tag.equals(row.getTag())&&row.getId()==1)removed=false;if(removed)break;SystemClock.sleep(100);}assertTrue("Opening auto-cancel notification removes real Android notification",removed);
   manager.notify(tag,2,new Notification.Builder(context,ReminderStore.CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle(title+" clear").setContentText("Clearable fixture").build());
   until(button(title+" clear"));WebViewTestDriver.evaluate("document.querySelector('[data-alpha-layer=shade] button[aria-label=\"Clear all\"]').click()");until("!("+button(title+" clear")+")");
   for(android.service.notification.StatusBarNotification row:manager.getActiveNotifications())assertFalse("Clear action reaches Android",tag.equals(row.getTag()));
  }finally{manager.cancel(tag,1);manager.cancel(tag,2);tap.cancel();}
 }
}
