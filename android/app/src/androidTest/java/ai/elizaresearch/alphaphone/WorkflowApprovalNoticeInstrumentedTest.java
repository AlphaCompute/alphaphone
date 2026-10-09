package ai.elizaresearch.alphaphone;

import android.app.*;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

/** Phone-step approval notices: builders always; OS posting and the tap route only in a dedicated, runner-owned campaign. */
public final class WorkflowApprovalNoticeInstrumentedTest {
 private static String approvalId(char fill){return "approval-"+String.valueOf(fill).repeat(64);}
 /** Builders only: no OS notification is posted. */
 @Test public void approvalAndStepBuildersAreRedactedAndExpire()throws Exception{
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();WorkflowNoticePoster poster=new WorkflowNoticePoster(context);new HostedNoticePoster(context);NotificationManager manager=context.getSystemService(NotificationManager.class);
  assertEquals(NotificationManager.IMPORTANCE_HIGH,manager.getNotificationChannel(WorkflowNoticePoster.APPROVAL_CHANNEL).getImportance());
  assertEquals(NotificationManager.IMPORTANCE_DEFAULT,manager.getNotificationChannel(WorkflowNoticePoster.CHANNEL).getImportance());
  assertEquals("Only approvals use a high-importance channel",NotificationManager.IMPORTANCE_DEFAULT,manager.getNotificationChannel(AlphaHostedResultsPlugin.CHANNEL).getImportance());
  PendingIntent tap=PendingIntent.getActivity(context,0,new Intent(context,MainActivity.class),PendingIntent.FLAG_IMMUTABLE);
  Notification approval=poster.approval(WorkflowNoticeDelivery.APPROVAL_TITLE,WorkflowNoticeDelivery.APPROVAL_BODY,10*60000L,tap).build();
  assertEquals(WorkflowNoticePoster.APPROVAL_CHANNEL,approval.getChannelId());assertEquals(10*60000L,approval.getTimeoutAfter());assertEquals(Notification.VISIBILITY_PRIVATE,approval.visibility);assertNotNull(approval.publicVersion);
  assertEquals(0,approval.flags&Notification.FLAG_AUTO_CANCEL);assertTrue("A tap only opens the run; there is no approve action",approval.actions==null||approval.actions.length==0);
  assertThrows(IllegalArgumentException.class,()->poster.approval(WorkflowNoticeDelivery.APPROVAL_TITLE,WorkflowNoticeDelivery.APPROVAL_BODY,0,tap));
  Notification step=poster.step("Fixture title","Fixture body",tap).build();
  assertEquals(WorkflowNoticePoster.CHANNEL,step.getChannelId());assertEquals(WorkflowNoticeDelivery.STEP_NOTICE_TIMEOUT_MS,step.getTimeoutAfter());assertEquals(Notification.VISIBILITY_PRIVATE,step.visibility);assertNotNull(step.publicVersion);
 }
 private JSONObject call(String expression)throws Exception{
  WebViewTestDriver.evaluate("window.__approvalNotice=null;Promise.resolve().then(()=>"+expression+").then(v=>window.__approvalNotice=JSON.stringify(v||{}),()=>window.__approvalNotice=JSON.stringify({error:true}))");
  long end=SystemClock.elapsedRealtime()+15000;
  while(SystemClock.elapsedRealtime()<end){String raw=WebViewTestDriver.evaluate("window.__approvalNotice");if(!"null".equals(raw)&&!"undefined".equals(raw))return new JSONObject((String)new JSONTokener(raw).nextValue());SystemClock.sleep(50);}throw new AssertionError("Approval notice bridge timed out");
 }
 private Notification active(NotificationManager manager,String id){for(StatusBarNotification row:manager.getActiveNotifications())if(("alpha-workflow-"+id).equals(row.getTag()))return row.getNotification();return null;}
 /** Runner-owned: a fresh secondary user with notification permission granted. Synthetic route; no agent, account or device action. */
 @Test public void approvalNoticeOpensItsRunOnceAndIsWithdrawnOnDecision()throws Exception{
  org.junit.Assume.assumeTrue("Dedicated workflow approval notice campaign","1".equals(InstrumentationRegistry.getArguments().getString("workflowApprovalNotice")));
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();NotificationManager manager=context.getSystemService(NotificationManager.class);AlphaCredentialStore store=new AlphaCredentialStore(context);
  assertNull("Fresh approval fixture required",store.readCredentialSlot(WorkflowNoticeDelivery.APPROVAL_SLOT));
  String id=approvalId('d'),run="fixture-run-"+java.util.UUID.randomUUID();long expiresAt=System.currentTimeMillis()+10*60000L;
  JSONObject route=new JSONObject().put("scope","a".repeat(64)).put("origin","https://workflow-fixture.invalid").put("ownerId","fixture-owner").put("agentId","fixture-agent").put("workflowId","fixture-flow").put("runId",run).put("versionId","fixture-version");
  JSONObject input=new JSONObject().put("id",id).put("bindingHash","b".repeat(64)).put("expiresAt",expiresAt).put("route",route);
  try(BoundedActivityScenario<MainActivity> activity=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();
   assertEquals("succeeded",call("Capacitor.Plugins.AlphaHostedResults.postWorkflowApprovalNotice("+input+")").getString("status"));
   assertEquals("Posted at most once","succeeded",call("Capacitor.Plugins.AlphaHostedResults.postWorkflowApprovalNotice("+input+")").getString("status"));
   Notification notice=active(manager,id);assertNotNull("Approval notice posted",notice);assertEquals(WorkflowNoticePoster.APPROVAL_CHANNEL,notice.getChannelId());
   long timeout=notice.getTimeoutAfter();assertTrue("Times out at the approval expiry",timeout>0&&timeout<=10*60000L);
   assertFalse("Redacted: no route identity in the notice",notice.extras.toString().contains(run)||notice.extras.toString().contains("fixture-flow"));
   String token=WorkflowNoticeTapsFactory.create(context).token(id);assertNotNull(token);
   notice.contentIntent.send();
   long end=SystemClock.elapsedRealtime()+15000;JSONObject pending=new JSONObject();
   while(SystemClock.elapsedRealtime()<end){pending=call("Capacitor.Plugins.AlphaNotifications.pendingWorkflowTap()");if(token.equals(pending.optString("token")))break;SystemClock.sleep(100);}
   assertEquals("Tap resolves to its exact run",run,pending.optString("runId"));assertTrue(pending.optBoolean("retained"));
   // The durable route is readable without the plugin instance (the process-death path reads the same ledgers).
   assertEquals(token,WorkflowNoticeTapsFactory.create(context).pending().getString("token"));
   assertFalse(call("Capacitor.Plugins.AlphaNotifications.consumeWorkflowTap({token:"+JSONObject.quote(token)+"})").has("error"));
   assertNull("Opening the notice cancels it",active(manager,id));
   assertFalse(call("Capacitor.Plugins.AlphaHostedResults.withdrawWorkflowApprovalNotice({id:"+JSONObject.quote(id)+"})").has("error"));
   assertEquals("A decided approval is never reposted","withdrawn",call("Capacitor.Plugins.AlphaHostedResults.postWorkflowApprovalNotice("+input+")").getString("status"));
   assertNull(active(manager,id));assertNull("Route released",WorkflowNoticeTapsFactory.create(context).token(id));
  }finally{manager.cancel("alpha-workflow-"+id,0);store.removeCredentialSlot(WorkflowNoticeDelivery.APPROVAL_SLOT);}
 }
}
