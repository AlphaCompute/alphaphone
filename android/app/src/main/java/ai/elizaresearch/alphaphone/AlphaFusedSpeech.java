package ai.elizaresearch.alphaphone;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.function.BooleanSupplier;

/**
 * On-device speech through the fused llama.cpp engine only: libelizainference.so (ASR as an mtmd
 * audio-LLM pair, Kokoro-82M TTS, Silero VAD) and the relocated libelizavoicejni.so that the
 * embedding host already qualifies. No other inference runtime or model format is involved.
 *
 * <p>One native context per engine over a speech-only bundle (no text/ directory, so no text model
 * can load); separate from BgeEmbeddingSession and the bionic inference host. All native calls are
 * serialized by one process-wide lock. Callers serialize use on a worker thread and never call
 * this on the Android main thread.
 *
 * <p>Cancellation limits of the pinned JNI (ABI v16): Kokoro synthesis cannot be interrupted inside
 * a phrase, so cancellation is checked between phrases; ASR cannot be interrupted at all, so a
 * cancelled transcription is discarded when the native call returns.
 */
final class AlphaFusedSpeech implements AutoCloseable {
 static final String PROVIDER="libelizainference-cpu";
 static final int ABI_MIN=16;
 /** Silero P(speech) below this in every 32 ms window means no speech: nothing is transcribed. */
 static final float NO_SPEECH_THRESHOLD=0.5f;
 static final int VAD_WINDOW=512,ASR_RATE=16000;
 static final float KOKORO_SPEED=1.0f;
 private static final Object NATIVE=new Object();
 private final AlphaFusedSpeechAssets.Bundle bundle;
 private final int abi;
 private long context;
 private AlphaKokoroG2p g2p;
 private boolean closed;

 /** Capability snapshot reported to the renderer; carries no audio or text. */
 static final class Status {
  final int abi;final boolean asr,tts,vad;
  Status(int abi,boolean asr,boolean tts,boolean vad){this.abi=abi;this.asr=asr;this.tts=tts;this.vad=vad;}
  /** Recognition readiness (the device dictation route also reads its transcript aloud). */
  boolean ready(){return asr&&tts&&vad;}
  /** Read-aloud readiness on its own: Kokoro and the lexicon. It never depends on the ASR pair. */
  boolean playback(){return tts;}
 }
 static final class Audio {
  final float[] samples;final int sampleRate;
  Audio(float[] samples,int sampleRate){this.samples=samples;this.sampleRate=sampleRate;}
  byte[] wav(){return AlphaSpeechText.wav(samples,sampleRate);}
 }

 /** Loads the native pair, checks the ABI and opens a metadata-only context; no weights load here. */
 AlphaFusedSpeech(AlphaFusedSpeechAssets.Bundle bundle)throws IOException{
  this.bundle=bundle;
  if(!ElizaVoiceNative.ensureLoaded())throw new IOException("On-device speech engine is not packaged");
  synchronized(NATIVE){
   abi=parseAbi(ElizaVoiceNative.nativeVoiceAbiVersion());
   if(abi<ABI_MIN)throw new IOException("On-device speech engine ABI "+abi+" is older than "+ABI_MIN);
   long handle=ElizaVoiceNative.nativeContextCreateUtf8(bundle.directory.getAbsolutePath().getBytes(StandardCharsets.UTF_8));
   if(handle==0)throw new IOException("On-device speech context unavailable");
   context=handle;
  }
 }
 static int parseAbi(String value){try{return value==null?-1:Integer.parseInt(value.trim());}catch(NumberFormatException error){return -1;}}
 synchronized Status status(){
  check();
  boolean vad;synchronized(NATIVE){vad=bundle.has("vad-model")&&ElizaVoiceNative.nativeVadSupported()==1;}
  return new Status(abi,bundle.has("asr-model")&&bundle.has("asr-mmproj"),bundle.has("tts-model")&&bundle.has("tts-voice")&&bundle.has("lexicon"),vad);
 }

 /** Mono 16 kHz PCM in [-1, 1], 0.1 to 30 seconds. Returns "" when VAD finds no speech. */
 synchronized String transcribe(float[] mono16k,BooleanSupplier cancelled){
  check();
  if(!bundle.has("asr-model")||!bundle.has("asr-mmproj"))throw new IllegalStateException("On-device transcription is not packaged in this build");
  if(mono16k==null||mono16k.length<ASR_RATE/10||mono16k.length>ASR_RATE*30)throw new IllegalArgumentException("Expected 0.1 to 30 seconds of mono 16kHz PCM");
  double energy=0;for(float sample:mono16k){if(!Float.isFinite(sample)||Math.abs(sample)>1)throw new IllegalArgumentException("Invalid PCM sample");energy+=(double)sample*sample;}
  if(energy/mono16k.length<0.000001)return ""; // Never invent a note from digital silence.
  AlphaSpeechText.current(cancelled);
  if(maxSpeechProbability(mono16k)<NO_SPEECH_THRESHOLD)return "";
  AlphaSpeechText.current(cancelled);
  String text;synchronized(NATIVE){text=ElizaVoiceNative.nativeAsrTranscribe(context,mono16k,ASR_RATE);}
  // No native ASR cancel exists: a cancelled result is discarded here, never returned.
  AlphaSpeechText.current(cancelled);
  if(text==null)throw new IllegalStateException("On-device transcription failed");
  text=text.trim();if(text.length()>16000)throw new IllegalStateException("Transcript exceeds limit");
  return text;
 }
 /** Highest Silero P(speech) over the clip; the VAD state is opened and closed per clip. */
 synchronized float maxSpeechProbability(float[] mono16k){
  check();
  if(!bundle.has("vad-model"))throw new IllegalStateException("On-device voice activity detection is not packaged in this build");
  int usable=mono16k.length-mono16k.length%VAD_WINDOW;if(usable==0)return 0f;
  float[] windows=usable==mono16k.length?mono16k:Arrays.copyOf(mono16k,usable);
  float max=0f;
  try{
   synchronized(NATIVE){
    long vad=ElizaVoiceNative.nativeVadOpen(context);if(vad==0)throw new IllegalStateException("On-device voice activity detection unavailable");
    try{float[] probabilities=ElizaVoiceNative.nativeVadProcessBatch(vad,windows);if(probabilities==null)throw new IllegalStateException("On-device voice activity detection failed");for(float p:probabilities)if(Float.isFinite(p))max=Math.max(max,p);}
    finally{ElizaVoiceNative.nativeVadClose(vad);}
   }
  }finally{if(windows!=mono16k)Arrays.fill(windows,0);}
  return max;
 }

 private AlphaKokoroG2p g2p()throws IOException{
  if(!bundle.has("tts-model")||!bundle.has("tts-voice")||!bundle.has("lexicon"))throw new IllegalStateException("On-device voice is not packaged in this build");
  if(g2p==null)g2p=new AlphaKokoroG2p(bundle.file("lexicon"));
  return g2p;
 }
 /** One Kokoro call: 1..508 IPA symbols to 24 kHz float PCM. */
 private Audio phrase(String ipa){
  AlphaSpeechText.requirePhrase(ipa);
  float[] samples;int rate;
  synchronized(NATIVE){
   samples=ElizaVoiceNative.nativeKokoroSynthesizeIpa(context,bundle.file("tts-model").getAbsolutePath(),bundle.file("tts-voice").getAbsolutePath(),ipa,KOKORO_SPEED);
   rate=ElizaVoiceNative.nativeKokoroSampleRate(context);
  }
  if(samples==null||samples.length==0)throw new IllegalStateException("No local audio");
  if(rate<8000||rate>48000){Arrays.fill(samples,0);throw new IllegalStateException("Invalid local audio rate");}
  return new Audio(samples,rate);
 }
 /** Short text (1..500 characters) to one validated clip. Cancellation is checked between phrases. */
 synchronized Audio synthesize(String text,BooleanSupplier cancelled)throws IOException{
  check();AlphaSpeechText.current(cancelled);
  List<String> phrases=g2p().phrases(AlphaSpeechText.requireShort(text));
  List<Audio> parts=new ArrayList<>();int total=0,rate=0;boolean accepted=false;
  try{
   for(String ipa:phrases){AlphaSpeechText.current(cancelled);Audio part=phrase(ipa);parts.add(part);if(rate!=0&&rate!=part.sampleRate)throw new IllegalStateException("Local audio rate changed");rate=part.sampleRate;total+=part.samples.length;if(total>rate*90)throw new IllegalStateException("Invalid generated audio duration");}
   AlphaSpeechText.current(cancelled);
   if(total<rate/10)throw new IllegalStateException("Invalid generated audio duration");
   float[] samples=new float[total];int offset=0;double energy=0;
   for(Audio part:parts){System.arraycopy(part.samples,0,samples,offset,part.samples.length);offset+=part.samples.length;}
   for(float sample:samples){if(!Float.isFinite(sample)){Arrays.fill(samples,0);throw new IllegalStateException("Invalid generated audio");}energy+=(double)sample*sample;}
   if(energy/samples.length<0.000001){Arrays.fill(samples,0);throw new IllegalStateException("Generated audio was silent");}
   accepted=true;return new Audio(samples,rate);
  }finally{for(Audio part:parts)Arrays.fill(part.samples,0);if(!accepted&&cancelled!=null&&cancelled.getAsBoolean())throw new CancellationException("Speech cancelled");}
 }
 /** Reviewed passage (1..5000 characters): every chunk is phonemized before any audio is made. */
 synchronized byte[] synthesizePassage(String text,BooleanSupplier cancelled)throws IOException{
  check();
  List<String> phrases=new ArrayList<>();AlphaKokoroG2p frontEnd=g2p();
  for(String chunk:AlphaSpeechText.plan(text)){AlphaSpeechText.current(cancelled);phrases.addAll(frontEnd.phrases(chunk));}
  try(AlphaSpeechText.PcmBuffer pcm=new AlphaSpeechText.PcmBuffer(32L*1024*1024)){
   for(String ipa:phrases){AlphaSpeechText.current(cancelled);Audio part=phrase(ipa);try{AlphaSpeechText.current(cancelled);pcm.append(part.samples,part.sampleRate);}finally{Arrays.fill(part.samples,0);}}
   AlphaSpeechText.current(cancelled);return pcm.wav();
  }
 }
 private void check(){if(closed)throw new IllegalStateException("Speech engine closed");}
 /** Destroys the context, which drops every mmapped ASR, Kokoro and VAD weight it holds. */
 @Override public synchronized void close(){
  if(closed)return;closed=true;
  if(g2p!=null){g2p.clear();g2p=null;}
  synchronized(NATIVE){if(context!=0){ElizaVoiceNative.nativeContextDestroy(context);context=0;}}
 }

 /** Serialized reusable engine with explicit release; no audio, transcript or identity is stored. */
 static final class Holder implements AutoCloseable {
  interface Factory { AlphaFusedSpeech create() throws Exception; }
  interface Operation<T> { T run(AlphaFusedSpeech engine) throws Exception; }
  private final Factory factory;private AlphaFusedSpeech engine;private boolean closed;
  Holder(Factory factory){this.factory=factory;}
  synchronized <T> T use(Operation<T> operation)throws Exception{
   if(closed)throw new IllegalStateException("Speech holder closed");
   if(engine==null)engine=factory.create();
   return operation.run(engine);
  }
  synchronized void release(){AlphaFusedSpeech previous=engine;engine=null;if(previous!=null)previous.close();}
  @Override public synchronized void close(){if(closed)return;closed=true;release();}
 }
 /** The pinned engine directory used by the plugin: installs and verifies, then opens. */
 static AlphaFusedSpeech open(android.content.Context context)throws Exception{return new AlphaFusedSpeech(AlphaFusedSpeechAssets.install(context));}
 File bundleDirectory(){return bundle.directory;}
}
