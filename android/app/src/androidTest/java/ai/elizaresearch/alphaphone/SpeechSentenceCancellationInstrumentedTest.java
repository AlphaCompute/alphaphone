package ai.elizaresearch.alphaphone;

import ai.eliza.speech.LocalSpeechEngine;
import ai.eliza.speech.SpeechAssets;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.Test;
import static org.junit.Assert.*;

/** Real native cancellation and recovery; no Sherpa callback ABI or simulated inference. */
public final class SpeechSentenceCancellationInstrumentedTest {
 @Test public void nativeCancellationAndRecovery()throws Exception {
  org.junit.Assume.assumeTrue("Explicit real-model campaign required","1".equals(InstrumentationRegistry.getArguments().getString("speechSentenceCancellation")));
  ExecutorService worker=Executors.newSingleThreadExecutor();
  LocalSpeechEngine engine=new LocalSpeechEngine(SpeechAssets.install(InstrumentationRegistry.getInstrumentation().getTargetContext()));
  AtomicBoolean cancelled=new AtomicBoolean();CountDownLatch started=new CountDownLatch(1);
  try {
   worker.submit(()->{try{engine.prepare();}catch(Exception e){throw new RuntimeException(e);}}).get(120,TimeUnit.SECONDS);
   String text="The morning is bright. The garden is green. The evening is quiet. ".repeat(80);
   Future<LocalSpeechEngine.Audio> pending=worker.submit(()->engine.synthesize(text,()->{started.countDown();return cancelled.get();}));
   assertTrue("Worker entered synthesis",started.await(10,TimeUnit.SECONDS));
   // The native cancellation flag may reset at entry; repeat until the worker acknowledges it.
   Thread.sleep(100);
   assertFalse("Long real synthesis is still running before cancellation",pending.isDone());
   cancelled.set(true);
   long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);
   while(!pending.isDone()&&System.nanoTime()<deadline){engine.cancel();Thread.sleep(10);}
   try{pending.get(1,TimeUnit.SECONDS);fail("Cancelled generation must not publish partial audio");}
   catch(ExecutionException expected){assertTrue(expected.getCause() instanceof CancellationException);}
   LocalSpeechEngine.Audio recovered=worker.submit(()->engine.synthesize("The morning is bright.")).get(120,TimeUnit.SECONDS);
   assertEquals(24000,recovered.sampleRate);assertTrue(recovered.samples.length>0);Arrays.fill(recovered.samples,0);
  } finally {
   cancelled.set(true);engine.cancel();worker.shutdown();
   if(worker.awaitTermination(120,TimeUnit.SECONDS))engine.close();
   else throw new AssertionError("Native worker did not terminate; handles not freed concurrently");
  }
 }
}
