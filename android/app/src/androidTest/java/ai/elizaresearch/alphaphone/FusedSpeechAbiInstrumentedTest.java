package ai.elizaresearch.alphaphone;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * The fused voice ABI as packaged: every JNI method the speech engine calls is declared on the
 * relocated ElizaVoiceNative, the native pair loads, reports ABI v16 or later and VAD support, and a
 * metadata-only context opens and closes over an empty bundle. Also the Java Kokoro front end over a
 * small synthetic lexicon. Opt-in with -e fusedSpeechAbi 1. Symbol presence is not capability:
 * nothing here runs ASR or Kokoro inference.
 */
@RunWith(AndroidJUnit4.class)
public final class FusedSpeechAbiInstrumentedTest {
 /** Mirrors VOICE_JNI_METHODS in scripts/stage-embedding-host.mjs. */
 static final List<String> JNI_METHODS=Arrays.asList("nativeContextCreateUtf8","nativeContextDestroy","nativeVoiceAbiVersion","nativeAsrTranscribe","nativeKokoroSynthesizeIpa","nativeKokoroSampleRate","nativeVadSupported","nativeVadOpen","nativeVadProcessBatch","nativeVadReset","nativeVadClose");
 private static void gate(){Assume.assumeTrue("Opt-in fused voice ABI probe","1".equals(InstrumentationRegistry.getArguments().getString("fusedSpeechAbi")));}
 private static Context app(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}

 @Test public void relocatedJniDeclaresEveryVoiceMethod(){
  gate();
  for(String name:JNI_METHODS){
   Method found=null;for(Method method:ElizaVoiceNative.class.getDeclaredMethods())if(method.getName().equals(name))found=method;
   assertNotNull("ElizaVoiceNative declares "+name,found);assertTrue(name+" is native",Modifier.isNative(found.getModifiers()));
  }
 }

 @Test public void nativePairLoadsWithVoiceAbiAndOpensSpeechOnlyContext()throws Exception{
  gate();
  assertTrue("libelizainference.so and libelizavoicejni.so load: "+ElizaVoiceNative.getLoadError(),ElizaVoiceNative.ensureLoaded());
  int abi=AlphaFusedSpeech.parseAbi(ElizaVoiceNative.nativeVoiceAbiVersion());
  assertTrue("Fused voice ABI "+abi+" is at least "+AlphaFusedSpeech.ABI_MIN,abi>=AlphaFusedSpeech.ABI_MIN);
  assertEquals("Silero VAD is built into this engine",1,ElizaVoiceNative.nativeVadSupported());
  File empty=new File(app().getCacheDir(),"fused-abi-"+java.util.UUID.randomUUID());assertTrue(empty.mkdirs());
  try{
   long context=ElizaVoiceNative.nativeContextCreateUtf8(empty.getAbsolutePath().getBytes(StandardCharsets.UTF_8));
   assertNotEquals("Metadata-only context opens without loading weights",0,context);
   ElizaVoiceNative.nativeContextDestroy(context);
  }finally{empty.delete();}
 }

 private static File lexicon(String text)throws IOException{File file=File.createTempFile("g2p-",".tsv",app().getCacheDir());try(FileOutputStream out=new FileOutputStream(file)){out.write(text.getBytes(StandardCharsets.UTF_8));}return file;}

 @Test public void javaKokoroFrontEndIsBoundedAndFailsClosed()throws Exception{
  gate();
  File file=lexicon("dog\tdˈɔɡ\nfour\tfˈɔɹ\nforty\tfˈɔɹti\nthe\tðə\ntwo\ttˈu\n");
  try{
   AlphaKokoroG2p g2p=new AlphaKokoroG2p(file);
   assertEquals(5,g2p.entries());assertEquals("dˈɔɡ",g2p.lookup("dog"));assertNull(g2p.lookup("cat"));
   assertEquals(Arrays.asList("forty","two"),AlphaKokoroG2p.numberWords("42"));
   assertEquals(Arrays.asList("one","million","two","hundred","thousand","seven"),AlphaKokoroG2p.numberWords("1200007"));
   assertEquals(Arrays.asList("zero","seven"),AlphaKokoroG2p.numberWords("07"));
   assertEquals(Arrays.asList("ðə dˈɔɡ.","fˈɔɹti tˈu!"),g2p.phrases("The dog. 42!"));
   assertEquals("Unknown words are spelled",Arrays.asList("sˈi ˈA tˈi"),g2p.phrases("cat"));
   try{g2p.phrases("Read https://example.com");fail("URL symbols must not disappear");}catch(IllegalArgumentException expected){}
   StringBuilder longText=new StringBuilder();for(int i=0;i<300;i++)longText.append("the dog ");
   for(String phrase:g2p.phrases(longText.toString()))assertTrue("Each phrase fits one Kokoro call",phrase.length()<=AlphaSpeechText.KOKORO_MAX_SYMBOLS);
  }finally{file.delete();}
  File unsorted=lexicon("dog\td\nant\tænt\n");
  try{new AlphaKokoroG2p(unsorted);fail("An unsorted lexicon is refused");}catch(IOException expected){}finally{unsorted.delete();}
 }
}
