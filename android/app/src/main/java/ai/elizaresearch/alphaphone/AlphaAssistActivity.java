package ai.elizaresearch.alphaphone;

import android.app.ComponentCaller;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.annotation.RequiresApi;

/** User-invoked assistant surface. Never consumes caller text, URI, or assist context. */
public final class AlphaAssistActivity extends MainActivity {
 @Override protected boolean isAssistantSurface() { return true; }
 private String newIntentCaller;
 @Override public void onCreate(Bundle state) {
  setIntent(cleanIntent(Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE ? getLaunchedFromPackage() : null));
  super.onCreate(state);
 }
 /** Android 15+ reports who sent each new intent to this single-task surface. */
 @RequiresApi(Build.VERSION_CODES.VANILLA_ICE_CREAM)
 @Override public void onNewIntent(Intent intent, ComponentCaller caller) {
  newIntentCaller = caller == null ? null : caller.getPackage();
  super.onNewIntent(intent, caller);
 }
 @Override public void onNewIntent(Intent ignored) {
  Intent clean = cleanIntent(newIntentCaller);
  newIntentCaller = null;
  setIntent(clean);
  super.onNewIntent(clean);
 }
 /** The only extras: product-set launch flags the renderer may read. Caller extras are dropped. */
 static final String EXTRA_ASSISTANT = "alpha.assistant";
 /** {@link AssistInvocation#LISTENER} or {@link AssistInvocation#ASSIST}, from Android-reported caller identity only. */
 static final String EXTRA_INVOCATION = "alpha.invocation";
 /** The caller package is known only when the caller shared its identity (the listener does). */
 private Intent cleanIntent(String caller) {
  boolean sameSigner = caller != null && getPackageManager().checkSignatures(getPackageName(), caller) == PackageManager.SIGNATURE_MATCH;
  return new Intent(this, AlphaAssistActivity.class).setAction(Intent.ACTION_ASSIST).putExtra(EXTRA_ASSISTANT, true)
   .putExtra(EXTRA_INVOCATION, AssistInvocation.origin(caller, sameSigner));
 }
}
