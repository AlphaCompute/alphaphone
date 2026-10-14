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
  // Flag-off builds contact only the fixed Cloud authority; a remote agent origin is refused from the URL alone.
  String agent="0f8fad5b-d9cb-469f-a165-70867728950e";
  for(String host:new String[]{"api.eliza.app"}){
   check(ConnectionRoutes.admittedOrigin("https",host,-1,false),"flag-off admits "+host);
   check(ConnectionRoutes.admittedOrigin("https",host,443,false),"flag-off admits the explicit default port of "+host);
   check(!ConnectionRoutes.admittedOrigin("http",host,-1,false),"flag-off HTTPS only for "+host);
   check(!ConnectionRoutes.admittedOrigin("https",host,8443,false),"flag-off default port only for "+host);
   check(!ConnectionRoutes.admittedOrigin(null,host,-1,false),"flag-off needs a scheme for "+host);
  }
  for(String host:new String[]{
   // A paired remote or development agent, and other public hosts.
   // Production Android connects no Cloud agent, so a dedicated agent runtime host is refused like any other.
   agent+".cloud.eliza.app",agent+".api.eliza.app","api.eliza.app:443","api.eliza.app@evil.example","evil.example#api.eliza.app","xn--pi-7ka.eliza.app","[2606:4700::1]",
   "agent.example.test","my-agent.example","192.168.1.20","10.0.2.2","127.0.0.1","localhost","[::1]","example.com",
   // The staging authority exists only in test-mocks builds.
   "api-staging.eliza.app",agent+".cloud-staging.eliza.app",
   // Lookalikes, other Eliza hosts and spellings the renderer never produces.
   "eliza.app","www.eliza.app","cloud.eliza.app","evil.cloud.eliza.app","evil-api.eliza.app","xapi.eliza.app","api.eliza.app.example.test","api.eliza.app.",
   "API.ELIZA.APP","api.eliza.app\n","api.eliza.app\u200b","api.eliza.app%00","sub.api.eliza.app",
   agent+".cloud.eliza.app.example.test",agent+".cloud.eliza.app.",agent.toUpperCase(java.util.Locale.ROOT)+".cloud.eliza.app","x"+agent+".cloud.eliza.app",
   agent+".evil.cloud.eliza.app","a."+agent+".cloud.eliza.app",agent+"xcloud.eliza.app",agent+".cloud.eliza.app\n","0f8fad5b-d9cb-069f-a165-70867728950e.cloud.eliza.app",
   "0f8fad5bd9cb469fa16570867728950e.cloud.eliza.app","",null})
   check(!ConnectionRoutes.admittedOrigin("https",host,-1,false),"flag-off refuses "+host);
  // Test-mocks builds are unchanged: every origin the URL validation admits still reaches the transport.
  for(String host:new String[]{"agent.example.test","api-staging.eliza.app","api.eliza.app",agent+".cloud.eliza.app"})check(ConnectionRoutes.admittedOrigin("https",host,-1,true),"test mocks keep "+host);
  check(!ConnectionRoutes.admittedOrigin("https",agent+".cloud.eliza.app",443,false),"flag-off refuses the agent runtime on its explicit port");
  // What java.net.URI hands the guard for spellings that try to smuggle another authority.
  for(String text:new String[]{"https://api.eliza.app@evil.example/api/v1/user","https://api.eliza.app:443@evil.example/","https://api.eliza.app.evil.example/","https://API.ELIZA.APP/","https://api.eliza.app./",
   "https://api.eliza.app%2eevil.example/","https://[::1]/","https://api.eliza.app:8443/","http://api.eliza.app/","https://evil.example/?https://api.eliza.app/","https://evil.example/api.eliza.app","https://api\u3002eliza\u3002app/"}){
   java.net.URI url;try{url=new java.net.URI(text);}catch(java.net.URISyntaxException error){continue;}
   check(!ConnectionRoutes.admittedOrigin(url.getScheme(),url.getHost(),url.getPort(),false),"flag-off refuses "+text);
  }
  java.net.URI plain=java.net.URI.create("https://api.eliza.app/api/v1/user?x=1");
  check(ConnectionRoutes.admittedOrigin(plain.getScheme(),plain.getHost(),plain.getPort(),false),"flag-off admits the parsed Cloud API URL");
  check(ConnectionRoutes.admittedOrigin("https","agent.example.test",8443,true),"test mocks keep a remote agent port");
  check(ConnectionRoutes.admittedOrigin("http","10.0.2.2",2138,true),"test mocks keep the development agent");

  // openExternal: a flag-off build opens Cloud sign-in, top-up and account management, and Google consent only.
  for(String text:new String[]{"https://eliza.app/auth/cli-login?session=abc","https://cloud.eliza.app/cloud/billing","https://accounts.google.com/o/oauth2/v2/auth?client_id=x","https://ELIZA.APP/auth/cli-login","https://cloud.eliza.app:443/cloud/billing"}){
   java.net.URI url=java.net.URI.create(text);
   check(ConnectionRoutes.externalHost(url.getScheme(),url.getHost(),url.getPort(),false),"flag-off opens "+text);
   check(ConnectionRoutes.externalHost(url.getScheme(),url.getHost(),url.getPort(),true),"test mocks open "+text);
  }
  for(String host:new String[]{"staging.eliza.app","cloud-staging.eliza.app","www.eliza.app","api.eliza.app","evil.eliza.app",agent+".cloud.eliza.app","a.b.eliza.app",
   "eliza.app.","cloud.eliza.app.","eliza.app.evil.example","evil-eliza.app","xeliza.app","accounts.google.com.evil.example","mail.google.com","google.com","example.com","",null})
   check(!ConnectionRoutes.externalHost("https",host,-1,false),"flag-off refuses to open "+host);
  for(String host:new String[]{"staging.eliza.app","cloud-staging.eliza.app","www.eliza.app",agent+".cloud.eliza.app"})check(ConnectionRoutes.externalHost("https",host,-1,true),"test mocks open "+host);
  for(String host:new String[]{".eliza.app","eliza.app.evil.example","evil-eliza.app","a..eliza.app","eliza.app.","evil.example",null})check(!ConnectionRoutes.externalHost("https",host,-1,true),"test mocks still refuse "+host);
  check(!ConnectionRoutes.externalHost("http","eliza.app",-1,true),"openExternal is HTTPS only");
  check(!ConnectionRoutes.externalHost("https","eliza.app",8443,true),"openExternal uses the default port only");
  check(!ConnectionRoutes.externalHost(null,"eliza.app",-1,false),"openExternal needs a scheme");
  check(ConnectionRoutes.externalCliLogin("eliza.app","/auth/cli-login",false),"production sign-in is a browser handoff");
  check(!ConnectionRoutes.externalCliLogin("staging.eliza.app","/auth/cli-login",false),"staging sign-in needs test mocks");
  check(ConnectionRoutes.externalCliLogin("staging.eliza.app","/auth/cli-login",true),"staging sign-in with test mocks");
  check(!ConnectionRoutes.externalCliLogin("cloud.eliza.app","/auth/cli-login",true),"only the web authority hosts sign-in");
  check(!ConnectionRoutes.externalCliLogin("eliza.app","/auth/cli-login/",false)&&!ConnectionRoutes.externalCliLogin("eliza.app","/cloud/billing",false)&&!ConnectionRoutes.externalCliLogin(null,"/auth/cli-login",true),"exact sign-in path only");
  for(String route:new String[]{"/api/v1/eliza/agents","/api/v1/eliza/agents/id/api/conversations","/api/auth/pair","/api/conversations","/api/v1/eliza/personal","/api/v1/eliza/google/../agents","/api/v1/%65liza/google/status","/api/v1/eliza/google/status/","/api/v1/eliza/google//status"})for(String method:new String[]{"GET","POST"})check(!ConnectionRoutes.managedService(route,null,method,false,false),"hosted/unreviewed path refused "+route);
  check(ConnectionRoutes.managedService("/api/v1/user",null,"GET",false,false),"owner identity allowed");
  check(ConnectionRoutes.managedService("/api/v1/eliza/google/gmail/inbox-v1/thread","grantId=owned", "GET",false,false),"owner Gmail route allowed");
  check(ConnectionRoutes.managedService("/api/v1/eliza/google/gmail/inbox-v1/operations/owned-id/dispatch",null,"POST",true,false),"reviewed Gmail dispatch allowed");
  check(!ConnectionRoutes.managedService("/api/v1/user",null,"POST",true,false),"identity write refused");
  check(!ConnectionRoutes.managedService("/api/v1/user",null,"GET",true,false),"GET body refused");
  check(ConnectionRoutes.managedService("/api/agents",null,"GET",false,true),"separate development infrastructure retained");
  System.out.println("PASS connection routes: retired pairing, exact Cloud self-revocation, the flag-off Cloud API origin, managed-service routes and openExternal hosts");
 }
}
