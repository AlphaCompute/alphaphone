package ai.elizaresearch.alphaphone;

/** Fixed renderer transport policy outside Automations. Pure so it is tested without Android. */
final class ConnectionRoutes {
 private ConnectionRoutes() {}
 /** Decoded path with repeated and trailing slashes removed, so spelling cannot dodge a route rule. */
 private static String canonical(String path){
  if(path==null)return "";
  String value=path.replaceAll("/{2,}","/");
  while(value.length()>1&&value.endsWith("/"))value=value.substring(0,value.length()-1);
  return value;
 }
 /**
  * Production phones run the resident agent and do not pair with a remote agent. The renderer
  * already refuses pairing; this keeps a renderer regression from sending a pairing code.
  * Saved remote credentials are untouched. Test-mocks builds keep pairing for development.
  */
 static boolean retiredPairing(String decodedPath,boolean testMocks){
  return !testMocks&&"/api/auth/pair".equals(canonical(decodedPath));
 }
 /**
  * Origins this transport may contact. A production phone talks to its resident agent over the
  * separate in-process Agent bridge, never through this transport, and does not pair with, restore
  * or connect a remote or Cloud agent (the controller returns before any saved selection is used and
  * the production dialog offers only Cloud sign-in for inference credits). Every request a flag-off
  * build legitimately sends here (sign-in, identity, balance, key self-revocation, the connected
  * services under /api/v1/eliza/) goes to the Cloud API, so the only admitted origin is exactly
  * https://api.eliza.app on the default port. A dedicated Cloud agent runtime
  * (https://&lt;agent-uuid&gt;.cloud.eliza.app) is refused with every other host; admit it here only
  * if owner decision A-16 brings Cloud agents to production Android. A paired remote agent's origin
  * is refused even when the renderer presents a saved credential for it; the refusal is decided from
  * the URL alone and touches no credential slot.
  * Test-mocks builds keep every origin the URL validation admits (remote, Cloud and development agents).
  */
 static boolean admittedOrigin(String scheme,String host,int port,boolean testMocks){
  if(testMocks)return true;
  return "https".equals(scheme)&&"api.eliza.app".equals(host)&&(port==-1||port==443);
 }
 /**
  * Hosts openExternal may hand to the system browser. A flag-off renderer opens only Cloud sign-in
  * (https://eliza.app/auth/cli-login), credit top-up and account management on
  * https://cloud.eliza.app/cloud/billing, and Google's consent page for Gmail
  * (https://accounts.google.com). Staging (staging.eliza.app, cloud-staging.eliza.app) and any other
  * *.eliza.app host are admitted only in test-mocks builds. HTTPS on the default port only; the host
  * is compared lower-cased and exactly, so a lookalike or trailing-dot spelling is refused.
  */
 static boolean externalHost(String scheme,String host,int port,boolean testMocks){
  if(!"https".equals(scheme)||host==null||(port!=-1&&port!=443))return false;
  String value=host.toLowerCase(java.util.Locale.ROOT);
  if("eliza.app".equals(value)||"cloud.eliza.app".equals(value)||"accounts.google.com".equals(value))return true;
  return testMocks&&value.matches("[a-z0-9-]+(\\.[a-z0-9-]+)*\\.eliza\\.app");
 }
 /** The Cloud sign-in page, whose return is a browser handoff rather than a fire-and-forget open. */
 static boolean externalCliLogin(String host,String path,boolean testMocks){
  String value=host==null?"":host.toLowerCase(java.util.Locale.ROOT);
  return ("eliza.app".equals(value)||testMocks&&"staging.eliza.app".equals(value))&&"/auth/cli-login".equals(path);
 }
 /**
  * Cloud self-revocation: the presented sign-in key revokes only itself. Exactly
  * DELETE https://api.eliza.app/api/v1/api-keys/current on the default port, without a query
  * or body. The staging authority exists only in test-mocks builds.
  */
 static boolean cloudSelfRevocation(String scheme,String host,int port,String rawPath,String rawQuery,String method,boolean hasBody,boolean testMocks){
  if(!"DELETE".equals(method)||hasBody||rawQuery!=null||!"https".equals(scheme)||(port!=-1&&port!=443))return false;
  if(!("api.eliza.app".equals(host)||(testMocks&&"api-staging.eliza.app".equals(host))))return false;
  return "/api/v1/api-keys/current".equals(rawPath);
 }
}
