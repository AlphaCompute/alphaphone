package ai.eliza.speech;

import ai.eliza.voice.NativeAsr;
import ai.eliza.voice.ParadeeVoice;
import java.io.*;
import java.nio.*;
import java.util.Arrays;
import java.util.concurrent.CancellationException;
import java.util.function.BooleanSupplier;

/** Alpha's bounded audio adapter. All inference runs in the shared fused native engine. */
public final class LocalSpeechEngine implements AutoCloseable {
 private final File root;
 private volatile NativeAsr asr;
 private volatile ParadeeVoice voice;
 private boolean closed;
 public LocalSpeechEngine(File root){this.root=root;}
 private void check(){if(closed)throw new IllegalStateException("Speech engine closed");}
 private void loadVoice()throws IOException {
  if(voice==null){File dir=new File(root,"tts/paradee");voice=new ParadeeVoice(new File(dir,"paradee-8m-v1_0.gguf"),new File(dir,"misaki-en-us.lex"),new File(dir,"espeak-ng-data").isDirectory()?dir:null);}
 }
 public synchronized void prepare()throws IOException {check();loadVoice();if(asr==null)asr=new NativeAsr(root);}
 public synchronized String transcribe(float[] samples)throws IOException {
  check();if(samples==null||samples.length==0||samples.length>60*16000)throw new IllegalArgumentException("Expected at most 60 seconds of audio");
  boolean audible=false;for(float sample:samples){if(!Float.isFinite(sample))throw new IllegalArgumentException("Invalid audio");audible|=sample!=0;}
  if(!audible)return "";
  if(asr==null)asr=new NativeAsr(root);
  return asr.transcribe(samples);
 }
 public Audio synthesize(String text)throws IOException{return synthesize(text,()->false);}
 public synchronized Audio synthesize(String text,BooleanSupplier cancelled)throws IOException {
  check();if(text==null||text.trim().isEmpty()||text.length()>16000)throw new IllegalArgumentException("Expected bounded text");
  if(cancelled.getAsBoolean())throw new CancellationException();
  loadVoice();
  ParadeeVoice.Audio result=voice.synthesize(text,1.0f);
  if(cancelled.getAsBoolean()){Arrays.fill(result.samples,0);throw new CancellationException();}
  return new Audio(result.samples,result.sampleRate);
 }
 public byte[] synthesizePassage(String text,BooleanSupplier cancelled)throws IOException {
  Audio audio=synthesize(text,cancelled);try{return audio.wav();}finally{Arrays.fill(audio.samples,0);}
 }
 public void cancel(){NativeAsr input=asr;if(input!=null)input.cancel();ParadeeVoice output=voice;if(output!=null)output.cancel();}
 @Override public synchronized void close(){if(closed)return;closed=true;cancel();if(asr!=null){asr.close();asr=null;}if(voice!=null){voice.close();voice=null;}}
 public static final class Audio {
  public final float[] samples;public final int sampleRate;
  public Audio(float[] samples,int sampleRate){this.samples=samples;this.sampleRate=sampleRate;}
  public byte[] wav(){
   if(samples==null||sampleRate<8000||sampleRate>48000||samples.length==0||samples.length>60L*sampleRate)throw new IllegalArgumentException("Speech exceeds 60 seconds");
   ByteBuffer out=ByteBuffer.allocate(44+samples.length*2).order(ByteOrder.LITTLE_ENDIAN);
   out.put(new byte[]{'R','I','F','F'}).putInt(out.capacity()-8).put(new byte[]{'W','A','V','E','f','m','t',' '}).putInt(16).putShort((short)1).putShort((short)1).putInt(sampleRate).putInt(sampleRate*2).putShort((short)2).putShort((short)16).put(new byte[]{'d','a','t','a'}).putInt(samples.length*2);
   for(float sample:samples){if(!Float.isFinite(sample))throw new IllegalArgumentException("Invalid native audio");out.putShort((short)Math.round(Math.max(-1,Math.min(1,sample))*32767));}return out.array();
  }
 }
 public static float[] readMono16kWav(InputStream input)throws IOException {
  byte[] bytes=input.readNBytes(44+60*16000*2+1);
  try{
   if(bytes.length<44||bytes.length>44+60*16000*2)throw new IOException("Invalid WAV size");
   ByteBuffer in=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
   if(in.getInt(0)!=0x46464952||in.getInt(4)!=bytes.length-8||in.getInt(8)!=0x45564157)throw new IOException("Invalid WAV");
   int begin=-1,length=0;boolean format=false;
   int offset=12;for(;offset+8<=bytes.length;){int kind=in.getInt(offset),size=in.getInt(offset+4);long end=(long)offset+8+size;if(size<0||end>bytes.length)throw new IOException("Invalid WAV chunk");
    if(kind==0x20746d66){if(format||size<16||in.getShort(offset+8)!=1||in.getShort(offset+10)!=1||in.getInt(offset+12)!=16000||in.getInt(offset+16)!=32000||in.getShort(offset+20)!=2||in.getShort(offset+22)!=16)throw new IOException("Expected mono 16 kHz PCM16");format=true;}
    if(kind==0x61746164){if(begin!=-1||size%2!=0)throw new IOException("Invalid WAV data");begin=offset+8;length=size;}
    offset=(int)end+(size&1);
   }
   if(offset!=bytes.length)throw new IOException("Truncated WAV chunk");
   if(!format||begin<0||length==0)throw new IOException("Missing WAV audio");float[] samples=new float[length/2];for(int i=0;i<samples.length;i++)samples[i]=in.getShort(begin+2*i)/32768f;return samples;
  }finally{Arrays.fill(bytes,(byte)0);}
 }
}
