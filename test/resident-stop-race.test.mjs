import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('native stop observations tolerate exit races only after proven process absence',()=>{
 const patch=fs.readFileSync('patches/eliza/android-resident-exact-stop.patch','utf8');
 const lines=patch.split('\n').filter(line=>line.startsWith('+')&&!line.startsWith('+++')).map(line=>line.slice(1)).join('\n');
 const start=lines.indexOf(' interface ProcessObservation'),end=lines.indexOf(' private static <T> T observePresent',start);
 assert.ok(start>=0&&end>start);
 const helper=lines.slice(start,end).replaceAll('android.system.ErrnoException','ErrnoException');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-stop-race-'));
 const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');
 const bin=name=>java?path.join(java,'bin',name):name;
 try{
  fs.writeFileSync(path.join(dir,'StopRaceTest.java'),`import java.io.*;import java.nio.file.*;
public class StopRaceTest {
 static class OsConstants {static final int ENOENT=2,EACCES=13;}
 static class ErrnoException extends Exception {final int errno;ErrnoException(int value){errno=value;}}
${helper}
 static void preserves(Exception original,ProcessPresence presence)throws Exception {
  try{observePresent(42,()->{throw original;},presence);}catch(Exception result){if(result!=original)throw new AssertionError("Original uncertainty replaced");return;}throw new AssertionError("Uncertain observation admitted");
 }
 public static void main(String[] args)throws Exception {
  if(observePresent(42,()->"owned",pid->{throw new AssertionError("Unneeded lookup");})!="owned")throw new AssertionError();
  for(Exception failure:new Exception[]{new FileNotFoundException("process stat vanished"),new ErrnoException(2),new IOException("identity unavailable")}){
   if(observePresent(42,()->{throw failure;},pid->{if(pid!=42)throw new AssertionError();throw new ErrnoException(2);})!=null)throw new AssertionError();
   preserves(failure,pid->{}); // PID still exists, including reuse: preserve the refusal.
   preserves(failure,pid->{throw new ErrnoException(13);});
   preserves(failure,pid->{throw new IOException("unknown visibility");});
  }
  Path file=Files.createTempFile("resident-observation-",".stat");
  try{
   if(!Files.exists(file))throw new AssertionError();Files.delete(file);
   Object absent=observePresent(42,()->{try(InputStream in=new FileInputStream(file.toFile())){return in.read();}},pid->{throw new ErrnoException(2);});
   if(absent!=null)throw new AssertionError("Exit between inventory and read was rejected");
  }finally{Files.deleteIfExists(file);}
  System.out.println("PASS resident exit observation boundaries");
 }
}`);
  execFileSync(bin('javac'),['--release','11','-d',dir,path.join(dir,'StopRaceTest.java')],{timeout:20000});
  assert.match(execFileSync(bin('java'),['-cp',dir,'StopRaceTest'],{encoding:'utf8',timeout:20000}),/^PASS resident exit observation boundaries/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
