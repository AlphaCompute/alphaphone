import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(join(root,path),'utf8');
const nativeDir='android/app/src/main/java/ai/elizaresearch/alphaphone/';
const native=name=>read(nativeDir+name);

/** JAVA_HOME, then javac on PATH, then the Homebrew JDK on macOS; null when none is installed. */
function javaTools(){
 const runs=binary=>{try{execFileSync(binary,['-version'],{stdio:'ignore',timeout:30000});return true;}catch{return false;}};
 const homes=[process.env.JAVA_HOME,'',process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':undefined].filter(home=>home!==undefined);
 for(const home of homes){const binary=name=>home?join(home,'bin',name):name;if(runs(binary('javac'))&&runs(binary('java')))return binary;}
 return null;
}
const binary=javaTools();

test('Reset Alpha data runs in order, resumes after process death, gates late callbacks and never follows links out of private storage',{skip:binary?false:'No JDK found (set JAVA_HOME or put javac on PATH)'},()=>{
 const temporary=mkdtempSync(join(tmpdir(),'alpha-reset-'));
 try{
  execFileSync(binary('javac'),['--release','11','-d',temporary,join(root,nativeDir,'AlphaDataResetPlan.java'),join(root,'test/fixtures/AlphaDataResetPlanTest.java')],{timeout:120000});
  assert.match(execFileSync(binary('java'),['-cp',temporary,'ai.elizaresearch.alphaphone.AlphaDataResetPlanTest'],{encoding:'utf8',timeout:120000}),/^PASS alpha data reset plan/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});

const settings=read('apps/app/src/prototype/settings-adapter.ts');
const region=settings.slice(settings.indexOf('// settings-facts:begin'),settings.indexOf('// settings-facts:end'));
const facts=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(region,{mode:'transform'})).toString('base64'));

test('the reset page states what is erased and what a local reset never erases or cancels',()=>{
 const rows=Object.fromEntries(facts.resetScopeRows());
 assert.match(rows['Not erased'],/Photos and files in shared phone storage/);
 assert.match(rows['Not erased or cancelled'],/Gmail mailbox/);
 assert.match(rows['Not erased or cancelled'],/Eliza Cloud account/);
 assert.match(rows['Not erased or cancelled'],/subscription/);
 assert.match(rows['Erased on this phone'],/local agent/);
 assert.match(rows['Erased on this phone'],/keys/);
 assert.match(rows['No copy is kept'],/keeps no copy/);
 assert.doesNotMatch(rows['No copy is kept'],/no backup or export/,'Notes text export and damaged-data downloads still exist, so the page must not claim there is no export');
 assert.match(rows['Not cancelled on other devices'],/Eliza Cloud/);assert.match(rows['Not cancelled on other devices'],/paired remote agent/);
 assert.match(rows['Kept by Android'],/notification access/);assert.match(rows['Kept by Android'],/autofill/);assert.match(rows['Kept by Android'],/home app/);
 assert.match(rows['Afterwards'],/first-run/);
 for(const phrase of ['Gmail mailbox','Eliza Cloud account','subscription','cannot be undone'])assert.ok(facts.RESET_CONFIRM_TEXT.includes(phrase),phrase);
});

test('reset outcomes never claim an erase that did not start',()=>{
 assert.match(facts.resetOutcome('resetting'),/Resetting Alpha data/);
 for(const status of ['cancelled','refused','unavailable',undefined,'saved','done',null,42])assert.match(facts.resetOutcome(status),/Nothing was erased|already open/);
 for(const status of ['resetting','cancelled','refused','busy','unavailable','unknown'])assert.doesNotMatch(facts.resetOutcome(status),/data (was )?(erased|reset)\b|reset (is )?(complete|finished|done)/i);
});

test('the user confirms natively; the renderer value is only an API-shape check and the control is native-only',()=>{
 const plugin=native('AlphaDataResetPlugin.java');
 assert.equal(/ CONFIRMATION = "([^"]+)"/.exec(plugin)?.[1],facts.RESET_CONFIRMATION);
 assert.match(plugin,/if \(!CONFIRMATION\.equals\(call\.getString\("confirmation"\)\)\)/);
 // With a screen lock: Android's credential screen. Without one: a native typed-phrase dialog. Never begin() straight from the renderer call.
 assert.match(plugin,/if \(!deviceSecure\(\)\) \{ confirmByTyping\(call\); return; \}/);
 assert.match(plugin,/createConfirmDeviceCredentialIntent/);
 const typing=plugin.slice(plugin.indexOf('private void confirmByTyping('),plugin.indexOf('private void begin('));
 assert.match(typing,/new android\.app\.AlertDialog\.Builder\(activity\)/);
 assert.match(typing,/if \(TYPED_PHRASE\.equals\(typed\.getText\(\)\.toString\(\)\.trim\(\)\)\) begin\(call\);/);
 assert.match(typing,/erase\.setEnabled\(false\)/);
 const reset=plugin.slice(plugin.indexOf('public void reset(PluginCall call)'),plugin.indexOf('@ActivityCallback'));
 assert.equal(reset.match(/begin\(call\)/g),null,'reset() itself never starts the erase');
 // The page shows which native check will run.
 assert.match(facts.resetCheckText({deviceSecure:true,pending:false}),/screen lock/);
 assert.match(facts.resetCheckText({deviceSecure:false,pending:false}),/type RESET/);
 assert.equal(facts.resetCheckText(undefined),'Not checked');
 assert.match(settings,/api\.set\(\{page:'reset'\}\);void describeReset\(\);/);
 assert.match(facts.resetOutcome('declined'),/Nothing was erased/);
 // A marker that was never written is not described as a pending reset.
 assert.match(plugin,/instanceof AlphaDataResetPlan\.NotStarted\) return "Reset did not start\. Nothing was erased\./);
 assert.match(plugin,/getResultCode\(\) != Activity\.RESULT_OK\) \{[^}]*Nothing was erased/);
 assert.match(settings,/if\(native\)page\.groups\.push\(\{\.\.\.group\(\[\{kNav:true,label:'Reset Alpha data'/);
 assert.match(settings,/if\(native&&state\.page==='reset'\)/);
 assert.match(settings,/!Capacitor\.isNativePlatform\(\) \|\| !window\.confirm\(RESET_CONFIRM_TEXT\)/);
 assert.match(native('MainActivity.java'),/registerPlugin\(AlphaDataResetPlugin\.class\)/);
});

test('late callbacks and starts are gated while a reset is pending',()=>{
 // Fails closed: an exception while reading the reset state schedules nothing.
 assert.match(native('AlphaApplication.java'),/AlphaDataReset\.resumeIfPending\(this\)\)return;\}catch\(RuntimeException unavailable\)\{return;\}\s*if\(AlphaDataReset\.blocked\(this\)\)return;[\s\S]*AlphaCrashLog\.install/);
 assert.match(native('ReminderReceiver.java'),/onReceive\(Context context, Intent intent\) \{\s*if \(AlphaDataReset\.blocked\(context\)\) return;\s*AlphaReminders\.engine\(context\)\.dispatch\(intent\);/);
 assert.match(native('AlphaNoteAudioPlugin.java'),/class NotesTrashBackstopWorker[\s\S]*?doWork\(\)\{\s*\/\/[^\n]*\n\s*if\(AlphaDataReset\.blocked\(getApplicationContext\(\)\)\)return Result\.success\(\);/);
 assert.match(native('HostedDeliveryWorker.java'),/doWork\(\)\{\s*\/\/[^\n]*\n\s*if\(AlphaDataReset\.blocked\(getApplicationContext\(\)\)\)return Result\.success\(\);/);
 const listener=native('AlphaNotificationListener.java');
 for(const callback of ['onListenerConnected','onNotificationPosted','onNotificationRemoved'])assert.match(listener,new RegExp(`${callback}\\([^)]*\\) \\{\\s*(if \\()?!?\\(?AlphaDataReset\\.blocked\\(this\\)`));
 const agent=native('AlphaLocalAgentPlugin.java');
 assert.equal(agent.match(/AlphaDataReset\.blocked\(getContext\(\)\)\)\{call\.reject/g)?.length,2,'checked before and under the lifecycle lock');
 assert.match(agent,/static void stopForReset\(Context context\)[\s\S]*?requestStopForReset\(context\);[\s\S]*?Native shutdown unconfirmed/);
 // The background-start refusal is caught; the boot grace window is waited out, not reported as a failure.
 assert.match(agent,/requestStopForReset\(Context context\)\{\s*try\{ElizaAgentService\.stop\(context\);\}\s*catch\(IllegalStateException/);
 assert.match(agent,/RESET_GRACE_MS=120_000L/);
 // A resumed reset that fails shows the failure with a retry and Android's App info, never an endless "Finishing".
 const main=native('MainActivity.java');
 assert.match(main,/if \(AlphaDataReset\.blocked\(this\)\) \{[\s\S]*?resetPending = true;[\s\S]*?AlphaDataReset\.resumeIfPending\(this, \(outcome, failure\) -> \{[\s\S]*?showResetNotice\(AlphaDataResetPlugin\.failureText\(failure\), true\)[\s\S]*?return;/);
 assert.match(main,/ACTION_APPLICATION_DETAILS_SETTINGS/);
 // Stop order: Android-bound components are disabled before the agent stop can wait.
 const plan=native('AlphaDataResetPlan.java');
 assert.match(plan,/Step\[\] stops = \{Step\.STOP_SERVICES, Step\.STOP_AGENT, Step\.CANCEL_WORK/);
 assert.match(plan,/REQUIRED = [^;]*Step\.STOP_SERVICES, Step\.STOP_AGENT, Step\.CANCEL_WORK, Step\.DELETE_KEYS/);
 const reset=native('AlphaDataReset.java');
 assert.match(reset,/alarms\.cancelAll\(\)/);
 assert.match(reset,/AlphaLocalAgentPlugin\.stopForReset\(context\);\s*setAgentService\(context, false\);/);
 assert.match(reset,/Keystore aliases remain/);
});

test('every manifest receiver, service and app worker is gated, disabled or stopped by the reset',()=>{
 const manifest=read('android/app/src/main/AndroidManifest.xml'),reset=native('AlphaDataReset.java'),plan=native('AlphaDataResetPlan.java');
 const gated=[...reset.slice(reset.indexOf('GATED_COMPONENTS'),reset.indexOf('));',reset.indexOf('GATED_COMPONENTS'))).matchAll(/"([\w.]+)"/g)].map(m=>m[1]);
 const full=name=>name.startsWith('.')?'ai.elizaresearch.alphaphone'+name:name;
 // Each entry: why it cannot act on Alpha data while a reset is pending.
 const handled={
  'ai.elizaresearch.alphaphone.ElizaAgentService':()=>/setAgentService\(context, false\)/.test(reset),
  'ai.elizaresearch.alphaphone.AlphaNavigationService':()=>/stopService\(new Intent\(context, AlphaNavigationService\.class\)\)/.test(reset),
  'ai.elizaresearch.alphaphone.IsolatedPdfService':()=>/android:name="\.IsolatedPdfService"[^>]*android:isolatedProcess="true"/.test(manifest),
  'ai.elizaresearch.alphaphone.AlphaNotificationListener':()=>gated.includes('ai.elizaresearch.alphaphone.AlphaNotificationListener')&&/AlphaDataReset\.blocked\(this\)/.test(native('AlphaNotificationListener.java')),
  'ai.elizaresearch.alphaphone.ReminderReceiver':()=>gated.includes('ai.elizaresearch.alphaphone.ReminderReceiver')&&/AlphaDataReset\.blocked\(context\)/.test(native('ReminderReceiver.java')),
  'ai.eliza.plugins.passwords.ElizaPasswordAutofillService':()=>gated.includes('ai.eliza.plugins.passwords.ElizaPasswordAutofillService'),
 };
 const components=[...manifest.matchAll(/<(service|receiver)\s+android:name="([^"]+)"/g)].map(m=>full(m[2]));
 assert.ok(components.length>=6);
 for(const component of components)assert.ok(handled[component]?.(),`${component} has a reset gate`);
 assert.match(plan,/STOP_SERVICES/);
 // Workers declared in Alpha's own sources: each checks the gate first; WorkManager work is also cancelled.
 const dir=join(root,nativeDir);
 const workers=readdirSync(dir).filter(f=>f.endsWith('.java')).flatMap(f=>[...readFileSync(join(dir,f),'utf8').matchAll(/class (\w+) extends (?:androidx\.work\.)?Worker\b[\s\S]*?doWork\(\)\{\s*(?:\/\/[^\n]*\n\s*)?(if\(AlphaDataReset\.blocked\(getApplicationContext\(\)\)\)return Result\.success\(\);)?/g)].map(m=>({file:f,name:m[1],gated:!!m[2]})));
 assert.deepEqual(workers.map(w=>w.name).sort(),['HostedDeliveryWorker','NotesTrashBackstopWorker']);
 for(const worker of workers)assert.ok(worker.gated,`${worker.name} returns early while a reset is pending`);
 // The relaunch helper runs in its own process and touches no Alpha data.
 assert.match(manifest,/android:name="\.AlphaResetRelaunchActivity" android:exported="false" android:process=":reset_relaunch"/);
 assert.doesNotMatch(native('AlphaResetRelaunchActivity.java'),/getSharedPreferences|getFilesDir|getDataDir|AlphaCredentialStore|openFileOutput/);
});

test('reset touches only this package: private directories, own Keystore aliases, own work and notices',()=>{
 const reset=native('AlphaDataReset.java');
 const files=reset.slice(reset.indexOf('public void deletePrivateFiles()'),reset.indexOf('public void relaunch()'));
 assert.match(files,/getDataDir\(\)/);assert.match(files,/getNoBackupFilesDir\(\)/);assert.match(files,/getExternalFilesDirs\(null\)/);assert.match(files,/getExternalCacheDirs\(\)/);
 for(const shared of ['Environment.','MediaStore','getExternalStorageDirectory','getExternalStoragePublicDirectory','/sdcard','/storage/'])assert.ok(!reset.includes(shared),`no shared storage access: ${shared}`);
 assert.match(reset,/KeyStore\.getInstance\("AndroidKeyStore"\)/);
 assert.match(reset,/WorkManager\.getInstance\(context\)\.cancelAllWork\(\)/);
 assert.match(reset,/notices\.cancelAll\(\)/);
 assert.match(reset,/clearApplicationUserData\(\)/);
});

test('Android backup and device transfer stay disabled',()=>{
 const manifest=read('android/app/src/main/AndroidManifest.xml');
 assert.match(manifest,/android:allowBackup="false"/);
 assert.match(manifest,/android:dataExtractionRules="@xml\/data_extraction_rules"/);
 assert.doesNotMatch(manifest,/android:backupAgent=|android:fullBackupContent="@xml/);
 const rules=read('android/app/src/main/res/xml/data_extraction_rules.xml');
 assert.doesNotMatch(rules,/<include\b/);
 for(const section of ['cloud-backup','device-transfer']){
  const body=rules.slice(rules.indexOf(`<${section}>`),rules.indexOf(`</${section}>`));
  for(const domain of ['root','file','database','sharedpref','external','device_root','device_file','device_database','device_sharedpref'])assert.match(body,new RegExp(`<exclude domain="${domain}" path="\\." />`),`${section} excludes ${domain}`);
 }
});

test('no app-data backup, import or restore control remains in the product',()=>{
 assert.ok(!existsSync(join(root,'apps/app/src/browser/calendar-backup.ts')),'calendar backup import parser removed');
 assert.doesNotMatch(settings,/Calendar backups/);
 const recovery=read('apps/app/src/browser/domain-recovery.ts');
 assert.doesNotMatch(recovery,/type='file'|\.type='file'|Choose calendar backup|calendar restore/);
 assert.match(recovery,/_retiredRestore\?:undefined/);
 assert.doesNotMatch(read('apps/app/src/browser/calendar-recovery.ts'),/restore\(|prepareCalendar/);
 assert.doesNotMatch(read('apps/app/src/browser/calendar-store.ts'),/async restore\(/);
 // The prototype memory-wipe sheet stays suppressed; the real reset replaces it.
 assert.match(settings.split('\n').find(row=>row.includes('const out = render({ ...state')),/'wipe'/);
});
