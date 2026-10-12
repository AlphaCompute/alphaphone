package ai.elizaresearch.alphaphone;

import java.net.URI;
import java.util.Collection;
import java.util.Locale;

/**
 * The exact origin a browser HTTP authentication prompt may be filled for (issue #404).
 * Plain Java so it runs on the JVM in {@code npm test}; anything it cannot parse fails closed.
 *
 * <p>WebView's challenge carries a host and realm only: no URL, no port, and no frame. The
 * origin is therefore never inferred from the shown page. It is bound only for a challenge to
 * a pending main-frame load, and only when no other request this tab has made to the same
 * host used a different origin (for example a frame or resource on another port).
 */
final class BrowserHttpAuthOrigin {
 private BrowserHttpAuthOrigin(){}

 /** Exact {@code https://host[:port]} of a URL without user info, or null. Default port omitted. */
 static String exactHttps(String url){
  String origin=requestOrigin(url);
  return origin!=null&&origin.startsWith("https://")?origin:null;
 }

 /**
  * Exact {@code scheme://host[:port]} of an http(s) URL without user info, default port
  * omitted, or null. Used to record which origins a tab's frames and resources contacted.
  */
 static String requestOrigin(String url){
  if(url==null||url.isEmpty()||url.length()>4096)return null;
  URI uri;
  try{uri=new URI(url);}catch(Exception invalid){return null;}
  String scheme=uri.getScheme()==null?null:uri.getScheme().toLowerCase(Locale.ROOT),host=uri.getHost();
  if(!("https".equals(scheme)||"http".equals(scheme))||host==null||host.isEmpty()||uri.getRawUserInfo()!=null)return null;
  int port=uri.getPort();
  boolean defaultPort=port==-1||("https".equals(scheme)&&port==443)||("http".equals(scheme)&&port==80);
  return scheme+"://"+host.toLowerCase(Locale.ROOT)+(defaultPort?"":":"+port);
 }

 private static String host(String url){
  if(url==null)return null;
  try{String host=new URI(url).getHost();return host==null?null:host.toLowerCase(Locale.ROOT);}catch(Exception invalid){return null;}
 }

 /**
  * The single origin for a challenge from {@code reportedHost}, or null (no Autofill).
  *
  * @param reportedHost host from WebView (a {@code :port} suffix is tolerated and must agree)
  * @param pendingMain latest main-frame request or redirect target of the tab
  * @param documentUrl the tab's committed document, or the in-flight target when not committed
  * @param committed whether {@code documentUrl} is a committed, shown document
  * @param otherRequests exact origins of every non-main-frame request the tab has made, or
  *        null when that record is unavailable or overflowed
  */
 static String forChallenge(String reportedHost,String pendingMain,String documentUrl,boolean committed,Collection<String> otherRequests){
  if(reportedHost==null||reportedHost.isEmpty()||reportedHost.length()>512||otherRequests==null||pendingMain==null)return null;
  String reportedPort=reportedHost.matches(".*:\\d{1,5}$")?reportedHost.substring(reportedHost.lastIndexOf(':')+1):null;
  String asked=(reportedPort==null?reportedHost:reportedHost.substring(0,reportedHost.lastIndexOf(':'))).toLowerCase(Locale.ROOT);
  // Main-frame only: with a committed page and no different main-frame load pending, the
  // challenge can only come from that page's own frames or resources, whose port is unknown.
  if(committed&&pendingMain.equals(documentUrl))return null;
  if(!asked.equals(host(pendingMain)))return null;
  String found=exactHttps(pendingMain);
  if(found==null)return null;
  // An uncommitted in-flight target for the same host (before a redirect) must agree.
  if(!committed&&asked.equals(host(documentUrl))&&!found.equals(exactHttps(documentUrl)))return null;
  if(reportedPort!=null){
   int port=Integer.parseInt(reportedPort);
   if(!found.equals("https://"+asked+(port==443?"":":"+port)))return null;
  }
  // A frame or resource of this tab on the same host but another origin could be the one
  // asking; the challenge cannot tell them apart, so neither is filled.
  for(String other:otherRequests){
   if(other==null)continue;
   if(asked.equals(host(other))&&!found.equals(other))return null;
  }
  return found;
 }
}
