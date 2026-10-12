package ai.elizaresearch.alphaphone;

import java.net.URI;
import java.util.Locale;

/**
 * The exact origin a browser HTTP authentication prompt may be filled for (issue #404).
 * Plain Java so it runs on the JVM in {@code npm test}; anything it cannot parse fails closed.
 */
final class BrowserHttpAuthOrigin {
 private BrowserHttpAuthOrigin(){}

 /** Exact {@code https://host[:port]} of a URL without user info, or null. Default port omitted. */
 static String exactHttps(String url){
  if(url==null||url.isEmpty()||url.length()>4096)return null;
  URI uri;
  try{uri=new URI(url);}catch(Exception invalid){return null;}
  String host=uri.getHost();
  if(!"https".equalsIgnoreCase(uri.getScheme())||host==null||host.isEmpty()||uri.getRawUserInfo()!=null)return null;
  int port=uri.getPort();
  return "https://"+host.toLowerCase(Locale.ROOT)+(port==-1||port==443?"":":"+port);
 }

 /**
  * The single origin for a challenge from {@code reportedHost} (WebView may append
  * {@code :port}), given the page URLs that could have issued it. Null when a candidate for
  * that host is not HTTPS, two candidates disagree (for example a redirect to another port),
  * a reported port contradicts them, or no candidate matches.
  */
 static String forChallenge(String reportedHost,String... candidates){
  if(reportedHost==null||reportedHost.isEmpty()||reportedHost.length()>512)return null;
  String reportedPort=reportedHost.matches(".*:\\d{1,5}$")?reportedHost.substring(reportedHost.lastIndexOf(':')+1):null;
  String asked=(reportedPort==null?reportedHost:reportedHost.substring(0,reportedHost.lastIndexOf(':'))).toLowerCase(Locale.ROOT);
  String found=null;
  for(String candidate:candidates){
   if(candidate==null)continue;
   String host;
   try{host=new URI(candidate).getHost();}catch(Exception invalid){return null;}
   if(host==null||!asked.equalsIgnoreCase(host))continue;
   String exact=exactHttps(candidate);
   if(exact==null)return null;
   if(found!=null&&!found.equals(exact))return null;
   found=exact;
  }
  if(found==null)return null;
  if(reportedPort!=null){
   int port=Integer.parseInt(reportedPort);
   String expected="https://"+asked+(port==443?"":":"+port);
   if(!expected.equals(found))return null;
  }
  return found;
 }
}
