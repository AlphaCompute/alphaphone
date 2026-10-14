import ai.eliza.speech.LocalSpeechEngine;
import java.io.*;
import java.nio.*;
import java.util.Arrays;
public final class AudioTest {
 static void reject(byte[] bytes)throws Exception {try{LocalSpeechEngine.readMono16kWav(new ByteArrayInputStream(bytes));throw new AssertionError("Malformed WAV accepted");}catch(IOException expected){}}
 public static void main(String[] args)throws Exception {
  float[] original={-1,-.5f,0,.5f,1};byte[] wav=new LocalSpeechEngine.Audio(original,16000).wav();
  float[] decoded=LocalSpeechEngine.readMono16kWav(new ByteArrayInputStream(wav));
  if(decoded.length!=original.length)throw new AssertionError();
  for(int i=0;i<decoded.length;i++)if(Math.abs(decoded[i]-original[i])>0.0001)throw new AssertionError("PCM roundtrip");
  byte[] stereo=wav.clone();ByteBuffer.wrap(stereo).order(ByteOrder.LITTLE_ENDIAN).putShort(22,(short)2);reject(stereo);
  byte[] wrongRate=wav.clone();ByteBuffer.wrap(wrongRate).order(ByteOrder.LITTLE_ENDIAN).putInt(24,48000);reject(wrongRate);
  reject(Arrays.copyOf(wav,wav.length-1));
  byte[] tail=Arrays.copyOf(wav,wav.length+1);ByteBuffer.wrap(tail).order(ByteOrder.LITTLE_ENDIAN).putInt(4,tail.length-8);reject(tail);
  byte[] overflow=wav.clone();ByteBuffer.wrap(overflow).order(ByteOrder.LITTLE_ENDIAN).putInt(40,Integer.MAX_VALUE);reject(overflow);
  try{new LocalSpeechEngine.Audio(new float[]{Float.NaN},16000).wav();throw new AssertionError();}catch(IllegalArgumentException expected){}
  System.out.println("PASS PCM roundtrip and malformed WAV rejection");
 }
}
