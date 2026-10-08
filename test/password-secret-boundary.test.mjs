import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {prepareElizaPatches} from '../scripts/prepare-eliza-patches.mjs';

// The agent never sees secrets: no password, passkey or TOTP secret may reach the agent,
// the model, logs, the action journal, notification history or crash data. These checks
// pin the code paths that could carry one; real-provider redaction remains scripts/test-local-redaction.mjs.
const root=path.resolve(import.meta.dirname,'..');
const patched=prepareElizaPatches({root});
const plugin=path.join(patched,'plugins/plugin-native-passwords');
const javaDirectory=path.join(plugin,'android/src/main/java/ai/eliza/plugins/passwords');
const java=Object.fromEntries(fs.readdirSync(javaDirectory).map(name=>[name,fs.readFileSync(path.join(javaDirectory,name),'utf8')]));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function walk(directory,out=[]){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file,out);else if(/\.(ts|tsx|js|mjs)$/.test(entry.name))out.push(file);}return out;}

test('upstream vault client and JVM policy/custody tests pass on the patched source',()=>{
 // A clean environment: an inherited NODE_TEST_CONTEXT would turn the child into a subtest reporter.
 const {NODE_TEST_CONTEXT,...env}=process.env;
 for(const file of [path.join(plugin,'test/client.node.mjs'),path.join(plugin,'test/native-host/policy.node.mjs'),path.join(patched,'plugins/plugin-native-secure-store/test/native-host/password-custody.node.mjs')]){
  const output=execFileSync(process.execPath,['--test','--test-reporter=spec',file],{encoding:'utf8',env,timeout:180000});
  assert.match(output,/ℹ fail 0/,file);assert.doesNotMatch(output,/ℹ pass 0\b/,file);
 }
});

test('native vault code never logs, prints or puts secrets in Intents or bridge results',()=>{
 for(const [name,source] of Object.entries(java)){
  assert.doesNotMatch(source,/\bLog\.[a-z]+\(|printStackTrace|System\.(out|err)/,name);
  // Intents carry only the one-shot token URI or the framework Dataset result.
  for(const extra of source.matchAll(/putExtra\(([^,]+),/g))assert.equal(extra[1].trim(),'AutofillManager.EXTRA_AUTHENTICATION_RESULT',name);
 }
 const bridge=java['PasswordsPlugin.java'];
 const keys=new Set([...bridge.matchAll(/\b(?:result|item|binding|autofill)\.put\("([A-Za-z]+)"/g)].map(match=>match[1]));
 const allowed=new Set(['autofill','available','biometric','bindings','clearsAfterMs','copied','destination','display','entries','facet','generated','hidesAfterMs','id','kind','label','length','locked','reason','removed','reset','selected','shown','status','supported','unlockRemainingMs','unlockSeconds','unlocked','updatedAt','username']);
 assert.ok(keys.size>=20);
 for(const key of keys){assert.ok(allowed.has(key),`unexpected bridge result key ${key}`);assert.doesNotMatch(key,/password|secret|otp|passkey|credential/i,key);}
 // The only reads of a stored password feed the FLAG_SECURE reveal, the clipboard or the framework Dataset.
 const reads=Object.entries(java).flatMap(([name,source])=>[...source.matchAll(/record\.getString\("password"\)/g)].map(()=>name)).sort();
 assert.deepEqual(reads,['PasswordFillActivity.java','PasswordsPlugin.java']);
 assert.match(java['PasswordSheet.java'],/FLAG_SECURE/);assert.match(java['SecretSurfaces.java'],/FLAG_SECURE/);
 assert.match(java['SecretSurfaces.java'],/IS_SENSITIVE/);
 // The fill picker authenticates every time; an earlier unlock is never reused for a fill.
 const picker=java['PasswordFillActivity.java'],onCreate=picker.slice(picker.indexOf('protected void onCreate'),picker.indexOf('private void unlock()'));
 assert.match(onCreate,/\n    unlock\(\);\n  \}/);assert.doesNotMatch(onCreate,/unlocked\(\)/);
 assert.match(java['PasswordUnlock.java'],/long ticket = access\.begin\(\);/);
 // The clipboard clear also runs in the background, where Android hides the clip description.
 assert.match(java['SecretSurfaces.java'],/boolean ours = description == null \|\|/);
 // Fill requests never open the vault: offers are built without reading entries.
 assert.doesNotMatch(java['ElizaPasswordAutofillService.java'],/\.use\(|entries\(|\.get\(id/);
});

test('only the Settings password manager can reach the vault bridge; agent paths cannot',()=>{
 const users=walk(path.join(root,'apps/app/src')).filter(file=>/ElizaPasswords|plugin-native-passwords/.test(fs.readFileSync(file,'utf8'))).map(file=>path.relative(root,file)).sort();
 assert.deepEqual(users,['apps/app/src/passwords/dev-vault.ts','apps/app/src/passwords/password-manager.ts']);
 for(const file of ['apps/app/src/runtime/phone-context.ts','apps/app/src/runtime/device-actions.ts','apps/app/src/runtime/alpha-client.ts','apps/app/src/runtime/phone-workflow-authoring.ts'])
  assert.doesNotMatch(read(file),/passwords\/|ElizaPasswords/,file);
 for(const file of walk(path.join(root,'backend')))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/ElizaPasswords|plugin-native-passwords/,file);
 // The password pages pause the agent observation, which then refuses to send any context.
 assert.match(read('apps/app/src/prototype/agent-adapter.ts'),/view === 'settings' && passwordSurfaceOpen\(shell\.vget\('settings'\)\)/);
 assert.match(read('apps/app/src/runtime/phone-context.ts'),/input\.sensitive[^\n]*throw new Error\('This screen cannot share agent context\.'\)/);
 // Password-manager state is module memory: never written to view state, storage or toasts.
 const manager=read('apps/app/src/passwords/password-manager.ts');
 assert.doesNotMatch(manager,/localStorage|sessionStorage|indexedDB|console\./);
 assert.doesNotMatch(manager,/helpers\.set\(\{[^}]*\bpassword\s*:/i);
 assert.doesNotMatch(manager,/toast\([^)]*(password\b|secret)/);
});

test('Android packaging keeps the vault out of backup and declares the provider for user selection',()=>{
 const manifest=read('android/app/src/main/AndroidManifest.xml');
 assert.match(manifest,/android:allowBackup="false"/);
 assert.match(manifest,/<service android:name="ai\.eliza\.plugins\.passwords\.ElizaPasswordAutofillService"[^>]*android:permission="android\.permission\.BIND_AUTOFILL_SERVICE"/);
 assert.doesNotMatch(manifest,/WRITE_SECURE_SETTINGS/);
 const values=read('android/app/src/main/res/values/eliza_passwords.xml');
 assert.match(values,/eliza_passwords_unlock_seconds">60</);
 assert.match(values,/eliza_passwords_host_is_browser">true</);
 assert.match(fs.readFileSync(path.join(javaDirectory,'PasswordsConfig.java'),'utf8'),/getNoBackupFilesDir\(\)/);
 const browser=read('android/app/src/main/java/ai/elizaresearch/alphaphone/AlphaBrowserPlugin.java');
 assert.match(browser,/putString\(PasswordFormPolicy\.TOP_ORIGIN_EXTRA,origin\)/);
 // The host's own renderer WebView stays excluded from autofill.
 assert.match(browser,/getBridge\(\)\.getWebView\(\)\.setImportantForAutofill\(View\.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS\)/);
});
