package ai.elizaresearch.alphaphone;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.UserManager;
import android.util.Log;

/**
 * Re-arms resident schedules after boot, app update, or a clock/time-zone change (#394). Reminders
 * keep their own AlarmManager receiver; digests and other agent schedules run in the resident
 * runtime, so this brings back the agent the owner already enabled. Nothing is replayed here: the
 * runtime records an occurrence that passed while it was off once as missed, and a missed digest
 * runs again only through its explicit, reviewed Run now.
 */
public final class ResidentScheduleReceiver extends BroadcastReceiver {
 private static final String TAG="AlphaResidentSchedule";

 @Override public void onReceive(Context context,Intent intent){
  String action=intent==null?null:intent.getAction();
  if(!ResidentScheduleRearm.handles(action))return;
  UserManager users=context.getSystemService(UserManager.class);
  boolean unlocked=users!=null&&users.isUserUnlocked();
  boolean packaged=unlocked&&AlphaLocalAgentPlugin.runtimePackaged(context);
  boolean enabled=packaged&&ElizaAgentService.shouldAutoStart(context);
  ResidentScheduleRearm.Decision decision=ResidentScheduleRearm.decide(action,unlocked,packaged,enabled,AlphaLocalAgentPlugin.residentStartAdmissible());
  if(decision!=ResidentScheduleRearm.Decision.START){Log.i(TAG,"Resident not started for "+action+": "+decision);return;}
  try{ElizaAgentService.start(context);}
  catch(RuntimeException deferred){
   // A refused background start or a retiring provider defers to the next foreground launch.
   Log.w(TAG,"Resident start deferred for "+action+": "+deferred.getClass().getSimpleName());
  }
 }
}
