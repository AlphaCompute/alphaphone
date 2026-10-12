package ai.elizaresearch.alphaphone;

import androidx.test.platform.app.InstrumentationRegistry;
import java.util.UUID;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;

/**
 * Journey J05 composed in one app process on a flag-off build: a page in the native browser ->
 * Menu -> Ask about page -> the native review -> the question editor -> the composer -> Send with no
 * agent connected (nothing is dispatched and the draft is kept) -> a note whose web source is that
 * same page, stored in the encrypted Notes store, survives a recreation and reopens that address.
 *
 * The page is served from memory by BrowserPageQuestionInstrumentedTest's fixture; no public host is
 * contacted. The agent's answer and the "Review summary note" save that follows it are not covered:
 * a flag-off build on an emulator has no connected agent, so the note is stored in the shape that
 * save writes. Emulator evidence for the native boundary only; not a real page, agent or device.
 *
 *   npm run test:android:instrumentation -- --owned-emulator --avd NAME --serial emulator-NNNN --classes JourneyJ05
 */
public final class JourneyJ05InstrumentedTest {
 @Test public void pageQuestionReachesSendAndItsSourceNoteReopensThePage() throws Exception {
  Assume.assumeTrue("Explicit J05 journey campaign", "1".equals(InstrumentationRegistry.getArguments().getString("journeyJ05")));
  Assume.assumeTrue("J05 runs on the flag-off pair: a test-mocks build has a mock connection", !BuildConfig.ELIZA_DEV_ALLOW_TEST_MOCKS);
  BrowserPageQuestionInstrumentedTest steps = new BrowserPageQuestionInstrumentedTest();
  String page = BrowserPageQuestionInstrumentedTest.BASE + "/journey-" + UUID.randomUUID().toString().substring(0, 8), note = "journey-j05-" + UUID.randomUUID();
  try (BoundedActivityScenario<MainActivity> scenario = BoundedActivityScenario.launch(MainActivity.class)) {
   BrowserPageQuestionInstrumentedTest.Pages pages = null; Throwable primary = null;
   try {
    pages = steps.openBrowser();
    String reviewed = steps.askAboutPageUpToSend(pages, page);
    // Send dispatched nothing: neither the page text nor the reviewed draft left through any native call.
    org.junit.Assert.assertEquals(0, steps.leaks(reviewed).length());
    org.junit.Assert.assertEquals(0, steps.leaks(BrowserPageQuestionInstrumentedTest.ARTICLE).length());
    steps.cleanup(pages, null); pages = null;
    // The same page, as the summary note's web source.
    steps.sourceNoteSurvivesRecreationAndReopens(scenario, note, page);
   } catch (Exception | AssertionError failure) { primary = failure; throw failure; } finally {
    try {
     if (pages != null) steps.cleanup(pages, primary);
     steps.restoreNativeCalls();
     NotesSecureFixture.replaceRecords("records=>records.filter(n=>n.id!==" + JSONObject.quote(note) + ")");
    } catch (Exception | AssertionError failure) { if (primary != null) primary.addSuppressed(failure); else throw failure; }
   }
  }
 }
}
