package ai.elizaresearch.alphaphone;

import ai.eliza.plugins.notifications.NoticeDelivery;
import java.util.List;
import java.util.Set;
import org.json.JSONObject;

/** Alpha's inputs to the shared receipt ledger (ai.eliza.plugins.notifications.NoticeDelivery): the slot
 * names, redacted approval text and approval bound already deployed, plus the tap-route step that only
 * this host has. The ledger itself (at-most-once OS dispatch, never reposting an uncertain or dismissed
 * notice) is upstream code; the stored record formats are unchanged. */
final class WorkflowNoticeDelivery {
 interface Storage extends NoticeDelivery.Storage {}
 interface Poster extends NoticeDelivery.Poster {}
 /** An unopened step notice withdraws itself after a day; its receipt and history stay retained. */
 static final long STEP_NOTICE_TIMEOUT_MS=24L*3600000;
 /** Phone-step approvals are short-lived; a longer requested lifetime is refused. */
 static final long MAXIMUM_APPROVAL_MS=7L*86400000;
 /** Deployed slot names. Changing either one orphans the receipts already stored on installed phones. */
 static final String SLOT="workflow-notice-delivery:v1",APPROVAL_SLOT="workflow-approval-notices:v1";
 /** Redacted: no workflow name, destination, source or operation detail leaves the app. */
 static final String APPROVAL_TITLE="Workflow step waiting for approval",APPROVAL_BODY="Open Alpha Phone to review it. Nothing runs until you approve it on this phone.";
 private static final NoticeDelivery.Config CONFIG=new NoticeDelivery.Config(SLOT,APPROVAL_SLOT,APPROVAL_TITLE,APPROVAL_BODY,MAXIMUM_APPROVAL_MS);
 static boolean approvalId(String id){return NoticeDelivery.approvalId(id);}
 private final NoticeDelivery shared;
 WorkflowNoticeDelivery(Storage storage,Poster poster){shared=new NoticeDelivery(CONFIG,storage,poster);}
 /** Time until the approval expires, or -1 when it already expired. */
 long approvalTimeout(long expiresAt,long now){return shared.approvalTimeout(expiresAt,now);}
 String receipt(String id,String binding,String title,String body)throws Exception{return shared.receipt(id,binding,title,body);}
 String publish(String id,String binding,String title,String body)throws Exception{return shared.publish(id,binding,title,body);}
 /** One redacted notice per pending phone-step approval ID, posted at most once and never after a decision withdrew it. */
 String publishApproval(String id,String binding,long expiresAt,long now)throws Exception{return shared.publishApproval(id,binding,expiresAt,now);}
 /** The whole approval post. The tap route is prepared first because the notice's tap needs it. A route
  * whose receipt is not live afterwards (withdrawn, failed) is released again: a repeated request for
  * a decided approval must not keep a route that no notice can ever open. */
 String postApproval(WorkflowNoticeTaps taps,String id,String binding,JSONObject route,long expiresAt,long now)throws Exception{
  if(!approvalId(id)||route==null)throw new IllegalArgumentException("Invalid approval notice identity");
  for(String expired:expireApprovals(now))taps.forget(expired);
  if(approvalTimeout(expiresAt,now)<=0)return "expired";
  taps.prepare(id,binding,route);
  String status=publishApproval(id,binding,expiresAt,now);
  if(!Set.of("applying","succeeded","unknown").contains(status))taps.forget(id);
  return status;
 }
 /** A decision withdraws the notice. The receipt stays (as withdrawn) until expiry, so the notice is never
  * reposted. A decision that arrives before any publish is retained too, for the maximum approval lifetime. */
 void withdrawApproval(String id,long now)throws Exception{shared.withdrawApproval(id,now);}
 /** Removes receipts whose approval expired (the OS already timed the notice out) and returns their IDs. */
 List<String> expireApprovals(long now)throws Exception{return shared.expireApprovals(now);}
}
