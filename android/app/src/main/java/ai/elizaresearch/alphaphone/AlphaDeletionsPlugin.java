package ai.elizaresearch.alphaphone;

import android.app.AlertDialog;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;

/** Manual deletion is native-reviewed. The renderer supplies a selected revision, never owner authority. */
@CapacitorPlugin(name="AlphaDeletions")
public final class AlphaDeletionsPlugin extends Plugin {
 private final java.util.concurrent.ExecutorService worker=java.util.concurrent.Executors.newFixedThreadPool(2);
 private AlertDialog review;private volatile boolean retired;
 @Override public void load(){super.load();NativeDeletionCoordinator.get(getContext()).start();}
 private void task(PluginCall call,Task action){try{worker.execute(()->{try{if(retired)throw new IllegalStateException();call.resolve(JSObject.fromJSONObject(action.run()));}catch(Exception unavailable){call.reject("Deletion state could not be confirmed. Saved data is retained; refresh before reviewing again.");}});}catch(java.util.concurrent.RejectedExecutionException stopped){call.reject("Deletion view retired");}}
 private interface Task{JSONObject run()throws Exception;}
 @PluginMethod public void pending(PluginCall call){task(call,()->new JSONObject().put("deletions",NativeDeletionCoordinator.get(getContext()).pending()));}
 @PluginMethod public void undo(PluginCall call){task(call,()->NativeDeletionCoordinator.get(getContext()).undo(call.getString("kind"),call.getString("id")));}
 @PluginMethod public void reviewReminder(PluginCall call){reviewReminder(call,null,null,null);}
 @PluginMethod public void reviewAgentReminder(PluginCall call){
  try{worker.execute(()->{try{
   if(retired)throw new IllegalStateException();JSONObject operation=call.getObject("operation"),identity=call.getObject("journalIdentity");
   if(operation==null||!"reminder_cancel".equals(operation.getString("type")))throw new IllegalArgumentException();
   JSONObject owner=NativeDeletionCoordinator.get(getContext()).agentOwner();String id=call.getString("operationId");
   NativeDeletionClaim.check(AlphaActionJournal.get(getContext()),identity,id,operation,owner,false);
   JSONObject binding=new JSONObject().put("operationId",id).put("bindingHash",call.getString("bindingHash")).put("operation",new JSONObject(operation.toString()));
   reviewReminder(call,owner,binding,identity);
  }catch(Exception unavailable){call.reject("Authenticated deletion review is unavailable.");}});}catch(java.util.concurrent.RejectedExecutionException stopped){call.reject("Deletion view retired");}
 }
 private void reviewReminder(PluginCall call,JSONObject agentOwner,JSONObject binding,JSONObject identity){getActivity().runOnUiThread(()->{
  if(retired||review!=null||!foreground()){call.reject("Open this reminder before reviewing deletion.");return;}
  try{
   JSONObject target=binding==null?call.getObject("target"):binding.getJSONObject("operation").getJSONObject("target");if(target==null)throw new IllegalArgumentException();String id=target.getString("reminderId");
   JSONObject selected=AlphaReminders.engine(getContext()).selected(id);if(!DeferredDeletionJournal.same(selected,target)){call.reject("Reminder changed. Reopen it before deleting.");return;}
   JSONObject row=AlphaReminders.engine(getContext()).read(id);final JSONObject[] outcome={null};final AlertDialog[] own={null};
   own[0]=new AlertDialog.Builder(getActivity()).setTitle("Delete reminder?").setMessage(row.getString("title")+"\n\nDelete this reminder after 10 seconds? Its alert is paused immediately. You can Undo during that time.").setNegativeButton("Cancel",(d,w)->{}).setPositiveButton("Delete reminder",(d,w)->{
    if(retired||review!=own[0]||getContext().getSystemService(android.app.KeyguardManager.class).isDeviceLocked()||!getActivity().getLifecycle().getCurrentState().isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED))return;
    try{NativeDeletionCoordinator coordinator=NativeDeletionCoordinator.get(getContext());
     if(binding!=null)NativeDeletionClaim.check(AlphaActionJournal.get(getContext()),identity,binding.getString("operationId"),binding.getJSONObject("operation"),agentOwner,true);
     outcome[0]=new JSONObject().put("status","queued").put("deletion",coordinator.stageReminder(target,agentOwner==null?coordinator.manualOwner():agentOwner,binding==null?null:binding.getString("operationId"),binding));}catch(Exception failure){try{outcome[0]=new JSONObject().put("status","unknown");}catch(JSONException impossible){throw new IllegalStateException(impossible);}}
   }).create();review=own[0];review.setOnDismissListener(d->{if(review==own[0])review=null;try{call.resolve(JSObject.fromJSONObject(outcome[0]==null?new JSONObject().put("status","cancelled"):outcome[0]));}catch(JSONException failure){call.reject("Deletion result unavailable; inspect pending changes.");}});review.show();
  }catch(Exception unavailable){call.reject("Selected reminder is unavailable.");}
 });}
 private boolean foreground(){android.app.KeyguardManager lock=getContext().getSystemService(android.app.KeyguardManager.class);return getActivity()!=null&&!getActivity().isFinishing()&&!getActivity().isDestroyed()&&getActivity().hasWindowFocus()&&lock!=null&&!lock.isDeviceLocked();}
 @Override protected void handleOnPause(){if(review!=null)review.dismiss();super.handleOnPause();}
 @Override protected void handleOnDestroy(){retired=true;if(review!=null)review.dismiss();worker.shutdown();super.handleOnDestroy();}
}
