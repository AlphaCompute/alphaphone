package ai.elizaresearch.alphaphone;

import android.os.Bundle;
import android.content.Intent;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import ai.eliza.plugins.system.SystemPlugin;

/** Derived from packages/app/scripts/mobile/android/templates/main-activity.ts.
 * Product shell: local assets, Eliza's system bridge, no cloud-auth or implicit kiosk policy.
 */
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state) {
  SplashScreen.installSplashScreen(this);
  registerPlugin(SystemPlugin.class);
  registerPlugin(DeviceAppsPlugin.class);
  super.onCreate(state);
  WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
  getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, insets) -> {
   androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
   view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
   return WindowInsetsCompat.CONSUMED;
  });
  if (BuildConfig.IS_LAUNCHER) getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
   @Override public void handleOnBackPressed() { getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('launcher-home'))", null); }
  });
 }
 @Override public void onNewIntent(Intent intent) {
  super.onNewIntent(intent);
  if (Intent.ACTION_MAIN.equals(intent.getAction()) && intent.hasCategory(Intent.CATEGORY_HOME))
   getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('launcher-home'))", null);
 }
}
