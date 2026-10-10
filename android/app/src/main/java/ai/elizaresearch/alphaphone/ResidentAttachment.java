package ai.elizaresearch.alphaphone;

import org.json.JSONObject;

/**
 * Decides whether a surface (Home or the ACTION_ASSIST surface) may attach to the resident agent
 * that is already admitted and running, instead of starting it again. Attaching never advances
 * the runtime epoch, clears the owner enrollment, pairs again or touches the service; it only
 * lets the calling surface begin issuing its own requests against the same runtime.
 *
 * Pure policy: no Android, Capacitor or service types, so the JVM contract test exercises the
 * exact production decision. Every refusal falls back to the ordinary start path.
 */
final class ResidentAttachment {
 private ResidentAttachment() {}
 /** The owner session must outlive the attach by this margin; matches enrollment reuse. */
 static final long ENROLLMENT_MARGIN_MS=30_000;

 /** Process-wide facts captured under the plugin's lifecycle lock. */
 static final class Facts {
  boolean accepting,stopping,credentialMutating,credentialShutdownPending,attachUnverified;
  /** Token of the runtime that is running now, and the one the enrollment was made against. */
  String currentRoot,enrolledRoot;
  String ownerToken,ownerIdentity;
  long expiresAt,now;
  /** Provider admission generation the running process was launched with, and the stored one. */
  String launchedGeneration,currentGeneration;
 }

 /**
  * Returns null when the caller may attach, otherwise a short non-sensitive reason. Reasons are
  * diagnostics only: they never contain tokens, identities or provider values.
  */
 static String refusal(JSONObject bootState,Facts facts){
  if(facts==null)return "unavailable";
  if(facts.attachUnverified)return "attach-unverified";
  if(!facts.accepting||facts.stopping)return "lifecycle-retiring";
  if(facts.credentialMutating||facts.credentialShutdownPending)return "provider-changing";
  if(bootState==null||!"listening".equals(bootState.optString("state"))
     ||!bootState.optBoolean("serviceActive",false)||!bootState.optBoolean("socketListening",false))return "runtime-not-running";
  if(empty(facts.currentRoot))return "runtime-token-unavailable";
  if(empty(facts.enrolledRoot)||empty(facts.ownerToken)||empty(facts.ownerIdentity))return "not-enrolled";
  if(!facts.currentRoot.equals(facts.enrolledRoot))return "runtime-changed";
  if(facts.expiresAt<=facts.now+ENROLLMENT_MARGIN_MS)return "enrollment-expiring";
  // A process launched under another provider admission must be restarted by the normal path.
  if(empty(facts.launchedGeneration)||empty(facts.currentGeneration))return "provider-unadmitted";
  if(!facts.launchedGeneration.equals(facts.currentGeneration))return "provider-changed";
  return null;
 }
 private static boolean empty(String value){return value==null||value.isEmpty();}

 /** Renderer-visible result of the read-only attachment query. */
 static JSONObject describe(String refusal)throws org.json.JSONException {
  JSONObject result=new JSONObject().put("attachable",refusal==null);
  if(refusal!=null)result.put("reason",refusal);
  return result;
 }

 /**
  * Bounded memory of start requests that attached. A later cancelStart for one of them is a
  * no-op: an attaching surface never owns the launch, so it can never retire it.
  */
 static final class Requests {
  static final int LIMIT=32;
  private final java.util.LinkedHashSet<String> ids=new java.util.LinkedHashSet<>();
  void add(String id){
   if(id==null)return;
   ids.remove(id);ids.add(id);
   while(ids.size()>LIMIT){java.util.Iterator<String> oldest=ids.iterator();oldest.next();oldest.remove();}
  }
  boolean remove(String id){return id!=null&&ids.remove(id);}
  int size(){return ids.size();}
 }
}
