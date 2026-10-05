package ai.elizaresearch.alphaphone;

import android.os.Bundle;
import android.content.Intent;
import android.os.SystemClock;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import ai.eliza.plugins.system.SystemPlugin;

/** Derived from packages/app/scripts/mobile/android/templates/main-activity.ts.
 * Product shell: local assets, Eliza's system bridge, no cloud-auth or implicit kiosk policy.
 */
public class MainActivity extends BridgeActivity {
 private volatile int bottomInsetDp = 0;
 private volatile int topInsetDp = 0;
 public int getTopInsetDp() { return topInsetDp; }
 public int getBottomInsetDp() { return bottomInsetDp; }
 protected boolean isAssistantSurface() { return false; }
 // Renderer recovery is process-wide so a crash loop backs off instead of spinning.
 private static final long RECOVERY_WINDOW_MS = 60_000L, RECOVERY_BACKOFF_MS = 5_000L;
 private static final int RECOVERY_BUDGET = 3;
 private static long recoveryWindowStart = 0L;
 private static int recoveriesInWindow = 0;
 private boolean recoveringRenderer = false;
 /** Returns the delay before recreating after a renderer loss, applying a bounded backoff. */
 static synchronized long rendererRecoveryDelay(long now) {
  if (recoveryWindowStart == 0L || now - recoveryWindowStart > RECOVERY_WINDOW_MS) { recoveryWindowStart = now; recoveriesInWindow = 0; }
  recoveriesInWindow++;
  return recoveriesInWindow > RECOVERY_BUDGET ? RECOVERY_BACKOFF_MS : 0L;
 }
 private final WebViewListener rendererRecovery = new WebViewListener() {
  @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
   if (getBridge() == null || view != getBridge().getWebView()) return false;
   // A dead renderer leaves the HOME surface blank and, unhandled, kills the app process.
   // Detach and destroy the dead WebView, then rebuild the Activity and its bridge.
   android.util.Log.w("AlphaRenderer", "WebView renderer gone; crashed=" + detail.didCrash() + "; recreating activity");
   if (recoveringRenderer) return true;
   recoveringRenderer = true;
   if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
   view.destroy();
   long delay = rendererRecoveryDelay(SystemClock.elapsedRealtime());
   getWindow().getDecorView().postDelayed(() -> { if (!isFinishing() && !isDestroyed()) recreate(); }, delay);
   return true;
  }
 };
 @Override public void onCreate(Bundle state) {
  SplashScreen.installSplashScreen(this);
  registerPlugin(SystemPlugin.class);
  registerPlugin(DeviceAppsPlugin.class);
  registerPlugin(DailyAppsPlugin.class);
  registerPlugin(AlphaMapsTransportPlugin.class);
  registerPlugin(ai.eliza.plugins.camera.CameraPlugin.class);
  // MVP-DEFERRED: Contacts, per September 15 scope; restore only with provider/permission acceptance.
  // registerPlugin(ai.eliza.plugins.contacts.ContactsPlugin.class);
  registerPlugin(ai.eliza.plugins.location.LocationPlugin.class);
  registerPlugin(AlphaBrowserPlugin.class);
  registerPlugin(AlphaCalendarPlugin.class);
  registerPlugin(AlphaPhotosPlugin.class);
  registerPlugin(AlphaFilesPlugin.class);
  registerPlugin(AlphaMailAttachmentsPlugin.class);
  registerPlugin(AlphaDevicePlugin.class);
  registerPlugin(AlphaConnectionPlugin.class);
  registerPlugin(AlphaLocalAgentPlugin.class);
  registerPlugin(AlphaActionJournalPlugin.class);
  registerPlugin(AlphaVoiceCloudPlugin.class);
  registerPlugin(AlphaNoteAudioPlugin.class);
  registerPlugin(AlphaNoteDocumentsPlugin.class);
  registerPlugin(AlphaNotificationsPlugin.class);
  registerPlugin(AlphaHostedResultsPlugin.class);
  if (BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS) {
   // Present only in debug builds made with -PELIZA_DEV_ALLOW_TEST_MOCKS=1 (src/testMocks).
   try { registerPlugin(Class.forName("ai.elizaresearch.alphaphone.DevelopmentAgentPlugin").asSubclass(com.getcapacitor.Plugin.class)); }
   catch (ClassNotFoundException ignored) { /* Test-mocks overlay not attached to this build. */ }
  }
  super.onCreate(state);
  getBridge().addWebViewListener(rendererRecovery);
  WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
  getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  AlphaDevicePlugin.applyTextScale(this);
  // The reference layouts include system-bar space. Draw behind the real bars,
  // and resize for the IME only; the renderer never draws fake battery/network UI.
  WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
  getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
  getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
  if (android.os.Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
  ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
   int bottom = insets.isVisible(WindowInsetsCompat.Type.ime())
     ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0;
   int nextInset = bottom > 0 ? 0 : Math.round(insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom / getResources().getDisplayMetrics().density);
   topInsetDp = Math.round(insets.getInsets(WindowInsetsCompat.Type.systemBars()).top / getResources().getDisplayMetrics().density);
   getBridge().getWebView().evaluateJavascript("document.documentElement?.style.setProperty('--native-top-inset','" + topInsetDp + "px')", null);
   if (view.getPaddingBottom() != bottom) view.setPadding(0, 0, 0, bottom);
   if (bottomInsetDp != nextInset) {
    bottomInsetDp = nextInset;
    getBridge().getWebView().evaluateJavascript("document.documentElement?.style.setProperty('--native-bottom-inset','" + bottomInsetDp + "px')", null);
   }
   return WindowInsetsCompat.CONSUMED;
  });
  getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
   @Override public void handleOnBackPressed() {
    if (BuildConfig.DEBUG) android.util.Log.d("AlphaNavigation", "Back dispatched");
    // Test and consume renderer navigation in one evaluation. Root Back uses
    // normal Android task behavior in standalone mode; launcher retains HOME.
    String script = "(() => { if (document.documentElement.dataset.alphaCanGoBack === 'true') { window.dispatchEvent(new Event('alpha-back')); return true; } "
     + (BuildConfig.IS_LAUNCHER && !isAssistantSurface() ? "window.dispatchEvent(new Event('launcher-home')); return true;" : "return false;") + " })()";
    getBridge().getWebView().evaluateJavascript(script, handled -> {
     if (BuildConfig.DEBUG) android.util.Log.d("AlphaNavigation", "Back handled by renderer=" + handled);
     if ((!BuildConfig.IS_LAUNCHER || isAssistantSurface()) && !"true".equals(handled) && !isFinishing() && !isDestroyed()) finish();
    });
   }
  });
 }
 @Override public void onNewIntent(Intent intent) {
  super.onNewIntent(intent);
  if (!isAssistantSurface() && Intent.ACTION_MAIN.equals(intent.getAction()) && intent.hasCategory(Intent.CATEGORY_HOME))
   getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('launcher-home'))", null);
 }
 @Override public void onResume(){super.onResume();if(getBridge()!=null&&getBridge().getWebView()!=null)AlphaDevicePlugin.applyTextScale(this);}
 @Override public void onConfigurationChanged(android.content.res.Configuration configuration){super.onConfigurationChanged(configuration);if(getBridge()!=null&&getBridge().getWebView()!=null)AlphaDevicePlugin.applyTextScale(this);}
}
