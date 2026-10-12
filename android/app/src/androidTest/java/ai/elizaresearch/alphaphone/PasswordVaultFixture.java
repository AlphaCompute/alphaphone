package ai.elizaresearch.alphaphone;

import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.Until;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

/** Shared emulator setup for the password vault classes: a synthetic screen-lock PIN that the
 * classes set and always clear, and Android's own device-credential prompt answered with it.
 * Disposable owned emulators only; the PIN is a fixture value, never a real credential. */
final class PasswordVaultFixture implements AutoCloseable {
 /** Fixture PIN for the disposable emulator's screen lock; removed again by close(). */
 static final String PIN = "1357";
 private boolean set;

 static String shell(String command) throws Exception {
  try (InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command))) {
   return new String(input.readAllBytes(), StandardCharsets.UTF_8).trim();
  }
 }
 /** Sets the screen-lock PIN, refusing an emulator that already has a screen lock it does not own. */
 PasswordVaultFixture() throws Exception {
  // With no credential set, verifying an empty one succeeds; an existing lock is never replaced.
  String existing = shell("locksettings verify");
  assertTrue("The emulator already has a screen lock this test does not own: " + existing, existing.contains("verified successfully"));
  String result = shell("locksettings set-pin " + PIN);
  set = true;
  // A constructor that throws is never closed by try-with-resources: clear the PIN here.
  try { assertTrue("Fixture PIN set: " + result, shell("locksettings verify --old " + PIN).contains("verified successfully")); }
  catch (Throwable failed) { close(); throw failed; }
 }
 /** Answers Android's device-credential prompt with the fixture PIN. */
 static void confirmDeviceCredential() throws Exception {
  UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
  // The prompt belongs to Android (SystemUI or Settings), never to Alpha's page.
  boolean shown = device.wait(Until.hasObject(By.pkg(java.util.regex.Pattern.compile("com\\.android\\.(systemui|settings)"))), 10_000);
  assertTrue("Android's device-credential prompt appeared", shown);
  SystemClock.sleep(500);
  shell("input text " + PIN);
  shell("input keyevent KEYCODE_ENTER");
  assertTrue("The credential prompt closed after the PIN", device.wait(Until.hasObject(By.pkg(BuildConfig.APPLICATION_ID).depth(0)), 10_000));
 }
 /** Logcat since the given epoch (seconds), app process only, for secret scans. */
 static String logcatSince(long epochSeconds) throws Exception {
  return shell("logcat -d -v epoch -T " + epochSeconds + ".000");
 }
 @Override public void close() throws Exception {
  if (set) shell("locksettings clear --old " + PIN);
  set = false;
 }
}
