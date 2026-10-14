package ai.elizaresearch.alphaphone;

import android.content.Context;
import ai.eliza.voice.NativeAsr;
import ai.eliza.voice.ParadeeVoice;
import ai.eliza.voice.VoiceAssets;
import java.util.Arrays;
import java.util.concurrent.CancellationException;
import java.util.function.BooleanSupplier;

/** Product lifecycle adapter over the shared on-device ASR and Paradee engine. */
final class AlphaParadeeSpeech implements AlphaLocalSpeechEngine.Backend {
 private final NativeAsr asr;
 private final ParadeeVoice voice;
 AlphaParadeeSpeech(Context context)throws Exception{
  exportAsrBackend();
  VoiceAssets.Bundle bundle=VoiceAssets.install(context);
  ParadeeVoice opened=bundle.openVoice();
  try{asr=bundle.openAsr();voice=opened;}catch(Exception|Error error){opened.close();throw error;}
 }
 /**
  * libelizainference reads ELIZA_ASR_BACKEND when it maps the "asr" region. The APK bundle carries
  * only Phonon-2, so the build default is parakeet (BuildConfig); an existing process value wins,
  * as in the pinned ElizaAsrNativeEnv.
  */
 static void exportAsrBackend(){
  String backend=BuildConfig.ELIZA_ASR_BACKEND;
  if(backend==null||backend.isEmpty())return;
  try{android.system.Os.setenv("ELIZA_ASR_BACKEND",backend,false);}catch(android.system.ErrnoException unavailable){/* The library then picks from the bundle, which holds Phonon-2 only. */}
 }
 public String transcribe(float[] samples){
  if(samples==null||samples.length<1600||samples.length>16000*60)throw new IllegalArgumentException("Expected 0.1 to 60 seconds of audio");
  double energy=0;for(float sample:samples){if(!Float.isFinite(sample)||Math.abs(sample)>1)throw new IllegalArgumentException("Invalid PCM");energy+=(double)sample*sample;}
  if(energy/samples.length<0.000001)return "";
  String text=asr.transcribe(samples);if(text==null||text.length()>16000)throw new IllegalStateException("Invalid transcription");return text.trim();
 }
 public AlphaLocalSpeechEngine.Audio synthesize(String text){return synthesize(text,()->false);}
 public AlphaLocalSpeechEngine.Audio synthesize(String text,BooleanSupplier cancelled){
  if(text==null||text.isBlank()||text.length()>5000||text.indexOf('\0')>=0)throw new IllegalArgumentException("Invalid reviewed speech text");
  if(cancelled.getAsBoolean())throw new CancellationException();
  ParadeeVoice.Audio audio=voice.synthesize(text,1f);boolean accepted=false;
  try{
   if(cancelled.getAsBoolean())throw new CancellationException();
   if(audio.sampleRate!=24000||audio.samples.length<2400||audio.samples.length>(8*1024*1024-44)/2)throw new IllegalStateException("Invalid speech output");
   double energy=0;for(float sample:audio.samples){if(!Float.isFinite(sample))throw new IllegalStateException("Invalid speech output");energy+=(double)sample*sample;}
   if(energy/audio.samples.length<0.000001)throw new IllegalStateException("Speech output is silent");
   accepted=true;return new AlphaLocalSpeechEngine.Audio(audio.samples,audio.sampleRate);
  }finally{if(!accepted)Arrays.fill(audio.samples,0);}
 }
 public void cancel(){try{asr.cancel();}finally{voice.cancel();}}
 public void close(){try{asr.close();}finally{voice.close();}}
}
