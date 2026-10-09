package ai.elizaresearch.alphaphone;

/** Exact owner Automations transport surface; backend authorization remains authoritative. */
final class AutomationsRoutes {
 private static final String ID="[A-Za-z0-9][A-Za-z0-9._:-]{0,199}";
 static boolean owns(String path){return path!=null&&path.matches("^/api/(automations|lifeops|triggers)([/?].*)?$");}
 static boolean allowed(String path,String method){
  if(path==null||path.length()>2048||path.contains("..")||path.indexOf('%')>=0||path.indexOf('\\')>=0||path.indexOf('#')>=0||path.chars().anyMatch(Character::isWhitespace))return false;
  if("GET".equals(method))return path.equals("/api/automations")||path.equals("/api/lifeops/reminders")||path.equals("/api/lifeops/scheduled-tasks?ownerVisibleOnly=1")||path.matches("^/api/lifeops/scheduled-tasks/"+ID+"$")||path.matches("^/api/triggers/"+ID+"(/runs)?$");
  if("POST".equals(method))return path.equals("/api/lifeops/definitions")||path.equals("/api/triggers")||path.matches("^/api/lifeops/scheduled-tasks/"+ID+"/(snooze|skip|complete|dismiss|escalate|acknowledge|edit|reopen|fire)$")||path.matches("^/api/lifeops/occurrences/"+ID+"/snooze$")||path.matches("^/api/triggers/"+ID+"/execute$");
  if("PUT".equals(method))return path.matches("^/api/(lifeops/definitions|triggers)/"+ID+"$");
  return "DELETE".equals(method)&&path.matches("^/api/triggers/"+ID+"$");
 }
}
