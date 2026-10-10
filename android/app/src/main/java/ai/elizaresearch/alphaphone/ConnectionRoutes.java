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
 /** A dedicated Cloud agent runtime: the agent's lowercase UUID under the fixed agents domain. */
 private static final java.util.regex.Pattern CLOUD_AGENT_HOST=java.util.regex.Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.cloud\\.eliza\\.app");
 /**
  * Origins this transport may contact. A production phone talks to its resident agent over the
  * separate in-process Agent bridge, never through this transport, so in a flag-off build the only
  * admitted origins are the fixed Eliza Cloud authority: https://api.eliza.app and a dedicated
  * Cloud agent runtime at https://&lt;agent-uuid&gt;.cloud.eliza.app, on the default port, spelled
  * exactly. A paired remote agent's origin is refused even when the renderer presents a saved
  * credential for it; the refusal is decided from the URL alone and touches no credential slot.
  * Test-mocks builds keep every origin the URL validation admits (remote and development agents).
  */
 static boolean admittedOrigin(String scheme,String host,int port,boolean testMocks){
  if(testMocks)return true;
  if(!"https".equals(scheme)||host==null||(port!=-1&&port!=443))return false;
  return "api.eliza.app".equals(host)||CLOUD_AGENT_HOST.matcher(host).matches();
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
