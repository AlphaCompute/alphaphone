import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('local embedding policy requires complete packaged host and model, preserving Cloud text and speech',()=>{
 const source=fs.readFileSync('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaLocalAgentPlugin.java','utf8');
 const start=source.indexOf(' static void configureLocalEmbeddings('),end=source.indexOf(' static void configureEnvironment(',start);assert.ok(start>=0&&end>start);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-embedding-policy-'));
 const home=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const bin=name=>home?path.join(home,'bin',name):name;
 try{fs.writeFileSync(path.join(dir,'EmbeddingPolicyTest.java'),`import java.io.*;import java.nio.file.*;import java.util.*;
public class EmbeddingPolicyTest {
 ${source.slice(start,end)}
 public static void main(String[] args)throws Exception {
  File root=new File(args[0]),nativeDir=new File(root,"native"),filesDir=new File(root,"files");nativeDir.mkdirs();
  File engine=new File(nativeDir,"libelizainference.so"),jni=new File(nativeDir,"libelizavoicejni.so"),model=new File(filesDir,".eliza/local-inference/models/bge-small-en-v1.5-f16.gguf");model.getParentFile().mkdirs();
  Map<String,String> env=new HashMap<>();env.put("ELIZAOS_CLOUD_API_KEY","synthetic-key");env.put("ELIZAOS_CLOUD_BASE_URL","https://api.eliza.app/api/v1");env.put("ELIZAOS_CLOUD_USE_INFERENCE","true");env.put("ELIZAOS_CLOUD_SMALL_MODEL","cerebras/qwen-3.8-27b");env.put("ELIZAOS_CLOUD_LARGE_MODEL","cerebras/qwen-3.8-27b");env.put("ELIZAOS_CLOUD_USE_TTS","true");env.put("ELIZAOS_CLOUD_USE_EMBEDDINGS","true");
  Map<String,String> before=new HashMap<>(env);
  configureLocalEmbeddings(nativeDir,filesDir,env);if(!before.equals(env))throw new AssertionError("Missing host changed routing");
  Files.writeString(engine.toPath(),"fixture");configureLocalEmbeddings(nativeDir,filesDir,env);if(!before.equals(env))throw new AssertionError("Partial host changed routing");
  Files.writeString(jni.toPath(),"fixture");configureLocalEmbeddings(nativeDir,filesDir,env);if(!before.equals(env))throw new AssertionError("Missing model changed routing");
  Files.writeString(model.toPath(),"fixture");configureLocalEmbeddings(nativeDir,filesDir,env);
  if(!"false".equals(env.get("ELIZAOS_CLOUD_USE_EMBEDDINGS"))||!"false".equals(env.get("ELIZA_DISABLE_LOCAL_EMBEDDINGS"))||!"1".equals(env.get("ELIZA_LOCAL_EMBEDDING_ENABLED"))||!"384".equals(env.get("ELIZA_LOCAL_EMBEDDING_DIMENSIONS"))||!model.getAbsolutePath().equals(env.get("ELIZA_LOCAL_EMBEDDING_MODEL_PATH")))throw new AssertionError("Local embedding contract not selected");
  for(var entry:before.entrySet())if(!entry.getKey().equals("ELIZAOS_CLOUD_USE_EMBEDDINGS")&&!entry.getValue().equals(env.get(entry.getKey())))throw new AssertionError("Text or speech configuration changed");
 }
}`);execFileSync(bin('javac'),['-d',dir,path.join(dir,'EmbeddingPolicyTest.java')],{timeout:15000});execFileSync(bin('java'),['-cp',dir,'EmbeddingPolicyTest',dir],{timeout:15000});}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
