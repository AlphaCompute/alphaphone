package ai.elizaresearch.alphaphone;

import android.content.Context;
import org.json.*;
import java.util.concurrent.TimeUnit;
import androidx.work.*;

/** Main-process admission. Agent identity comes from authenticated native owner context,
 * never a renderer-supplied owner or the notification privacy fence. */
final class NativeDeletionCoordinator {
 static final String JOURNAL="native-delete-journal:v1",INSTALLATION="native-delete-installation:v1";
 private static NativeDeletionCoordinator instance;
 private static final String UNKNOWN_BOOT="unknown:"+java.util.UUID.randomUUID();
 private final Context context;private final AlphaCredentialStore store;private final DeferredDeletionJournal calendar;
 static synchronized NativeDeletionCoordinator get(Context context){if(instance==null)instance=new NativeDeletionCoordinator(context.getApplicationContext());return instance;}
 private NativeDeletionCoordinator(Context context){this.context=context;store=new AlphaCredentialStore(context);calendar=new DeferredDeletionJournal(new DeferredDeletionJournal.Store(){public String read()throws Exception{return store.readCredentialSlot(JOURNAL);}public void save(String value)throws Exception{store.writeCredentialSlot(JOURNAL,value);}});}
 private String boot(){try{return "boot:"+android.provider.Settings.Global.getInt(context.getContentResolver(),android.provider.Settings.Global.BOOT_COUNT);}catch(Exception unavailable){return UNKNOWN_BOOT;}}
 private JSONObject clock()throws Exception{return new JSONObject().put("continuity",boot()).put("elapsed",android.os.SystemClock.elapsedRealtime()).put("wall",System.currentTimeMillis());}
 synchronized JSONObject manualOwner()throws Exception{String raw=store.readCredentialSlot(INSTALLATION);if(raw==null){raw=new JSONObject().put("kind","manual").put("installationId",java.util.UUID.randomUUID().toString()).toString();store.writeCredentialSlot(INSTALLATION,raw);}return new JSONObject(raw);}
 JSONObject agentOwner()throws Exception{NativeOwnerReminderHost host=new NativeOwnerReminderHost(context);JSONObject identity=host.read();return new JSONObject().put("kind","agent").put("identity",identity).put("reviewFence",host.reviewFence(identity));}
 private String ownerKey(JSONObject value){return value.toString();}
 private boolean current(JSONObject owner)throws Exception{return DeferredDeletionJournal.same(owner,"manual".equals(owner.getString("kind"))?manualOwner():agentOwner());}
 private boolean stageOwnerCurrent(JSONObject owner)throws Exception{return "manual".equals(owner.getString("kind"))?DeferredDeletionJournal.same(owner,manualOwner()):owner.getString("reviewFence").equals(new NativeOwnerReminderHost(context).reviewFence(owner.getJSONObject("identity")));}
 synchronized JSONObject stageCalendar(JSONObject target,JSONObject owner,String operationId)throws Exception{
  if(!stageOwnerCurrent(owner))throw new SecurityException("Deletion owner changed during review");
  JSONObject time=clock();String id=operationId==null?java.util.UUID.randomUUID().toString():operationId;
  JSONObject row=calendar.stage(id,owner,target,new DeletionDeadline(time.getString("continuity"),time.getLong("elapsed"),time.getLong("wall")));schedule(0);return row;
 }
 synchronized JSONObject stageReminder(JSONObject target,JSONObject owner,String operationId,JSONObject binding)throws Exception{
  if(!stageOwnerCurrent(owner))throw new SecurityException("Deletion owner changed during review");
  String id=operationId==null?java.util.UUID.randomUUID().toString():operationId;JSONObject row=AlphaReminders.engine(context).stageDeletion(id,ownerKey(owner),target,clock(),binding);schedule(0);return row;
 }
 JSONObject receipt(String kind,String id)throws Exception{
  JSONObject time=clock();JSONArray rows="calendar".equals(kind)?calendar.list(time.getString("continuity"),time.getLong("elapsed")):AlphaReminders.engine(context).pendingDeletions();
  for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(id.equals(row.getString("id")))return row;}return null;
 }
 JSONArray pending()throws Exception{
  JSONObject time=clock();JSONArray result=new JSONArray(),events=calendar.list(time.getString("continuity"),time.getLong("elapsed"));
  for(int i=0;i<events.length();i++){JSONObject row=events.getJSONObject(i);if(pendingPhase(row)&&visible(row.getJSONObject("owner")))result.put(row.put("kind","calendar"));}
  JSONArray reminders=AlphaReminders.engine(context).pendingDeletions();for(int i=0;i<reminders.length();i++){JSONObject row=reminders.getJSONObject(i);if(!pendingPhase(row)||!visible(new JSONObject(row.getString("owner"))))continue;
   if("queued".equals(row.getString("phase"))){String state=!time.getString("continuity").equals(row.getString("continuity"))||time.getLong("elapsed")<row.getLong("createdElapsed")?"clock-changed":time.getLong("elapsed")<row.getLong("expiresElapsed")?"open":"expired";row.put("window",state);}
   result.put(row.put("kind","reminder"));}
  return result;
 }
 private static boolean pendingPhase(JSONObject row){return java.util.Set.of("queued","paused","unknown","dispatching").contains(row.optString("phase"));}
 private final Object visibilityLock=new Object();private JSONObject visibleOwner;private long visibleUntil;
 private static boolean stableOwner(JSONObject a,JSONObject b)throws Exception{
  if(!a.getString("kind").equals(b.getString("kind")))return false;if("manual".equals(a.getString("kind")))return DeferredDeletionJournal.same(a,b);
  JSONObject x=a.getJSONObject("identity"),y=b.getJSONObject("identity");for(String field:new String[]{"subjectUserId","agentId","installationId","enrollmentId","accountRef","environment"})if(!x.getString(field).equals(y.getString(field)))return false;return true;
 }
 private boolean canUndo(JSONObject owner)throws Exception{return stableOwner(owner,"manual".equals(owner.getString("kind"))?manualOwner():agentOwner());}
 private boolean visible(JSONObject owner){try{
  if("manual".equals(owner.getString("kind")))return stageOwnerCurrent(owner);
  synchronized(visibilityLock){
   boolean valid=false;try{valid=visibleOwner!=null&&android.os.SystemClock.elapsedRealtime()<visibleUntil&&stageOwnerCurrent(visibleOwner);}catch(Exception changed){}
   if(!valid){visibleOwner=null;JSONObject authenticated=agentOwner();visibleUntil=android.os.SystemClock.elapsedRealtime()+5000;visibleOwner=authenticated;}
   return stableOwner(owner,visibleOwner);
  }
 }catch(Exception unavailable){return false;}}

 synchronized JSONObject undo(String kind,String id)throws Exception{
  JSONObject time=clock();if("calendar".equals(kind)){JSONArray rows=calendar.list(time.getString("continuity"),time.getLong("elapsed"));for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(id.equals(row.getString("id"))&&canUndo(row.getJSONObject("owner")))return calendar.undo(id,row.getJSONObject("owner"),time.getString("continuity"),time.getLong("elapsed"));}}
  else if("reminder".equals(kind)){JSONArray rows=AlphaReminders.engine(context).pendingDeletions();for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(id.equals(row.getString("id"))&&canUndo(new JSONObject(row.getString("owner"))))return AlphaReminders.engine(context).settleDeletion(id,row.getString("owner"),time,true);}}
  throw new SecurityException("Deletion no longer belongs to this session");
 }
 synchronized void reconcile()throws Exception{
  JSONObject time=clock();long elapsed=time.getLong("elapsed"),next=Long.MAX_VALUE;String continuity=time.getString("continuity");JSONArray events=calendar.list(continuity,elapsed);
  for(int i=0;i<events.length();i++){JSONObject row=events.getJSONObject(i);if(!"queued".equals(row.getString("phase")))continue;
   if("open".equals(row.getString("window")))next=Math.min(next,row.getJSONObject("deadline").getLong("expiresElapsed")-elapsed);
   else if("expired".equals(row.getString("window")))calendar.expire(row.getString("id"),continuity,elapsed,(owner,target)->current(owner)?null:"owner-changed",target->target.optInt("version")==2?CalendarScopedDeletionReview.dispatch(context,target):ai.eliza.plugins.calendar.CalendarPlugin.deleteReviewedExact(context,AlphaCalendarPlugin.CONFIGURATION,target));
  }
  JSONArray reminders=AlphaReminders.engine(context).pendingDeletions();for(int i=0;i<reminders.length();i++){JSONObject row=reminders.getJSONObject(i);String phase=row.getString("phase");
   if(!"queued".equals(phase)){if("pending".equals(row.optString("effects"))&&current(new JSONObject(row.getString("owner"))))AlphaReminders.engine(context).settleDeletion(row.getString("id"),row.getString("owner"),time,"undone".equals(phase));continue;}
   if(!continuity.equals(row.getString("continuity"))||elapsed<row.getLong("createdElapsed"))continue;
   if(elapsed<row.getLong("expiresElapsed")){next=Math.min(next,row.getLong("expiresElapsed")-elapsed);continue;}
   boolean admitted;try{admitted=current(new JSONObject(row.getString("owner")));}catch(Exception unavailable){admitted=false;}
   if(admitted)AlphaReminders.engine(context).settleDeletion(row.getString("id"),row.getString("owner"),time,false);else AlphaReminders.engine(context).pauseDeletion(row.getString("id"),row.getString("owner"),"owner-unavailable");
  }
  if(next!=Long.MAX_VALUE)schedule(Math.max(1,next));
 }
 void start(){schedule(0);}
 private void schedule(long delay){WorkManager.getInstance(context).enqueueUniqueWork("alpha-delete-window",ExistingWorkPolicy.REPLACE,new OneTimeWorkRequest.Builder(DeletionWorker.class).setInitialDelay(delay,TimeUnit.MILLISECONDS).build());}
}
