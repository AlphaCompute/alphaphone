package ai.elizaresearch.alphaphone;

import android.os.Bundle;
import android.os.SystemClock;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Real packaged Kokoro phrases through the fused engine; no Activity, microphone, HTTP or playback.
 * The pinned JNI cannot interrupt a Kokoro call, so cancellation is checked between phrases: a
 * cancel raised during the first phrase stops before the second and publishes no partial audio.
 */
public final class SpeechSentenceCancellationInstrumentedTest {
 private static final String TEXT="The morning is bright. The garden is green. The evening is quiet.";
 private static void discard(AlphaFusedSpeech.Audio audio){assertTrue(audio.samples.length>0);Arrays.fill(audio.samples,0);}
 @Test public void phraseCancellationAndRecovery()throws Exception{
  org.junit.Assume.assumeTrue("Explicit real-model campaign required","1".equals(InstrumentationRegistry.getArguments().getString("speechSentenceCancellation")));
  ExecutorService worker=Executors.newSingleThreadExecutor();AtomicReference<AlphaFusedSpeech> engine=new AtomicReference<>();
  CountDownLatch boundary=new CountDownLatch(1),release=new CountDownLatch(1);AtomicBoolean cancelled=new AtomicBoolean();AtomicInteger checks=new AtomicInteger();
  Throwable primary=null;
  try{
   worker.submit(()->{try{engine.set(AlphaFusedSpeech.open(InstrumentationRegistry.getInstrumentation().getTargetContext()));}catch(Exception e){throw new RuntimeException(e);}}).get(120,TimeUnit.SECONDS);
   // Prove this text becomes several native Kokoro calls: one check before the plan, one per phrase, one at the end.
   AtomicInteger controlChecks=new AtomicInteger();
   discard(worker.submit(()->engine.get().synthesize(TEXT,()->{controlChecks.incrementAndGet();return false;})).get(120,TimeUnit.SECONDS));
   assertTrue("Three sentences give at least three phrase checks plus the bounds",controlChecks.get()>=5);
   Future<AlphaFusedSpeech.Audio> pending=worker.submit(()->engine.get().synthesize(TEXT,()->{
    int n=checks.incrementAndGet();
    if(n==3){ // 1: entry, 2: before phrase one, 3: before phrase two (phrase one has rendered)
     boundary.countDown();
     try{if(!release.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Cancellation handshake timed out");}
     catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}
    }
    return cancelled.get();
   }));
   assertTrue("Reached the first phrase boundary",boundary.await(120,TimeUnit.SECONDS));
   long cancelAt=SystemClock.elapsedRealtime();cancelled.set(true);release.countDown();
   try{discard(pending.get(120,TimeUnit.SECONDS));fail("Cancelled generation must not publish partial audio");}
   catch(ExecutionException expected){assertTrue("Explicit cancellation",expected.getCause() instanceof CancellationException);}
   assertTrue("No phrase after the cancelled boundary was rendered",checks.get()<=4);
   Bundle timing=new Bundle();timing.putLong("phraseCancelToReturnMs",SystemClock.elapsedRealtime()-cancelAt);timing.putInt("controlPhraseChecks",controlChecks.get());InstrumentationRegistry.getInstrumentation().sendStatus(0,timing);
   // The same context keeps working after a cancelled request.
   discard(worker.submit(()->engine.get().synthesize("The morning is bright.",()->false)).get(120,TimeUnit.SECONDS));
   AtomicInteger throwingChecks=new AtomicInteger();
   try{discard(worker.submit(()->engine.get().synthesize(TEXT,()->{if(throwingChecks.incrementAndGet()==3)throw new IllegalStateException("Synthetic predicate failure");return false;})).get(120,TimeUnit.SECONDS));fail("Predicate failure must reject");}
   catch(ExecutionException expected){assertTrue(expected.getCause() instanceof IllegalStateException);}
   discard(worker.submit(()->engine.get().synthesize("The evening is quiet.",()->false)).get(120,TimeUnit.SECONDS));
  }catch(Exception|AssertionError error){primary=error;throw error;}finally{
   cancelled.set(true);release.countDown();
   // Never destroy the context concurrently with native inference, including on failure.
   worker.shutdown();if(worker.awaitTermination(120,TimeUnit.SECONDS)){if(engine.get()!=null)engine.get().close();}
   else{AssertionError cleanup=new AssertionError("Native worker did not terminate; context deliberately not destroyed concurrently");if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
  }
 }
}
