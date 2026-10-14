package ai.eliza.speech;

import android.content.Context;
import java.io.File;
import java.io.IOException;

/** Product bridge to the pinned, hash-verified libelizainference voice bundle. */
public final class SpeechAssets {
 private SpeechAssets() {}
 public static File install(Context context) throws IOException {
  return ai.eliza.voice.VoiceAssets.install(context).root;
 }
}
