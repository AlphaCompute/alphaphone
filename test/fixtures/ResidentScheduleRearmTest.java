package ai.elizaresearch.alphaphone;

import ai.elizaresearch.alphaphone.ResidentScheduleRearm.Decision;

/** Plain-JVM checks of the resident schedule re-arming policy. Not an Android, emulator or device test. */
public final class ResidentScheduleRearmTest {
 private static void check(boolean condition,String name){if(!condition)throw new AssertionError(name);}

 public static void main(String[] args){
  String[] rearming={ResidentScheduleRearm.BOOT_COMPLETED,ResidentScheduleRearm.PACKAGE_REPLACED,ResidentScheduleRearm.TIME_SET,ResidentScheduleRearm.TIMEZONE_CHANGED};
  for(String action:rearming){
   check(ResidentScheduleRearm.handles(action),"handles "+action);
   check(ResidentScheduleRearm.decide(action,true,true,true,true)==Decision.START,"starts on "+action);
   check(ResidentScheduleRearm.decide(action,false,true,true,true)==Decision.LOCKED,"waits for unlock on "+action);
   check(ResidentScheduleRearm.decide(action,true,false,true,true)==Decision.NOT_PACKAGED,"needs a packaged runtime on "+action);
   check(ResidentScheduleRearm.decide(action,true,true,false,true)==Decision.NOT_ENABLED,"fresh install is not started on "+action);
   check(ResidentScheduleRearm.decide(action,true,true,true,false)==Decision.LIFECYCLE_BUSY,"never races a stop or provider change on "+action);
  }
  for(String action:new String[]{null,"","android.intent.action.LOCKED_BOOT_COMPLETED","android.intent.action.SCREEN_ON","android.intent.action.TIME_TICK"}){
   check(!ResidentScheduleRearm.handles(action),"ignores "+action);
   check(ResidentScheduleRearm.decide(action,true,true,true,true)==Decision.IGNORE,"never starts on "+action);
  }
  System.out.println("PASS resident schedule rearm");
 }
}
