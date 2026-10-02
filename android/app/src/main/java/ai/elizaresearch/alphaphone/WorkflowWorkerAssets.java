package ai.elizaresearch.alphaphone;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.security.MessageDigest;
import java.util.*;

/** Extract the signed APK's bounded worker index before starting any worker. */
final class WorkflowWorkerAssets {
 interface Source { InputStream open(String path) throws IOException; }
 private static final long MAX_BYTES=64L*1024*1024;
 private static final int MAX_INDEX=1024*1024;
 private static String hex(byte[] bytes){StringBuilder result=new StringBuilder();for(byte value:bytes)result.append(String.format(Locale.ROOT,"%02x",value&255));return result.toString();}
 private static MessageDigest digest() throws IOException {try{return MessageDigest.getInstance("SHA-256");}catch(Exception error){throw new IOException("SHA-256 unavailable",error);}}
 private static byte[] bounded(InputStream input) throws IOException {
  ByteArrayOutputStream result=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int read;
  while((read=input.read(buffer))!=-1){if(read==0){int one=input.read();if(one<0)break;result.write(one);}else result.write(buffer,0,read);if(result.size()>MAX_INDEX)throw new IOException("Worker index too large");}
  return result.toByteArray();
 }
 static synchronized File install(File root, InputStream indexStream, Source source) throws IOException {
  byte[] index;try(InputStream input=indexStream){index=bounded(input);}
  LinkedHashMap<String,String> entries=new LinkedHashMap<>();
  for(String line:new String(index,StandardCharsets.UTF_8).split("\n")){
   if(line.isEmpty())continue;String[] fields=line.split("\t",-1);
   if(fields.length!=2||!fields[0].matches("[a-f0-9]{64}")||!fields[1].matches("[A-Za-z0-9@_.+/-]+"))throw new IOException("Invalid worker index entry");
   for(String part:fields[1].split("/",-1))if(part.isEmpty()||part.equals(".")||part.equals(".."))throw new IOException("Invalid worker path");
   if(fields[1].equals("files.sha256")||entries.put(fields[1],fields[0])!=null||entries.size()>4096)throw new IOException("Duplicate or excessive worker entries");
  }
  for(String required:new String[]{"manifest.json","dependencies.json","node_modules/smthrs/package.json","node_modules/zod/package.json","node_modules/effect/package.json","node_modules/@smthrs/engine/package.json"})if(!entries.containsKey(required))throw new IOException("Missing worker dependency");
  File canonical=root.getCanonicalFile();if(!canonical.isDirectory())throw new IOException("Missing agent resource directory");
  File target=new File(canonical,"workflow-worker"),staging=new File(canonical,".workflow-worker-"+UUID.randomUUID()),backup=new File(canonical,".workflow-worker-old-"+UUID.randomUUID());
  if(Files.isSymbolicLink(target.toPath()))throw new IOException("Worker resource directory is a symlink");
  if(!staging.mkdir())throw new IOException("Could not create worker staging directory");
  boolean moved=false;
  try {
   long total=0;
   for(Map.Entry<String,String> entry:entries.entrySet()){
    File output=new File(staging,entry.getKey());
    if(!output.getCanonicalPath().startsWith(staging.getCanonicalPath()+File.separator))throw new IOException("Worker path escaped staging");
    File parent=output.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Could not create worker package directory");
    MessageDigest hash=digest();byte[] buffer=new byte[8192];
    try(InputStream input=source.open(entry.getKey());OutputStream stream=new FileOutputStream(output)){
     int count;while((count=input.read(buffer))!=-1){if(count==0){int one=input.read();if(one<0)break;buffer[0]=(byte)one;count=1;}total+=count;if(total>MAX_BYTES)throw new IOException("Worker payload too large");hash.update(buffer,0,count);stream.write(buffer,0,count);}
    }
    if(!hex(hash.digest()).equals(entry.getValue()))throw new IOException("Worker payload hash mismatch");
   }
   try(OutputStream stream=new FileOutputStream(new File(staging,"files.sha256"))){stream.write(index);}
   if(target.exists()){if(!target.renameTo(backup))throw new IOException("Could not preserve previous worker artifact");moved=true;}
   if(!staging.renameTo(target)){
    if(moved&&!backup.renameTo(target))throw new IOException("Worker installation failed; prior artifact retained at "+backup.getName());
    throw new IOException("Could not install worker artifact");
   }
   if(moved)remove(backup);
   return target;
  }finally{remove(staging);}
 }
 private static void remove(File file) throws IOException {
  if(Files.isDirectory(file.toPath(),LinkOption.NOFOLLOW_LINKS)){File[] children=file.listFiles();if(children==null)throw new IOException("Cannot list worker staging directory");for(File child:children)remove(child);}
  if(Files.exists(file.toPath(),LinkOption.NOFOLLOW_LINKS)&&!file.delete())throw new IOException("Cannot remove worker staging entry");
 }
}
