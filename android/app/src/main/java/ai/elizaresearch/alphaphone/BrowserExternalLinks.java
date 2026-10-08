package ai.elizaresearch.alphaphone;

import android.content.Intent;
import android.net.Uri;
import java.util.Locale;
import java.util.Set;

/** Website links that belong to another Android app. Every handoff is an
 * implicit, browsable request with no component, selector, clip data or
 * permission-granting flags, so a page cannot address a specific private
 * Activity or grant URI access. Alpha's own package and app routes are refused. */
final class BrowserExternalLinks {
 static final Set<String> SCHEMES=Set.of("mailto","tel","intent","market");
 /** Schemes an intent: URI may never carry as data, including Alpha's own routes. */
 private static final Set<String> FORBIDDEN_DATA=Set.of("file","content","javascript","data","blob","about","intent","android-app","alphaphone");
 private BrowserExternalLinks(){}
 static boolean external(String raw){
  try{String scheme=Uri.parse(raw).getScheme();return scheme!=null&&SCHEMES.contains(scheme.toLowerCase(Locale.ROOT));}catch(Exception invalid){return false;}
 }
 /** Returns a sanitized implicit Intent, or null when the link must be refused. */
 static Intent intentFor(String raw,String ownPackage){
  if(raw==null||raw.length()>4096||raw.matches("(?s).*[\\x00-\\x1f\\x7f].*"))return null;
  Uri uri;try{uri=Uri.parse(raw);}catch(Exception invalid){return null;}
  String scheme=uri.getScheme()==null?"":uri.getScheme().toLowerCase(Locale.ROOT);
  Intent intent;
  switch(scheme){
   case "mailto": intent=new Intent(Intent.ACTION_SENDTO,uri);break;
   // DIAL only opens the dialer with the number; it never places a call.
   case "tel": intent=new Intent(Intent.ACTION_DIAL,uri);break;
   case "market": intent=new Intent(Intent.ACTION_VIEW,uri).addCategory(Intent.CATEGORY_BROWSABLE);break;
   case "intent": {
    Intent parsed;
    try{parsed=Intent.parseUri(raw,Intent.URI_INTENT_SCHEME);}catch(Exception invalid){return null;}
    String action=parsed.getAction();
    if(action!=null&&!Intent.ACTION_VIEW.equals(action))return null;
    Uri data=parsed.getData();
    if(data!=null){String target=data.getScheme();if(target==null||FORBIDDEN_DATA.contains(target.toLowerCase(Locale.ROOT)))return null;}
    if(ownPackage.equals(parsed.getPackage()))return null;
    intent=new Intent(Intent.ACTION_VIEW);
    if(data!=null)intent.setDataAndType(data,parsed.getType());else if(parsed.getType()!=null)intent.setType(parsed.getType());
    if(parsed.getPackage()!=null)intent.setPackage(parsed.getPackage());
    // No page-supplied extras are forwarded; browser_fallback_url is read
    // separately by the browser itself.
    intent.addCategory(Intent.CATEGORY_BROWSABLE);
    break;
   }
   default: return null;
  }
  // A fresh Intent never inherits a page-chosen component, selector, clip data
  // or URI-grant flags. Re-assert that for defence in depth.
  intent.setComponent(null);intent.setSelector(null);intent.setClipData(null);
  intent.setFlags(0);
  return intent;
 }
 /** Safe HTTPS fallback named by an intent: URI, or null. */
 static String fallback(String raw){
  if(raw==null||!raw.regionMatches(true,0,"intent:",0,7))return null;
  try{String value=Intent.parseUri(raw,Intent.URI_INTENT_SCHEME).getStringExtra("browser_fallback_url");return value!=null&&value.regionMatches(true,0,"https://",0,8)&&BrowserSessionStore.validUrl(value)?value:null;}
  catch(Exception invalid){return null;}
 }
}
