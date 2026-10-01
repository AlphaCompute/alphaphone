package ai.elizaresearch.alphaphone;

import android.content.Intent;
import android.os.Bundle;

/** User-invoked assistant surface. Never consumes caller text, URI, or assist context. */
public final class AlphaAssistActivity extends MainActivity {
 @Override protected boolean isAssistantSurface() { return true; }
 @Override public void onCreate(Bundle state) {
  setIntent(cleanIntent());
  super.onCreate(state);
 }
 @Override public void onNewIntent(Intent ignored) {
  Intent clean = cleanIntent();
  setIntent(clean);
  super.onNewIntent(clean);
 }
 private Intent cleanIntent() {
  return new Intent(this, AlphaAssistActivity.class).setAction(Intent.ACTION_ASSIST);
 }
}
