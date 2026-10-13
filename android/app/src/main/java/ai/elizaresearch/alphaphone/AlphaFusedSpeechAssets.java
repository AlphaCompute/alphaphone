package ai.elizaresearch.alphaphone;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Installs the APK's pinned on-device voice bundle (assets/voice/v1, staged by
 * scripts/android-stage-voice-models.mjs and admitted at build time against
 * android/voice-host/qualified-voice-host.json) into noBackupFilesDir/voice/v1.
 *
 * <p>Accepts no URL, download or caller-selected path. Every file is checked by size and SHA-256;
 * symlinks are refused anywhere in the bundle. The bundle never contains a text model: on-device
 * text inference is out of scope (text inference runs on Cerebras).
 */
final class AlphaFusedSpeechAssets {
 private AlphaFusedSpeechAssets(){}
 static final String ASSET_ROOT="voice/v1";
 static final String FORMAT="alpha-voice-bundle-v1";
 static final Set<String> ROLES=Collections.unmodifiableSet(new HashSet<>(java.util.Arrays.asList("asr-model","asr-mmproj","tts-model","tts-voice","vad-model","lexicon")));
 private static final java.util.regex.Pattern PATH=java.util.regex.Pattern.compile("(?:asr|tts/kokoro|vad|g2p)/[a-z0-9][a-z0-9_.-]{0,95}");
 /** Manifest digests whose installed bytes this process already hashed in full. */
 private static final Set<String> VERIFIED=new HashSet<>();

 /** An installed, verified bundle. {@code files} maps each role to its file. */
 static final class Bundle {
  final File directory;final Map<String,File> files;final String manifestSha256;
  Bundle(File directory,Map<String,File> files,String manifestSha256){this.directory=directory;this.files=Collections.unmodifiableMap(files);this.manifestSha256=manifestSha256;}
  File file(String role){return files.get(role);}
  boolean has(String role){return files.containsKey(role);}
 }

 /** True when this APK carries a voice bundle manifest at all. */
 static boolean packaged(Context context){try(InputStream ignored=context.getAssets().open(ASSET_ROOT+"/manifest.json")){return true;}catch(IOException absent){return false;}}

 static synchronized Bundle install(Context context)throws Exception{
  byte[] manifestBytes;
  try(InputStream in=context.getAssets().open(ASSET_ROOT+"/manifest.json")){manifestBytes=readBounded(in,65536);}
  catch(java.io.FileNotFoundException absent){throw new IOException("On-device voice is not packaged in this build");}
  String manifestSha=hex(MessageDigest.getInstance("SHA-256").digest(manifestBytes));
  JSONObject manifest=new JSONObject(new String(manifestBytes,StandardCharsets.UTF_8));
  if(!FORMAT.equals(manifest.getString("format")))throw new IOException("Unsupported voice bundle");
  File root=context.getNoBackupFilesDir();
  File directory=new File(new File(root,"voice"),"v1");
  refuseLinks(root,directory);
  if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Voice storage unavailable");
  refuseLinks(root,directory);
  JSONArray entries=manifest.getJSONArray("files");Map<String,File> files=new HashMap<>();Set<String> paths=new HashSet<>();
  boolean trusted;synchronized(VERIFIED){trusted=VERIFIED.contains(manifestSha);}
  for(int i=0;i<entries.length();i++){
   JSONObject entry=entries.getJSONObject(i);String name=entry.getString("path"),role=entry.getString("role"),sha=entry.getString("sha256");long bytes=entry.getLong("bytes");
   if(!PATH.matcher(name).matches()||name.contains("..")||!ROLES.contains(role)||!sha.matches("[a-f0-9]{64}")||bytes<=0||!paths.add(name)||files.containsKey(role))throw new IOException("Invalid voice bundle manifest");
   File target=new File(directory,name);
   if(!target.getCanonicalPath().startsWith(directory.getCanonicalPath()+File.separator))throw new IOException("Invalid voice bundle path");
   refuseLinks(directory,target);
   boolean present=target.isFile()&&target.length()==bytes;
   if(present&&(trusted||sha256(target).equals(sha))){files.put(role,target);continue;}
   File parent=target.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Voice storage unavailable");refuseLinks(directory,parent);
   File temp=new File(target.getPath()+".partial");if(temp.exists()&&!temp.delete())throw new IOException("Voice storage unavailable");
   MessageDigest digest=MessageDigest.getInstance("SHA-256");
   try(InputStream in=context.getAssets().open(ASSET_ROOT+"/"+name);OutputStream out=new FileOutputStream(temp)){byte[] b=new byte[65536];long total=0;int n;while((n=in.read(b))!=-1){total+=n;if(total>bytes)throw new IOException("Voice asset exceeds manifest size");digest.update(b,0,n);out.write(b,0,n);}}
   catch(Exception error){temp.delete();throw error;}
   if(temp.length()!=bytes||!hex(digest.digest()).equals(sha)){temp.delete();throw new IOException("Voice asset checksum mismatch");}
   if(!temp.renameTo(target)){temp.delete();throw new IOException("Voice asset installation failed");}
   files.put(role,target);
  }
  removeStale(directory,paths);
  synchronized(VERIFIED){VERIFIED.add(manifestSha);}
  return new Bundle(directory,files,manifestSha);
 }
 /** Older bundle files (another model version) are removed so they cannot be loaded or waste space. */
 private static void removeStale(File directory,Set<String> keep)throws IOException{
  String base=directory.getCanonicalPath()+File.separator;
  java.util.ArrayDeque<File> pending=new java.util.ArrayDeque<>();pending.add(directory);
  while(!pending.isEmpty()){File current=pending.pop();File[] children=current.listFiles();if(children==null)continue;
   for(File child:children){
    if(Files.isSymbolicLink(child.toPath())){if(!child.delete())throw new IOException("Voice storage contains a link");continue;}
    if(child.isDirectory()){pending.add(child);continue;}
    String relative=child.getCanonicalPath().substring(base.length()).replace(File.separatorChar,'/');
    if(!keep.contains(relative))child.delete();
   }}
 }
 private static void refuseLinks(File root,File target)throws IOException{
  for(File current=target;current!=null;current=current.getParentFile()){
   if(Files.isSymbolicLink(current.toPath()))throw new IOException("Voice storage must not contain links");
   if(current.equals(root))return;
  }
 }
 private static byte[] readBounded(InputStream in,int limit)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] block=new byte[8192];int n;while((n=in.read(block))!=-1){if(out.size()+n>limit)throw new IOException("Voice manifest too large");out.write(block,0,n);}return out.toByteArray();}
 static String sha256(File file)throws Exception{MessageDigest digest=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(file)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)digest.update(b,0,n);}return hex(digest.digest());}
 private static String hex(byte[] bytes){StringBuilder out=new StringBuilder();for(byte value:bytes)out.append(String.format(Locale.ROOT,"%02x",value&255));return out.toString();}
}
