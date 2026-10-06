package ai.elizaresearch.alphaphone;
import org.json.JSONObject;

/** Uses the real Back handler and the prototype's actual home icon buttons. */
final class AppNavigation {
 private AppNavigation() {}
 static void liveMode() throws Exception {
  try(StartupDocumentProbe startup=new StartupDocumentProbe()) {
   // Builds without ELIZA_DEV_ALLOW_TEST_MOCKS have no mock mode: require live directly.
   if("mock".equals(startup.awaitReady(!BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS))) {
    // One real click only. Never retry effects if their callback is lost.
    startup.expectNavigation();
    WebViewTestDriver.withActivity(MainActivity.class,a->a.getBridge().getWebView().evaluateJavascript("document.querySelector('.mock-mode-banner button')?.click()",null));
    startup.awaitReady(true);
   }
  }
 }
 static String request(String view) {
  // A caller may observe the target render before this helper's next timer runs.
  // Retire that timer before another request can navigate back through Home.
  return "(()=>{const label="+JSONObject.quote(view)+",target=label.toLowerCase();const previous=window.__alphaTestNavigation;if(previous?.timer)clearTimeout(previous.timer);const nav={target,tries:0,status:'running',timer:null,lastView:null};window.__alphaTestNavigation=nav;const again=()=>{nav.timer=setTimeout(step,100);};const step=()=>{"
   + "if(window.__alphaTestNavigation!==nav)return;nav.lastView=document.documentElement.dataset.activeView||null;if(++nav.tries>200){nav.status='failed';nav.reason='Navigation did not become ready';return;}const dialog=document.querySelector('.alpha-connection-scrim');if(dialog){const offline=[...dialog.querySelectorAll('button')].find(e=>e.textContent.trim()==='Continue offline');if(offline&&!offline.disabled)offline.click();again();return;}"
   + "if(document.querySelector('.os')?.inert){again();return;}if(nav.lastView===target){nav.status='complete';nav.timer=null;return;}"
   + "if(nav.lastView==='home'){const b=[...document.querySelectorAll('[data-screen] button')].find(e=>e.getAttribute('aria-label')===label&&e.getClientRects().length);if(b&&!b.disabled)b.click();again();return;}"
   + "window.dispatchEvent(new Event('alpha-back'));again();};step();})()";
 }
 static String selected(String view) { return "document.documentElement.dataset.activeView==="+JSONObject.quote(view.toLowerCase()); }
 static String composer() { return "[...document.querySelectorAll('textarea[data-alpha-composer]')].find(e=>!e.disabled&&e.getClientRects().length&&!e.closest('[inert], [aria-hidden=\"true\"]'))"; }
 static String type() { return "document.querySelector('button[aria-label=\"Type\"]')?.click()"; }
}
