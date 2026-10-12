import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(join(root,path),'utf8');
const nativeDir='android/app/src/main/java/ai/elizaresearch/alphaphone/';
const native=name=>read(nativeDir+name);

test('Reset Alpha data runs in order, resumes after process death, gates late callbacks and never follows links out of private storage',()=>{
 const temporary=mkdtempSync(join(tmpdir(),'alpha-reset-'));
 const java=process.env.JAVA_HOME||(process.platform==='darwin'?'/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home':'');const binary=name=>java?join(java,'bin',name):name;
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
 assert.match(rows['No copy is kept'],/no backup or export/);
 assert.match(rows['Afterwards'],/first-run/);
 for(const phrase of ['Gmail mailbox','Eliza Cloud account','subscription','cannot be undone'])assert.ok(facts.RESET_CONFIRM_TEXT.includes(phrase),phrase);
});

test('reset outcomes never claim an erase that did not start',()=>{
 assert.match(facts.resetOutcome('resetting'),/Resetting Alpha data/);
 for(const status of ['cancelled','refused','unavailable',undefined,'saved','done',null,42])assert.match(facts.resetOutcome(status),/Nothing was erased|already open/);
 for(const status of ['resetting','cancelled','refused','busy','unavailable','unknown'])assert.doesNotMatch(facts.resetOutcome(status),/data (was )?(erased|reset)\b|reset (is )?(complete|finished|done)/i);
});

test('the renderer confirmation phrase matches the native plugin and the control is native-only',()=>{
 const plugin=native('AlphaDataResetPlugin.java');
 assert.equal(/CONFIRMATION = "([^"]+)"/.exec(plugin)?.[1],facts.RESET_CONFIRMATION);
 // Refused without the phrase; Android's own credential screen when the phone has a screen lock.
 assert.match(plugin,/if \(!CONFIRMATION\.equals\(call\.getString\("confirmation"\)\)\)/);
 assert.match(plugin,/createConfirmDeviceCredentialIntent/);
 assert.match(plugin,/getResultCode\(\) != Activity\.RESULT_OK\) \{[^}]*Nothing was erased/);
 assert.match(settings,/if\(native\)page\.groups\.push\(\{\.\.\.group\(\[\{kNav:true,label:'Reset Alpha data'/);
 assert.match(settings,/if\(native&&state\.page==='reset'\)/);
 assert.match(settings,/!Capacitor\.isNativePlatform\(\) \|\| !window\.confirm\(RESET_CONFIRM_TEXT\)/);
 assert.match(native('MainActivity.java'),/registerPlugin\(AlphaDataResetPlugin\.class\)/);
});

test('late callbacks and starts are gated while a reset is pending',()=>{
 assert.match(native('AlphaApplication.java'),/AlphaDataReset\.resumeIfPending\(this\)\)return;[\s\S]*AlphaCrashLog\.install/);
 assert.match(native('HostedDeliveryWorker.java'),/doWork\(\)\{\s*\/\/[^\n]*\n\s*if\(AlphaDataReset\.blocked\(getApplicationContext\(\)\)\)return Result\.success\(\);/);
 const listener=native('AlphaNotificationListener.java');
 for(const callback of ['onListenerConnected','onNotificationPosted','onNotificationRemoved'])assert.match(listener,new RegExp(`${callback}\\([^)]*\\) \\{\\s*(if \\()?!?\\(?AlphaDataReset\\.blocked\\(this\\)`));
 const agent=native('AlphaLocalAgentPlugin.java');
 assert.equal(agent.match(/AlphaDataReset\.blocked\(getContext\(\)\)\)\{call\.reject/g)?.length,2,'checked before and under the lifecycle lock');
 assert.match(agent,/static void stopForReset\(Context context\)[\s\S]*?ElizaAgentService\.stop\(context\);[\s\S]*?Native shutdown unconfirmed/);
 assert.match(native('MainActivity.java'),/if \(AlphaDataReset\.blocked\(this\)\) \{[\s\S]*?resetPending = true;[\s\S]*?AlphaDataReset\.resumeIfPending\(this\);\s*return;/);
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
