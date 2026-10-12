package ai.elizaresearch.alphaphone;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Host-JVM check of the pure Clock contract. Not Android, Clock app or AlarmClock evidence. */
public final class ClockContractTest {
 private static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 private static boolean refused(Runnable body){try{body.run();return false;}catch(IllegalArgumentException expected){return true;}}
 public static void main(String[] args)throws Exception {
  // Alpha's own form: 1-7 unique ascending days, exactly as before.
  check(ClockContract.strictDays(new JSONArray("[2,3,4,5,6]")).equals(List.of(2,3,4,5,6)),"weekdays");
  check(ClockContract.strictDays(JSONObject.NULL)==null&&ClockContract.strictDays((Object)null)==null,"no days is a one-time alarm");
  for(String bad:new String[]{"[]","[3,2]","[1,1]","[0]","[8]","[1.5]","[\"1\"]","[1,2,3,4,5,6,7,1]"})check(refused(()->ClockContract.strictDays(new JSONArray(bad))),"strict refuses "+bad);
  check(refused(()->ClockContract.strictDays("1,2")),"strict refuses a non-array");
  // Agent operations: what the pinned upstream clockDays admits never fails here.
  check(ClockContract.agentDays(new JSONArray("[3,2]")).equals(List.of(2,3)),"unordered days are sorted");
  check(ClockContract.agentDays(new JSONArray("[7,1,4]")).equals(List.of(1,4,7)),"Saturday, Sunday, Wednesday");
  check(ClockContract.agentDays(new JSONArray("[]"))==null,"an explicit empty list is a one-time alarm");
  check(ClockContract.agentDays(new JSONArray("[5,5]")).equals(List.of(5)),"duplicates collapse");
  check(ClockContract.agentDays(JSONObject.NULL)==null,"omitted days");
  for(String bad:new String[]{"[0]","[8]","[1.5]","[\"1\"]","[1,2,3,4,5,6,7,1]",}){check(refused(()->ClockContract.agentDays(new JSONArray(bad))),"agent refuses "+bad);}
  check(refused(()->ClockContract.agentDays("[1]")),"agent refuses a non-array");
  // Outputs of upstream validateClockOperation, passed by the node test: every admitted operation's
  // days normalize to Alpha's strict form (or to a one-time alarm), never to a refusal.
  if(args.length>0){
   JSONArray cases=new JSONArray(args[0]);
   for(int i=0;i<cases.length();i++){
    JSONObject operation=cases.getJSONObject(i);
    List<Integer> days=ClockContract.agentDays(operation.opt("days"));
    if(days!=null)ClockContract.strictDays(days);
    JSONArray expected=operation.getJSONArray("expected");
    check(expected.length()==0?days==null:days!=null&&days.toString().equals(expected.toString().replace(",",", ")),"upstream case "+operation);
   }
  }
  // The receiving package: Alpha itself never receives its own Clock handoff.
  check("com.google.android.deskclock".equals(ClockContract.receiver("ai.elizaresearch.alphaphone","com.google.android.deskclock")),"a Clock app receives it");
  check(ClockContract.receiver("ai.elizaresearch.alphaphone","ai.elizaresearch.alphaphone")==null,"the own package is refused");
  check(ClockContract.receiver("ai.elizaresearch.alphaphone",null)==null&&ClockContract.receiver("ai.elizaresearch.alphaphone","")==null,"nothing resolved");
  System.out.println("PASS clock contract");
 }
}
