package ai.elizaresearch.alphaphone;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.function.BooleanSupplier;

/**
 * Text and PCM bounds for on-device speech. Stateless; no audio, transcript or text is retained.
 *
 * <p>Provenance: the passage plan (1..5000 reviewed characters, 300-character word-boundary
 * chunks, whole-passage preflight before any audio) and the bounded PCM16 WAV assembly are
 * ported from the MIT-licensed upstream {@code ai.eliza.speech.SpeechPassage} and
 * {@code LocalSpeechEngine.readMono16kWav} at elizaOS/eliza 13c98575987a121decc45b161b0c8a4ee698554e
 * (packages/app/platforms/android/local-speech). The phrase limit is Kokoro-82M's: the fused
 * JNI ({@code nativeKokoroSynthesizeIpa}) accepts 1..508 IPA symbols per call.
 */
final class AlphaSpeechText {
 private AlphaSpeechText(){}
 /** Native Kokoro input cap (510 tokens including two padding tokens). */
 static final int KOKORO_MAX_SYMBOLS=508;
 /** Phrases are cut a little below the native cap so punctuation never pushes one over. */
 static final int PHRASE_TARGET=480;
 static final int MAX_SHORT_TEXT=500,MAX_PASSAGE=5000,PASSAGE_CHUNK=300;
 /** Short synthesis input: the same 1..500 character contract the plugin has always had. */
 static String requireShort(String text){
  if(text==null||text.trim().isEmpty()||text.length()>MAX_SHORT_TEXT||text.indexOf('\0')>=0)throw new IllegalArgumentException("Expected 1 to 500 text characters");
  return text;
 }
 /** Whole reviewed passage split at word boundaries into bounded chunks. */
 static List<String> plan(String text){
  if(text==null||text.isBlank()||text.length()>MAX_PASSAGE||text.indexOf('\0')>=0)throw new IllegalArgumentException("Expected 1 to 5000 reviewed characters");
  String remaining=text.replaceAll("\\s+"," ").trim();List<String> chunks=new ArrayList<>();
  while(remaining.length()>PASSAGE_CHUNK){int boundary=remaining.lastIndexOf(' ',PASSAGE_CHUNK);if(boundary<1)throw new IllegalArgumentException("A word is too long for local reading");chunks.add(remaining.substring(0,boundary));remaining=remaining.substring(boundary+1).trim();}
  if(!remaining.isEmpty())chunks.add(remaining);return Collections.unmodifiableList(chunks);
 }
 /** Every phrase must fit one native Kokoro call. */
 static String requirePhrase(String ipa){
  if(ipa==null||ipa.isBlank()||ipa.length()>KOKORO_MAX_SYMBOLS||ipa.codePointCount(0,ipa.length())!=ipa.length())throw new IllegalArgumentException("Phrase exceeds the on-device voice limit");
  return ipa;
 }
 static void current(BooleanSupplier cancelled){if(cancelled!=null&&cancelled.getAsBoolean())throw new CancellationException("Speech cancelled");}

 /** Bounded mono PCM16 accumulation that is zeroed on every exit. */
 static final class PcmBuffer extends ByteArrayOutputStream implements AutoCloseable {
  private final long limit;private int rate;
  PcmBuffer(long limitBytes){this.limit=limitBytes;}
  void append(float[] samples,int sampleRate){
   if(sampleRate<8000||sampleRate>48000||samples==null||samples.length==0||(rate!=0&&rate!=sampleRate)||size()+2L*samples.length>limit)throw new IllegalStateException("Local speech exceeds audio limits");
   rate=sampleRate;
   for(float value:samples){if(!Float.isFinite(value))throw new IllegalStateException("Invalid local audio");int sample=Math.round(Math.max(-1,Math.min(1,value))*32767);write(sample&255);write((sample>>>8)&255);}
  }
  int rate(){return rate;}
  byte[] wav(){if(rate==0||count==0)throw new IllegalStateException("No local audio");return wavHeader(rate,count,buf);}
  @Override public void close(){Arrays.fill(buf,(byte)0);reset();}
 }
 static byte[] wav(float[] samples,int rate){try(PcmBuffer pcm=new PcmBuffer(Integer.MAX_VALUE-64)){pcm.append(samples,rate);return pcm.wav();}}
 private static byte[] wavHeader(int rate,int length,byte[] data){
  ByteBuffer out=ByteBuffer.allocate(44+length).order(ByteOrder.LITTLE_ENDIAN);
  out.put(new byte[]{'R','I','F','F'}).putInt(36+length).put(new byte[]{'W','A','V','E','f','m','t',' '}).putInt(16).putShort((short)1).putShort((short)1).putInt(rate).putInt(rate*2).putShort((short)2).putShort((short)16).put(new byte[]{'d','a','t','a'}).putInt(length).put(data,0,length);
  return out.array();
 }

 private static byte[] readBounded(InputStream in,int limit)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] block=new byte[8192];int n;while((n=in.read(block,0,Math.min(block.length,limit-out.size())))>0)out.write(block,0,n);return out.toByteArray();}
 /** Mono 16 kHz PCM16 WAV (as AlphaVoicePcm.decode produces) to float samples; at most 30 seconds. */
 static float[] readMono16kWav(InputStream input)throws IOException{
  byte[] bytes=readBounded(input,44+16000*30*2+4096);
  try{
   if(input.read()!=-1)throw new IOException("Audio too large");ByteBuffer b=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
   if(bytes.length<44||b.getInt()!=0x46464952)throw new IOException("Expected RIFF WAV");b.getInt();if(b.getInt()!=0x45564157)throw new IOException("Expected WAVE");boolean format=false;
   while(b.remaining()>=8){int type=b.getInt(),size=b.getInt();if(size<0||size>b.remaining())throw new IOException("Truncated WAV chunk");int end=b.position()+size;
    if(type==0x20746d66){if(size<16||b.getShort()!=1||b.getShort()!=1||b.getInt()!=16000)throw new IOException("Expected mono 16k PCM");b.getInt();if(b.getShort()!=2||b.getShort()!=16)throw new IOException("Expected PCM16");format=true;}
    if(type==0x61746164){if(!format||size%2!=0||size>16000*30*2)throw new IOException("Invalid WAV data");float[] samples=new float[size/2];for(int i=0;i<samples.length;i++)samples[i]=b.getShort()/32768f;return samples;}
    b.position(Math.min(b.limit(),end+(size%2)));
   }throw new IOException("No PCM data");
  }finally{Arrays.fill(bytes,(byte)0);}
 }
}
