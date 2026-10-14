package ai.elizaresearch.alphaphone;

import ai.eliza.voice.VoiceAssets;
import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.NoiseSuppressor;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.util.ArrayDeque;

/**
 * Live voice capture in the app process: 16 kHz mono PCM from the microphone, Silero VAD on every
 * 32 ms window through libelizainference (the pinned ElizaVoiceNative bridge), and the frames of
 * each speech segment with its edges handed to the renderer, which forwards them to the resident
 * agent's on-device live ASR route. Audio outside a segment (beyond the short pre-roll) is never
 * forwarded, and nothing is written to storage. One capture runs at a time.
 *
 * <p>The voice assistant listens while it speaks (barge-in), so it asks for echo cancellation:
 * the communication source with the platform AcousticEchoCanceler (and NoiseSuppressor) when the
 * device has one ({@link LiveCaptureSource}). Dictation keeps the unprocessed recognition source.
 * Stopping flushes the frames of an open segment that were read before the stop, so a transcript
 * holds the audio up to the stop; nothing read after it is forwarded.
 */
final class AlphaLiveVoiceCapture {
 interface Sink {
  /** frames: AudioFrameEvent[] (base64 LE s16), vad: [{type,timestampMs}], peak in [0,1]. */
  void frames(String captureId,JSArray frames,JSArray vad,float peak);
  void ended(String captureId,String error);
 }
 static final int SAMPLE_RATE=16000;
 private static final int EMIT_WINDOWS=3; // about 96 ms per renderer event
 private static long nativeContext; // Guarded by AlphaLiveVoiceCapture.class; the VAD region only.

 /** Silero VAD is usable in this process: the bridge loads, VAD is compiled in and the bundle has its model. */
 static synchronized boolean vadAvailable(Context context){
  try{long vad=openVad(context);ElizaVoiceNative.nativeVadClose(vad);return true;}catch(Exception|Error unavailable){return false;}
 }
 private static synchronized long openVad(Context context)throws Exception{
  if(!ElizaVoiceNative.ensureLoaded())throw new IllegalStateException("Voice bridge unavailable");
  if(ElizaVoiceNative.nativeVadSupported()!=1)throw new IllegalStateException("VAD unavailable");
  if(nativeContext==0){VoiceAssets.Bundle bundle=VoiceAssets.install(context);nativeContext=ElizaVoiceNative.nativeContextCreate(bundle.root.getAbsolutePath());}
  if(nativeContext==0)throw new IllegalStateException("Voice context unavailable");
  long vad=ElizaVoiceNative.nativeVadOpen(nativeContext);
  if(vad==0)throw new IllegalStateException("VAD unavailable");
  return vad;
 }

 private final Context context;
 private final String captureId;
 private final Sink sink;
 private final boolean echoCancel;
 private volatile boolean running;
 private volatile boolean echoCancelled;
 private Thread thread;
 private long startedAt;

 AlphaLiveVoiceCapture(Context context,String captureId,Sink sink){this(context,captureId,sink,false);}
 AlphaLiveVoiceCapture(Context context,String captureId,Sink sink,boolean echoCancel){this.context=context.getApplicationContext();this.captureId=captureId;this.sink=sink;this.echoCancel=echoCancel;}
 String captureId(){return captureId;}
 /** The platform echo canceller is attached and enabled on this capture (full duplex is safe). */
 boolean echoCancelled(){return echoCancelled;}

 synchronized void start()throws Exception{
  if(thread!=null)throw new IllegalStateException("Live capture already started");
  long vad=openVad(context);
  int minimum=AudioRecord.getMinBufferSize(SAMPLE_RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
  AudioRecord recorder;
  int source=LiveCaptureSource.select(echoCancel,AcousticEchoCanceler.isAvailable(),MediaRecorder.AudioSource.VOICE_RECOGNITION,MediaRecorder.AudioSource.VOICE_COMMUNICATION);
  try{recorder=new AudioRecord(source,SAMPLE_RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(minimum,LiveVadGate.WINDOW*2*16));}
  catch(SecurityException|IllegalArgumentException error){ElizaVoiceNative.nativeVadClose(vad);throw error;}
  if(recorder.getState()!=AudioRecord.STATE_INITIALIZED){recorder.release();ElizaVoiceNative.nativeVadClose(vad);throw new IllegalStateException("Microphone unavailable");}
  AcousticEchoCanceler echo=null;NoiseSuppressor noise=null;
  if(source==MediaRecorder.AudioSource.VOICE_COMMUNICATION){
   try{echo=AcousticEchoCanceler.create(recorder.getAudioSessionId());if(echo!=null&&(echo.setEnabled(true)!=AudioEffect.SUCCESS||!echo.getEnabled())){echo.release();echo=null;}}catch(RuntimeException unavailable){echo=null;}
   try{if(NoiseSuppressor.isAvailable()){noise=NoiseSuppressor.create(recorder.getAudioSessionId());if(noise!=null)noise.setEnabled(true);}}catch(RuntimeException unavailable){noise=null;}
  }
  try{recorder.startRecording();}catch(RuntimeException error){release(echo,noise);recorder.release();ElizaVoiceNative.nativeVadClose(vad);throw error;}
  running=true;startedAt=System.currentTimeMillis();echoCancelled=echo!=null;
  final AcousticEchoCanceler effectEcho=echo;final NoiseSuppressor effectNoise=noise;
  thread=new Thread(()->{try{loop(recorder,vad);}finally{release(effectEcho,effectNoise);}},"alpha-live-voice");
  thread.start();
 }

 private static void release(AcousticEchoCanceler echo,NoiseSuppressor noise){
  if(echo!=null)try{echo.release();}catch(RuntimeException ignored){}
  if(noise!=null)try{noise.release();}catch(RuntimeException ignored){}
 }

 /** Stops capture; returns the capture duration. The renderer closes an open segment itself. */
 long stop(){
  Thread active;synchronized(this){running=false;active=thread;}
  if(active!=null&&active!=Thread.currentThread()){try{active.join(1500);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();}}
  return Math.max(0,System.currentTimeMillis()-startedAt);
 }

 private void loop(AudioRecord recorder,long vad){
  String error=null;
  LiveVadGate gate=new LiveVadGate();
  ArrayDeque<JSObject> preroll=new ArrayDeque<>();
  JSArray frames=new JSArray(),edges=new JSArray();
  short[] window=new short[LiveVadGate.WINDOW];
  float[] pcm=new float[LiveVadGate.WINDOW];
  byte[] bytes=new byte[LiveVadGate.WINDOW*2];
  int windows=0;float peak=0f;
  // Frames are stamped with the end of their audio on the capture clock (start + samples read), not
  // with when the read returned: a reader running behind its buffer still stamps audio captured
  // before a stop as before the stop.
  final long origin=startedAt;long samplesRead=0;
  try{
   ElizaVoiceNative.nativeVadReset(vad);
   while(running){
    int filled=0;
    while(filled<window.length&&running){int read=recorder.read(window,filled,window.length-filled);if(read<0)throw new IllegalStateException("Microphone read failed");filled+=read;}
    if(!running)break;
    samplesRead+=window.length;
    long at=origin+samplesRead*1000/SAMPLE_RATE;
    for(int i=0;i<window.length;i++){short sample=window[i];pcm[i]=sample/32768f;bytes[i*2]=(byte)(sample&0xff);bytes[i*2+1]=(byte)((sample>>8)&0xff);peak=Math.max(peak,Math.abs(pcm[i]));}
    float[] probability=ElizaVoiceNative.nativeVadProcessBatch(vad,pcm);
    JSObject frame=new JSObject();
    frame.put("pcm16",Base64.encodeToString(bytes,Base64.NO_WRAP));frame.put("sampleRate",SAMPLE_RATE);frame.put("channels",1);frame.put("samples",window.length);frame.put("timestamp",at);
    LiveVadGate.Edge edge=gate.accept(probability!=null&&probability.length>0?probability[0]:0f);
    if(edge==LiveVadGate.Edge.SPEECH_START){
     edges.put(new JSObject().put("type","speech-start").put("timestampMs",at-(long)(LiveVadGate.START_WINDOWS-1)*32));
     while(!preroll.isEmpty())frames.put(preroll.removeFirst());
     frames.put(frame);
    }else if(gate.speaking()){frames.put(frame);}
    else if(edge==LiveVadGate.Edge.SPEECH_END){frames.put(frame);edges.put(new JSObject().put("type","speech-end").put("timestampMs",at));}
    else{preroll.addLast(frame);while(preroll.size()>LiveVadGate.PREROLL_WINDOWS)preroll.removeFirst();}
    if(++windows>=EMIT_WINDOWS||edges.length()>0){
     sink.frames(captureId,frames,edges,Math.min(1f,peak));
     frames=new JSArray();edges=new JSArray();windows=0;peak=0f;
    }
   }
   // Frames of an open segment read before the stop still belong to the utterance.
   if(frames.length()>0||edges.length()>0)sink.frames(captureId,frames,edges,Math.min(1f,peak));
  }catch(Exception|Error failure){error="capture";}
  finally{
   try{recorder.stop();}catch(RuntimeException ignored){}
   recorder.release();
   ElizaVoiceNative.nativeVadClose(vad);
   java.util.Arrays.fill(bytes,(byte)0);java.util.Arrays.fill(window,(short)0);java.util.Arrays.fill(pcm,0f);
   preroll.clear();
   sink.ended(captureId,error);
  }
 }
}
