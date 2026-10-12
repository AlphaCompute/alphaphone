// Always-on listener (issue #424): plain-JVM policy checks and source/manifest invariants.
// This compiles no APK, runs nothing on Android and boots no image. Device, image and
// long-running acceptance are separate gates (docs/adr/0001-privileged-listener.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const sense=join(root,'android/sense');
const source=join(sense,'src/main/java/ai/elizaresearch/alphaphone/sense');
const read=path=>readFileSync(join(root,path),'utf8');
const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');
const binary=name=>java?join(java,'bin',name):name;

test('listener policy, crash-loop breaker, speech gate and wake phrase run on the JVM',()=>{
 const temporary=mkdtempSync(join(tmpdir(),'listener-policy-'));
 try{
  const pure=['ListenerPolicy','CrashLoopBreaker','SpeechGate','WakePhrase'].map(name=>join(source,`${name}.java`));
  execFileSync(binary('javac'),['--release','11','-d',temporary,...pure,join(root,'test/fixtures/ListenerPolicyTest.java')],{timeout:60000});
  assert.match(execFileSync(binary('java'),['-cp',temporary,'ai.elizaresearch.alphaphone.sense.ListenerPolicyTest'],{encoding:'utf8',timeout:60000}),/^PASS listener policy/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});

test('the pure policy classes stay free of Android APIs so the JVM test exercises the shipped code',()=>{
 for(const name of ['ListenerPolicy','CrashLoopBreaker','SpeechGate','WakePhrase'])
  assert.doesNotMatch(readFileSync(join(source,`${name}.java`),'utf8'),/import android\./,name);
});

test('the listener manifest has no network access and only the reviewed privileged permissions',()=>{
 const manifest=read('android/sense/src/main/AndroidManifest.xml').replace(/<!--[\s\S]*?-->/g,'');
 const requested=[...manifest.matchAll(/<uses-permission android:name="([^"]+)"(?![^>]*tools:node="remove")/g)].map(match=>match[1]).sort();
 assert.deepEqual(requested,[
  'android.permission.CAPTURE_AUDIO_HOTWORD','android.permission.FOREGROUND_SERVICE','android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.HIDE_OVERLAY_WINDOWS','android.permission.POST_NOTIFICATIONS','android.permission.RECORD_AUDIO',
  'android.permission.START_ACTIVITIES_FROM_BACKGROUND'].sort());
 assert.match(manifest,/android\.permission\.INTERNET" tools:node="remove"/,'merged INTERNET is stripped');
 assert.match(manifest,/android\.permission\.ACCESS_NETWORK_STATE" tools:node="remove"/,'merged network state is stripped');
 for(const forbidden of ['CAPTURE_AUDIO_OUTPUT','CAPTURE_MEDIA_OUTPUT','CAPTURE_VOICE_COMMUNICATION_OUTPUT','BYPASS_CONCURRENT_RECORD_AUDIO_RESTRICTION','RECORD_BACKGROUND_AUDIO','READ_PHONE_STATE','MODIFY_AUDIO_ROUTING'])
  assert.doesNotMatch(manifest,new RegExp(forbidden),forbidden);
 assert.match(manifest,/android:persistent="true"/);
 assert.match(manifest,/android:directBootAware="true"/);
 assert.match(manifest,/android:allowBackup="false"/);
 assert.match(manifest,/\.ListeningService" android:exported="false"\s+android:foregroundServiceType="microphone"/);
 assert.match(manifest,/\.ListenerActionReceiver" android:exported="false"/);
 assert.match(manifest,/\.ListenerControlProvider" android:exported="true"[\s\S]*?android:permission="ai\.elizaresearch\.alphaphone\.sense\.permission\.LISTENER_CONTROL"/);
 assert.match(manifest,/LISTENER_CONTROL"\s+android:protectionLevel="signature"/);
 assert.match(manifest,/BIND_QUICK_SETTINGS_TILE/);
});

test('audio and transcripts stay in RAM and invocation carries no content',()=>{
 const files=readdirSync(source).filter(name=>name.endsWith('.java'));
 const all=files.map(name=>readFileSync(join(source,name),'utf8')).join('\n');
 assert.doesNotMatch(all,/java\.net\.|HttpURLConnection|Socket\b|okhttp|FileOutputStream|openFileOutput|MediaRecorder\.setOutputFile|getExternal/,'no network or file writes in the listener');
 const service=readFileSync(join(source,'ListeningService.java'),'utf8');
 assert.match(service,/Arrays\.fill\(frame,\(short\)0\)/,'capture frames are zeroed');
 assert.match(service,/finally\{Arrays\.fill\(samples,0f\);recognizing\.set\(false\);\}/,'utterances are zeroed after recognition');
 assert.match(service,/text=null;/,'transcript reference dropped after classification');
 assert.match(service,/FOREGROUND_SERVICE_TYPE_MICROPHONE/);
 assert.match(service,/registerAudioRecordingCallback/,'observes other recordings and silencing');
 assert.match(service,/addOnModeChangedListener/,'observes calls through the audio mode');
 const invocation=readFileSync(join(source,'AssistantInvocation.java'),'utf8');
 assert.doesNotMatch(invocation,/putExtra|setData|ClipData/,'the assistant intent carries no content');
 assert.match(invocation,/checkSignatures/,'only a same-signer Alpha is invoked');
 assert.match(invocation,/setShareIdentityEnabled\(true\)/);
 const provider=readFileSync(join(source,'ListenerControlProvider.java'),'utf8');
 assert.match(provider,/checkCallingPermission\(Listener\.CONTROL_PERMISSION\)/,'call() enforces the permission itself');
 assert.doesNotMatch(provider,/grantConsent|setEnabled\(true\)|resume\(\)/,'Alpha can only reduce capability');
 const notifications=readFileSync(join(source,'ListenerNotifications.java'),'utf8');
 assert.match(notifications,/VISIBILITY_PUBLIC/);
 assert.match(notifications,/"Pause",ListenerActionReceiver\.PAUSE,1,false/,'pause works on the lock screen');
 assert.match(notifications,/"Resume",ListenerActionReceiver\.RESUME,3,ListenerPolicy\.resumeRequiresUnlock\(\)/,'resume needs unlock');
});

test('the listener is an image-only APK, never part of the standalone or launcher APK',()=>{
 assert.match(read('android/settings.gradle'),/^include ':sense'$/m);
 assert.doesNotMatch(read('android/app/build.gradle'),/:sense/,':app never depends on the listener');
 const build=read('android/sense/build.gradle');
 assert.match(build,/applicationId "\$\{identity\.appId\}\.sense"/);
 assert.match(build,/implementation project\(':local-speech'\)/,'same audited local speech runtime');
 assert.doesNotMatch(build,/ALPHA_[A-Z_]+/,'no invented ALPHA_ variables');
 assert.doesNotMatch(build,/okhttp|retrofit|firebase|play-services/i);
 const app=read('android/app/src/main/AndroidManifest.xml');
 for(const privileged of ['CAPTURE_AUDIO_HOTWORD','START_ACTIVITIES_FROM_BACKGROUND','RECORD_BACKGROUND_AUDIO'])
  assert.doesNotMatch(app,new RegExp(privileged),`Alpha stays nonprivileged: ${privileged}`);
});
