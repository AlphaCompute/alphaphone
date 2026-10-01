package ai.elizaresearch.alphaphone;

import ai.eliza.speech.LocalSpeechEngine;
import ai.eliza.speech.SpeechAssets;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.Test;
import static org.junit.Assert.*;

/** Real packaged-model sentence callbacks; no Activity, microphone, HTTP or playback. */
public final class SpeechSentenceCancellationInstrumentedTest {
 private static final String TEXT="The morning is bright. The garden is green. The evening is quiet.";
 private static void discard(LocalSpeechEngine.Audio audio){assertTrue(audio.samples.length>0);Arrays.fill(audio.samples,0);}
 @Test public void nativeSentenceCancellationAndRecovery()throws Exception{
  org.junit.Assume.assumeTrue("Explicit real-model campaign required","1".equals(InstrumentationRegistry.getArguments().getString("speechSentenceCancellation")));
  Class<?> callback=Class.forName("ai.eliza.speech.LocalSpeechEngine$SynthesisCallback");
  assertEquals("Exact Sherpa JNI callback return descriptor",Integer.class,callback.getDeclaredMethod("invoke",float[].class).getReturnType());
  assertTrue("Function1 erased bridge remains",callback.getDeclaredMethod("invoke",Object.class).isBridge());
  ExecutorService worker=Executors.newSingleThreadExecutor();AtomicReference<LocalSpeechEngine> engine=new AtomicReference<>();
  CountDownLatch boundary=new CountDownLatch(1),release=new CountDownLatch(1);AtomicBoolean cancelled=new AtomicBoolean();AtomicInteger checks=new AtomicInteger();
  Throwable primary=null;
  try{
   worker.submit(()->{try{engine.set(new LocalSpeechEngine(SpeechAssets.install(InstrumentationRegistry.getInstrumentation().getTargetContext())));}catch(Exception e){throw new RuntimeException(e);}}).get(120,TimeUnit.SECONDS);
   // Prove this exact frontend/model splits the text into multiple native batches.
   AtomicInteger controlChecks=new AtomicInteger();
   discard(worker.submit(()->engine.get().synthesize(TEXT,()->{controlChecks.incrementAndGet();return false;})).get(120,TimeUnit.SECONDS));
   assertTrue("Pre/post checks plus at least two real native callbacks",controlChecks.get()>=4);
   Future<LocalSpeechEngine.Audio> pending=worker.submit(()->engine.get().synthesize(TEXT,()->{
    int n=checks.incrementAndGet();
    if(n==2){ // first invocation is the preflight, second is the first real JNI callback
     boundary.countDown();
     try{if(!release.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Cancellation handshake timed out");}
     catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}
    }
    return cancelled.get();
   }));
   assertTrue("Reached actual first sentence callback",boundary.await(120,TimeUnit.SECONDS));
   long cancelAt=SystemClock.elapsedRealtime();cancelled.set(true);release.countDown();
   try{discard(pending.get(120,TimeUnit.SECONDS));fail("Cancelled generation must not publish partial audio");}
   catch(ExecutionException expected){assertTrue("Explicit cancellation",expected.getCause() instanceof CancellationException);}
   assertEquals("Only preflight and first callback; native skipped subsequent batches",2,checks.get());
   Bundle timing=new Bundle();timing.putLong("sentenceCancelToReturnMs",SystemClock.elapsedRealtime()-cancelAt);timing.putInt("controlNativeCallbacks",controlChecks.get()-2);InstrumentationRegistry.getInstrumentation().sendStatus(0,timing);
   // Same handles remain usable; default compatibility API still works.
   discard(worker.submit(()->engine.get().synthesize("The morning is bright.")).get(120,TimeUnit.SECONDS));
   AtomicInteger throwingChecks=new AtomicInteger();
   try{discard(worker.submit(()->engine.get().synthesize(TEXT,()->{if(throwingChecks.incrementAndGet()==2)throw new IllegalStateException("Synthetic predicate failure");return false;})).get(120,TimeUnit.SECONDS));fail("Predicate failure must reject");}
   catch(ExecutionException expected){assertTrue(expected.getCause() instanceof IllegalStateException);assertEquals("Speech cancellation check failed",expected.getCause().getMessage());}
   assertEquals("Throwing callback also stops further batches",2,throwingChecks.get());
   discard(worker.submit(()->engine.get().synthesize("The evening is quiet.")).get(120,TimeUnit.SECONDS));
  }catch(Exception|AssertionError error){primary=error;throw error;}finally{
   cancelled.set(true);release.countDown();
   // Never free handles concurrently with native inference, including on failure.
   worker.shutdown();if(worker.awaitTermination(120,TimeUnit.SECONDS)){if(engine.get()!=null)engine.get().close();}
   else{AssertionError cleanup=new AssertionError("Native worker did not terminate; handles deliberately not freed concurrently");if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
  }
 }
}
