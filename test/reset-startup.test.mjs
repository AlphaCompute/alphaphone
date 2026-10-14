import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
test('pending reset retries, shows bounded recovery instead of a launcher restart loop, before startup callbacks; accepted, refused and failed dispatch never resumes old runtime',()=>{
 const dir=mkdtempSync(join(tmpdir(),'alpha-reset-startup-')),sources=[];
 const put=(name,body)=>{const path=join(dir,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,body);sources.push(path);};
 const bin=name=>process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',name):name;
 try{
  put('android/content/Context.java',`package android.content; public class Context { public static java.io.File data; public static android.app.ActivityManager manager=new android.app.ActivityManager(); public Context createDeviceProtectedStorageContext(){return this;} public java.io.File getNoBackupFilesDir(){data.mkdirs();return data;} public <T>T getSystemService(Class<T> type){return type.cast(manager);} public String getPackageName(){return "fixture.alpha";} public static int recoveries; public void startActivity(Intent intent){if(!"ai.elizaresearch.alphaphone.ResetRecoveryActivity".equals(intent.target.getName())||intent.flags!=(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK))throw new AssertionError("unexpected start");recoveries++;} }`);
  put('android/content/Intent.java',`package android.content; public class Intent {public static final int FLAG_ACTIVITY_NEW_TASK=0x10000000,FLAG_ACTIVITY_CLEAR_TASK=0x8000;public final Class<?> target;public int flags;public Intent(Context c,Class<?> t){target=t;}public Intent addFlags(int f){flags|=f;return this;} }`);
  put('android/app/Application.java',`package android.app; public class Application extends android.content.Context {protected void attachBaseContext(android.content.Context base){} public void onCreate(){} public static String process="fixture.alpha"; public static String getProcessName(){return process;} }`);
  put('android/app/ActivityManager.java',`package android.app; public class ActivityManager {public static int calls,mode; public boolean clearApplicationUserData(){calls++;if(mode==2)throw new SecurityException("fixture refusal");return mode==0;} }`);
  put('android/os/Process.java',`package android.os; public final class Process {public static class Exit extends Error{} public static int myPid(){return 123;} public static boolean isIsolated(){return false;} public static void killProcess(int pid){throw new Exit();} }`);
  put('android/util/AtomicFile.java',`package android.util; public class AtomicFile {private final java.io.File file;public AtomicFile(java.io.File f){file=f;}public java.io.File getBaseFile(){return file;}public java.io.FileOutputStream startWrite()throws Exception{return new java.io.FileOutputStream(file);}public void finishWrite(java.io.FileOutputStream out)throws Exception{out.getFD().sync();out.close();}public void failWrite(java.io.FileOutputStream out){try{out.close();}catch(Exception ignored){}}public byte[] readFully()throws java.io.IOException{return java.nio.file.Files.readAllBytes(file.toPath());}public void delete(){file.delete();} }`);
  put('android/util/Log.java',`package android.util; public class Log {public static int w(String tag,String message){return 0;} }`);
  put('android/system/OsConstants.java',`package android.system; public class OsConstants {public static final int O_RDONLY=0;}`);
  put('android/system/Os.java',`package android.system; public class Os {public static java.io.FileDescriptor open(String path,int flags,int mode){return new java.io.FileDescriptor();}public static void fsync(java.io.FileDescriptor fd){}public static void close(java.io.FileDescriptor fd){} }`);
  put('ai/elizaresearch/alphaphone/Dependencies.java',`package ai.elizaresearch.alphaphone;
class AlphaListenerPlugin {static boolean resetSaved=true;static int calls;static boolean resetForData(android.content.Context c){calls++;return resetSaved;}}
class ResetRecoveryActivity {static final String PROCESS_SUFFIX=":reset_recovery";}
class NativeDigestHost {NativeDigestHost(android.content.Context c){NativeSourceHost.started++;}void read(){}}
class NativeOwnerReminderHost {NativeOwnerReminderHost(android.content.Context c){NativeSourceHost.started++;}void read(){}}
class NativeSourceHost {static int started;static void configure(Runnable r){started++;}static void configureOwnerReminderContext(Runnable r){started++;}}
class NativeDeletionCoordinator {static NativeDeletionCoordinator get(android.content.Context c){return new NativeDeletionCoordinator();}void start(){NativeSourceHost.started++;}}
class AlphaCrashLog {static void install(android.content.Context c){NativeSourceHost.started++;}}
class AlphaNoteAudioPlugin {static void scheduleTrashBackstop(android.content.Context c){NativeSourceHost.started++;}}
`);
  put('ai/elizaresearch/alphaphone/ResetStartupTest.java',`package ai.elizaresearch.alphaphone;
public class ResetStartupTest {
 static void check(boolean ok){if(!ok)throw new AssertionError();}
 public static void main(String[] args)throws Exception {
  android.content.Context.data=new java.io.File(args[0]);AlphaApplication app=new AlphaApplication();
  check(!AlphaDataReset.pending(app));
  // A late failure result from a stale recovery attempt cannot recreate reset state in fresh data.
  AlphaListenerPlugin.resetSaved=false;check(AlphaDataReset.attempt(app,System.currentTimeMillis())==AlphaDataReset.Outcome.LISTENER_UNACKNOWLEDGED);check(android.content.Context.data.listFiles().length==0);AlphaListenerPlugin.resetSaved=true;
  app.attachBaseContext(app);app.onCreate();check(NativeSourceHost.started==7);
  // Package-scoped: Android's own-package clear only; the sibling app's fixture data is untouched.
  check(new java.io.File(args[1],"keep").isFile());NativeSourceHost.started=0;
  AlphaDataReset.record(app);check(AlphaDataReset.pending(new AlphaApplication()));
  for(int mode=0;mode<3;mode++){android.app.ActivityManager.mode=mode;try{AlphaApplication restarted=new AlphaApplication();restarted.attachBaseContext(app);throw new AssertionError("Providers would initialize before onCreate");}catch(android.os.Process.Exit stopped){}check(NativeSourceHost.started==0);check(AlphaDataReset.pending(app));}
  check(android.app.ActivityManager.calls==3);
  AlphaListenerPlugin.resetSaved=false;
  try{app.attachBaseContext(app);throw new AssertionError("Unacknowledged listener reset resumed");}catch(android.os.Process.Exit stopped){}
  check(android.app.ActivityManager.calls==3);check(AlphaDataReset.pending(app));check(NativeSourceHost.started==0);
  // #409 launcher loop: an installed listener that never acknowledges. Android relaunches HOME each
  // time the process stops. Every launch must stop without clearing or initializing, must show the
  // recovery surface, and automatic listener attempts must be bounded rather than repeated forever.
  java.io.File failures=new java.io.File(android.content.Context.data,"reset-alpha.failures");check(failures.delete()||true);
  android.content.Context.recoveries=0;AlphaListenerPlugin.calls=0;int clears=android.app.ActivityManager.calls;
  for(int relaunch=0;relaunch<25;relaunch++){try{new AlphaApplication().attachBaseContext(app);throw new AssertionError("Unacknowledged reset resumed on relaunch "+relaunch);}catch(android.os.Process.Exit stopped){}}
  check(android.content.Context.recoveries==25);check(AlphaListenerPlugin.calls==AlphaDataReset.AUTOMATIC_ATTEMPTS);
  check(android.app.ActivityManager.calls==clears);check(AlphaDataReset.pending(app));check(NativeSourceHost.started==0);
  // The recovery process neither stops itself nor starts Alpha's runtime.
  android.app.Application.process="fixture.alpha:reset_recovery";AlphaApplication recovery=new AlphaApplication();recovery.attachBaseContext(app);recovery.onCreate();
  check(NativeSourceHost.started==0);check(android.content.Context.recoveries==25);android.app.Application.process="fixture.alpha";
  // A user's Try again is always a fresh attempt; still fail-closed while unacknowledged.
  check(AlphaDataReset.attempt(app,System.currentTimeMillis())==AlphaDataReset.Outcome.LISTENER_UNACKNOWLEDGED);check(AlphaListenerPlugin.calls==AlphaDataReset.AUTOMATIC_ATTEMPTS+1);check(android.app.ActivityManager.calls==clears);check(AlphaDataReset.pending(app));
  // Window policy: budget returns after the window or a clock change; unreadable state defers automatic attempts.
  long t=1_000_000;check(AlphaDataReset.automaticAttemptAllowed(new long[]{0,0},t));check(!AlphaDataReset.automaticAttemptAllowed(new long[]{AlphaDataReset.AUTOMATIC_ATTEMPTS,t},t+1));
  check(AlphaDataReset.automaticAttemptAllowed(new long[]{AlphaDataReset.AUTOMATIC_ATTEMPTS,t},t+AlphaDataReset.AUTOMATIC_WINDOW_MS));check(AlphaDataReset.automaticAttemptAllowed(new long[]{AlphaDataReset.AUTOMATIC_ATTEMPTS,t},t-1));
  java.nio.file.Files.write(failures.toPath(),"garbage".getBytes());check(!AlphaDataReset.automaticAttemptAllowed(AlphaDataReset.failureState(app),System.currentTimeMillis()));
  AlphaListenerPlugin.calls=0;try{new AlphaApplication().attachBaseContext(app);throw new AssertionError();}catch(android.os.Process.Exit stopped){}check(AlphaListenerPlugin.calls==0);check(AlphaDataReset.pending(app));
  // A new confirmation starts a fresh budget, so the interactive attempt is never silently deferred.
  AlphaDataReset.record(app);check(!failures.exists());check(AlphaDataReset.automaticAttemptAllowed(AlphaDataReset.failureState(app),System.currentTimeMillis()));
  // Interrupted between acknowledgement and dispatch: the listener acknowledges, Android refuses; the next launch completes.
  AlphaListenerPlugin.resetSaved=true;android.app.ActivityManager.mode=2;try{new AlphaApplication().attachBaseContext(app);throw new AssertionError();}catch(android.os.Process.Exit stopped){}check(AlphaDataReset.pending(app));
  android.app.ActivityManager.mode=0;int recoveriesBefore=android.content.Context.recoveries;
  try{new AlphaApplication().attachBaseContext(app);throw new AssertionError();}catch(android.os.Process.Exit stopped){}check(android.content.Context.recoveries==recoveriesBefore);
  // Simulated system completion: only this fixture directory is erased. Fresh launch initializes.
  for(java.io.File f:android.content.Context.data.listFiles())check(f.delete());
  check(!AlphaDataReset.pending(app));
  // A late failure result from a stale recovery attempt cannot recreate reset state in fresh data.
  AlphaListenerPlugin.resetSaved=false;check(AlphaDataReset.attempt(app,System.currentTimeMillis())==AlphaDataReset.Outcome.LISTENER_UNACKNOWLEDGED);check(android.content.Context.data.listFiles().length==0);AlphaListenerPlugin.resetSaved=true;
  app.attachBaseContext(app);app.onCreate();check(NativeSourceHost.started==7);
  // Package-scoped: Android's own-package clear only; the sibling app's fixture data is untouched.
  check(new java.io.File(args[1],"keep").isFile());
  System.out.println("PASS reset startup admission and interrupted dispatch");
 }
}`);
  const sibling=join(dir,'other-app');mkdirSync(sibling);writeFileSync(join(sibling,'keep'),'x');
  execFileSync(bin('javac'),['--release','11','-d',join(dir,'classes'),...sources,...['AlphaDataReset','AlphaApplication'].map(name=>join(root,`android/app/src/main/java/ai/elizaresearch/alphaphone/${name}.java`))],{timeout:60000});
  assert.match(execFileSync(bin('java'),['-cp',join(dir,'classes'),'ai.elizaresearch.alphaphone.ResetStartupTest',join(dir,'private-fixture'),sibling],{encoding:'utf8',timeout:10000}),/PASS reset startup/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('reset deletion stays package-scoped: Android own-package clear, no file enumeration or other packages',()=>{
 const source=readFileSync(resolve(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaDataReset.java'),'utf8');
 assert.match(source,/clearApplicationUserData\(\)/);
 assert.doesNotMatch(source,/clearApplicationUserData\([^)]/);
 assert.doesNotMatch(source,/listFiles|deleteRecursively|Runtime\.getRuntime|"pm |getExternal|MediaStore/);
 const manifest=readFileSync(resolve(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
 assert.match(manifest,/<activity android:name="\.ResetRecoveryActivity" android:exported="false" android:process=":reset_recovery"/);
 const recovery=readFileSync(resolve(root,'android/app/src/main/java/ai/elizaresearch/alphaphone/ResetRecoveryActivity.java'),'utf8');
 assert.doesNotMatch(recovery,/reset (is )?complete|data (was|has been) deleted\./i);
});
