package ai.elizaresearch.alphaphone;

import android.net.Uri;
import android.webkit.WebView;
import androidx.webkit.JavaScriptExecutionException;
import androidx.webkit.JavaScriptExecutionWorld;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.ScriptHandler;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebViewOutcomeReceiver;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;

/** No page-world bridge or fallback. The private world's sole message is readiness. */
final class BrowserReadingWorld {
 private static final String CHANNEL="__alphaBrowserReadWorld";
 private final WebView web;
 private JavaScriptExecutionWorld world;
 private ScriptHandler script;
 private JavaScriptReplyProxy proxy;
 private WebViewCompat.WebMessageListener listener;
 private String origin, nonce, expectedUrl;
 private boolean started;
 private long generation;
 private boolean closed;
 BrowserReadingWorld(WebView web) {
  this.web=web;
  if(!WebViewFeature.isFeatureSupported(WebViewFeature.JS_INJECTION_IN_FRAME_AND_WORLD))return;
  try {
   world=WebViewCompat.getExecutionWorld(web,"alpha-browser-reading-v1");
   // Browsing accepts arbitrary origins. The wildcard exists ONLY in this
   // isolated world, never in PAGE_WORLD_NAME; native code accepts no command,
   // data or credentials from it, and excludes all non-main-frame messages.
   listener=(view,message,source,isMainFrame,reply)->{
    if(closed||view!=web||!isMainFrame||message.getType()!=WebMessageCompat.TYPE_STRING||nonce==null||!started||!nonce.equals(message.getData()))return;
    String actual=origin(web.getUrl()),sender=origin(source.toString());
    if(actual==null||!actual.equals(sender))return;
    proxy=reply;origin=sender;
   };
   WebViewCompat.addWebMessageListener(web,CHANNEL,Set.of("*"),world,listener);
  }catch(RuntimeException unavailable){close();}
 }
 private static String origin(String value){
  if(value==null)return null;
  try{Uri uri=Uri.parse(value);String host=uri.getHost();if(!"https".equalsIgnoreCase(uri.getScheme())||host==null||uri.getUserInfo()!=null)return null;return "https://"+host.toLowerCase(java.util.Locale.ROOT)+":"+(uri.getPort()<0?443:uri.getPort());}catch(Exception invalid){return null;}
 }
 // Must run before loadUrl/reload/history navigation, never from onPageStarted:
 // WebKit only guarantees registration for documents loaded after this call.
 void prepare(String url){
  invalidate();if(closed||world==null||origin(url)==null)return;
  nonce=java.util.UUID.randomUUID().toString();expectedUrl=url;
  try{script=WebViewCompat.addJavaScriptOnEvent(web,
   "if(window===window.top&&location.protocol==='https:'){"+CHANNEL+".postMessage('"+nonce+"');}",
   WebViewCompat.INJECTION_EVENT_DOCUMENT_END,Set.of("*"),world);
  }catch(RuntimeException unavailable){invalidate();}
 }
 void prepareHistory(int offset){
  android.webkit.WebBackForwardList history=web.copyBackForwardList();int index=history.getCurrentIndex()+offset;
  prepare(index>=0&&index<history.getSize()?history.getItemAtIndex(index).getUrl():null);
 }
 void pageStarted(String url){
  // Repeated/unprepared navigation may be a redirect or same-origin reload.
  // Never adopt its proxy using an origin-only claim. Explicit Reload can retry.
  if(nonce==null||started||!Objects.equals(expectedUrl,url)){invalidate();return;}
  generation++;proxy=null;origin=null;started=true;
 }
 void invalidate(){
  generation++;proxy=null;origin=null;nonce=null;expectedUrl=null;started=false;
  if(script!=null){try{script.remove();}catch(RuntimeException ignored){}script=null;}
 }
 boolean ready(){return !closed&&world!=null&&proxy!=null&&origin!=null&&origin.equals(origin(web.getUrl()));}
 void evaluate(String source,Consumer<String> result,Runnable failure){
  if(!ready()){failure.run();return;}
  long expected=generation;JavaScriptReplyProxy selected=proxy;String expectedUrl=web.getUrl();
  try{selected.executeJavaScript(source,new WebViewOutcomeReceiver<String,JavaScriptExecutionException>(){
   @Override public void onResult(String value){if(expected==generation&&selected==proxy&&ready()&&Objects.equals(expectedUrl,web.getUrl()))result.accept(value);else failure.run();}
   @Override public void onError(JavaScriptExecutionException error){failure.run();}
  });}catch(RuntimeException unavailable){failure.run();}
 }
 void close(){
  if(closed)return;closed=true;invalidate();
  if(script!=null){try{script.remove();}catch(RuntimeException ignored){}script=null;}
  if(world!=null){try{WebViewCompat.removeWebMessageListener(web,world,CHANNEL);}catch(RuntimeException ignored){}world=null;}
 }
}
