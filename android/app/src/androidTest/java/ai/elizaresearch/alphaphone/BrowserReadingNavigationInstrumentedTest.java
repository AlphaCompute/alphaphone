package ai.elizaresearch.alphaphone;

import android.net.Uri;
import android.os.SystemClock;
import android.webkit.*;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.webkit.*;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import static org.junit.Assert.*;

/** Real WebView/proxy, deterministic delayed delivery through the registered listener. */
public final class BrowserReadingNavigationInstrumentedTest {
 private static Object field(Object target,String name)throws Exception {java.lang.reflect.Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
 private static void ready(BrowserReadingWorld world)throws Exception {
  for(int i=0;i<150;i++){AtomicReference<Boolean> value=new AtomicReference<>(false);BoundedActivityScenario.main(()->value.set(world.ready()));if(value.get())return;SystemClock.sleep(100);}fail("Isolated document handshake did not become ready");
 }
 @Test public void delayedSameOriginAndReloadReadyCannotAdoptOldDocument()throws Exception {
  org.junit.Assume.assumeTrue("Explicit isolated provider qualification", "1".equals(InstrumentationRegistry.getArguments().getString("browserIsolatedReading")));
  assertTrue(WebViewFeature.isFeatureSupported(WebViewFeature.JS_INJECTION_IN_FRAME_AND_WORLD));
  try(BoundedActivityScenario<MainActivity> scenario=BoundedActivityScenario.launch(MainActivity.class)){
   AtomicReference<WebView> webRef=new AtomicReference<>();AtomicReference<BrowserReadingWorld> worldRef=new AtomicReference<>();
   try {
    BoundedActivityScenario.main(()->{
     android.app.Activity activity=androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(androidx.test.runner.lifecycle.Stage.RESUMED).iterator().next();
     WebView web=new WebView(activity);webRef.set(web);web.getSettings().setJavaScriptEnabled(true);
     BrowserReadingWorld world=new BrowserReadingWorld(web);worldRef.set(world);
     web.setWebViewClient(new WebViewClient(){
      @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){world.pageStarted(url);}
      @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){return new WebResourceResponse("text/html","UTF-8",new ByteArrayInputStream(("<html><body><article>Current synthetic page "+request.getUrl().getPath()+"</article></body></html>").getBytes(StandardCharsets.UTF_8)));}
     });
     world.prepare("https://reading.invalid/first");web.loadUrl("https://reading.invalid/first");
    });
    WebView web=webRef.get();BrowserReadingWorld world=worldRef.get();ready(world);
    for(String next:new String[]{"https://reading.invalid/second","https://reading.invalid/second"}){
     AtomicReference<Throwable> error=new AtomicReference<>();
     BoundedActivityScenario.main(()->{try{
      String oldNonce=(String)field(world,"nonce");JavaScriptReplyProxy oldProxy=(JavaScriptReplyProxy)field(world,"proxy");
      WebViewCompat.WebMessageListener listener=(WebViewCompat.WebMessageListener)field(world,"listener");
      // Replay a genuinely issued old-document message at the vulnerable boundary.
      world.prepare(next);world.pageStarted(next);
      listener.onPostMessage(web,new WebMessageCompat(oldNonce),Uri.parse("https://reading.invalid"),true,oldProxy);
      assertFalse("Old document must not bind after invalidation",world.ready());
      // Start a genuine new document, including an exact-URL reload on iteration two.
      world.prepare(next);if(next.equals(web.getUrl()))web.reload();else web.loadUrl(next);
     }catch(Throwable failure){error.set(failure);}});
     if(error.get()!=null)throw new AssertionError(error.get());ready(world);
     AtomicReference<String> extracted=new AtomicReference<>();
     BoundedActivityScenario.main(()->world.evaluate("document.body.innerText",extracted::set,()->extracted.set("FAILED")));
     for(int i=0;i<150&&extracted.get()==null;i++)SystemClock.sleep(100);
     assertNotNull(extracted.get());assertTrue(extracted.get(),extracted.get().contains("Current synthetic page /second"));
    }
    // Unprepared page-initiated navigation is deliberately unavailable, never origin adopted.
    BoundedActivityScenario.main(()->{world.pageStarted("https://reading.invalid/other");assertFalse(world.ready());});
   }finally{BoundedActivityScenario.main(()->{if(worldRef.get()!=null)worldRef.get().close();if(webRef.get()!=null)webRef.get().destroy();});}
  }
 }
}
