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
 private static JSONObject route(String owner,String run)throws Exception{return new JSONObject().put("scope","a".repeat(64)).put("origin","https://workflow-fixture.invalid").put("ownerId",owner).put("agentId","fixture-agent").put("workflowId","fixture-flow").put("runId",run).put("versionId","fixture-version");}
 private static StatusBarNotification row(NotificationManager manager,String id){StatusBarNotification found=null;for(StatusBarNotification row:manager.getActiveNotifications())if(("alpha-workflow-"+id).equals(row.getTag())){assertNull("One OS notice per approval",found);assertEquals(0,row.getId());found=row;}return found;}
 /** A cancelled notice leaves the active list asynchronously. */
 private static void awaitGone(NotificationManager manager,String id,String message){long end=SystemClock.elapsedRealtime()+5000;while(row(manager,id)!=null&&SystemClock.elapsedRealtime()<end)SystemClock.sleep(50);assertNull(message,row(manager,id));}
 /** Runner-owned, as above. The connected owner changes while the first owner's approval notice is pending: the notice is
  * withdrawn, its retained tap opens nothing, the new owner's notice is untouched and the old approval is never posted again.
  * Synthetic routes and owner IDs; no agent, account, sign-in or device action. The renderer's refusal to review another
  * owner's run is browser evidence (test/browser/workflow-notice-taps.spec.ts), not this test. */
 @Test public void ownerChangeWithdrawsThePendingApprovalNoticeAndItsTapOpensNothing()throws Exception{
  org.junit.Assume.assumeTrue("Dedicated workflow approval notice campaign","1".equals(InstrumentationRegistry.getArguments().getString("workflowApprovalNotice")));
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();NotificationManager manager=context.getSystemService(NotificationManager.class);AlphaCredentialStore store=new AlphaCredentialStore(context);
  assertNull("Fresh approval fixture required",store.readCredentialSlot(WorkflowNoticeDelivery.APPROVAL_SLOT));
  String oldId=approvalId('e'),nextId=approvalId('f'),oldRun="fixture-old-"+java.util.UUID.randomUUID(),nextRun="fixture-next-"+java.util.UUID.randomUUID();long expiresAt=System.currentTimeMillis()+10*60000L;
  JSONObject oldInput=new JSONObject().put("id",oldId).put("bindingHash","b".repeat(64)).put("expiresAt",expiresAt).put("route",route("fixture-owner",oldRun));
  JSONObject nextInput=new JSONObject().put("id",nextId).put("bindingHash","c".repeat(64)).put("expiresAt",expiresAt).put("route",route("fixture-next-owner",nextRun));
  String change="Capacitor.Plugins.AlphaHostedResults.withdrawOtherOwnerApprovalNotices({ownerId:\"fixture-next-owner\"})";
  try(BoundedActivityScenario<MainActivity> activity=BoundedActivityScenario.launch(MainActivity.class)){
   AppNavigation.liveMode();
   assertEquals("succeeded",call("Capacitor.Plugins.AlphaHostedResults.postWorkflowApprovalNotice("+oldInput+")").getString("status"));
   assertEquals("succeeded",call("Capacitor.Plugins.AlphaHostedResults.postWorkflowApprovalNotice("+nextInput+")").getString("status"));
   StatusBarNotification oldNotice=row(manager,oldId),nextNotice=row(manager,nextId);assertNotNull("First owner's approval notice posted",oldNotice);assertNotNull("Next owner's approval notice posted",nextNotice);
   PendingIntent oldTap=oldNotice.getNotification().contentIntent;assertNotNull(oldTap);
   String oldToken=WorkflowNoticeTapsFactory.create(context).token(oldId),nextToken=WorkflowNoticeTapsFactory.create(context).token(nextId);assertNotNull(oldToken);assertNotNull(nextToken);assertNotEquals(oldToken,nextToken);
   // The owner changes. Only the next owner's ID crosses the bridge.
   assertEquals("Exactly the first owner's notice is withdrawn",1,call(change).getInt("withdrawn"));
   awaitGone(manager,oldId,"The first owner's approval notice is withdrawn");
   StatusBarNotification kept=row(manager,nextId);assertNotNull("The next owner's notice stays",kept);assertEquals("The next owner's notice was not posted again",nextNotice.getPostTime(),kept.getPostTime());
   assertNull("First owner's route released",WorkflowNoticeTapsFactory.create(context).token(oldId));assertEquals(nextToken,WorkflowNoticeTapsFactory.create(context).token(nextId));
   JSONObject receipts=new JSONObject(store.readCredentialSlot(WorkflowNoticeDelivery.APPROVAL_SLOT));
   assertEquals(2,receipts.length());assertEquals("withdrawn",receipts.getJSONObject(oldId).getString("status"));assertEquals(expiresAt,receipts.getJSONObject(oldId).getLong("expiresAt"));assertEquals("succeeded",receipts.getJSONObject(nextId).getString("status"));
   // A tap on the withdrawn notice that the OS still held: it opens nothing under the next owner.
   oldTap.send();
   long quiet=SystemClock.elapsedRealtime()+3000;
   while(SystemClock.elapsedRealtime()<quiet){JSONObject stale=call("Capacitor.Plugins.AlphaNotifications.pendingWorkflowTap()");assertFalse("A withdrawn approval tap must not become pending",stale.has("token")||stale.has("runId"));SystemClock.sleep(100);}
   // Positive control through the same single notice worker, after the stale tap: the next owner's own tap opens its exact run.
   kept.getNotification().contentIntent.send();
   long end=SystemClock.elapsedRealtime()+15000;JSONObject pending=new JSONObject();
   while(SystemClock.elapsedRealtime()<end){pending=call("Capacitor.Plugins.AlphaNotifications.pendingWorkflowTap()");if(nextToken.equals(pending.optString("token")))break;SystemClock.sleep(100);}
   assertEquals("Only the next owner's tap is pending",nextToken,pending.optString("token"));assertEquals(nextRun,pending.optString("runId"));assertEquals("fixture-next-owner",pending.optString("ownerId"));assertEquals(nextId,pending.optString("operationId"));assertTrue(pending.optBoolean("retained"));
   assertNull(WorkflowNoticeTapsFactory.create(context).token(oldId));
   // The first owner's approval is never posted again, also if its request is repeated.
   assertEquals("withdrawn",call("Capacitor.Plugins.AlphaHostedResults.postWorkflowApprovalNotice("+oldInput+")").getString("status"));
   assertNull(row(manager,oldId));assertNull("A repeated request keeps no route",WorkflowNoticeTapsFactory.create(context).token(oldId));
   assertEquals("A repeated owner change withdraws nothing more",0,call(change).getInt("withdrawn"));
   assertTrue("An owner change without an owner is refused",call("Capacitor.Plugins.AlphaHostedResults.withdrawOtherOwnerApprovalNotices({})").has("error"));
   kept=row(manager,nextId);assertNotNull(kept);assertEquals(nextNotice.getPostTime(),kept.getPostTime());
   receipts=new JSONObject(store.readCredentialSlot(WorkflowNoticeDelivery.APPROVAL_SLOT));assertEquals(2,receipts.length());assertEquals("withdrawn",receipts.getJSONObject(oldId).getString("status"));assertEquals("succeeded",receipts.getJSONObject(nextId).getString("status"));
   assertFalse(call("Capacitor.Plugins.AlphaNotifications.consumeWorkflowTap({token:"+JSONObject.quote(nextToken)+"})").has("error"));
   awaitGone(manager,nextId,"Opening the next owner's notice cancels it");
   assertFalse(call("Capacitor.Plugins.AlphaHostedResults.withdrawWorkflowApprovalNotice({id:"+JSONObject.quote(nextId)+"})").has("error"));
   assertNull("Route released",WorkflowNoticeTapsFactory.create(context).token(nextId));
  }finally{manager.cancel("alpha-workflow-"+oldId,0);manager.cancel("alpha-workflow-"+nextId,0);store.removeCredentialSlot(WorkflowNoticeDelivery.APPROVAL_SLOT);}
 }
}
