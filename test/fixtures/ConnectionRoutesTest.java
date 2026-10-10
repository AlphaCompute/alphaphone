package ai.elizaresearch.alphaphone;

/** Plain-JVM checks of the renderer transport route policy. Not an Android or device test. */
public final class ConnectionRoutesTest {
 private static void check(boolean condition,String name){if(!condition)throw new AssertionError(name);}
 private static boolean revoke(String scheme,String host,int port,String path,String query,String method,boolean body,boolean mocks){
  return ConnectionRoutes.cloudSelfRevocation(scheme,host,port,path,query,method,body,mocks);
 }
 public static void main(String[] args){
  // Production builds never send a pairing code, whatever the spelling of the route.
  for(String path:new String[]{"/api/auth/pair","/api/auth/pair/","//api//auth/pair","/api/auth/pair//"})check(ConnectionRoutes.retiredPairing(path,false),"flag-off refuses "+path);
  // Session checks, pair-code display and unrelated routes are not the pairing mutation.
  for(String path:new String[]{"/api/auth/me","/api/auth/pair-code","/api/auth/status","/api/auth/logout","/api/auth/pairing","/api/v1/user","/",null})check(!ConnectionRoutes.retiredPairing(path,false),"flag-off keeps "+path);
  check(!ConnectionRoutes.retiredPairing("/api/auth/pair",true),"test-mocks builds keep development pairing");

  check(revoke("https","api.eliza.app",-1,"/api/v1/api-keys/current",null,"DELETE",false,false),"production self-revocation");
  check(revoke("https","api.eliza.app",443,"/api/v1/api-keys/current",null,"DELETE",false,false),"explicit default port");
  check(!revoke("https","api-staging.eliza.app",-1,"/api/v1/api-keys/current",null,"DELETE",false,false),"staging needs test mocks");
  check(revoke("https","api-staging.eliza.app",-1,"/api/v1/api-keys/current",null,"DELETE",false,true),"staging with test mocks");
  // DELETE is admitted for this one credential route only.
  check(!revoke("https","api.eliza.app",-1,"/api/v1/api-keys/current",null,"DELETE",true,false),"no body");
  check(!revoke("https","api.eliza.app",-1,"/api/v1/api-keys/current","all=1","DELETE",false,false),"no query");
  check(!revoke("https","api.eliza.app",-1,"/api/v1/api-keys/current","","DELETE",false,false),"no empty query");
  check(!revoke("http","api.eliza.app",-1,"/api/v1/api-keys/current",null,"DELETE",false,true),"HTTPS only");
  check(!revoke("https","api.eliza.app",8443,"/api/v1/api-keys/current",null,"DELETE",false,false),"default port only");
  for(String host:new String[]{"agent.example.test","api.eliza.app.example.test","evil-api.eliza.app","cloud.eliza.app","API.ELIZA.APP",null})check(!revoke("https",host,-1,"/api/v1/api-keys/current",null,"DELETE",false,true),"host "+host);
  for(String path:new String[]{"/api/v1/api-keys","/api/v1/api-keys/","/api/v1/api-keys/current/","/api/v1/api-keys/other","/api/v1/api-keys/%63urrent","/api/v1/api-keys/current/../other","/api/v1/user","/api/conversations/1",null})check(!revoke("https","api.eliza.app",-1,path,null,"DELETE",false,true),"path "+path);
  for(String method:new String[]{"GET","POST","PUT","PATCH","delete",null})check(!revoke("https","api.eliza.app",-1,"/api/v1/api-keys/current",null,method,false,true),"method "+method);
  System.out.println("PASS connection routes: retired pairing and exact Cloud self-revocation");
 }
}
