package ai.elizaresearch.alphaphone;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
final class AlphaLocalSpeechEngineTest{
 static void check(boolean okay,String message){if(!okay)throw new AssertionError(message);}
 static final class Engine implements AlphaLocalSpeechEngine.Backend{
  final CountDownLatch entered=new CountDownLatch(1),cancelled=new CountDownLatch(1);int closes;
  public String transcribe(float[] samples)throws Exception{entered.countDown();if(!cancelled.await(2,TimeUnit.SECONDS))throw new AssertionError("Cancellation waited behind native call");throw new CancellationException();}
  public AlphaLocalSpeechEngine.Audio synthesize(String text,java.util.function.BooleanSupplier cancel){return new AlphaLocalSpeechEngine.Audio(new float[]{0.1f,0.2f},16000);}
  public void cancel(){cancelled.countDown();}public void close(){closes++;}
 }
 public static void main(String[]args)throws Exception{
  AtomicInteger created=new AtomicInteger();AtomicReference<Engine> active=new AtomicReference<>();AlphaLocalSpeechEngine holder=new AlphaLocalSpeechEngine(()->{created.incrementAndGet();Engine e=new Engine();active.set(e);return e;});
  holder.use(e->null);holder.use(e->null);check(created.get()==1,"models reused");
  ExecutorService worker=Executors.newSingleThreadExecutor();try{Future<String> running=worker.submit(()->holder.use(e->e.transcribe(new float[1600])));check(active.get().entered.await(2,TimeUnit.SECONDS),"entered native");holder.cancel();try{running.get(2,TimeUnit.SECONDS);throw new AssertionError();}catch(ExecutionException expected){check(expected.getCause() instanceof CancellationException,"native cancellation surfaced");}}finally{worker.shutdownNow();}
  Engine old=active.get();holder.release();check(old.closes==1,"released once");holder.use(e->null);check(created.get()==2,"reopens after release");holder.close();holder.close();check(active.get().closes==1,"close idempotent");try{holder.use(e->null);throw new AssertionError();}catch(IllegalStateException expected){}
  float[] original={-1f,0f,0.5f,1f};byte[] wav=new AlphaLocalSpeechEngine.Audio(original,16000).wav();float[] decoded=AlphaLocalSpeechEngine.readMono16kWav(wav);check(decoded.length==4&&Math.abs(decoded[2]-0.5)<0.0001,"PCM round trip");
  wav[40]++;try{AlphaLocalSpeechEngine.readMono16kWav(wav);throw new AssertionError();}catch(java.io.IOException expected){}
  try{new AlphaLocalSpeechEngine.Audio(new float[]{Float.NaN},16000).wav();throw new AssertionError();}catch(IllegalStateException expected){}
  System.out.println("PASS local speech lifecycle and PCM");
 }
}
